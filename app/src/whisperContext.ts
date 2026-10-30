export type ContextEntry = { title: string; text: string };

const MAX_PROMPT_CHARS = 400;
const MAX_HOTWORDS = 30;

function uniqueWords(text: string, minLength: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[\s,.;:!?()"“”]+/)) {
    const word = raw.replace(/^[-']+|[-']+$/g, "");
    const key = word.toLowerCase();
    if (word.length >= minLength && !seen.has(key)) {
      seen.add(key);
      out.push(word);
    }
  }
  return out;
}

/**
 * Vocabulário do que vem a seguir no culto, para o Whisper acertar nomes e termos próprios.
 * `prompt` é um texto curto de contexto; `hotwords` são palavras que ele deve favorecer.
 */
export function buildWhisperContext(entries: ContextEntry[]): { prompt: string; hotwords: string } {
  let prompt = "Culto cristão em português.";
  for (const entry of entries) {
    if (entry.title && prompt.length + entry.title.length < MAX_PROMPT_CHARS) {
      prompt += ` ${entry.title.trim()}.`;
    }
  }
  for (const entry of entries) {
    const firstLine = entry.text.split("\n").find((line) => line.trim())?.trim();
    if (firstLine && prompt.length + firstLine.length < MAX_PROMPT_CHARS) {
      prompt += ` ${firstLine}`;
    }
  }

  const words: string[] = [];
  for (const entry of entries) words.push(...uniqueWords(entry.title, 4));
  for (const entry of entries) words.push(...uniqueWords(entry.text, 6));
  const seen = new Set<string>();
  const hotwords = words
    .filter((word) => {
      const key = word.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_HOTWORDS)
    .join(" ");

  return { prompt: prompt.trim(), hotwords };
}
