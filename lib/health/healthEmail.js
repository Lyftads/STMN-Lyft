// ============================================================================
//  Email di avviso "integrazione scollegata", nella lingua del cliente.
//
//  Personalizzata col NOME AZIENDA della registrazione (companies.company_name)
//  e inviata all'indirizzo di registrazione (companies.email).
//
//  ATTENZIONE al destinatario: i workspace creati da un'agency hanno un utente
//  auth "shadow" con email ws_<uuid>@workspaces.lyftai.io, che NON e' una
//  casella vera. Per quei workspace l'avviso va all'AGENCY che li gestisce
//  (agency_clients), altrimenti la mail parte e non la legge nessuno — cioe'
//  esattamente il fallimento silenzioso che questo sistema deve eliminare.
// ============================================================================

const SHADOW_DOMAIN = '@workspaces.lyftai.io'

const PROVIDER_LABEL = {
  meta: 'Meta (Facebook e Instagram Ads)',
  google: 'Google (Ads, Analytics, Search Console)',
  shopify: 'Shopify',
  klaviyo: 'Klaviyo',
}

// Cosa smette di aggiornarsi, per far capire l'impatto reale invece di un
// generico "errore di connessione".
const IMPACT = {
  meta: { it: 'spesa, ROAS e performance delle campagne Meta', en: 'Meta spend, ROAS and campaign performance', es: 'gasto, ROAS y rendimiento de las campañas de Meta', fr: 'dépenses, ROAS et performances des campagnes Meta', de: 'Meta-Ausgaben, ROAS und Kampagnen-Performance' },
  google: { it: 'spesa Google Ads, dati Analytics e Search Console', en: 'Google Ads spend, Analytics and Search Console data', es: 'gasto de Google Ads, datos de Analytics y Search Console', fr: 'dépenses Google Ads, données Analytics et Search Console', de: 'Google-Ads-Ausgaben, Analytics- und Search-Console-Daten' },
  shopify: { it: 'ordini, fatturato e dati prodotto', en: 'orders, revenue and product data', es: 'pedidos, facturación y datos de producto', fr: 'commandes, chiffre d affaires et données produit', de: 'Bestellungen, Umsatz und Produktdaten' },
  klaviyo: { it: 'campagne email, flussi e revenue attribuita', en: 'email campaigns, flows and attributed revenue', es: 'campañas de email, flujos e ingresos atribuidos', fr: 'campagnes email, flux et revenus attribués', de: 'E-Mail-Kampagnen, Flows und zugeordneter Umsatz' },
}

const T = {
  it: {
    subject: (b, p) => `${b}: ${p} si è scollegato da LyftAI`,
    hi: (b) => `Ciao ${b},`,
    lead: (p) => `la connessione a <b>${p}</b> non è più attiva e LyftAI non riesce più a leggere i tuoi dati.`,
    what: 'Cosa vuol dire',
    whatBody: (i) => `Finché la connessione resta interrotta, i dati di ${i} non si aggiornano. I numeri che vedi nella dashboard per questo canale sono fermi all ultimo aggiornamento riuscito, quindi potrebbero risultare incompleti.`,
    fix: 'Come si risolve',
    fixBody: 'Serve un minuto: entra in LyftAI, vai su Integrazioni e ricollega. Non devi reinserire nulla a mano e non perdi nessuno storico.',
    cta: 'Ricollega ora',
    why: 'Perché succede',
    whyBody: 'Di solito è la normale scadenza dell autorizzazione, oppure una password cambiata o un permesso rimosso sull account del canale. Non è un problema del tuo abbonamento.',
    detail: 'Dettaglio tecnico',
    help: 'Se dopo il tentativo il problema resta, rispondi a questa email e ci pensiamo noi.',
    sign: 'Il team LyftAI',
  },
  en: {
    subject: (b, p) => `${b}: ${p} has disconnected from LyftAI`,
    hi: (b) => `Hi ${b},`,
    lead: (p) => `the connection to <b>${p}</b> is no longer active and LyftAI can no longer read your data.`,
    what: 'What this means',
    whatBody: (i) => `While the connection is down, ${i} will not update. The numbers you see in the dashboard for this channel are frozen at the last successful sync, so they may be incomplete.`,
    fix: 'How to fix it',
    fixBody: 'It takes a minute: open LyftAI, go to Integrations and reconnect. Nothing needs to be re-entered by hand and no history is lost.',
    cta: 'Reconnect now',
    why: 'Why it happens',
    whyBody: 'Usually the authorisation simply expired, or a password was changed or a permission removed on the channel account. It is not a problem with your subscription.',
    detail: 'Technical detail',
    help: 'If the problem persists after reconnecting, just reply to this email and we will take care of it.',
    sign: 'The LyftAI team',
  },
  es: {
    subject: (b, p) => `${b}: ${p} se ha desconectado de LyftAI`,
    hi: (b) => `Hola ${b}:`,
    lead: (p) => `la conexión con <b>${p}</b> ya no está activa y LyftAI no puede leer tus datos.`,
    what: 'Qué significa',
    whatBody: (i) => `Mientras la conexión esté interrumpida, ${i} no se actualizan. Las cifras que ves en el panel para este canal se han quedado en la última sincronización correcta, así que pueden estar incompletas.`,
    fix: 'Cómo se soluciona',
    fixBody: 'Es cuestión de un minuto: entra en LyftAI, ve a Integraciones y vuelve a conectar. No hay que reintroducir nada a mano y no se pierde ningún histórico.',
    cta: 'Reconectar ahora',
    why: 'Por qué ocurre',
    whyBody: 'Normalmente es el vencimiento normal de la autorización, o una contraseña cambiada o un permiso retirado en la cuenta del canal. No es un problema de tu suscripción.',
    detail: 'Detalle técnico',
    help: 'Si tras reconectar el problema sigue, responde a este correo y nos encargamos nosotros.',
    sign: 'El equipo de LyftAI',
  },
  fr: {
    subject: (b, p) => `${b} : ${p} s est déconnecté de LyftAI`,
    hi: (b) => `Bonjour ${b},`,
    lead: (p) => `la connexion à <b>${p}</b> n est plus active et LyftAI ne peut plus lire vos données.`,
    what: 'Ce que cela signifie',
    whatBody: (i) => `Tant que la connexion est interrompue, ${i} ne se mettent plus à jour. Les chiffres affichés dans le tableau de bord pour ce canal restent figés à la dernière synchronisation réussie et peuvent donc être incomplets.`,
    fix: 'Comment résoudre',
    fixBody: 'Cela prend une minute : ouvrez LyftAI, allez dans Intégrations et reconnectez. Rien à ressaisir à la main et aucun historique perdu.',
    cta: 'Reconnecter maintenant',
    why: 'Pourquoi cela arrive',
    whyBody: 'Il s agit le plus souvent de l expiration normale de l autorisation, ou d un mot de passe modifié ou d une permission retirée sur le compte du canal. Cela ne concerne pas votre abonnement.',
    detail: 'Détail technique',
    help: 'Si le problème persiste après la reconnexion, répondez simplement à cet email et nous nous en occupons.',
    sign: 'L équipe LyftAI',
  },
  de: {
    subject: (b, p) => `${b}: ${p} wurde von LyftAI getrennt`,
    hi: (b) => `Hallo ${b},`,
    lead: (p) => `die Verbindung zu <b>${p}</b> ist nicht mehr aktiv und LyftAI kann Ihre Daten nicht mehr lesen.`,
    what: 'Was das bedeutet',
    whatBody: (i) => `Solange die Verbindung unterbrochen ist, werden ${i} nicht aktualisiert. Die Zahlen im Dashboard für diesen Kanal stehen auf dem Stand der letzten erfolgreichen Synchronisierung und können daher unvollständig sein.`,
    fix: 'So beheben Sie es',
    fixBody: 'Es dauert eine Minute: Öffnen Sie LyftAI, gehen Sie zu Integrationen und verbinden Sie erneut. Nichts muss manuell neu eingegeben werden, es geht kein Verlauf verloren.',
    cta: 'Jetzt neu verbinden',
    why: 'Warum das passiert',
    whyBody: 'Meist ist die Autorisierung schlicht abgelaufen, oder ein Passwort wurde geändert bzw. eine Berechtigung im Kanal-Konto entfernt. Es liegt nicht an Ihrem Abonnement.',
    detail: 'Technisches Detail',
    help: 'Falls das Problem nach dem Neuverbinden bestehen bleibt, antworten Sie einfach auf diese E-Mail und wir kümmern uns darum.',
    sign: 'Ihr LyftAI-Team',
  },
}

export function normLocale(l) {
  const s = String(l || '').slice(0, 2).toLowerCase()
  return T[s] ? s : 'it'
}

const esc = (s) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

// Destinatario reale. REGOLA: workspace gestito da un agency → l avviso va
// all AGENCY; azienda diretta → alla sua email di registrazione.
//
// Il segnale autoritativo e' `is_client_workspace`, NON l indirizzo shadow:
// oggi i due coincidono, ma se un workspace cliente avesse un email reale
// l avviso scavalcherebbe l agency che lo gestisce. L indirizzo shadow resta
// come rete di sicurezza per le righe piu' vecchie senza il flag.
export async function resolveRecipient(admin, company) {
  const own = String(company?.email || '').trim()
  const isShadow = !own || own.toLowerCase().endsWith(SHADOW_DOMAIN)
  const managed = company?.is_client_workspace === true || isShadow
  const ownUsable = own && !isShadow ? own : null

  if (!managed) return { email: ownUsable, viaAgency: false }

  try {
    const { data: map } = await admin.from('agency_clients')
      .select('agency_user_id').eq('client_user_id', company.user_id).limit(1)
    const agencyId = map?.[0]?.agency_user_id
    if (agencyId) {
      const { data: ag } = await admin.from('companies')
        .select('email, company_name, language').eq('user_id', agencyId).limit(1)
      const agEmail = String(ag?.[0]?.email || '').trim()
      if (agEmail && !agEmail.toLowerCase().endsWith(SHADOW_DOMAIN)) {
        return { email: agEmail, viaAgency: true, agencyLocale: ag[0]?.language || null }
      }
    }
    // Nessuna agency raggiungibile: se il workspace ha comunque un email
    // reale la si usa, meglio che non avvisare nessuno.
    return { email: ownUsable, viaAgency: false }
  } catch {
    return { email: ownUsable, viaAgency: false }
  }
}

export function buildHealthEmail({ companyName, provider, locale, error, viaAgency = false }) {
  const L = normLocale(locale)
  const t = T[L]
  const brand = companyName || 'LyftAI'
  const label = PROVIDER_LABEL[provider] || provider
  const impact = (IMPACT[provider] || {})[L] || (IMPACT[provider] || {}).it || provider
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://lyftai.io'

  // Quando l avviso arriva all agency, il nome del cliente va nell oggetto:
  // l agency ne gestisce diversi e deve capire subito di chi si tratta.
  const subject = t.subject(brand, label)

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="background:#ffffff;border-radius:14px;padding:32px;border:1px solid #e6e8ec;">
      <div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7b5bff;margin-bottom:20px;">LyftAI</div>
      <p style="font-size:16px;color:#1a1a1a;margin:0 0 14px;">${esc(t.hi(brand))}</p>
      <p style="font-size:15px;line-height:1.6;color:#33363d;margin:0 0 24px;">${t.lead(esc(label))}</p>

      <div style="background:#fff8e6;border:1px solid #f2d48a;border-radius:10px;padding:16px 18px;margin:0 0 24px;">
        <div style="font-size:13px;font-weight:700;color:#8a6100;margin-bottom:6px;">${esc(t.what)}</div>
        <div style="font-size:14px;line-height:1.6;color:#5c4a1e;">${esc(t.whatBody(impact))}</div>
      </div>

      <div style="font-size:13px;font-weight:700;color:#1a1a1a;margin:0 0 6px;">${esc(t.fix)}</div>
      <p style="font-size:14px;line-height:1.6;color:#33363d;margin:0 0 20px;">${esc(t.fixBody)}</p>

      <a href="${appUrl}" style="display:inline-block;background:#7b5bff;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:13px 26px;border-radius:999px;">${esc(t.cta)}</a>

      <div style="font-size:13px;font-weight:700;color:#1a1a1a;margin:28px 0 6px;">${esc(t.why)}</div>
      <p style="font-size:14px;line-height:1.6;color:#33363d;margin:0 0 20px;">${esc(t.whyBody)}</p>

      ${error ? `<div style="border-top:1px solid #e6e8ec;padding-top:16px;margin-top:8px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#9aa0aa;margin-bottom:6px;">${esc(t.detail)}</div>
        <div style="font-size:12px;line-height:1.5;color:#6b7280;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${esc(error)}</div>
      </div>` : ''}

      <p style="font-size:13px;line-height:1.6;color:#6b7280;margin:22px 0 0;">${esc(t.help)}</p>
      <p style="font-size:14px;color:#33363d;margin:18px 0 0;">${esc(t.sign)}</p>
    </div>
  </div>
</body></html>`

  return { subject, html }
}
