// Guard anti-SSRF: valida che un URL fornito dall'utente punti a un host
// PUBBLICO prima di farne il fetch lato server. Blocca loopback, reti private,
// link-local (incl. metadata cloud 169.254.169.254) e schemi non http(s).
// Risolve il DNS e controlla TUTTI gli indirizzi (anti DNS-rebinding).
import dns from 'node:dns/promises'
import net from 'node:net'

function isPrivateV4(ip) {
  const p = ip.split('.').map(Number)
  if (p.length !== 4 || p.some(n => Number.isNaN(n))) return true
  if (p[0] === 0 || p[0] === 127) return true                          // this-network / loopback
  if (p[0] === 10) return true                                          // private
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true            // private
  if (p[0] === 192 && p[1] === 168) return true                        // private
  if (p[0] === 169 && p[1] === 254) return true                        // link-local / metadata
  if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true           // CGNAT
  if (p[0] >= 224) return true                                          // multicast/reserved
  return false
}

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) return isPrivateV4(ip)
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase()
    if (low === '::1' || low === '::') return true
    if (low.startsWith('fc') || low.startsWith('fd')) return true       // ULA
    if (low.startsWith('fe80')) return true                             // link-local
    if (low.startsWith('::ffff:')) return isPrivateV4(low.split(':').pop()) // IPv4-mapped
    return false
  }
  return true
}

// Ritorna l'URL se è pubblico, altrimenti lancia. Usare PRIMA di ogni fetch
// server-side di URL forniti dall'utente.
export async function assertPublicUrl(rawUrl) {
  let u
  try { u = new URL(rawUrl) } catch { throw new Error('URL non valido') }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Schema URL non consentito')
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === 'metadata.google.internal') {
    throw new Error('Host non consentito')
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('IP non consentito')
    return rawUrl
  }
  let addrs
  try { addrs = await dns.lookup(host, { all: true }) }
  catch { throw new Error('DNS non risolvibile') }
  if (!addrs.length) throw new Error('DNS vuoto')
  for (const a of addrs) if (isPrivateIp(a.address)) throw new Error('Host risolve a un IP interno')
  return rawUrl
}
