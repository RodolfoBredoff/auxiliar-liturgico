import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import { parseReference, Reference } from "./bible";
import { BibleHit, lookupBible, resolveBibleVersion } from "./bibleLookup";
import { itemBlocks } from "./blocks";
import { getSetting, listItems, logEvent, ServiceItem, setSetting } from "./db";
import { saveBackup } from "./files";
import { useListener, writeWhisperContext } from "./listener";
import {
  canAutoAdvanceSong,
  Candidate,
  findMatch,
  IGNORE_MS,
  Ignored,
  Match,
  parseVoiceCommand,
  shouldSuggest,
  slidingText,
} from "./matching";
import PresentationScreen, { Slide } from "./PresentationScreen";
import QuickSearch from "./QuickSearch";
import { pushRemoteState } from "./remote";
import type { StageInfo } from "./StagePage";
import { syncExternalOutput } from "./syncOutput";
import { DEFAULT_THEME, loadTheme, Theme } from "./theme";
import { blockIndexForPos, parseTimeline } from "./trackSync";
import { buildWhisperContext } from "./whisperContext";

type Position = { item: number; block: number };

/** live: slide normal · clear: só o fundo do tema · black: tela preta · logo: logotipo da igreja */
type Layer = "live" | "clear" | "black" | "logo";

type ShowVia = "manual" | "sugestão" | "auto" | "faixa" | "voz" | "busca" | "retomada" | "remoto";

type Heard = {
  text: string;
  time: Date;
  match: Match | null;
  transcribeMs?: number;
  audioStart?: number;
};

function hasText(item: ServiceItem) {
  if (item.type === "song") return !!item.song_lyrics?.trim();
  if (item.type === "text") return !!item.content.trim();
  return false;
}

function buildCandidates(items: ServiceItem[], from: number, window: number): Candidate[] {
  const toCandidate = (item: ServiceItem, index: number): Candidate => ({
    itemIndex: index,
    title: item.song_title ?? item.title,
    blocks: itemBlocks(item),
  });

  const candidates = items[from] && hasText(items[from]) ? [toCandidate(items[from], from)] : [];
  const upcoming = items
    .map((item, index) => ({ item, index }))
    .filter(({ item, index }) => index > from && hasText(item))
    .slice(0, window);
  return [...candidates, ...upcoming.map(({ item, index }) => toCandidate(item, index))];
}

function findItemIndex(items: ServiceItem[], from: number, direction: 1 | -1) {
  for (let i = from + direction; i >= 0 && i < items.length; i += direction) {
    if (items[i].type !== "section") return i;
  }
  return -1;
}

function blockLabel(item: ServiceItem, text: string) {
  if (item.type === "image") return "[imagem]";
  if (item.type === "blank") return "[tela em branco]";
  return text;
}

function matchName(match: Match, items: ServiceItem[]) {
  const item = items[match.itemIndex];
  return item.song_title ? `${item.title} — ${item.song_title}` : item.title;
}

function matchWhere(match: Match, items: ServiceItem[]) {
  if (match.byTitle) return "Anúncio";
  return `${items[match.itemIndex].type === "song" ? "Estrofe" : "Bloco"} ${match.blockIndex + 1}`;
}

function describeMatch(match: Match, items: ServiceItem[]) {
  const where = matchWhere(match, items).toLowerCase();
  return `${matchName(match, items)} · ${where} · ${Math.round(match.score * 100)}%`;
}

let audioContext: AudioContext | null = null;

/** Bipe curto para chamar a atenção do operador quando surge uma sugestão. */
function beep() {
  try {
    audioContext ??= new AudioContext();
    void audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = 880;
    gain.gain.value = 0.06;
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.12);
  } catch {
    // sem áudio de saída: a sugestão continua visível na tela
  }
}

type Props = {
  serviceId: number;
  serviceTitle: string;
  onExit: () => void;
};

function ExecutePage({ serviceId, serviceTitle, onExit }: Props) {
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [position, setPosition] = useState<Position | null>(null);
  const [layer, setLayer] = useState<Layer>("live");
  const [adhoc, setAdhoc] = useState<BibleHit | null>(null);
  const [heard, setHeard] = useState<Heard[]>([]);
  const [threshold, setThreshold] = useState(0.6);
  const [matchWindow, setMatchWindow] = useState(3);
  const [autoAdvanceSongs, setAutoAdvanceSongs] = useState(true);
  const [autoHold, setAutoHold] = useState(false);
  const [followVerseAuto, setFollowVerseAuto] = useState(true);
  const [voiceCommands, setVoiceCommands] = useState(false);
  const [alertSound, setAlertSound] = useState(true);
  const [bibleDetect, setBibleDetect] = useState(true);
  const [bibleVersion, setBibleVersion] = useState("");
  const [logoPath, setLogoPath] = useState("");
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [suggestion, setSuggestion] = useState<Match | null>(null);
  const [bibleSuggestion, setBibleSuggestion] = useState<BibleHit | null>(null);
  const [ignored, setIgnored] = useState<Ignored[]>([]);
  const [projectorOpen, setProjectorOpen] = useState(false);
  const [projectorError, setProjectorError] = useState("");
  const [stageOpen, setStageOpen] = useState(false);
  const [outputError, setOutputError] = useState("");
  const [syncMode, setSyncMode] = useState("hybrid");
  const [trackMinConfidence, setTrackMinConfidence] = useState(0.3);
  const [trackPosMs, setTrackPosMs] = useState<number | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [bibleQuery, setBibleQuery] = useState("");
  const [bibleMessage, setBibleMessage] = useState("");
  const [now, setNow] = useState(Date.now());
  const [caption, setCaption] = useState({ id: 0, text: "" });
  const trackMinRef = useRef(trackMinConfidence);
  trackMinRef.current = trackMinConfidence;

  const itemsRef = useRef(items);
  const positionRef = useRef(position);
  const ignoredRef = useRef(ignored);
  const thresholdRef = useRef(threshold);
  const matchWindowRef = useRef(matchWindow);
  const autoAdvanceRef = useRef(autoAdvanceSongs);
  const autoHoldRef = useRef(autoHold);
  const followVerseRef = useRef(followVerseAuto);
  const voiceCommandsRef = useRef(voiceCommands);
  const alertSoundRef = useRef(alertSound);
  const bibleDetectRef = useRef(bibleDetect);
  const bibleVersionRef = useRef(bibleVersion);
  const historyRef = useRef<string[]>([]);
  const captionLinesRef = useRef<string[]>([]);
  const lastBibleKeyRef = useRef({ key: "", time: 0 });
  const serviceStartedAt = useRef(Date.now());
  const itemStartedAt = useRef(Date.now());
  const levelHighAt = useRef(Date.now());

  itemsRef.current = items;
  positionRef.current = position;
  ignoredRef.current = ignored;
  thresholdRef.current = threshold;
  matchWindowRef.current = matchWindow;
  autoAdvanceRef.current = autoAdvanceSongs;
  autoHoldRef.current = autoHold;
  followVerseRef.current = followVerseAuto;
  voiceCommandsRef.current = voiceCommands;
  alertSoundRef.current = alertSound;
  bibleDetectRef.current = bibleDetect;
  bibleVersionRef.current = bibleVersion;

  const showRef = useRef<(item: number, block: number, via?: ShowVia) => void>(() => {});
  const nextRef = useRef<() => void>(() => {});
  const previousRef = useRef<() => void>(() => {});

  function record(kind: string, data: unknown) {
    void logEvent(serviceId, kind, data);
  }

  function suggest(show: () => void) {
    show();
    if (alertSoundRef.current) beep();
  }

  async function detectBible(text: string) {
    const version = bibleVersionRef.current;
    if (!bibleDetectRef.current || !version) return;
    const ref = parseReference(text);
    if (!ref) return;
    const hit = await lookupBible(ref, version);
    if (!hit) return;
    const last = lastBibleKeyRef.current;
    const at = Date.now();
    if (last.key === hit.key && at - last.time < IGNORE_MS) return;
    lastBibleKeyRef.current = { key: hit.key, time: at };
    record("bible_suggestion", { label: hit.label });
    suggest(() => setBibleSuggestion(hit));
  }

  const listener = useListener((line) => {
    const itemsNow = itemsRef.current;
    const positionNow = positionRef.current;

    if (voiceCommandsRef.current) {
      const command = parseVoiceCommand(line.text);
      if (command) {
        record("voice_command", { command, text: line.text });
        if (command === "next") nextRef.current();
        else if (command === "previous") previousRef.current();
        else setLayer(command === "hide" ? "black" : "live");
        return;
      }
    }

    captionLinesRef.current = [...captionLinesRef.current, line.text].slice(-2);
    setCaption({ id: Date.now(), text: captionLinesRef.current.join(" ") });

    const candidates = buildCandidates(itemsNow, positionNow?.item ?? -1, matchWindowRef.current);
    const current = positionNow
      ? { itemIndex: positionNow.item, blockIndex: positionNow.block }
      : null;

    // Um verso pode ficar partido entre dois blocos de áudio: compara a linha sozinha e a janela.
    const alone = findMatch(line.text, candidates, current);
    const windowed = findMatch(slidingText(historyRef.current, line.text), candidates, current);
    const match = windowed && (!alone || windowed.score > alone.score) ? windowed : alone;
    historyRef.current = [...historyRef.current, line.text].slice(-4);

    const at = Date.now();
    setHeard((list) =>
      [
        {
          text: line.text,
          time: new Date(),
          match,
          transcribeMs: line.transcribe_ms,
          audioStart: line.start,
        },
        ...list,
      ].slice(0, 20),
    );
    record("transcript", {
      text: line.text,
      transcribe_ms: line.transcribe_ms,
      match: match && {
        item: match.itemIndex,
        block: match.blockIndex,
        score: Number(match.score.toFixed(2)),
        byTitle: match.byTitle,
      },
    });

    void detectBible(line.text);

    if (!shouldSuggest(match, thresholdRef.current, current, ignoredRef.current, at)) return;

    const item = itemsNow[match.itemIndex];
    const auto =
      autoAdvanceRef.current &&
      !autoHoldRef.current &&
      canAutoAdvanceSong(match, item.type, current, followVerseRef.current);

    if (auto) {
      showRef.current(match.itemIndex, match.blockIndex, "auto");
      setSuggestion(null);
    } else {
      record("suggestion", { item: match.itemIndex, block: match.blockIndex, score: match.score });
      suggest(() => setSuggestion(match));
    }
  });

  const activeSuggestion =
    suggestion &&
    !(suggestion.itemIndex === position?.item && suggestion.blockIndex === position?.block)
      ? suggestion
      : null;

  async function syncOutputFor(itemIndex: number, blockIndex: number) {
    const item = itemsRef.current[itemIndex];
    if (!item || item.output_target === "native") return;
    setOutputError("");
    try {
      await syncExternalOutput(item, blockIndex);
    } catch (e) {
      setOutputError(String(e));
    }
  }

  function show(item: number, block: number, via: ShowVia = "manual") {
    setPosition({ item, block });
    setLayer("live");
    setAdhoc(null);
    record("show", { item, block, title: itemsRef.current[item]?.title, via });
    void syncOutputFor(item, block);
  }

  showRef.current = show;

  function acceptSuggestion() {
    if (!activeSuggestion) return;
    show(activeSuggestion.itemIndex, activeSuggestion.blockIndex, "sugestão");
    setSuggestion(null);
  }

  function ignoreSuggestion() {
    if (!activeSuggestion) return;
    const at = Date.now();
    const { itemIndex, blockIndex } = activeSuggestion;
    record("ignore", { item: itemIndex, block: blockIndex });
    setIgnored((list) => [
      ...list.filter((entry) => at - entry.time < IGNORE_MS),
      { itemIndex, blockIndex, time: at },
    ]);
    setSuggestion(null);
  }

  function showBible(hit: BibleHit) {
    setAdhoc(hit);
    setLayer("live");
    setBibleSuggestion(null);
    record("show_bible", { label: hit.label });
  }

  async function searchBible(query: string) {
    setBibleMessage("");
    const ref: Reference | null = parseReference(query, true);
    if (!ref) {
      setBibleMessage("Referência não reconhecida. Exemplo: Rm 8:28 ou João 3 16.");
      return;
    }
    if (!bibleVersion) {
      setBibleMessage("Nenhuma Bíblia importada. Importe uma em Configurações.");
      return;
    }
    const hit = await lookupBible(ref, bibleVersion);
    if (!hit) {
      setBibleMessage("Versículo não encontrado nesta versão.");
      return;
    }
    showBible(hit);
    setBibleQuery("");
  }

  function acceptAny() {
    if (activeSuggestion) acceptSuggestion();
    else if (bibleSuggestion) showBible(bibleSuggestion);
  }

  function ignoreAny() {
    if (activeSuggestion) ignoreSuggestion();
    else setBibleSuggestion(null);
  }

  const acceptAnyRef = useRef(acceptAny);
  const ignoreAnyRef = useRef(ignoreAny);
  acceptAnyRef.current = acceptAny;
  ignoreAnyRef.current = ignoreAny;

  // Comandos vindos do celular (página de controle remoto).
  useEffect(() => {
    const unlisten = listen<string>("remote-command", (event) => {
      const command = event.payload;
      record("remote_command", { command });
      if (command === "next") nextRef.current();
      else if (command === "previous") previousRef.current();
      else if (command === "black" || command === "clear" || command === "logo") {
        setLayer((value) => (value === command ? "live" : command));
      } else if (command === "live") setLayer("live");
      else if (command === "hold") setAutoHold((value) => !value);
      else if (command === "accept") acceptAnyRef.current();
      else if (command === "ignore") ignoreAnyRef.current();
      else if (command.startsWith("goto:")) {
        const index = Number(command.slice(5));
        const target = itemsRef.current[index];
        if (target && target.type !== "section") showRef.current(index, 0, "remoto");
      }
    });
    return () => {
      unlisten.then((stop) => stop());
    };
  }, []);

  useEffect(() => {
    Promise.all([
      getSetting("confidence_threshold"),
      getSetting("match_window"),
      getSetting("auto_advance_songs"),
      getSetting("follow_verse_auto"),
      getSetting("sync_mode"),
      getSetting("track_min_confidence"),
      getSetting("voice_commands"),
      getSetting("alert_sound"),
      getSetting("bible_detect"),
      getSetting("bible_version"),
      getSetting("logo_path"),
      loadTheme(),
    ]).then(async ([conf, window, auto, follow, mode, trackMin, voice, sound, detect, version, logo, loaded]) => {
      setThreshold(Number(conf) || 0.6);
      setMatchWindow(Number(window) || 3);
      setAutoAdvanceSongs(auto !== "0");
      setFollowVerseAuto(follow !== "0");
      setSyncMode(mode || "hybrid");
      setTrackMinConfidence(Number(trackMin) || 0.3);
      setVoiceCommands(voice === "1");
      setAlertSound(sound !== "0");
      setBibleDetect(detect !== "0");
      setLogoPath(logo);
      setTheme(loaded);
      setBibleVersion(await resolveBibleVersion(version));
    });
    saveBackup("auto").catch(() => {});
    record("start", { service: serviceTitle });
    // O sistema só libera o som depois de um toque ou tecla: prepara o bipe no primeiro.
    const prime = () => {
      try {
        audioContext ??= new AudioContext();
        void audioContext.resume();
      } catch {
        // sem áudio de saída
      }
    };
    window.addEventListener("pointerdown", prime, { once: true });
    window.addEventListener("keydown", prime, { once: true });
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const unlistenTheme = listen<Theme>("theme-changed", (event) => setTheme(event.payload));
    return () => {
      window.clearInterval(timer);
      unlistenTheme.then((stop) => stop());
      record("end", {});
    };
  }, []);

  useEffect(() => {
    const unlisten = listen<string>("track-position", (event) => {
      const data = JSON.parse(event.payload) as {
        pos_ms: number;
        confidence: number;
      };
      const p = positionRef.current;
      const list = itemsRef.current;
      if (!p) return;
      const item = list[p.item];
      if (!item || item.type !== "song") return;
      const timeline = parseTimeline(item.song_timeline_json);
      if (!timeline || data.confidence < trackMinRef.current) return;
      const block = blockIndexForPos(timeline, data.pos_ms);
      setTrackPosMs(data.pos_ms);
      if (block !== p.block && !autoHoldRef.current) showRef.current(p.item, block, "faixa");
    });
    return () => {
      unlisten.then((stop) => stop());
    };
  }, []);

  useEffect(() => {
    void (async () => {
      await invoke("stop_track_sync");
      if (syncMode === "text") return;
      const p = position;
      if (p === null) return;
      const item = items[p.item];
      if (!item || item.type !== "song") return;
      const ref = item.song_reference_audio_path?.trim();
      const timeline = parseTimeline(item.song_timeline_json);
      if (!ref || !timeline) return;
      const device = await getSetting("audio_device");
      const paDelay = Number((await getSetting("pa_delay_ms")) || 0);
      try {
        await invoke("start_track_sync", {
          referencePath: ref,
          songId: item.song_id ?? 0,
          device,
          paDelayMs: paDelay,
        });
      } catch (e) {
        setOutputError(String(e));
      }
    })();
  }, [position?.item, items, syncMode]);

  useEffect(() => {
    return () => {
      void invoke("stop_track_sync");
    };
  }, []);

  useEffect(() => {
    listItems(serviceId).then(async (loaded) => {
      setItems(loaded);
      const first = loaded.findIndex((item) => item.type !== "section");
      let start: Position | null = first >= 0 ? { item: first, block: 0 } : null;

      // Retoma de onde parou se o app foi fechado no meio deste culto.
      try {
        const saved = JSON.parse((await getSetting("last_position")) || "null") as
          | (Position & { serviceId: number })
          | null;
        const valid =
          saved &&
          saved.serviceId === serviceId &&
          loaded[saved.item] &&
          loaded[saved.item].type !== "section" &&
          saved.block < Math.max(1, itemBlocks(loaded[saved.item]).length);
        if (valid) {
          start = { item: saved.item, block: saved.block };
          record("resume", start);
        }
      } catch {
        // posição salva ilegível: começa do primeiro item
      }
      setPosition(start);
    });
  }, [serviceId]);

  useEffect(() => {
    if (!position) return;
    itemStartedAt.current = Date.now();
    void setSetting("last_position", JSON.stringify({ serviceId, ...position }));
  }, [position?.item]);

  useEffect(() => {
    if (position) void setSetting("last_position", JSON.stringify({ serviceId, ...position }));
  }, [position?.block]);

  // Vocabulário do que vem a seguir para o Whisper acertar nomes e termos do culto.
  useEffect(() => {
    if (items.length === 0) return;
    const candidates = buildCandidates(items, position?.item ?? -1, matchWindow);
    const { prompt, hotwords } = buildWhisperContext(
      candidates.map((candidate) => ({ title: candidate.title, text: candidate.blocks.join("\n") })),
    );
    writeWhisperContext(prompt, hotwords).catch(() => {});
  }, [items, position?.item, matchWindow]);

  function next() {
    if (!position) return;
    if (position.block < itemBlocks(items[position.item]).length - 1) {
      show(position.item, position.block + 1);
      return;
    }
    const nextItem = findItemIndex(items, position.item, 1);
    if (nextItem >= 0) show(nextItem, 0);
  }

  function previous() {
    if (!position) return;
    if (position.block > 0) {
      show(position.item, position.block - 1);
      return;
    }
    const previousItem = findItemIndex(items, position.item, -1);
    if (previousItem >= 0) {
      show(previousItem, itemBlocks(items[previousItem]).length - 1);
    }
  }

  nextRef.current = next;
  previousRef.current = previous;

  function toggleLayer(target: Layer) {
    setLayer((value) => (value === target ? "live" : target));
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes((event.target as HTMLElement)?.tagName);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setQuickOpen(true);
        return;
      }
      if (typing || quickOpen) return;

      if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(event.key)) {
        event.preventDefault();
        next();
      } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key)) {
        event.preventDefault();
        previous();
      } else if (event.key.toLowerCase() === "b") {
        toggleLayer("black");
      } else if (event.key.toLowerCase() === "c") {
        toggleLayer("clear");
      } else if (event.key.toLowerCase() === "l") {
        toggleLayer("logo");
      } else if (event.key.toLowerCase() === "p") {
        setAutoHold((value) => !value);
      } else if (event.key === "Enter" && (activeSuggestion || bibleSuggestion)) {
        event.preventDefault();
        if (activeSuggestion) acceptSuggestion();
        else if (bibleSuggestion) showBible(bibleSuggestion);
      } else if (event.key === "Escape" && (activeSuggestion || bibleSuggestion)) {
        event.preventDefault();
        if (activeSuggestion) ignoreSuggestion();
        else setBibleSuggestion(null);
      } else if (event.key === "Escape" && adhoc) {
        setAdhoc(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const current = position ? items[position.item] : null;
  const currentBlocks = current ? itemBlocks(current) : [];

  let slide: Slide | null = null;
  if (layer === "clear") slide = { type: "clear", text: "" };
  else if (layer === "logo") slide = { type: "logo", text: logoPath };
  else if (layer === "live" && adhoc) slide = { type: "text", text: adhoc.text };
  else if (layer === "live" && current) {
    slide = {
      type: current.type,
      text:
        current.type === "image"
          ? current.content
          : (currentBlocks[position?.block ?? 0] ?? ""),
    };
  }
  const slideKey = JSON.stringify(slide);
  const slideRef = useRef(slide);
  slideRef.current = slide;

  useEffect(() => {
    emit("slide", slide);
  }, [slideKey]);

  // Tela de palco: slide atual, o próximo e os tempos.
  function buildStage(): StageInfo {
    let upcoming = "";
    let upcomingTitle = "";
    if (position && current) {
      if (position.block < currentBlocks.length - 1) {
        upcoming = blockLabel(current, currentBlocks[position.block + 1]);
      } else {
        const nextIndex = findItemIndex(items, position.item, 1);
        if (nextIndex >= 0) {
          upcomingTitle = items[nextIndex].song_title ?? items[nextIndex].title;
          upcoming = blockLabel(items[nextIndex], itemBlocks(items[nextIndex])[0] ?? "");
        } else {
          upcomingTitle = "fim do culto";
        }
      }
    }
    return {
      title: adhoc ? adhoc.label : current ? (current.song_title ?? current.title) : "",
      current: adhoc
        ? adhoc.text
        : current
          ? blockLabel(current, currentBlocks[position?.block ?? 0] ?? "")
          : "",
      next: upcoming,
      nextTitle: upcomingTitle,
      itemStartedAt: itemStartedAt.current,
      serviceStartedAt: serviceStartedAt.current,
      plannedSec: current?.external_ref.plannedDurationSec,
    };
  }
  const stageRef = useRef(buildStage);
  stageRef.current = buildStage;
  const stageKey = JSON.stringify([position, adhoc?.key, items.length]);

  useEffect(() => {
    emit("stage", stageRef.current());
  }, [stageKey]);

  // Estado para as páginas remotas (celular, OBS, legendas).
  const suggestionLabel = activeSuggestion
    ? `${matchName(activeSuggestion, items)} · ${matchWhere(activeSuggestion, items)}`
    : bibleSuggestion
      ? bibleSuggestion.label
      : "";
  const remoteKey = JSON.stringify([
    slide, layer, theme, position, autoHold, listener.status, suggestionLabel, caption.id, items.length,
  ]);
  useEffect(() => {
    void pushRemoteState({
      service: serviceTitle,
      slide,
      layer,
      theme,
      next: buildStage().next,
      item: position?.item ?? -1,
      items: items
        .map((item, i) => ({ i, title: item.song_title ? `${item.title} — ${item.song_title}` : item.title, type: item.type }))
        .filter((entry) => entry.type !== "section")
        .map(({ i, title }) => ({ i, title })),
      hold: autoHold,
      listening: listener.status === "escutando",
      suggestion: suggestionLabel,
      caption: caption.text,
      captionId: caption.id,
    });
  }, [remoteKey]);

  useEffect(() => {
    return () => {
      void pushRemoteState({});
    };
  }, []);

  useEffect(() => {
    const unlisten = [
      listen("projector-ready", () => emit("slide", slideRef.current)),
      listen("projector-closed", () => setProjectorOpen(false)),
      listen("stage-ready", () => emit("stage", stageRef.current())),
      listen("stage-closed", () => setStageOpen(false)),
    ];
    return () => {
      unlisten.forEach((promise) => promise.then((stop) => stop()));
      invoke("close_projector");
      invoke("close_stage");
    };
  }, []);

  async function toggleProjector() {
    setProjectorError("");
    try {
      if (projectorOpen) {
        await invoke("close_projector");
        setProjectorOpen(false);
      } else {
        await invoke("open_projector");
        setProjectorOpen(true);
      }
    } catch (e) {
      setProjectorError(String(e));
    }
  }

  async function toggleStage() {
    setProjectorError("");
    try {
      if (stageOpen) {
        await invoke("close_stage");
        setStageOpen(false);
      } else {
        await invoke("open_stage");
        setStageOpen(true);
      }
    } catch (e) {
      setProjectorError(String(e));
    }
  }

  async function restartListening() {
    await listener.stop();
    await listener.start();
  }

  // Saúde da escuta: o operador precisa saber por que nada está sendo sugerido.
  if (listener.level > 0.004) levelHighAt.current = now;
  const silentSeconds = Math.round((now - levelHighAt.current) / 1000);
  const sinceTranscript = listener.lastTranscriptAt
    ? Math.round((now - listener.lastTranscriptAt) / 1000)
    : null;
  const listening = listener.status === "escutando";
  const healthWarning = !listening
    ? ""
    : silentSeconds >= 15
      ? `Sem sinal do microfone há ${silentSeconds}s. Confira o cabo, a mesa e o dispositivo em Configurações.`
      : listener.lagSeconds >= 3
        ? `Transcrição atrasada em ${listener.lagSeconds.toFixed(1)}s. Use um modelo menor ou aumente o bloco.`
        : "";

  const nextPreview = buildStage();

  return (
    <div className="columns">
      <aside className="run-sequence">
        <h3>{serviceTitle}</h3>
        <ol className="items">
          {items.map((item, index) =>
            item.type === "section" ? (
              <li key={item.id} className="item-section">
                {item.title}
              </li>
            ) : (
              <li
                key={item.id}
                className={index === position?.item ? "selected" : ""}
                onClick={() => show(index, 0)}
              >
                {item.title}
                {item.song_title && <span className="hint"> — {item.song_title}</span>}
              </li>
            ),
          )}
        </ol>
      </aside>

      <section className="run-main">
        <PresentationScreen slide={slide} theme={theme} />

        <div className="next-preview">
          <span className="hint">
            A seguir{nextPreview.nextTitle ? `: ${nextPreview.nextTitle}` : ""}
          </span>
          <div>{nextPreview.next || "—"}</div>
        </div>

        <div className="actions run-controls">
          <button onClick={previous}>◀ Voltar</button>
          <button onClick={next}>Avançar ▶</button>
          <button className={layer === "black" ? "active" : ""} onClick={() => toggleLayer("black")}>
            {layer === "black" ? "Mostrar" : "Preto"} (B)
          </button>
          <button className={layer === "clear" ? "active" : ""} onClick={() => toggleLayer("clear")}>
            Limpar texto (C)
          </button>
          <button className={layer === "logo" ? "active" : ""} onClick={() => toggleLayer("logo")}>
            Logo (L)
          </button>
          <button className={projectorOpen ? "active" : ""} onClick={toggleProjector}>
            {projectorOpen ? "Fechar projetor" : "📽 Abrir projetor"}
          </button>
          <button className={stageOpen ? "active" : ""} onClick={toggleStage}>
            {stageOpen ? "Fechar palco" : "🎤 Abrir palco"}
          </button>
          <button className="exit" onClick={onExit}>
            Sair da execução
          </button>
        </div>
        <p className="hint">
          Setas: avançar/voltar · Ctrl+K: buscar · P: auto {autoHold ? "pausado" : "ligado"}
          {trackPosMs !== null && ` · track ${trackPosMs}ms`}
          {adhoc && " · versículo na tela (Esc para voltar)"}
        </p>
        {projectorError && <p className="warning">{projectorError}</p>}
        {outputError && <p className="warning">{outputError}</p>}

        {activeSuggestion && (
          <div className="suggestion">
            <div className="suggestion-text">
              <span className="hint">Possível item:</span>
              <strong>{matchName(activeSuggestion, items)}</strong>
              <span>{matchWhere(activeSuggestion, items)}</span>
              <span className="hint">Confiança: {Math.round(activeSuggestion.score * 100)}%</span>
            </div>
            <div className="actions">
              <button className="primary" onClick={acceptSuggestion}>
                MOSTRAR
              </button>
              <button onClick={ignoreSuggestion}>IGNORAR</button>
              <span className="hint">Enter / Esc</span>
            </div>
          </div>
        )}

        {bibleSuggestion && (
          <div className="suggestion">
            <div className="suggestion-text">
              <span className="hint">Versículo citado:</span>
              <strong>{bibleSuggestion.label}</strong>
              <span className="bible-preview">{bibleSuggestion.text.split("\n\n")[0]}</span>
            </div>
            <div className="actions">
              <button className="primary" onClick={() => showBible(bibleSuggestion)}>
                MOSTRAR
              </button>
              <button onClick={() => setBibleSuggestion(null)}>IGNORAR</button>
              {!activeSuggestion && <span className="hint">Enter / Esc</span>}
            </div>
          </div>
        )}

        <div className="listener">
          <div className="actions">
            {listener.status === "parado" && <button onClick={listener.start}>🎤 Ouvir</button>}
            {listener.status === "carregando" && <button disabled>Carregando modelo...</button>}
            {listening && (
              <button className="active" onClick={listener.stop}>
                ⏸ Pausar escuta
              </button>
            )}
            {listener.status !== "parado" && (
              <button onClick={restartListening}>↻ Reiniciar</button>
            )}
            <button className={autoHold ? "active" : ""} onClick={() => setAutoHold(!autoHold)}>
              Auto: {autoHold ? "pausado" : "ligado"}
            </button>
            <div className="meter" title="Volume do microfone">
              <div
                className={`meter-bar${silentSeconds >= 15 && listening ? " meter-dead" : ""}`}
                style={{ width: `${Math.min(100, Math.round(listener.level * 800))}%` }}
              />
            </div>
            <span className="hint">
              {listening
                ? sinceTranscript === null
                  ? "Escutando, aguardando a primeira fala"
                  : `Última fala há ${sinceTranscript}s`
                : "Escuta pausada"}
            </span>
          </div>
          {listener.error && <p className="warning">{listener.error}</p>}
          {healthWarning && <p className="warning">⚠ {healthWarning}</p>}
          <ul className="transcripts">
            {heard.map((entry, index) => (
              <li key={entry.time.getTime() + index}>
                <span className="hint">{entry.time.toLocaleTimeString()}</span>
                {entry.audioStart !== undefined && (
                  <span className="hint"> áudio {entry.audioStart.toFixed(1)}s</span>
                )}
                {entry.transcribeMs !== undefined && (
                  <span className="hint"> · whisper {entry.transcribeMs}ms</span>
                )}{" "}
                {entry.text}
                <br />
                {entry.match ? (
                  <span className={entry.match.score >= threshold ? "match" : "hint"}>
                    → {describeMatch(entry.match, items)}
                    {entry.match.score < threshold && " (abaixo do limite)"}
                  </span>
                ) : (
                  <span className="hint">→ sem correspondência</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <form
          className="bible-box"
          onSubmit={(event) => {
            event.preventDefault();
            void searchBible(bibleQuery);
          }}
        >
          <input
            value={bibleQuery}
            onChange={(event) => setBibleQuery(event.target.value)}
            placeholder={bibleVersion ? `📖 Versículo (${bibleVersion}): Rm 8:28, João 3 16...` : "📖 Importe uma Bíblia em Configurações"}
            disabled={!bibleVersion}
          />
          <button type="submit" disabled={!bibleVersion || !bibleQuery.trim()}>
            Mostrar
          </button>
          {bibleMessage && <span className="warning">{bibleMessage}</span>}
        </form>

        {current && currentBlocks.length > 1 && (
          <ol className="run-blocks">
            {currentBlocks.map((block, index) => (
              <li
                key={index}
                className={index === position?.block ? "selected" : ""}
                onClick={() => show(position!.item, index)}
              >
                {block}
              </li>
            ))}
          </ol>
        )}
      </section>

      {quickOpen && (
        <QuickSearch
          items={items}
          onPickItem={(index) => show(index, 0, "busca")}
          onPickBible={(query) => void searchBible(query)}
          onClose={() => setQuickOpen(false)}
        />
      )}
    </div>
  );
}

export default ExecutePage;
