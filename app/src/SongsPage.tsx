import { useEffect, useState } from "react";
import { arrangedBlocks, parseSections } from "./blocks";
import { createSong, deleteSong, listSongs, Song, updateSong } from "./db";
import { readTextFile } from "./files";
import { parsePlainSong, parseSongFile } from "./songImport";

function SongsPage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [arrangement, setArrangement] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [message, setMessage] = useState("");
  const [importPath, setImportPath] = useState("");

  async function reload() {
    setSongs(await listSongs());
  }

  useEffect(() => {
    reload();
  }, []);

  const [referencePath, setReferencePath] = useState("");
  const [timelineJson, setTimelineJson] = useState("");

  function open(song: Song | null) {
    setSelectedId(song?.id ?? null);
    setTitle(song?.title ?? "");
    setLyrics(song?.lyrics ?? "");
    setArrangement(song?.arrangement ?? "");
    setReferencePath(song?.reference_audio_path ?? "");
    setTimelineJson(song?.timeline_json ?? "");
    setEditing(true);
    setConfirmingDelete(false);
    setMessage("");
  }

  async function save() {
    if (!title.trim()) {
      setMessage("Informe o título da música.");
      return;
    }
    if (selectedId === null) {
      const id = await createSong(title.trim(), lyrics, arrangement.trim());
      await updateSong(id, title.trim(), lyrics, referencePath.trim(), timelineJson.trim(), arrangement.trim());
      setSelectedId(id);
    } else {
      await updateSong(
        selectedId,
        title.trim(),
        lyrics,
        referencePath.trim(),
        timelineJson.trim(),
        arrangement.trim(),
      );
    }
    setMessage("Salvo.");
    await reload();
  }

  async function remove() {
    if (selectedId === null) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    try {
      await deleteSong(selectedId);
    } catch {
      setMessage("Não foi possível excluir. A música pode estar sendo usada em um culto.");
      setConfirmingDelete(false);
      return;
    }
    setEditing(false);
    setSelectedId(null);
    await reload();
  }

  /** Lê um arquivo (.txt ou OpenSong) e abre como música nova para conferir antes de salvar. */
  async function importFile() {
    if (!importPath.trim()) return;
    try {
      const content = await readTextFile(importPath.trim());
      const song = parseSongFile(content, importPath.trim());
      open(null);
      setTitle(song.title);
      setLyrics(song.lyrics);
      setArrangement(song.arrangement);
      setMessage("Importado. Confira a letra e clique em Salvar.");
    } catch (e) {
      setMessage(String(e));
    }
  }

  /** Limpa cifras e agrupa em estrofes o texto colado na letra. */
  function tidyLyrics() {
    setLyrics(parsePlainSong(lyrics, title.trim() || "Sem título", false).lyrics);
    setMessage("Cifras removidas e estrofes reorganizadas. Confira antes de salvar.");
  }

  const sections = parseSections(lyrics);
  const blocks = arrangedBlocks(lyrics, arrangement);
  const labels = sections.map((section) => section.label).filter(Boolean);

  return (
    <div className="columns">
      <aside className="list">
        <button onClick={() => open(null)}>+ Nova música</button>
        <ul>
          {songs.map((song) => (
            <li
              key={song.id}
              className={song.id === selectedId ? "selected" : ""}
              onClick={() => open(song)}
            >
              {song.title}
            </li>
          ))}
        </ul>
        {songs.length === 0 && <p className="hint">Nenhuma música cadastrada.</p>}

        <h4>Importar arquivo</h4>
        <input
          value={importPath}
          onChange={(e) => setImportPath(e.target.value)}
          placeholder="~/Downloads/musica.txt ou .xml (OpenSong)"
        />
        <div className="actions">
          <button onClick={importFile} disabled={!importPath.trim()}>
            Importar
          </button>
        </div>
      </aside>

      {editing && (
        <section className="editor">
          <label>
            Título
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>

          <label>
            Letra{" "}
            <span className="hint">
              (separe as estrofes com uma linha em branco; para marcar uma estrofe, escreva [V1] ou
              [Refrão] na primeira linha)
            </span>
            <textarea value={lyrics} onChange={(e) => setLyrics(e.target.value)} rows={16} />
          </label>
          <div className="actions">
            <button onClick={tidyLyrics} disabled={!lyrics.trim()}>
              Limpar cifras e organizar estrofes
            </button>
          </div>

          <label>
            Ordem de canto <span className="hint">(opcional, usa os rótulos: V1 Refrão V2 Refrão)</span>
            <input
              value={arrangement}
              onChange={(e) => setArrangement(e.target.value)}
              placeholder={labels.length ? labels.join(" ") : "ex.: V1 R V2 R"}
            />
          </label>

          <label>
            Áudio de referência (backing/click)
            <input
              value={referencePath}
              onChange={(e) => setReferencePath(e.target.value)}
              placeholder="/caminho/para/musica.wav"
            />
          </label>

          <label>
            Timeline JSON (estrofes ↔ ms)
            <textarea
              value={timelineJson}
              onChange={(e) => setTimelineJson(e.target.value)}
              rows={6}
              placeholder='{"markers":[{"start_ms":0,"block_index":0}]}'
            />
          </label>

          <div className="actions">
            <button onClick={save}>Salvar</button>
            {selectedId !== null && (
              <button className="danger" onClick={remove}>
                {confirmingDelete ? "Confirmar exclusão" : "Excluir"}
              </button>
            )}
            {message && <span className="hint">{message}</span>}
          </div>

          <h3>
            {blocks.length} tela(s) na ordem de canto
            {arrangement.trim() && ` · ${sections.length} estrofe(s) distintas`}
          </h3>
          {arrangement.trim() && timelineJson.trim() && (
            <p className="warning">
              Atenção: a timeline usa o número da tela na ordem de canto (com o refrão repetido).
            </p>
          )}
          <ol className="blocks">
            {blocks.map((block, index) => (
              <li key={index}>{block}</li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

export default SongsPage;
