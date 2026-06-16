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

  let scanner: Html5Qrcode | null = null

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
   * 开始扫码
   *
   * @param facingMode 摄像头方向 'environment'（后摄）| 'user'（前摄）
   */
  async function startScanning(facingMode: 'environment' | 'user' = 'environment'): Promise<void> {
    error.value = ''
    const s = getScanner()

    try {
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
          onSuccess?.(decodedText)
          // 立即停止扫描防止重复识别
          stopScanning()
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
      } else if (msg.includes('NotSecure')) {
        error.value = '摄像头需要 HTTPS 或 localhost 环境，当前页面可能无法使用扫码功能，请手动输入工具编码。'
      } else if (msg.includes('already')) {
        // 已在扫描中，忽略
      } else {
        error.value = `摄像头启动失败: ${msg}`
      }

      onError?.(error.value)
    }
  }

  /**
   * 停止扫码
   */
  async function stopScanning(): Promise<void> {
    scanning.value = false
    if (!scanner) return

    try {
      await scanner.stop()
    } catch {
      // 已停止或未在扫描，忽略
    }
  }

  /**
   * 销毁实例（组件卸载时调用）
   */
  async function destroy(): Promise<void> {
    await stopScanning()
    if (scanner) {
      try { scanner.clear() } catch { /* ignore */ }
      scanner = null
    }
  }

  // 组件卸载时自动清理
  onUnmounted(() => {
    destroy()
  })

  return {
    scanning,
    error,
    lastCode,
    startScanning,
    stopScanning,
    destroy
  }
}
