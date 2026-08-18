<template>
  <view class="page">
    <view class="bar">
      <text class="bar__title">扫码入库</text>
      <text class="bar__scan" @tap="doScan">📷 扫码</text>
    </view>

    <!-- 快捷入库：扫码后预填物料+货位 -->
    <view v-if="scanned" class="card">
      <view class="card__head">
        <text class="card__name">{{ scanned.item_name }}</text>
        <text class="type-tag" :class="scanned.item_type === 'spare' ? 'type-tag--spare' : 'type-tag--cons'">
          {{ scanned.item_type === 'spare' ? '备件' : '消耗品' }}
        </text>
      </view>
      <view class="card__code">{{ scanned.item_code }}</view>
      <view class="card__row">
        <text class="card__label">目标货位</text>
        <text class="card__value">{{ scanned.location?.location_code }}（{{ scanned.location?.shelf_name || '' }}{{ scanned.location?.location_name || '' }}）</text>
      </view>
      <view class="card__row">
        <text class="card__label">现有库存</text>
        <text class="card__value">{{ scanned.system_qty }}</text>
      </view>
      <view class="card__row">
        <text class="card__label">入库数量</text>
        <input class="card__input" type="number" :value="String(qty)" @input="onQtyInput" />
      </view>
      <view v-if="auth.isMaterialManager" class="card__btn" :class="{ 'card__btn--disabled': submitting }" @tap="quickInbound">
        {{ submitting ? '提交中…' : '确认入库（生成入库单）' }}
      </view>
      <view v-else class="card__hint">普通员工不能直接建入库单，请由物料管理员网页端建单后，在下方按工单扫码收货。</view>
    </view>
    <view v-else class="empty"><text class="empty__text">扫货位二维码开始入库（货位一码一种物料）</text></view>

    <!-- 待入库单列表：现场按工单扫码收货 -->
    <view class="section-title">待入库单（点击扫码确认收货）</view>
    <scroll-view scroll-y class="list" v-show="pending.length">
      <view class="card card--small" v-for="o in pending" :key="o.order_id" @tap="receiveOrder(o)">
        <view class="card__head">
          <text class="card__no">{{ o.order_no }}</text>
          <text class="badge">待入库</text>
        </view>
        <view class="card__row"><text class="card__label">物料</text><text class="card__value">{{ o.item_code }} {{ o.item_name }}</text></view>
        <view class="card__row"><text class="card__label">数量</text><text class="card__value">{{ o.qty }}</text></view>
        <view class="card__row"><text class="card__label">目标货位</text><text class="card__value">{{ o.location_code }}</text></view>
        <view class="card__hint">点击后扫码该货位确认收货 →</view>
      </view>
    </scroll-view>
    <view class="empty" v-show="!pending.length && loaded">
      <text class="empty__text">暂无待入库单</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { resolveInboundLocation, createInboundOrder, receiveInboundOrder, getInboundOrders } from '@/api/material'
import { useScanner } from '@/composables/useScanner'
import { useAuthStore } from '@/store/auth'
import { showToast, showModal } from '@/utils/feedback'

const scanned = ref<any>(null)
const qty = ref(1)
const submitting = ref(false)
const pending = ref<any[]>([])
const loaded = ref(false)
const auth = useAuthStore()
const { scan } = useScanner()

function onQtyInput(e: any) {
  qty.value = Number(String(e?.detail?.value ?? '').trim()) || 0
}

async function loadPending() {
  loaded.value = false
  try {
    const data = await getInboundOrders({ status: 'pending' }).catch(() => [])
    pending.value = Array.isArray(data) ? data : []
  } finally {
    loaded.value = true
  }
}

/** 扫码：扫货位码/物料码 → 解析该货位上的物料 + 系统库存 */
async function doScan() {
  const res = await scan()
  if (!res?.code) return
  const code = res.code.trim().toUpperCase()
  try {
    const resolved: any = await resolveInboundLocation(code)
    if (!resolved?.item_code) {
      await showToast('未找到该货位/物料', 'none')
      return
    }
    scanned.value = resolved
    qty.value = 1
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '编码无法识别', 'none')
  }
}

/** 快捷入库：建单 + 立即收货（仅物料管理员） */
async function quickInbound() {
  if (!scanned.value) return
  const n = Math.floor(Number(qty.value))
  if (!Number.isInteger(n) || n <= 0) {
    await showToast('请输入正确的入库数量', 'none')
    return
  }
  const s = scanned.value
  const ok = await showModal({
    title: '确认入库',
    content: `${s.item_name}（${s.item_code}）× ${n} → 货位 ${s.location?.location_code}`,
    confirmText: '入库'
  })
  if (!ok) return
  submitting.value = true
  try {
    const order = await createInboundOrder({
      item_type: s.item_type,
      item_code: s.item_code,
      qty: n,
      warehouse_id: s.warehouse_id,
      location_code: s.location?.location_code
    })
    await receiveInboundOrder(order.order_id, { location_code: s.location?.location_code })
    await showToast(`已入库 ${n}，库存已更新`, 'none')
    scanned.value = null
    await loadPending()
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '入库失败', 'none')
  } finally {
    submitting.value = false
  }
}

/** 现场收货：按待入库单扫码该货位确认 */
async function receiveOrder(o: any) {
  const ok = await showModal({
    title: '扫码收货',
    content: `${o.order_no}\n${o.item_code} ${o.item_name} × ${o.qty}\n目标货位：${o.location_code}\n点击确定后扫码该货位确认`,
    confirmText: '扫码'
  })
  if (!ok) return
  const res = await scan()
  if (!res?.code) return
  const code = res.code.trim().toUpperCase()
  try {
    const updated = await receiveInboundOrder(o.order_id, { location_code: code })
    await showToast(`已收货 ${updated.received_qty}，库存已更新`, 'none')
    await loadPending()
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '收货失败', 'none')
  }
}

onShow(() => {
  loadPending()
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: $tm-bg;
  display: flex;
  flex-direction: column;
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

.card {
  margin: 16rpx 24rpx;
  padding: 24rpx 28rpx;
  background: $tm-card-bg;
  border-radius: $tm-radius-sm;
  box-shadow: $tm-shadow-card;

  &--small { margin: 0 0 16rpx; }

  &__head { display: flex; align-items: center; gap: 12rpx; }
  &__name { flex: 1; font-size: 30rpx; font-weight: 600; color: $tm-text; }
  &__no { font-size: 28rpx; font-weight: 600; color: $tm-text; }
  &__code { margin-top: 6rpx; font-size: 22rpx; color: $tm-text-muted; }
  &__row { display: flex; align-items: center; margin-top: 14rpx; }
  &__label { width: 160rpx; font-size: 24rpx; color: $tm-text-muted; }
  &__value { flex: 1; font-size: 26rpx; color: $tm-text-secondary; }
  &__hint { margin-top: 14rpx; font-size: 22rpx; color: $tm-warning; }
  &__input {
    flex: 1;
    height: 64rpx;
    border-radius: 12rpx;
    border: 1rpx solid $tm-border;
    background: $tm-bg;
    text-align: center;
    font-size: 30rpx;
    color: $tm-text;
  }
  &__btn {
    margin-top: 20rpx;
    text-align: center;
    padding: 22rpx 0;
    border-radius: 999rpx;
    background: $tm-success;
    color: #ffffff;
    font-size: 30rpx;
    font-weight: 600;

    &--disabled { background: $tm-border; }
  }
}

.type-tag {
  padding: 2rpx 12rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  &--spare { color: $tm-primary; background: $tm-primary-bg; }
  &--cons { color: $tm-success; background: #e8f8ef; }
}

.badge { padding: 4rpx 16rpx; border-radius: 999rpx; font-size: 22rpx; color: #f9a825; background: #fff8e1; }

.section-title {
  margin: 24rpx 32rpx 12rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: $tm-text;
}

.list { flex: 1; padding: 0 24rpx 120rpx; box-sizing: border-box; }

.empty {
  padding: 60rpx 0;
  text-align: center;
  &__text { font-size: 26rpx; color: $tm-text-muted; }
}
</style>
