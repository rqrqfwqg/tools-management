/**
 * ESC/POS 指令构造（标签打印通用框架）
 * ---------------------------------------------------------------
 * 精臣（Jingchen）桌面/便携条码机多数兼容 ESC/POS。
 * 本文件只构建「通用 ESC/POS 字节流」，Jingchen 专属指令
 * （图片光栅、特定页宽/浓度、蜂鸣等）已在对应函数标注 TODO，待实测后填充。
 *
 * 关键约束（务必先看）：
 *  - 蓝牙 BLE 每包上限 20 字节（MTU），分包发送由 useBluetoothPrinter 负责。
 *  - 文本指令对中文需 GBK 编码（见 toGBK）。ASCII 直发即可。
 *    建议二维码内容用 ASCII（如 SI-1A2B3C4D），保证扫码稳定、无需编码表。
 *  - 不同机型页宽/密度不同，printLabel 默认按 58mm 常见参数，
 *    真机不符时调 pageWidth / density。
 */

const ESC = 0x1b
const GS = 0x1d

/** ASCII 字符串 → Uint8Array（用于编码/英文标识，中文会乱码，请用 toGBK） */
export function asciiBytes(str: string): Uint8Array {
  const out = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff
  return out
}

/**
 * 中文 GBK 编码（精简占位版）
 * TODO(生产必填)：小程序无内置 GBK，正式上线请引入 gbk.js（约 30KB 码表）替换本实现，
 * 否则中文文本行会乱码。当前实现：ASCII 直发；非 ASCII 降级为 '?' 并打告警。
 * 二维码内容本身建议用 ASCII，不受此限制。
 */
export function toGBK(str: string): Uint8Array {
  const bytes: number[] = []
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    if (c < 0x80) {
      bytes.push(c)
    } else {
      // 非 ASCII：占位降级（生产应走完整 GBK 码表）
      if (c > 0x80) console.warn('[escpos] 非 ASCII 字符跳过 GBK 编码:', str[i])
      bytes.push(0x3f) // '?'
    }
  }
  return new Uint8Array(bytes)
}

/** 文本（自动选 ASCII/GBK：含中文走 toGBK） */
export function textBytes(str: string): Uint8Array {
  const hasCJK = /[^\x00-\xff]/.test(str)
  return hasCJK ? toGBK(str) : asciiBytes(str)
}

function concat(parts: Uint8Array[]): Uint8Array {
  let len = 0
  for (const p of parts) len += p.length
  const out = new Uint8Array(len)
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return out
}

/** 初始化打印机（清缓存/复位） */
export function initialize(): Uint8Array {
  return new Uint8Array([ESC, 0x40])
}

/** 对齐：0 左 / 1 中 / 2 右 */
export function align(mode: 0 | 1 | 2): Uint8Array {
  return new Uint8Array([ESC, 0x61, mode])
}

/** 加粗开关 */
export function bold(on: boolean): Uint8Array {
  return new Uint8Array([ESC, 0x45, on ? 1 : 0])
}

/** 字高字宽放大（n: 0x00 正常；0x11 = 2x2；0x22 = 3x3 ...） */
export function scale(n: number): Uint8Array {
  return new Uint8Array([GS, 0x21, n & 0xff])
}

/** 打印并换行（文本行） */
export function textLine(str: string, opts: { bold?: boolean; scaleN?: number } = {}): Uint8Array {
  const parts: Uint8Array[] = []
  if (opts.scaleN != null) parts.push(scale(opts.scaleN))
  if (opts.bold) parts.push(bold(true))
  parts.push(textBytes(str))
  parts.push(new Uint8Array([0x0a])) // LF
  if (opts.bold) parts.push(bold(false))
  if (opts.scaleN != null) parts.push(scale(0x00))
  return concat(parts)
}

/** 换行 / 走纸 n 行 */
export function feedLines(n = 1): Uint8Array {
  return new Uint8Array([ESC, 0x64, n & 0xff])
}

/** 切纸（标签机多为撕纸，可不调用；full=true 全切，false 半切） */
export function cut(full = true): Uint8Array {
  return new Uint8Array([GS, 0x56, full ? 0x00 : 0x01])
}

/**
 * 二维码（ESC/POS 标准 GS ( k 指令族）
 * @param content 二维码内容（建议 ASCII，如 SI-1A2B3C4D）
 * @param opts model 1/2（默认2）；ecLevel L/M/Q/H；size 模块尺寸 1..16（默认6）
 */
export function qrCode(content: string, opts: { model?: 1 | 2; ecLevel?: 'L' | 'M' | 'Q' | 'H'; size?: number } = {}): Uint8Array {
  const model = opts.model ?? 2
  const ecMap: Record<string, number> = { L: 0x30, M: 0x31, Q: 0x32, H: 0x33 }
  const ec = ecMap[opts.ecLevel ?? 'M']
  const size = Math.min(16, Math.max(1, opts.size ?? 6))
  const data = asciiBytes(content) // 二维码内容为原始字节，ASCII 最稳妥

  const parts: Uint8Array[] = []
  // 1) 选模型：GS ( k 04 00 31 41 <model> 00
  parts.push(new Uint8Array([GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, model, 0x00]))
  // 2) 纠错级别：GS ( k 03 00 31 45 <ec>
  parts.push(new Uint8Array([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, ec]))
  // 3) 写入数据：GS ( k pL pH 31 50 30 00 <data>
  const payload = concat([new Uint8Array([0x31, 0x50, 0x30, 0x00]), data])
  const total = payload.length
  const pL = total & 0xff
  const pH = (total >> 8) & 0xff
  parts.push(new Uint8Array([GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30, 0x00]))
  parts.push(data)
  // 4) 打印：GS ( k 03 00 31 51 <size>
  parts.push(new Uint8Array([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, size]))
  return concat(parts)
}

/**
 * 一维条码（CODE128 等，可选；标签主用二维码，这里保留通用能力）
 * @param code 内容  @param type 0x00=UPC-A 0x01=UPC-E 0x02=EAN13 0x03=EAN8 0x04=CODE39 0x05=ITF 0x06=CODABAR 0x07=CODE128
 */
export function barcode(code: string, type = 0x07): Uint8Array {
  const data = asciiBytes(code)
  return concat([
    new Uint8Array([GS, 0x6b, type, data.length]),
    data,
    new Uint8Array([0x0a])
  ])
}

/** TODO(Jingchen 专属)：图片光栅打印——精臣机型常用 GS v 0 位图指令，
 *  需把二值化图像按 8 点/字节打包后下发。生产阶段填充。 */

export interface LabelSpec {
  /** 主显：标题（如「备件单品」） */
  title?: string
  /** 副显：名称（如「膨胀螺栓 M10」）—— 含中文需 GBK */
  name?: string
  /** 二维码内容（建议 ASCII，如 SI-1A2B3C4D） */
  code: string
  /** 二维码下方是否再打印一行明文编码（默认 true，便于人工核对） */
  showCodeText?: boolean
  /** 模块尺寸 1..16 */
  qrSize?: number
  /** 走纸换行数（标签间距） */
  feed?: number
  /** 是否切纸（标签机通常 false） */
  doCut?: boolean
}

/**
 * 组合一张标签的完整字节流：
 * 复位 → 居中 → 标题(放大) → 名称 → 二维码 → (明文编码) → 走纸 → 切纸
 */
export function buildLabel(spec: LabelSpec): Uint8Array {
  const parts: Uint8Array[] = []
  parts.push(initialize())
  parts.push(align(1)) // 居中

  if (spec.title) {
    parts.push(textLine(spec.title, { bold: true, scaleN: 0x11 }))
  }
  if (spec.name) {
    parts.push(textLine(spec.name, { scaleN: 0x00 }))
  }
  // 二维码
  parts.push(qrCode(spec.code, { size: spec.qrSize ?? 6 }))
  if (spec.showCodeText !== false) {
    parts.push(textLine(spec.code, { scaleN: 0x00 }))
  }
  parts.push(feedLines(spec.feed ?? 3))
  if (spec.doCut) parts.push(cut(false))
  return concat(parts)
}
