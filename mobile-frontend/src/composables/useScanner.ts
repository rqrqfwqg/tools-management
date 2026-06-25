/**
 * useScanner — html5-qrcode 扫码封装
 *
 * 封装摄像头扫码逻辑，支持：
 * - Code128 条形码识别
 * - 扫码成功自动停止
 * - 手动输入降级
 * - 权限错误友好提示
 */
import { ref, onUnmounted } from 'vue'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'

export interface ScannerOptions {
  /** 扫码容器元素 ID */
  elementId?: string
  /** 扫码框尺寸 */
  qrbox?: { width: number; height: number }
  /** 扫码成功回调 */
  onSuccess?: (code: string) => void
  /** 扫码失败回调 */
  onError?: (err: string) => void
}

export function useScanner(options: ScannerOptions = {}) {
  const {
    elementId = 'scanner-viewport',
    qrbox = { width: 250, height: 100 },
    onSuccess,
    onError
  } = options

  const scanning = ref(false)
  const error = ref('')
  const lastCode = ref('')
  /** 当前环境是否支持摄像头扫码 */
  const cameraSupported = ref(true)

  let scanner: Html5Qrcode | null = null
  /** 防止并发启动扫码 */
  let isStarting = false

  /**
   * 检测当前环境是否支持摄像头扫码
   * getUserMedia 要求 HTTPS 或 localhost，否则 navigator.mediaDevices 为 undefined
   */
  function checkCameraSupport(): boolean {
    if (typeof navigator === 'undefined') return false
    // 安全上下文检查（HTTPS / localhost / file://）
    if (!window.isSecureContext) return false
    // mediaDevices API 存在性检查
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      return false
    }
    return true
  }

  /** 初始化 Html5Qrcode 实例 */
  function getScanner(): Html5Qrcode {
    if (!scanner) {
      scanner = new Html5Qrcode(elementId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.CODE_128],
        verbose: false
      })
    }
    return scanner
  }

  /**
   * 停止扫码并清理内部状态
   *
   * 必须先 stop() 再 clear()，否则 html5-qrcode 抛出
   * "Cannot clear while scan is ongoing, close it first."
   */
  async function stopScanning(): Promise<void> {
    scanning.value = false
    if (!scanner) return

    try {
      // 先停止扫描（关闭摄像头流）
      if (scanner.isScanning) {
        await scanner.stop()
      }
      // 再清理 UI 状态，为下次 start 做准备
      try { scanner.clear() } catch { /* 已清理或未启动，忽略 */ }
    } catch {
      // 已停止或未在扫描，忽略
    }
  }

  /**
   * 开始扫码
   *
   * @param facingMode 摄像头方向 'environment'（后摄）| 'user'（前摄）
   */
  async function startScanning(facingMode: 'environment' | 'user' = 'environment'): Promise<void> {
    // 防止并发启动（onSuccess 回调中可能触发 restart）
    if (isStarting) return
    isStarting = true

    try {
      // 先确保上一次扫描已完全停止 + 清理完毕
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

      const s = getScanner()

      scanning.value = true

      await s.start(
        { facingMode },
        {
          fps: 10,
          qrbox
        },
        (decodedText: string) => {
          // 成功识别
          lastCode.value = decodedText
          // 先完全停止扫描（await），再触发回调
          // 确保回调中 restart 时 scanner 已处于干净状态
          stopScanning().then(() => {
            onSuccess?.(decodedText)
          })
        },
        () => {
          // 每帧扫描尝试（空回调，忽略未识别帧）
        }
      )
    } catch (err: any) {
      scanning.value = false
      const msg: string = err?.message || String(err)

      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        error.value = '摄像头权限被拒绝，请在浏览器设置中允许摄像头访问，或手动输入工具编码。'
      } else if (msg.includes('NotFoundError') || msg.includes('No camera')) {
        error.value = '未检测到摄像头设备，请手动输入工具编码。'
      } else if (msg.includes('NotReadableError')) {
        error.value = '摄像头被其他应用占用，请关闭其他使用摄像头的应用后重试。'
      } else if (msg.includes('NotSecure') || msg.includes('not supported') || msg.includes('streaming not supported')) {
        cameraSupported.value = false
        error.value = '当前环境不支持摄像头扫码（需 HTTPS 访问），请使用下方手动输入工具编码。'
      } else if (msg.includes('already') || msg.includes('Cannot clear')) {
        // 扫描器仍残留状态，强制清理后静默处理（不报错给用户）
        await stopScanning()
      } else {
        error.value = `摄像头启动失败: ${msg}`
      }

      if (error.value) onError?.(error.value)
    } finally {
      isStarting = false
    }
  }

  /**
   * 销毁实例（组件卸载时调用）
   */
  async function destroy(): Promise<void> {
    await stopScanning()
    scanner = null
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
    startScanning,
    stopScanning,
    destroy
  }
}
