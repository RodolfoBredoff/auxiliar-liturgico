# Manual de uso — Auxiliar Litúrgico

O Auxiliar Litúrgico ajuda o operador a apresentar as letras e os textos do culto.

Você prepara a sequência do culto antes. Durante o culto, o app mostra o conteúdo na tela e, se você quiser, escuta o microfone e **sugere** qual letra ou texto deve aparecer. Nada muda sozinho: você sempre confirma.

> Versão experimental, para uso interno. Funciona em Mac com chip Apple (M1, M2, M3, M4).

---

## 1. Instalação (uma vez por computador)

Você vai precisar de internet só durante a instalação.

1. **Instale o Python 3.12**, se ainda não tiver.
   Baixe em https://www.python.org/downloads/macos/ e instale normalmente.
2. **Descompacte** o arquivo `Auxiliar-Liturgico-...-mac-arm64.zip`.
3. Na pasta descompactada, dê **dois cliques em `instalar.command`**.
   Uma janela do Terminal vai abrir e mostrar o progresso. Leva de 5 a 10 minutos: ela instala o que a escuta precisa e baixa o modelo de transcrição (~500 MB).
4. No fim, o app estará em **Aplicativos → Auxiliar Litúrgico**.

### Se o macOS bloquear o instalador ou o app

Como o app não é distribuído pela App Store, o macOS pode dizer que "não pode verificar o desenvolvedor".

- Abra **Ajustes do Sistema → Privacidade e Segurança**, role até o fim e clique em **Abrir Mesmo Assim**.
- Outra opção para o instalador: abra o app **Terminal**, digite `bash ` (com espaço), arraste o arquivo `instalar.command` para a janela e pressione Enter.

### Permissão de microfone

Na primeira vez que você clicar em **🎤 Ouvir**, o macOS vai perguntar se o Auxiliar Litúrgico pode usar o microfone. Clique em **Permitir**.

Se você negou sem querer: **Ajustes do Sistema → Privacidade e Segurança → Microfone** e ative o Auxiliar Litúrgico.

### Atualizar para uma versão nova

**Pelo próprio app (recomendado):** Configurações → Atualizações → Verificar atualizações → Instalar e reiniciar.
Funciona quando a equipe técnica publicou a versão no GitHub.

**Manualmente, com o zip:**

1. Feche o app.
2. Descompacte o zip `Auxiliar-Liturgico-…-mac-arm64.zip` recebido da equipe técnica.
3. Rode **`instalar.command`** outra vez (atualiza o app em Aplicativos; músicas e cultos no banco local **não** são apagados).
4. Abra o app. Se algo falhar na escuta, confira se o Python em `~/Library/Application Support/com.igreja.auxiliar/python` ainda existe.

---

## 2. Visão geral

O app tem duas abas no topo:

- **Cultos**: montar e executar a sequência do culto.
- **Músicas**: cadastrar as músicas e suas letras.

---

## 3. Cadastrar músicas

1. Abra a aba **Músicas** e clique em **+ Nova música**.
2. Preencha o **Título**.
3. Cole a **Letra**. **Separe cada estrofe com uma linha em branco.** Cada estrofe vira uma tela na apresentação.
4. Clique em **Salvar**.

Abaixo da letra aparece como ela foi dividida em estrofes. Confira antes do culto.

Para excluir, clique em **Excluir** e depois em **Confirmar exclusão**. Uma música usada em algum culto não pode ser excluída.

---

## 4. Montar um culto

1. Abra a aba **Cultos** e clique em **+ Novo culto**. Mude o nome no campo **Culto**.
2. Escolha o tipo do item embaixo da lista e clique em **Adicionar item**.
3. Clique no item para editar à direita e depois em **Salvar**.
4. Use **↑** e **↓** para mudar a ordem.

### Tipos de item

| Tipo | Para que serve | O que preencher |
| --- | --- | --- |
| Ciclo | Separador (ex.: "Ciclo 2"). Não aparece na tela. | Título |
| Texto | Leituras, salmos, orações, texto da ceia, avisos | Título e texto (blocos separados por linha em branco) |
| Música | Uma música cadastrada | Título e a música |
| Imagem | Uma imagem do computador | Caminho do arquivo (ex.: `/Users/nome/Imagens/aviso.png`) |
| Tela em branco | Oração espontânea, sermão, encerramento | Título |

Dica: itens de texto sem conteúdo mostram o próprio título na tela.

### Reaproveitar o culto da semana anterior

Abra o culto e clique em **Duplicar culto**. Depois troque as músicas e os textos que mudaram.

---

## 5. Executar o culto

1. Na aba **Cultos**, abra o culto e clique em **▶ Executar**.
2. À esquerda fica a sequência; à direita, a **tela de apresentação**.
3. Clique em um item da sequência para mostrá-lo. Se ele tiver várias estrofes, as miniaturas aparecem embaixo da tela e também podem ser clicadas.

### Controles

| Ação | Botão | Teclado |
| --- | --- | --- |
| Avançar (próxima estrofe ou próximo item) | Avançar ▶ | → ↓ Page Down Espaço |
| Voltar | ◀ Voltar | ← ↑ Page Up |
| Esconder / mostrar (tela preta) | Esconder | B |
| Aceitar sugestão | MOSTRAR | Enter |
| Descartar sugestão | IGNORAR | Esc |

Para sair, clique em **Sair da execução**.

### Projetor

A área preta na janela do operador é uma **prévia**. Para a congregação:

1. Ligue o projetor ao Mac (cabo HDMI/USB-C). Em **Ajustes do Sistema → Telas**, use **Estender** (não espelhar).
2. Na execução, clique em **📽 Abrir projetor**.
3. O slide abre **em tela cheia no projetor**, sem botões. Você continua controlando pela janela do operador.
4. Para encerrar, clique em **Fechar projetor** ou em **Sair da execução**.

Tudo o que você fizer (avançar, voltar, esconder, MOSTRAR) aparece ao mesmo tempo na prévia e no projetor.

Sem projetor ligado, o botão abre uma janela comum, útil para testar. Se a tela cheia abrir no monitor errado, feche o projetor, confira **Telas** no macOS e abra de novo.

---

## 6. Escuta e sugestões

1. Durante a execução, clique em **🎤 Ouvir**.
2. Aguarde alguns segundos em "Carregando modelo...". Quando aparecer **⏸ Pausar escuta**, o app está ouvindo.
3. A faixa de escuta mostra o que foi entendido a cada ~3 segundos (configurável) e quanto tempo o Whisper levou (`whisper …ms`).
4. **Músicas:** com `auto_advance_songs` ativo (padrão), estrofes reconhecidas **avançam sozinhas** na saída configurada. Textos e leituras continuam pedindo **MOSTRAR**.
5. **Track sync (backing):** se a música tiver **áudio de referência** e **timeline JSON** (aba Músicas), o app segue a posição na faixa em tempo quase real (`track …ms` nos controles). Modo padrão `hybrid`: track na música, Whisper no resto. Ver [`docs/TRACK_SYNC_EVAL.md`](TRACK_SYNC_EVAL.md).
6. Quando o app tiver confiança suficiente (e não for auto-avanço de música), aparece um cartão amarelo:

   **Possível item:** Música 1 — Cantarei Teu Amor · Estrofe 2 · Confiança 86%
   **[MOSTRAR] [IGNORAR]**

   - **MOSTRAR** leva a tela para aquele trecho.
   - **IGNORAR** descarta. A mesma sugestão não volta por cerca de 20 segundos.

### O que o app consegue reconhecer

- Músicas e textos **cadastrados no culto em execução** (o item atual e os próximos).
- Anúncios com o nome do item, como "agora vamos cantar Teu Amor" ou "vamos fazer a leitura do salmo".

### O que ele não reconhece

- Fala livre sem texto preparado: oração espontânea, sermão, avisos falados. Nesses momentos, conduza manualmente. Dica: **pause a escuta durante o sermão**.
- Músicas que não estão no culto.

Quando está em dúvida, o app prefere **não sugerir**.

### Dicas para a escuta funcionar melhor

- Deixe o computador perto do som (ou use um microfone ligado à mesa de som).
- Cadastre as letras exatamente como são cantadas, com as estrofes separadas.
- Antes do culto, faça um teste: execute, clique em Ouvir e cante um trecho.

---

## 7. WorshipTools Presenter (MIDI) e PowerPoint

Cada item do culto pode usar uma **saída de projeção** (campo na edição do item):

| Saída | Uso típico |
| --- | --- |
| Projetor do app | Prévia + janela projetor nativa |
| WorshipTools (MIDI) | Liturgia, artes, textos no Presenter |
| PowerPoint | Slides de música (1 slide = 1 estrofe) |

### Presenter — rtpMIDI (Mac ou Windows)

1. Instale **rtpMIDI** e crie uma sessão. No mesmo computador, adicione `localhost` em Directory/Participants (documentação WorshipTools).
2. No Presenter: **Settings → MIDI → Connect** e mapeie a nota **60** (padrão) para **Next slide** ou avançar item.
3. No item do culto, escolha **WorshipTools (MIDI)** e, se preciso, outra nota MIDI.
4. Opcional: em `settings` do banco, `midi_port` = nome exato da porta rtpMIDI.

Quando o app avança um item com essa saída, envia um pulso MIDI.

### PowerPoint (Mac ou Windows)

1. Abra a apresentação e inicie o **modo slideshow** antes do culto.
2. Nos itens **Música** com saída **PowerPoint**, informe o **slide inicial** (primeira estrofe).
3. Cada estrofe avança para `slide inicial + número da estrofe − 1`.

Requisito: **Microsoft PowerPoint** instalado. No Mac usa AppleScript; no Windows, automação COM.

---

## 8. Importar roteiro WorshipTools (PDF)

Roteiros exportados como PDF (ex.: `4 de out - SEDE.pdf`) podem virar culto no SQLite:

```bash
.venv/bin/python python/import_roteiro.py "4 de out - SEDE.pdf" > app/seed/meu_culto.sql
sqlite3 ~/Library/Application\ Support/com.igreja.auxiliar/auxiliar.db < app/seed/meu_culto.sql
```

Revise o SQL gerado (títulos de música, textos longos). Depois vincule cada **Música** ao cadastro de letras na aba Músicas.

Modelo de campos: [`docs/ROTEIRO_SEDE.md`](ROTEIRO_SEDE.md).

---

## 9. Problemas comuns

| Problema | O que fazer |
| --- | --- |
| "Python não encontrado. Rode o instalar.command" | Rode o `instalar.command` de novo (seção 1). |
| Clico em Ouvir e nada aparece | Verifique a permissão de microfone (seção 1). Fale mais perto do computador. |
| Primeira escuta demora muito | Na primeira vez sem o modelo baixado, ele é baixado da internet. Rode o instalador com internet. |
| A imagem não aparece | O arquivo precisa estar dentro da sua pasta de usuário e fora de pastas ocultas. Confira o caminho. |
| Sugestões erradas ou poucas sugestões | Confira se a letra cadastrada está igual à cantada e separada em estrofes. Anote o caso e avise quem mantém o app. |

---

## 10. Levar seus dados para outro computador

Todas as músicas e cultos ficam em um único arquivo:

```text
~/Library/Application Support/com.igreja.auxiliar/auxiliar.db
```

Para levar para outro Mac: feche o app, copie esse arquivo para a mesma pasta no outro computador (substituindo o que estiver lá) e abra o app.

No Finder: menu **Ir → Ir para a Pasta...** e cole `~/Library/Application Support/com.igreja.auxiliar`.

---

## 11. Desinstalar

1. Apague **Aplicativos → Auxiliar Litúrgico**.
2. Apague a pasta `~/Library/Application Support/com.igreja.auxiliar` (isso apaga também as músicas e cultos).
3. Opcional: apague o modelo baixado em `~/.cache/huggingface`.

## 12. Recursos adicionados (versão profissional)

### Configurações
A aba **Configurações** reúne modelo do Whisper, dispositivo de áudio, limites de confiança, aparência da projeção, Bíblia e backup. Não é preciso editar o banco.

### Painel de escuta (tela de execução)
* A barra de volume mostra se o microfone está captando. Vermelha por mais de 15 s: confira cabo, mesa e dispositivo.
* "Última fala há Ns" mostra quando o Whisper entendeu algo pela última vez.
* "Transcrição atrasada": o modelo está lento para este computador. Use um modelo menor.
* **↻ Reiniciar** reinicia a escuta. Se ela cair sozinha, o app tenta de novo até 3 vezes.
* **Auto: ligado/pausado (P)** impede o avanço automático (as sugestões continuam).

### Teclas na execução
| Tecla | Ação |
|---|---|
| Setas, Espaço | avançar e voltar |
| B | tela preta |
| C | limpar só o texto (fica o fundo do tema) |
| L | logotipo |
| P | pausar o avanço automático |
| Ctrl/Cmd + K | buscar item (título ou letra) ou versículo |
| Enter / Esc | aceitar / ignorar a sugestão |

### Tela de palco
**🎤 Abrir palco** abre uma janela com o slide atual, o próximo, o relógio e dois cronômetros (culto e item). Se o item tem duração prevista, o cronômetro vira contagem regressiva e fica vermelho ao estourar. Arraste a janela para o monitor de retorno.

### Aparência da projeção
Em Configurações: fonte, tamanho, cores, imagem de fundo, margem, sombra e transição. O texto se ajusta sozinho para caber na tela.

### Ordem de canto
Marque as estrofes com `[V1]`, `[Refrão]`... na primeira linha e preencha **Ordem de canto** (`V1 Refrão V2 Refrão`). O refrão não precisa ser repetido na letra.

### Importar músicas
Na aba Músicas, informe o caminho de um arquivo `.txt` ou de uma música do OpenSong (`.xml`). Cifras são removidas. Para texto colado, use **Limpar cifras e organizar estrofes**.

### Bíblia
1. Configurações → Bíblia: informe um nome (ex.: ARA) e o caminho do arquivo (JSON com 66 livros e `chapters`, ou texto `Gênesis 1:1 No princípio...`).
2. Na execução, use a caixa 📖 ou Ctrl+K e digite `Rm 8:28`, `João 3 16`.
3. Com a detecção ligada, o app **sugere** versículos citados na fala (nunca mostra sozinho).
O app não traz texto bíblico; use uma tradução que a igreja possa usar.

### Comandos de voz (opcional)
Ative em Configurações. Diga a frase sozinha: “próximo slide”, “slide anterior”, “esconder tela”, “mostrar tela”.

### Backup, retomada e registro
* Um backup do dia é salvo ao iniciar cada execução. **Fazer backup agora** e **Restaurar** ficam em Configurações.
* Se o app fechar no meio do culto, ao abrir aparece “Retomar”.
* O registro do culto (o que foi ouvido, sugerido e mostrado) pode ser exportado em Configurações para ajustar a confiança mínima.

### Melhor áudio, melhor resultado
Ligue o app a uma **saída auxiliar da mesa de som** (só voz e instrumentos do louvor), em vez de um microfone ambiente. É a melhor melhoria de acerto, mais que qualquer ajuste de software. Para escolher o modelo do Whisper, meça no computador da igreja: `python python/bench_models.py audio.wav --models tiny small medium`. A mediana por bloco deve ficar abaixo da metade do tamanho do bloco.

### Preparar o reconhecimento de voz pelo app
Se o Python ainda não foi preparado, a tela inicial mostra um aviso com **Preparar reconhecimento de voz** (também em Configurações). Precisa de internet e de um Python 3.9 a 3.13 instalado (python.org). Leva alguns minutos e baixa cerca de 500 MB. O `instalar.command` continua funcionando como alternativa.

### Controle pelo celular, OBS e legendas
Em Configurações → **Celular, OBS e legendas**, ative a opção. O app mostra três endereços (todos com um código de acesso):
* **Controle pelo celular**: abra no navegador do celular, na mesma rede Wi-Fi. Tem Voltar/Avançar, Preto, Limpar, Logo, Auto, lista de itens para pular e os botões MOSTRAR/IGNORAR da sugestão.
* **Sobreposição para OBS**: no OBS, adicione uma *Fonte de navegador* (1920×1080) com esse endereço. O texto aparece sobre o vídeo com fundo transparente, usando a fonte e as cores do tema. Só mostra letras de música e textos (não imagens).
* **Legendas ao vivo**: mostra o que está sendo falado ou cantado, em tela cheia (tablet ou segunda tela) ou no OBS (acrescente `&bg=transparent`). A legenda some depois de 8 s sem fala. É a transcrição do Whisper, então pode ter erros.
Na primeira vez, o macOS pergunta se o app pode receber conexões de rede: permita. Quem tiver o endereço com o código consegue controlar a projeção; não divulgue.

### Atualizar o app
Em Configurações → **Atualizações**, clique em *Verificar atualizações*. Requer que o repositório e a chave de assinatura estejam configurados (veja `GITHUB_E_RELEASES.md`).
