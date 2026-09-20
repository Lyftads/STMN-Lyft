'use client'
import { useCallback, useState } from 'react'

// ============================================================================
//  Le SCELTE di una tab restano quando la si lascia e ci si torna: il periodo
//  impostato, il gruppo aperto, il filtro acceso. Senza, tornare su una tab la
//  riportava ai valori di partenza — e quindi a un altro URL, e a un altro
//  caricamento. Vive in memoria per la sessione, come i dati.
//
//    const [since, setSince] = useStatoTab('gpv.since', () => isoDay(…))
//
//  A mezzanotte le scelte si dimenticano: "ultimi 30 giorni" salvato ieri non
//  e' piu' lo stesso periodo oggi.
// ============================================================================

const stati = new Map() // chiave → { v, giorno }
const oggi = () => new Date().toDateString()

export function useStatoTab(chiave, iniziale) {
  const [valore, setValore] = useState(() => {
    const m = stati.get(chiave)
    if (m && m.giorno === oggi()) return m.v
    return typeof iniziale === 'function' ? iniziale() : iniziale
  })
  const imposta = useCallback((x) => {
    setValore(prima => {
      const nuovo = typeof x === 'function' ? x(prima) : x
      stati.set(chiave, { v: nuovo, giorno: oggi() })
      return nuovo
    })
  }, [chiave])
  return [valore, imposta]
}
