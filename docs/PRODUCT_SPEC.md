Product Spec — Auxiliar Litúrgico
1. Visão

O Auxiliar Litúrgico é um aplicativo desktop pensado para ajudar uma igreja durante seus cultos.

A pessoa prepara previamente a sequência do culto.

Durante o culto, o sistema pode ajudar o operador a apresentar o conteúdo correspondente ao que está acontecendo.

A visão de longo prazo é que o sistema consiga reconhecer sinais do culto, como fala e música, e relacioná-los com o conteúdo previamente preparado.

2. Princípios
Simplicidade

O sistema deve ser simples de usar e manter.

Offline-first

O funcionamento principal deve ocorrer localmente.

Controle humano

O operador sempre pode assumir o controle.

Conteúdo preparado

O sistema trabalha principalmente com conteúdo previamente cadastrado.

Segurança

Quando houver dúvida, o sistema deve preferir não executar uma ação.

Evolução incremental

Funcionalidades mais complexas somente devem ser adicionadas depois que as simples forem validadas.

3. Usuários

Inicialmente existe apenas um perfil prático:

Operador

Pessoa que prepara ou executa o culto.

Não haverá sistema de usuários no MVP.

4. Conteúdos

O produto poderá futuramente trabalhar com:

músicas
letras
imagens
vídeos
textos
leituras bíblicas
anúncios
orações
sermões
slides
contagens
tela em branco

No MVP, somente um subconjunto será implementado.

5. Culto

Um culto é uma sequência ordenada de itens, agrupados em ciclos.

O culto de referência da igreja está descrito em docs/MVP.md (seção 3).
6. Modos futuros
Manual

Operador controla tudo.

Assistido

Sistema faz sugestões.

Automático

Sistema pode executar determinadas ações automaticamente.

O MVP ficará principalmente entre Manual e Assistido.

7. Reconhecimento

O sistema poderá receber áudio e transformar o áudio em texto.

Esse texto poderá ser comparado com:

letras
nomes de músicas
textos preparados
itens da sequência

A primeira implementação será simples.

8. Automação futura

No MVP, o sistema já sugere o item e o trecho da sequência correspondentes ao áudio, mas nunca executa nada sozinho.

No futuro, o sistema poderá:

detectar fala livre (oração, sermão, avisos)
detectar músicas fora da sequência
avançar a apresentação
controlar determinados conteúdos

Essas funções não fazem parte do primeiro MVP.

9. Integrações futuras

Poderão ser avaliadas posteriormente integrações com:

OpenLP
OBS
ProPresenter

Essas integrações não fazem parte do MVP.

10. Apresentação

O aplicativo terá inicialmente seu próprio renderer simples.

Ele deverá apresentar:

texto
letras
imagens
tela em branco

O objetivo não é competir com softwares profissionais de apresentação.

11. Segurança operacional

O sistema deve permitir:

pausar
ignorar sugestão
voltar
avançar
assumir controle manual

O sistema não deve inventar conteúdo.

12. Evolução

A evolução pretendida é:

MVP (manual + assistido)
↓
Reconhecimento confiável
↓
Automação controlada
↓
Integrações opcionais

Nada disso deve ser implementado antes da validação das etapas anteriores.