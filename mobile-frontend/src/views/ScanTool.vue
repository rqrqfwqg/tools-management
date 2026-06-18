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
    <!-- ⚠️ 摄像头扫码已临时禁用，域名+HTTPS配置好后取消注释恢复 -->
    <!-- <div v-if="cameraSupported" class="scanner-container">
      <div
        id="scanner-viewport"
        class="scanner-viewport"
      ></div>

      <div v-if="scanning" class="scan-overlay">
        <div class="scan-line" />
        <p class="scan-hint">将条形码对准扫描框</p>
      </div>

      <div v-if="error && !scanning" class="scan-error">
        <van-icon name="warning-o" size="40" color="#ee0a24" />
        <p>{{ error }}</p>
      </div>
    </div> -->

    <!-- 摄像头不可用时的提示横幅 -->
    <div class="camera-unsupported-banner">
      <van-icon name="warning-o" size="24" color="#ff9800" />
      <span>扫码功能暂未开启，请使用手动输入</span>
    </div>

    <!-- 手动输入区域 -->
    <div class="manual-input-section">
      <van-cell-group inset title="手动输入工具编码">
        <van-field
          v-model="manualCode"
          center
          clearable
          placeholder="请输入工具编码，如 G-CFJ-1"
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
        <!-- 重新扫码按钮已禁用，恢复时取消注释 -->
        <!-- <van-button
          v-if="!scanning && cameraSupported"
          type="primary"
          block
          round
          icon="scan"
          @click="retryScan"
        >
          重新扫码
        </van-button> -->
      </div>
    </div>

    <!-- 扫码结果弹窗 -->
    <ScanResultPopup
      :show="showResult"
      :tool="resultTool"
      @update:show="showResult = $event"
      @close="onResultClosed"
    />

    <!-- 底部导航 -->
    <van-tabbar v-model="active" route active-color="#1989fa" inactive-color="#999" safe-area-inset-bottom>
      <van-tabbar-item icon="home-o" to="/dashboard">首页</van-tabbar-item>
      <van-tabbar-item icon="orders-o" to="/tools">工具</van-tabbar-item>
      <!-- 扫码tab已禁用，域名+HTTPS配好后取消注释 -->
      <!-- <van-tabbar-item icon="scan" to="/scan">扫码</van-tabbar-item> -->
      <van-tabbar-item icon="description" to="/orders">工单</van-tabbar-item>
      <van-tabbar-item icon="contact" to="/profile">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { showLoadingToast, closeToast, showFailToast } from 'vant'
import { useScanner } from '@/composables/useScanner'
import { getToolByCode } from '@/api'
import type { Tool } from '@/types'
import ScanResultPopup from '@/components/ScanResultPopup.vue'

const active = ref(2)
const manualCode = ref('')
const manualLoading = ref(false)
const showResult = ref(false)
const resultTool = ref<Tool | null>(null)

const {
  scanning,
  error,
  cameraSupported,
  startScanning,
  stopScanning,
  destroy
} = useScanner({
  elementId: 'scanner-viewport',
  qrbox: { width: 250, height: 100 },
  onSuccess: (code: string) => {
    onCodeDetected(code)
  },
  onError: () => {
    // 错误已在 useScanner 内部设置
  }
})

/**
 * 识别到工具编码后的统一处理
 */
async function onCodeDetected(code: string): Promise<void> {
  if (!code.trim()) return

  showLoadingToast({
    message: '查询中...',
    forbidClick: true,
    duration: 0
  })

  try {
    const tool = await getToolByCode(code.trim())
    closeToast()

    // 弹出详情
    resultTool.value = tool
    showResult.value = true
  } catch (err: any) {
    closeToast()
    const msg = err?.response?.data?.message || '查询失败，请确认编码是否正确'
    showFailToast(msg)
    // 查询失败时重新开始扫描（已禁用）
    // await stopScanning()
    // await startScanning()
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
    manualLoading.value = false
  } catch {
    manualLoading.value = false
  }
}

/** 结果弹窗关闭后 */
function onResultClosed(): void {
  resultTool.value = null
  // 重新开始扫描（已禁用，仅保留手动输入）
  // startScanning()
}

/** 重新扫码 */
async function retryScan(): Promise<void> {
  // 已禁用，域名+HTTPS配置好后取消注释恢复
  // manualCode.value = ''
  // await startScanning()
}

onMounted(() => {
  // 摄像头扫码已禁用，仅手动输入
  // startScanning()
})

onUnmounted(() => {
  destroy()
})
</script>

<style scoped>
.scan-page {
  min-height: 100vh;
  background: #f7f8fa;
  display: flex;
  flex-direction: column;
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
