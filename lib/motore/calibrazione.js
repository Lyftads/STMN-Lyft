// ============================================================================
//  Taratura del giudice: il punteggio dato PRIMA contro il rendimento DOPO.
//
//  Il giudice della copy (lib/qualitaCopy.js) decide cosa si renderizza e cosa
//  no. Un giudice che non viene mai confrontato con i risultati diventa un
//  gusto travestito da regola. Qui si guarda, sulle creativita' generate che
//  hanno speso abbastanza, se le copy con punteggio alto hanno reso davvero di
//  piu' — e quali delle cinque dimensioni separano le vincenti dalle perdenti.
//
//  Non cambia niente da sola: mostra. Ritarare le domande del giudice e' una
//  decisione, e va presa guardando questi numeri, non un'impressione.
// ============================================================================
import { DIMENSIONI, SOGLIA_RENDER } from './qualitaCopy'
import { SPESA_MINIMA_KILL } from './soglie'
import { kpiDi } from './db'

export const FASCE = [
  { id: '15-18', da: 15, a: 18 },
  { id: '19-21', da: 19, a: 21 },
  { id: '22-25', da: 22, a: 25 },
]
// Sotto tre creativita' per parte una media e' un aneddoto.
export const MINIMO_PER_PARTE = 3

const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

export function calibra(creativita, kpi, { spesaMinima = 0 } = {}) {
  const per = new Map()
  for (const k of kpi) {
    const a = per.get(k.creative_id) || { spesa: 0, acquisti: 0, valore: 0 }
    a.spesa += +k.spend || 0; a.acquisti += +k.purchases || 0; a.valore += +k.purchase_value || 0
    per.set(k.creative_id, a)
  }
  const conPunteggio = creativita.filter(c => c.punteggio_copy && Number.isFinite(+c.punteggio_copy.totale))
  const righe = conPunteggio.map(c => {
    const s = per.get(c.id) || { spesa: 0, acquisti: 0, valore: 0 }
    return { id: c.id, totale: +c.punteggio_copy.totale, voti: c.punteggio_copy, ...s, roas: s.spesa ? s.valore / s.spesa : 0 }
  }).filter(r => r.spesa > 0 && r.spesa >= spesaMinima)

  // Le derivate si calcolano DOPO la somma: sommare ROAS da' numeri plausibili
  // e sbagliati.
  const fasce = FASCE.map(f => {
    const in_ = righe.filter(r => r.totale >= f.da && r.totale <= f.a)
    const spesa = in_.reduce((t, r) => t + r.spesa, 0)
    const acquisti = in_.reduce((t, r) => t + r.acquisti, 0)
    const valore = in_.reduce((t, r) => t + r.valore, 0)
    return { ...f, n: in_.length, spesa: +spesa.toFixed(2), acquisti,
      roas: spesa ? +(valore / spesa).toFixed(2) : null, cpo: acquisti ? +(spesa / acquisti).toFixed(2) : null }
  })

  // Vincenti e perdenti si separano sulla mediana del ROAS, dentro le
  // leggibili. Per ogni dimensione: quanto valeva in media nelle une e nelle
  // altre. Un delta vicino a zero e' una domanda che non discrimina.
  let dimensioni = null
  if (righe.length >= MINIMO_PER_PARTE * 2) {
    const ord = [...righe].sort((a, b) => b.roas - a.roas)
    const meta = Math.floor(ord.length / 2)
    const vinc = ord.slice(0, meta), perd = ord.slice(meta)
    dimensioni = DIMENSIONI.map(d => {
      const v = media(vinc.map(r => +r.voti[d] || 0)), p = media(perd.map(r => +r.voti[d] || 0))
      return { dimensione: d, vincenti: +v.toFixed(2), perdenti: +p.toFixed(2), delta: +(v - p).toFixed(2) }
    }).sort((a, b) => b.delta - a.delta)
  }

  return {
    soglia: SOGLIA_RENDER, spesaMinima: +spesaMinima.toFixed(2),
    conPunteggio: conPunteggio.length, leggibili: righe.length, fasce, dimensioni,
    nota: righe.length < MINIMO_PER_PARTE * 2
      ? `Servono almeno ${MINIMO_PER_PARTE * 2} creativita' con punteggio e spesa sopra la soglia per dire qualcosa sul giudice: oggi ${righe.length}.`
      : dimensioni?.[0]?.delta > 0.5
        ? `"${dimensioni[0].dimensione}" e' la dimensione che piu' separa vincenti e perdenti (+${dimensioni[0].delta}): e' quella a cui dare piu' peso.`
        : 'Nessuna dimensione separa nettamente vincenti e perdenti: il giudice, per ora, non predice il rendimento.',
  }
}

async function tutte(build, pagina = 1000) {
  let out = [], da = 0
  for (;;) {
    const { data, error } = await build().range(da, da + pagina - 1)
    if (error) throw new Error(error.message)
    out = out.concat(data || []); if (!data || data.length < pagina) return out; da += pagina
  }
}

export async function leggiCalibrazione(db, ws) {
  const cre = await db().from('ce_creatives').select('id, punteggio_copy')
    .eq('workspace_id', ws).eq('origin', 'generated').not('punteggio_copy', 'is', null)
  // La colonna arriva con la migrazione 27: senza, si dichiara e basta.
  if (cre.error) return { disponibile: false, nota: /punteggio_copy/.test(cre.error.message || '') ? 'eseguire db/migrazione_27_punteggio.sql' : cre.error.message }
  const ids = (cre.data || []).map(c => c.id)
  if (!ids.length) return { disponibile: true, ...calibra([], [], {}) }
  // La soglia di spesa e' la stessa dello spegnimento: 2x il costo di un
  // ordine dell'account. Sotto, il ROAS di una creativita' non dice niente.
  const tot = await tutte(() => kpiDi('ce_kpi_daily', 'creative_id, spend, purchases, purchase_value'))
  const spesa = tot.reduce((t, k) => t + (+k.spend || 0), 0)
  const ordini = tot.reduce((t, k) => t + (+k.purchases || 0), 0)
  const cpa = ordini ? spesa / ordini : 0
  const kpi = tot.filter(k => ids.includes(k.creative_id))
  return { disponibile: true, ...calibra(cre.data, kpi, { spesaMinima: cpa * SPESA_MINIMA_KILL }) }
}
