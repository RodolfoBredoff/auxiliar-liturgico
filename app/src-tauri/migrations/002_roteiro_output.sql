ALTER TABLE services ADD COLUMN service_date TEXT NOT NULL DEFAULT '';
ALTER TABLE services ADD COLUMN venue TEXT NOT NULL DEFAULT '';
ALTER TABLE services ADD COLUMN liturgy_notes TEXT NOT NULL DEFAULT '';

ALTER TABLE service_items ADD COLUMN output_target TEXT NOT NULL DEFAULT 'native'
  CHECK (output_target IN ('native', 'presenter_midi', 'powerpoint'));
ALTER TABLE service_items ADD COLUMN external_ref TEXT NOT NULL DEFAULT '{}';

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('block_seconds', '3'),
  ('block_overlap', '1'),
  ('auto_advance_songs', '1'),
  ('follow_verse_auto', '1'),
  ('midi_port', ''),
  ('midi_note', '60'),
  ('powerpoint_enabled', '1');
