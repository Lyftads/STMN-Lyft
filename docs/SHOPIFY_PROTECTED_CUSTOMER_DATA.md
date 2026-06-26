# Shopify — Protected Customer Data Access Request (LyftAI)

Testo pronto da incollare nel **Partner Dashboard → App LyftAI → API access →
Protected customer data access → Request access**. Richiedere **Level 1 + Level 2**.
Le risposte sono in inglese (lingua del form). Ogni sezione indica dove va.

---

## 1) Access levels requested
- **Level 1 — Protected customer data**: customer name and customer-level
  metrics (number of orders, amount spent, first/last order dates).
- **Level 2 — Protected customer fields**: email, phone, address / region.

## 2) How does your app use protected customer data? (campo "Reason for access")

LyftAI is an e‑commerce analytics and marketing platform that a merchant connects
to their own Shopify store. It reads the store's commerce data to give the
merchant insights about their own business and customers: sales performance,
customer segmentation (RFM), lifetime value and cohorts, conversion‑rate (CRO)
funnels, product performance, and new‑vs‑returning customer analysis. It also
lets the merchant create marketing/lifecycle email campaigns to their own
customers through the merchant's own connected email provider (e.g. Klaviyo).

The data is shown only to the merchant who owns the store. LyftAI never sells
customer data, never uses it for advertising, and never shares one merchant's
data with another merchant. Per‑tenant isolation is enforced so each merchant can
only ever access their own store's data.

## 3) Why each field is required (campo "Justification" per livello/campo)

**Level 1 — Customer name & customer‑level metrics**
Used to power RFM segmentation, LTV / cohort analysis, new‑vs‑returning customer
metrics and CRO funnel reporting. Shopify's Analytics / ShopifyQL reporting API
(sales, sessions and customer reports) requires this access level; without it the
reporting endpoint returns ACCESS_DENIED and the merchant's dashboards cannot be
computed. Names are displayed only to the merchant, to identify their own
customers within segment lists.

**Level 2 — Email**
Required so the merchant can build and send marketing/lifecycle email campaigns to
their own customers via the merchant's own connected email service provider. The
email address is the audience identifier for campaigns the merchant chooses to
send. Level 2 access is also required by Shopify's Analytics/ShopifyQL reporting
API used to compute the merchant's dashboards.

**Level 2 — Phone, Address / Region**
Used primarily at an aggregated level for geographic breakdowns (sales and
customers by country/region) and to enrich the merchant's own customer profiles
for segmentation. Individual values are visible only to the merchant who owns the
store.

## 4) Data protection practices (campi/attestazioni "Data protection")

**Encryption & transport** — All data is transmitted over TLS/HTTPS and stored in
a managed PostgreSQL database (Supabase) encrypted at rest. Application hosting on
Vercel.

**Tenant isolation & access control** — Per‑tenant isolation is enforced at the
database layer with Row‑Level Security (RLS): each merchant can access only their
own data. Privileged/service database credentials are used server‑side only and
are never exposed to the browser. Staff access is limited to what is strictly
necessary to operate and support the service.

**Data minimization** — The app requests only the fields needed to deliver the
analytics and campaign features described above.

**Retention & deletion** — Data is retained while the merchant uses the app and is
deleted when the merchant uninstalls the app or requests deletion. The mandatory
Shopify compliance webhooks are implemented and wired:
`customers/redact`, `customers/data_request`, `shop/redact`
(endpoint `/api/shopify/webhooks/compliance`).

**AI processing** — Where AI is used to generate written insights, personally
identifiable information (name, email, phone, address) is removed/scrubbed before
any prompt is sent to third‑party AI providers; AI providers receive aggregated or
anonymized data only.

**Transparency & customer rights** — A public privacy policy is published at the
app URL (`/privacy`) describing what is collected and why; sub‑processors are
documented. Data access and deletion requests are honored via the Shopify
compliance webhooks and on direct request.

**Consent** — Marketing emails are sent only to the merchant's own customers and
only when the merchant initiates a campaign. LyftAI does not email on its own
behalf and respects unsubscribe/opt‑out handled by the merchant's email provider.

**Revocation** — Access is scoped per OAuth connection and can be revoked by the
merchant at any time by uninstalling the app or disconnecting the integration.

---

### Note (IT)
- Spunta tutte le attestazioni del form (privacy policy, encryption, data
  minimization, retention, right to be forgotten, limit access, monitoring): il
  testo sopra le copre tutte ed è veritiero rispetto all'architettura attuale.
- Verifica che siano effettivamente raggiungibili: la pagina **/privacy** e
  l'endpoint webhook **/api/shopify/webhooks/compliance** (già configurato
  nell'app, come da Partner Dashboard).
- Una volta approvato il **Level 2**, ShopifyQL riparte per TUTTI i clienti
  (CRO/Incrementalità/Attribuzione + range lunghi Dashboard, identici a STMN) e la
  tab Clienti mostra nomi/email. È app‑level → vale per ogni nuovo cliente.
