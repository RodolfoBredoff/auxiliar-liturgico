# Decisions

## DEC-001 — Aplicação desktop

O projeto será inicialmente uma aplicação desktop.

### Motivo

O uso principal acontece durante um culto em um computador local.

Não existe necessidade de cloud no MVP.

---

## DEC-002 — Tauri + React

Usaremos:

* Tauri
* React
* TypeScript

### Motivo

Permite criar uma aplicação desktop mantendo uma interface simples de desenvolver.

---

## DEC-003 — SQLite

Usaremos SQLite.

### Motivo

O MVP precisa de um banco local simples.

Não existe necessidade de:

* PostgreSQL
* servidor de banco
* Redis

---

## DEC-004 — Offline-first

O funcionamento principal deve ocorrer localmente.

### Motivo

O aplicativo não deve depender da internet para funcionar durante o culto.

---

## DEC-005 — faster-whisper

Usaremos faster-whisper para a primeira experiência de transcrição.

### Motivo

Precisamos testar transcrição local sem depender de uma API externa.

---

## DEC-006 — IA não decide livremente o culto

A IA não deve inventar ações ou conteúdo.

Ela recebe o áudio e ajuda a identificar conteúdo previamente preparado.

### Motivo

O sistema deve ser previsível.

---

## DEC-007 — Operador mantém controle

O primeiro MVP não executará automaticamente as sugestões.

O operador deverá confirmar.

### Motivo

Estamos validando a tecnologia antes de permitir automação.

---

## DEC-008 — Matching simples

Começar com comparação textual simples.

Não usar inicialmente:

* embeddings
* RAG
* LLM
* arquitetura complexa

### Motivo

Queremos testar a hipótese com o menor custo possível.

---

## DEC-009 — Renderer próprio simples

O MVP terá apresentação própria.

### Motivo

Não queremos depender de outro software para validar a hipótese principal.

Integrações poderão ser adicionadas posteriormente.

---

## DEC-010 — Sem arquitetura empresarial

Não criar:

* microserviços
* servidores distribuídos
* Docker
* Kubernetes
* sistemas de autenticação
* multi-tenant

### Motivo

O projeto é experimental e interno.

---

## DEC-011 — Desenvolvimento incremental

Cada funcionalidade será implementada somente quando a anterior estiver funcionando.

### Motivo

Queremos detectar rapidamente o que funciona e o que não funciona.

---

## DEC-012 — Não otimizar para escala

O sistema não será projetado para atender milhares de igrejas ou usuários.

### Motivo

Essa não é a finalidade atual do projeto.

Se o projeto futuramente se tornar um produto comercial, a arquitetura poderá ser revista.

---

## DEC-013 — Script Python local para o áudio

O faster-whisper roda em um único script Python local, iniciado pelo Tauri.

O script captura o microfone, transcreve e escreve uma linha JSON por bloco na saída padrão.

Não é um backend: não escuta rede, não acessa o banco e não faz matching.

No MVP usa o Python instalado no computador, sem empacotamento.

### Motivo

faster-whisper só existe em Python. Esta é a forma mais simples de usá-lo a partir do Tauri.

---

## DEC-014 — Matching em TypeScript

Normalização, matching e sugestão rodam na aplicação (TypeScript), não no script Python.

### Motivo

A aplicação já tem acesso ao banco e à sequência. O script Python fica pequeno e com uma única responsabilidade.

---

## DEC-015 — Matching restrito à sequência, com identificação de trecho

A transcrição é comparada somente com o item atual e os próximos itens com texto da sequência.

O resultado indica item e trecho (bloco).

Músicas fora da sequência não são detectadas no MVP.

### Motivo

Comparar com poucos candidatos é mais simples e mais preciso do que comparar com todo o cadastro.

---

## DEC-016 — Blocos por linha em branco

Letras e textos são divididos em blocos por linha em branco. Os blocos não são armazenados em tabela própria.

### Motivo

Permite avançar por estrofe e identificar trecho sem criar novas entidades.

---

## DEC-017 — Apresentação na mesma janela (substituída pela DEC-026)

A apresentação é uma área dentro da janela principal.

### Motivo

Suficiente para validar a hipótese. Janela de projetor fica para depois.

---

## DEC-018 — Ciclos como item `section`

Os ciclos da liturgia são itens do tipo `section` em `service_items`, sem tabela própria.

Duplicar um culto substitui modelos de culto.

### Motivo

A liturgia se repete toda semana. Duplicar resolve sem criar entidades novas.

---

## DEC-019 — Primeiro validar o faster-whisper isoladamente

A primeira etapa é um script Python que transcreve um áudio controlado, antes de criar o aplicativo.

### Motivo

A maior incerteza do projeto é a qualidade e a velocidade da transcrição em português, falado e cantado. Se isso não funcionar, o resto do aplicativo precisa ser repensado.

---

## DEC-020 — Fala livre fora do MVP

Oração espontânea, sermão, avisos e outros momentos sem texto prévio não são detectados pelo áudio. São conduzidos manualmente.

### Motivo

Sem texto prévio não há com o que comparar sem usar IA generativa.

---

## DEC-021 — Modelo `small` do faster-whisper

O modelo padrão é o `small`, rodando em CPU com `int8`.

### Motivo

No primeiro teste com voz real (salmo lido e música cantada, 75 s de áudio, Mac M3), o `small` transcreveu em 8 s com erros pequenos. O `base` foi 3x mais rápido, mas errou muito mais no canto. O `small` já é rápido o bastante para blocos de 5 s.

---

## DEC-022 — Sugestão com MOSTRAR e IGNORAR

A sugestão aparece quando o match passa do limite de confiança e não é o que já está na tela.

Uma sugestão nova substitui a anterior. Uma sugestão ignorada (mesmo item e trecho) não volta por 20 segundos. Enter = MOSTRAR, Esc = IGNORAR.

### Motivo

O operador precisa decidir rápido, sem ser incomodado pela mesma sugestão a cada bloco de 5 s. Nada muda na tela sem confirmação (DEC-007).

---

## DEC-023 — Imagem por caminho local

Itens `image` guardam o caminho absoluto de um arquivo. A imagem é carregada pelo protocolo de arquivos do próprio Tauri (`assetProtocol`), limitado à pasta do usuário (`$HOME/**`).

Não existe biblioteca de mídia, upload nem cópia de arquivos.

### Motivo

É a forma mais simples de mostrar uma imagem local sem plugins novos.

---

## DEC-024 — Limite de confiança mantido em 60%

Testamos o pipeline completo (áudio em blocos de 5 s → faster-whisper `small` → matching) com a voz real do salmo e da música cantada e com áudios sintéticos (salmo, anúncio, letras, oração, sermão, avisos, ceia).

Com 60%, nenhum bloco gerou sugestão errada. Os perdidos são blocos que cortam a fronteira entre duas estrofes; o bloco seguinte acerta, 5 s depois.

Com 50%, os avisos ("ceia do Senhor") geraram sugestão errada do "Texto da ceia" pelo título. Com 70%, a voz real perde mais acertos.

Não mudamos o matching. Exigir o título completo e baixar o limite para 50% foi testado: +1 acerto na voz real e nenhum erro, mas diminui a margem contra fala livre (a fala livre chegou a 30%). Com tão pouco áudio real, o ganho não justifica o risco.

### Motivo

É melhor não sugerir do que sugerir errado. Reavaliar com a gravação real de culto (etapa 12).

---

## DEC-025 — Distribuição para Mac com app + instalador de Python

Para testar em outro computador, o app é empacotado para Mac com chip Apple (`empacotar.sh`).

O `listen.py` vai embutido no app. O Python da escuta não vai embutido: o `instalar.command` cria um ambiente em `~/Library/Application Support/com.igreja.auxiliar/python`, instala faster-whisper e sounddevice e baixa o modelo `small`.

Em desenvolvimento o app continua usando `.venv` e `python/` do repositório (DEC-013).

O app não é assinado pela Apple (assinatura ad-hoc).

### Motivo

É a forma mais simples de distribuir sem tecnologia nova. Embutir o Python (PyInstaller) deixaria o app com centenas de MB e mais complexo.

---

## DEC-026 — Janela de projetor

Substitui a DEC-017.

Durante a execução existe uma segunda janela, `projector`, aberta só pelo botão **Abrir projetor**. A janela do operador mantém a prévia 16:9.

A execução envia o slide atual (tipo e texto) pelo evento `slide`. O projetor só desenha, sem controles. Com monitor externo, a janela vai para ele em tela cheia; com um monitor só, abre como janela comum.

O mesmo componente (`PresentationScreen`) desenha a prévia e o projetor.

### Motivo

A congregação precisa ver só o slide, sem a interface do operador. Uma janela a mais, com eventos do próprio Tauri, resolve sem integração com outros softwares.

---

## DEC-027 — Integração mínima com WorshipTools Presenter e PowerPoint

O operador pode definir por item a saída: `native`, `presenter_midi` ou `powerpoint`.

- **Presenter:** pulso MIDI (biblioteca `midir`) para avançar slides mapeados no Presenter. Não há API HTTP oficial.
- **PowerPoint:** AppleScript (Mac) ou COM via PowerShell (Windows) para ir ao slide correspondente à estrofe.

O projetor nativo (DEC-026) permanece como fallback.

### Motivo

Na igreja já se usa Presenter e PowerPoint; o app deve sincronizar o que ouve com essas telas, não substituí-las de imediato.

---

## DEC-028 — Modelo de roteiro SEDE (WorshipTools PDF)

Cultos seguem o planejamento WorshipTools: tempos, ciclos, salmos, músicas com tom, artes e metadados de sede/data.

Campos extras: `services.service_date`, `venue`, `liturgy_notes`; `service_items.output_target`, `external_ref` (JSON).

Import assistido: `python/import_roteiro.py`.

### Motivo

Evitar redigitar manualmente o que já existe no PDF semanal.

---

## DEC-029 — Blocos de áudio 3 s com overlap 1 s

Padrão `block_seconds=3`, `block_overlap=1` em `settings`, passados ao `listen.py`.

JSON inclui `transcribe_ms` para medir latência de inferência.

### Motivo

Blocos de 5 s + confirmação manual deixavam a sync com música perceptivelmente lenta nos testes reais.

---

## DEC-030 — Auto-avanço só em músicas

Com `auto_advance_songs=1`, matches acima do limiar em itens `song` aplicam o slide sem MOSTRAR (anúncio por título ou estrofe seguinte com `follow_verse_auto`).

Textos e demais tipos mantêm DEC-007/022.

### Motivo

No louvor, o operador precisa de resposta rápida; em leituras, confirmação manual reduz erro.

---

## DEC-031 — Track sync sub-300 ms (referência + timeline)

Quando a música tem `reference_audio_path` e `timeline_json`, o app inicia `python/sync_ref.py` (correlação com [`track_align.py`](../../python/track_align.py)) e emite `track-position` ~10 Hz.

Modo `sync_mode=hybrid` (padrão): track sync na música; Whisper+texto para o resto e fallback.

Avaliação Fase 0: [`docs/TRACK_SYNC_EVAL.md`](TRACK_SYNC_EVAL.md). Pipeline textual **não** atinge &lt;300 ms; track sync **PASS** com ref=live (sanity).

### Motivo

Click/backing permite ancorar posição na faixa de referência em vez de esperar blocos de transcrição.
---
## DEC-032 — Tabelas `session_log` e `bible_verses` (exceção ao DATABASE.md)
Migration `004_profissional.sql` cria `session_log` (o que foi ouvido, sugerido e mostrado em cada culto) e `bible_verses` (Bíblia importada pelo operador), e a coluna `songs.arrangement` (ordem de canto).
### Motivo
O log permite ajustar limiares com dados reais e depurar erros. A Bíblia precisa de busca por livro/capítulo/versículo. O app **não embute texto bíblico**: a igreja importa a tradução que tem direito de usar.
---
## DEC-033 — Contexto para o Whisper
O app escreve `whisper_context.json` (títulos e palavras da letra do item atual e dos próximos) na pasta de dados. O `listen.py` relê o arquivo quando ele muda e envia `initial_prompt` e `hotwords` ao faster-whisper, sem reiniciar a escuta.
### Motivo
Melhora nomes próprios e termos litúrgicos sem trocar de modelo.
---
## DEC-034 — Janela deslizante no matching
A transcrição nova é comparada sozinha e junto das duas anteriores (sem o trecho repetido pelo overlap). Vale a de maior pontuação. A comparação de palavras aceita erro de 1 a 2 letras em palavras longas (distância de edição), e a estrofe seguinte à atual recebe +0,03.
### Motivo
Versos partidos entre dois blocos de áudio não atingiam o limiar.
---
## DEC-035 — Rótulos e ordem de canto
Uma estrofe pode começar com `[V1]` ou `[Refrão]`. O campo `arrangement` da música (ex.: `V1 Refrão V2 Refrão`) define a ordem de exibição, e o refrão não precisa ser repetido na letra. Sem arranjo, vale a ordem do texto. A timeline do track sync usa o índice da tela na ordem de canto.
---
## DEC-036 — Referências bíblicas por regras, sem LLM
`bible.ts` reconhece "Romanos 8:28", "Salmo 23 versículo 1 ao 3" e números por extenso. A detecção na fala só **sugere** (nunca mostra sozinha) e exige livro, capítulo e versículo. Abreviações ("Rm") valem só na busca digitada.
---
## DEC-037 — Comandos de voz opcionais
Desligados por padrão. Só valem se a transcrição inteira for o comando ("próximo slide", "slide anterior", "esconder tela", "mostrar tela"), para não reagir a "próximo domingo".
---
## DEC-038 — Recuperação e backup
A posição (`last_position`) é gravada a cada slide e apagada ao sair normalmente. Se o app fechar no meio do culto, oferece retomar. Um backup JSON do dia (`backups/auto-AAAAMMDD.json`) é gravado ao iniciar a execução.
---
## DEC-039 — Servidor HTTP local (celular, OBS, legendas)
Substitui a restrição original "sem OBS" (o AGENTS.md do MVP foi descartado). `src-tauri/src/remote.rs` serve três páginas (`/` controle, `/overlay` sobreposição transparente para o OBS, `/captions` legendas ao vivo), o estado em `/state` e comandos em `/cmd`. Tudo exige `?t=CÓDIGO` (guardado em `settings.remote_token`). Só comandos de uma lista fixa chegam ao app. Desligado por padrão.
### Motivo
NDI exige o SDK proprietário da NewTek/Vizrt. Uma "Fonte de navegador" no OBS entrega o mesmo resultado sem dependência nem licença.
---
## DEC-040 — Python preparado pelo próprio app
`setup.rs` cria o ambiente virtual na pasta de dados, instala `faster-whisper` e `sounddevice` e baixa o modelo, com o andamento na tela (Configurações e aviso inicial). O `instalar.command` continua válido. Empacotar o Python com PyInstaller foi descartado: o `faster-whisper` depende de binários nativos (ctranslate2) que quebram com facilidade em executáveis congelados.
---
## DEC-041 — Atualização automática assinada
`tauri-plugin-updater` verifica `latest.json` na Release do GitHub e só aceita pacotes assinados pela chave cuja parte pública está em `tauri.conf.json`. A chave privada fica fora do repositório (`~/.tauri/auxiliar.key`) e vai para os secrets do GitHub. Notarização da Apple fica documentada e desativada até existir conta Developer.
