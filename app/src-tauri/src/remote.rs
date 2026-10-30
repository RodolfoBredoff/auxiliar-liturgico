//! Servidor HTTP local: controle pelo celular, sobreposição para OBS e legendas ao vivo.
//!
//! Três páginas (`/`, `/overlay`, `/captions`), um estado em JSON (`/state`) e comandos (`/cmd`).
//! Toda requisição precisa do parâmetro `?t=TOKEN`. O estado é empurrado pela tela de execução
//! (`remote_set_state`) e os comandos voltam para ela como o evento `remote-command`.

use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream, UdpSocket};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

const CONTROL_HTML: &str = include_str!("../web/control.html");
const OVERLAY_HTML: &str = include_str!("../web/overlay.html");
const CAPTIONS_HTML: &str = include_str!("../web/captions.html");

struct Server {
    port: u16,
    token: String,
    stop: Arc<AtomicBool>,
}

pub struct Remote {
    state: Arc<Mutex<String>>,
    server: Mutex<Option<Server>>,
}

impl Default for Remote {
    fn default() -> Self {
        Remote {
            state: Arc::new(Mutex::new(String::from("{}"))),
            server: Mutex::new(None),
        }
    }
}

#[derive(Serialize)]
pub struct RemoteInfo {
    running: bool,
    ip: String,
    port: u16,
}

/// Endereço do computador na rede local (sem enviar nada: só consulta a rota padrão).
fn local_ip() -> String {
    UdpSocket::bind("0.0.0.0:0")
        .and_then(|socket| {
            socket.connect("8.8.8.8:80")?;
            socket.local_addr()
        })
        .map(|addr| addr.ip().to_string())
        .unwrap_or_else(|_| "localhost".to_string())
}

fn respond(stream: &mut TcpStream, status: &str, content_type: &str, body: &[u8]) {
    let header = format!(
        "HTTP/1.1 {status}\r\nContent-Type: {content_type}; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
        body.len()
    );
    let _ = stream.write_all(header.as_bytes());
    let _ = stream.write_all(body);
}

/// Comandos aceitos: palavras simples ("next") ou "goto:N". Nada além disso chega ao app.
fn valid_command(command: &str) -> bool {
    const SIMPLE: [&str; 9] = [
        "next", "previous", "black", "clear", "logo", "hold", "accept", "ignore", "live",
    ];
    if SIMPLE.contains(&command) {
        return true;
    }
    command
        .strip_prefix("goto:")
        .map(|n| !n.is_empty() && n.len() <= 4 && n.chars().all(|c| c.is_ascii_digit()))
        .unwrap_or(false)
}

type OnCommand = Arc<dyn Fn(String) + Send + Sync>;

fn handle(
    mut stream: TcpStream,
    on_command: &OnCommand,
    state: &Mutex<String>,
    token: &str,
) -> std::io::Result<()> {
    stream.set_read_timeout(Some(Duration::from_secs(5)))?;
    let mut reader = BufReader::new(stream.try_clone()?);

    let mut request_line = String::new();
    reader.read_line(&mut request_line)?;
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or("").to_string();
    let target = parts.next().unwrap_or("/").to_string();

    let mut content_length = 0usize;
    loop {
        let mut line = String::new();
        let read = reader.read_line(&mut line)?;
        if read == 0 || line == "\r\n" || line == "\n" {
            break;
        }
        if let Some((name, value)) = line.split_once(':') {
            if name.eq_ignore_ascii_case("content-length") {
                content_length = value.trim().parse().unwrap_or(0).min(256);
            }
        }
    }
    let mut body = vec![0u8; content_length];
    reader.read_exact(&mut body)?;

    let (path, query) = target.split_once('?').unwrap_or((target.as_str(), ""));
    let authorized = query.split('&').any(|pair| pair == format!("t={token}"));
    if !authorized {
        respond(&mut stream, "403 Forbidden", "text/plain", "Acesso negado.".as_bytes());
        return Ok(());
    }

    match (method.as_str(), path) {
        ("GET", "/") => respond(&mut stream, "200 OK", "text/html", CONTROL_HTML.as_bytes()),
        ("GET", "/overlay") => respond(&mut stream, "200 OK", "text/html", OVERLAY_HTML.as_bytes()),
        ("GET", "/captions") => {
            respond(&mut stream, "200 OK", "text/html", CAPTIONS_HTML.as_bytes())
        }
        ("GET", "/state") => {
            let json = state.lock().unwrap().clone();
            respond(&mut stream, "200 OK", "application/json", json.as_bytes());
        }
        ("POST", "/cmd") => {
            let command = String::from_utf8_lossy(&body).trim().to_string();
            if valid_command(&command) {
                on_command(command);
                respond(&mut stream, "200 OK", "text/plain", b"ok");
            } else {
                respond(&mut stream, "400 Bad Request", "text/plain", b"comando invalido");
            }
        }
        _ => respond(&mut stream, "404 Not Found", "text/plain", b"nao encontrado"),
    }
    Ok(())
}

/// Aceita conexões até `stop` ser acionado. Cada conexão roda em sua própria thread.
fn serve(
    listener: TcpListener,
    stop: Arc<AtomicBool>,
    state: Arc<Mutex<String>>,
    token: String,
    on_command: OnCommand,
) {
    for stream in listener.incoming() {
        if stop.load(Ordering::SeqCst) {
            break;
        }
        if let Ok(stream) = stream {
            let state = state.clone();
            let token = token.clone();
            let on_command = on_command.clone();
            thread::spawn(move || {
                let _ = handle(stream, &on_command, &state, &token);
            });
        }
    }
}

fn info(server: &Option<Server>, port: u16) -> RemoteInfo {
    RemoteInfo {
        running: server.is_some(),
        ip: local_ip(),
        port: server.as_ref().map(|s| s.port).unwrap_or(port),
    }
}

fn stop_server(server: &mut Option<Server>) {
    if let Some(old) = server.take() {
        old.stop.store(true, Ordering::SeqCst);
        // Uma conexão qualquer acorda o accept() para a thread perceber o sinal de parada.
        let _ = TcpStream::connect(("127.0.0.1", old.port));
    }
}

#[tauri::command]
pub fn remote_start(
    app: AppHandle,
    remote: State<Remote>,
    port: u16,
    token: String,
) -> Result<RemoteInfo, String> {
    if token.len() < 4 || !token.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err("Código de acesso inválido.".into());
    }
    let mut server = remote.server.lock().unwrap();
    if let Some(current) = server.as_ref() {
        if current.port == port && current.token == token {
            return Ok(info(&server, port));
        }
    }
    stop_server(&mut server);

    let listener = TcpListener::bind(("0.0.0.0", port))
        .map_err(|e| format!("Não foi possível abrir a porta {port}: {e}"))?;
    let stop = Arc::new(AtomicBool::new(false));

    let stop_flag = stop.clone();
    let state = remote.state.clone();
    let serve_token = token.clone();
    let on_command: OnCommand = Arc::new(move |command| {
        let _ = app.emit("remote-command", command);
    });
    thread::spawn(move || serve(listener, stop_flag, state, serve_token, on_command));

    *server = Some(Server { port, token, stop });
    Ok(info(&server, port))
}

#[tauri::command]
pub fn remote_stop(remote: State<Remote>) {
    stop_server(&mut remote.server.lock().unwrap());
}

#[tauri::command]
pub fn remote_info(remote: State<Remote>, port: u16) -> RemoteInfo {
    info(&remote.server.lock().unwrap(), port)
}

#[tauri::command]
pub fn remote_set_state(remote: State<Remote>, json: String) {
    *remote.state.lock().unwrap() = json;
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Faz uma requisição HTTP simples e devolve (status, corpo).
    fn request(port: u16, method: &str, path: &str, body: &str) -> (u16, String) {
        let mut stream = TcpStream::connect(("127.0.0.1", port)).unwrap();
        let text = format!(
            "{method} {path} HTTP/1.1\r\nHost: x\r\nContent-Length: {}\r\n\r\n{body}",
            body.len()
        );
        stream.write_all(text.as_bytes()).unwrap();
        let mut response = String::new();
        stream.read_to_string(&mut response).unwrap();
        let status = response.split_whitespace().nth(1).unwrap().parse().unwrap();
        let body = response.split("\r\n\r\n").nth(1).unwrap_or("").to_string();
        (status, body)
    }

    #[test]
    fn servidor_responde_exige_token_e_repassa_comandos() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        let state = Arc::new(Mutex::new(String::from("{\"slide\":null}")));
        let received = Arc::new(Mutex::new(Vec::<String>::new()));
        let sink = received.clone();
        let on_command: OnCommand = Arc::new(move |c| sink.lock().unwrap().push(c));
        let stop = Arc::new(AtomicBool::new(false));
        thread::spawn({
            let (stop, state) = (stop.clone(), state.clone());
            move || serve(listener, stop, state, "abc123".into(), on_command)
        });

        // sem token ou com token errado: negado
        assert_eq!(request(port, "GET", "/state", "").0, 403);
        assert_eq!(request(port, "GET", "/state?t=errado", "").0, 403);
        assert_eq!(request(port, "POST", "/cmd", "next").0, 403);

        // estado e páginas
        assert_eq!(request(port, "GET", "/state?t=abc123", ""), (200, "{\"slide\":null}".into()));
        *state.lock().unwrap() = String::from("{\"slide\":{\"text\":\"Olá\"}}");
        assert_eq!(request(port, "GET", "/state?t=abc123", "").1, "{\"slide\":{\"text\":\"Olá\"}}");
        for page in ["/", "/overlay", "/captions"] {
            let (status, html) = request(port, "GET", &format!("{page}?t=abc123"), "");
            assert_eq!(status, 200, "{page}");
            assert!(html.contains("<html"), "{page}");
        }
        assert_eq!(request(port, "GET", "/nada?t=abc123", "").0, 404);

        // comandos: só os conhecidos chegam ao app
        assert_eq!(request(port, "POST", "/cmd?t=abc123", "next").0, 200);
        assert_eq!(request(port, "POST", "/cmd?t=abc123", "goto:3").0, 200);
        assert_eq!(request(port, "POST", "/cmd?t=abc123", "apagar tudo").0, 400);
        assert_eq!(*received.lock().unwrap(), vec!["next".to_string(), "goto:3".to_string()]);

        stop.store(true, Ordering::SeqCst);
        let _ = TcpStream::connect(("127.0.0.1", port));
    }

    #[test]
    fn corpo_grande_nao_derruba_o_servidor() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        let on_command: OnCommand = Arc::new(|_| {});
        let stop = Arc::new(AtomicBool::new(false));
        thread::spawn({
            let stop = stop.clone();
            move || serve(listener, stop, Arc::new(Mutex::new("{}".into())), "tok123".into(), on_command)
        });
        let big = "x".repeat(300);
        let _ = request(port, "POST", "/cmd?t=tok123", &big);
        assert_eq!(request(port, "GET", "/state?t=tok123", "").0, 200);
        stop.store(true, Ordering::SeqCst);
        let _ = TcpStream::connect(("127.0.0.1", port));
    }

    #[test]
    fn aceita_so_comandos_conhecidos() {
        assert!(valid_command("next"));
        assert!(valid_command("goto:12"));
        assert!(!valid_command("goto:"));
        assert!(!valid_command("goto:abc"));
        assert!(!valid_command("goto:123456"));
        assert!(!valid_command("rm -rf"));
        assert!(!valid_command(""));
    }
}
