import { useEffect, useState } from "react";
import { splitBlocks } from "./blocks";
import {
  addItem,
  createService,
  deleteItem,
  deleteService,
  duplicateService,
  ExternalRef,
  ItemType,
  listItems,
  listServices,
  listSongs,
  OutputTarget,
  Service,
  ServiceItem,
  Song,
  swapItems,
  updateItem,
  updateServiceMeta,
} from "./db";
import { OUTPUT_LABELS } from "./syncOutput";

const TYPE_LABELS: Record<ItemType, string> = {
  section: "Ciclo",
  text: "Texto",
  song: "Música",
  image: "Imagem",
  blank: "Tela em branco",
};

type Props = {
  onRun: (service: Service) => void;
};

function ServicesPage({ onRun }: Props) {
  const [services, setServices] = useState<Service[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [serviceTitle, setServiceTitle] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [venue, setVenue] = useState("");
  const [liturgyNotes, setLiturgyNotes] = useState("");
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [itemId, setItemId] = useState<number | null>(null);
  const [newType, setNewType] = useState<ItemType>("text");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function reloadServices() {
    setServices(await listServices());
  }

  async function reloadItems(id: number) {
    setItems(await listItems(id));
  }

  useEffect(() => {
    reloadServices();
    listSongs().then(setSongs);
  }, []);

  async function openService(service: Service) {
    setServiceId(service.id);
    setServiceTitle(service.title);
    setServiceDate(service.service_date ?? "");
    setVenue(service.venue ?? "");
    setLiturgyNotes(service.liturgy_notes ?? "");
    setItemId(null);
    setConfirmingDelete(false);
    await reloadItems(service.id);
  }

  async function newService() {
    const title = "Novo culto";
    const id = await createService(title);
    await reloadServices();
    await openService({ id, title, service_date: "", venue: "", liturgy_notes: "" });
  }

  async function duplicate() {
    if (serviceId === null) return;
    const title = `${serviceTitle} (cópia)`;
    const id = await duplicateService(serviceId, title);
    await reloadServices();
    await openService({
      id,
      title,
      service_date: serviceDate,
      venue,
      liturgy_notes: liturgyNotes,
    });
  }

  async function saveMeta() {
    if (serviceId === null || !serviceTitle.trim()) return;
    await updateServiceMeta(
      serviceId,
      serviceTitle.trim(),
      serviceDate.trim(),
      venue.trim(),
      liturgyNotes.trim(),
    );
    await reloadServices();
  }

  async function removeService() {
    if (serviceId === null) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    await deleteService(serviceId);
    setServiceId(null);
    setItems([]);
    await reloadServices();
  }

  async function add() {
    if (serviceId === null) return;
    const id = await addItem(serviceId, newType, TYPE_LABELS[newType]);
    await reloadItems(serviceId);
    setItemId(id);
  }

  async function move(index: number, direction: -1 | 1) {
    const other = items[index + direction];
    if (serviceId === null || !other) return;
    await swapItems(items[index], other);
    await reloadItems(serviceId);
  }

  const selectedItem = items.find((item) => item.id === itemId);

  return (
    <div className="columns">
      <aside className="list">
        <button onClick={newService}>+ Novo culto</button>
        <ul>
          {services.map((service) => (
            <li
              key={service.id}
              className={service.id === serviceId ? "selected" : ""}
              onClick={() => openService(service)}
            >
              {service.title}
            </li>
          ))}
        </ul>
        {services.length === 0 && <p className="hint">Nenhum culto cadastrado.</p>}
      </aside>

      {serviceId !== null && (
        <section className="sequence">
          <label>
            Culto
            <input
              value={serviceTitle}
              onChange={(e) => setServiceTitle(e.target.value)}
              onBlur={saveMeta}
            />
          </label>
          <label>
            Data
            <input
              value={serviceDate}
              onChange={(e) => setServiceDate(e.target.value)}
              onBlur={saveMeta}
              placeholder="2026-10-04"
            />
          </label>
          <label>
            Sede / local
            <input value={venue} onChange={(e) => setVenue(e.target.value)} onBlur={saveMeta} />
          </label>
          <label>
            Notas do planejamento
            <textarea
              value={liturgyNotes}
              onChange={(e) => setLiturgyNotes(e.target.value)}
              onBlur={saveMeta}
              rows={4}
            />
          </label>

          <div className="actions">
            <button
              className="primary"
              onClick={() =>
                onRun({
                  id: serviceId,
                  title: serviceTitle,
                  service_date: serviceDate,
                  venue,
                  liturgy_notes: liturgyNotes,
                })
              }
            >
              ▶ Executar
            </button>
            <button onClick={duplicate}>Duplicar culto</button>
            <button className="danger" onClick={removeService}>
              {confirmingDelete ? "Confirmar exclusão" : "Excluir culto"}
            </button>
          </div>

          <ol className="items">
            {items.map((item, index) => (
              <li
                key={item.id}
                className={`item-${item.type} ${item.id === itemId ? "selected" : ""}`}
                onClick={() => setItemId(item.id)}
              >
                <span className="item-type">{TYPE_LABELS[item.type]}</span>
                <span className="item-title">
                  {item.title}
                  {item.type === "song" &&
                    (item.song_title ? (
                      <span className="hint"> — {item.song_title}</span>
                    ) : (
                      <span className="warning"> — escolher música</span>
                    ))}
                </span>
                <span className="item-move">
                  <button onClick={(e) => { e.stopPropagation(); move(index, -1); }}>↑</button>
                  <button onClick={(e) => { e.stopPropagation(); move(index, 1); }}>↓</button>
                </span>
              </li>
            ))}
          </ol>
          {items.length === 0 && <p className="hint">Nenhum item. Adicione abaixo.</p>}

          <div className="actions">
            <select value={newType} onChange={(e) => setNewType(e.target.value as ItemType)}>
              {Object.entries(TYPE_LABELS).map(([type, label]) => (
                <option key={type} value={type}>
                  {label}
                </option>
              ))}
            </select>
            <button onClick={add}>Adicionar item</button>
          </div>
        </section>
      )}

      {selectedItem && (
        <ItemEditor
          key={selectedItem.id}
          item={selectedItem}
          songs={songs}
          onChanged={async (removed) => {
            if (removed) setItemId(null);
            await reloadItems(selectedItem.service_id);
          }}
        />
      )}
    </div>
  );
}

type ItemEditorProps = {
  item: ServiceItem;
  songs: Song[];
  onChanged: (removed: boolean) => Promise<void>;
};

function ItemEditor({ item, songs, onChanged }: ItemEditorProps) {
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content);
  const [songId, setSongId] = useState<number | null>(item.song_id);
  const [outputTarget, setOutputTarget] = useState<OutputTarget>(item.output_target);
  const [slideStart, setSlideStart] = useState(String(item.external_ref.ppt?.slideStart ?? 1));
  const [midiNote, setMidiNote] = useState(String(item.external_ref.presenter?.midiNote ?? 60));
  const [scriptureRef, setScriptureRef] = useState(item.external_ref.scriptureRef ?? "");
  const [musicKey, setMusicKey] = useState(item.external_ref.musicKey ?? "");
  const [plannedMin, setPlannedMin] = useState(
    item.external_ref.plannedDurationSec ? String(Math.round(item.external_ref.plannedDurationSec / 60)) : "",
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [message, setMessage] = useState("");

  function buildRef(): ExternalRef {
    const ref: ExternalRef = { ...item.external_ref };
    if (scriptureRef.trim()) ref.scriptureRef = scriptureRef.trim();
    else delete ref.scriptureRef;
    if (musicKey.trim()) ref.musicKey = musicKey.trim();
    else delete ref.musicKey;
    const minutes = Number(plannedMin.replace(",", "."));
    if (minutes > 0) ref.plannedDurationSec = Math.round(minutes * 60);
    else delete ref.plannedDurationSec;
    if (outputTarget === "powerpoint") {
      ref.ppt = { ...ref.ppt, slideStart: Number(slideStart) || 1 };
    }
    if (outputTarget === "presenter_midi") {
      ref.presenter = { midiNote: Number(midiNote) || 60 };
    }
    return ref;
  }

  async function save() {
    await updateItem(
      item.id,
      title.trim(),
      content,
      item.type === "song" ? songId : null,
      outputTarget,
      buildRef(),
    );
    setMessage("Salvo.");
    await onChanged(false);
  }

  async function remove() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    await deleteItem(item.id);
    await onChanged(true);
  }

  return (
    <section className="item-editor">
      <h3>{TYPE_LABELS[item.type]}</h3>

      <label>
        Título
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>

      {item.type === "text" && (
        <label>
          Texto <span className="hint">(separe os blocos com uma linha em branco)</span>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={12} />
          <span className="hint">{splitBlocks(content).length} bloco(s)</span>
        </label>
      )}

      {item.type === "song" && (
        <label>
          Música
          <select
            value={songId ?? ""}
            onChange={(e) => setSongId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— escolher —</option>
            {songs.map((song) => (
              <option key={song.id} value={song.id}>
                {song.title}
              </option>
            ))}
          </select>
          {songs.length === 0 && (
            <span className="hint">Cadastre músicas na aba Músicas.</span>
          )}
        </label>
      )}

      {item.type === "image" && (
        <label>
          Caminho da imagem
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="/Users/.../imagem.png"
          />
        </label>
      )}

      {item.type !== "section" && (
        <>
          <label>
            Saída de projeção
            <select
              value={outputTarget}
              onChange={(e) => setOutputTarget(e.target.value as OutputTarget)}
            >
              {Object.entries(OUTPUT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {outputTarget === "powerpoint" && (
            <label>
              Slide inicial (1 = primeira estrofe)
              <input value={slideStart} onChange={(e) => setSlideStart(e.target.value)} />
            </label>
          )}
          {outputTarget === "presenter_midi" && (
            <label>
              Nota MIDI (Presenter)
              <input value={midiNote} onChange={(e) => setMidiNote(e.target.value)} />
            </label>
          )}
          {(item.type === "text" || item.type === "song") && (
            <label>
              Referência bíblica / tom
              <input
                value={scriptureRef}
                onChange={(e) => setScriptureRef(e.target.value)}
                placeholder="Ex.: Mateus 21:33-46"
              />
              <input
                value={musicKey}
                onChange={(e) => setMusicKey(e.target.value)}
                placeholder="Tom (C, D, G…)"
              />
            </label>
          )}
        </>
      )}

      {item.type !== "section" && (
        <label>
          Duração prevista (minutos) <span className="hint">(contagem regressiva na tela de palco)</span>
          <input value={plannedMin} onChange={(e) => setPlannedMin(e.target.value)} placeholder="Ex.: 5" />
        </label>
      )}

      <div className="actions">
        <button onClick={save}>Salvar</button>
        <button className="danger" onClick={remove}>
          {confirmingDelete ? "Confirmar remoção" : "Remover"}
        </button>
        {message && <span className="hint">{message}</span>}
      </div>
    </section>
  );
}

export default ServicesPage;
