import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import { getSetting } from "./db";

type Status = { installed: boolean; path: string; dev: boolean };

/**
 * Prepara o reconhecimento de voz (Python, faster-whisper e modelo) sem usar o Terminal.
 * Com `onlyWhenMissing`, some quando já está tudo pronto (uso no aviso da tela inicial).
 */
function PythonSetup({ onlyWhenMissing = false }: { onlyWhenMissing?: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const logRef = useRef<HTMLPreElement>(null);

  async function refresh() {
    setStatus(await invoke<Status>("python_status"));
  }

  useEffect(() => {
    refresh().catch(() => {});
    const unlisten = [
      listen<string>("setup-progress", (event) => setLog((lines) => [...lines, event.payload].slice(-300))),
      listen<{ ok: boolean; message: string }>("setup-done", (event) => {
        setRunning(false);
        setResult(event.payload);
        refresh().catch(() => {});
      }),
    ];
    return () => {
      unlisten.forEach((promise) => promise.then((stop) => stop()));
    };
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [log]);

  async function start() {
    setLog([]);
    setResult(null);
    setRunning(true);
    try {
      await invoke("setup_python", { model: (await getSetting("whisper_model")) || "small" });
    } catch (e) {
      setRunning(false);
      setResult({ ok: false, message: String(e) });
    }
  }

  if (!status) return null;
  if (onlyWhenMissing && (status.installed || status.dev)) return null;

  return (
    <div className={onlyWhenMissing ? "suggestion setup-banner" : "setup"}>
      <div className="suggestion-text">
        {status.dev ? (
          <span className="hint">Modo desenvolvimento: o app usa o .venv do repositório.</span>
        ) : status.installed ? (
          <strong>✓ Reconhecimento de voz pronto</strong>
        ) : (
          <>
            <strong>O reconhecimento de voz ainda não foi preparado neste computador.</strong>
            <span className="hint">
              Instala o Python do app e baixa o modelo (cerca de 500 MB, precisa de internet; leva alguns minutos).
            </span>
          </>
        )}
        {result && <span className={result.ok ? "match" : "warning"}>{result.message}</span>}
      </div>
      {!status.dev && (
        <div className="actions">
          <button className="primary" disabled={running} onClick={start}>
            {running ? "Preparando..." : status.installed ? "Reinstalar / atualizar" : "Preparar reconhecimento de voz"}
          </button>
        </div>
      )}
      {log.length > 0 && (
        <pre className="setup-log" ref={logRef}>
          {log.join("\n")}
        </pre>
      )}
    </div>
  );
}

export default PythonSetup;
