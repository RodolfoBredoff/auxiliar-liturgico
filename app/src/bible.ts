// Referências bíblicas em português: reconhece "Romanos 8:28", "Salmo 23 versículo 1 ao 3",
// "primeira Coríntios 13 4" e números por extenso. Sem IA: só regras e tabelas.

export type Reference = { book: number; chapter: number; from: number; to: number };

export const BOOK_NAMES = [
  "Gênesis", "Êxodo", "Levítico", "Números", "Deuteronômio", "Josué", "Juízes", "Rute",
  "1 Samuel", "2 Samuel", "1 Reis", "2 Reis", "1 Crônicas", "2 Crônicas", "Esdras", "Neemias",
  "Ester", "Jó", "Salmos", "Provérbios", "Eclesiastes", "Cantares", "Isaías", "Jeremias",
  "Lamentações", "Ezequiel", "Daniel", "Oseias", "Joel", "Amós", "Obadias", "Jonas",
  "Miqueias", "Naum", "Habacuque", "Sofonias", "Ageu", "Zacarias", "Malaquias", "Mateus",
  "Marcos", "Lucas", "João", "Atos", "Romanos", "1 Coríntios", "2 Coríntios", "Gálatas",
  "Efésios", "Filipenses", "Colossenses", "1 Tessalonicenses", "2 Tessalonicenses",
  "1 Timóteo", "2 Timóteo", "Tito", "Filemom", "Hebreus", "Tiago", "1 Pedro", "2 Pedro",
  "1 João", "2 João", "3 João", "Judas", "Apocalipse",
];

/** Livros sem numeral (nomes completos, sem acento). */
const SINGLE: Record<string, number> = {
  genesis: 1, exodo: 2, levitico: 3, numeros: 4, deuteronomio: 5, josue: 6, juizes: 7, rute: 8,
  esdras: 15, neemias: 16, ester: 17, job: 18, jo: 18, salmos: 19, salmo: 19, proverbios: 20,
  eclesiastes: 21, cantares: 22, canticos: 22, isaias: 23, jeremias: 24, lamentacoes: 25,
  ezequiel: 26, daniel: 27, oseias: 28, joel: 29, amos: 30, obadias: 31, jonas: 32,
  miqueias: 33, naum: 34, habacuque: 35, sofonias: 36, ageu: 37, zacarias: 38, malaquias: 39,
  mateus: 40, marcos: 41, lucas: 42, atos: 44, romanos: 45, galatas: 48, efesios: 49,
  filipenses: 50, colossenses: 51, tito: 56, filemom: 57, hebreus: 58, tiago: 59, judas: 65,
  apocalipse: 66,
};

/** Livros com numeral: índices para 1, 2 (e 3). `none` vale quando falta o numeral. */
const ORDINAL: Record<string, { list: number[]; none?: number }> = {
  samuel: { list: [9, 10] },
  reis: { list: [11, 12] },
  cronicas: { list: [13, 14] },
  corintios: { list: [46, 47] },
  tessalonicenses: { list: [52, 53] },
  timoteo: { list: [54, 55] },
  pedro: { list: [60, 61] },
  joao: { list: [62, 63, 64], none: 43 },
};

/** Abreviações aceitas só na busca digitada (na fala soltas gerariam falsos positivos). */
const ABBR_SINGLE: Record<string, number> = {
  gn: 1, ex: 2, lv: 3, nm: 4, dt: 5, js: 6, jz: 7, rt: 8, ed: 15, ne: 16, et: 17, sl: 19, pv: 20,
  ec: 21, ct: 22, is: 23, jr: 24, lm: 25, ez: 26, dn: 27, os: 28, jl: 29, am: 30, ob: 31, jn: 32,
  mq: 33, na: 34, hc: 35, sf: 36, ag: 37, zc: 38, ml: 39, mt: 40, mc: 41, lc: 42, at: 44, rm: 45,
  gl: 48, ef: 49, fp: 50, cl: 51, tt: 56, fm: 57, hb: 58, tg: 59, jd: 65, ap: 66,
};
const ABBR_ORDINAL: Record<string, string> = {
  sm: "samuel", rs: "reis", cr: "cronicas", co: "corintios", ts: "tessalonicenses",
  tm: "timoteo", pe: "pedro", jo: "joao",
};

const ORDINAL_WORDS: Record<string, number> = {
  "1": 1, primeiro: 1, primeira: 1, "2": 2, segundo: 2, segunda: 2, "3": 3, terceiro: 3, terceira: 3,
};
const FILLERS = new Set(["carta", "epistola", "aos", "ao", "de", "do", "dos", "livro", "a", "as", "o"]);
const CHAPTER_WORDS = new Set(["capitulo", "cap", "c"]);
const VERSE_WORDS = new Set(["versiculo", "versiculos", "verso", "versos", "vers", "v"]);
const RANGE_WORDS = new Set(["ate", "a", "ao"]);

const UNITS: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7,
  oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14,
  quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
};
const TENS: Record<string, number> = {
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
};
const HUNDREDS: Record<string, number> = {
  cem: 100, cento: 100, duzentos: 200, trezentos: 300, quatrocentos: 400, quinhentos: 500,
};

function isNumberWord(token: string): boolean {
  return token in UNITS || token in TENS || token in HUNDREDS;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/(\d)\s*[-–—]\s*(\d)/g, "$1 ate $2")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .split(/\s+/)
    .filter(Boolean);
}

/** Troca sequências como "vinte e oito" por "28". */
export function numberWordsToDigits(tokens: string[]): string[] {
  const valueOf = (token: string) => UNITS[token] ?? TENS[token] ?? HUNDREDS[token];
  const kindOf = (token: string) => (token in HUNDREDS ? 2 : token in TENS ? 1 : 0);

  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    if (!isNumberWord(tokens[i])) {
      out.push(tokens[i++]);
      continue;
    }
    // "oito vinte e oito" são dois números (8 e 28): só se soma com "e" e em ordem decrescente.
    let total = valueOf(tokens[i]);
    let kind = kindOf(tokens[i]);
    i++;
    while (tokens[i] === "e" && i + 1 < tokens.length && isNumberWord(tokens[i + 1])) {
      const next = tokens[i + 1];
      const nextKind = kindOf(next);
      const allowed =
        (kind === 2 && nextKind <= 1) || (kind === 1 && nextKind === 0 && valueOf(next) < 10);
      if (!allowed) break;
      total += valueOf(next);
      kind = nextKind;
      i += 2;
    }
    out.push(String(total));
  }
  return out;
}

type BookHit = { book: number; end: number };

/** Livro cujo nome está em tokens[i], olhando para trás atrás do numeral (1, 2, 3, primeiro...). */
function bookAt(tokens: string[], i: number, allowAbbr: boolean): BookHit | null {
  const token = tokens[i];
  const fullKey = ORDINAL[token] ? token : undefined;
  const abbrKey = allowAbbr ? ABBR_ORDINAL[token] : undefined;
  const key = fullKey ?? abbrKey;

  if (key) {
    const def = ORDINAL[key];
    let j = i - 1;
    let skipped = 0;
    while (j >= 0 && skipped < 3 && FILLERS.has(tokens[j])) {
      j--;
      skipped++;
    }
    const ordinal = j >= 0 ? ORDINAL_WORDS[tokens[j]] : undefined;
    if (ordinal && def.list[ordinal - 1]) return { book: def.list[ordinal - 1], end: i };
    if (fullKey) return def.none ? { book: def.none, end: i } : null;
    // abreviação sem numeral ("jo"): cai para as abreviações simples abaixo
  }
  if (SINGLE[token]) return { book: SINGLE[token], end: i };
  if (allowAbbr && ABBR_SINGLE[token]) return { book: ABBR_SINGLE[token], end: i };
  return null;
}

function readNumber(tokens: string[], i: number): number | null {
  const token = tokens[i];
  return token !== undefined && /^\d{1,3}$/.test(token) ? Number(token) : null;
}

/**
 * Procura a primeira referência completa (livro, capítulo e versículo) no texto.
 * `allowAbbreviations` liga abreviações como "Rm" e "1Co" (use só em busca digitada).
 */
export function parseReference(text: string, allowAbbreviations = false): Reference | null {
  const tokens = numberWordsToDigits(tokenize(text));
  for (let i = 0; i < tokens.length; i++) {
    const hit = bookAt(tokens, i, allowAbbreviations);
    if (!hit) continue;

    let p = hit.end + 1;
    if (CHAPTER_WORDS.has(tokens[p])) p++;
    const chapter = readNumber(tokens, p);
    if (chapter === null || chapter < 1 || chapter > 150) continue;
    p++;
    if (VERSE_WORDS.has(tokens[p])) p++;
    const from = readNumber(tokens, p);
    if (from === null || from < 1 || from > 176) continue;
    p++;

    let to = from;
    if (RANGE_WORDS.has(tokens[p])) {
      let q = p + 1;
      if (tokens[q] === "o") q++;
      const end = readNumber(tokens, q);
      if (end !== null && end >= from && end <= 176) to = end;
    }
    return { book: hit.book, chapter, from, to };
  }
  return null;
}

/** Nome de livro (completo, abreviado ou com numeral) → número do livro (1 a 66). */
export function lookupBook(name: string): number | null {
  const tokens = tokenize(name);
  for (let i = 0; i < tokens.length; i++) {
    const hit = bookAt(tokens, i, true);
    if (hit) return hit.book;
  }
  return null;
}

export function formatReference(ref: Reference): string {
  const verses = ref.to > ref.from ? `${ref.from}-${ref.to}` : `${ref.from}`;
  return `${BOOK_NAMES[ref.book - 1]} ${ref.chapter}:${verses}`;
}

export type ParsedVerse = { book: number; chapter: number; verse: number; text: string };

/** Formato JSON comum: lista de 66 livros, cada um com `chapters` (lista de capítulos com lista de versículos). */
export function parseBibleJson(data: unknown): ParsedVerse[] {
  if (!Array.isArray(data) || data.length !== 66) {
    throw new Error("JSON da Bíblia deve ter 66 livros.");
  }
  const rows: ParsedVerse[] = [];
  data.forEach((book, bookIndex) => {
    const chapters = (book as { chapters?: unknown }).chapters;
    if (!Array.isArray(chapters)) throw new Error(`Livro ${bookIndex + 1} sem capítulos.`);
    chapters.forEach((verses, chapterIndex) => {
      if (!Array.isArray(verses)) throw new Error(`Capítulo inválido em ${BOOK_NAMES[bookIndex]}.`);
      verses.forEach((text, verseIndex) => {
        rows.push({
          book: bookIndex + 1,
          chapter: chapterIndex + 1,
          verse: verseIndex + 1,
          text: String(text).replace(/\{[^}]*\}/g, "").trim(),
        });
      });
    });
  });
  return rows;
}

/** Texto simples: uma linha por versículo, "Gênesis 1:1 No princípio...". */
export function parseBibleText(text: string): ParsedVerse[] {
  const rows: ParsedVerse[] = [];
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    const match = line.match(/^\s*(.+?)\s+(\d+):(\d+)\s+(.+?)\s*$/);
    if (!match) continue;
    const book = lookupBook(match[1]);
    if (book) rows.push({ book, chapter: Number(match[2]), verse: Number(match[3]), text: match[4] });
  }
  return rows;
}

export function parseBible(content: string): ParsedVerse[] {
  const trimmed = content.replace(/^\uFEFF/, "").trim();
  const rows = trimmed.startsWith("[") ? parseBibleJson(JSON.parse(trimmed)) : parseBibleText(trimmed);
  if (rows.length < 1000) throw new Error("Poucos versículos encontrados. Confira o formato do arquivo.");
  return rows;
}
