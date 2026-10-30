# Auxiliar Litúrgico — Architecture

## 1. Objetivo

Definir uma arquitetura simples, modular, local e extensível.

---

# 2. Princípios

* baixo custo;
* offline-first;
* baixo acoplamento;
* componentes substituíveis;
* testes independentes;
* integrações opcionais;
* simplicidade.

---

# 3. Arquitetura geral

```text
React UI
   │
   ▼
Application Services
   │
   ├── Service Engine
   ├── Automation Engine
   ├── Audio Engine
   ├── Matching Engine
   └── Presentation Engine
            │
            ▼
      PresentationProvider
            │
       ┌────┼─────┐
       ▼    ▼     ▼
    Native OpenLP OBS
```

---

# 4. Camadas

## 4.1 UI

Tecnologia:

* React
* TypeScript

Responsável por:

* telas;
* formulários;
* editor de roteiro;
* controle de culto;
* configurações;
* visualização de status.

Não deve conter regras de negócio complexas.

---

## 4.2 Application Layer

Coordena os casos de uso.

Exemplos:

```text
CreateService
StartService
NextItem
PreviousItem
PauseAutomation
ResumeAutomation
AcceptSuggestion
RejectSuggestion
```

---

## 4.3 Domain

Contém:

* Service;
* ServiceItem;
* Song;
* SongSection;
* Media;
* AutomationRule;
* AutomationEvent.

Não deve depender de React, SQLite ou providers externos.

---

## 4.4 Service Engine

Controla o estado do culto.

Responsabilidades:

* iniciar;
* finalizar;
* avançar;
* voltar;
* pausar;
* retomar;
* navegar;
* manter item atual.

---

## 4.5 Automation Engine

Recebe sinais e produz candidatos.

Exemplo:

```text
SpeechDetected
        ↓
Matching
        ↓
Candidate
        ↓
Decision Engine
```

---

## 4.6 Audio Engine

Responsável pela captura e processamento inicial do áudio.

Não decide qual slide mostrar.

---

## 4.7 Matching Engine

Transforma sinais em candidatos.

Exemplo:

```text
"vamos cantar teu amor"
        ↓
Teu Amor
        ↓
confidence = 0.94
```

---

## 4.8 Decision Engine

É responsável pela decisão final.

Entradas:

* estado atual;
* candidato;
* confiança;
* regras;
* tempo;
* cooldown;
* estabilidade.

Saídas:

```text
NO_ACTION
SUGGEST
EXECUTE
PAUSE
```

---

# 5. State Machine

Estado mínimo:

```text
IDLE
SERVICE_RUNNING
AUTOMATION_PAUSED
SERVICE_FINISHED
```

Estado do item:

```text
ITEM_ACTIVE
ITEM_TRANSITIONING
```

---

# 6. Eventos

```text
START_SERVICE
STOP_SERVICE
NEXT
PREVIOUS
PAUSE
RESUME
SPEECH_DETECTED
SONG_MATCHED
BIBLE_REFERENCE_DETECTED
TIMER_ELAPSED
OPERATOR_OVERRIDE
```

---

# 7. PresentationProvider

Interface:

```typescript
interface PresentationProvider {
  initialize(): Promise<void>;
  showItem(item: PresentationItem): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  clear(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<PresentationStatus>;
}
```

Implementações:

```text
NativePresentationProvider
OpenLPProvider
OBSProvider
FutureProvider
```

---

# 8. Native Presentation

O renderer nativo é obrigatório como fallback.

Deve suportar inicialmente:

* texto;
* imagem;
* vídeo;
* letra;
* Bíblia;
* tela preta.

---

# 9. Dependências externas

Nenhum módulo do Core pode depender diretamente de:

* OpenLP;
* OBS;
* ProPresenter;
* APIs de IA.

Esses sistemas devem ser acessados através de adapters.

---

# 10. Banco

SQLite local.

O domínio não deve conhecer detalhes do SQLite.

Usar repository interfaces.

Exemplo:

```typescript
interface ServiceRepository {
  findById(id: string): Promise<Service | null>;
  save(service: Service): Promise<void>;
}
```

---

# 11. Comunicação

Evitar rede quando não necessária.

Comunicação local preferencial.

---

# 12. Offline

O sistema deve funcionar sem internet.

Internet poderá ser usada para:

* atualização;
* backup;
* recursos opcionais;
* integração externa;
* LLM opcional.

---

# 13. Segurança operacional

Em qualquer erro:

```text
preservar estado atual
informar operador
não executar ação destrutiva
```

---

# 14. Testabilidade

Cada camada deve poder ser testada isoladamente.

Principalmente:

* State Machine;
* Automation Engine;
* Matching Engine;
* Decision Engine.

---

# 15. Evolução

Adicionar nova integração não deve exigir alteração do Core.

Exemplo:

```text
PresentationProvider
        │
        ├── Native
        ├── OpenLP
        ├── OBS
        └── ProPresenter
```
