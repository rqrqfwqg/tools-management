<template>
  <van-popup
    :show="show"
    position="bottom"
    round
    :style="{ height: '78%' }"
    closeable
    @update:show="onUpdateShow"
    @closed="onClosed"
  >
    <div class="scanner-popup">
      <div class="scanner-popup-title">盘点扫码</div>

      <div class="scanner-popup-body">
        <!-- 摄像头扫码区域 -->
        <div v-if="cameraSupported" class="scanner-container">
          <div id="inventory-scanner-viewport" class="scanner-viewport"></div>
          <div v-if="scanning" class="scan-overlay">
            <div class="scan-line"></div>
            <p class="scan-hint">将条形码对准扫描框</p>
          </div>

          <!-- 手电筒开关（仅设备支持且正在扫码时显示） -->
          <van-button
            v-if="scanning && torchSupported"
            class="torch-btn"
            :class="{ 'torch-on': torchOn }"
            round
            size="small"
            icon="bulb-o"
            @click="toggleTorch"
          />

          <div v-if="error && !scanning" class="scan-error">
            <van-icon name="warning-o" size="40" color="#ee0a24" />
            <p>{{ error }}</p>
          </div>
        </div>

        <!-- 摄像头不可用提示 -->
        <div v-if="!cameraSupported" class="camera-unsupported">
          <van-icon name="warning-o" size="24" color="#ff9800" />
          <span>摄像头不可用（需 HTTPS 访问），请使用手动输入</span>
        </div>

        <!-- 手动输入降级 -->
        <div class="manual-input">
          <van-field
            v-model="manualCode"
            center
            clearable
            placeholder="手动输入编码（BJ-/XH-）"
            @keyup.enter="handleManualSubmit"
          >
            <template #button>
              <van-button
                size="small"
                type="primary"
                :disabled="!manualCode.trim()"
                @click="handleManualSubmit"
              >
                确认
              </van-button>
            </template>
          </van-field>
        </div>
      </div>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useScanner } from '@/composables/useScanner'

// 盘点扫码弹窗：复用 useScanner（摄像头 + 手电筒 + 手动输入降级），
// 只 emit 原始 code，业务门禁（G- 拦截/不在 items 拦截）放父页面，不在此处分发。
const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  code: [raw: string]
  close: []
}>()

const manualCode = ref('')

const {
  scanning,
  error,
  cameraSupported,
  torchSupported,
  torchOn,
  toggleTorch,
  startScanning,
  stopScanning,
  destroy
} = useScanner({
  elementId: 'inventory-scanner-viewport',
  qrbox: { width: 280, height: 120 },
  lowLight: {
    darkThreshold: 40,
    qrboxAuto: true,
    autoTorchStrategy: 'manual'
  },
  onSuccess: (code: string) => {
    // 扫码命中即抛出原始编码；延迟 800ms 自动恢复扫码，支持连续盘点
    // （弹窗已关闭时跳过重启，避免关闭后摄像头被重新拉起）
    manualCode.value = ''
    emit('code', code)
    setTimeout(() => {
      if (props.show) {
        startScanning()
      }
    }, 800)
  },
  onError: () => {
    // 错误已在 useScanner 内部设置
  }
})

// 弹窗打开时启动摄像头，关闭时停止
watch(
  () => props.show,
  (v: boolean) => {
    if (v) {
      startScanning()
    } else {
      stopScanning()
    }
  }
)

function onUpdateShow(v: boolean): void {
  emit('update:show', v)
}

function onClosed(): void {
  stopScanning()
  emit('close')
}

function handleManualSubmit(): void {
  const code = manualCode.value.trim()
  if (!code) return
  manualCode.value = ''
  emit('code', code)
}

onUnmounted(() => {
  destroy()
})
</script>

<style scoped>
.scanner-popup {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.scanner-popup-title {
  padding: 16px 16px 8px;
  font-size: 16px;
  font-weight: 600;
  color: #323233;
  text-align: center;
}
.scanner-popup-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 8px 12px 24px;
}
.scanner-container {
  position: relative;
  height: 46vh;
  min-height: 240px;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}
.scanner-viewport {
  width: 100%;
  height: 100%;
}
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
  bottom: 12%;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
}
.torch-btn {
  position: absolute;
  top: 12px;
  right: 12px;
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
.camera-unsupported {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #fff3e0;
  color: #e65100;
  font-size: 14px;
  font-weight: 500;
  border-radius: 8px;
}
.manual-input {
  margin-top: 12px;
}
@keyframes scanMove {
  0%, 100% { top: 35%; }
  50% { top: 55%; }
}
</style>
