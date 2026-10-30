import type { ServiceItem } from "./db";

export type Section = { label: string; text: string };

const LABEL_LINE = /^\[([^\]\n]+)\]\s*$/;

function labelKey(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

/**
 * Divide letras e textos em seções separadas por linha em branco.
 * A primeira linha de uma seção pode ser um rótulo entre colchetes, como [V1] ou [Refrão].
 */
export function parseSections(text: string): Section[] {
  const sections: Section[] = [];
  for (const raw of text.replace(/\r\n/g, "\n").split(/\n\s*\n/)) {
    const lines = raw.trim().split("\n");
    let label = "";
    const first = lines[0]?.match(LABEL_LINE);
    if (first) {
      label = first[1].trim();
      lines.shift();
    }
    const body = lines.join("\n").trim();
    if (body) sections.push({ label, text: body });
  }
  return sections;
}

/** Blocos (estrofes) na ordem em que aparecem no texto, sem os rótulos. */
export function splitBlocks(text: string): string[] {
  return parseSections(text).map((section) => section.text);
}

/**
 * Blocos de uma música na ordem de canto.
 * `arrangement` lista rótulos (ex.: "V1 R V2 R"), assim o refrão não precisa ser repetido na letra.
 * Rótulos que não existem são ignorados; sem arranjo, vale a ordem do texto.
 */
export function arrangedBlocks(lyrics: string, arrangement: string): string[] {
  const sections = parseSections(lyrics);
  const tokens = arrangement.split(/[\s,;]+/).filter(Boolean);
  if (tokens.length === 0) return sections.map((section) => section.text);

  const ordered: string[] = [];
  for (const token of tokens) {
    const key = labelKey(token);
    const byLabel = sections.find((section) => section.label && labelKey(section.label) === key);
    const byNumber = /^\d+$/.test(token) ? sections[Number(token) - 1] : undefined;
    const found = byLabel ?? byNumber;
    if (found) ordered.push(found.text);
  }
  return ordered.length ? ordered : sections.map((section) => section.text);
}

/** Telas de um item na execução. Itens sem conteúdo mostram o título. */
export function itemBlocks(item: ServiceItem): string[] {
  switch (item.type) {
    case "song": {
      const blocks = arrangedBlocks(item.song_lyrics ?? "", item.song_arrangement ?? "");
      return blocks.length ? blocks : [item.song_title ?? item.title];
    }
    case "text": {
      const blocks = splitBlocks(item.content);
      return blocks.length ? blocks : [item.title];
    }
    case "image":
      return [item.content];
    case "blank":
      return [""];
    case "section":
      return [];
  }
}
