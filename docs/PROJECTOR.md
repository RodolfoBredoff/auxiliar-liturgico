# Próxima etapa — Janela de projetor

**Implementado** (DEC-026). Decisões tomadas: a prévia 16:9 continua na janela do operador, e o projetor só abre manualmente.

Substitui a DEC-017 (apresentação só dentro da janela do operador).

Implementação: `src/PresentationScreen.tsx` (desenho do slide), `src/ProjectorPage.tsx` (janela do projetor), `open_projector` e `close_projector` em `src-tauri/src/lib.rs`. A janela é identificada pelo label `projector` em `main.tsx`, sem rota.

---

## 1. Objetivo

Durante a **execução** do culto, o operador continua na janela principal (sequência, escuta, sugestões, controles).

A **congregação** vê só o conteúdo do slide — letra, texto, imagem ou tela preta — em uma **segunda janela**, preferencialmente **tela cheia no monitor do projetor**.

O operador é quem avança, volta e esconde. A janela do projetor **não** tem botões nem escuta.

---

## 2. O que já existe (reaproveitar)

| Peça | Onde |
| --- | --- |
| Um slide = um bloco de letra/texto | `blocks.ts` (`splitBlocks`, `itemBlocks`) |
| Desenho do slide (texto, imagem, branco) | `ExecutePage.tsx` → `Screen`, `ImageScreen` |
| Estado da execução (item, bloco, escondido) | `ExecutePage` (`position`, `hidden`, `items`) |
| Imagens locais | `convertFileSrc` + `assetProtocol` (DEC / etapa 10) |

Não é necessário novo tipo de item nem mudança no banco.

---

## 3. O que **não** entra nesta etapa

Alinhado a `docs/MVP.md`:

- OBS, OpenLP, ProPresenter, streaming
- Transições, animações, vídeo
- Controle pelo projetor (toque, teclado na segunda tela)
- Sincronização automática com o áudio (só espelha o que o operador já escolheu)
- Editor de slide no projetor

---

## 4. Experiência do operador

### 4.1 Fluxo

1. Operador clica em **▶ Executar** (como hoje).
2. Novo botão: **Abrir projetor** (ou **Projetor ▶**).
3. Abre a janela do projetor (segundo monitor, se existir).
4. Cada **Avançar**, **Voltar**, **Esconder**, **MOSTRAR** (sugestão) ou clique na sequência atualiza **as duas** telas.
5. **Fechar projetor** ou **Sair da execução** encerra a janela do projetor.

### 4.2 Janela principal

- Mantém sequência, escuta, transcrições, sugestões e controles.
- A área preta 16:9 pode permanecer como **prévia pequena** (recomendado) ou ser ocultada quando o projetor estiver aberto — decisão na implementação; prévia evita surpresa se o projetor falhar.

### 4.3 Janela do projetor

- Fundo preto, texto branco grande, mesma regra de quebra de linha da letra.
- Imagem: `object-fit: contain`, tela cheia.
- **Esconder** = tela preta no projetor também.
- Sem barra de título idealmente (modo apresentação / fullscreen).

### 4.4 Teclado

- Atalhos (setas, B, Enter, Esc) continuam valendo **só** na janela do operador (foco na janela principal).

---

## 5. Arquitetura proposta

```text
ExecutePage (janela main)
   │
   │  estado: { hidden, itemType, text, imagePath }
   │
   ├──► Screen (prévia local, opcional)
   │
   └──► emit("slide", payload)  ──►  ProjectorPage (janela projector)
                                         └── Screen (mesmo visual, só leitura)
```

### 5.1 Sincronização

**Opção escolhida (simples):** evento Tauri `slide` (ou `presentation-state`) da janela main para a janela `projector`.

- Payload mínimo, serializável:

```json
{
  "hidden": false,
  "type": "song",
  "text": "Dos montes correm para o mar\n...",
  "imagePath": ""
}
```

- Ao abrir o projetor, a main **reenvia** o estado atual (slide não fica desatualizado).
- Se a janela do projetor fechar (operador fechou no macOS), a main detecta e desliga o botão “Abrir projetor”.

**Alternativa descartada por enquanto:** compartilhar estado via Rust global — mais código, mesmo efeito.

### 5.2 Componente compartilhado

Extrair `Screen` + `ImageScreen` para algo como `src/PresentationScreen.tsx`, usado em `ExecutePage` e na rota/página do projetor. Evita duplicar CSS e regras de imagem.

### 5.3 Segunda janela no Tauri 2

- Criar janela com label fixo `projector` na primeira abertura; reutilizar se já existir.
- URL: mesma app Vite, rota dedicada, por exemplo `/projector` (React Router leve **ou** segundo entry `projector.html` — preferir **uma rota** para não duplicar build).
- Permissões: incluir a janela `projector` na capability `default` (mesmas permissões de imagem que a main).

### 5.4 Monitor externo

1. **MVP desta etapa:** botão “Abrir projetor” + janela em **fullscreen**; o operador arrasta para o monitor correto se o macOS abrir no errado (aceitável na v1).
2. **Melhoria imediata se der pouco trabalho:** usar API de monitores do Tauri para posicionar a janela no **monitor que não é o principal** (`availableMonitors`, `currentMonitor`).
3. **Depois:** setting `projector_monitor_index` em `settings` (sem tela de config: editar no banco ou campo simples na execução).

---

## 6. Implementação em sub-etapas

Ordem sugerida (cada uma: explicar → implementar → testar → informar):

| # | Entrega | Critério de pronto |
| --- | --- | --- |
| **P1** | Rota `/projector` + `PresentationScreen` extraído | Projetor abre na mesma tela que a main e mostra o mesmo slide ao avançar |
| **P2** | Botões Abrir/Fechar projetor + evento `slide` | Fechar execução mata o projetor; estado inicial correto ao abrir |
| **P3** | Fullscreen + tentativa de monitor secundário | Em Mac com dois monitores, slide aparece no projetor em tela cheia |
| **P4** | Ajustes de UX e docs | Manual atualizado; DEC-017 marcada como superseded por nova DEC |

Testes automatizados: só o que já existe (matching); esta etapa testa-se **manualmente** com dois monitores ou “Simular tela externa” no macOS.

---

## 7. Riscos

| Risco | Mitigação |
| --- | --- |
| macOS abre projetor no monitor errado | P2/P3: posicionar por monitor; manual explica arrastar uma vez |
| Imagem não carrega no projetor | Mesmo `convertFileSrc` e escopo `$HOME/**`; testar nos dois webviews |
| Duas janelas dessincronizadas | Single source of truth na main; projetor só escuta eventos |
| Operador fecha projetor sem querer | Botão “Reabrir projetor”; main continua funcionando |
| `npm run tauri dev` vs app empacotado | Testar nos dois; empacotado precisa mesma rota no `dist` |

---

## 8. Documentação a atualizar na implementação

- `docs/PRESENTATION.md` — seção “Onde”
- `docs/MANUAL.md` — seção execução / projetor
- `docs/DECISIONS.md` — nova DEC (ex.: DEC-026 janela de projetor)
- `PROMPT_MESTRE.md` — etapa 13 opcional “Projetor”

---

## 9. Critério de sucesso desta etapa

Com dois monitores (ou simulado):

1. Operador executa culto, abre projetor, canta/avanca letra bloco a bloco.
2. Congregação vê **somente** slide em tela cheia, sem UI do app.
3. Esconder deixa projetor preto; MOSTRAR após sugestão atualiza projetor e prévia.
4. Nenhuma regressão na escuta/sugestão.

Isso completa o uso real na igreja sem depender de espelhar a janela inteira do operador.
