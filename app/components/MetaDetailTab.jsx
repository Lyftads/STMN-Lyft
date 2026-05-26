'use client'

export default function MetaDetailTab({ metaWeekly = [], live = {}, cfg = {}, S = {} }) {
  const asNum = v => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  const money = v =>
    `€${Math.round(asNum(v)).toLocaleString('it-IT')}`

  const num = v =>
    Math.round(asNum(v)).toLocaleString('it-IT')

  const pct = v =>
    `${asNum(v).toFixed(2)}%`

  const rows = Array.isArray(metaWeekly) ? metaWeekly : []

  const totals = rows.reduce(
    (acc, row) => {
      acc.spend += asNum(row.spend)
      acc.impressions += asNum(row.impressions)
      acc.reach += asNum(row.reach)
      acc.linkClicks += asNum(row.linkClicks)
      acc.ctr += asNum(row.ctr)
      acc.cpcLink += asNum(row.cpcLink)
      acc.cpm += asNum(row.cpm)
      acc.frequency += asNum(row.frequency)
      return acc
    },
    {
      spend: 0,
      impressions: 0,
      reach: 0,
      linkClicks: 0,
      ctr: 0,
      cpcLink: 0,
      cpm: 0,
      frequency: 0,
    }
  )

  const avg = key => {
    if (!rows.length) return 0
    return rows.reduce((sum, row) => sum + asNum(row[key]), 0) / rows.length
  }

  const cardStyle = {
    background: '#0d1424',
    border: '1px solid #1f2937',
    borderRadius: 14,
    padding: 18,
  }

  const thStyle = {
    padding: '14px 12px',
    fontSize: 11,
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    textAlign: 'left',
    fontWeight: 800,
    borderBottom: '1px solid #263348',
    whiteSpace: 'nowrap',
  }

  const tdStyle = {
    padding: '14px 12px',
    fontSize: 14,
    color: '#e5e7eb',
    borderBottom: '1px solid #172033',
    whiteSpace: 'nowrap',
  }

  return (
    <div>
      <div
        style={{
          background: '#0d1424',
          border: '1px solid #1f2937',
          borderRadius: 18,
          padding: 24,
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <h2
            style={{
              margin: 0,
              color: '#fff',
              fontSize: 24,
              fontWeight: 900,
            }}
          >
            Meta Detail
          </h2>

          <p
            style={{
              margin: '8px 0 0',
              color: '#9ca3af',
              fontSize: 14,
            }}
          >
            Dettaglio performance Meta Ads per settimana
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div style={cardStyle}>
            <div
              style={{
                color: '#9ca3af',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                fontWeight: 800,
                marginBottom: 14,
              }}
            >
              Spesa Meta
            </div>
            <div style={{ color: '#3b82f6', fontSize: 30, fontWeight: 900 }}>
              {money(totals.spend)}
            </div>
            <div style={{ color: '#64748b', fontSize: 13, marginTop: 8 }}>
              Totale periodo
            </div>
          </div>

          <div style={cardStyle}>
            <div
              style={{
                color: '#9ca3af',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                fontWeight: 800,
                marginBottom: 14,
              }}
            >
              Impressions
            </div>
            <div style={{ color: '#22c55e', fontSize: 30, fontWeight: 900 }}>
              {num(totals.impressions)}
            </div>
            <div style={{ color: '#64748b', fontSize: 13, marginTop: 8 }}>
              Totale periodo
            </div>
          </div>

          <div style={cardStyle}>
            <div
              style={{
                color: '#9ca3af',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                fontWeight: 800,
                marginBottom: 14,
              }}
            >
              Link Clicks
            </div>
            <div style={{ color: '#22c55e', fontSize: 30, fontWeight: 900 }}>
              {num(totals.linkClicks)}
            </div>
            <div style={{ color: '#64748b', fontSize: 13, marginTop: 8 }}>
              Totale periodo
            </div>
          </div>

          <div style={cardStyle}>
            <div
              style={{
                color: '#9ca3af',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                fontWeight: 800,
                marginBottom: 14,
              }}
            >
              CTR Medio
            </div>
            <div style={{ color: '#fb923c', fontSize: 30, fontWeight: 900 }}>
              {pct(avg('ctr'))}
            </div>
            <div style={{ color: '#64748b', fontSize: 13, marginTop: 8 }}>
              Link clicks / impressions
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              minWidth: 980,
              borderCollapse: 'collapse',
              border: '1px solid #263348',
              borderRadius: 14,
              overflow: 'hidden',
            }}
          >
            <thead>
              <tr>
                {[
                  'Settimana',
                  'Spesa',
                  'Impressions',
                  'Reach',
                  'Freq.',
                  'CPM',
                  'CTR %',
                  'CPC Link',
                  'Link Clicks',
                ].map(h => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.length ? (
                rows.map((w, i) => (
                  <tr key={`${w.date || w.week || i}`}>
                    <td style={{ ...tdStyle, fontWeight: 800 }}>
                      {w.date || w.week || '-'}
                    </td>
                    <td style={{ ...tdStyle, color: '#3b82f6', fontWeight: 800 }}>
                      {money(w.spend)}
                    </td>
                    <td style={tdStyle}>{num(w.impressions)}</td>
                    <td style={tdStyle}>{num(w.reach)}</td>
                    <td style={tdStyle}>{asNum(w.frequency).toFixed(2)}</td>
                    <td style={tdStyle}>€{asNum(w.cpm).toFixed(2).replace('.', ',')}</td>
                    <td style={tdStyle}>{pct(w.ctr)}</td>
                    <td style={tdStyle}>€{asNum(w.cpcLink).toFixed(2).replace('.', ',')}</td>
                    <td style={tdStyle}>{num(w.linkClicks)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={9}
                    style={{
                      ...tdStyle,
                      color: '#9ca3af',
                      textAlign: 'center',
                      padding: 32,
                    }}
                  >
                    Nessun dato Meta disponibile.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
