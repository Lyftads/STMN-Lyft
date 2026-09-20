import PlatformIcon from '../PlatformIcon'

// I loghini della fonte: da quale piattaforma arriva il dato di una colonna,
// di una famiglia di colonne o di una riga. Piccoli, accanto al testo.
export function Fonte({ loghi = [], size = 11, dopo = false }) {
  const lista = (Array.isArray(loghi) ? loghi : [loghi]).filter(Boolean)
  if (!lista.length) return null
  return (
    <span className={`tab-fonte${dopo ? ' dopo' : ''}`}>
      {lista.map(l => <PlatformIcon key={l} platform={l} size={size} />)}
    </span>
  )
}

// Le fasce colorate sopra le intestazioni: dicono a quale famiglia appartiene
// un gruppo di colonne (vendite, traffico, spesa, resa) e, col logo, da dove
// arrivano quei numeri. Stesso disegno di "Dove comprano" in KPI Brain.
//   gruppi: [{ vuote: 2 }, { fam: 'fam-traffico', n: 4, label: 'Traffico', loghi: ['google'] }, …]
// Alla tabella vanno anche le classi `st-N` (N = numero della colonna dove
// comincia ogni famiglia): tracciano lo stacco verticale su tutte le righe.
export default function FasceTabella({ gruppi = [] }) {
  return (
    <tr className="reg-fasce">
      {gruppi.map((g, k) => g.vuote
        ? <th key={k} colSpan={g.vuote} className="reg-vuota" />
        : <th key={k} colSpan={g.n} className={`fam ${g.fam}`}><span className="tab-fascia"><Fonte loghi={g.loghi} />{g.label}</span></th>)}
    </tr>
  )
}
