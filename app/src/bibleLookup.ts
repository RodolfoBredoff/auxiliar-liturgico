import { formatReference, Reference } from "./bible";
import { getVerses, listBibleVersions } from "./db";

export type BibleHit = { key: string; label: string; text: string };

/** Versículos de uma referência, prontos para a tela. Faixas longas são cortadas em 6 versículos. */
export async function lookupBible(ref: Reference, version: string): Promise<BibleHit | null> {
  const to = Math.min(ref.to, ref.from + 5);
  const rows = await getVerses(version, ref.book, ref.chapter, ref.from, to);
  if (rows.length === 0) return null;
  const label = `${formatReference({ ...ref, to: rows[rows.length - 1].verse })} (${version})`;
  const body = rows.length === 1 ? rows[0].text : rows.map((row) => `${row.verse} ${row.text}`).join("\n");
  return {
    key: `${version}:${ref.book}:${ref.chapter}:${ref.from}-${ref.to}`,
    label,
    text: `${body}\n\n${label}`,
  };
}

/** Versão escolhida nas configurações, ou a primeira importada. Vazio se não houver Bíblia. */
export async function resolveBibleVersion(preferred: string): Promise<string> {
  const versions = await listBibleVersions();
  if (versions.includes(preferred)) return preferred;
  return versions[0] ?? "";
}
