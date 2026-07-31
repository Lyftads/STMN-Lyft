import { getTenantInfo } from '../tenant/credentials'

// ============================================================================
//  Personalizzazione multi-tenant dei prompt degli agent.
//
//  I prompt storici sono stati scritti per STMN: dicono a lettere "sei il
//  consulente di fiducia di Marino, founder di STMN Fitness" e descrivono il
//  catalogo (paracalli, corde, accessori palestra). Per gli altri workspace il
//  contesto Brand Identity viene iniettato a parte, ma NON basta: un'istruzione
//  esplicita "lavori per STMN" vince sul contesto, e infatti in produzione gli
//  agent si presentavano ai clienti come consulenti di Marino/STMN.
//
//  Qui: per STMN il prompt resta IDENTICO; per ogni altro tenant il nome viene
//  sostituito e le righe con fatti specifici di STMN (catalogo, target, nomi
//  reali di adset usati come esempio) vengono tolte, lasciando parlare il
//  contesto del brand vero.
// ============================================================================

// Righe da eliminare: descrivono il catalogo/target/adset di STMN e sarebbero
// false per chiunque altro.
const TENANT_SPECIFIC_LINE = /stamina|paracalli|polsiere|corde da salto|ginocchiere|cinture sollevamento|tape adesivo|home gym|crossfit|functional fitness|supplementi|integratori|stackinteress|zeroslim|all_m\.f|vc&atc|backtobox/i

// Intestazione della sezione "chi è il founder e l'azienda": senza la riga di
// descrizione (tolta sopra) resterebbe un titolo vuoto.
const OWNER_SECTION_HEADING = /^#{1,4}\s*chi\s+(è|e)\b/i

// brandOverride: solo per i test (verificare la trasformazione senza una
// richiesta HTTP attiva). In produzione il brand arriva dal tenant context.
export function tenantPrompt(systemPrompt, brandOverride = null) {
  const brand = brandOverride || getTenantInfo().companyName
  // STMN: nessuna modifica (è il brand per cui i prompt sono stati scritti).
  if (brand && /stmn/i.test(brand)) return systemPrompt
  const b = brand || 'il brand'

  return systemPrompt
    // dalle formule più lunghe alle più generiche, altrimenti si sovrascrivono
    .replaceAll('di fiducia di Marino, founder di STMN Fitness', `di fiducia del founder di ${b}`)
    .replaceAll('di Marino, founder di STMN Fitness', `del founder di ${b}`)
    .replaceAll('STMN Fitness (Stamina Fitness)', b)
    .replaceAll('STMN Fitness', b)
    .replace(/\bSTMN\b/g, b)
    .replace(/\bdi Marino\b/g, 'del founder')
    .replace(/\bMarino\b/g, 'il founder')
    .split('\n')
    .filter(l => !OWNER_SECTION_HEADING.test(l))
    // Filtro per FRASE, non per riga: in alcuni prompt la frase su STMN sta
    // nella stessa riga di regole che vanno tenute (es. "NON inventare valori.
    // STMN vende paracalli…"). Togliendo la riga si perdeva l'anti-invenzione.
    .map(l => {
      if (!TENANT_SPECIFIC_LINE.test(l)) return l
      const kept = l.split(/(?<=[.!?])\s+/).filter(s => !TENANT_SPECIFIC_LINE.test(s))
      return kept.join(' ').trim()
    })
    .join('\n')
}
