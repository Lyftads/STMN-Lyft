// ZIP builder minimale (metodo "store", senza compressione) — niente dipendenze.
// Serve a impacchettare le immagini di training per fal (images_data_url = zip).

function crc32(buf) {
  let table = crc32._t
  if (!table) {
    table = crc32._t = []
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c >>> 0
    }
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff]
  return (crc ^ 0xffffffff) >>> 0
}

// files: [{ name, data: Buffer }] → Buffer zip
export function buildZip(files) {
  const chunks = []
  const central = []
  let offset = 0
  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8')
    const data = f.data
    const crc = crc32(data)
    const size = data.length
    const lfh = Buffer.alloc(30)
    lfh.writeUInt32LE(0x04034b50, 0)
    lfh.writeUInt16LE(20, 4)
    lfh.writeUInt16LE(0, 6)
    lfh.writeUInt16LE(0, 8)   // store
    lfh.writeUInt16LE(0, 10)
    lfh.writeUInt16LE(0, 12)
    lfh.writeUInt32LE(crc, 14)
    lfh.writeUInt32LE(size, 18)
    lfh.writeUInt32LE(size, 22)
    lfh.writeUInt16LE(nameBuf.length, 26)
    lfh.writeUInt16LE(0, 28)
    chunks.push(lfh, nameBuf, data)
    const cdh = Buffer.alloc(46)
    cdh.writeUInt32LE(0x02014b50, 0)
    cdh.writeUInt16LE(20, 4)
    cdh.writeUInt16LE(20, 6)
    cdh.writeUInt16LE(0, 8)
    cdh.writeUInt16LE(0, 10)
    cdh.writeUInt16LE(0, 12)
    cdh.writeUInt16LE(0, 14)
    cdh.writeUInt32LE(crc, 16)
    cdh.writeUInt32LE(size, 20)
    cdh.writeUInt32LE(size, 24)
    cdh.writeUInt16LE(nameBuf.length, 28)
    cdh.writeUInt16LE(0, 30)
    cdh.writeUInt16LE(0, 32)
    cdh.writeUInt16LE(0, 34)
    cdh.writeUInt16LE(0, 36)
    cdh.writeUInt32LE(0, 38)
    cdh.writeUInt32LE(offset, 42)
    central.push({ cdh, nameBuf })
    offset += lfh.length + nameBuf.length + data.length
  }
  const cdStart = offset
  for (const c of central) { chunks.push(c.cdh, c.nameBuf); offset += c.cdh.length + c.nameBuf.length }
  const cdSize = offset - cdStart
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(files.length, 8)
  eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(cdSize, 12)
  eocd.writeUInt32LE(cdStart, 16)
  eocd.writeUInt16LE(0, 20)
  chunks.push(eocd)
  return Buffer.concat(chunks)
}

// Decodifica una data URL immagine in { buf, ext }.
export function dataUrlToBuffer(dataUrl) {
  const m = (dataUrl || '').match(/^data:([^;]+);base64,(.*)$/)
  if (!m) return null
  const ct = m[1]
  const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg'
  return { buf: Buffer.from(m[2], 'base64'), ext, contentType: ct }
}
