import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy · LyftAI',
  description: 'Informativa sulla privacy di LyftAI',
}

const ACCENT = '#bf5af2'
const BLUE = '#2997ff'

const h2 = { fontSize: 21, fontWeight: 800, marginTop: 38, marginBottom: 10, color: '#fff', letterSpacing: '-0.01em' }
const card = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '14px 18px', margin: '12px 0' }

// Pagina pubblica (no auth) — richiesta per Google Ads API / Shopify App Review.
// ⚠️ BOZZA da far validare a un legale prima del go-live.
export default function PrivacyPolicy() {
  const updated = '6 giugno 2026'
  return (
    <main style={{
      minHeight: '100vh', background: '#000', color: 'rgba(255,255,255,0.78)',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      lineHeight: 1.7, fontSize: 15, position: 'relative', overflowX: 'hidden',
    }}>
      {/* Glow decorativi coerenti con la landing */}
      <div style={{ position: 'fixed', top: -160, left: -120, width: 520, height: 520, borderRadius: '50%', background: `radial-gradient(circle, ${ACCENT}33, transparent 70%)`, filter: 'blur(40px)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: -180, right: -120, width: 520, height: 520, borderRadius: '50%', background: `radial-gradient(circle, ${BLUE}2e, transparent 70%)`, filter: 'blur(40px)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 1 }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.02em', background: `linear-gradient(90deg,#fff,${ACCENT} 60%,${BLUE})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>LyftAI</span>
          <Link href="/" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: 13.5 }}>← Torna al sito</Link>
        </div>

        <div style={{ padding: '46px 0 90px' }}>
          <h1 style={{ fontSize: 38, fontWeight: 900, marginBottom: 8, color: '#fff', letterSpacing: '-0.02em' }}>Privacy Policy</h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', marginTop: 0, fontSize: 13.5 }}>Ultimo aggiornamento: {updated}</p>

          <p>LyftAI ("noi", "l'applicazione") è una piattaforma di analytics e marketing intelligence per e-commerce. Questa informativa descrive quali dati trattiamo, come e perché, quando un commerciante ("merchant") collega i propri account (Shopify, Meta, Google, Klaviyo e altre piattaforme) a LyftAI.</p>

          <h2 style={h2}>1. Dati che trattiamo</h2>
          <p>Quando il merchant autorizza una connessione, LyftAI accede in <strong style={{ color: '#fff' }}>sola lettura</strong> ai dati necessari a generare report e analisi, tra cui:</p>
          <ul>
            <li><strong style={{ color: '#fff' }}>Shopify</strong>: ordini, prodotti, clienti (aggregati: numero ordini, spesa, data di acquisizione), report/analytics, inventario, sconti, evasioni. Usati per metriche di vendita, LTV, coorti, attribuzione.</li>
            <li><strong style={{ color: '#fff' }}>Piattaforme pubblicitarie</strong> (Meta, Google Ads, TikTok) e <strong style={{ color: '#fff' }}>analytics</strong> (Google Analytics 4): spesa, impression, click, conversioni, performance delle campagne.</li>
            <li><strong style={{ color: '#fff' }}>Email marketing</strong> (Klaviyo) e strumenti collegati (Gmail, Slack), secondo gli scope autorizzati.</li>
          </ul>
          <p>Non vendiamo né cediamo i dati a terzi per finalità di marketing. Non usiamo i dati personali dei clienti del merchant per profilazione propria.</p>

          <h2 style={h2}>2. Token di accesso</h2>
          <p>Le autorizzazioni OAuth e i token di accesso sono gestiti e custoditi tramite il nostro provider di integrazione (<strong style={{ color: '#fff' }}>Nango</strong>). I token sono cifrati e usati esclusivamente per leggere i dati del merchant che li ha autorizzati. Il merchant può revocarli in qualsiasi momento.</p>

          <h2 style={h2}>3. Finalità del trattamento</h2>
          <p>Trattiamo i dati esclusivamente per fornire al merchant le funzionalità di LyftAI: dashboard, KPI, report PDF, analisi di attribuzione, LTV/coorti, raccomandazioni e assistenti AI sui suoi stessi dati.</p>

          <h2 style={h2}>4. Dati Google e conformità Google API Services</h2>
          <p>Quando il merchant collega il proprio account Google, LyftAI richiede l'accesso in <strong style={{ color: '#fff' }}>sola lettura</strong> ai seguenti ambiti (scope), unicamente per mostrare al merchant i propri dati all'interno dell'applicazione:</p>
          <ul>
            <li><strong style={{ color: '#fff' }}>Google Ads API</strong> — performance delle campagne (spesa, impression, click, conversioni, ROAS).</li>
            <li><strong style={{ color: '#fff' }}>Google Analytics 4</strong> (<code>analytics.readonly</code>) — sessioni, sorgenti di traffico, conversioni.</li>
            <li><strong style={{ color: '#fff' }}>Google Search Console</strong> (<code>webmasters.readonly</code>) — query, impression e posizionamento organico.</li>
            <li><strong style={{ color: '#fff' }}>BigQuery</strong> (<code>bigquery.readonly</code>) — lettura di dataset di analytics, ove configurati dal merchant.</li>
          </ul>
          <div style={card}>
            <strong style={{ color: '#fff' }}>Limited Use disclosure.</strong> LyftAI's use and transfer to any other app of information received from Google APIs will adhere to the{' '}
            <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" style={{ color: BLUE }}>Google API Services User Data Policy</a>, including the Limited Use requirements. We do not use Google user data for advertising, do not sell it, and do not transfer it to third parties except as necessary to provide the service to the merchant who authorized access, to comply with applicable law, or as part of a merger/acquisition. We do not use Google user data to train generalized AI/ML models.
          </div>

          <h2 style={h2}>5. Sub-responsabili (sub-processors)</h2>
          <ul>
            <li><strong style={{ color: '#fff' }}>Vercel</strong> — hosting dell'applicazione</li>
            <li><strong style={{ color: '#fff' }}>Nango</strong> — gestione OAuth e token</li>
            <li><strong style={{ color: '#fff' }}>OpenAI</strong> — elaborazione delle richieste agli assistenti AI (dati aggregati di performance, non PII dei clienti)</li>
            <li><strong style={{ color: '#fff' }}>Browserless</strong> — generazione dei report PDF</li>
            <li><strong style={{ color: '#fff' }}>Supabase</strong> — autenticazione e dati applicativi dei merchant</li>
          </ul>

          <h2 style={h2}>6. Conservazione e cancellazione</h2>
          <p>LyftAI legge i dati di vendita e marketing prevalentemente in tempo reale e non conserva dati personali identificativi dei clienti finali oltre a quanto necessario per la cache tecnica. Il merchant può disconnettere una piattaforma in qualsiasi momento: in tal caso interrompiamo l'accesso e revochiamo i token. Per i dati Google, l'utente può inoltre revocare l'accesso da{' '}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" style={{ color: BLUE }}>Google Account → Sicurezza → App di terze parti</a>.</p>
          <p>Rispettiamo i webhook di conformità di Shopify:</p>
          <ul>
            <li><code>customers/data_request</code> — richiesta dati di un cliente</li>
            <li><code>customers/redact</code> — cancellazione dati di un cliente</li>
            <li><code>shop/redact</code> — cancellazione dati dello shop dopo la disinstallazione</li>
          </ul>

          <h2 style={h2}>7. Sicurezza</h2>
          <p>Usiamo connessioni cifrate (TLS), accesso ai dati con privilegio minimo (solo scope in lettura) e token gestiti in modo sicuro. L'accesso applicativo è protetto da autenticazione.</p>

          <h2 style={h2}>8. Diritti dell'interessato</h2>
          <p>I clienti finali del merchant possono esercitare i propri diritti (accesso, rettifica, cancellazione) tramite il merchant, titolare del trattamento. LyftAI agisce come responsabile del trattamento per conto del merchant.</p>

          <h2 style={h2}>9. Titolare e contatti</h2>
          <p><strong style={{ color: '#fff' }}>LYFT SRL</strong> — Via Corso Giuseppe Mazzini 223, San Benedetto del Tronto (AP) 63074 — P. IVA 02600730440.</p>
          <p>Per qualsiasi richiesta relativa alla privacy: <a href="mailto:info@lyftads.agency" style={{ color: BLUE }}>info@lyftads.agency</a></p>

          <p style={{ marginTop: 46, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Questo documento è una bozza tecnica e va validato da un consulente legale prima della pubblicazione definitiva.</p>
        </div>
      </div>
    </main>
  )
}
