// Teste ponta a ponta: blocos transcritos de áudio (python/listen.py --file) → matching → sugestão.
// Gerar blocos: .venv/bin/python python/listen.py --file test_audio/x.aiff > test_audio/x.jsonl
// Uso: node scripts/pipeline_check.ts [limite] [passivo]
// Operador ativo aceita sugestões certas; passivo nunca clica em MOSTRAR (a posição não muda).
import { readFileSync } from "node:fs";
import { findMatch, shouldSuggest, type Candidate, type Position } from "../src/matching.ts";
import { splitBlocks } from "../src/blocks.ts";

const threshold = Number(process.argv[2] ?? 0.6);
const passive = process.argv[3] === "passivo";
const matchWindow = 3;

type Item = { type: string; title: string; text?: string };

// Culto de referência (docs/MVP.md). Índices como na execução.
const items: Item[] = [
  { type: "section", title: "Ciclo 1" },
  { type: "text", title: "Abertura com leitura bíblica", text: "Mas os que esperam no Senhor renovarão as suas forças, subirão com asas como águias; correrão e não se cansarão; caminharão e não se fatigarão." },
  { type: "blank", title: "Oração espontânea" },
  { type: "text", title: "Leitura de salmo", text: `O Senhor é o meu pastor, nada me faltará.

Deitar-me faz em verdes pastos, guia-me mansamente a águas tranquilas.

Refrigera a minha alma; guia-me pelas veredas da justiça, por amor do seu nome.

Ainda que eu andasse pelo vale da sombra da morte, não temeria mal algum, porque tu estás comigo; a tua vara e o teu cajado me consolam.

Preparas uma mesa perante mim na presença dos meus inimigos, unges a minha cabeça com óleo, o meu cálice transborda.

Certamente que a bondade e a misericórdia me seguirão todos os dias da minha vida; e habitarei na casa do Senhor por longos dias.` },
  { type: "song", title: "Cantarei Teu Amor", text: `Dos montes correm para o mar
Teu rio de amor por mim
Eu abrirei meu coração
Deixando a tua cura entrar

Minha alegria é te pertencer
Levantarei as minhas mãos
Teu amor me alcança e me faz louvar-te

Cantarei teu amor pra sempre
Cantarei teu amor pra sempre` },
  { type: "song", title: "Santo Espírito", text: `Santo Espírito, vem encher este lugar
Tua presença é o que eu quero

Vem sobre nós, derrama o teu poder` },
  { type: "song", title: "Tu És Fiel", text: `Tu és fiel, Senhor, em todo tempo
Tua graça me sustenta a cada dia

Eu te louvarei, eu te adorarei
Pra sempre a ti eu cantarei` },
  { type: "text", title: "Oração comunitária", text: "Pai nosso, que estás nos céus, santificado seja o teu nome. Venha o teu reino, seja feita a tua vontade, assim na terra como no céu.\n\nO pão nosso de cada dia nos dá hoje. Perdoa as nossas dívidas, assim como nós perdoamos aos nossos devedores." },
  { type: "section", title: "Ciclo 2" },
  { type: "text", title: "Visitantes e arte" },
  { type: "text", title: "Convite às crianças" },
  { type: "blank", title: "Sermão principal" },
  { type: "section", title: "Ciclo 3 — Ceia" },
  { type: "text", title: "Comunhão" },
  { type: "text", title: "Texto da ceia", text: `Porque eu recebi do Senhor o que também vos ensinei: que o Senhor Jesus, na noite em que foi traído, tomou o pão; e, tendo dado graças, o partiu e disse: Tomai, comei; isto é o meu corpo que é partido por vós; fazei isto em memória de mim.

Semelhantemente também, depois de cear, tomou o cálice, dizendo: Este cálice é o novo testamento no meu sangue; fazei isto, todas as vezes que beberdes, em memória de mim.` },
  { type: "section", title: "Ciclo 4 — Envio e resposta" },
  { type: "song", title: "Tudo o Que Tenho", text: "Tudo o que tenho vem de ti, Senhor\nEu te entrego a minha vida" },
  { type: "text", title: "Avisos" },
  { type: "blank", title: "Envio: oração final e encerramento" },
];

function buildCandidates(from: number): Candidate[] {
  const toCandidate = (index: number): Candidate => ({
    itemIndex: index,
    title: items[index].title,
    blocks: splitBlocks(items[index].text ?? ""),
  });
  const withText = (index: number) => !!items[index]?.text?.trim();
  const upcoming = items.map((_, index) => index).filter((index) => index > from && withText(index));
  return [...(withText(from) ? [from] : []), ...upcoming.slice(0, matchWindow)].map(toCandidate);
}

// Rótulos por bloco (início em segundos): "item:bloco" aceitos; "-" = não deve sugerir.
type Scenario = { name: string; file: string; start: Position; labels: Record<number, string[]>; real?: boolean };

const scenarios: Scenario[] = [
  {
    name: "voz real: salmo + música cantada",
    file: "voz_real.jsonl",
    real: true,
    start: { itemIndex: 2, blockIndex: 0 },
    labels: {
      0: ["3:0", "3:1"], 5: ["-"], 10: ["4:0"], 15: ["4:0"], 20: ["4:0"], 25: ["4:0", "4:1"], 30: ["4:1"],
      35: ["4:1", "4:0"], 40: ["4:0"], 45: ["4:0", "4:1"], 50: ["4:1"], 55: ["4:1"], 60: ["4:2"], 65: ["4:2"],
    },
  },
  { name: "salmo sintético", file: "salmo_sintetico.jsonl", start: { itemIndex: 2, blockIndex: 0 }, labels: { 0: ["3:0", "3:1"], 5: ["3:1", "3:2"] } },
  { name: "anúncio sintético", file: "anuncio_sintetico.jsonl", start: { itemIndex: 3, blockIndex: 5 }, labels: { 0: ["4:0"] } },
  {
    name: "letras faladas: Música 2 e 3 (após refrão da Música 1)",
    file: "letras_sintetico.jsonl",
    start: { itemIndex: 4, blockIndex: 2 },
    labels: { 0: ["5:0"], 5: ["5:1", "6:0"], 10: ["6:0", "6:1"], 15: ["6:1"] },
  },
  { name: "oração espontânea sintética", file: "oracao_sintetica.jsonl", start: { itemIndex: 2, blockIndex: 0 }, labels: {} },
  { name: "sermão sintético", file: "sermao_sintetico.jsonl", start: { itemIndex: 11, blockIndex: 0 }, labels: {} },
  { name: "avisos sintéticos (antes da ceia)", file: "avisos_sintetico.jsonl", start: { itemIndex: 11, blockIndex: 0 }, labels: {} },
  {
    name: "ceia sintética",
    file: "ceia_sintetica.jsonl",
    start: { itemIndex: 11, blockIndex: 0 },
    labels: { 0: ["14:0"], 5: ["14:0"], 10: ["14:0"], 15: ["14:0", "14:1"], 20: ["14:1"], 25: ["14:1"], 30: ["14:1", "-"] },
  },
];

const totals = { real: { acerto: 0, erro: 0, perdido: 0, ok: 0 }, sintetico: { acerto: 0, erro: 0, perdido: 0, ok: 0 } };

for (const scenario of scenarios) {
  console.log(`\n== ${scenario.name} (limite ${threshold}${passive ? ", operador passivo" : ""})`);
  const lines = readFileSync(new URL(`../../test_audio/${scenario.file}`, import.meta.url), "utf8").trim().split("\n");
  let position = scenario.start;

  for (const line of lines) {
    const { text, start } = JSON.parse(line) as { text: string; start: number };
    const accepted = scenario.labels[start] ?? ["-"];
    const match = findMatch(text, buildCandidates(position.itemIndex), position);
    const suggested = shouldSuggest(match, threshold, position, [], 0);
    const key = (p: Position) => `${p.itemIndex}:${p.blockIndex}`;

    let verdict: "acerto" | "erro" | "perdido" | "ok";
    if (suggested) {
      verdict = accepted.includes(key(match)) ? "acerto" : "erro";
      if (verdict === "acerto" && !passive) position = match;
    } else {
      verdict = accepted.includes("-") || accepted.includes(key(position)) ? "ok" : "perdido";
    }
    totals[scenario.real ? "real" : "sintetico"][verdict]++;

    const best = match ? `${key(match)}${match.byTitle ? " título" : ""} ${(match.score * 100).toFixed(0)}%` : "nenhum";
    console.log(`${String(start).padStart(3)}s ${verdict.toUpperCase().padEnd(7)} ${best.padEnd(16)} esperado ${accepted.join("|").padEnd(9)} ${text}`);
  }
}

console.log("\nTotais (ok = certo em não sugerir ou já exibido)");
console.log("voz real:  ", totals.real);
console.log("sintéticos:", totals.sintetico);
