-- Culto de referência (docs/MVP.md, seção 3).
-- Uso: sqlite3 ~/Library/Application\ Support/com.igreja.auxiliar/auxiliar.db < app/seed/culto_referencia.sql

INSERT INTO services (title) VALUES ('Culto de referência');

INSERT INTO service_items (service_id, type, title, position)
SELECT (SELECT MAX(id) FROM services), type, title, position FROM (
  SELECT 'section' AS type, 'Ciclo 1' AS title, 1 AS position
  UNION ALL SELECT 'text', 'Abertura com leitura bíblica', 2
  UNION ALL SELECT 'blank', 'Oração espontânea', 3
  UNION ALL SELECT 'text', 'Leitura de salmo', 4
  UNION ALL SELECT 'song', 'Música 1', 5
  UNION ALL SELECT 'song', 'Música 2', 6
  UNION ALL SELECT 'song', 'Música 3', 7
  UNION ALL SELECT 'text', 'Oração comunitária', 8
  UNION ALL SELECT 'section', 'Ciclo 2', 9
  UNION ALL SELECT 'text', 'Visitantes e arte', 10
  UNION ALL SELECT 'text', 'Convite às crianças', 11
  UNION ALL SELECT 'blank', 'Sermão principal', 12
  UNION ALL SELECT 'section', 'Ciclo 3 — Ceia', 13
  UNION ALL SELECT 'text', 'Comunhão', 14
  UNION ALL SELECT 'text', 'Texto da ceia', 15
  UNION ALL SELECT 'section', 'Ciclo 4 — Envio e resposta', 16
  UNION ALL SELECT 'song', 'Ofertório', 17
  UNION ALL SELECT 'text', 'Avisos', 18
  UNION ALL SELECT 'blank', 'Envio: oração final e encerramento', 19
);
