// Accende la squadra che un cliente ha chiesto dal prodotto.
//
//   node scripts/accendi-squadra.mjs <workspace> <url del servizio> [--prodotto https://…]
//
// Fa la parte che riguarda il PRODOTTO: crea il gettone del servizio e il segreto della sua pagina,
// ne salva solo le impronte nel database e mette la squadra in stato «attiva». I tre valori che il
// servizio deve avere fra le sue variabili (STUDIO_URL, STUDIO_TOKEN, SEGRETO) NON vengono stampati:
// finiscono in un file leggibile solo da te, da caricare sul servizio e poi cancellare.
// Il servizio si avvia con: node src/avvio-remoto.js
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const [ws, url] = process.argv.slice(2).filter(a => !a.startsWith('--'))
const iProd = process.argv.indexOf('--prodotto')
const env = Object.fromEntries(fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n').map(r => /^([A-Za-z0-9_]+)=(.*)$/.exec(r.trim())).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]))
const prodotto = (iProd > 0 ? process.argv[iProd + 1] : env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')
if (!/^[0-9a-f-]{36}$/i.test(ws || '') || !/^https?:\/\/[^\s]+$/.test(url || '') || !/^https?:\/\//.test(prodotto)) { console.error('uso: node scripts/accendi-squadra.mjs <workspace> <url del servizio> [--prodotto https://…]'); process.exit(1) }

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: riga, error } = await db.from('studio_squadre').select('workspace_id, stato, configurazione').eq('workspace_id', ws).maybeSingle()
if (error) { console.error('database:', error.message); process.exit(1) }
if (!riga) { console.error('questo workspace non ha chiesto una squadra'); process.exit(1) }
if (!['richiesta', 'ferma'].includes(riga.stato)) { console.error(`la squadra è in stato «${riga.stato}»: si accende solo una squadra richiesta o ferma`); process.exit(1) }

const gettone = crypto.randomBytes(32).toString('hex'), segreto = crypto.randomBytes(24).toString('hex')
const impronta = (x) => crypto.createHash('sha256').update(x).digest('hex')
const chiavePagina = impronta(`squadra|${segreto}`).slice(0, 32)
const u = await db.from('studio_squadre').update({ url: url.replace(/\/+$/, ''), chiave: chiavePagina, token_hash: impronta(gettone), stato: 'attiva', attiva: true, aggiornata_il: new Date().toISOString() }).eq('workspace_id', ws)
if (u.error) { console.error('database:', u.error.message); process.exit(1) }

const file = path.join(os.homedir(), `.squadra-${ws.slice(0, 8)}.env`)
fs.writeFileSync(file, `STUDIO_URL=${prodotto}\nSTUDIO_TOKEN=${gettone}\nSEGRETO=${segreto}\nURL_PUBBLICO=${url.replace(/\/+$/, '')}\nSQUADRA_DATI=/data\n`, { mode: 0o600 })
console.log(`Squadra attiva nel prodotto. Variabili del servizio in ${file} (caricale sul servizio, poi cancella il file).`)
