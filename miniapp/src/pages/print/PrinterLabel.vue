<template>
  <view class="page">
    <view class="bar">
      <text class="bar__title">标签打印</text>
      <text class="bar__scan" @tap="scanNext">📷 扫下一张</text>
    </view>

    <!-- 标签预览：手机端还原标签版式（类型 + 名称 + 二维码 + 明文编码） -->
    <view class="preview">
      <view class="label">
        <text v-if="title" class="label__title">{{ title }}</text>
        <text v-if="name" class="label__name">{{ name }}</text>
        <view class="label__qr">
          <QrCode :text="code || ' '" :size="240" />
        </view>
        <text class="label__code">{{ code || '—' }}</text>
      </view>
      <text class="preview__hint">预览仅示意；实打由精臣机按 ESC/POS 输出。</text>
    </view>

    <!-- 编辑区：可改后再打 -->
    <view class="form">
      <view class="form__row">
        <text class="form__label">类型</text>
        <input class="form__input" v-model="title" placeholder="如 备件单品 / 消耗品" />
      </view>
      <view class="form__row">
        <text class="form__label">名称</text>
        <input class="form__input" v-model="name" placeholder="如 膨胀螺栓 M10" />
      </view>
      <view class="form__row">
        <text class="form__label">编码</text>
        <input class="form__input" v-model="code" placeholder="如 SI-1A2B3C4D" />
      </view>
      <text class="form__note">二维码内容 = 编码字符串（ASCII）。系统按编码匹配，网页端批量打印与此同源，保证一致。</text>
    </view>

    <!-- 蓝牙打印机 -->
    <view class="bt">
      <view class="bt__head">
        <text class="bt__title">蓝牙打印机</text>
        <text class="bt__action" @tap="toggleScan">{{ scanning ? '停止扫描' : '扫描设备' }}</text>
      </view>
      <view v-if="!adapterAvailable" class="bt__warn">未检测到蓝牙，请在系统设置开启后重试</view>
      <view v-if="error" class="bt__warn">{{ error }}</view>
      <scroll-view scroll-y class="bt__list" v-if="devices.length">
        <view
          class="dev"
          v-for="d in devices"
          :key="d.deviceId"
          :class="{ 'dev--on': currentDevice && d.deviceId === currentDevice.deviceId }"
          @tap="pickDevice(d)"
        >
          <text class="dev__name">{{ d.name || '未知设备' }}</text>
          <text class="dev__rssi" v-if="d.RSSI != null">{{ d.RSSI }}</text>
          <text class="dev__state">
            {{ currentDevice && d.deviceId === currentDevice.deviceId ? '已连接' : (connecting ? '连接中…' : '点击连接') }}
          </text>
        </view>
      </scroll-view>
      <view v-else-if="scanning" class="bt__hint">扫描中…</view>
      <view v-else class="bt__hint">未扫描到设备，点击「扫描设备」</view>
      <view v-if="connected" class="bt__disconnect" @tap="disconnect">断开连接</view>
    </view>

    <!-- 操作 -->
    <view class="actions">
      <view class="actions__btn actions__btn--ghost" @tap="scanNext">扫码填码</view>
      <view class="actions__btn" :class="{ 'actions__btn--disabled': !connected || printing }" @tap="doPrint">
        {{ printing ? '打印中…' : '打印此标签' }}
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import QrCode from '@/components/QrCode.vue'
import { useBluetoothPrinter } from '@/composables/useBluetoothPrinter'
import { useScanner } from '@/composables/useScanner'
import { getSpareItemByCode } from '@/api/material'
import { showToast } from '@/utils/feedback'

// 统一标签类型 → 默认标题（与后端 item_type / 货位保持一致）
const KIND_TITLE: Record<string, string> = {
  spare_item: '备件单品',
  consumable: '消耗品',
  location: '货位'
}

const title = ref('')
const name = ref('')
const code = ref('')
const printing = ref(false)
let currentKind = ''

const printer = useBluetoothPrinter()
const {
  adapterAvailable,
  scanning,
  connecting,
  connected,
  devices,
  currentDevice,
  error,
  init,
  startScan,
  stopScan,
  connect,
  disconnect,
  close,
  printLabel
} = printer
const { scan } = useScanner()

onLoad(async (options) => {
  currentKind = options?.kind || ''
  code.value = decodeURIComponent(options?.code || '')
  name.value = decodeURIComponent(options?.name || '')
  title.value = KIND_TITLE[currentKind] || (options?.title ? decodeURIComponent(options.title) : '')
  await init()
})

onUnload(() => {
  close()
})

function toggleScan() {
  if (scanning.value) {
    stopScan()
  } else {
    startScan('') // 列出全部；精臣设备名多为 JC / Jingchen 开头，自行点选
  }
}

async function pickDevice(d: any) {
  if (connecting.value) return
  const ok = await connect(d)
  if (ok) await showToast('已连接：' + (d.name || '打印机'), 'success')
  else await showToast(error.value || '连接失败', 'none')
}

async function doPrint() {
  if (!connected.value) {
    await showToast('请先连接蓝牙打印机', 'none')
    return
  }
  if (!code.value.trim()) {
    await showToast('编码不能为空', 'none')
    return
  }
  printing.value = true
  try {
    await printLabel({
      title: title.value || undefined,
      name: name.value || undefined,
      code: code.value.trim(),
      qrSize: 6
    })
    await showToast('已打印', 'success')
  } catch (e: any) {
    await showToast(e?.message || error.value || '打印失败', 'none')
  } finally {
    printing.value = false
  }
}

/** 扫码填码：扫到备件二维码自动补全名称（其余类型仅填编码） */
async function scanNext() {
  const res = await scan()
  if (!res?.code) return
  const c = res.code.trim().toUpperCase()
  code.value = c
  if (currentKind === 'spare_item') {
    const item: any = await getSpareItemByCode(c).catch(() => null)
    if (item?.spare_name) name.value = item.spare_name
    if (item?.item_code) code.value = item.item_code
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: $tm-bg;
  display: flex;
  flex-direction: column;
  padding-bottom: 40rpx;
}

.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 32rpx;
  background: $tm-card-bg;

  &__title { font-size: 32rpx; font-weight: 600; color: $tm-text; }
  &__scan { font-size: 28rpx; color: $tm-primary; }
}

.preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28rpx 0 16rpx;

  &__hint { margin-top: 12rpx; font-size: 22rpx; color: $tm-text-muted; }
}

.label {
  width: 320rpx;
  background: #fff;
  border: 1rpx solid $tm-border;
  border-radius: 12rpx;
  padding: 24rpx 16rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: $tm-shadow-card;

  &__title { font-size: 30rpx; font-weight: 700; color: #000; }
  &__name { margin-top: 8rpx; font-size: 24rpx; color: #333; }
  &__qr { margin: 16rpx 0; }
  &__code { font-size: 24rpx; color: #000; letter-spacing: 1rpx; }
}

.form {
  margin: 8rpx 24rpx;
  background: $tm-card-bg;
  border-radius: $tm-radius-sm;
  padding: 8rpx 24rpx;

  &__row { display: flex; align-items: center; height: 88rpx; border-bottom: 1rpx solid $tm-border-light; }
  &__label { width: 120rpx; font-size: 26rpx; color: $tm-text-muted; }
  &__input { flex: 1; font-size: 28rpx; color: $tm-text; }
  &__note { display: block; padding: 16rpx 0; font-size: 22rpx; color: $tm-text-secondary; line-height: 1.5; }
}

.bt {
  margin: 16rpx 24rpx;
  background: $tm-card-bg;
  border-radius: $tm-radius-sm;
  padding: 8rpx 24rpx 24rpx;

  &__head { display: flex; align-items: center; justify-content: space-between; height: 88rpx; }
  &__title { font-size: 28rpx; font-weight: 600; color: $tm-text; }
  &__action { font-size: 26rpx; color: $tm-primary; }
  &__warn { font-size: 24rpx; color: $tm-danger; padding: 12rpx 0; }
  &__hint { font-size: 24rpx; color: $tm-text-muted; padding: 16rpx 0; }
  &__list { max-height: 360rpx; }
  &__disconnect { margin-top: 16rpx; text-align: center; font-size: 24rpx; color: $tm-danger; }
}

.dev {
  display: flex;
  align-items: center;
  padding: 22rpx 8rpx;
  border-bottom: 1rpx solid $tm-border-light;

  &__name { flex: 1; font-size: 28rpx; color: $tm-text; }
  &__rssi { font-size: 22rpx; color: $tm-text-muted; margin-right: 16rpx; }
  &__state { font-size: 24rpx; color: $tm-text-secondary; }

  &--on {
    .dev__state { color: $tm-success; }
  }
}

.actions {
  display: flex;
  gap: 20rpx;
  padding: 24rpx 24rpx 0;

  &__btn {
    flex: 1;
    text-align: center;
    padding: 24rpx 0;
    border-radius: 999rpx;
    background: $tm-primary;
    color: #fff;
    font-size: 30rpx;
    font-weight: 600;

    &--ghost { background: $tm-card-bg; color: $tm-primary; border: 1rpx solid $tm-primary; }
    &--disabled { background: $tm-border; color: #fff; }
  }
}
</style>
