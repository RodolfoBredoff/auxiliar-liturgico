// Testes das regras puras (matching, blocos, Bíblia, importação de músicas).
// Uso: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { arrangedBlocks, parseSections, splitBlocks } from "../src/blocks.ts";
import {
  formatReference,
  lookupBook,
  numberWordsToDigits,
  parseBible,
  parseReference,
} from "../src/bible.ts";
import {
  editDistance,
  findMatch,
  mergeTranscripts,
  parseVoiceCommand,
  shouldSuggest,
  slidingText,
  type Candidate,
} from "../src/matching.ts";
import { chordLine, parseOpenSong, parsePlainSong } from "../src/songImport.ts";
import { buildWhisperContext } from "../src/whisperContext.ts";

const musica: Candidate = {
  itemIndex: 1,
  title: "Cantarei Teu Amor",
  blocks: [
    "Dos montes correm para o mar\nTeu rio de amor por mim\nEu abrirei meu coração\nDeixando a tua cura entrar",
    "Cantarei teu amor pra sempre\nCantarei teu amor pra sempre",
    "Minha alegria é te pertencer\nLevantarei as minhas mãos",
    "Cantarei teu amor pra sempre\nCantarei teu amor pra sempre",
  ],
};

test("editDistance", () => {
  assert.equal(editDistance("tranquilas", "trancoilas"), 2);
  assert.equal(editDistance("abc", "abc"), 0);
  assert.equal(editDistance("", "abc"), 3);
});

test("matching tolera erros de uma letra em palavra longa", () => {
  const salmo: Candidate = { itemIndex: 0, title: "Salmo", blocks: ["guia me mansamente a aguas tranquilas"] };
  const match = findMatch("guia me mansamente a água tranquilhas", [salmo], null);
  assert.ok(match && match.score >= 0.8);
});

test("matching ignora conversa comum", () => {
  const match = findMatch("irmãos hoje vamos falar sobre a graça de Deus", [musica], null);
  assert.ok(!match || match.score < 0.4);
});

test("refrão repetido: prefere a ocorrência seguinte à atual", () => {
  const next = findMatch("Cantarei teu amor pra sempre", [musica], { itemIndex: 1, blockIndex: 1 });
  assert.equal(next?.blockIndex, 3);
  const first = findMatch("Cantarei teu amor pra sempre", [musica], { itemIndex: 1, blockIndex: 0 });
  assert.equal(first?.blockIndex, 1);
});

test("mergeTranscripts remove o trecho sobreposto", () => {
  assert.equal(
    mergeTranscripts("dos montes correm para o mar", "para o mar teu rio de amor"),
    "dos montes correm para o mar teu rio de amor",
  );
  assert.equal(mergeTranscripts("", "Olá, mundo"), "ola mundo");
  assert.equal(mergeTranscripts("um dois", "tres quatro"), "um dois tres quatro");
});

test("slidingText junta as últimas linhas", () => {
  const text = slidingText(["dos montes correm", "montes correm para o mar"], "para o mar teu rio");
  assert.equal(text, "dos montes correm para o mar teu rio");
});

test("janela deslizante acerta verso partido entre dois blocos", () => {
  const history = ["dos montes correm para o"];
  const next = "mar teu rio de amor por mim";
  const alone = findMatch(next, [musica], null);
  const joined = findMatch(slidingText(history, next), [musica], null);
  assert.ok(joined && joined.blockIndex === 0);
  assert.ok(!alone || joined.score >= alone.score);
});

test("comandos de voz só valem para a frase inteira", () => {
  assert.equal(parseVoiceCommand("Próximo slide."), "next");
  assert.equal(parseVoiceCommand("slide anterior"), "previous");
  assert.equal(parseVoiceCommand("no próximo domingo teremos culto"), null);
  assert.equal(parseVoiceCommand("esconder tela"), "hide");
});

test("shouldSuggest respeita limiar e item atual", () => {
  const match = { itemIndex: 1, blockIndex: 2, score: 0.8, byTitle: false };
  assert.equal(shouldSuggest(match, 0.6, null, [], 0), true);
  assert.equal(shouldSuggest(match, 0.9, null, [], 0), false);
  assert.equal(shouldSuggest(match, 0.6, { itemIndex: 1, blockIndex: 2 }, [], 0), false);
});

test("seções com rótulo e arranjo", () => {
  const lyrics = "[V1]\nLinha um\nLinha dois\n\n[Refrão]\nCoro\n\n[V2]\nLinha três";
  assert.deepEqual(parseSections(lyrics).map((s) => s.label), ["V1", "Refrão", "V2"]);
  assert.deepEqual(splitBlocks(lyrics), ["Linha um\nLinha dois", "Coro", "Linha três"]);
  assert.deepEqual(arrangedBlocks(lyrics, "V1 refrão V2 REFRÃO"), [
    "Linha um\nLinha dois",
    "Coro",
    "Linha três",
    "Coro",
  ]);
  assert.deepEqual(arrangedBlocks(lyrics, "XX"), splitBlocks(lyrics));
  assert.deepEqual(arrangedBlocks(lyrics, ""), splitBlocks(lyrics));
  assert.deepEqual(arrangedBlocks("a\n\nb", "2 1"), ["b", "a"]);
});

test("números por extenso", () => {
  assert.deepEqual(numberWordsToDigits(["vinte", "e", "oito"]), ["28"]);
  assert.deepEqual(numberWordsToDigits(["oito", "vinte", "e", "oito"]), ["8", "28"]);
  assert.deepEqual(numberWordsToDigits(["cento", "e", "dez"]), ["110"]);
  assert.deepEqual(numberWordsToDigits(["tres"]), ["3"]);
});

test("referências bíblicas", () => {
  const cases: [string, string | null][] = [
    ["Romanos 8:28", "Romanos 8:28"],
    ["abram em romanos capítulo 8 versículo 28", "Romanos 8:28"],
    ["Romanos oito vinte e oito", "Romanos 8:28"],
    ["João 3 16", "João 3:16"],
    ["Salmo 23 versículo 1 ao 3", "Salmos 23:1-3"],
    ["Salmos 23.1-3", "Salmos 23:1-3"],
    ["primeira Coríntios 13 4", "1 Coríntios 13:4"],
    ["1 João 4 8", "1 João 4:8"],
    ["segunda carta aos Coríntios 5 17", "2 Coríntios 5:17"],
    ["Efésios 2 8 até 9", "Efésios 2:8-9"],
    ["Romanos 8", null],
    ["hoje vamos falar de graça", null],
    ["no dia 8 de março", null],
  ];
  for (const [input, expected] of cases) {
    const ref = parseReference(input);
    assert.equal(ref ? formatReference(ref) : null, expected, input);
  }
});

test("abreviações só na busca digitada", () => {
  assert.equal(parseReference("Rm 8:28"), null);
  const ref = parseReference("Rm 8:28", true);
  assert.equal(ref && formatReference(ref), "Romanos 8:28");
  const co = parseReference("1Co 13:4", true);
  assert.equal(co && formatReference(co), "1 Coríntios 13:4");
  assert.equal(lookupBook("Gênesis"), 1);
  assert.equal(lookupBook("Apocalipse"), 66);
  assert.equal(lookupBook("2 Timóteo"), 55);
});

test("importa Bíblia em texto e JSON", () => {
  const lines: string[] = [];
  for (let i = 1; i <= 1000; i++) lines.push(`Gênesis 1:${i} Versículo ${i}`);
  const rows = parseBible(lines.join("\n"));
  assert.equal(rows.length, 1000);
  assert.equal(rows[0].book, 1);

  const books = Array.from({ length: 66 }, () => ({ chapters: [Array.from({ length: 20 }, (_, i) => `v${i + 1}`)] }));
  const fromJson = parseBible(JSON.stringify(books));
  assert.equal(fromJson.length, 66 * 20);
  assert.equal(fromJson[20].book, 2);
  assert.throws(() => parseBible("[1,2]"));
});

test("importa música em texto puro e remove cifras", () => {
  assert.equal(chordLine("G   D/F#  Em7  C"), true);
  assert.equal(chordLine("Dos montes correm"), false);
  const song = parsePlainSong("Cantarei\n\nG    D\nDos montes\nTeu rio\nLinha 3\nLinha 4\n\nRefrão\nA\nB", "arquivo");
  assert.equal(song.title, "Cantarei");
  assert.ok(!song.lyrics.includes("G    D"));
  assert.equal(parseSections(song.lyrics).length, 2);
});

test("sem detectar título, a primeira linha continua sendo letra", () => {
  const song = parsePlainSong("Primeira linha\nSegunda\n\nOutra estrofe", "Meu título", false);
  assert.equal(song.title, "Meu título");
  assert.deepEqual(parseSections(song.lyrics).map((s) => s.text), ["Primeira linha\nSegunda", "Outra estrofe"]);
});

test("agrupa de 4 em 4 linhas quando não há linhas em branco", () => {
  const song = parsePlainSong("Título\n1\n2\n3\n4\n5\n6\n7\n8", "x");
  assert.equal(parseSections(song.lyrics).length, 2);
});

test("contexto do Whisper traz títulos e palavras da letra", () => {
  const context = buildWhisperContext([
    { title: "Cantarei Teu Amor", text: "Dos montes correm para o mar\nTeu rio de amor" },
    { title: "Santo Espírito", text: "Santo Espírito, vem encher este lugar" },
  ]);
  assert.ok(context.prompt.startsWith("Culto cristão"));
  assert.ok(context.prompt.includes("Cantarei Teu Amor."));
  assert.ok(context.prompt.length <= 420);
  assert.ok(context.hotwords.includes("Cantarei"));
  assert.ok(context.hotwords.includes("Espírito"));
  assert.ok(context.hotwords.split(" ").length <= 30);
});

test("importa OpenSong", () => {
  const xml = `<?xml version="1.0"?>
<song>
  <title>Grande é o Senhor</title>
  <lyrics>[V1]
.G       D
 Grande é o Senhor
 E digno de louvor
;comentário
[C]
 Aleluia
</lyrics>
  <presentation>V1 C V1 C</presentation>
</song>`;
  const song = parseOpenSong(xml);
  assert.equal(song.title, "Grande é o Senhor");
  assert.deepEqual(arrangedBlocks(song.lyrics, song.arrangement), [
    "Grande é o Senhor\nE digno de louvor",
    "Aleluia",
    "Grande é o Senhor\nE digno de louvor",
    "Aleluia",
  ]);
});
