import { invoke } from "@tauri-apps/api/core";
import { Backup, exportAll, importAll, listLog } from "./db";

export const readTextFile = (path: string) => invoke<string>("read_text_file", { path });
export const writeTextFile = (path: string, content: string) =>
  invoke<void>("write_text_file", { path, content });
export const dataFile = (name: string) => invoke<string>("data_path", { name });

function stamp(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  return { day, time: `${day}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}` };
}

/** Salva músicas, cultos e configurações em um JSON na pasta de dados do app. Devolve o caminho. */
export async function saveBackup(kind: "manual" | "auto"): Promise<string> {
  const { day, time } = stamp();
  const path = await dataFile(kind === "auto" ? `backups/auto-${day}.json` : `backups/backup-${time}.json`);
  await writeTextFile(path, JSON.stringify(await exportAll(), null, 2));
  return path;
}

/** Restaura um backup (substitui músicas, cultos e itens). Faz antes um backup de segurança. */
export async function restoreBackup(path: string): Promise<string> {
  const backup = JSON.parse(await readTextFile(path)) as Backup;
  if (backup?.version !== 1) throw new Error("Arquivo de backup inválido.");
  const safety = await saveBackup("manual");
  await importAll(backup);
  return safety;
}

/** Exporta o registro de um culto (uma linha JSON por evento). Devolve o caminho. */
export async function exportServiceLog(serviceId: number): Promise<string> {
  const rows = await listLog(serviceId);
  const path = await dataFile(`logs/culto-${serviceId}-${stamp().time}.jsonl`);
  const lines = rows.map((row) => JSON.stringify({ at: row.at, kind: row.kind, data: JSON.parse(row.data || "null") }));
  await writeTextFile(path, lines.join("\n") + "\n");
  return path;
}
