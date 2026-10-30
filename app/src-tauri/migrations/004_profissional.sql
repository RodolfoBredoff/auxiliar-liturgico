-- Ordem de canto (ex.: "V1 R V2 R"), para não repetir o refrão na letra.
ALTER TABLE songs ADD COLUMN arrangement TEXT NOT NULL DEFAULT '';

-- Registro do que foi ouvido, sugerido e mostrado em cada culto (ajuste de limiares e depuração).
CREATE TABLE session_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id INTEGER,
  at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  kind TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT ''
);

-- Bíblia importada pelo operador (o app não traz texto bíblico embutido).
CREATE TABLE bible_verses (
  version TEXT NOT NULL,
  book INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  text TEXT NOT NULL,
  PRIMARY KEY (version, book, chapter, verse)
);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('pause_segmentation', '0'),
  ('voice_commands', '0'),
  ('alert_sound', '1'),
  ('bible_version', ''),
  ('bible_detect', '1'),
  ('logo_path', ''),
  ('theme', '');
