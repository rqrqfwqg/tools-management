/**
 * gen-tabbar-icons.mjs — 生成 tabBar 占位 PNG 图标（81x81）
 *
 * 纯 Node 实现（无第三方依赖）：手写 PNG 编码器 + 简单几何图形光栅化。
 * 输出 10 张：5 个 tab × (正常灰色 #999999 + 选中蓝色 #1989fa)
 * 运行：npm run gen:tabbar-icons
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SIZE = 81
const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'src', 'static', 'tabbar')

const COLOR_NORMAL = [153, 153, 153, 255] // #999999
const COLOR_ACTIVE = [25, 137, 250, 255] // #1989fa
const TRANSPARENT = [0, 0, 0, 0]

/* ---------------- PNG 编码 ---------------- */

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // filter: none
    Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1)
  }
  const idat = deflateSync(raw)
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))])
}

/* ---------------- 画布与图形 ---------------- */

function makeCanvas() {
  return new Uint8Array(SIZE * SIZE * 4)
}

function setPixel(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return
  const i = (y * SIZE + x) * 4
  canvas[i] = color[0]
  canvas[i + 1] = color[1]
  canvas[i + 2] = color[2]
  canvas[i + 3] = color[3]
}

function fillRect(canvas, x0, y0, x1, y1, color) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      setPixel(canvas, x, y, color)
    }
  }
}

function fillCircle(canvas, cx, cy, r, color) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= r * r) setPixel(canvas, x, y, color)
    }
  }
}

function pointInTriangle(px, py, pts) {
  const [[ax, ay], [bx, by], [cx, cy]] = pts
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by)
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy)
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay)
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}

function fillTriangle(canvas, pts, color) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (pointInTriangle(x, y, pts)) setPixel(canvas, x, y, color)
    }
  }
}

function fillEllipseTop(canvas, cx, cy, rx, ry, color) {
  // 上半椭圆（用于"人像"身体）
  for (let y = cy - ry; y <= cy; y++) {
    for (let x = cx - rx; x <= cx + rx; x++) {
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue
      const dx = (x - cx) / rx
      const dy = (y - cy) / ry
      if (dx * dx + dy * dy <= 1) setPixel(canvas, x, y, color)
    }
  }
}

/* ---------------- 各 tab 图形 ---------------- */

function drawHome(canvas, color) {
  // 屋顶三角 + 房身矩形
  fillTriangle(canvas, [[40.5, 10], [6, 40], [75, 40]], color)
  fillRect(canvas, 17, 38, 64, 70, color)
  // 门（镂空 → 画背景色）无需处理，纯色即可
}

function drawTools(canvas, color) {
  // 十字扳手形
  fillRect(canvas, 35, 12, 46, 69, color)
  fillRect(canvas, 12, 35, 69, 46, color)
}

function drawMaterial(canvas, color) {
  // 盒子：主体矩形 + 盒盖横条
  fillRect(canvas, 13, 24, 68, 68, color)
  fillRect(canvas, 11, 18, 70, 30, color)
}

function drawOrders(canvas, color) {
  // 单据：圆角矩形（用矩形近似）+ 三条文本线（用背景色镂空）
  fillRect(canvas, 20, 8, 61, 73, color)
  fillRect(canvas, 27, 22, 54, 26, TRANSPARENT)
  fillRect(canvas, 27, 34, 54, 38, TRANSPARENT)
  fillRect(canvas, 27, 46, 54, 50, TRANSPARENT)
}

function drawProfile(canvas, color) {
  // 人像：头圆 + 上半身椭圆
  fillCircle(canvas, 40.5, 28, 13, color)
  fillEllipseTop(canvas, 40.5, 66, 26, 24, color)
}

const DRAWERS = {
  home: drawHome,
  tools: drawTools,
  material: drawMaterial,
  orders: drawOrders,
  profile: drawProfile
}

/* ---------------- 主流程 ---------------- */

mkdirSync(OUT_DIR, { recursive: true })

for (const [name, draw] of Object.entries(DRAWERS)) {
  for (const [suffix, color] of [
    ['', COLOR_NORMAL],
    ['-active', COLOR_ACTIVE]
  ]) {
    const canvas = makeCanvas()
    draw(canvas, color)
    const png = encodePNG(SIZE, SIZE, canvas)
    const file = join(OUT_DIR, `${name}${suffix}.png`)
    writeFileSync(file, png)
    console.log(`generated: ${file}`)
  }
}

console.log('tabBar 图标生成完成：10 张 (81x81 PNG)')
