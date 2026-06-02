'use client'

import { useMemo } from 'react'

// ── Motore di alert / anomaly detection ──────────────────────────
// Additivo: legge i dati `live` (range corrente vs precedente) e segnala
// anomalie su ROAS, CTR, spesa, CPA, revenue, tracking. Nessuna dipendenza
// esterna: gira sui dati metrics già caricati dalla dashboard.

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const pctChange = (cur, prev) => (prev > 0 ? ((cur - prev) / prev) * 100 : null)
const money = (n) => `€${Math.round(num(n)).toLocaleString('it-IT')}`
const fmtPct = (n) => `${n > 0 ? '+' : ''}${n.toFixed(0)}%`

function deriveMetrics(s, m) {
  const rev = num(s?.revenue)
  const ord = num(s?.orders)
  const nc = num(s?.nc)
  const ses = num(s?.sessions)
  const spend = num(m?.spend)
  const impr = num(m?.impressions)
  const clicks = num(m?.clicks)
  return {
    rev, ord, nc, ses, spend, impr, clicks,
    roas: spend > 0 ? rev / spend : null,
    ctr: impr > 0 ? (clicks / impr) * 100 : null,
    cpa: ord > 0 ? spend / ord : null,
    cvr: ses > 0 ? (ord / ses) * 100 : null,
  }
}

function computeAlerts(live) {
  if (!live) return []
  const cur = deriveMetrics(live.shopifyRange, live.metaRange)
  const prev = deriveMetrics(live.shopifyPrevRange, live.metaPrevRange)
  const out = []

  // Tracking / redditività
  if (cur.spend > 0 && cur.rev === 0) {
    out.push({ sev: 'critical', metric: 'Tracking', title: 'Spesa senza fatturato',
      text: `Speso ${money(cur.spend)} su Meta ma €0 di fatturato attribuito nel periodo. Possibile problema di tracking o periodo troppo recente non consolidato.` })
  }
  if (cur.roas != null && cur.roas < 1 && cur.spend > 0) {
    out.push({ sev: 'critical', metric: 'ROAS', title: 'ROAS sotto 1 — stai perdendo',
      text: `ROAS Meta a ${cur.roas.toFixed(2)}x (${money(cur.rev)} su ${money(cur.spend)} di spesa). Sotto 1 ogni euro speso rende meno di un euro.` })
  }

  // Cali vs periodo precedente
  const roasDrop = (cur.roas != null && prev.roas != null && prev.roas > 0) ? pctChange(cur.roas, prev.roas) : null
  if (roasDrop != null && roasDrop <= -25 && cur.spend > 0) {
    out.push({ sev: 'warning', metric: 'ROAS', title: 'ROAS in calo',
      text: `ROAS ${cur.roas.toFixed(2)}x vs ${prev.roas.toFixed(2)}x del periodo precedente (${fmtPct(roasDrop)}).` })
  }
  const revDrop = pctChange(cur.rev, prev.rev)
  if (revDrop != null && revDrop <= -30 && prev.rev > 0) {
    out.push({ sev: 'warning', metric: 'Revenue', title: 'Fatturato in calo',
      text: `Fatturato ${money(cur.rev)} vs ${money(prev.rev)} (${fmtPct(revDrop)}) rispetto al periodo precedente.` })
  }
  const ctrDrop = (cur.ctr != null && prev.ctr != null && prev.ctr > 0) ? pctChange(cur.ctr, prev.ctr) : null
  if (ctrDrop != null && ctrDrop <= -30) {
    out.push({ sev: 'warning', metric: 'CTR', title: 'CTR in calo — possibile fatigue',
      text: `CTR ${cur.ctr.toFixed(2)}% vs ${prev.ctr.toFixed(2)}% (${fmtPct(ctrDrop)}). Possibile fatica creativa: valuta un refresh.` })
  }
  const cpaUp = (cur.cpa != null && prev.cpa != null && prev.cpa > 0) ? pctChange(cur.cpa, prev.cpa) : null
  if (cpaUp != null && cpaUp >= 40) {
    out.push({ sev: 'warning', metric: 'CPA', title: 'Costo per ordine in aumento',
      text: `CPA ${money(cur.cpa)} vs ${money(prev.cpa)} (${fmtPct(cpaUp)}). Il costo per acquisire un ordine sta salendo.` })
  }
  const cvrDrop = (cur.cvr != null && prev.cvr != null && prev.cvr > 0) ? pctChange(cur.cvr, prev.cvr) : null
  if (cvrDrop != null && cvrDrop <= -30) {
    out.push({ sev: 'warning', metric: 'Conversion rate', title: 'Conversion rate del sito in calo',
      text: `CVR ${cur.cvr.toFixed(2)}% vs ${prev.cvr.toFixed(2)}% (${fmtPct(cvrDrop)}). Controlla landing, offerta e checkout.` })
  }

  // Spike di spesa (info)
  const spendUp = pctChange(cur.spend, prev.spend)
  if (spendUp != null && spendUp >= 40 && cur.spend > 0) {
    const sev = (cur.roas != null && cur.roas < 2) ? 'warning' : 'info'
    out.push({ sev, metric: 'Spesa', title: 'Spesa Meta in forte aumento',
      text: `Spesa ${money(cur.spend)} vs ${money(prev.spend)} (${fmtPct(spendUp)})${cur.roas != null ? ` con ROAS ${cur.roas.toFixed(2)}x` : ''}.` })
  }

  const order = { critical: 0, warning: 1, info: 2 }
  return out.sort((a, b) => order[a.sev] - order[b.sev])
}

const SEV = {
  critical: { color: 'var(--red)', bg: 'rgba(255,69,58,0.12)', label: 'CRITICO' },
  warning: { color: 'var(--orange)', bg: 'rgba(255,159,10,0.12)', label: 'ATTENZIONE' },
  info: { color: 'var(--accent)', bg: 'rgba(41,151,255,0.12)', label: 'INFO' },
}

export default function AlertsPanel({ live }) {
  const alerts = useMemo(() => computeAlerts(live), [live])

  return (
    <div className="glass-section reveal-zoom" style={{ padding: 24, marginBottom: 24 }}>
      <div style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: alerts.length ? 16 : 0 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: alerts.some(a => a.sev === 'critical') ? 'var(--red)' : alerts.length ? 'var(--orange)' : 'var(--green)',
            boxShadow: `0 0 10px ${alerts.some(a => a.sev === 'critical') ? 'var(--red)' : alerts.length ? 'var(--orange)' : 'var(--green)'}`,
          }} />
          <div className="heading-sm" style={{ fontSize: 16 }}>Alert &amp; Anomalie</div>
          {alerts.length > 0 && (
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)' }}>
              {alerts.length} {alerts.length === 1 ? 'segnale' : 'segnali'} nel periodo
            </span>
          )}
        </div>

        {alerts.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            ✓ Nessuna anomalia rilevata nel periodo selezionato — metriche nei range.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {alerts.map((a, i) => {
              const s = SEV[a.sev] || SEV.info
              return (
                <div key={i} className="glass-card-static" style={{ padding: '13px 16px', borderRadius: 12, borderLeft: `3px solid ${s.color}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 8, fontWeight: 900, padding: '2px 7px', borderRadius: 4, background: s.bg, color: s.color, letterSpacing: '.08em' }}>{s.label}</span>
                    <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700 }}>{a.metric}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.55 }}>{a.text}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
