export const metadata = {
  title: 'Termini di Servizio · LyftAI',
  description: 'Termini di servizio di LyftAI',
}

// Pagina pubblica (no auth) richiesta per la schermata consenso OAuth Google.
// ⚠️ BOZZA da far validare a un legale prima del go-live.
export default function TermsOfService() {
  const updated = '4 giugno 2026'
  return (
    <main style={{
      maxWidth: 820, margin: '0 auto', padding: '56px 24px 96px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      color: '#1a1a1a', background: '#fff', lineHeight: 1.65, fontSize: 15,
    }}>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 6 }}>Termini di Servizio — LyftAI</h1>
      <p style={{ color: '#666', marginTop: 0 }}>Ultimo aggiornamento: {updated}</p>

      <p>I presenti Termini di Servizio ("Termini") regolano l'utilizzo di LyftAI ("il Servizio", "noi"), piattaforma di analytics e marketing intelligence per e-commerce. Utilizzando il Servizio, l'utente ("tu", "il merchant") accetta i presenti Termini.</p>

      <h2 style={h2}>1. Descrizione del servizio</h2>
      <p>LyftAI consente al merchant di collegare i propri account (Shopify, Meta, Google, GA4, Klaviyo e altre piattaforme) per visualizzare dashboard, KPI, report, analisi di attribuzione, LTV/coorti e raccomandazioni basate sui propri dati. L'accesso ai dati collegati avviene in <strong>sola lettura</strong>.</p>

      <h2 style={h2}>2. Account e accesso</h2>
      <p>Il merchant è responsabile della riservatezza delle proprie credenziali e di tutte le attività svolte tramite il proprio account. Le autorizzazioni alle piattaforme collegate possono essere revocate in qualsiasi momento disconnettendo l'integrazione.</p>

      <h2 style={h2}>3. Uso consentito</h2>
      <p>Il merchant si impegna a utilizzare il Servizio in conformità alle leggi applicabili e ai termini delle piattaforme collegate (incluse le policy di Google API Services, Shopify e Meta). È vietato tentare di accedere a dati di altri merchant, effettuare reverse engineering o usare il Servizio per finalità illecite.</p>

      <h2 style={h2}>4. Dati e privacy</h2>
      <p>Il trattamento dei dati è descritto nella nostra <a href="/privacy">Privacy Policy</a>. LyftAI agisce come responsabile del trattamento per conto del merchant, titolare dei dati dei propri clienti. L'uso dei dati ottenuti dalle API Google rispetta la <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>, inclusi i requisiti di Limited Use.</p>

      <h2 style={h2}>5. Disponibilità e modifiche</h2>
      <p>Ci impegniamo a mantenere il Servizio disponibile, ma non garantiamo un funzionamento ininterrotto o privo di errori. Possiamo modificare, sospendere o interrompere funzionalità del Servizio, dandone comunicazione quando ragionevolmente possibile.</p>

      <h2 style={h2}>6. Limitazione di responsabilità</h2>
      <p>Il Servizio è fornito "così com'è". Nei limiti consentiti dalla legge, LyftAI non è responsabile per danni indiretti, perdita di dati o mancati guadagni derivanti dall'uso del Servizio. Le decisioni di business basate sui report restano responsabilità del merchant.</p>

      <h2 style={h2}>7. Cessazione</h2>
      <p>Il merchant può cessare l'utilizzo del Servizio in qualsiasi momento. Possiamo sospendere o chiudere un account in caso di violazione dei presenti Termini. Alla cessazione, gli accessi alle piattaforme collegate vengono revocati.</p>

      <h2 style={h2}>8. Contatti</h2>
      <p>Per qualsiasi richiesta relativa ai presenti Termini: <a href="mailto:support@lyftai.io">support@lyftai.io</a></p>

      <p style={{ marginTop: 40, fontSize: 12, color: '#999' }}>Questo documento è una bozza tecnica e va validato da un consulente legale prima della pubblicazione definitiva.</p>
    </main>
  )
}

const h2 = { fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 8 }
