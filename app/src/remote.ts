import { invoke } from "@tauri-apps/api/core";
import { getSetting, setSetting } from "./db";

export type RemoteInfo = { running: boolean; ip: string; port: number };

export type RemoteUrls = { control: string; overlay: string; captions: string };

const DEFAULT_PORT = 8765;

/** Código de acesso das páginas remotas. Criado uma vez e guardado, para a URL do OBS não mudar. */
export async function ensureRemoteToken(): Promise<string> {
  let token = await getSetting("remote_token");
  if (!token) {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    token = Array.from(bytes, (b) => (b % 36).toString(36)).join("");
    await setSetting("remote_token", token);
  }
  return token;
}

export async function remotePort(): Promise<number> {
  return Number(await getSetting("remote_port")) || DEFAULT_PORT;
}

export async function startRemote(): Promise<RemoteInfo> {
  return invoke<RemoteInfo>("remote_start", { port: await remotePort(), token: await ensureRemoteToken() });
}

export async function stopRemote() {
  await invoke("remote_stop");
}

export async function remoteInfo(): Promise<RemoteInfo> {
  return invoke<RemoteInfo>("remote_info", { port: await remotePort() });
}

export function remoteUrls(info: RemoteInfo, token: string): RemoteUrls {
  const base = `http://${info.ip}:${info.port}`;
  return {
    control: `${base}/?t=${token}`,
    overlay: `http://localhost:${info.port}/overlay?t=${token}`,
    captions: `${base}/captions?t=${token}`,
  };
}

/** Estado enviado às páginas remotas (celular, OBS, legendas). */
export type RemoteState = {
  service: string;
  slide: { type: string; text: string } | null;
  layer: string;
  theme: unknown;
  next: string;
  item: number;
  items: { i: number; title: string }[];
  hold: boolean;
  listening: boolean;
  suggestion: string;
  caption: string;
  captionId: number;
};

export function pushRemoteState(state: RemoteState | Record<string, never>) {
  return invoke("remote_set_state", { json: JSON.stringify(state) }).catch(() => {});
}
