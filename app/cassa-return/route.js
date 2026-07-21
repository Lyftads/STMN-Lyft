import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Callback del collegamento bancario (redirect registrato presso il provider
// open banking: deve essere un path SENZA query). Rimbalza sull'app alla tab
// Cassa preservando code/state per lo scambio sessione.
export function GET(request) {
  const url = new URL(request.url)
  const dest = new URL('/', url.origin)
  dest.searchParams.set('tab', 'cassa')
  dest.searchParams.set('bankConnected', '1')
  for (const k of ['code', 'state', 'error', 'error_description']) {
    const v = url.searchParams.get(k)
    if (v) dest.searchParams.set(k, v)
  }
  return NextResponse.redirect(dest)
}
