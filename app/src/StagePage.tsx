import { emit, listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import "./App.css";
import { FitText } from "./PresentationScreen";
import { DEFAULT_THEME, loadTheme, Theme } from "./theme";

/** O que a tela de palco mostra. Enviado pela execução a cada mudança de slide. */
export type StageInfo = {
  title: string;
  current: string;
  next: string;
  nextTitle: string;
  itemStartedAt: number;
  serviceStartedAt: number;
  plannedSec?: number;
};

function clock(ms: number): string {
  const total = Math.floor(Math.abs(ms) / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${ms < 0 ? "-" : ""}${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Tela de palco (confidence monitor): para quem lidera, sem poluir o projetor. */
function StagePage() {
  const [info, setInfo] = useState<StageInfo | null>(null);
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    loadTheme().then(setTheme);
    const unlisten = [
      listen<StageInfo>("stage", (event) => setInfo(event.payload)),
      listen<Theme>("theme-changed", (event) => setTheme(event.payload)),
    ];
    Promise.all(unlisten).then(() => emit("stage-ready"));
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => {
      unlisten.forEach((promise) => promise.then((stop) => stop()));
      window.clearInterval(timer);
    };
  }, []);

  const elapsedItem = info ? now - info.itemStartedAt : 0;
  const remaining = info?.plannedSec ? info.plannedSec * 1000 - elapsedItem : null;
  const over = remaining !== null && remaining < 0;
  const font = { fontFamily: theme.fontFamily };

  return (
    <main className="stage" style={font}>
      <header className="stage-bar">
        <span className="stage-clock">{new Date(now).toLocaleTimeString()}</span>
        <span className="stage-title">{info?.title ?? "Aguardando a execução do culto..."}</span>
        <span className="stage-timers">
          {info && <span>culto {clock(now - info.serviceStartedAt)}</span>}
          {info && (
            <span className={over ? "stage-over" : ""}>
              {remaining !== null ? `item ${clock(remaining)}` : `item ${clock(elapsedItem)}`}
            </span>
          )}
        </span>
      </header>

      <section className="stage-current">
        <FitText text={info?.current ?? ""} percent={11} className="stage-text" />
      </section>

      <section className="stage-next">
        <span className="stage-label">A seguir{info?.nextTitle ? `: ${info.nextTitle}` : ""}</span>
        <div className="stage-next-text">
          <FitText text={info?.next ?? ""} percent={7} className="stage-text stage-dim" />
        </div>
      </section>
    </main>
  );
}

export default StagePage;
