export type Candidate = {
  itemIndex: number;
  title: string;
  blocks: string[];
};

export type Match = {
  itemIndex: number;
  blockIndex: number;
  score: number;
  byTitle: boolean;
};

/** Transcrições com menos palavras que isso não são comparadas com blocos. */
const MIN_WORDS = 3;

/** Bônus de pontuação para a estrofe seguinte à que está na tela. */
const NEXT_BLOCK_BONUS = 0.03;

const STOPWORDS = new Set([
  "a", "o", "as", "os", "e", "de", "da", "do", "das", "dos", "em", "no", "na", "nos", "nas",
  "um", "uma", "uns", "umas", "que", "para", "pra", "por", "com", "se", "ao", "aos",
]);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/-/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((word) => word && !STOPWORDS.has(word));
}

/** Distância de edição (Levenshtein) entre duas palavras curtas. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length];
}

/**
 * Tolera variações do Whisper: "cantar"/"cantarei", "corre"/"correm", "agua"/"aguas"
 * e erros de uma ou duas letras em palavras longas ("trancoilas"/"tranquilas").
 */
function sameWord(a: string, b: string): boolean {
  a = a.replace(/s$/, "");
  b = b.replace(/s$/, "");
  if (a === b) return true;
  if (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5)) return true;
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 2) return false;
  const allowed = Math.min(a.length, b.length) >= 8 ? 2 : 1;
  return editDistance(a, b) <= allowed;
}

/** Proporção das palavras de `source` que aparecem em `target`. */
function coverage(source: string[], target: string[]): number {
  if (source.length === 0) return 0;
  return source.filter((word) => target.some((other) => sameWord(word, other))).length / source.length;
}

/**
 * Encontra o item e o bloco mais parecidos com a transcrição.
 * Em empate, prefere o bloco seguinte ao atual (útil para refrões repetidos).
 */
export function findMatch(
  transcript: string,
  candidates: Candidate[],
  current: Position | null,
): Match | null {
  const spoken = words(transcript);
  let best: Match | null = null;

  function consider(match: Match) {
    if (match.score > 0 && (!best || match.score > best.score)) best = match;
  }

  for (const candidate of candidates) {
    const isCurrent = candidate.itemIndex === current?.itemIndex;

    if (spoken.length >= MIN_WORDS) {
      const order = candidate.blocks.map((_, index) => index);
      if (isCurrent && current) {
        order.push(...order.splice(0, current.blockIndex + 1));
      }
      for (const blockIndex of order) {
        // A letra costuma seguir em ordem: pequeno bônus para o bloco logo após o atual.
        const isNext = isCurrent && current && blockIndex === current.blockIndex + 1;
        const raw = coverage(spoken, words(candidate.blocks[blockIndex]));
        consider({
          itemIndex: candidate.itemIndex,
          blockIndex,
          score: raw > 0 && isNext ? Math.min(1, raw + NEXT_BLOCK_BONUS) : raw,
          byTitle: false,
        });
      }
    }

    const titleWords = words(candidate.title);
    if (!isCurrent && titleWords.length >= 2) {
      consider({
        itemIndex: candidate.itemIndex,
        blockIndex: 0,
        score: coverage(titleWords, spoken),
        byTitle: true,
      });
    }
  }

  return best;
}

/**
 * Junta a transcrição nova ao texto anterior sem repetir o trecho sobreposto
 * (os blocos de áudio têm overlap, então o fim de um é o começo do próximo).
 */
export function mergeTranscripts(previous: string, next: string): string {
  const before = normalize(previous).split(" ").filter(Boolean);
  const after = normalize(next).split(" ").filter(Boolean);
  if (before.length === 0) return after.join(" ");
  const max = Math.min(before.length, after.length, 12);
  for (let size = max; size >= 1; size--) {
    const tail = before.slice(before.length - size);
    const head = after.slice(0, size);
    if (tail.every((word, index) => sameWord(word, head[index]))) {
      return [...before, ...after.slice(size)].join(" ");
    }
  }
  return [...before, ...after].join(" ");
}

/** Texto de janela deslizante: as últimas `keep` transcrições (sem repetição) mais a nova. */
export function slidingText(history: string[], next: string, keep = 2): string {
  const merged = history.slice(-keep).reduce((acc, line) => mergeTranscripts(acc, line), "");
  return mergeTranscripts(merged, next);
}

export type VoiceCommand = "next" | "previous" | "hide" | "show";

const VOICE_COMMANDS: Record<string, VoiceCommand> = {
  "proximo slide": "next",
  "avancar slide": "next",
  "slide seguinte": "next",
  "slide anterior": "previous",
  "voltar slide": "previous",
  "esconder tela": "hide",
  "limpar tela": "hide",
  "mostrar tela": "show",
};

/** Comando de voz só vale se a transcrição inteira for o comando (evita "próximo domingo"). */
export function parseVoiceCommand(transcript: string): VoiceCommand | null {
  return VOICE_COMMANDS[normalize(transcript)] ?? null;
}

export type Position = { itemIndex: number; blockIndex: number };

export type Ignored = Position & { time: number };

/** Tempo em que uma sugestão ignorada não volta a aparecer. */
export const IGNORE_MS = 20_000;

/** Decide se o match vira sugestão para o operador. */
export function shouldSuggest(
  match: Match | null,
  threshold: number,
  current: Position | null,
  ignored: Ignored[],
  now: number,
): match is Match {
  if (!match || match.score < threshold) return false;
  const same = (p: Position) => p.itemIndex === match.itemIndex && p.blockIndex === match.blockIndex;
  if (current && same(current)) return false;
  return !ignored.some((entry) => same(entry) && now - entry.time < IGNORE_MS);
}

/** Auto-MOSTRAR em músicas: anúncio por título ou avanço de estrofe no mesmo item. */
export function canAutoAdvanceSong(
  match: Match,
  itemType: string,
  current: Position | null,
  followVerse: boolean,
): boolean {
  if (itemType !== "song") return false;
  if (match.byTitle) return true;
  if (!current || current.itemIndex !== match.itemIndex) return false;
  if (followVerse && match.blockIndex > current.blockIndex) return true;
  return match.blockIndex === current.blockIndex;
}
