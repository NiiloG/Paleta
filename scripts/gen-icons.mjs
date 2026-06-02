import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const svg = fs.readFileSync(path.join(root, 'app/icon.svg'))

function buildIco(pngBuffers) {
  // Each entry: { size, buf }
  const count = pngBuffers.length
  const headerSize = 6 + count * 16
  let offset = headerSize
  const entries = pngBuffers.map(({ size, buf }) => {
    const e = { size, buf, offset }
    offset += buf.length
    return e
  })
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(count, 4)
  const dirs = entries.map(({ size, buf, offset }) => {
    const d = Buffer.alloc(16)
    d.writeUInt8(size >= 256 ? 0 : size, 0)
    d.writeUInt8(size >= 256 ? 0 : size, 1)
    d.writeUInt8(0, 2)
    d.writeUInt8(0, 3)
    d.writeUInt16LE(1, 4)
    d.writeUInt16LE(32, 6)
    d.writeUInt32LE(buf.length, 8)
    d.writeUInt32LE(offset, 12)
    return d
  })
  return Buffer.concat([header, ...dirs, ...entries.map(e => e.buf)])
}

async function main() {
  const sizes = [16, 32, 48, 192, 512]
  const bufs = {}
  for (const s of sizes) {
    bufs[s] = await sharp(svg).resize(s, s).png().toBuffer()
  }

  fs.writeFileSync(path.join(root, 'public/icon-192.png'), bufs[192])
  fs.writeFileSync(path.join(root, 'public/icon-512.png'), bufs[512])
  fs.writeFileSync(path.join(root, 'public/apple-touch-icon.png'), bufs[192])

  const ico = buildIco([
    { size: 16, buf: bufs[16] },
    { size: 32, buf: bufs[32] },
    { size: 48, buf: bufs[48] },
  ])
  fs.writeFileSync(path.join(root, 'app/favicon.ico'), ico)
  fs.writeFileSync(path.join(root, 'public/favicon.ico'), ico)

  console.log('✓ public/icon-192.png')
  console.log('✓ public/icon-512.png')
  console.log('✓ public/apple-touch-icon.png')
  console.log('✓ app/favicon.ico')
  console.log('✓ public/favicon.ico')
}

main().catch(e => { console.error(e); process.exit(1) })
