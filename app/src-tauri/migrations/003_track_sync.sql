ALTER TABLE songs ADD COLUMN reference_audio_path TEXT NOT NULL DEFAULT '';
ALTER TABLE songs ADD COLUMN timeline_json TEXT NOT NULL DEFAULT '';

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('sync_mode', 'hybrid'),
  ('track_min_confidence', '0.3'),
  ('pa_delay_ms', '0');
