import { parseSections } from "./blocks.ts";

export type ImportedSong = { title: string; lyrics: string; arrangement: string };

const CHORD = /^[A-G][#b]?(?:maj|min|dim|aug|sus|add|m|M)?\d*(?:\([^)]*\))?(?:\/[A-G][#b]?)?$/;

/** Linha só de cifras ("G  D/F#  Em7"). Uma letra isolada ("A", "E") conta como palavra, não como cifra. */
export function chordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  if (tokens.length === 1 && tokens[0].length < 2) return false;
  return tokens.every((token) => CHORD.test(token));
}

function joinSections(sections: { label: string; text: string }[]): string {
  return sections
    .map((section) => (section.label ? `[${section.label}]\n${section.text}` : section.text))
    .join("\n\n");
}

/**
 * Texto puro: primeira linha vira o título (quando seguida de linha em branco ou quando não há
 * estrofes), linhas de cifra são removidas e, sem linhas em branco, agrupa de 4 em 4 linhas.
 */
export function parsePlainSong(raw: string, fallbackTitle: string, detectTitle = true): ImportedSong {
  const lines = raw
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""));

  const firstIndex = lines.findIndex((line) => line.trim());
  if (firstIndex < 0) return { title: fallbackTitle, lyrics: "", arrangement: "" };

  const hasBlank = lines.slice(firstIndex + 1).some((line, i, rest) => !line.trim() && rest.slice(i + 1).some((l) => l.trim()));
  const nextBlank = lines[firstIndex + 1] !== undefined && !lines[firstIndex + 1].trim();
  const firstIsTitle = detectTitle && (nextBlank || !hasBlank);

  const title = firstIsTitle ? lines[firstIndex].trim() : fallbackTitle;
  const body = lines.slice(firstIsTitle ? firstIndex + 1 : firstIndex).filter((line) => !chordLine(line));

  let sections = parseSections(body.join("\n"));
  if (sections.length === 1 && !sections[0].label) {
    const bodyLines = sections[0].text.split("\n");
    if (bodyLines.length > 4) {
      sections = [];
      for (let i = 0; i < bodyLines.length; i += 4) {
        sections.push({ label: "", text: bodyLines.slice(i, i + 4).join("\n") });
      }
    }
  }
  return { title: title || fallbackTitle, lyrics: joinSections(sections), arrangement: "" };
}

function decodeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function xmlTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? decodeXml(match[1]).trim() : "";
}

/** Arquivo de música do OpenSong (XML com <title>, <lyrics> e <presentation>). */
export function parseOpenSong(xml: string): ImportedSong {
  const title = xmlTag(xml, "title");
  const lyricsRaw = decodeXml((xml.match(/<lyrics[^>]*>([\s\S]*?)<\/lyrics>/i) ?? [])[1] ?? "");
  const presentation = xmlTag(xml, "presentation");

  const sections: { label: string; lines: string[] }[] = [];
  for (const line of lyricsRaw.replace(/\r\n/g, "\n").split("\n")) {
    const marker = line.match(/^\[([^\]]+)\]\s*$/);
    if (marker) {
      sections.push({ label: marker[1].trim(), lines: [] });
      continue;
    }
    if (line.startsWith(".") || line.startsWith(";") || !line.trim() || /^-+$/.test(line.trim())) continue;
    if (sections.length === 0) sections.push({ label: "", lines: [] });
    sections[sections.length - 1].lines.push(line.replace(/^\s/, "").replace(/\|\|/g, "").trimEnd());
  }

  return {
    title,
    lyrics: joinSections(
      sections.filter((s) => s.lines.length).map((s) => ({ label: s.label, text: s.lines.join("\n") })),
    ),
    arrangement: presentation.split(/\s+/).filter(Boolean).join(" "),
  };
}

/** Escolhe o formato pelo conteúdo (XML do OpenSong ou texto puro). */
export function parseSongFile(content: string, fileName: string): ImportedSong {
  const fallback = fileName.replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "") || "Sem título";
  if (/<song[\s>]/i.test(content) && /<lyrics/i.test(content)) {
    const song = parseOpenSong(content);
    return { ...song, title: song.title || fallback };
  }
  return parsePlainSong(content, fallback);
}
