export const metadata = {
  title: 'Privacy Policy · LyftAI',
  description: 'Informativa sulla privacy di LyftAI',
}

// Pagina pubblica (no auth) richiesta per la App Review Shopify.
// ⚠️ BOZZA da far validare a un legale prima del go-live.
export default function PrivacyPolicy() {
  const updated = '3 giugno 2026'
  return (
    <main style={{
      maxWidth: 820, margin: '0 auto', padding: '56px 24px 96px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      color: '#1a1a1a', background: '#fff', lineHeight: 1.65, fontSize: 15,
    }}>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 6 }}>Privacy Policy — LyftAI</h1>
      <p style={{ color: '#666', marginTop: 0 }}>Ultimo aggiornamento: {updated}</p>

      <p>LyftAI ("noi", "l'applicazione") è una piattaforma di analytics e marketing intelligence per e-commerce. Questa informativa descrive quali dati trattiamo, come e perché, quando un commerciante ("merchant") collega i propri account (Shopify, Meta, Google, Klaviyo e altre piattaforme) a LyftAI.</p>

      <h2 style={h2}>1. Dati che trattiamo</h2>
      <p>Quando il merchant autorizza una connessione, LyftAI accede in <strong>sola lettura</strong> ai dati necessari a generare report e analisi, tra cui:</p>
      <ul>
        <li><strong>Shopify</strong>: ordini, prodotti, clienti (aggregati: numero ordini, spesa, data di acquisizione), report/analytics, inventario, sconti, evasioni. Usiamo questi dati per metriche di vendita, LTV, coorti, attribuzione.</li>
        <li><strong>Piattaforme pubblicitarie</strong> (Meta, Google Ads, TikTok) e <strong>analytics</strong> (GA4): spesa, impression, click, conversioni, performance delle campagne.</li>
        <li><strong>Email marketing</strong> (Klaviyo) e strumenti collegati (Gmail, Slack), secondo gli scope autorizzati.</li>
      </ul>
      <p>Non vendiamo né cediamo i dati a terzi per finalità di marketing. Non usiamo i dati personali dei clienti del merchant per profilazione propria.</p>

      <h2 style={h2}>2. Token di accesso</h2>
      <p>Le autorizzazioni OAuth e i token di accesso sono gestiti e custoditi tramite il nostro provider di integrazione (<strong>Nango</strong>). I token sono cifrati e usati esclusivamente per leggere i dati del merchant che li ha autorizzati.</p>

      <h2 style={h2}>3. Finalità del trattamento</h2>
      <p>Trattiamo i dati esclusivamente per fornire al merchant le funzionalità di LyftAI: dashboard, KPI, report PDF, analisi di attribuzione, LTV/coorti, raccomandazioni e assistenti AI sui suoi stessi dati.</p>

      <h2 style={h2}>4. Sub-responsabili (sub-processors)</h2>
      <ul>
        <li><strong>Vercel</strong> — hosting dell'applicazione</li>
        <li><strong>Nango</strong> — gestione OAuth e token</li>
        <li><strong>OpenAI</strong> — elaborazione delle richieste agli assistenti AI (vengono inviati dati aggregati di performance, non PII dei clienti)</li>
        <li><strong>Browserless</strong> — generazione dei report PDF</li>
        <li><strong>Supabase</strong> — autenticazione e dati applicativi dei merchant</li>
      </ul>

      <h2 style={h2}>5. Conservazione e cancellazione</h2>
      <p>LyftAI legge i dati di vendita e marketing prevalentemente in tempo reale e non conserva dati personali identificativi dei clienti finali oltre a quanto necessario per la cache tecnica. Il merchant può disconnettere una piattaforma in qualsiasi momento: in tal caso interrompiamo l'accesso e revochiamo i token.</p>
      <p>Rispettiamo i webhook di conformità di Shopify:</p>
      <ul>
        <li><code>customers/data_request</code> — richiesta dati di un cliente</li>
        <li><code>customers/redact</code> — cancellazione dati di un cliente</li>
        <li><code>shop/redact</code> — cancellazione dati dello shop dopo la disinstallazione</li>
      </ul>

      <h2 style={h2}>6. Sicurezza</h2>
      <p>Usiamo connessioni cifrate (TLS), accesso ai dati con privilegio minimo (solo scope in lettura) e token gestiti in modo sicuro. L'accesso applicativo è protetto da autenticazione.</p>

      <h2 style={h2}>7. Diritti dell'interessato</h2>
      <p>I clienti finali del merchant possono esercitare i propri diritti (accesso, rettifica, cancellazione) tramite il merchant, titolare del trattamento. LyftAI agisce come responsabile del trattamento per conto del merchant.</p>

      <h2 style={h2}>8. Contatti</h2>
      <p>Per qualsiasi richiesta relativa alla privacy: <a href="mailto:privacy@lyftai.io">privacy@lyftai.io</a></p>

      <p style={{ marginTop: 40, fontSize: 12, color: '#999' }}>Questo documento è una bozza tecnica e va validato da un consulente legale prima della pubblicazione definitiva.</p>
    </main>
  )
}

const h2 = { fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 8 }
