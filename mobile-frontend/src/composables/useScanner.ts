/**
 * useScanner — html5-qrcode 扫码封装
 *
 * 封装摄像头扫码逻辑，支持：
 * - Code128 条形码识别
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
        formatsToSupport: [Html5QrcodeSupportedFormats.CODE_128],
        verbose: false
      })

      scanning.value = true

      await scanner.start(
        { facingMode },
        {
          fps: 10,
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
    startScanning,
    stopScanning,
    destroy
  }
}
