/**
 * useScanner — 小程序扫码封装（重写）
 *
 * 自 mobile-frontend/src/composables/useScanner.ts 重写：
 * - html5-qrcode（浏览器摄像头）不可用于小程序 → uni.scanCode 原生扫码
 * - 扫码类型：条形码 + 二维码（scanType: ['barCode', 'qrCode']）
 * - 取消/失败 → uni.showModal editable 手动输入兜底
 * - 不支持 torch/弱光增强（useBrightness.ts 不迁移，设计文档 §1.2）
 *
 * 导出 scan(): Promise<{ code, source: 'camera' | 'manual' } | null>
 * source 标识来源：camera=原生扫码，manual=手动输入兜底
 */
import { ref } from 'vue'
import { showInputModal, showToast } from '@/utils/feedback'

export interface ScanResult {
  code: string
  /** 来源：camera=原生扫码，manual=手动输入 */
  source: 'camera' | 'manual'
}

export interface ScannerOptions {
  /** 扫码类型（默认条形码 + 二维码） */
  scanType?: Array<'barCode' | 'qrCode' | 'datamatrix' | 'pdf417'>
  /** 是否启用手动输入兜底（默认 true） */
  needManualFallback?: boolean
  /** 手动输入弹窗标题（默认 '扫码'） */
  title?: string
}

/** 包装 uni.scanCode 为 Promise（不依赖类型重载，兼容各版本 @dcloudio/types） */
function scanCode(options: { scanType: string[] }): Promise<{ result: string }> {
  return new Promise((resolve, reject) => {
    uni.scanCode({
      scanType: options.scanType as any,
      success: (res) => resolve({ result: res.result || '' }),
      fail: (err) => reject(err)
    })
  })
}

export function useScanner(options: ScannerOptions = {}) {
  const { scanType = ['barCode', 'qrCode'], needManualFallback = true, title = '扫码' } = options

  const scanning = ref(false)
  const error = ref('')
  const lastCode = ref('')
  /** 小程序原生扫码始终可用（与 H5 摄像头权限场景不同，保留字段兼容页面） */
  const cameraSupported = ref(true)

  /** 手动输入兜底：弹出可编辑 modal，返回输入编码 */
  async function manualFallback(): Promise<ScanResult | null> {
    const res = await showInputModal({
      title,
      content: '未识别到条码，请手动输入编码',
      placeholderText: '请输入工具/物料编码'
    })
    if (res.confirm) {
      const code = (res.content || '').trim()
      if (!code) {
        showToast('编码不能为空', 'none')
        return null
      }
      lastCode.value = code
      return { code, source: 'manual' }
    }
    return null
  }

  /**
   * 执行一次扫码
   * @returns Promise<ScanResult | null>：扫码/手动输入成功返回结果；用户取消返回 null
   */
  async function scan(): Promise<ScanResult | null> {
    scanning.value = true
    error.value = ''
    try {
      const res = await scanCode({ scanType })
      scanning.value = false
      const code = (res.result || '').trim()
      if (!code) {
        return needManualFallback ? manualFallback() : null
      }
      lastCode.value = code
      return { code, source: 'camera' }
    } catch (err: any) {
      scanning.value = false
      error.value = err?.errMsg || String(err)
      // 用户取消（cancel）或扫码失败 → 手动输入兜底
      if (needManualFallback) {
        return manualFallback()
      }
      return null
    }
  }

  /** 兼容旧接口形态（startScanning 等价于 scan） */
  function startScanning(): Promise<ScanResult | null> {
    return scan()
  }

  /** 停止扫码（原生扫码为一次性调用，无持续会话；置位扫描态即可） */
  async function stopScanning(): Promise<void> {
    scanning.value = false
  }

  /** 手动输入编码（页面直接调用入口） */
  function manualInput(code: string): ScanResult | null {
    const c = (code || '').trim()
    if (!c) return null
    lastCode.value = c
    return { code: c, source: 'manual' }
  }

  return {
    scanning,
    error,
    lastCode,
    cameraSupported,
    scan,
    startScanning,
    stopScanning,
    manualInput,
    manualFallback
  }
}
