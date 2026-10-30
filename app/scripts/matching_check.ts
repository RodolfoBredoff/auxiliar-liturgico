// Confere o matching com transcrições reais das etapas 1 e 2.
// Uso: node scripts/matching_check.ts
import { findMatch, IGNORE_MS, shouldSuggest, type Candidate, type Match } from "../src/matching.ts";

const salmo: Candidate = {
  itemIndex: 3,
  title: "Leitura de salmo",
  blocks: [
    "O Senhor é o meu pastor, nada me faltará.",
    "Deitar-me faz em verdes pastos, guia-me mansamente a águas tranquilas.",
    "Refrigera a minha alma; guia-me pelas veredas da justiça, por amor do seu nome.",
  ],
};
const musica1: Candidate = {
  itemIndex: 4,
  title: "Cantarei Teu Amor",
  blocks: [
    "Dos montes correm para o mar\nTeu rio de amor por mim\nEu abrirei meu coração\nDeixando a tua cura entrar",
    "Minha alegria é te pertencer\nLevantarei as minhas mãos\nTeu amor me alcança e me faz louvar-te",
    "Cantarei teu amor pra sempre\nCantarei teu amor pra sempre",
  ],
};
const musica2: Candidate = {
  itemIndex: 5,
  title: "Santo Espírito",
  blocks: [
    "Santo Espírito, vem encher este lugar\nTua presença é o que eu quero",
    "Vem sobre nós, derrama o teu poder",
  ],
};
const candidates = [salmo, musica1, musica2];
const current = { itemIndex: 3, blockIndex: 0 };

const cases = [
  ["anúncio", "Agora vamos cantar, teu amor."],
  ["canto estrofe 1", "Dos montes correm para o mar, Teu rio de ir amor por mim, Pra brilhei meu coração, Deixando a tua cor entrar"],
  ["canto estrofe 2", "Minha alegria por te pertencer, Levantarei as minhas mãos, Teu amor me alcança e me faz louvarte."],
  ["canto refrão", "Cantarei teu amor pra sempre, Cantarei teu amor pra sempre."],
  ["salmo bloco 2", "e ver despastos, guia-me mansamente a água as trancoilas, refrigera..."],
  ["salmo curto", "A minha alma."],
  ["sermão", "irmãos hoje vamos falar sobre a graça de Deus na nossa vida"],
  ["anúncio salmo (outro item atual)", "vamos fazer a leitura do salmo"],
];

for (const [name, text] of cases) {
  const m = findMatch(text, candidates, name.includes("outro") ? { itemIndex: 1, blockIndex: 0 } : current);
  const label = m
    ? `item ${m.itemIndex} ${m.byTitle ? "título" : "bloco " + (m.blockIndex + 1)} ${(m.score * 100).toFixed(0)}%`
    : "sem correspondência";
  console.log(`${name.padEnd(34)} → ${label}`);
}

console.log("\nshouldSuggest");
const strophe2: Match = { itemIndex: 4, blockIndex: 1, score: 0.9, byTitle: false };
const now = 1_000_000;
const suggestCases: [string, boolean, boolean][] = [
  ["acima do limite", shouldSuggest(strophe2, 0.6, current, [], now), true],
  ["abaixo do limite", shouldSuggest({ ...strophe2, score: 0.5 }, 0.6, current, [], now), false],
  ["sem match", shouldSuggest(null, 0.6, current, [], now), false],
  ["já exibido", shouldSuggest(strophe2, 0.6, { itemIndex: 4, blockIndex: 1 }, [], now), false],
  ["outro bloco do item exibido", shouldSuggest(strophe2, 0.6, { itemIndex: 4, blockIndex: 0 }, [], now), true],
  ["ignorado há 5 s", shouldSuggest(strophe2, 0.6, current, [{ itemIndex: 4, blockIndex: 1, time: now - 5000 }], now), false],
  ["ignorado há 25 s", shouldSuggest(strophe2, 0.6, current, [{ itemIndex: 4, blockIndex: 1, time: now - IGNORE_MS - 5000 }], now), true],
  ["ignorado outro bloco", shouldSuggest(strophe2, 0.6, current, [{ itemIndex: 4, blockIndex: 2, time: now }], now), true],
];
let failures = 0;
for (const [name, got, expected] of suggestCases) {
  if (got !== expected) failures++;
  console.log(`${got === expected ? "ok  " : "FALHA"} ${name.padEnd(30)} → ${got}`);
}
if (failures) process.exit(1);
