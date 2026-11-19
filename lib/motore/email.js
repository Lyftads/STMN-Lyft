// Avviso via email quando il motore produce un lotto nuovo.
//
// Perché serve: un motore che gira da solo e non dice niente è indistinguibile
// da un motore fermo. L'email è il solo punto in cui il sistema ammette di
// aver fatto qualcosa — e, soprattutto, di NON averlo fatto.
export function destinatari() {
  const raw = process.env.CE_EMAIL_A || ''
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

export async function invia({ oggetto, html, testo }) {
  const key = process.env.RESEND_API_KEY
  const a = destinatari()
  if (!key) return { inviata: false, perche: 'RESEND_API_KEY mancante' }
  if (!a.length) return { inviata: false, perche: 'CE_EMAIL_A mancante' }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.CE_EMAIL_DA || 'Motore Creativo <onboarding@resend.dev>',
      to: a, subject: oggetto, html, text: testo,
    }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) return { inviata: false, perche: `Resend ${r.status}: ${j.message || ''}` }
  return { inviata: true, id: j.id }
}

// Il corpo dell'email: cosa è stato prodotto e perché, non solo quante.
export function corpoLotto({ lotto, crediti, saltati }) {
  const riga = (c) => `<tr>
    <td style="padding:7px 10px;border-bottom:1px solid #1c1c26;color:#c4c4cc;font-size:13px">${c.name}</td>
    <td style="padding:7px 10px;border-bottom:1px solid #1c1c26;color:#8b8b96;font-size:12px">${c.angolo || '—'} · ${c.formato || 'formato libero'} · ${c.funnel || '—'}</td>
  </tr>`
  const perche = [...new Set(lotto.map(c => c.briefMotivo).filter(Boolean))]
  return `<div style="background:#000;padding:26px;font-family:-apple-system,Segoe UI,sans-serif">
    <div style="max-width:640px;margin:0 auto;background:#0a0a14;border:1px solid #1c1c26;border-radius:16px;padding:24px">
      <h1 style="color:#f5f5f7;font-size:18px;margin:0 0 4px">${lotto.length} creatività nuove</h1>
      <p style="color:#8b8b96;font-size:13px;margin:0 0 18px">prodotte dal motore, in 1:1 e 9:16, con copy CTA e link già pronti</p>
      ${perche.length ? `<div style="border-left:2px solid #2997ff;padding:9px 13px;background:#0f0f1a;border-radius:0 8px 8px 0;margin-bottom:18px">
        ${perche.map(p => `<p style="color:#c4c4cc;font-size:12.5px;line-height:1.6;margin:0 0 6px">${p}</p>`).join('')}
      </div>` : ''}
      <table style="width:100%;border-collapse:collapse">${lotto.map(riga).join('')}</table>
      ${saltati?.length ? `<p style="color:#ffd60a;font-size:12.5px;margin-top:16px">${saltati.length} non prodotte: ${saltati.join(' · ')}</p>` : ''}
      <p style="color:#8b8b96;font-size:12px;margin-top:20px;padding-top:14px;border-top:1px solid #1c1c26">
        Crediti immagini rimasti: <b style="color:#e9e9ee">${crediti ?? '?'}</b>${crediti != null ? ` — circa ${Math.floor(crediti / 3)} scene` : ''}
      </p>
    </div></div>`
}
