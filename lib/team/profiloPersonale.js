// ============================================================================
//  La parte PERSONALE del profilo: soprannome, "chi sono", email per tutto.
//
//  Sta nei metadati dell'utente Supabase (chiave `lyft_profile`), non in
//  team_members: e' della persona, non del workspace — chi lavora su piu' spazi
//  ha un soprannome solo — e non chiede una migrazione per esistere. Nome e foto
//  restano in team_members, dove li leggono LyftTalk, le task e i progetti.
// ============================================================================
const CHIAVE = 'lyft_profile'

// Le famiglie di notifiche che si possono volere (o no) anche per email.
// `chat` = solo quando si viene taggati in una conversazione di LyftTalk.
export const TIPI_EMAIL = ['tasks', 'comments', 'projects', 'creatives', 'chat']

// REGOLA DI MARINO: chi non ha mai toccato niente riceve TUTTO. Si smette di
// ricevere solo per scelta: spegnendo "tutte" e lasciando spuntate alcune voci.
function pulisci(p = {}) {
  const tipi = Array.isArray(p.email_types) ? p.email_types.filter(x => TIPI_EMAIL.includes(x)) : []
  return {
    nickname: String(p.nickname || '').slice(0, 40),
    bio: String(p.bio || '').slice(0, 400),
    emailAll: p.email_all !== false,
    emailTypes: p.email_all !== false ? [...TIPI_EMAIL] : tipi,
  }
}

export function vuoleEmail(pref, tipo) {
  if (!pref || pref.emailAll) return true
  return (pref.emailTypes || []).includes(tipo)
}

export async function leggiPersonale(admin, userId) {
  if (!admin || !userId) return pulisci()
  try {
    const { data } = await admin.auth.admin.getUserById(userId)
    return pulisci(data?.user?.user_metadata?.[CHIAVE])
  } catch { return pulisci() }
}

// `patch` porta solo i campi da cambiare ({ nickname?, bio?, emailAll?, emailTypes? }).
export async function scriviPersonale(admin, userId, patch = {}) {
  const { data, error: e1 } = await admin.auth.admin.getUserById(userId)
  if (e1) throw e1
  const meta = data?.user?.user_metadata || {}
  const prima = meta[CHIAVE] || {}
  const dopo = { ...prima }
  if (patch.nickname !== undefined) dopo.nickname = String(patch.nickname || '').trim().slice(0, 40)
  if (patch.bio !== undefined) dopo.bio = String(patch.bio || '').trim().slice(0, 400)
  if (patch.emailAll !== undefined) dopo.email_all = patch.emailAll === true
  if (patch.emailTypes !== undefined) dopo.email_types = (patch.emailTypes || []).filter(x => TIPI_EMAIL.includes(x))
  const { error } = await admin.auth.admin.updateUserById(userId, { user_metadata: { ...meta, [CHIAVE]: dopo } })
  if (error) throw error
  return pulisci(dopo)
}

// Gli avvisi che QUESTA persona ha chiuso. Prima la lista stava sull'azienda dell'utente
// collegato: chiudere un avviso era un fatto dell'account, non della persona, e gli avvisi
// stessi si leggevano per utente invece che per workspace.
const CHIAVE_AVVISI = 'lyft_avvisi_chiusi'
export async function leggiAvvisiChiusi(admin, userId) {
  try { const { data } = await admin.auth.admin.getUserById(userId); const l = data?.user?.user_metadata?.[CHIAVE_AVVISI]; return Array.isArray(l) ? l : [] } catch { return [] }
}
export async function scriviAvvisiChiusi(admin, userId, lista) {
  const { data, error: e1 } = await admin.auth.admin.getUserById(userId)
  if (e1) throw e1
  const meta = data?.user?.user_metadata || {}
  const { error } = await admin.auth.admin.updateUserById(userId, { user_metadata: { ...meta, [CHIAVE_AVVISI]: lista.slice(-300) } })
  if (error) throw error
}
