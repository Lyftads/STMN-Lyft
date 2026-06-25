# AI Provider — Cervello multi-backend di LyftAI

> Obiettivo: un solo "provider LyftAI" (`callBrain`) che sotto il cofano può girare su
> OpenAI / Claude / Gemini / modello open, con **routing per tier** e **fallback
> automatico**, senza che le route o i prompt cambino.

## Perché
- **Resilienza** (rischio #1): oggi un solo provider + una sola chiave → se OpenAI
  va giù/throttle, TUTTI i clienti restano senza AI insieme. Il fallback risolve questo.
- **Costo**: oggi `gpt-4o` per tutto, anche per task banali (estrazione, traduzione,
  classificazione) che starebbero bene su un modello ~15× più economico.
- **Controllo**: il moat è il layer di orchestrazione (contesto + memoria + skill),
  non il modello. Il modello è una commodity da affittare e intercambiare.

## Architettura target
```
route → callBrain(skill, data, …)        ← interfaccia invariata
          └─ router.resolve(tier)          ← sceglie provider+modello
               └─ provider adapter          ← openai | anthropic | google | open
                    └─ fallback wrapper      ← se primario fallisce → secondario
```

Tutto resta dietro `lib/agent/gateway.js` (`callBrain`): già il punto unico con
contesto (`buildAgentContext`), scrub PII, JSON mode e tool-loop. L'unica parte
"OpenAI-only" era la fetch interna `callOnce` → estratta in un adapter.

## Interfaccia adapter (normalizzata)
`lib/agent/providers/<id>.js` esporta:
```js
export const id = 'openai'
export async function chatComplete({ model, messages, temperature, topP,
  presencePenalty, frequencyPenalty, json, tools, signal })
  → { message, content, toolCalls, usage, raw }
```
- `message`: messaggio assistant grezzo del provider (serve al tool-loop)
- `content`: testo della risposta
- `toolCalls`: array di tool_calls (formato normalizzato OpenAI-like)
- `usage`: token usage
Gli errori sono `Error` con `.status` (es. 429/5xx) così il wrapper di fallback decide.

## Fasi
- **Fase 1 — Adapter OpenAI (abilitante)** ✅ FATTA
  `providers/openai.js` = l'ex `callOnce`, dietro l'interfaccia normalizzata.
  `gateway.js` usa l'adapter. Nessun cambio di comportamento (verificato col `dryRun`).
- **Fase 2 — Router per tier** ✅ FATTA
  `lib/agent/router.js` (`resolveTier(tier) → {provider, model}`) + env. Le skill
  dichiarano un `tier` (`cheap`/`smart`/`reason`); il gateway risolve via router
  quando non c'è `model` esplicito. Mapping via env "provider:model":
  ```
  AI_TIER_CHEAP=openai:gpt-4o-mini
  AI_TIER_SMART=openai:gpt-4o
  AI_TIER_REASON=openai:gpt-4o      # o anthropic:… quando ci sarà l'adapter
  ```
  Retrocompatibile: `model` esplicito/`skill.model` bypassa il router; senza env,
  `smart` = OPENAI_MODEL||gpt-4o → identico a prima. Il risparmio si attiva taggando
  le skill `cheap` o settando le env (nessuna regressione di default).
- **Fase 3 — Fallback automatico (resilienza)** ⬜
  `callWithFallback`: primario → su 429/5xx/timeout/network → secondario (altro
  provider). `AI_FALLBACK_SMART=anthropic:claude-sonnet-4-6`. Richiede test sui
  formati JSON/tool che variano tra provider.
- **Fase 4 — Consolidare le route rimaste** ✅ FATTA
  Le 6 chat ora passano dal layer provider+router via `router.complete()` (NON
  `callBrain`: costruiscono già il loro contesto su misura → instradata solo la
  chiamata HTTP, output identico). Tier assegnati: `recommendations` = `cheap`
  (era già gpt-4o-mini); `actions/suggest`, `cro/scan`, `website-scanner`
  (vision), `creative-agent`, `creative-reverse` = `smart`. Ottengono tiering +
  (Fase 3) fallback senza toccare prompt/output.
  `router.complete({ tier, model?, messages, json?, temperature?, topP?,
  maxTokens?, signal? })` → `{ message, content, toolCalls, usage, model }`.
  Restano dirette le NON-chat: immagini (`studio/generate`, `creative-lab`,
  `creative-reverse` img-gen), audio (`studio/transcribe`), embeddings
  (`agentMemory`, `consolidate-memories`) → eventuali moduli `providers/*` dedicati.
- **Fase 5 (opzionale)** ⬜
  Campo `ai_tier`/`openai_model` su `companies` → override per cliente premium,
  letto dal router con fallback alla env. Eventuale modello open self-hosted come
  adapter aggiuntivo.

## Ordine
Fase 1 → 2 → 4(chat) → 3. Le prime due danno controllo + risparmio a rischio quasi
nullo; la 4 ripulisce; il fallback (3) per ultimo perché richiede più test cross-provider.
