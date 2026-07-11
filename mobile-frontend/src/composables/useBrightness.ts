/**
 * useBrightness — 扫码视口亮度检测 composable
 *
 * 从 html5-qrcode 注入到扫码容器（#scanner-viewport）内的 <video> 元素逐帧采样，
 * 绘制到离屏小尺寸 <canvas> 计算平均亮度（Y 通道均值），输出：
 * - brightness：当前 Y 均值亮度(0-255)；video 未就绪或不可用为 -1
 * - isDark：brightness < darkThreshold
 * - darkThreshold：当前生效暗光阈值（响应式）
 * - ignored：本次扫码会话内"忽略暗光提示"标记（composable 级 ref，组件卸载即清除）
 *
 * 设计要点（见增量设计 §3.1 / §7.2 / §7.3）：
 * - video 元素由 html5-qrcode 在 start() 后异步注入，故 startMonitor 用短延迟重试
 *   或 MutationObserver 等待，确保元素注入后再启动采样循环。
 * - 采样节流（默认 300ms）+ 离屏 32×24 降采样，避免与 fps=15 扫码争抢主线程。
 * - 取不到 video 时静默失败（不抛错），brightness=-1 / isDark=false，不阻断扫码。
 */
import { ref, onUnmounted } from 'vue'

/** 亮度检测配置项 */
export interface BrightnessOptions {
  /** 扫码视口容器 ID，用于定位 html5-qrcode 注入的 <video>（默认 'scanner-viewport'） */
  viewportId?: string
  /** 可选：直接提供 video 定位器，优先级高于 viewportId（应对 video 元素已存在场景） */
  getVideo?: () => HTMLVideoElement | null
  /** 暗光阈值，默认 40（0-255 亮度空间） */
  darkThreshold?: number
  /** 采样节流间隔(ms)，默认 300，建议范围 200~500 */
  sampleIntervalMs?: number
  /** 降采样宽，默认 32 */
  sampleWidth?: number
  /** 降采样高，默认 24 */
  sampleHeight?: number
}

/** 定位 <video> 元素的最大重试次数（rAF + 延迟兜底策略） */
const MAX_VIDEO_RETRY = 30
/** 每次重试的延迟(ms)：约 rAF + 80ms */
const RETRY_DELAY_MS = 80
/** RGB → 亮度 Y 的权重（BT.601 标准） */
const LUMA_R = 0.299
const LUMA_G = 0.587
const LUMA_B = 0.114

export function useBrightness(options?: BrightnessOptions) {
  const {
    viewportId = 'scanner-viewport',
    getVideo,
    darkThreshold: threshold = 40,
    sampleIntervalMs = 300,
    sampleWidth = 32,
    sampleHeight = 24
  } = options ?? {}

  /** 当前 Y 均值亮度(0-255)；video 未就绪或不可用为 -1 */
  const brightness = ref<number>(-1)
  /** brightness < darkThreshold */
  const isDark = ref<boolean>(false)
  /** 当前生效阈值（响应式，可被外部调整） */
  const darkThreshold = ref<number>(threshold)
  /** “本次忽略提示”标记（composable 级 ref，组件卸载即清除） */
  const ignored = ref<boolean>(false)

  let video: HTMLVideoElement | null = null
  let sampleCanvas: HTMLCanvasElement | null = null
  let sampleCtx: CanvasRenderingContext2D | null = null
  let timer: ReturnType<typeof setInterval> | null = null
  let retryCount = 0
  let observer: MutationObserver | null = null
  let observing = false

  /**
   * 定位注入的 <video> 元素
   * 优先使用 getVideo()（若提供），否则回退到容器内的 <video>
   */
  function locateVideo(): HTMLVideoElement | null {
    if (getVideo) {
      const v = getVideo()
      if (v) return v
    }
    const el = document.getElementById(viewportId)
    if (el) {
      const found = el.querySelector('video')
      if (found) return found as HTMLVideoElement
    }
    return null
  }

  /**
   * 惰性创建/复用离屏降采样 canvas 与 2D 上下文
   * willReadFrequently: true 提示浏览器为频繁 getImageData 做优化
   */
  function ensureCanvas(): CanvasRenderingContext2D | null {
    if (!sampleCanvas) {
      sampleCanvas = document.createElement('canvas')
      sampleCanvas.width = sampleWidth
      sampleCanvas.height = sampleHeight
      sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true })
    }
    return sampleCtx
  }

  /** 停止 MutationObserver 监听（若存在） */
  function stopObserver(): void {
    if (observer) {
      observer.disconnect()
      observer = null
    }
    observing = false
  }

  /** 启动节流采样循环（幂等：已在运行则直接返回） */
  function startLoop(): void {
    if (timer) return
    timer = setInterval(sample, sampleIntervalMs)
  }

  /**
   * 采样一帧：drawImage 整帧缩到离屏 canvas → getImageData → 算 Y 均值
   * - video 尺寸为 0 或 paused 时跳过本帧（不更新）
   * - 抽取/计算异常时静默跳过本帧
   */
  function sample(): void {
    if (!video || !sampleCtx) return
    // video 尺寸为 0 或处于暂停态时跳过本帧
    if (video.videoWidth === 0 || video.videoHeight === 0 || video.paused) {
      return
    }
    try {
      sampleCtx.drawImage(video, 0, 0, sampleWidth, sampleHeight)
      const imageData = sampleCtx.getImageData(0, 0, sampleWidth, sampleHeight)
      const data = imageData.data
      const pixels = sampleWidth * sampleHeight
      let sum = 0
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const y = LUMA_R * r + LUMA_G * g + LUMA_B * b
        sum += y
      }
      const avg = sum / pixels
      brightness.value = avg
      isDark.value = avg < darkThreshold.value
    } catch {
      // 抽取当前帧失败（如尺寸异常），静默跳过本帧，不阻断扫码
    }
  }

  /**
   * 定位 video + 启动节流采样循环
   * 在扫码 start 成功后调用。
   * 若 video 尚未注入，则用 MutationObserver（优先）+ rAF 延迟重试（兜底）等待，
   * 二者均成功后启动采样。取不到 video 时静默失败（不抛错），不阻断扫码。
   */
  function startMonitor(): void {
    retryCount = 0

    // 1) 先尝试直接定位（video 可能已就绪）
    const immediate = locateVideo()
    if (immediate) {
      video = immediate
      const ctx = ensureCanvas()
      if (ctx) {
        startLoop()
        return
      }
    }

    // 2) video 未注入：先用 MutationObserver 监听容器子节点变化
    const el = document.getElementById(viewportId)
    if (el && !observing) {
      observing = true
      observer = new MutationObserver(() => {
        const found = locateVideo()
        if (found) {
          video = found
          const ctx = ensureCanvas()
          if (ctx) {
            stopObserver()
            startLoop()
          }
        }
      })
      observer.observe(el, { childList: true, subtree: true })
    }

    // 3) rAF + 延迟重试兜底（应对 MutationObserver 在某些浏览器不触发的情况）
    const tryLocate = (): void => {
      if (timer) return // 已被 observer 或其它路径启动，直接退出
      const found = locateVideo()
      if (found) {
        video = found
        const ctx = ensureCanvas()
        if (ctx) {
          stopObserver()
          startLoop()
          return
        }
      }
      retryCount++
      if (retryCount < MAX_VIDEO_RETRY) {
        requestAnimationFrame(() => {
          setTimeout(tryLocate, RETRY_DELAY_MS)
        })
      } else {
        // 取不到 video：静默失败，保持亮度检测关闭状态，不阻断扫码
        brightness.value = -1
        isDark.value = false
        stopObserver()
      }
    }
    tryLocate()
  }

  /**
   * 停止采样循环 + 释放离屏 canvas（不重置 ignored，保证跨实例保留）
   * 在扫码 stop 时调用。
   */
  function stopMonitor(): void {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    stopObserver()
    video = null
    // 释放离屏 canvas 引用，便于 GC
    sampleCanvas = null
    sampleCtx = null
    brightness.value = -1
    isDark.value = false
    // 注意：ignored 不在此重置，保留本次扫码会话标记
  }

  /** 设置"忽略暗光提示"标记 */
  function setIgnored(v: boolean): void {
    ignored.value = v
  }

  // 组件卸载时自动释放资源（ignored 随 composable 实例 GC 自然清除）
  onUnmounted(() => {
    stopMonitor()
  })

  return {
    brightness,
    isDark,
    darkThreshold,
    ignored,
    startMonitor,
    stopMonitor,
    setIgnored
  }
}
