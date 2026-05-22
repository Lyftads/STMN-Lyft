# 🚀 STMN Fitness — LTV:CAC Dashboard

Dashboard automatica che si aggiorna ogni ora collegandosi a **Shopify**, **Meta Ads** e **Google Ads**.

---

## 📋 GUIDA DEPLOY — NESSUNA COMPETENZA TECNICA RICHIESTA

### STEP 1 — Crea account GitHub (5 minuti)
1. Vai su [github.com](https://github.com) → **Sign up**
2. Inserisci email, password, username
3. Verifica l'email

### STEP 2 — Carica il progetto su GitHub (3 minuti)
1. Accedi a GitHub → clicca **+** in alto a destra → **New repository**
2. Nome: `stmn-dashboard` → **Create repository**
3. Clicca **uploading an existing file**
4. Trascina tutti i file di questa cartella → **Commit changes**

### STEP 3 — Deploy su Vercel (5 minuti)
1. Vai su [vercel.com](https://vercel.com) → **Sign Up with GitHub**
2. Clicca **Add New Project** → seleziona `stmn-dashboard`
3. Clicca **Deploy** (lascia tutto come default)
4. Aspetta 2 minuti — ricevi un URL tipo `stmn-dashboard.vercel.app`

### STEP 4 — Aggiungi le credenziali API (10-20 minuti)
In Vercel: **Settings → Environment Variables** → aggiungi una per una:

---

## 🛒 SHOPIFY — Come ottenere le credenziali

**Tempo: 5 minuti**

1. Shopify Admin → **Settings** (in basso a sinistra)
2. **Apps and sales channels** → **Develop apps**
3. Clicca **Allow custom app development** (se richiesto)
4. **Create an app** → Nome: `STMN Dashboard` → Create app
5. Tab **Configuration** → **Admin API integration** → Edit
6. Seleziona questi permessi:
   - `read_orders` ✅
   - `read_customers` ✅
   - `read_analytics` ✅
7. **Save** → Tab **API credentials** → **Install app**
8. Copia **Admin API access token** (mostrato UNA sola volta → salvalo!)

**Variabili da inserire in Vercel:**
```
SHOPIFY_STORE_URL     = stmn-fitness.myshopify.com
SHOPIFY_ADMIN_TOKEN   = shpat_xxxx... (quello che hai copiato)
```

---

## 📘 META ADS — Come ottenere le credenziali

**Tempo: 10 minuti**

1. Vai su [business.facebook.com](https://business.facebook.com)
2. **Business Settings** (ingranaggio in alto a sinistra)
3. **Users → System Users** → **Add** → Nome: `stmn-dashboard` → Role: Admin → **Create system user**
4. **Add Assets** → **Ad Accounts** → seleziona il tuo account → **Analyst** → Save
5. **Generate new token** → seleziona app → seleziona:
   - `ads_read` ✅
   - `read_insights` ✅
   - `business_management` ✅
6. **Generate token** → copia il token

Per trovare il tuo **Ad Account ID**:
- Vai su [adsmanager.facebook.com](https://adsmanager.facebook.com)
- Guarda l'URL → troverai un numero tipo `123456789012345`
- Il tuo ID sarà `act_123456789012345`

**Variabili da inserire in Vercel:**
```
META_ACCESS_TOKEN   = EAAxxxx...
META_AD_ACCOUNT_ID  = act_123456789012345
```

---

## 🔍 GOOGLE ADS — Come ottenere le credenziali

**Tempo: 20 minuti (più complesso)**

### Parte A — Developer Token
1. Vai su [ads.google.com](https://ads.google.com) → account principale
2. **Tools → API Center** → richiedi accesso API
3. Il Developer Token ti arriva via email (può richiedere 1-2 giorni)

### Parte B — OAuth Credentials
1. Vai su [console.cloud.google.com](https://console.cloud.google.com)
2. Crea un nuovo progetto: **New Project** → `stmn-dashboard`
3. **APIs & Services → Library** → cerca `Google Ads API` → **Enable**
4. **APIs & Services → Credentials → Create Credentials → OAuth Client ID**
5. Tipo: **Web application** → Nome: `stmn-dashboard`
6. Authorized redirect URIs: `https://developers.google.com/oauthplayground`
7. **Create** → copia **Client ID** e **Client Secret**

### Parte C — Refresh Token
1. Vai su [oauth2.googleapis.com/auth](https://developers.google.com/oauthplayground)
2. In alto a destra ⚙️ → **Use your own OAuth credentials** → inserisci Client ID e Secret
3. Cerca e seleziona: `Google Ads API v16` → **Authorize APIs**
4. Accedi con il tuo account Google Ads → **Exchange authorization code for tokens**
5. Copia il **Refresh token**

### Parte D — Customer ID
- In Google Ads Manager, il numero in alto a destra (es. `123-456-7890`)
- Rimuovi i trattini → `1234567890`

**Variabili da inserire in Vercel:**
```
GOOGLE_ADS_DEVELOPER_TOKEN  = xxxxxxxxxx
GOOGLE_ADS_CUSTOMER_ID      = 1234567890
GOOGLE_CLIENT_ID            = xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET        = GOCSPX-xxxx
GOOGLE_REFRESH_TOKEN        = 1//xxxx
```

---

## ⚙️ IMPOSTAZIONI FINALI

In Vercel → Environment Variables, aggiungi anche:

```
GROSS_MARGIN             = 0.40   (40% — modifica con il tuo margine reale)
NEXT_PUBLIC_BASE_URL     = https://stmn-dashboard.vercel.app  (il tuo URL Vercel)
```

Dopo aver aggiunto le variabili → **Redeploy** (Deployments → tre puntini → Redeploy)

---

## 🔄 Come funziona l'aggiornamento automatico

- I dati si aggiornano **ogni ora** automaticamente (Vercel Edge Cache)
- Puoi forzare un aggiornamento con il tasto 🔄 nella dashboard
- Vercel offre **100 ore di deploy gratis/mese** — più che sufficienti

---

## ❓ Problemi comuni

**"Shopify API error: 401"** → Il token non è corretto o l'app non è installata. Ripeti lo Step Shopify.

**"Meta error: Token expired"** → Il token Meta scade. Rigenera seguendo la Parte A di Meta.

**"Google OAuth fallito"** → Verifica che il Refresh Token sia stato copiato correttamente.

**I dati Meta/Google non appaiono** → La dashboard funziona anche solo con Shopify. Meta e Google sono opzionali per il calcolo dell'LTV. Per il CAC sono necessari.

---

## 📊 Metriche calcolate

| Metrica | Fonte | Formula |
|---------|-------|---------|
| AOV | Shopify | Fatturato ÷ Ordini |
| Frequenza | Shopify | Ordini ÷ Clienti unici |
| Vita media | Shopify | 1 ÷ Churn Rate |
| Churn Rate | Shopify | Clienti senza ordini 365gg ÷ Totale |
| LTV Lordo | Calcolato | AOV × Freq × Vita |
| LTV Netto | Calcolato | LTV Lordo × Margine % |
| CAC | Meta + Google | Spesa totale ÷ Nuovi clienti |
| Ratio LTV:CAC | Calcolato | LTV Netto ÷ CAC |

---

Creato per STMN Fitness — Maggio 2026
