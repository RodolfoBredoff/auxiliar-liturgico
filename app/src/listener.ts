import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import { getSetting } from "./db";

export type ListenerStatus = "parado" | "carregando" | "escutando";

export type TranscriptLine = {
  text: string;
  start?: number;
  end?: number;
  emitted_at?: number;
  transcribe_ms?: number;
};

const MAX_RESTARTS = 3;
const CONTEXT_FILE = "whisper_context.json";

/**
 * Dá ao Whisper o vocabulário do que vem a seguir (títulos, nomes, palavras da letra).
 * O listen.py relê o arquivo sempre que ele muda, sem reiniciar a escuta.
 */
export async function writeWhisperContext(prompt: string, hotwords: string) {
  const path = await invoke<string>("data_path", { name: CONTEXT_FILE });
  await invoke("write_text_file", { path, content: JSON.stringify({ prompt, hotwords }) });
}

/** Controla o script Python de escuta e entrega cada transcrição recebida. */
export function useListener(onTranscript: (line: TranscriptLine) => void) {
  const [status, setStatus] = useState<ListenerStatus>("parado");
  const [error, setError] = useState("");
  const [level, setLevel] = useState(0);
  const [lagSeconds, setLagSeconds] = useState(0);
  const [lastTranscriptAt, setLastTranscriptAt] = useState<number | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const wantRef = useRef(false);
  const restartsRef = useRef(0);
  const startRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    const unlisten = [
      listen<string>("listener-status", (event) => {
        const next = event.payload as ListenerStatus;
        setStatus(next);
        if (next === "escutando") {
          restartsRef.current = 0;
          setError("");
        }
        if (next === "parado") {
          setLevel(0);
          setLagSeconds(0);
          // Caiu sozinho (o operador não pediu para parar): tenta de novo algumas vezes.
          if (wantRef.current && restartsRef.current < MAX_RESTARTS) {
            restartsRef.current += 1;
            setError(`A escuta parou. Reiniciando (${restartsRef.current}/${MAX_RESTARTS})...`);
            window.setTimeout(() => {
              if (wantRef.current) void startRef.current();
            }, 2000);
          } else if (wantRef.current) {
            wantRef.current = false;
            setError("A escuta parou várias vezes seguidas. Verifique o microfone e clique em Ouvir.");
          }
        }
      }),
      listen<string>("listener-error", (event) => setError(event.payload)),
      listen<string>("listener-level", (event) => setLevel(Number(event.payload) || 0)),
      listen<string>("listener-lag", (event) => setLagSeconds(Number(event.payload) || 0)),
      listen<string>("transcript", (event) => {
        setLastTranscriptAt(Date.now());
        setLagSeconds(0);
        onTranscriptRef.current(JSON.parse(event.payload) as TranscriptLine);
      }),
    ];
    return () => {
      wantRef.current = false;
      unlisten.forEach((promise) => promise.then((stop) => stop()));
      invoke("stop_listening");
    };
  }, []);

  async function start() {
    wantRef.current = true;
    setError((current) => (current.startsWith("A escuta parou") ? current : ""));
    try {
      const blockSeconds = Number((await getSetting("block_seconds")) || 3);
      const blockOverlap = Number((await getSetting("block_overlap")) || 1);
      const promptFile = await invoke<string>("data_path", { name: CONTEXT_FILE });
      await invoke("start_listening", {
        model: (await getSetting("whisper_model")) || "small",
        device: await getSetting("audio_device"),
        blockSeconds,
        blockOverlap,
        promptFile,
        pauseMode: (await getSetting("pause_segmentation")) === "1",
      });
    } catch (e) {
      wantRef.current = false;
      setError(String(e));
    }
  }
  startRef.current = start;

  async function stop() {
    wantRef.current = false;
    restartsRef.current = 0;
    await invoke("stop_listening");
    setStatus("parado");
    setLevel(0);
    setError("");
  }

  return { status, error, level, lagSeconds, lastTranscriptAt, start, stop };
}
