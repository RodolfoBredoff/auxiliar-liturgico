import { invoke } from "@tauri-apps/api/core";
import { getSetting } from "./db";
import type { ExternalRef, OutputTarget, ServiceItem } from "./db";

export async function syncExternalOutput(item: ServiceItem, blockIndex: number) {
  const ref = item.external_ref;
  if (item.output_target === "presenter_midi") {
    const port = (await getSetting("midi_port")) || "";
    const note = ref.presenter?.midiNote ?? Number((await getSetting("midi_note")) || 60);
    await invoke("send_midi_pulse", { portName: port, note: Math.min(127, Math.max(0, note)) });
    return;
  }
  if (item.output_target === "powerpoint") {
    const enabled = (await getSetting("powerpoint_enabled")) !== "0";
    if (!enabled) return;
    const start = ref.ppt?.slideStart ?? 1;
    const slide = start + blockIndex;
    await invoke("powerpoint_go_to_slide", { slide });
  }
}

export function parseExternalRef(raw: string): ExternalRef {
  if (!raw?.trim()) return {};
  try {
    return JSON.parse(raw) as ExternalRef;
  } catch {
    return {};
  }
}

export function stringifyExternalRef(ref: ExternalRef): string {
  return JSON.stringify(ref);
}

export const OUTPUT_LABELS: Record<OutputTarget, string> = {
  native: "Projetor do app",
  presenter_midi: "WorshipTools (MIDI)",
  powerpoint: "PowerPoint",
};
