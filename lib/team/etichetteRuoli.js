// I nomi dei ruoli, in un posto che possano usare tutti (profilo, elenco dei colleghi).
// Quelli di serie + quelli inventati nel workspace (companies.team_custom_roles).
export const RUOLI_DI_SERIE = {
  admin: 'Admin',
  cro_specialist: 'CRO Specialist',
  ecommerce_manager: 'E-commerce Manager',
  advertising_manager: 'Advertising / Marketing / SEO',
  data_analyst: 'Data Analyst / Revisore',
  guest: 'Ospite',
}

const memoria = new Map()   // workspace → { t, mappa }
export async function etichetteDelWorkspace(admin, workspaceId) {
  const m = memoria.get(workspaceId)
  if (m && Date.now() - m.t < 5 * 60_000) return m.mappa
  const mappa = { ...RUOLI_DI_SERIE }
  try {
    const { data } = await admin.from('companies').select('team_custom_roles').eq('user_id', workspaceId).maybeSingle()
    for (const r of (Array.isArray(data?.team_custom_roles) ? data.team_custom_roles : [])) if (r?.id && r?.label) mappa[r.id] = String(r.label).slice(0, 60)
  } catch {}
  memoria.set(workspaceId, { t: Date.now(), mappa })
  return mappa
}

// "Admin · CRO Specialist": il ruolo come lo si scrive in una descrizione.
export const ruoloInChiaro = (roles, mappa) => (Array.isArray(roles) ? roles : []).map(r => mappa[r] || r).filter(Boolean).join(' · ')
