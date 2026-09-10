export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getKlaviyo } from '../../../../lib/tenant/credentials'

// ============================================================================
//  Anteprima di una campagna email.
//
//  Quello che serve per capire cosa e' partito, nell'ordine in cui lo si
//  guarda: a chi va (liste e segmenti), che oggetto ha, che anteprima si legge
//  in casella, da chi arriva, e infine l'email intera.
//
//  Il corpo dell'email vive su un TEMPLATE, che Klaviyo protegge con un
//  permesso a parte (templates:read). Se la connessione non ce l'ha, il resto
//  si mostra lo stesso e si dice cosa manca: mezza anteprima e' meglio di una
//  pagina bianca, ma solo se e' chiaro perche' e' mezza.
// ============================================================================

const BASE = 'https://a.klaviyo.com/api'

const buildHeaders = () => {
  const k = getKlaviyo()
  const token = k.apiKey || ''
  return {
    Authorization: k.isOAuth ? `Bearer ${token}` : `Klaviyo-API-Key ${token}`,
    accept: 'application/json',
    revision: '2024-10-15',
  }
}

async function kget(path) {
  try {
    const res = await fetch(`${BASE}${path}`, { headers: buildHeaders(), cache: 'no-store', signal: AbortSignal.timeout(12000) })
    const body = await res.json().catch(() => null)
    return { status: res.status, body }
  } catch {
    return { status: 0, body: null }
  }
}

// Un id di pubblico puo' essere una lista o un segmento e Klaviyo non lo dice:
// si prova la lista, poi il segmento. Se non risponde nessuno dei due resta
// l'id nudo, che e' comunque meglio di far sparire la riga.
async function resolveAudience(id) {
  const lista = await kget(`/lists/${id}`)
  if (lista.status === 200 && lista.body?.data) {
    return { id, type: 'list', name: lista.body.data.attributes?.name || id }
  }
  const seg = await kget(`/segments/${id}`)
  if (seg.status === 200 && seg.body?.data) {
    return { id, type: 'segment', name: seg.body.data.attributes?.name || id }
  }
  return { id, type: null, name: id }
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    if (!getKlaviyo().apiKey) {
      return NextResponse.json({ ok: false, error: 'Klaviyo non collegato' }, { status: 200 })
    }

    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ ok: false, error: 'id mancante' }, { status: 400 })

    const camp = await kget(`/campaigns/${encodeURIComponent(id)}`)
    if (camp.status !== 200 || !camp.body?.data) {
      return NextResponse.json({ ok: false, error: 'Campagna non trovata' }, { status: 200 })
    }
    const ca = camp.body.data.attributes || {}

    const msgs = await kget(`/campaigns/${encodeURIComponent(id)}/campaign-messages`)
    const msg = (msgs.body?.data || [])[0] || null
    const content = msg?.attributes?.content || {}

    // Pubblico e corpo si chiedono insieme: sono chiamate indipendenti e in
    // fila costerebbero il doppio dell'attesa.
    const inclusi = ca.audiences?.included || []
    const esclusi = ca.audiences?.excluded || []
    const [included, excluded, tpl] = await Promise.all([
      Promise.all(inclusi.slice(0, 25).map(resolveAudience)),
      Promise.all(esclusi.slice(0, 25).map(resolveAudience)),
      msg ? kget(`/campaign-messages/${msg.id}/template`) : Promise.resolve({ status: 0, body: null }),
    ])

    let html = null, text = null, bodyError = null
    if (tpl.status === 200 && tpl.body?.data) {
      html = tpl.body.data.attributes?.html || null
      text = tpl.body.data.attributes?.text || null
    } else if (tpl.status === 403) {
      // Il permesso manca sul TOKEN, non sull'utente: si ottiene ricollegando
      // Klaviyo, non cambiando ruolo. Dirlo evita mezz'ora di ricerche.
      bodyError = 'scope'
    } else if (tpl.status) {
      bodyError = 'unavailable'
    }

    const sendTime = (msg?.attributes?.send_times || [])[0]?.datetime || ca.send_time || ca.scheduled_at || null

    return NextResponse.json({
      ok: true,
      campaign: {
        id, name: ca.name || null, status: ca.status || null,
        sendTime, createdAt: ca.created_at || null,
      },
      message: {
        subject: content.subject || null,
        previewText: content.preview_text || null,
        fromLabel: content.from_label || null,
        fromEmail: content.from_email || null,
        replyTo: content.reply_to_email || null,
      },
      audiences: { included, excluded },
      body: { html, text, error: bodyError },
    })
  })
}
