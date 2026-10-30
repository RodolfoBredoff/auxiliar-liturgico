import { useEffect, useState } from "react";
import "./App.css";
import { getSetting, listServices, setSetting } from "./db";
import type { Service } from "./db";
import ExecutePage from "./ExecutePage";
import PythonSetup from "./PythonSetup";
import { startRemote } from "./remote";
import ServicesPage from "./ServicesPage";
import SettingsPage from "./SettingsPage";
import SongsPage from "./SongsPage";

type Page = "services" | "songs" | "settings";

function App() {
  const [page, setPage] = useState<Page>("services");
  const [running, setRunning] = useState<Service | null>(null);
  const [interrupted, setInterrupted] = useState<Service | null>(null);

  // Servidor de controle remoto / OBS / legendas, se estiver ligado nas configurações.
  useEffect(() => {
    getSetting("remote_enabled")
      .then((enabled) => (enabled === "1" ? startRemote() : undefined))
      .catch(() => {});
  }, []);

  // Se o app foi fechado no meio de um culto, a última posição continua gravada: oferece retomar.
  useEffect(() => {
    void (async () => {
      try {
        const saved = JSON.parse((await getSetting("last_position")) || "null") as {
          serviceId: number;
        } | null;
        if (!saved) return;
        const service = (await listServices()).find((entry) => entry.id === saved.serviceId);
        if (service) setInterrupted(service);
      } catch {
        // posição ilegível: ignora
      }
    })();
  }, []);

  function finish() {
    // Saída normal: apaga a posição para a próxima execução começar do início.
    void setSetting("last_position", "");
    setRunning(null);
  }

  if (running) {
    return (
      <main className="app">
        <ExecutePage serviceId={running.id} serviceTitle={running.title} onExit={finish} />
      </main>
    );
  }

  return (
    <main className="app">
      <header className="header">
        <h1>Auxiliar Litúrgico</h1>
        <nav>
          <button className={page === "services" ? "active" : ""} onClick={() => setPage("services")}>
            Cultos
          </button>
          <button className={page === "songs" ? "active" : ""} onClick={() => setPage("songs")}>
            Músicas
          </button>
          <button className={page === "settings" ? "active" : ""} onClick={() => setPage("settings")}>
            Configurações
          </button>
        </nav>
      </header>

      <PythonSetup onlyWhenMissing />

      {interrupted && (
        <div className="suggestion">
          <div className="suggestion-text">
            <strong>O culto “{interrupted.title}” foi interrompido.</strong>
            <span className="hint">Retomar de onde parou?</span>
          </div>
          <div className="actions">
            <button className="primary" onClick={() => setRunning(interrupted)}>
              Retomar
            </button>
            <button
              onClick={() => {
                void setSetting("last_position", "");
                setInterrupted(null);
              }}
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      {page === "services" && <ServicesPage onRun={setRunning} />}
      {page === "songs" && <SongsPage />}
      {page === "settings" && <SettingsPage />}
    </main>
  );
}

export default App;
