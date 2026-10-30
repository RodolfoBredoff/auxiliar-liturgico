//! Preparação do Python dentro do app (substitui rodar o instalar.command à mão).
//!
//! Cria um ambiente virtual na pasta de dados do app, instala faster-whisper e sounddevice e
//! baixa o modelo do Whisper. O andamento chega à tela pelos eventos `setup-progress` (cada linha
//! de saída) e `setup-done` ({ ok, message }).

use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

const PACKAGES: [&str; 2] = ["faster-whisper==1.2.1", "sounddevice==0.5.6"];

/// Impede duas instalações ao mesmo tempo.
#[derive(Default)]
pub struct Setup(Arc<AtomicBool>);

#[derive(Serialize)]
pub struct PythonStatus {
    installed: bool,
    path: String,
    /// Em desenvolvimento o app usa o .venv do repositório e não precisa de instalação.
    dev: bool,
}

/// Python do ambiente virtual do app instalado.
pub fn venv_python(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("python");
    Ok(if cfg!(windows) {
        dir.join("Scripts/python.exe")
    } else {
        dir.join("bin/python")
    })
}

fn dev_python() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(if cfg!(windows) {
        "../../.venv/Scripts/python.exe"
    } else {
        "../../.venv/bin/python"
    })
}

fn has_modules(python: &Path) -> bool {
    Command::new(python)
        .args(["-c", "import faster_whisper, sounddevice, numpy"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

#[tauri::command]
pub async fn python_status(app: AppHandle) -> Result<PythonStatus, String> {
    let dev = cfg!(debug_assertions);
    let python = if dev { dev_python() } else { venv_python(&app)? };
    Ok(PythonStatus {
        installed: python.exists() && has_modules(&python),
        path: python.to_string_lossy().into_owned(),
        dev,
    })
}

fn compatible(python: &Path) -> bool {
    Command::new(python)
        .args([
            "-c",
            "import sys; sys.exit(0 if (3, 9) <= sys.version_info[:2] <= (3, 13) else 1)",
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Procura um Python 3.9 a 3.13. Apps abertos pelo Finder têm um PATH mínimo,
/// então as pastas comuns são testadas pelo caminho completo.
fn find_python() -> Option<PathBuf> {
    let names: &[&str] = if cfg!(windows) {
        &["python", "python3"]
    } else {
        &["python3.12", "python3.13", "python3.11", "python3.10", "python3.9", "python3"]
    };
    let dirs: &[&str] = &[
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/Library/Frameworks/Python.framework/Versions/Current/bin",
        "/usr/bin",
    ];
    for name in names {
        for dir in dirs {
            let candidate = Path::new(dir).join(name);
            if candidate.exists() && compatible(&candidate) {
                return Some(candidate);
            }
        }
    }
    names
        .iter()
        .map(PathBuf::from)
        .find(|candidate| compatible(candidate))
}

/// Roda um comando mandando cada linha de saída para a tela.
fn run_step(app: &AppHandle, label: &str, program: &Path, args: &[&str]) -> Result<(), String> {
    let _ = app.emit("setup-progress", format!("== {label}"));
    let mut child = Command::new(program)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("{label}: não foi possível executar ({e})"))?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let err_app = app.clone();
    let err_thread = thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            let _ = err_app.emit("setup-progress", line);
        }
    });
    for line in BufReader::new(stdout).lines().map_while(Result::ok) {
        let _ = app.emit("setup-progress", line);
    }
    let _ = err_thread.join();

    let status = child.wait().map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("{label}: falhou (código {})", status.code().unwrap_or(-1)))
    }
}

fn install(app: &AppHandle, model: &str) -> Result<(), String> {
    let _ = app.emit("setup-progress", "== Procurando Python (3.9 a 3.13)".to_string());
    let system_python = find_python().ok_or_else(|| {
        "Python compatível não encontrado. Instale o Python 3.12 em python.org/downloads e tente de novo."
            .to_string()
    })?;
    let _ = app.emit(
        "setup-progress",
        format!("Usando {}", system_python.to_string_lossy()),
    );

    let python = venv_python(app)?;
    let venv_dir = python
        .parent()
        .and_then(Path::parent)
        .ok_or("Pasta do ambiente inválida.")?
        .to_path_buf();
    std::fs::create_dir_all(&venv_dir).map_err(|e| e.to_string())?;

    if !python.exists() {
        run_step(
            app,
            "Criando o ambiente Python",
            &system_python,
            &["-m", "venv", &venv_dir.to_string_lossy()],
        )?;
    }
    run_step(
        app,
        "Atualizando o pip",
        &python,
        &["-m", "pip", "install", "--upgrade", "pip", "--disable-pip-version-check", "--progress-bar", "off"],
    )?;

    let mut args = vec!["-m", "pip", "install", "--disable-pip-version-check", "--progress-bar", "off"];
    args.extend(PACKAGES);
    run_step(app, "Instalando faster-whisper e sounddevice (alguns minutos)", &python, &args)?;

    let download = format!(
        "from faster_whisper import WhisperModel; WhisperModel('{model}', device='cpu', compute_type='int8'); print('modelo pronto')"
    );
    run_step(
        app,
        &format!("Baixando o modelo '{model}' (só na primeira vez)"),
        &python,
        &["-c", &download],
    )
}

/// Modelos aceitos: só letras, números, ponto, hífen e sublinhado (o nome vai para um comando).
fn valid_model(model: &str) -> bool {
    !model.is_empty()
        && model.len() <= 40
        && model
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'))
}

#[tauri::command]
pub async fn setup_python(app: AppHandle, setup: State<'_, Setup>, model: String) -> Result<(), String> {
    if cfg!(debug_assertions) {
        return Err("Em desenvolvimento o app usa o .venv do repositório.".into());
    }
    if !valid_model(&model) {
        return Err("Nome de modelo inválido.".into());
    }
    if setup.0.swap(true, Ordering::SeqCst) {
        return Err("A preparação já está em andamento.".into());
    }

    let running = setup.0.clone();
    thread::spawn(move || {
        let result = install(&app, &model);
        running.store(false, Ordering::SeqCst);
        let (ok, message) = match result {
            Ok(()) => (true, "Pronto. Já pode clicar em Ouvir.".to_string()),
            Err(error) => (false, error),
        };
        let _ = app.emit(
            "setup-done",
            serde_json::json!({ "ok": ok, "message": message }),
        );
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::valid_model;

    #[test]
    fn modelo_so_com_caracteres_seguros() {
        assert!(valid_model("small"));
        assert!(valid_model("large-v3"));
        assert!(valid_model("distil-large-v3.en"));
        assert!(!valid_model(""));
        assert!(!valid_model("small'); import os; ('"));
        assert!(!valid_model("a b"));
    }
}
