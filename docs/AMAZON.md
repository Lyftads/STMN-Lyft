# Integrazione Amazon — piano e registrazioni

> Stato: **Fase 0 — registrazioni developer** (avviata 27 lug 2026).
> Il collo di bottiglia sono le 2 approvazioni Amazon (SP-API + Ads API), non il codice:
> si inviano subito, il codice si costruisce in parallelo.

## Architettura decisa

- **SP-API (vendite/ordini/fee/FBA)** → via Nango, provider ufficiale `amazon-selling-partner`
  (connection config: `application_id`, `domain` es. `sellercentral.amazon.it`, `region` = `eu`).
  Stesso pattern multi-tenant di Klaviyo: bottone "Collega Amazon" per-workspace.
- **Ads API (spesa/campagne/ACOS)** → Login with Amazon OAuth2 (scope `advertising::campaign_management`),
  via provider Nango generico `amazon` oppure flusso nativo come Google.
- Niente firma AWS (rimossa dal 2023): bastano i token LWA.
- Region EU: un solo consenso copre i marketplace it/de/fr/es/uk (si filtra per `marketplaceIds`).
- **NIENTE ruoli restricted / PII acquirenti**: bastano dati aggregati → niente architecture review, approvazione più rapida.
- Gotcha dati: Reports API asincrona (create → poll → download) e Sales & Traffic con lag 24-48h → SWR + cron, non realtime.

## Fase 0A — Registrazione developer SP-API

**Dove**: Solution Provider Portal → https://developer.amazonservices.com (→ "Register").

**Doppio binario consigliato**:
1. **Private developer** (subito, review snella): si registra dal Seller Central del proprio account venditore
   e può auto-autorizzare SOLO i propri account → permette di costruire e testare la Fase 1
   con dati reali (es. Saracino) mentre la review public è in corso.
2. **Public developer** (per i clienti): review completa + obbligo di listing nel Selling Partner Appstore
   (che è anche una vetrina gratuita). È quella che serve al SaaS a regime.

**Cosa preparare (serve a Marino)**:
- dati aziendali: ragione sociale, P.IVA/registro imprese, indirizzo sede
- documento d'identità o passaporto del titolare
- un estratto conto bancario o di carta recente (per l'identity verification, ~20 min)

**Ruoli da selezionare (SOLO unrestricted)**:
- `Inventory and Order Tracking` (ordini senza PII, stock)
- `Amazon Fulfillment` (FBA)
- `Finance and Accounting` (fee, settlement)
- `Brand Analytics` (report Sales & Traffic)
- `Pricing` (opzionale)
- **NON** selezionare: Direct-to-Consumer Shipping, Buyer Communication, Tax Invoicing (= restricted/PII).

**Testi pronti (EN) per il profilo developer**:

*Organization / application description:*
> LyftAI (lyftai.io) is an AI-powered analytics platform for e-commerce brands and the agencies
> that manage them. It unifies sales, advertising, email, SEO and inventory data into a single
> dashboard with AI-generated insights. The Amazon integration adds aggregated marketplace sales,
> fees and FBA inventory to the merchant's cross-channel dashboard.

*Use case description:*
> Read-only analytics. We retrieve aggregated sales and traffic reports, order totals, financial
> events (fees/settlements) and FBA inventory levels to display dashboards, product-level P&L and
> stock-out forecasts to the authorizing merchant. We do not request buyer PII, we do not manage
> listings, prices or shipments, and we never write data to the selling account.

*Data protection (base per il questionario DPP — adattare alle domande esatte):*
> - Data is stored in a managed PostgreSQL database (Supabase) with row-level security; every row
>   is scoped to the authorizing merchant's workspace (multi-tenant isolation).
> - Encryption in transit (TLS 1.2+) and at rest (AES-256, provided by the managed database).
> - OAuth tokens are stored encrypted by our auth-connector layer (Nango); no credentials in code.
> - No buyer personally identifiable information is requested, processed or stored.
> - Access to production systems is limited to the founder; no shared accounts.
> - Data is retained only while the merchant's account is active and deleted upon disconnection
>   or deletion request (GDPR). Sub-processors are documented at lyftai.io.
> - Incident response: revoke affected tokens, patch, and notify affected merchants and
>   authorities within 72 hours as required by GDPR.

## Fase 0B — Amazon Ads API

**Passi** (portale: https://advertising.amazon.com/API/docs → onboarding):
1. Creare una **LwA Security Profile** su https://developer.amazon.com (Login with Amazon console)
   — nome "LyftAI", privacy policy https://lyftai.io/privacy, logo.
2. Compilare il form **Apply for access** come **Tool provider** (licenziamo il software a più inserzionisti).
   Business justification: stesso testo "Organization description" sopra + frase:
   > We license our analytics software to Amazon advertisers; each advertiser authorizes access
   > to their own advertising data via Login with Amazon. Read-mostly usage: campaign reports,
   > spend and ACOS for cross-channel dashboards and budget recommendations.
3. All'email di approvazione: cliccare il link → selezionare la security profile → **Link application**
   (senza questo passaggio la profile esiste ma non ha i permessi API).
4. In LwA console → Web Settings: aggiungere Allowed Return URLs
   (callback Nango `https://api.nango.dev/oauth/callback` oppure `https://lyftai.io/api/amazon-ads/callback` se nativo).
- Tempi: giorni per direct advertiser, **settimane per tool provider**. Niente sandbox: solo production.

## Roadmap implementazione (dopo i gate)

| Fase | Cosa | Dove |
|---|---|---|
| 1 | MVP vendite: report Sales & Traffic giornaliero + Orders → card Dashboard + tab Amazon (KPI per marketplace) | Nango `amazon-selling-partner`, cron+SWR |
| 2 | Suite Amazon Ads gemella di Meta/Google (KPI/Detail/Budget) + spesa in KPI Brain e CAC blended | LwA + Ads API v3 reports |
| 3 | Finances (fee reali) → P&L prodotto esteso ad Amazon; FBA nel modulo Inventario; TACOS; canale in incrementalità | estensione moduli esistenti |
| 4 | Tool `get_amazon` nel Cervello (chat, agenti, report PDF) | lib/agent/tools.js |

**Env previste** (da aggiungere quando arrivano le credenziali):
`AMZ_SPAPI_APP_ID`, (LWA client id/secret stanno in Nango), `AMZ_ADS_CLIENT_ID`, `AMZ_ADS_CLIENT_SECRET`.

## Fuori scope (deciso)

Vendor Central (solo seller), MWS (deprecata), PII acquirenti, scrittura dati (listing/prezzi/spedizioni).
