"""Importa roteiro WorshipTools (PDF) para SQL do Auxiliar Litúrgico.

Uso:
    .venv/bin/python python/import_roteiro.py "4 de out - SEDE.pdf" > app/seed/import_sede.sql
"""

import json
import re
import sys
from pathlib import Path

import pymupdf

TIME_RE = re.compile(r"^\d{1,2}:\d{2}(?::\d{2})?$")
MUSIC_RE = re.compile(r"^MÚSICA\s+\d+:\s*(.+?)(?:\s+([A-G](?:#|b)?))?$", re.I)
CYCLE_RE = re.compile(r"^CICLO\s+[IVX\d]+", re.I)


def default_output(item_type: str, title: str) -> tuple[str, dict]:
    title_u = title.upper()
    if item_type == "song":
        return "powerpoint", {"ppt": {"slideStart": 1}}
    if item_type == "image" or "ARTE" in title_u or "VÍDEO" in title_u:
        return "presenter_midi", {"presenter": {"midiNote": 60}}
    if item_type == "text":
        return "presenter_midi", {"presenter": {"midiNote": 60}}
    return "native", {}


def parse_duration(token: str) -> int | None:
    parts = [int(x) for x in token.split(":")]
    if len(parts) == 2:
        return parts[0] * 60 + parts[1]
    if len(parts) == 3:
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    return None


def classify_line(line: str) -> tuple[str, str, dict]:
    line = line.strip()
    extra: dict = {}

    m = MUSIC_RE.match(line)
    if m:
        extra["musicKey"] = m.group(2) or ""
        return "song", m.group(1).strip(), extra

    upper = line.upper()
    if CYCLE_RE.match(line) or line.startswith("CICLO "):
        return "section", line, extra
    if "SERMÃO" in upper or line.startswith("Sermão:"):
        return "blank", line, extra
    if "VINHETA" in upper or "PRELÚDIO" in upper or "PRELUDIO" in upper:
        return "blank", line, extra
    if "ARTE" in upper or "VÍDEO" in upper or "VIDEO" in upper:
        return "image", line, extra
    if line.startswith("Abertura:"):
        extra["scriptureRef"] = line.split(":", 1)[1].strip()
        return "text", line.split(":")[0], extra
    if line.startswith("Salmo"):
        return "text", line.split("\n")[0][:80], extra
    if "ORAÇÃO" in upper or "Oração" in line:
        return "text", line[:80], extra
    if "Ceia" in line or "ceia" in line:
        return "text", line[:80], extra
    if "Oferta" in line or "Dizimos" in line:
        return "song" if "Oferta:" in line else "text", line, extra
    return "text", line[:120], extra


def sql_escape(value: str) -> str:
    return value.replace("'", "''")


def main():
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "4 de out - SEDE.pdf")
    doc = pymupdf.open(path)
    text = "\n".join(page.get_text() for page in doc)

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    service_title = "Culto SEDE"
    service_date = "2026-10-04"
    venue = "SEDE PADRE EUSTÁQUIO"
    notes_lines: list[str] = []

    for ln in lines:
        if "Culto Domingo" in ln:
            service_title = ln.split("||")[0].strip()
        if "domingo," in ln.lower():
            m = re.search(r"(\d+) de (\w+) de (\d{4})", ln, re.I)
            if m:
                months = {
                    "janeiro": "01",
                    "fevereiro": "02",
                    "março": "03",
                    "marco": "03",
                    "abril": "04",
                    "maio": "05",
                    "junho": "06",
                    "julho": "07",
                    "agosto": "08",
                    "setembro": "09",
                    "outubro": "10",
                    "novembro": "11",
                    "dezembro": "12",
                }
                mon = months.get(m.group(2).lower(), "10")
                service_date = f"{m.group(3)}-{mon}-{int(m.group(1)):02d}"
        if "SEDE" in ln and "PADRE" in ln:
            venue = "SEDE PADRE EUSTÁQUIO"
        if ln.startswith("Funções") or "Planning by WorshipTools" in ln:
            notes_lines.append(ln)

    items: list[dict] = []
    i = 0
    started = False
    while i < len(lines):
        ln = lines[i]
        if not started:
            if ln in ("VINHETA", "PRELÚDIO", "PRELUDIO") or ln.startswith("Abertura:"):
                started = True
            elif TIME_RE.match(ln) and ln in ("0:10", "5:00", "2:30"):
                started = True
            else:
                i += 1
                continue
        if TIME_RE.match(ln):
            duration = parse_duration(ln)
            if duration is not None and duration > 7200:
                i += 1
                continue
            i += 1
            if i >= len(lines):
                break
            body_parts = [lines[i]]
            i += 1
            while i < len(lines) and not TIME_RE.match(lines[i]):
                if lines[i].startswith("CICLO ") and "–" in lines[i]:
                    break
                body_parts.append(lines[i])
                i += 1
            body = "\n".join(body_parts).strip()
            first = body_parts[0]
            item_type, title, extra = classify_line(first)
            content = body if item_type in ("text", "image") else ""
            if item_type == "text" and len(body_parts) > 1:
                content = body
            ref = {**extra}
            if duration is not None:
                ref["plannedDurationSec"] = duration
            out_target, out_extra = default_output(item_type, title)
            ref.update(out_extra)
            items.append(
                {
                    "type": item_type,
                    "title": title if title else first[:80],
                    "content": content,
                    "output_target": out_target,
                    "external_ref": ref,
                }
            )
            continue
        if ln.startswith("CICLO ") and "–" in ln:
            items.append(
                {
                    "type": "section",
                    "title": ln,
                    "content": "",
                    "output_target": "native",
                    "external_ref": {},
                }
            )
            i += 1
            continue
        if started and not TIME_RE.match(ln):
            item_type, title, extra = classify_line(ln)
            out_target, out_extra = default_output(item_type, title)
            ref = {**extra, **out_extra}
            items.append(
                {
                    "type": item_type,
                    "title": title,
                    "content": ln if item_type == "text" else "",
                    "output_target": out_target,
                    "external_ref": ref,
                }
            )
        i += 1

    print("-- Gerado por python/import_roteiro.py")
    print(f"INSERT INTO services (title, service_date, venue, liturgy_notes) VALUES (")
    print(f"  '{sql_escape(service_title)}', '{service_date}', '{sql_escape(venue)}',")
    print(f"  '{sql_escape(chr(10).join(notes_lines[:20]))}'")
    print(");")
    print("")
    pos = 1
    for item in items:
        ref = json.dumps(item["external_ref"], ensure_ascii=False)
        print(
            f"INSERT INTO service_items (service_id, type, title, content, position, output_target, external_ref)"
        )
        print(
            f"SELECT (SELECT MAX(id) FROM services), '{item['type']}', "
            f"'{sql_escape(item['title'])}', '{sql_escape(item['content'])}', {pos}, "
            f"'{item['output_target']}', '{sql_escape(ref)}';"
        )
        pos += 1


if __name__ == "__main__":
    main()
