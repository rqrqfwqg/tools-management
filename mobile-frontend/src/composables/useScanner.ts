/**
 * useScanner — html5-qrcode 扫码封装
 *
 * 封装摄像头扫码逻辑，支持：
 * - Code128 条形码识别（启用原生 BarcodeDetector 提升弱光识别）
 * - 闪光灯（手电筒）开关
 * - 扫码成功自动停止
 * - 手动输入降级
 * - 权限错误友好提示
 * - 多次连续扫码不卡死（每次销毁实例 + 清理 DOM）
 */
import { ref, onUnmounted } from 'vue'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'

export interface ScannerOptions {
  /** 扫码容器元素 ID */
  elementId?: string
  /** 扫码框尺寸 */
  qrbox?: { width: number; height: number }
  /** 扫码帧率（默认 15，越高越灵敏但更耗电） */
  fps?: number
  /** 扫码成功回调 */
  onSuccess?: (code: string) => void
  /** 扫码失败回调 */
  onError?: (err: string) => void
}

export function useScanner(options: ScannerOptions = {}) {
  const {
    elementId = 'scanner-viewport',
    qrbox = { width: 280, height: 120 },
    fps = 15,
    onSuccess,
    onError
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
   * 检测当前摄像头轨道是否支持闪光灯（torch 能力）
   * 必须在扫描运行中调用（getRunningTrackCapabilities 依赖 running track）
   */
  function detectTorchSupport(): void {
    if (!scanner) return
    try {
      const caps = scanner.getRunningTrackCapabilities() as MediaTrackCapabilities
      torchSupported.value = !!(caps && 'torch' in caps)
    } catch {
      torchSupported.value = false
    }
  }

  /**
   * 切换闪光灯开关
   * 通过 html5-qrcode 公开 API applyVideoConstraints({ advanced: [{ torch }] }) 控制
   */
  async function toggleTorch(): Promise<void> {
    if (!scanner || !torchSupported.value) return
    const next = !torchOn.value
    try {
      // torch 是浏览器摄像头轨道的原生扩展能力，TS 类型库未收录，需断言
      await scanner.applyVideoConstraints({ advanced: [{ torch: next }] } as any)
      torchOn.value = next
    } catch {
      // 设备不支持或应用失败，回退到关闭状态
      torchOn.value = false
    }
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
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.CODE_39
        ],
        verbose: false
      })

      scanning.value = true

      await scanner.start(
        // 提高摄像头采集分辨率，弱光下画质更好、更易识别
        { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        {
          fps,
          qrbox
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

      // start 成功后再检测闪光灯支持情况
      detectTorchSupport()
      // 若用户此前已开启闪光灯（连续扫码场景），重新打开以保持常亮
      if (torchOn.value) {
        try {
          await scanner.applyVideoConstraints({ advanced: [{ torch: true }] } as any)
        } catch {
          torchOn.value = false
        }
      }
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
    destroy
  }
}
