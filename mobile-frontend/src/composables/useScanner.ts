/**
 * useScanner — html5-qrcode 扫码封装
 *
 * 封装摄像头扫码逻辑，支持：
 * - Code128 / EAN13 / CODE39 条形码识别（启用原生 BarcodeDetector 提升弱光识别）
 * - QR_CODE 二维码识别（增量 R5：新标签左二维码+右文字，扫码即得内部编码）
 * - 闪光灯（手电筒）开关
 * - 扫码成功自动停止
 * - 手动输入降级
 * - 权限错误友好提示
 * - 多次连续扫码不卡死（每次销毁实例 + 清理 DOM）
 *
 * 本版新增（弱光扫码进阶增强，见增量设计 §3.2）：
 * - 组合 useBrightness：扫码生命周期内启停亮度监控，输出 lowLightState
 * - 探测摄像头进阶能力（exposureCompensation / iso / torch）并合并施加约束
 * - qrbox 依视口自适应计算（R5：改为方形以适配二维码；一维码仍可在此区域内识别）
 * - toggleTorch 改造为走合并约束，避免 torch 与曝光/ISO 互相覆盖
 *
 * 重要：本文件不得改动 onSuccess 回调中任何 BX- / handleToolkitCode / getToolkitByCode
 * 相关逻辑；本次仅做"不破坏"回归（代码未动）。
 */
import { ref, onUnmounted } from 'vue'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { useBrightness } from './useBrightness'

/** 自动补光策略：仅占位，首版恒为 'manual'，P1 扩展 'auto' | 'smart' */
export type AutoTorchStrategy = 'manual'

/** 弱光增强配置 */
export interface LowLightOptions {
  /** 暗光阈值，默认 40 */
  darkThreshold?: number
  /** 是否启用 qrbox 自适应，默认 true；false 时回退到传入的 qrbox */
  qrboxAuto?: boolean
  /** 自动开灯策略占位，默认 'manual'（首版不实现自动逻辑） */
  autoTorchStrategy?: AutoTorchStrategy
  /** exposureCompensation 目标值；未设或设备不支持则不施加（施加时按 caps 范围 clamp + 设上限） */
  exposureBoost?: number
  /** iso 目标值；未设或设备不支持则不施加（施加时按 caps 范围 clamp，且上限封顶防噪点） */
  isoBoost?: number
  /** 透传给 useBrightness 的采样间隔(ms) */
  sampleIntervalMs?: number
}

/** 扫码配置 */
export interface ScannerOptions {
  /** 扫码容器元素 ID */
  elementId?: string
  /** 扫码框尺寸（qrboxAuto=false 时作为回退值） */
  qrbox?: { width: number; height: number }
  /** 扫码帧率（默认 15，越高越灵敏但更耗电） */
  fps?: number
  /** 扫码成功回调 */
  onSuccess?: (code: string) => void
  /** 扫码失败回调 */
  onError?: (err: string) => void
  /** 弱光增强配置 */
  lowLight?: LowLightOptions
}

/** 弱光状态聚合（透出给页面消费） */
export interface LowLightState {
  /** 当前 Y 均值亮度(0-255)；未就绪为 -1 */
  brightness: ReturnType<typeof ref<number>>
  /** brightness < darkThreshold */
  isDark: ReturnType<typeof ref<boolean>>
  /** 本次扫码会话"忽略暗光提示"标记 */
  ignored: ReturnType<typeof ref<boolean>>
  /** 设置忽略标记 */
  setIgnored: (v: boolean) => void
}

/** 摄像头轨道进阶能力（探测结果） */
interface ResolvedCapabilities {
  /** 是否支持手电筒（torch） */
  torch: boolean
  /** 曝光补偿取值范围；不支持为 null */
  exposureCompensation: { min: number; max: number } | null
  /** ISO 取值范围；不支持为 null */
  iso: { min: number; max: number } | null
}

/** 数值 clamp 到 [min, max] */
function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

export function useScanner(options: ScannerOptions = {}) {
  const {
    elementId = 'scanner-viewport',
    qrbox = { width: 280, height: 120 },
    fps = 15,
    onSuccess,
    onError,
    lowLight = {}
  } = options

  const scanning = ref(false)
  const error = ref('')
  const lastCode = ref('')
  /** 当前环境是否支持摄像头扫码 */
  const cameraSupported = ref(true)
  /** 设备摄像头是否支持闪光灯（手电筒） */
  const torchSupported = ref(false)
  /** 闪光灯当前开关状态（用户意图，跨扫码保留） */
  const torchOn = ref(false)

  let scanner: Html5Qrcode | null = null

  /** 摄像头轨道进阶能力（每次 start 成功后重新探测） */
  const caps: ResolvedCapabilities = {
    torch: false,
    exposureCompensation: null,
    iso: null
  }

  // 组合 useBrightness：亮度检测的启停由 useScanner 在其扫码生命周期内驱动
  const brightness = useBrightness({
    viewportId: elementId,
    darkThreshold: lowLight.darkThreshold ?? 40,
    sampleIntervalMs: lowLight.sampleIntervalMs ?? 300
  })

  /** 弱光状态聚合（透出给页面） */
  const lowLightState: LowLightState = {
    brightness: brightness.brightness,
    isDark: brightness.isDark,
    ignored: brightness.ignored,
    setIgnored: brightness.setIgnored
  }

  /**
   * 检测当前环境是否支持摄像头扫码
   * getUserMedia 要求 HTTPS 或 localhost，否则 navigator.mediaDevices 为 undefined
   */
  function checkCameraSupport(): boolean {
    if (typeof navigator === 'undefined') return false
    if (!window.isSecureContext) return false
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      return false
    }
    return true
  }

  /**
   * 清理扫码容器 DOM 中的残留元素
   * html5-qrcode 会在容器内注入 <video> 和 <canvas>，
   * 如果不清理，新实例 start() 会失败
   */
  function cleanDomContainer(): void {
    const el = document.getElementById(elementId)
    if (el) {
      el.innerHTML = ''
    }
  }

  /**
   * 停止扫码并彻底清理
   *
   * 1. scanner.stop() — 关闭摄像头流
   * 2. scanner.clear() — 清理 UI 状态
   * 3. scanner = null — 释放实例引用
   * 4. 清理 DOM — 移除残留的 <video>/<canvas>
   */
  async function stopScanning(): Promise<void> {
    scanning.value = false
    // 先停止亮度监控（保留 ignored 标记，跨实例保留）
    stopBrightnessMonitor()

    if (!scanner) {
      // 即使没有 scanner 实例，也清理一下 DOM（防御性）
      cleanDomContainer()
      return
    }

    const s = scanner
    scanner = null

    try {
      if (s.isScanning) {
        await s.stop()
      }
    } catch {
      // 忽略停止错误
    }

    try {
      s.clear()
    } catch {
      // 忽略清理错误
    }

    // 彻底清理 DOM 中的残留 video/canvas
    cleanDomContainer()
    // 注意：物理闪光灯随轨道销毁自动熄灭，但【不重置】torchOn / torchSupported：
    // - torchSupported 是设备属性，多次扫码间不会变化，保留避免按钮闪烁消失
    // - torchOn 是用户意图，连续扫码场景需在下一次 start 后重新应用，保持常亮
  }

  /**
   * 探测当前摄像头轨道进阶能力（torch / exposureCompensation / iso）
   * 必须在扫描运行中调用（getRunningTrackCapabilities 依赖 running track）
   * 扩展自原 detectTorchSupport()，额外探测曝光与 ISO 支持与取值范围。
   * 探测失败或不支持时静默降级（对应能力置为不支持）。
   */
  function detectCapabilities(): void {
    if (!scanner) return
    try {
      const c = scanner.getRunningTrackCapabilities() as MediaTrackCapabilities
      const anyCaps = c as unknown as Record<string, unknown>

      // torch
      caps.torch = !!anyCaps['torch']
      torchSupported.value = caps.torch

      // exposureCompensation
      const ec = anyCaps['exposureCompensation'] as { min?: number; max?: number } | undefined
      if (ec && typeof ec.max === 'number' && typeof ec.min === 'number') {
        caps.exposureCompensation = { min: ec.min, max: ec.max }
      } else {
        caps.exposureCompensation = null
      }

      // iso
      const iso = anyCaps['iso'] as { min?: number; max?: number } | undefined
      if (iso && typeof iso.max === 'number' && typeof iso.min === 'number') {
        caps.iso = { min: iso.min, max: iso.max }
      } else {
        caps.iso = null
      }
    } catch {
      // 探测失败：全部按不支持处理，静默降级
      caps.torch = false
      caps.exposureCompensation = null
      caps.iso = null
      torchSupported.value = false
    }
  }

  /**
   * 构造并一次性施加合并的进阶视频约束（核心）
   * 将 torch + exposureCompensation + iso 合并为【单个】 advanced 约束对象，
   * 仅通过一次 applyVideoConstraints({ advanced: [merged] }) 施加，
   * 避免多次调用互相覆盖（见设计 §7.1）。
   *
   * 默认推导值（未显式传入 exposureBoost / isoBoost 时）：
   * - exposureCompensation：clamp(round(caps.max * 0.7), caps.min, caps.max)
   * - iso：400，且封顶 ≤ 800 防噪点，再 clamp 到设备范围
   */
  async function applyMergedConstraints(): Promise<void> {
    if (!scanner) return

    const merged: Record<string, unknown> = {}

    // 1) 手电筒：仅当用户意图 torchOn 为真时施加
    if (torchOn.value) {
      merged.torch = true
    }

    // 2) 曝光补偿：设备支持即施加（提升弱光成像）
    if (caps.exposureCompensation) {
      const { min, max } = caps.exposureCompensation
      let value: number
      if (typeof lowLight.exposureBoost === 'number') {
        value = lowLight.exposureBoost
      } else {
        value = Math.round(max * 0.7)
      }
      value = clamp(value, min, max)
      merged.exposureCompensation = value
    }

    // 3) ISO：设备支持即施加（适度提 ISO，封顶防噪）
    if (caps.iso) {
      const { min, max } = caps.iso
      let value: number
      if (typeof lowLight.isoBoost === 'number') {
        value = lowLight.isoBoost
      } else {
        value = 400
      }
      value = Math.min(value, 800) // 封顶 ≤ 800 防噪点
      value = clamp(value, min, max)
      merged.iso = value
    }

    // 没有需要施加的约束时直接返回，避免无意义的 applyVideoConstraints 调用
    if (Object.keys(merged).length === 0) return

    try {
      // torch 是浏览器摄像头轨道的原生扩展能力，TS 类型库未收录，需断言
      await scanner.applyVideoConstraints({ advanced: [merged] } as any)
    } catch {
      // 设备拒绝施加（如部分能力不生效）：静默跳过，不影响基础扫码
    }
  }

  /** 包装 useBrightness.startMonitor()，供 startScanning 成功后调用 */
  function startBrightnessMonitor(): void {
    brightness.startMonitor()
  }

  /** 包装 useBrightness.stopMonitor()，保留 ignored 标记 */
  function stopBrightnessMonitor(): void {
    brightness.stopMonitor()
  }

  /**
   * 切换闪光灯开关
   * 翻转 torchOn 意图后调用 applyMergedConstraints()（合并施加 torch + 曝光/ISO），
   * 不再单独 applyVideoConstraints({advanced:[{torch}]})，避免约束互相覆盖。
   */
  async function toggleTorch(): Promise<void> {
    if (!scanner || !torchSupported.value) return
    torchOn.value = !torchOn.value
    await applyMergedConstraints()
  }

  /**
   * 计算扫码框尺寸
   * - qrboxAuto 为 false：回退到传入的 qrbox
   * - qrboxAuto 为 true：width = clamp(round(容器宽 * 0.8), 240, 480)，
   *   height = width（R5：二维码为方形，qrbox 改宽高相等；一维码仍可在此区域内识别）
   * 容器宽度取 #scanner-viewport 的 clientWidth，兜底 window.innerWidth。
   */
  function computeQrbox(): { width: number; height: number } {
    if (lowLight.qrboxAuto === false) {
      return qrbox
    }
    const container = document.getElementById(elementId)
    const containerWidth = container ? container.clientWidth : 0
    const base = containerWidth > 0 ? containerWidth : window.innerWidth
    const width = clamp(Math.round(base * 0.8), 240, 480)
    const height = width
    return { width, height }
  }

  /**
   * 开始扫码
   *
   * @param facingMode 摄像头方向 'environment'（后摄）| 'user'（前摄）
   */
  async function startScanning(facingMode: 'environment' | 'user' = 'environment'): Promise<void> {
    // 如果已经在扫描中，不重复启动
    if (scanning.value) return

    try {
      // 先确保上一次完全停止 + DOM 清理完毕
      await stopScanning()

      error.value = ''

      // 前置检查：环境是否支持摄像头
      if (!checkCameraSupport()) {
        cameraSupported.value = false
        scanning.value = false
        error.value = '当前环境不支持摄像头扫码（需 HTTPS 访问），请使用下方手动输入工具编码。'
        onError?.(error.value)
        return
      }

      // 确保容器存在且干净
      cleanDomContainer()

      // 每次都创建全新实例
      scanner = new Html5Qrcode(elementId, {
        // 启用手机原生 BarcodeDetector API（Android Chrome 支持），
        // 弱光识别能力与速度大幅增强；不支持时自动回退 ZXing
        useBarCodeDetectorIfSupported: true,
        formatsToSupport: [
          // R5：增加 QR_CODE（html5-qrcode 原生支持，ZXing/BarcodeDetector 双路径均可识别）
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.CODE_39
        ],
        verbose: false
      })

      scanning.value = true

      await scanner.start(
        // cameraIdOrConfig 传对象时只允许恰好 1 个 key（facingMode 或 deviceId）
        { facingMode },
        {
          fps,
          qrbox: computeQrbox(),
          // 分辨率通过 videoConstraints 设置（库会优先以它作为 getUserMedia 的 video 约束）
          videoConstraints: {
            facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        },
        (decodedText: string) => {
          // 成功识别
          lastCode.value = decodedText
          // 先完全停止 + 清理 DOM，再触发回调
          // 确保回调中 restart 时一切干净
          stopScanning().then(() => {
            onSuccess?.(decodedText)
          })
        },
        () => {
          // 每帧扫描尝试（空回调，忽略未识别帧）
        }
      )

      // start 成功后探测闪光灯与进阶能力支持情况
      detectCapabilities()
      // 一次性施加当前 torch + exposure + iso（合并约束，避免互相覆盖）
      await applyMergedConstraints()
      // 启动亮度监控（包装 useBrightness.startMonitor，兼容 video 异步注入）
      startBrightnessMonitor()
    } catch (err: any) {
      scanning.value = false
      const msg: string = err?.message || String(err)

      // 确保异常时也清理
      await stopScanning()

      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        error.value = '摄像头权限被拒绝，请在浏览器设置中允许摄像头访问，或手动输入工具编码。'
      } else if (msg.includes('NotFoundError') || msg.includes('No camera')) {
        error.value = '未检测到摄像头设备，请手动输入工具编码。'
      } else if (msg.includes('NotReadableError')) {
        error.value = '摄像头被其他应用占用，请关闭其他使用摄像头的应用后重试。'
      } else if (msg.includes('NotSecure') || msg.includes('not supported') || msg.includes('streaming not supported')) {
        cameraSupported.value = false
        error.value = '当前环境不支持摄像头扫码（需 HTTPS 访问），请使用下方手动输入工具编码。'
      } else {
        error.value = `摄像头启动失败: ${msg}`
      }

      if (error.value) onError?.(error.value)
    }
  }

  /**
   * 销毁实例（组件卸载时调用）
   */
  async function destroy(): Promise<void> {
    await stopScanning()
  }

  // 组件卸载时自动清理
  onUnmounted(() => {
    destroy()
  })

  return {
    scanning,
    error,
    lastCode,
    cameraSupported,
    torchSupported,
    torchOn,
    startScanning,
    stopScanning,
    toggleTorch,
    destroy,
    // 弱光状态聚合（新增导出，其余既有导出保持不变）
    lowLightState
  }
}
