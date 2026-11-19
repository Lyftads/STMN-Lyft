'use client'
import { useEffect, useMemo, useState } from 'react'

// ============================================================================
//  La scheda MATRICE — il documento di lavoro dentro lo strumento.
//
//  Personas, cluster, avatar, le 360 righe della matrice, i template e le
//  regole stavano in un documento a parte: per usarli bisognava uscire dal
//  motore, e il motore produceva senza sapere che esistessero. Qui sono la
//  stessa cosa che il generatore legge (data/saracino/, lib/matrice.js): quello
//  che si vede in questa scheda è quello su cui si produce.
//
//  Niente colori nuovi: la scheda descrive, non decide. Verde, ambra e rosso
//  restano dei verdetti.
// ============================================================================

const VISTE = [['personas', 'Personas'], ['cluster', 'Cluster e avatar'], ['righe', 'Matrice creativa'], ['template', 'Template'], ['regole', 'Regole e mercato']]
const FORMATI = ['Still life', 'Sfondo bianco con offerta', 'Noi vs loro', 'Prima e dopo', 'Recensione', 'Unboxing', 'UGC', 'Carosello', 'Reel', 'Provenienza']
const copia = (t) => { try { navigator.clipboard.writeText(t) } catch {} }

export default function Matrice() {
  const [d, setD] = useState(null)
  const [err, setErr] = useState(null)
  const [vista, setVistaRaw] = useState('personas')
  const setVista = (v) => {
    setVistaRaw(v)
    const u = new URL(window.location.href); u.searchParams.set('vista', v); window.history.replaceState({}, '', u)
  }
  useEffect(() => {
    const v = new URL(window.location.href).searchParams.get('vista')
    if (VISTE.some(x => x[0] === v)) setVistaRaw(v)
    fetch('/api/motore/matrice', { cache: 'no-store' }).then(r => r.json())
      .then(j => j.error ? setErr(j.error) : setD(j)).catch(e => setErr(String(e)))
  }, [])

  if (err) return <div className="empty" style={{ marginTop: 30 }}><b>Non riesco a leggere la matrice</b><p>{err}</p></div>
  if (!d) return <div className="empty" style={{ marginTop: 30 }}><p>Carico la matrice…</p></div>

  const nProdotte = Object.keys(d.prodotte || {}).length
  return (
    <>
      <div className="bar" style={{ marginTop: 0 }}>
        {VISTE.map(([k, l]) => (
          <button key={k} className="chip" data-on={vista === k ? 1 : 0} onClick={() => setVista(k)}>{l}</button>
        ))}
        <span className="count">
          {d.segmenti.length} segmenti · {d.cluster.length} cluster · {d.avatar.length} avatar · {d.matrice.length} creatività
          {' · '}{nProdotte} già prodotte
        </span>
      </div>
      {d.avviso && <div className="mx-avviso">{d.avviso}</div>}
      {vista === 'personas' && <Personas d={d} vai={setVista} />}
      {vista === 'cluster' && <ClusterAvatar d={d} />}
      {vista === 'righe' && <Righe d={d} />}
      {vista === 'template' && <Template />}
      {vista === 'regole' && <Regole d={d} />}
    </>
  )
}

// ------------------------------------------------------------- personas ----
function Personas({ d }) {
  return (
    <>
      <div className="strip">
        {d.segmenti.map(s => {
          const righe = d.matrice.filter(r => r.segmento === s.codice)
          const fatte = righe.filter(r => d.prodotte?.[r.id]).length
          return (
            <div className="kpi" key={s.codice}>
              <div className="lab">{s.n}. {s.nome}</div>
              <div className="val mono">{fatte}<span className="mx-su"> / {righe.length}</span></div>
              <div className="sub">righe della matrice già prodotte</div>
            </div>
          )
        })}
      </div>
      {d.segmenti.map(s => (
        <section className="blocco" key={s.codice}>
          <div className="et">{s.n}. {s.nome} · {s.codice}</div>
          <div className="mx-scheda">
            <h3>{s.avatar_principale}</h3>
            <p className="mx-sintesi">{s.sintesi}</p>
            <dl className="mx-dl">
              {Object.entries(s.scheda || {}).map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
            <div className="pillole" style={{ marginTop: 12 }}>
              {d.cluster.filter(c => c.segmento === s.codice).map(c => (
                <span className="pillola" key={c.id}>{c.id} · {c.nome}</span>
              ))}
            </div>
          </div>
        </section>
      ))}
    </>
  )
}

// ---------------------------------------------------- cluster e avatar ----
function ClusterAvatar({ d }) {
  const [seg, setSeg] = useState(d.segmenti[0].codice)
  const cluster = d.cluster.filter(c => c.segmento === seg)
  return (
    <>
      <div className="bar">
        {d.segmenti.map(s => (
          <button key={s.codice} className="chip" data-on={seg === s.codice ? 1 : 0} onClick={() => setSeg(s.codice)}>{s.n}. {s.nome}</button>
        ))}
      </div>
      {cluster.map(c => {
        const righe = d.matrice.filter(r => r.cluster === c.id)
        const fatte = righe.filter(r => d.prodotte?.[r.id]).length
        return (
          <section className="blocco" key={c.id}>
            <div className="et">Cluster {c.id} · angolo del motore {c.angolo_motore} · ondata {c.ondata} · {fatte} di {righe.length} prodotte</div>
            <div className="mx-scheda">
              <h3>{c.nome}</h3>
              <dl className="mx-dl">
                <div><dt>Chi ne fa parte</dt><dd>{c.chi}</dd></div>
                <div><dt>Cosa li accomuna</dt><dd>{c.cosa_li_accomuna}</dd></div>
                <div><dt>Leva</dt><dd>{c.leva}</dd></div>
              </dl>
              <div className="mx-avatar">
                {d.avatar.filter(a => a.cluster === c.id).map(a => (
                  <article className="carta" key={a.id} data-tipo="todo">
                    <span className="carta-tipo">{a.id} · {a.genere_eta}</span>
                    <h4>{a.nome}</h4>
                    <p><b>Dove e con chi.</b> {a.dove_con_chi}</p>
                    <p><b>Abitudini.</b> {a.abitudini}</p>
                    <p><b>Situazione.</b> {a.situazione}</p>
                    <p className="mx-frase">«{a.frase}»</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )
      })}
    </>
  )
}

// ------------------------------------------------------ matrice creativa ----
function Righe({ d }) {
  const [seg, setSeg] = useState('')
  const [clu, setClu] = useState('')
  const [fmt, setFmt] = useState('')
  const [stato, setStato] = useState('')
  const [q, setQ] = useState('')
  const avatar = useMemo(() => new Map(d.avatar.map(a => [a.id, a])), [d])
  const righe = useMemo(() => {
    const t = q.trim().toLowerCase()
    return d.matrice.filter(r =>
      (!seg || r.segmento === seg) && (!clu || r.cluster === clu) && (!fmt || r.formato === fmt)
      && (!stato || (stato === 'fatte') === !!d.prodotte?.[r.id])
      && (!t || [r.id, r.headline, r.copy, r.situazione, r.angle, r.cta, avatar.get(r.avatar)?.nome].join(' ').toLowerCase().includes(t)))
  }, [d, seg, clu, fmt, stato, q, avatar])
  return (
    <>
      <div className="bar">
        <button className="chip" data-on={!seg ? 1 : 0} onClick={() => { setSeg(''); setClu('') }}>Tutti i segmenti</button>
        {d.segmenti.map(s => (
          <button key={s.codice} className="chip" data-on={seg === s.codice ? 1 : 0} onClick={() => { setSeg(s.codice); setClu('') }}>{s.n}. {s.nome}</button>
        ))}
      </div>
      {seg && (
        <div className="bar">
          <button className="chip" data-on={!clu ? 1 : 0} onClick={() => setClu('')}>Tutti i cluster</button>
          {d.cluster.filter(c => c.segmento === seg).map(c => (
            <button key={c.id} className="chip" data-on={clu === c.id ? 1 : 0} onClick={() => setClu(c.id)}>{c.id} · {c.nome}</button>
          ))}
        </div>
      )}
      <div className="bar">
        <button className="chip" data-on={!fmt ? 1 : 0} onClick={() => setFmt('')}>Tutti i formati</button>
        {FORMATI.map(f => (
          <button key={f} className="chip" data-on={fmt === f ? 1 : 0} onClick={() => setFmt(f)}>{f}</button>
        ))}
      </div>
      <div className="bar">
        {[['', 'Tutte'], ['fatte', 'Già prodotte'], ['da-fare', 'Da produrre']].map(([k, l]) => (
          <button key={k} className="chip" data-on={stato === k ? 1 : 0} onClick={() => setStato(k)}>{l}</button>
        ))}
        <input className="mx-cerca" placeholder="Cerca in headline, copy, situazione, avatar…" value={q} onChange={e => setQ(e.target.value)} />
        <span className="count">{righe.length} righe</span>
      </div>
      <div className="mx-tabella">
        <table>
          <thead><tr>
            <th>ID</th><th>Formato</th><th>Avatar</th><th>Situazione</th><th>Angolazione</th>
            <th>Angle</th><th>Headline</th><th>Copy</th><th>CTA</th><th>Stato</th>
          </tr></thead>
          <tbody>
            {righe.map(r => {
              const a = avatar.get(r.avatar), fatte = d.prodotte?.[r.id]
              return (
                <tr key={r.id}>
                  <td className="mono mx-id">{r.id}</td>
                  <td>{r.formato}{!r.formato_motore && <span className="mx-nota"> · solo scaletta</span>}</td>
                  <td>{a?.nome}<span className="mx-nota"> · {a?.genere_eta}</span></td>
                  <td>{r.situazione}</td>
                  <td>{r.angolazione}</td>
                  <td>{r.angle}</td>
                  <td className="mx-head copiabile" title="Clicca per copiare" onClick={() => copia(r.headline)}>{r.headline}</td>
                  <td className="copiabile" title="Clicca per copiare" onClick={() => copia(r.copy)}>{r.copy}</td>
                  <td>{r.cta}</td>
                  <td>{fatte
                    ? <span className="pillola sper" title={fatte.map(f => f.nome).join('\n')}>{fatte.length} {fatte.some(f => f.lanciata) ? 'lanciata' : 'prodotta'}</span>
                    : <span className="mx-nota">da fare</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

// --------------------------------------------------------------- template ----
function Template() {
  const [t, setT] = useState(null)
  const [fmt, setFmt] = useState('')
  const [solo, setSolo] = useState('migliori')
  const [quante, setQuante] = useState(48)
  const [aperto, setAperto] = useState(null)
  useEffect(() => {
    fetch('/api/motore/matrice?parte=template', { cache: 'no-store' }).then(r => r.json()).then(j => setT(j.template || []))
  }, [])
  const lista = useMemo(() => (t || []).filter(x =>
    x.url && (!fmt || x.formato === fmt)
    && (solo === 'migliori' ? x.migliore : solo === 'vuoti' ? x.ruolo !== 'E' : true)), [t, fmt, solo])
  useEffect(() => { setQuante(48) }, [fmt, solo])
  if (!t) return <div className="empty" style={{ marginTop: 30 }}><p>Carico i template…</p></div>
  const perFormato = (f) => t.filter(x => x.url && x.formato === f && x.ruolo !== 'E').length
  return (
    <>
      <div className="bar">
        <button className="chip" data-on={!fmt ? 1 : 0} onClick={() => setFmt('')}>Tutti i formati</button>
        {FORMATI.filter(f => perFormato(f)).map(f => (
          <button key={f} className="chip" data-on={fmt === f ? 1 : 0} onClick={() => setFmt(f)}>{f} <span className="mx-nota">{perFormato(f)}</span></button>
        ))}
      </div>
      <div className="bar">
        {[['migliori', 'I 42 migliori'], ['vuoti', 'Vuoti da riempire'], ['tutti', 'Vuoti ed esempi']].map(([k, l]) => (
          <button key={k} className="chip" data-on={solo === k ? 1 : 0} onClick={() => setSolo(k)}>{l}</button>
        ))}
        <span className="count">{lista.length} template · Unboxing e Reel non ne hanno</span>
      </div>
      <div className="mx-griglia">
        {lista.slice(0, quante).map(x => (
          <button className="mx-tpl" key={x.id} onClick={() => setAperto(x)}>
            <img src={x.url} alt="" loading="lazy" />
            <span className="mx-tpl-id mono">{x.id}{x.migliore ? ' ★' : ''}</span>
            <span className="mx-tpl-tipo">{x.formato} · {x.ruolo === 'E' ? 'esempio' : 'vuoto'}</span>
          </button>
        ))}
      </div>
      {lista.length > quante && (
        <div className="bar"><button className="chip forte" onClick={() => setQuante(q => q + 48)}>Mostrane altri 48</button></div>
      )}
      {aperto && (
        <div className="mx-velo" onClick={() => setAperto(null)}>
          <div className="mx-foglio" onClick={e => e.stopPropagation()}>
            <img src={aperto.url} alt="" />
            <div>
              <div className="et">{aperto.id} · {aperto.pacchetto} · {aperto.formato}</div>
              <h3>{aperto.idea || aperto.tipo.replace(/_/g, ' ')}</h3>
              <dl className="mx-dl">
                <div><dt>Com'è costruito</dt><dd>{aperto.layout}</dd></div>
                <div><dt>Testi da riempire</dt><dd>{aperto.slot}</dd></div>
                <div><dt>Foto che serve</dt><dd>{aperto.foto}</dd></div>
                {aperto.coppia && <div><dt>{aperto.ruolo === 'E' ? 'Versione vuota' : 'Esempio compilato'}</dt><dd className="mono">{aperto.coppia}</dd></div>}
              </dl>
              <div className="bar">
                <a className="chip forte" href={aperto.url} target="_blank" rel="noreferrer">Apri a grandezza piena</a>
                <button className="chip" onClick={() => setAperto(null)}>Chiudi</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ----------------------------------------------------------------- regole ----
function Regole({ d }) {
  const r = d.regole
  const carte = (lista) => (
    <div className="insight">
      {lista.map((x, i) => (
        <article className="carta" key={i} data-tipo="todo"><h4>{x.titolo}</h4><p>{x.testo}</p></article>
      ))}
    </div>
  )
  return (
    <>
      <section className="blocco"><div className="et">Come si costruisce un lotto</div>{carte(r.metodo)}</section>
      <section className="blocco">
        <div className="et">La confezione vera</div>
        {carte(r.confezione)}
        <div className="mx-foto">
          {Object.entries(d.riferimenti || {}).map(([k, u]) => (
            <a key={k} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" loading="lazy" /><span>{k.replace(/-/g, ' ')}</span></a>
          ))}
        </div>
      </section>
      <section className="blocco">
        <div className="et">Ambienti</div>
        <div className="mx-scheda"><p className="mx-sintesi">{r.ambienti.regola}</p>
          <div className="pillole">{r.ambienti.stili.map(s => <span className="pillola" key={s}>{s}</span>)}</div></div>
      </section>
      <section className="blocco">
        <div className="et">I dieci formati e come li legge il motore</div>
        <div className="mx-tabella"><table><thead><tr><th>Formato</th><th>Nel motore</th><th>Cos'è</th></tr></thead>
          <tbody>{r.formati.map(f => <tr key={f.nome}><td>{f.nome}</td><td className="mono">{f.motore || '—'}</td><td>{f.cosa}</td></tr>)}</tbody></table></div>
      </section>
      <section className="blocco">
        <div className="et">Ordine di produzione</div>
        <div className="mx-tabella"><table><thead><tr><th>Ondata</th><th>Quando</th><th>Cluster</th><th>Perché</th></tr></thead>
          <tbody>{r.ondate.map(o => <tr key={o.n}><td className="mono">{o.n}</td><td>{o.quando}</td>
            <td>{o.cluster.map(c => `${c} ${d.cluster.find(x => x.id === c)?.nome || ''}`).join(' · ')}</td><td>{o.perche}</td></tr>)}</tbody></table></div>
      </section>
      <section className="blocco">
        <div className="et">Cosa dice il mercato (dati verificati)</div>
        <div className="insight">
          {r.mercato.map((m, i) => (
            <article className="carta" key={i} data-tipo="todo"><p>{m.dato}</p>
              <p className="mx-fonte"><a href={m.url} target="_blank" rel="noreferrer">{m.fonte} ↗</a></p></article>
          ))}
        </div>
      </section>
      <section className="blocco">
        <div className="et">Da confermare con il cliente prima di produrre</div>
        <div className="mx-scheda"><ul className="mx-lista">{r.da_confermare.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
      </section>
    </>
  )
}
