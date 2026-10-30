// Compara latência de blocos 5s vs 3s (com overlap) em transcrições JSONL.
// Uso:
//   .venv/bin/python python/listen.py --file test_audio/voz_real.jsonl ... (gerar jsonl)
//   node scripts/latency_report.ts test_audio/culto_5s.jsonl test_audio/culto_3s.jsonl

import { readFileSync } from "node:fs";

type Line = { text: string; start?: number; end?: number; emitted_at?: number; transcribe_ms?: number };

function load(path: string): Line[] {
  return readFileSync(path, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((row) => JSON.parse(row) as Line);
}

function report(name: string, lines: Line[]) {
  const latencies = lines
    .filter((l) => l.transcribe_ms !== undefined)
    .map((l) => l.transcribe_ms!);
  if (latencies.length === 0) {
    console.log(`${name}: sem transcribe_ms (regere o JSONL com listen.py atual)`);
    return;
  }
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const max = Math.max(...latencies);
  const min = Math.min(...latencies);
  console.log(
    `${name}: blocos=${lines.length} transcribe_ms avg=${Math.round(avg)} min=${min} max=${max}`,
  );
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.log("Informe um ou mais arquivos .jsonl");
  process.exit(1);
}
for (const file of files) report(file, load(file));
