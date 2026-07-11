<template>
  <div class="scan-page">
    <!-- 顶部导航 -->
    <van-nav-bar
      title="扫码领用"
      left-text="返回"
      left-arrow
      fixed
      placeholder
      @click-left="$router.back()"
    />

    <!-- 扫码视口（仅摄像头可用时显示） -->
    <div v-if="cameraSupported" class="scanner-container">
      <!-- 暗光提示横幅（非阻断，可忽略，不遮挡扫码框与手电筒按钮） -->
      <div
        v-if="scanning && lowLightState.isDark && !lowLightState.ignored"
        class="dark-banner"
      >
        <van-icon name="warning-o" color="#ffd21e" />
        <span class="dark-banner__text">环境过暗，建议开启闪光灯</span>
        <van-button
          class="dark-banner__ignore"
          size="mini"
          plain
          @click="lowLightState.setIgnored(true)"
        >忽略</van-button>
      </div>

      <div
        id="scanner-viewport"
        class="scanner-viewport"
      ></div>

      <div v-if="scanning" class="scan-overlay">
        <div class="scan-line" />
        <p class="scan-hint">将条形码对准扫描框</p>
      </div>

      <!-- 闪光灯开关（仅设备支持且正在扫码时显示） -->
      <van-button
        v-if="scanning && torchSupported"
        class="torch-btn"
        :class="{ 'torch-on': torchOn }"
        round
        size="small"
        icon="bulb-o"
        @click="toggleTorch"
      />

      <!-- 弱光增强状态条（补光开启时显示，可选 P1-3，非阻断） -->
      <div v-if="scanning && torchOn" class="low-light-status">
        <van-icon name="bulb-o" color="#ffd21e" />
        <span>弱光增强中 · 补光已开启</span>
      </div>

      <div v-if="error && !scanning" class="scan-error">
        <van-icon name="warning-o" size="40" color="#ee0a24" />
        <p>{{ error }}</p>
      </div>
    </div>

    <!-- 摄像头不可用时的提示横幅 -->
    <div v-if="!cameraSupported" class="camera-unsupported-banner">
      <van-icon name="warning-o" size="24" color="#ff9800" />
      <span>摄像头不可用（需 HTTPS 访问），请使用手动输入</span>
    </div>

    <!-- 手动输入区域 -->
    <div class="manual-input-section">
      <van-cell-group inset title="手动输入编码">
        <van-field
          v-model="manualCode"
          center
          clearable
          placeholder="工具编码 G-CFJ-1 或工具箱编码 BX-1"
          @keyup.enter="handleManualSubmit"
        >
          <template #button>
            <van-button
              size="small"
              type="primary"
              :disabled="!manualCode.trim()"
              :loading="manualLoading"
              @click="handleManualSubmit"
            >
              查询
            </van-button>
          </template>
        </van-field>
      </van-cell-group>

      <!-- 快捷按钮 -->
      <div class="manual-actions">
        <van-button
          v-if="!scanning && cameraSupported"
          type="primary"
          block
          round
          icon="scan"
          @click="retryScan"
        >
          重新扫码
        </van-button>
      </div>
    </div>

    <!-- 本次扫码统计 -->
    <div v-if="scanCount > 0" class="scan-stats">
      <van-icon name="success" color="#07c160" />
      <span>本次已加入领用篮 <b>{{ scanCount }}</b> 件</span>
      <span v-if="lastScannedName" class="last-name">· {{ lastScannedName }}</span>
    </div>

    <!-- 扫码结果弹窗 -->
    <ScanResultPopup
      :show="showResult"
      :tool="resultTool"
      :spare="resultSpare"
      :consumable="resultConsumable"
      @update:show="showResult = $event"
      @close="onResultClosed"
    />

    <!-- 底部导航 -->
    <van-tabbar v-model="active" route active-color="#1989fa" inactive-color="#999" safe-area-inset-bottom>
      <van-tabbar-item icon="home-o" to="/dashboard">首页</van-tabbar-item>
      <van-tabbar-item icon="orders-o" to="/tools">工具</van-tabbar-item>
      <van-tabbar-item icon="scan" to="/scan">扫码</van-tabbar-item>
      <van-tabbar-item icon="apps-o" to="/material-center">物料</van-tabbar-item>
      <van-tabbar-item icon="description" to="/orders">工单</van-tabbar-item>
      <van-tabbar-item icon="contact" to="/profile">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { showLoadingToast, closeToast, showFailToast, showSuccessToast } from 'vant'
import { useScanner } from '@/composables/useScanner'
import { getToolByCode, getToolkitByCode } from '@/api'
import { getSpareByCode, getConsumableByCode } from '@/api/material'
import { useCartStore } from '@/store/cart'
import { useScanHistoryStore } from '@/store/scanHistory'
import type { Tool } from '@/types'

const active = ref(2)
const manualCode = ref('')
const manualLoading = ref(false)
const showResult = ref(false)
const resultTool = ref<Tool | null>(null)
const resultSpare = ref<any>(null)
const resultConsumable = ref<any>(null)

/** 本次扫码领用统计 */
const scanCount = ref(0)
const lastScannedName = ref('')

const cartStore = useCartStore()
const scanHistoryStore = useScanHistoryStore()

const {
  scanning,
  error,
  cameraSupported,
  torchSupported,
  torchOn,
  toggleTorch,
  startScanning,
  stopScanning,
  destroy,
  lowLightState
} = useScanner({
  elementId: 'scanner-viewport',
  qrbox: { width: 280, height: 120 },
  // 弱光增强配置：阈值 40、扫码框自适应；exposureBoost/isoBoost 不传，
  // 由 useScanner 依据设备能力自动推导（exposure≈max*0.7，iso≈400 封顶 800）
  lowLight: {
    darkThreshold: 40,
    qrboxAuto: true,
    autoTorchStrategy: 'manual'
  },
  onSuccess: (code: string) => {
    onCodeDetected(code)
  },
  onError: () => {
    // 错误已在 useScanner 内部设置
  }
})

/** 工具状态文案 */
function statusLabel(status: string): string {
  const map: Record<string, string> = {
    available: '可用',
    borrowed: '已借出',
    reserved: '已预留',
    maintenance: '维修中',
    scrapped: '已报废'
  }
  return map[status] || status
}

/** 延迟后自动恢复扫码 */
function resumeScanAfterDelay(ms = 1500): void {
  setTimeout(() => startScanning(), ms)
}

/**
 * 识别到编码后的统一处理
 * - 以 BX- 开头 → 工具箱编码，批量加入领用篮
 * - 其他 → 工具编码，单件加入领用篮
 */
async function onCodeDetected(code: string): Promise<void> {
  const raw = code.trim()
  if (!raw) return

  showLoadingToast({ message: '查询中...', forbidClick: true, duration: 0 })

  // 判断是否为工具箱编码（BX- 开头）
  if (code.trim().toUpperCase().startsWith('BX-')) {
    await handleToolkitCode(code.trim())
    return
  }

  try {
    // 按编码前缀分发：BJ- 备件 / XH- 消耗品 -> 弹窗确认；G- 工具 -> 直接加入领用篮
    if (raw.startsWith('BJ-')) {
      const spare = await getSpareByCode(raw)
      closeToast()
      resultSpare.value = spare
      showResult.value = true
    } else if (raw.startsWith('XH-')) {
      const consumable = await getConsumableByCode(raw)
      closeToast()
      resultConsumable.value = consumable
      showResult.value = true
    } else {
      const tool = await getToolByCode(code.trim())
      closeToast()

      // 不可用的工具直接提示
      if (tool.status !== 'available') {
        showFailToast(`${tool.tool_name} 当前${statusLabel(tool.status)}，无法领用`)
        resumeScanAfterDelay()
        return
      }

      // 加入领用篮
      cartStore.addItem({
        tool_id: tool.tool_id,
        tool_name: tool.tool_name,
        tool_code: tool.tool_code,
        warehouse: tool.warehouse || '',
        image_url: tool.image_url || ''
      })

      // 记录扫码历史
      scanHistoryStore.addRecord({
        tool_id: tool.tool_id,
        tool_code: tool.tool_code,
        tool_name: tool.tool_name,
        status: 'available'
      })

      // 更新统计
      scanCount.value++
      lastScannedName.value = tool.tool_name

      showSuccessToast(`已加入领用篮: ${tool.tool_name}`)

      // 1.5 秒后自动恢复扫码，连续扫下一件
      resumeScanAfterDelay()
    }
  } catch (err: any) {
    closeToast()
    const msg = err?.response?.data?.message || '查询失败，请确认编码是否正确'
    showFailToast(msg)
    resumeScanAfterDelay()
  }
}

/**
 * 处理工具箱编码（BX- 开头）
 * 获取工具箱详情，将可用状态的工具批量加入领用篮
 */
async function handleToolkitCode(code: string): Promise<void> {
  try {
    const kitDetail = await getToolkitByCode(code)
    closeToast()

    const allTools: Tool[] = kitDetail.tools || []
    const toolkitName: string = kitDetail.toolkit_name || '未知工具箱'
    const totalCount: number = allTools.length

    if (totalCount === 0) {
      showFailToast(`工具箱"${toolkitName}"内没有工具`)
      resumeScanAfterDelay()
      return
    }

    // 分类：可用 vs 不可用
    const availableTools = allTools.filter(t => t.status === 'available')
    const unavailableTools = allTools.filter(t => t.status !== 'available')

    // 将可用工具批量加入领用篮
    let addedCount = 0
    for (const tool of availableTools) {
      cartStore.addItem({
        tool_id: tool.tool_id,
        tool_name: tool.tool_name,
        tool_code: tool.tool_code,
        warehouse: tool.warehouse || '',
        image_url: tool.image_url || ''
      })

      // 记录扫码历史
      scanHistoryStore.addRecord({
        tool_id: tool.tool_id,
        tool_code: tool.tool_code,
        tool_name: tool.tool_name,
        status: 'available'
      })

      addedCount++
    }

    // 更新扫码统计
    scanCount.value += addedCount
    lastScannedName.value = toolkitName

    // 构造提示信息
    let msg = `识别到工具箱: ${toolkitName}，包含 ${totalCount} 件工具`
    if (addedCount > 0) {
      msg += `，已加入 ${addedCount} 件`
    }
    if (unavailableTools.length > 0) {
      const unavailableNames = unavailableTools.map(t => `${t.tool_name}(${statusLabel(t.status)})`).join('、')
      msg += `\n不可用跳过: ${unavailableNames}`
    }

    showSuccessToast({ message: msg, duration: 3000 })

    resumeScanAfterDelay(2500)
  } catch (err: any) {
    closeToast()
    const msg = err?.response?.data?.message || '查询工具箱失败，请确认编码是否正确'
    showFailToast(msg)
    resumeScanAfterDelay()
  }
}

/** 手动输入查询 */
async function handleManualSubmit(): Promise<void> {
  const code = manualCode.value.trim()
  if (!code) return

  manualLoading.value = true

  try {
    await onCodeDetected(code)
    manualCode.value = ''
  } catch {
    // 错误已在 onCodeDetected 中处理
  } finally {
    manualLoading.value = false
  }
}

/** 结果弹窗关闭后 */
function onResultClosed(): void {
  resultTool.value = null
  resultSpare.value = null
  resultConsumable.value = null
  // 重新开始扫描
  startScanning()
}


/** 重新扫码 */
async function retryScan(): Promise<void> {
  manualCode.value = ''
  await startScanning()
}

onMounted(() => {
  startScanning()
})

onUnmounted(() => {
  destroy()
})
</script>

<style scoped>
.scan-page {
  min-height: 100vh;
  background: #000;
  display: flex;
  flex-direction: column;
}

/* 无摄像头时白底 */
.scan-page:has(.camera-unsupported-banner) {
  background: #f7f8fa;
}

/* ===== 扫码区域 ===== */
.scanner-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #000;
}

.scanner-viewport {
  width: 100%;
  height: 100%;
}

/* 扫描线动画 */
.scan-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.scan-line {
  position: absolute;
  top: 35%;
  left: 10%;
  right: 10%;
  height: 2px;
  background: linear-gradient(90deg, transparent, #07c160, transparent);
  animation: scanMove 2s ease-in-out infinite;
}

.scan-hint {
  position: absolute;
  bottom: 20%;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
}

/* 闪光灯按钮：右上角圆形悬浮 */
.torch-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
}

.torch-btn :deep(.van-icon) {
  color: #fff;
}

.torch-btn.torch-on {
  background: #ffd21e;
  color: #323233;
}

.torch-btn.torch-on :deep(.van-icon) {
  color: #323233;
}

/* ===== 暗光提示横幅（顶部，非阻断，可忽略） ===== */
.dark-banner {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9; /* 低于手电筒按钮(z-index:10)，避免遮挡其点击 */
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  /* 右侧留出空间，避开右上角手电筒按钮 */
  padding-right: 56px;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  font-size: 13px;
}

.dark-banner__text {
  flex: 1;
  min-width: 0;
}

.dark-banner__ignore {
  flex-shrink: 0;
}

/* ===== 弱光增强状态条（底部，非阻断） ===== */
.low-light-status {
  position: absolute;
  bottom: 12px;
  left: 12px;
  right: 12px;
  z-index: 9;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.55);
  color: #ffd21e;
  font-size: 12px;
  border-radius: 16px;
  pointer-events: none;
}

@keyframes scanMove {
  0%, 100% { top: 35%; }
  50% { top: 55%; }
}

/* 错误 */
.scan-error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.85);
  padding: 24px;
  text-align: center;
}

.scan-error p {
  color: rgba(255, 255, 255, 0.85);
  font-size: 14px;
  line-height: 1.6;
  max-width: 280px;
}

/* 摄像头不可用横幅 */
.camera-unsupported-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #fff3e0;
  color: #e65100;
  font-size: 14px;
  font-weight: 500;
}

/* ===== 手动输入 ===== */
.manual-input-section {
  background: #fff;
  padding-bottom: 12px;
}

.manual-actions {
  padding: 12px 16px;
}

/* 扫码统计 */
.scan-stats {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  background: #f0fff3;
  color: #07c160;
  font-size: 13px;
}

.scan-stats b {
  font-size: 16px;
}

.scan-stats .last-name {
  color: #969799;
  font-size: 12px;
}

/* ===== dark mode 适配 ===== */
:deep(.van-nav-bar) {
  background: #1a1a1a;
}

:deep(.van-nav-bar__title) {
  color: #fff;
}

:deep(.van-nav-bar__text) {
  color: #1989fa;
}

:deep(.van-nav-bar .van-icon) {
  color: #fff;
}
</style>
