import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, Update } from "@tauri-apps/plugin-updater";
import { useEffect, useState } from "react";
import { parseBible } from "./bible";
import { importBible, listBibleVersions, listServices, getSetting, setSetting, Service } from "./db";
import { dataFile, exportServiceLog, readTextFile, restoreBackup, saveBackup } from "./files";
import PresentationScreen from "./PresentationScreen";
import PythonSetup from "./PythonSetup";
import { ensureRemoteToken, remoteInfo, RemoteInfo, remoteUrls, startRemote, stopRemote } from "./remote";
import { DEFAULT_THEME, FONT_CHOICES, loadTheme, saveTheme, Theme } from "./theme";

const KEYS = [
  "whisper_model",
  "audio_device",
  "confidence_threshold",
  "match_window",
  "block_seconds",
  "block_overlap",
  "pause_segmentation",
  "auto_advance_songs",
  "follow_verse_auto",
  "alert_sound",
  "voice_commands",
  "sync_mode",
  "pa_delay_ms",
  "track_min_confidence",
  "bible_detect",
  "bible_version",
  "logo_path",
  "remote_enabled",
  "remote_port",
] as const;

type Key = (typeof KEYS)[number];

const DEFAULTS: Record<Key, string> = {
  whisper_model: "small",
  audio_device: "",
  confidence_threshold: "0.6",
  match_window: "3",
  block_seconds: "3",
  block_overlap: "1",
  pause_segmentation: "0",
  auto_advance_songs: "1",
  follow_verse_auto: "1",
  alert_sound: "1",
  voice_commands: "0",
  sync_mode: "hybrid",
  pa_delay_ms: "0",
  track_min_confidence: "0.3",
  bible_detect: "1",
  bible_version: "",
  logo_path: "",
  remote_enabled: "0",
  remote_port: "8765",
};

const MODELS = ["tiny", "base", "small", "medium", "large-v3", "turbo"];

function SettingsPage() {
  const [values, setValues] = useState<Record<Key, string>>(DEFAULTS);
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [versions, setVersions] = useState<string[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [message, setMessage] = useState("");
  const [biblePath, setBiblePath] = useState("");
  const [bibleName, setBibleName] = useState("");
  const [restorePath, setRestorePath] = useState("");
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [remote, setRemote] = useState<RemoteInfo | null>(null);
  const [token, setToken] = useState("");
  const [version, setVersion] = useState("");
  const [update, setUpdate] = useState<Update | null>(null);

  useEffect(() => {
    void (async () => {
      const loaded = { ...DEFAULTS };
      for (const key of KEYS) {
        const value = await getSetting(key);
        if (value !== "") loaded[key] = value;
      }
      setValues(loaded);
      setTheme(await loadTheme());
      setVersions(await listBibleVersions());
      setServices(await listServices());
      setToken(await ensureRemoteToken());
      setVersion(await getVersion().catch(() => ""));
      setRemote(await remoteInfo());
    })();
  }, []);

  async function set(key: Key, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    await setSetting(key, value);
  }

  async function changeTheme(patch: Partial<Theme>) {
    const next = { ...theme, ...patch };
    setTheme(next);
    await saveTheme(next);
  }

  async function run(label: string, action: () => Promise<string>) {
    setBusy(true);
    setMessage(`${label}...`);
    try {
      setMessage(await action());
    } catch (e) {
      setMessage(`Erro: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function checkForUpdate() {
    await run("Procurando atualização", async () => {
      const found = await check();
      setUpdate(found);
      return found
        ? `Versão ${found.version} disponível.`
        : "Você já está na versão mais recente.";
    });
  }

  async function installUpdate() {
    if (!update) return;
    await run("Baixando e instalando", async () => {
      await update.downloadAndInstall();
      await relaunch();
      return "Atualizado. Reiniciando...";
    });
  }

  async function toggleRemote(enabled: boolean) {
    await set("remote_enabled", enabled ? "1" : "0");
    try {
      if (enabled) setRemote(await startRemote());
      else {
        await stopRemote();
        setRemote(await remoteInfo());
      }
    } catch (e) {
      setMessage(`Erro: ${String(e)}`);
      await set("remote_enabled", "0");
    }
  }

  const flag = (key: Key, label: string, hint?: string) => (
    <label className="check">
      <input
        type="checkbox"
        checked={values[key] === "1"}
        onChange={(e) => void set(key, e.target.checked ? "1" : "0")}
      />
      <span>
        {label}
        {hint && <span className="hint"> {hint}</span>}
      </span>
    </label>
  );

  const field = (key: Key, label: string, hint?: string, type = "text") => (
    <label>
      {label} {hint && <span className="hint">{hint}</span>}
      <input
        type={type}
        value={values[key]}
        onChange={(e) => setValues((current) => ({ ...current, [key]: e.target.value }))}
        onBlur={(e) => void set(key, e.target.value)}
      />
    </label>
  );

  return (
    <div className="settings">
      {message && <p className="notice">{message}</p>}

      <h2>Reconhecimento de voz (Python)</h2>
      <PythonSetup />

      <h2>Reconhecimento de áudio</h2>
      <p className="hint">Mudanças em modelo, dispositivo e blocos valem na próxima vez que clicar em Ouvir.</p>
      <div className="grid">
        <label>
          Modelo do Whisper <span className="hint">(maior = mais preciso e mais lento)</span>
          <select value={values.whisper_model} onChange={(e) => void set("whisper_model", e.target.value)}>
            {[...new Set([values.whisper_model, ...MODELS])].map((model) => (
              <option key={model}>{model}</option>
            ))}
          </select>
        </label>
        {field("audio_device", "Dispositivo de áudio", "(número ou nome; vazio = padrão do sistema)")}
        {field("block_seconds", "Tamanho do bloco (s)", undefined, "number")}
        {field("block_overlap", "Sobreposição (s)", undefined, "number")}
        {field("confidence_threshold", "Confiança mínima (0 a 1)", "(menor sugere mais)", "number")}
        {field("match_window", "Itens à frente considerados", undefined, "number")}
      </div>
      {flag("pause_segmentation", "Cortar o áudio nas pausas da fala", "(bom para leitura e pregação; no canto contínuo, mantenha desligado)")}
      {flag("auto_advance_songs", "Avançar músicas automaticamente")}
      {flag("follow_verse_auto", "Acompanhar a estrofe seguinte sozinho")}
      {flag("alert_sound", "Bipe quando houver sugestão")}
      {flag("voice_commands", "Comandos de voz", "(diga “próximo slide”, “slide anterior”, “esconder tela”, “mostrar tela”)")}
      <div className="grid">
        <label>
          Sincronia com faixa
          <select value={values.sync_mode} onChange={(e) => void set("sync_mode", e.target.value)}>
            <option value="hybrid">Híbrido (faixa + texto)</option>
            <option value="text">Só texto</option>
          </select>
        </label>
        {field("pa_delay_ms", "Atraso da caixa de som (ms)", undefined, "number")}
        {field("track_min_confidence", "Confiança mínima da faixa", undefined, "number")}
      </div>

      <h2>Aparência da projeção</h2>
      <div className="theme-editor">
        <div className="grid">
          <label>
            Fonte
            <select value={theme.fontFamily} onChange={(e) => void changeTheme({ fontFamily: e.target.value })}>
              {FONT_CHOICES.map((font) => (
                <option key={font.label} value={font.value}>
                  {font.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tamanho do texto ({theme.fontSize}% da altura)
            <input
              type="range"
              min={4}
              max={16}
              value={theme.fontSize}
              onChange={(e) => void changeTheme({ fontSize: Number(e.target.value) })}
            />
          </label>
          <label>
            Margem ({theme.margin}%)
            <input
              type="range"
              min={0}
              max={20}
              value={theme.margin}
              onChange={(e) => void changeTheme({ margin: Number(e.target.value) })}
            />
          </label>
          <label>
            Cor do texto
            <input type="color" value={theme.color} onChange={(e) => void changeTheme({ color: e.target.value })} />
          </label>
          <label>
            Cor de fundo
            <input
              type="color"
              value={theme.background}
              onChange={(e) => void changeTheme({ background: e.target.value })}
            />
          </label>
          <label>
            Imagem de fundo <span className="hint">(caminho; vazio = cor)</span>
            <input
              value={theme.backgroundImage}
              onChange={(e) => setTheme({ ...theme, backgroundImage: e.target.value })}
              onBlur={(e) => void changeTheme({ backgroundImage: e.target.value.trim() })}
            />
          </label>
          <label>
            Alinhamento
            <select
              value={theme.align}
              onChange={(e) => void changeTheme({ align: e.target.value as Theme["align"] })}
            >
              <option value="center">Centralizado</option>
              <option value="left">À esquerda</option>
            </select>
          </label>
          {field("logo_path", "Logotipo (tecla L)", "(caminho da imagem)")}
        </div>
        <label className="check">
          <input type="checkbox" checked={theme.shadow} onChange={(e) => void changeTheme({ shadow: e.target.checked })} />
          <span>Sombra no texto</span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={theme.uppercase}
            onChange={(e) => void changeTheme({ uppercase: e.target.checked })}
          />
          <span>Tudo em maiúsculas</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={theme.fade} onChange={(e) => void changeTheme({ fade: e.target.checked })} />
          <span>Transição suave entre telas</span>
        </label>
        <div className="actions">
          <button onClick={() => void changeTheme({ ...DEFAULT_THEME })}>Restaurar padrão</button>
        </div>
        <div className="theme-preview">
          <PresentationScreen
            theme={theme}
            slide={{
              type: "song",
              text: "Dos montes correm para o mar\nTeu rio de amor por mim\nEu abrirei meu coração\nDeixando a tua cura entrar",
            }}
          />
        </div>
      </div>

      <h2>Bíblia</h2>
      <p className="hint">
        O app não traz texto bíblico. Importe um arquivo com a tradução que a igreja tem direito de usar:
        JSON (66 livros com <code>chapters</code>) ou texto com uma linha por versículo
        (<code>Gênesis 1:1 No princípio...</code>).
      </p>
      <p>
        Versões instaladas: {versions.length ? versions.join(", ") : <span className="hint">nenhuma</span>}
      </p>
      <div className="grid">
        <label>
          Nome da versão
          <input value={bibleName} onChange={(e) => setBibleName(e.target.value)} placeholder="ARA" />
        </label>
        <label>
          Arquivo
          <input value={biblePath} onChange={(e) => setBiblePath(e.target.value)} placeholder="~/Downloads/biblia.json" />
        </label>
        <label>
          Versão usada na execução
          <select value={values.bible_version} onChange={(e) => void set("bible_version", e.target.value)}>
            <option value="">Primeira instalada</option>
            {versions.map((version) => (
              <option key={version}>{version}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="actions">
        <button
          disabled={busy || !bibleName.trim() || !biblePath.trim()}
          onClick={() =>
            run("Importando Bíblia (pode levar alguns segundos)", async () => {
              const rows = parseBible(await readTextFile(biblePath.trim()));
              await importBible(bibleName.trim(), rows);
              setVersions(await listBibleVersions());
              return `${bibleName.trim()} importada: ${rows.length} versículos.`;
            })
          }
        >
          Importar Bíblia
        </button>
      </div>
      {flag("bible_detect", "Detectar versículos citados na fala", "(sugere na tela do operador; nunca mostra sozinho)")}

      <h2>Celular, OBS e legendas</h2>
      <p className="hint">
        Liga um servidor local protegido por código. O celular precisa estar na mesma rede Wi-Fi. Na primeira vez o
        macOS pergunta se o app pode receber conexões: permita.
      </p>
      <label className="check">
        <input type="checkbox" checked={values.remote_enabled === "1"} onChange={(e) => void toggleRemote(e.target.checked)} />
        <span>Ativar controle remoto, sobreposição para OBS e legendas ao vivo</span>
      </label>
      {values.remote_enabled === "1" && remote?.running && (
        <ul className="url-list">
          <li>
            <strong>Controle pelo celular</strong> (abra no navegador do celular)
            <code>{remoteUrls(remote, token).control}</code>
          </li>
          <li>
            <strong>Sobreposição para OBS</strong> (Fonte de navegador, 1920×1080, fundo transparente)
            <code>{remoteUrls(remote, token).overlay}</code>
          </li>
          <li>
            <strong>Legendas ao vivo</strong> (tela, tablet ou OBS; acrescente <code>&amp;bg=transparent</code> para fundo transparente)
            <code>{remoteUrls(remote, token).captions}</code>
          </li>
        </ul>
      )}
      <div className="grid">{field("remote_port", "Porta", "(reinicie a opção acima ao mudar)", "number")}</div>

      <h2>Atualizações</h2>
      <p className="hint">Versão instalada: {version || "—"}. A atualização é baixada do GitHub e conferida por assinatura digital.</p>
      <div className="actions">
        <button disabled={busy} onClick={checkForUpdate}>
          Verificar atualizações
        </button>
        {update && (
          <button className="primary" disabled={busy} onClick={installUpdate}>
            Instalar versão {update.version} e reiniciar
          </button>
        )}
      </div>

      <h2>Dados e backup</h2>
      <p className="hint">
        Um backup automático do dia é gravado ao iniciar cada execução. Pasta de dados:{" "}
        <button
          className="link"
          onClick={() => run("Localizando", async () => `Pasta de dados: ${(await dataFile("x")).replace(/[\\/]x$/, "")}`)}
        >
          mostrar caminho
        </button>
      </p>
      <div className="actions">
        <button disabled={busy} onClick={() => run("Salvando backup", async () => `Backup salvo em ${await saveBackup("manual")}`)}>
          Fazer backup agora
        </button>
      </div>
      <div className="grid">
        <label>
          Restaurar de um arquivo de backup
          <input
            value={restorePath}
            onChange={(e) => {
              setRestorePath(e.target.value);
              setConfirmRestore(false);
            }}
            placeholder="caminho do backup-AAAAMMDD-HHMMSS.json"
          />
        </label>
      </div>
      <div className="actions">
        <button
          className="danger"
          disabled={busy || !restorePath.trim()}
          onClick={() => {
            if (!confirmRestore) {
              setConfirmRestore(true);
              setMessage("Isto substitui todas as músicas e cultos atuais. Clique de novo para confirmar.");
              return;
            }
            setConfirmRestore(false);
            void run("Restaurando", async () => {
              const safety = await restoreBackup(restorePath.trim());
              return `Restaurado. Os dados anteriores ficaram em ${safety}`;
            });
          }}
        >
          {confirmRestore ? "Confirmar restauração" : "Restaurar"}
        </button>
      </div>

      <h3>Registro dos cultos</h3>
      <p className="hint">Tudo o que foi ouvido, sugerido e mostrado fica gravado. Exporte para analisar acertos e ajustar a confiança mínima.</p>
      <ul className="log-list">
        {services.slice(0, 10).map((service) => (
          <li key={service.id}>
            {service.title}{" "}
            <button
              disabled={busy}
              onClick={() => run("Exportando", async () => `Registro salvo em ${await exportServiceLog(service.id)}`)}
            >
              Exportar registro
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default SettingsPage;
