import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ProjectorPage from "./ProjectorPage";
import StagePage from "./StagePage";

const label = getCurrentWebviewWindow().label;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {label === "projector" ? <ProjectorPage /> : label === "stage" ? <StagePage /> : <App />}
  </React.StrictMode>,
);
