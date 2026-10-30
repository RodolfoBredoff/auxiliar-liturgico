use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;

use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, Position, RunEvent, State, WebviewUrl,
    WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_sql::{Migration, MigrationKind};

mod output;
mod remote;
mod setup;

/// Processo Python que escuta o microfone (python/listen.py).
struct Listener(Mutex<Option<Child>>);

/// Processo Python de track sync (python/sync_ref.py).
struct TrackSync(Mutex<Option<Child>>);

/// Python e script da escuta.
/// Desenvolvimento: .venv e python/ do repositório.
/// App instalado: Python criado pelo instalar.command e listen.py embutido no app.
fn listener_paths(app: &AppHandle) -> Result<(PathBuf, PathBuf), String> {
    if cfg!(debug_assertions) {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
        return Ok((root.join(".venv/bin/python"), root.join("python/listen.py")));
    }

    let python = setup::venv_python(app)?;
    let script = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("listen.py");

    if !python.exists() {
        return Err("Python não preparado. Abra Configurações e clique em Preparar reconhecimento de voz.".into());
    }
    Ok((python, script))
}

fn python_and_dir(app: &AppHandle) -> Result<(PathBuf, PathBuf), String> {
    if cfg!(debug_assertions) {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
        return Ok((root.join(".venv/bin/python"), root.join("python")));
    }
    let python = setup::venv_python(app)?;
    let dir = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?;
    if !python.exists() {
        return Err("Python não preparado. Abra Configurações e clique em Preparar reconhecimento de voz.".into());
    }
    Ok((python, dir))
}

#[tauri::command]
fn start_listening(
    app: AppHandle,
    listener: State<Listener>,
    model: String,
    device: String,
    block_seconds: f64,
    block_overlap: f64,
    prompt_file: String,
    pause_mode: bool,
) -> Result<(), String> {
    let mut current = listener.0.lock().unwrap();
    if current.is_some() {
        return Ok(());
    }

    let (python, script) = listener_paths(&app)?;
    let mut command = Command::new(python);
    command
        .arg(script)
        .args(["--model", &model])
        .args([
            "--seconds",
            &block_seconds.to_string(),
            "--overlap",
            &block_overlap.to_string(),
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if !device.is_empty() {
        command.args(["--device", &device]);
    }
    if !prompt_file.is_empty() {
        command.args(["--prompt-file", &prompt_file]);
    }
    if pause_mode {
        command.arg("--pause-mode");
    }

    let mut child = command
        .spawn()
        .map_err(|e| format!("Não foi possível iniciar o Python: {e}"))?;

    let pid = child.id();
    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let out_app = app.clone();
    thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            let _ = out_app.emit("transcript", line);
        }
        // O processo terminou sozinho (erro). Se foi parado pelo operador, já saiu do estado.
        let listener = out_app.state::<Listener>();
        let mut current = listener.0.lock().unwrap();
        if current.as_ref().map(Child::id) == Some(pid) {
            if let Some(mut child) = current.take() {
                let _ = child.wait();
            }
            let _ = out_app.emit("listener-status", "parado");
        }
    });

    let err_app = app.clone();
    thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            if line.starts_with("Escutando") {
                let _ = err_app.emit("listener-status", "escutando");
            } else if let Some(level) = line.strip_prefix("NIVEL ") {
                let _ = err_app.emit("listener-level", level.to_string());
            } else if let Some(lag) = line.strip_prefix("ATRASO ") {
                let _ = err_app.emit("listener-lag", lag.to_string());
            } else if line.contains("Error") {
                let _ = err_app.emit("listener-error", line);
            }
        }
    });

    *current = Some(child);
    let _ = app.emit("listener-status", "carregando");
    Ok(())
}

#[tauri::command]
fn stop_listening(app: AppHandle) {
    stop_listen(&app);
}

fn stop_listen(app: &AppHandle) {
    if let Some(mut child) = app.state::<Listener>().0.lock().unwrap().take() {
        let _ = child.kill();
        let _ = child.wait();
    }
}

#[tauri::command]
fn start_track_sync(
    app: AppHandle,
    track: State<TrackSync>,
    reference_path: String,
    song_id: i64,
    device: String,
    pa_delay_ms: i64,
) -> Result<(), String> {
    let mut current = track.0.lock().unwrap();
    if current.is_some() {
        return Ok(());
    }
    if reference_path.is_empty() {
        return Err("Caminho da faixa de referência vazio.".into());
    }

    let (python, dir) = python_and_dir(&app)?;
    let mut command = Command::new(python);
    command.current_dir(&dir).arg("sync_ref.py").args([
            "--reference",
            &reference_path,
            "--song-id",
            &song_id.to_string(),
            "--pa-delay-ms",
            &pa_delay_ms.to_string(),
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if !device.is_empty() {
        command.args(["--device", &device]);
    }

    let mut child = command
        .spawn()
        .map_err(|e| format!("Não foi possível iniciar track sync: {e}"))?;

    let pid = child.id();
    let stdout = child.stdout.take().unwrap();

    let out_app = app.clone();
    thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            let _ = out_app.emit("track-position", line);
        }
        let track = out_app.state::<TrackSync>();
        let mut current = track.0.lock().unwrap();
        if current.as_ref().map(Child::id) == Some(pid) {
            if let Some(mut child) = current.take() {
                let _ = child.wait();
            }
            let _ = out_app.emit("track-status", "parado");
        }
    });

    *current = Some(child);
    let _ = app.emit("track-status", "escutando");
    Ok(())
}

#[tauri::command]
fn stop_track_sync(app: AppHandle) {
    stop_track(&app);
}

fn stop_track(app: &AppHandle) {
    if let Some(mut child) = app.state::<TrackSync>().0.lock().unwrap().take() {
        let _ = child.kill();
        let _ = child.wait();
    }
}

fn stop_all(app: &AppHandle) {
    stop_listen(app);
    stop_track(app);
}

/// Abre a janela do projetor. Com monitor externo, ocupa ele em tela cheia;
/// com um monitor só, abre como janela comum para não cobrir o operador.
#[tauri::command]
async fn open_projector(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("projector") {
        return window.set_focus().map_err(|e| e.to_string());
    }

    let primary = app.primary_monitor().map_err(|e| e.to_string())?;
    let external = app
        .available_monitors()
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|monitor| primary.as_ref().map(|p| p.position()) != Some(monitor.position()));

    let window = WebviewWindowBuilder::new(&app, "projector", WebviewUrl::App("index.html".into()))
        .title("Projetor — Auxiliar Litúrgico")
        .inner_size(960.0, 540.0)
        .build()
        .map_err(|e| e.to_string())?;

    if let Some(monitor) = external {
        let PhysicalPosition { x, y } = *monitor.position();
        window
            .set_position(Position::Physical(PhysicalPosition::new(x, y)))
            .map_err(|e| e.to_string())?;
        window.set_fullscreen(true).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn close_projector(app: AppHandle) {
    if let Some(window) = app.get_webview_window("projector") {
        let _ = window.close();
    }
}

/// Abre a tela de palco (slide atual, próximo, relógio e cronômetro) como janela comum;
/// o operador a arrasta para o monitor de retorno do palco.
#[tauri::command]
async fn open_stage(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("stage") {
        return window.set_focus().map_err(|e| e.to_string());
    }
    WebviewWindowBuilder::new(&app, "stage", WebviewUrl::App("index.html".into()))
        .title("Palco — Auxiliar Litúrgico")
        .inner_size(960.0, 540.0)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn close_stage(app: AppHandle) {
    if let Some(window) = app.get_webview_window("stage") {
        let _ = window.close();
    }
}

/// "~/pasta/arquivo" vira o caminho completo da pasta do usuário.
fn expand_home(path: &str) -> PathBuf {
    if let Some(rest) = path.strip_prefix("~/") {
        if let Ok(home) = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")) {
            return PathBuf::from(home).join(rest);
        }
    }
    PathBuf::from(path)
}

/// Caminho de um arquivo na pasta de dados do app (backups, contexto do Whisper).
/// Cria as pastas necessárias. `name` pode ter subpastas ("backups/auto.json"), mas não "..".
#[tauri::command]
fn data_path(app: AppHandle, name: String) -> Result<String, String> {
    if name.contains("..") || name.starts_with('/') {
        return Err("Nome de arquivo inválido.".into());
    }
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(&name);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(expand_home(&path), content)
        .map_err(|e| format!("Não foi possível gravar {path}: {e}"))
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(expand_home(&path))
        .map_err(|e| format!("Não foi possível ler {path}: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "tabelas iniciais",
            sql: include_str!("../migrations/001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "roteiro e saida externa",
            sql: include_str!("../migrations/002_roteiro_output.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "track sync referencia",
            sql: include_str!("../migrations/003_track_sync.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "arranjo, log da sessao e biblia",
            sql: include_str!("../migrations/004_profissional.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:auxiliar.db", migrations)
                .build(),
        )
        .manage(Listener(Mutex::new(None)))
        .manage(TrackSync(Mutex::new(None)))
        .manage(remote::Remote::default())
        .manage(setup::Setup::default())
        .invoke_handler(tauri::generate_handler![
            start_listening,
            stop_listening,
            start_track_sync,
            stop_track_sync,
            open_projector,
            close_projector,
            open_stage,
            close_stage,
            data_path,
            write_text_file,
            read_text_file,
            remote::remote_start,
            remote::remote_stop,
            remote::remote_info,
            remote::remote_set_state,
            setup::python_status,
            setup::setup_python,
            output::list_midi_ports,
            output::send_midi_pulse,
            output::powerpoint_go_to_slide,
        ])
        .on_window_event(|window, event| {
            if let WindowEvent::Destroyed = event {
                match window.label() {
                    "projector" => {
                        let _ = window.app_handle().emit("projector-closed", ());
                    }
                    "stage" => {
                        let _ = window.app_handle().emit("stage-closed", ());
                    }
                    "main" => window.app_handle().exit(0),
                    _ => {}
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                stop_all(app);
            }
        });
}
