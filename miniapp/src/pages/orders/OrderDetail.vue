<template>
  <view class="page">
    <!-- 加载中 / 未找到 -->
    <view v-if="!loaded" class="center">
      <text class="center__text">加载中…</text>
    </view>
    <view v-else-if="!order" class="center">
      <text class="center__text">工单不存在或已删除</text>
    </view>

    <template v-else>
      <!-- 工单头部 -->
      <view class="head">
        <view class="head__top">
          <text class="head__no">{{ order.order_no }}</text>
          <text class="badge" :style="{ color: meta(order.status).color, background: meta(order.status).bg }">
            {{ meta(order.status).label }}
          </text>
        </view>
        <view class="head__row">
          <text class="head__label">领用人</text>
          <text class="head__value">{{ order.borrower_name || '—' }}</text>
        </view>
        <view class="head__row" v-if="order.warehouse">
          <text class="head__label">仓库</text>
          <text class="head__value">{{ order.warehouse }}</text>
        </view>
        <view class="head__row">
          <text class="head__label">借出时间</text>
          <text class="head__value">{{ formatTime(order.borrow_time) }}</text>
        </view>
        <view class="head__row" v-if="order.expected_return">
          <text class="head__label">预计归还</text>
          <text class="head__value">{{ formatTime(order.expected_return) }}</text>
        </view>
        <view class="head__row" v-if="order.actual_return">
          <text class="head__label">实际归还</text>
          <text class="head__value">{{ formatTime(order.actual_return) }}</text>
        </view>
        <view class="head__row" v-if="order.purpose">
          <text class="head__label">用途</text>
          <text class="head__value">{{ order.purpose }}</text>
        </view>
      </view>

      <!-- 明细 -->
      <view class="section-title">
        {{ isMaterial ? '备件明细' : '工具 / 物料明细' }}（{{ itemsCount }}）
        <text v-if="isToolBorrowed" class="section-title__hint">点击逐件清点</text>
        <text v-else-if="isMaterial && order.status === 'borrowed'" class="section-title__hint">用剩备件可部分归还，库存自动加回</text>
      </view>
      <view class="items">
        <view
          class="item"
          :class="{ 'item--clickable': isToolBorrowed, 'item--checked': isChecked(it), 'item--material': isMaterial }"
          v-for="it in order.items || []"
          :key="it.item_id || it.tool_id || it.spare_id"
          @tap="isToolBorrowed ? toggleCheck(it) : undefined"
        >
          <!-- 工具单清点标记 -->
          <view v-if="isToolBorrowed" class="check" :class="{ 'check--on': isChecked(it) }">
            <text v-if="isChecked(it)" class="check__mark">✓</text>
          </view>
          <image v-else-if="thumb(it)" class="item__thumb" :src="thumb(it)" mode="aspectFill" />
          <view v-else class="item__thumb item__thumb--text">{{ nameChar(it) }}</view>
          <view class="item__main">
            <text class="item__name">{{ nameOf(it) }}</text>
            <text class="item__code">{{ codeOf(it) }}</text>
            <text v-if="isMaterial" class="item__qty">借 {{ borrowQty(it) }} / 已还 {{ returnedQty(it) }}</text>
          </view>
          <!-- 工具单：清点标签 -->
          <text v-if="isToolBorrowed && isChecked(it)" class="item__checked-tag">✓ 已清点</text>
          <!-- 物料单：逐项归还（用剩加回库存） -->
          <view v-else-if="isMaterial && order.status === 'borrowed' && itemRemaining(it) > 0" class="item__return-btn" @tap.stop="spareReturn(it)">
            归还
          </view>
          <text v-else class="item__status" :style="itemStyle(it.item_status)">{{ itemLabel(it.item_status) }}</text>
        </view>
      </view>

      <!-- 操作区 -->
      <view class="actions" v-if="showActions">
        <!-- 待审批：审批人可见 -->
        <template v-if="order.status === 'pending' && auth.isApprover">
          <view class="btn btn--reject" @tap="reject">拒绝</view>
          <view class="btn btn--approve" @tap="approve">批准</view>
        </template>
        <!-- 备件领取单（借出中）：全部归还 -->
        <view v-else-if="order.status === 'borrowed' && isMaterial" class="btn btn--primary btn--block" @tap="materialReturnAll">
          全部归还（{{ allReturned ? '已全部归还' : '未还 ' + remainingTotal + ' 件' }}）
        </view>
        <!-- 工具单（借出中）：逐件清点后归还 -->
        <view
          v-else-if="order.status === 'borrowed'"
          class="btn btn--primary btn--block"
          :class="{ 'btn--disabled': !allChecked }"
          @tap="submitReturn"
        >
          {{ allChecked ? `确认归还（${checkedCount}/${itemsCount}）` : `请先逐件清点（${checkedCount}/${itemsCount}）` }}
        </view>
        <!-- 已批准：直接归还 -->
        <view v-else-if="order.status === 'approved'" class="btn btn--primary btn--block" @tap="directReturn">
          归还
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { getOrders, updateOrderStatus, returnOrder, getChecklist, saveChecklistItem } from '@/api'
import { orderStatusMeta, toArray } from '@/utils/status'
import { resolveImage } from '@/utils/image'
import { showToast, showModal } from '@/utils/feedback'
import { useAuthStore } from '@/store/auth'
import { requestSubscribe } from '@/composables/useWxSubscribe'
import type { Order, OrderItem } from '@/types'

const auth = useAuthStore()
const orderId = ref(0)
const order = ref<Order | null>(null)
const loaded = ref(false)
/** 清点状态：tool_id -> checked（借出中工单逐件清点） */
const checkedMap = ref<Record<number, boolean>>({})

const itemsCount = computed(() => (order.value?.items || []).length)
const checkedCount = computed(() => (order.value?.items || []).filter(i => isChecked(i)).length)
const allChecked = computed(() => itemsCount.value > 0 && checkedCount.value === itemsCount.value)

/** 是否为备件领取单（物料单） */
const isMaterial = computed(() => order.value?.order_type === 'material' || (order.value?.items || []).some((i: any) => i.item_type === 'spare'))
/** 工具单且借出中（走逐件清点） */
const isToolBorrowed = computed(() => order.value?.status === 'borrowed' && !isMaterial.value)

function nameOf(it: any): string {
  return it.tool_name || it.spare_name || '未知'
}
function codeOf(it: any): string {
  return it.tool_code || it.spare_code || '—'
}
function nameChar(it: any): string {
  return nameOf(it).charAt(0)
}
function borrowQty(it: any): number {
  return Number(it.borrow_qty ?? 1)
}
function returnedQty(it: any): number {
  return Number(it.returned_qty ?? 0)
}
function itemRemaining(it: any): number {
  return borrowQty(it) - returnedQty(it)
}
const remainingTotal = computed(() =>
  (order.value?.items || []).reduce((sum: number, it: any) => sum + (isMaterial.value ? itemRemaining(it) : 0), 0)
)
const allReturned = computed(() => remainingTotal.value <= 0)

const showActions = computed(() => {
  if (!order.value) return false
  const s = order.value.status
  if (s === 'pending') return auth.isApprover
  return s === 'borrowed' || s === 'approved'
})

function meta(status?: string) {
  return orderStatusMeta(status)
}

function formatTime(s?: string): string {
  if (!s) return '—'
  return String(s).replace('T', ' ').slice(0, 16)
}

/** 明细项缩略图（后端 /orders 已 enrich image_url） */
function thumb(it: OrderItem): string {
  return resolveImage((it as any).image_url)
}

/** 明细项状态文案（item_status: borrowed/returned/…） */
function itemLabel(s?: string): string {
  const map: Record<string, string> = { borrowed: '借出中', returned: '已归还', pending: '待审批' }
  return s ? map[s] || s : '—'
}

function itemStyle(s?: string) {
  const color = s === 'borrowed' ? '#ff976a' : s === 'returned' ? '#07c160' : '#999999'
  return { color }
}

async function load() {
  loaded.value = false
  try {
    const data = await getOrders().catch(() => [])
    const list = toArray(data) as Order[]
    order.value = list.find(o => o.order_id === orderId.value) || null
    // 借出中工单：拉取已保存的清点状态
    if (order.value?.status === 'borrowed') {
      await loadChecks()
    } else {
      checkedMap.value = {}
    }
  } finally {
    loaded.value = true
  }
}

/** 拉取该工单已保存的清点状态（后端 checklist 接口持久化） */
async function loadChecks() {
  if (!order.value) return
  const data = await getChecklist(order.value.order_id).catch(() => null)
  const list = Array.isArray(data) ? data : data?.items
  const map: Record<number, boolean> = {}
  ;(list || []).forEach((i: any) => {
    if (i.tool_id != null) map[i.tool_id] = !!i.checked
  })
  checkedMap.value = map
}

function isChecked(it: OrderItem): boolean {
  const tid = it.tool_id ?? it.spare_id
  return tid != null ? !!checkedMap.value[tid] : false
}

/** 点击单项清点（勾选/取消，后端持久化，失败回滚） */
async function toggleCheck(it: OrderItem) {
  if (!order.value) return
  const tid = it.tool_id ?? it.spare_id
  if (tid == null) return
  const next = !isChecked(it)
  checkedMap.value = { ...checkedMap.value, [tid]: next }
  try {
    await saveChecklistItem(order.value.order_id, tid, next)
  } catch (e: any) {
    checkedMap.value = { ...checkedMap.value, [tid]: !next }
    await showToast(e?.data?.message || e?.message || '保存失败', 'none')
  }
}

/** 借出中：全部清点后提交归还 */
async function submitReturn() {
  if (!order.value) return
  if (!allChecked.value) {
    await showToast(`请先逐件清点（${checkedCount.value}/${itemsCount.value}）`, 'none')
    return
  }
  const ok = await showModal({
    title: '确认归还',
    content: `已清点 ${checkedCount.value} 件物品，确认全部归还？`,
    confirmText: '归还'
  })
  if (!ok) return
  try {
    await returnOrder(order.value.order_id)
    await showToast('已归还', 'success')
    requestSubscribe('both', true)
    load()
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '归还失败', 'none')
  }
}

onLoad((options) => {
  orderId.value = Number(options?.id || 0)
})

onShow(() => {
  if (orderId.value) load()
})

/** 批准 / 拒绝（待审批 + 审批人） */
async function approve() {
  if (!order.value) return
  const ok = await showModal({ title: '批准工单', content: `确认批准 ${order.value.order_no}？`, confirmText: '批准' })
  if (!ok) return
  try {
    await updateOrderStatus(order.value.order_id, 'approved')
    await showToast('已批准', 'success')
    requestSubscribe('both', true)
    load()
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '操作失败', 'none')
  }
}

async function reject() {
  if (!order.value) return
  const ok = await showModal({ title: '拒绝工单', content: `确认拒绝 ${order.value.order_no}？`, confirmText: '拒绝' })
  if (!ok) return
  try {
    await updateOrderStatus(order.value.order_id, 'rejected')
    await showToast('已拒绝', 'success')
    load()
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '操作失败', 'none')
  }
}

/** 已批准 → 直接归还 */
async function directReturn() {
  if (!order.value) return
  const ok = await showModal({ title: '归还', content: `确认归还 ${order.value.order_no} 的全部物品？`, confirmText: '归还' })
  if (!ok) return
  try {
    await returnOrder(order.value.order_id)
    await showToast('已归还', 'success')
    requestSubscribe('both', true)
    load()
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '归还失败', 'none')
  }
}

/** 备件领取单：逐项用剩归还（输入数量，库存加回） */
async function spareReturn(it: any) {
  if (!order.value) return
  const remaining = itemRemaining(it)
  if (remaining <= 0) return
  const res = await uni.showModal({
    title: `归还 ${nameOf(it)}`,
    editable: true,
    placeholderText: `剩余可还 ${remaining}`,
    content: '',
    confirmText: '归还'
  })
  if (!res.confirm) return
  const qty = Number(String((res as any).content || '').trim())
  if (!Number.isInteger(qty) || qty < 1 || qty > remaining) {
    await showToast(`请输入 1-${remaining} 的整数`, 'none')
    return
  }
  try {
    await returnOrder(order.value.order_id, [{ spare_id: it.spare_id, return_qty: qty }])
    await showToast(`已归还 ${qty} 件，库存已加回`, 'success')
    requestSubscribe('both', true)
    load()
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '归还失败', 'none')
  }
}

/** 备件领取单：全部归还 */
async function materialReturnAll() {
  if (!order.value) return
  if (allReturned.value) return
  const ok = await showModal({
    title: '全部归还',
    content: `确认归还 ${remainingTotal.value} 件备件？库存将全部加回。`,
    confirmText: '归还'
  })
  if (!ok) return
  try {
    await returnOrder(order.value.order_id)
    await showToast('已全部归还，库存已加回', 'success')
    requestSubscribe('both', true)
    load()
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '归还失败', 'none')
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: $tm-bg;
  padding: 24rpx;
  box-sizing: border-box;
}

.center {
  padding-top: 200rpx;
  display: flex;
  justify-content: center;

  &__text {
    color: $tm-text-muted;
    font-size: 28rpx;
  }
}

.head {
  background: $tm-card-bg;
  border-radius: $tm-radius;
  padding: 28rpx;
  box-shadow: $tm-shadow-card;

  &__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16rpx;
  }

  &__no {
    font-size: 32rpx;
    font-weight: 700;
    color: $tm-text;
  }

  &__row {
    display: flex;
    align-items: center;
    margin-top: 10rpx;
  }

  &__label {
    width: 140rpx;
    font-size: 24rpx;
    color: $tm-text-muted;
  }

  &__value {
    flex: 1;
    font-size: 26rpx;
    color: $tm-text-secondary;
  }
}

.badge {
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
}

.section-title {
  margin: 32rpx 8rpx 16rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: $tm-text;

  &__hint {
    margin-left: 12rpx;
    font-size: 22rpx;
    font-weight: 400;
    color: $tm-text-muted;
  }
}

.items {
  background: $tm-card-bg;
  border-radius: $tm-radius;
  padding: 8rpx 24rpx;
  box-shadow: $tm-shadow-card;
}

.item {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid $tm-border-light;
  transition: background 0.15s;

  &:last-child {
    border-bottom: none;
  }

  /* 借出中：可点击清点 */
  &--clickable {
    cursor: pointer;
  }

  /* 已清点：背景浅绿 */
  &--checked {
    background: rgba(7, 193, 96, 0.08);
    margin: 0 -16rpx;
    padding-left: 16rpx;
    padding-right: 16rpx;
    border-radius: $tm-radius-sm;
  }

  &__thumb {
    width: 88rpx;
    height: 88rpx;
    border-radius: $tm-radius-sm;
    background: $tm-border-light;
    margin-right: 20rpx;
    flex-shrink: 0;

    &--text {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36rpx;
      font-weight: 600;
      color: $tm-text-secondary;
      background: $tm-primary-bg;
    }
  }

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__name {
    display: block;
    font-size: 28rpx;
    font-weight: 500;
    color: $tm-text;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__code {
    display: block;
    margin-top: 6rpx;
    font-size: 22rpx;
    color: $tm-text-muted;
  }

  &__qty {
    display: block;
    margin-top: 6rpx;
    font-size: 22rpx;
    color: $tm-text-secondary;
  }

  &__return-btn {
    margin-left: 16rpx;
    padding: 8rpx 28rpx;
    border-radius: 999rpx;
    background: $tm-success;
    color: #ffffff;
    font-size: 24rpx;
    font-weight: 500;
    flex-shrink: 0;
  }

  &__status {
    margin-left: 16rpx;
    font-size: 24rpx;
    flex-shrink: 0;
  }

  &__checked-tag {
    margin-left: 16rpx;
    font-size: 24rpx;
    color: $tm-success;
    font-weight: 600;
    flex-shrink: 0;
  }
}

/* 清点勾选框 */
.check {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  border: 2rpx solid $tm-border;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  flex-shrink: 0;
  background: $tm-card-bg;

  &--on {
    background: $tm-success;
    border-color: $tm-success;
  }

  &__mark {
    color: #ffffff;
    font-size: 28rpx;
    line-height: 1;
  }
}

.actions {
  margin-top: 40rpx;
  display: flex;
  gap: 24rpx;
}

.btn {
  padding: 20rpx 48rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: 600;
  text-align: center;

  &--block {
    flex: 1;
  }

  &--approve {
    background: $tm-success;
    color: #ffffff;
  }

  &--reject {
    background: $tm-card-bg;
    color: $tm-danger;
    border: 1rpx solid $tm-danger;
  }

  &--primary {
    background: $tm-primary;
    color: #ffffff;
  }

  &--disabled {
    background: $tm-border;
    color: #ffffff;
  }
}
</style>
