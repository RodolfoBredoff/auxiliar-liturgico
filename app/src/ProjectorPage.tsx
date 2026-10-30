import { emit, listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import "./App.css";
import PresentationScreen, { Slide } from "./PresentationScreen";
import { DEFAULT_THEME, loadTheme, Theme } from "./theme";

/** Janela do projetor: só mostra o slide recebido da execução. */
function ProjectorPage() {
  const [slide, setSlide] = useState<Slide | null>(null);
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    loadTheme().then(setTheme);
    const unlisten = [
      listen<Slide | null>("slide", (event) => setSlide(event.payload)),
      listen<Theme>("theme-changed", (event) => setTheme(event.payload)),
    ];
    Promise.all(unlisten).then(() => emit("projector-ready"));
    return () => {
      unlisten.forEach((promise) => promise.then((stop) => stop()));
    };
  }, []);

  return (
    <main className="projector">
      <PresentationScreen slide={slide} theme={theme} />
    </main>
  );
}

export default ProjectorPage;
