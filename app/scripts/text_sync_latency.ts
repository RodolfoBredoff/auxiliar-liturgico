// Mede atraso até primeira detecção correta da estrofe (pipeline textual).
// Uso: node scripts/text_sync_latency.ts ../test_audio/voz_real_1s.jsonl [limiar]
import { readFileSync } from "node:fs";
import { findMatch, shouldSuggest, type Candidate, type Position } from "../src/matching.ts";
import { splitBlocks } from "../src/blocks.ts";

const threshold = Number(process.argv[3] ?? 0.6);
const jsonlPath = process.argv[2];
if (!jsonlPath) {
  console.error("Uso: node scripts/text_sync_latency.ts <arquivo.jsonl> [limiar]");
  process.exit(1);
}

type Line = { text: string; start?: number; end?: number; transcribe_ms?: number };

const songBlocks = splitBlocks(`Dos montes correm para o mar
Teu rio de amor por mim
Eu abrirei meu coração
Deixando a tua cura entrar

Minha alegria é te pertencer
Levantarei as minhas mãos
Teu amor me alcança e me faz louvar-te

Cantarei teu amor pra sempre
Cantarei teu amor pra sempre`);

const candidates: Candidate[] = [{ itemIndex: 4, title: "Cantarei Teu Amor", blocks: songBlocks }];

const verseStartsSec = [15, 20, 28, 38, 48, 55];

const lines = readFileSync(jsonlPath, "utf8")
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((row) => JSON.parse(row) as Line);

const delays: number[] = [];

for (let vi = 0; vi < verseStartsSec.length; vi++) {
  const verseStart = verseStartsSec[vi];
  let position: Position = { itemIndex: 4, blockIndex: Math.max(0, vi - 1) };
  let found: number | null = null;

  for (const line of lines) {
    const t = line.end ?? (line.start ?? 0) + 1;
    if (t < verseStart) continue;
    const match = findMatch(line.text, candidates, position);
    if (!shouldSuggest(match, threshold, position, [], 0)) continue;
    if (match!.blockIndex !== vi) continue;
    const latencyMs = t * 1000 + (line.transcribe_ms ?? 0) - verseStart * 1000;
    found = latencyMs;
    break;
  }
  delays.push(found ?? Number.NaN);
}

const valid = delays.filter((d) => !Number.isNaN(d));
valid.sort((a, b) => a - b);
const median = valid.length ? valid[Math.floor(valid.length / 2)] : NaN;

console.log(`Arquivo: ${jsonlPath}`);
console.log(`Delays ms por estrofe (desde início esperado):`, delays.map((d) => (Number.isNaN(d) ? "miss" : Math.round(d))));
console.log(`Mediana: ${Number.isNaN(median) ? "n/a" : Math.round(median)} ms`);
console.log(`Critério sub-300ms: ${!Number.isNaN(median) && median <= 300 ? "PASS" : "FAIL"}`);
