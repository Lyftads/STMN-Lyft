import Link from 'next/link'

export const metadata = {
  title: 'Termini di Servizio · LyftAI',
  description: 'Termini di servizio di LyftAI',
}

const ACCENT = '#bf5af2'
const BLUE = '#2997ff'
const h2 = { fontSize: 21, fontWeight: 800, marginTop: 38, marginBottom: 10, color: '#fff', letterSpacing: '-0.01em' }

// Pagina pubblica (no auth) richiesta per la schermata consenso OAuth Google.
// ⚠️ BOZZA da far validare a un legale prima del go-live.
export default function TermsOfService() {
  const updated = '6 giugno 2026'
  return (
    <main style={{
      minHeight: '100vh', background: '#000', color: 'rgba(255,255,255,0.78)',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      lineHeight: 1.7, fontSize: 15, position: 'relative', overflowX: 'hidden',
    }}>
      <div style={{ position: 'fixed', top: -160, left: -120, width: 520, height: 520, borderRadius: '50%', background: `radial-gradient(circle, ${ACCENT}33, transparent 70%)`, filter: 'blur(40px)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: -180, right: -120, width: 520, height: 520, borderRadius: '50%', background: `radial-gradient(circle, ${BLUE}2e, transparent 70%)`, filter: 'blur(40px)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.02em', background: `linear-gradient(90deg,#fff,${ACCENT} 60%,${BLUE})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>LyftAI</span>
          <Link href="/" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: 13.5 }}>← Torna al sito</Link>
        </div>

        <div style={{ padding: '46px 0 90px' }}>
          <h1 style={{ fontSize: 38, fontWeight: 900, marginBottom: 8, color: '#fff', letterSpacing: '-0.02em' }}>Termini di Servizio</h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', marginTop: 0, fontSize: 13.5 }}>Ultimo aggiornamento: {updated}</p>

          <p>I presenti Termini di Servizio ("Termini") regolano l'utilizzo di LyftAI ("il Servizio", "noi"), piattaforma di analytics e marketing intelligence per e-commerce. Utilizzando il Servizio, l'utente ("tu", "il merchant") accetta i presenti Termini.</p>

          <h2 style={h2}>1. Descrizione del servizio</h2>
          <p>LyftAI consente al merchant di collegare i propri account (Shopify, Meta, Google, GA4, Klaviyo e altre piattaforme) per visualizzare dashboard, KPI, report, analisi di attribuzione, LTV/coorti e raccomandazioni basate sui propri dati. L'accesso ai dati collegati avviene in <strong style={{ color: '#fff' }}>sola lettura</strong>.</p>

          <h2 style={h2}>2. Account e accesso</h2>
          <p>Il merchant è responsabile della riservatezza delle proprie credenziali e di tutte le attività svolte tramite il proprio account. Le autorizzazioni alle piattaforme collegate possono essere revocate in qualsiasi momento disconnettendo l'integrazione.</p>

          <h2 style={h2}>3. Uso consentito</h2>
          <p>Il merchant si impegna a utilizzare il Servizio in conformità alle leggi applicabili e ai termini delle piattaforme collegate (incluse le policy di Google API Services, Shopify e Meta). È vietato tentare di accedere a dati di altri merchant, effettuare reverse engineering o usare il Servizio per finalità illecite.</p>

          <h2 style={h2}>4. Dati e privacy</h2>
          <p>Il trattamento dei dati è descritto nella nostra <Link href="/privacy" style={{ color: BLUE }}>Privacy Policy</Link>. LyftAI agisce come responsabile del trattamento per conto del merchant, titolare dei dati dei propri clienti. L'uso dei dati ottenuti dalle API Google rispetta la <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" style={{ color: BLUE }}>Google API Services User Data Policy</a>, inclusi i requisiti di Limited Use.</p>

          <h2 style={h2}>5. Disponibilità e modifiche</h2>
          <p>Ci impegniamo a mantenere il Servizio disponibile, ma non garantiamo un funzionamento ininterrotto o privo di errori. Possiamo modificare, sospendere o interrompere funzionalità del Servizio, dandone comunicazione quando ragionevolmente possibile.</p>

          <h2 style={h2}>6. Limitazione di responsabilità</h2>
          <p>Il Servizio è fornito "così com'è". Nei limiti consentiti dalla legge, LyftAI non è responsabile per danni indiretti, perdita di dati o mancati guadagni derivanti dall'uso del Servizio. Le decisioni di business basate sui report restano responsabilità del merchant.</p>

          <h2 style={h2}>7. Cessazione</h2>
          <p>Il merchant può cessare l'utilizzo del Servizio in qualsiasi momento. Possiamo sospendere o chiudere un account in caso di violazione dei presenti Termini. Alla cessazione, gli accessi alle piattaforme collegate vengono revocati.</p>

          <h2 style={h2}>8. Contatti</h2>
          <p><strong style={{ color: '#fff' }}>LYFT SRL</strong> — P. IVA 02600730440. Per richieste relative ai presenti Termini: <a href="mailto:info@lyftads.agency" style={{ color: BLUE }}>info@lyftads.agency</a></p>

          <p style={{ marginTop: 46, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Questo documento è una bozza tecnica e va validato da un consulente legale prima della pubblicazione definitiva.</p>
        </div>
      </div>
    </main>
  )
}
