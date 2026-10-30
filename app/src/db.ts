import Database from "@tauri-apps/plugin-sql";

let db: Promise<Database> | null = null;

function getDb() {
  if (!db) db = Database.load("sqlite:auxiliar.db");
  return db;
}

export type Song = {
  id: number;
  title: string;
  lyrics: string;
  reference_audio_path: string;
  timeline_json: string;
  arrangement: string;
};

export type OutputTarget = "native" | "presenter_midi" | "powerpoint";

export type ExternalRef = {
  plannedDurationSec?: number;
  musicKey?: string;
  scriptureRef?: string;
  ppt?: { deckPath?: string; slideStart?: number };
  presenter?: { midiNote?: number };
};

export async function listSongs(): Promise<Song[]> {
  return (await getDb()).select(
    `SELECT id, title, lyrics, reference_audio_path, timeline_json, arrangement
     FROM songs ORDER BY title COLLATE NOCASE`,
  );
}

export async function createSong(
  title: string,
  lyrics: string,
  arrangement = "",
): Promise<number> {
  const result = await (await getDb()).execute(
    "INSERT INTO songs (title, lyrics, arrangement) VALUES ($1, $2, $3)",
    [title, lyrics, arrangement],
  );
  return result.lastInsertId as number;
}

export async function updateSong(
  id: number,
  title: string,
  lyrics: string,
  referenceAudioPath: string,
  timelineJson: string,
  arrangement: string,
) {
  await (await getDb()).execute(
    `UPDATE songs SET title = $1, lyrics = $2, reference_audio_path = $3,
     timeline_json = $4, arrangement = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6`,
    [title, lyrics, referenceAudioPath, timelineJson, arrangement, id],
  );
}

export async function deleteSong(id: number) {
  await (await getDb()).execute("DELETE FROM songs WHERE id = $1", [id]);
}

export async function getSetting(key: string): Promise<string> {
  const rows: { value: string }[] = await (await getDb()).select(
    "SELECT value FROM settings WHERE key = $1",
    [key],
  );
  return rows[0]?.value ?? "";
}

export async function setSetting(key: string, value: string) {
  await (await getDb()).execute(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

/** Registra um evento do culto (transcrição, sugestão, slide mostrado...). Nunca interrompe a execução. */
export async function logEvent(serviceId: number | null, kind: string, data: unknown) {
  try {
    await (await getDb()).execute(
      "INSERT INTO session_log (service_id, kind, data) VALUES ($1, $2, $3)",
      [serviceId, kind, JSON.stringify(data)],
    );
  } catch {
    // o log é auxiliar; falhar aqui não pode afetar o culto
  }
}

export type LogRow = { id: number; service_id: number | null; at: string; kind: string; data: string };

export async function listLog(serviceId: number): Promise<LogRow[]> {
  return (await getDb()).select(
    "SELECT id, service_id, at, kind, data FROM session_log WHERE service_id = $1 ORDER BY id",
    [serviceId],
  );
}

export type Backup = {
  version: 1;
  exported_at: string;
  songs: Record<string, unknown>[];
  services: Record<string, unknown>[];
  service_items: Record<string, unknown>[];
  settings: { key: string; value: string }[];
};

export async function exportAll(): Promise<Backup> {
  const db = await getDb();
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    songs: await db.select("SELECT * FROM songs ORDER BY id"),
    services: await db.select("SELECT * FROM services ORDER BY id"),
    service_items: await db.select("SELECT * FROM service_items ORDER BY id"),
    settings: await db.select("SELECT key, value FROM settings ORDER BY key"),
  };
}

const TABLE_COLUMNS = {
  songs: ["id", "title", "lyrics", "created_at", "updated_at", "reference_audio_path", "timeline_json", "arrangement"],
  services: ["id", "title", "created_at", "updated_at", "service_date", "venue", "liturgy_notes"],
  service_items: ["id", "service_id", "type", "title", "content", "position", "song_id", "output_target", "external_ref"],
} as const;

/** Substitui músicas, cultos e itens pelo conteúdo do backup. Configurações são mescladas. */
export async function importAll(backup: Backup) {
  if (backup?.version !== 1 || !Array.isArray(backup.songs) || !Array.isArray(backup.services)) {
    throw new Error("Arquivo de backup inválido.");
  }
  const db = await getDb();
  await db.execute("DELETE FROM service_items");
  await db.execute("DELETE FROM services");
  await db.execute("DELETE FROM songs");

  async function insertRows(table: keyof typeof TABLE_COLUMNS, rows: Record<string, unknown>[]) {
    for (const row of rows) {
      // Só colunas conhecidas e presentes no backup (backups antigos podem não ter todas).
      const columns = TABLE_COLUMNS[table].filter((column) => row[column] !== undefined);
      const params = columns.map((column) => row[column]);
      await db.execute(
        `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(", ")})`,
        params,
      );
    }
  }
  await insertRows("songs", backup.songs);
  await insertRows("services", backup.services);
  await insertRows("service_items", backup.service_items ?? []);
  for (const setting of backup.settings ?? []) await setSetting(setting.key, setting.value);
}

export type BibleRow = { book: number; chapter: number; verse: number; text: string };

export async function listBibleVersions(): Promise<string[]> {
  const rows: { version: string }[] = await (await getDb()).select(
    "SELECT DISTINCT version FROM bible_verses ORDER BY version",
  );
  return rows.map((row) => row.version);
}

export async function importBible(version: string, rows: BibleRow[]) {
  const db = await getDb();
  await db.execute("DELETE FROM bible_verses WHERE version = $1", [version]);
  const batch = 400;
  for (let start = 0; start < rows.length; start += batch) {
    const chunk = rows.slice(start, start + batch);
    const values = chunk.map((_, i) => `($1, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4}, $${i * 4 + 5})`);
    const params: unknown[] = [version];
    for (const row of chunk) params.push(row.book, row.chapter, row.verse, row.text);
    await db.execute(
      `INSERT OR REPLACE INTO bible_verses (version, book, chapter, verse, text) VALUES ${values.join(", ")}`,
      params,
    );
  }
}

export async function getVerses(
  version: string,
  book: number,
  chapter: number,
  from: number,
  to: number,
): Promise<BibleRow[]> {
  return (await getDb()).select(
    `SELECT book, chapter, verse, text FROM bible_verses
     WHERE version = $1 AND book = $2 AND chapter = $3 AND verse BETWEEN $4 AND $5
     ORDER BY verse`,
    [version, book, chapter, from, to],
  );
}

export type Service = {
  id: number;
  title: string;
  service_date: string;
  venue: string;
  liturgy_notes: string;
};

export type ItemType = "section" | "text" | "song" | "image" | "blank";

export type ServiceItem = {
  id: number;
  service_id: number;
  type: ItemType;
  title: string;
  content: string;
  position: number;
  song_id: number | null;
  song_title: string | null;
  song_lyrics: string | null;
  song_reference_audio_path: string | null;
  song_timeline_json: string | null;
  song_arrangement: string | null;
  output_target: OutputTarget;
  external_ref: ExternalRef;
};

function rowToItem(row: Record<string, unknown>): ServiceItem {
  let external_ref: ExternalRef = {};
  try {
    external_ref = JSON.parse(String(row.external_ref ?? "{}")) as ExternalRef;
  } catch {
    external_ref = {};
  }
  return {
    id: row.id as number,
    service_id: row.service_id as number,
    type: row.type as ItemType,
    title: row.title as string,
    content: row.content as string,
    position: row.position as number,
    song_id: (row.song_id as number | null) ?? null,
    song_title: (row.song_title as string | null) ?? null,
    song_lyrics: (row.song_lyrics as string | null) ?? null,
    song_reference_audio_path: (row.song_reference_audio_path as string | null) ?? null,
    song_timeline_json: (row.song_timeline_json as string | null) ?? null,
    song_arrangement: (row.song_arrangement as string | null) ?? null,
    output_target: (row.output_target as OutputTarget) || "native",
    external_ref,
  };
}

export async function listServices(): Promise<Service[]> {
  return (await getDb()).select(
    "SELECT id, title, service_date, venue, liturgy_notes FROM services ORDER BY id DESC",
  );
}

export async function createService(title: string): Promise<number> {
  const result = await (await getDb()).execute(
    "INSERT INTO services (title) VALUES ($1)",
    [title],
  );
  return result.lastInsertId as number;
}

export async function updateServiceMeta(
  id: number,
  title: string,
  serviceDate: string,
  venue: string,
  liturgyNotes: string,
) {
  await (await getDb()).execute(
    `UPDATE services SET title = $1, service_date = $2, venue = $3,
     liturgy_notes = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5`,
    [title, serviceDate, venue, liturgyNotes, id],
  );
}

export async function renameService(id: number, title: string) {
  await (await getDb()).execute(
    "UPDATE services SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
    [title, id],
  );
}

export async function deleteService(id: number) {
  const db = await getDb();
  await db.execute("DELETE FROM service_items WHERE service_id = $1", [id]);
  await db.execute("DELETE FROM services WHERE id = $1", [id]);
}

export async function duplicateService(id: number, title: string): Promise<number> {
  const db = await getDb();
  const rows: Service[] = await db.select("SELECT * FROM services WHERE id = $1", [id]);
  const src = rows[0];
  const result = await db.execute(
    `INSERT INTO services (title, service_date, venue, liturgy_notes)
     VALUES ($1, $2, $3, $4)`,
    [title, src?.service_date ?? "", src?.venue ?? "", src?.liturgy_notes ?? ""],
  );
  const newId = result.lastInsertId as number;
  await db.execute(
    `INSERT INTO service_items (service_id, type, title, content, position, song_id, output_target, external_ref)
     SELECT $1, type, title, content, position, song_id, output_target, external_ref
     FROM service_items WHERE service_id = $2`,
    [newId, id],
  );
  return newId;
}

export async function listItems(serviceId: number): Promise<ServiceItem[]> {
  const rows: Record<string, unknown>[] = await (await getDb()).select(
    `SELECT i.id, i.service_id, i.type, i.title, i.content, i.position, i.song_id,
            i.output_target, i.external_ref,
            s.title AS song_title, s.lyrics AS song_lyrics,
            s.reference_audio_path AS song_reference_audio_path,
            s.timeline_json AS song_timeline_json,
            s.arrangement AS song_arrangement
     FROM service_items i
     LEFT JOIN songs s ON s.id = i.song_id
     WHERE i.service_id = $1
     ORDER BY i.position`,
    [serviceId],
  );
  return rows.map(rowToItem);
}

export async function addItem(serviceId: number, type: ItemType, title: string): Promise<number> {
  const result = await (await getDb()).execute(
    `INSERT INTO service_items (service_id, type, title, position)
     VALUES ($1, $2, $3,
       (SELECT COALESCE(MAX(position), 0) + 1 FROM service_items WHERE service_id = $1))`,
    [serviceId, type, title],
  );
  return result.lastInsertId as number;
}

export async function updateItem(
  id: number,
  title: string,
  content: string,
  songId: number | null,
  outputTarget: OutputTarget,
  externalRef: ExternalRef,
) {
  await (await getDb()).execute(
    `UPDATE service_items SET title = $1, content = $2, song_id = $3,
     output_target = $4, external_ref = $5 WHERE id = $6`,
    [title, content, songId, outputTarget, JSON.stringify(externalRef), id],
  );
}

export async function deleteItem(id: number) {
  await (await getDb()).execute("DELETE FROM service_items WHERE id = $1", [id]);
}

export async function swapItems(a: ServiceItem, b: ServiceItem) {
  const db = await getDb();
  await db.execute("UPDATE service_items SET position = $1 WHERE id = $2", [b.position, a.id]);
  await db.execute("UPDATE service_items SET position = $1 WHERE id = $2", [a.position, b.id]);
}
