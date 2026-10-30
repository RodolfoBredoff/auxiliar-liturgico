# Presentation

## Objetivo

Mostrar o conteúdo preparado para o culto.

O MVP terá um renderer próprio e simples.

Não estamos tentando criar um software profissional de apresentação.

## Onde

A janela do operador tem uma **prévia 16:9** do slide atual.

O botão **📽 Abrir projetor** abre uma segunda janela só com o slide (sem controles). Ver `PROJECTOR.md` e DEC-026.

* Com monitor externo: a janela vai para ele em tela cheia.
* Com um monitor só: abre como janela comum.
* O projetor só abre manualmente, e fecha ao sair da execução.

## Tipos

O renderer deverá suportar inicialmente:

### Texto (`text`)

Exibe um bloco do texto por vez.

### Letra (`song`)

Exibe uma estrofe da letra por vez.

### Imagem (`image`)

Exibe uma imagem local, pelo caminho absoluto guardado no item (arquivo dentro da pasta do usuário). Se o caminho estiver vazio ou a imagem não carregar, mostra uma mensagem.

### Tela em branco (`blank`)

Exibe uma tela em branco.

Itens `section` (separadores de ciclo) não são exibidos e são pulados na execução.

## Blocos

Letras e textos são divididos em blocos por linha em branco.

Cada bloco é uma "tela".

## Fluxo

```text
Service Item
     ↓
Bloco atual
     ↓
Renderer
     ↓
Área de apresentação
```

## Controle manual

O operador poderá:

* mostrar: exibe o item selecionado
* avançar: próximo bloco; no último bloco, vai para o próximo item
* voltar: bloco anterior; no primeiro bloco, vai para o item anterior
* esconder: exibe tela em branco sem perder a posição

Pausar a escuta é um controle do áudio (ver `AUDIO_PIPELINE.md`).

## Relação com o áudio

No MVP, o áudio não controla diretamente a apresentação.

O fluxo será:

```text
Áudio
 ↓
Transcrição
 ↓
Matching
 ↓
Sugestão (item + trecho)
 ↓
Operador
 ↓
Apresentação
```

## Futuro

Somente depois de validar o MVP poderão ser avaliados:

* avanço automático
* sincronização
* transições
* vídeos
* múltiplas telas
* OpenLP
* OBS
* ProPresenter

Não implementar esses recursos agora.
