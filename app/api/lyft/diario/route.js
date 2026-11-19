import { getCurrentUserId } from '../../../../lib/tenant/credentials'

export const dynamic = 'force-dynamic'

// Diario della voce, SOLO in sviluppo: cosa fa il microfono nel browser di chi prova (parte, errore,
// cosa ha capito). Serve a trovare perche' «Hey Lyft» non parte su un certo computer. In produzione
// e' spento: cio' che una persona dice davanti al microfono non deve finire nei registri del server.
export async function POST(req) {
  if (process.env.NODE_ENV === 'production') return new Response(null, { status: 404 })
  if (!(await getCurrentUserId().catch(() => null))) return new Response(null, { status: 401 })
  const b = await req.json().catch(() => ({}))
  console.log(`[voce-lyft] ${String(b.evento || '').slice(0, 40)} ${String(b.dettaglio || '').slice(0, 200)}`)
  return new Response(null, { status: 204 })
}
