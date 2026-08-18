<template>
  <view class="page">
    <!-- 顶部：进度 + 完成 -->
    <view class="header">
      <view class="header__top">
        <text class="header__title">{{ check?.check_no || '盘库' }}</text>
        <text v-if="statusText" class="header__status" :class="`header__status--${check?.status}`">{{ statusText }}</text>
        <view class="header__finish" :class="{ 'header__finish--disabled': finishing || locked }" @tap="finish">
          {{ finishing ? '提交中…' : '完成盘库' }}
        </view>
      </view>
      <view class="header__progress-text">已录入 {{ enteredCount }} / 应盘 {{ totalCount }}</view>
      <view class="header__track">
        <view class="header__fill" :style="{ width: progressPercent + '%' }"></view>
      </view>
    </view>

    <view v-if="locked" class="locked-banner">
      <text class="locked-banner__icon">🔒</text>
      <text class="locked-banner__text">本盘库单{{ statusText }}，已锁定录入。如需继续盘点，请新建盘库单。</text>
    </view>

    <scroll-view scroll-y class="list" v-show="items.length">
      <view
        class="item"
        v-for="it in items"
        :key="it.item_code"
        :class="{ 'item--entered': it.entered, 'item--highlight': highlightCode === it.item_code }"
        :id="'it-' + it.item_code"
      >
        <view class="item__head">
          <text class="item__name">{{ it.item_name }}</text>
          <text class="type-tag" :class="it.item_type === 'spare' ? 'type-tag--spare' : it.item_type === 'tool' ? 'type-tag--tool' : 'type-tag--cons'">
            {{ it.item_type === 'spare' ? '备件' : it.item_type === 'tool' ? '工具' : '消耗品' }}
          </text>
          <text v-if="it.entered" class="entered-tag">✓ 已录入</text>
        </view>
        <view class="item__code">{{ it.item_code }}</view>
        <view class="item__row">
          <text class="item__sys">系统库存 {{ it.system_qty }}</text>
          <view class="item__input-wrap">
            <text class="item__input-label">实盘</text>
            <input
              class="item__input"
              type="number"
              :value="String(it.actualInput)"
              :disabled="locked"
              @blur="onInputBlur(it, $event)"
            />
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="empty" v-show="!items.length">
      <text class="empty__text">{{ loaded ? '暂无应盘明细' : '加载中…' }}</text>
    </view>

    <!-- 扫码按钮 -->
    <view class="scan-float" :class="{ 'scan-float--disabled': locked }" @tap="doScan">
      <text class="scan-float__icon">📷</text>
      <text class="scan-float__text">扫码</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getInventoryCheckById, scanInventoryCheck, completeInventoryCheck } from '@/api/material'
import { useScanner } from '@/composables/useScanner'
import { isItemEntered, markEntered, getEnteredCodes } from '@/composables/useInventoryEntered'
import { showToast, showModal } from '@/utils/feedback'

interface ScanItem {
  item_type: string
  item_code: string
  item_name: string
  system_qty: number
  actual_qty: number
  diff: number
  entered: boolean
  actualInput: number
}

const checkId = ref(0)
const check = ref<any>(null)
const items = ref<ScanItem[]>([])
const loaded = ref(false)
const finishing = ref(false)
const highlightCode = ref('')
const { scan } = useScanner()

const totalCount = computed(() => items.value.length)
const enteredCount = computed(() => items.value.filter((i) => i.entered).length)
const progressPercent = computed(() =>
  totalCount.value ? Math.round((enteredCount.value / totalCount.value) * 100) : 0
)

/** 盘库单非 pending（已完成/已取消）即锁定，禁止一切录入写操作 */
const locked = computed(() => {
  const s = check.value?.status
  return !!s && s !== 'pending'
})
const statusText = computed(() => {
  const s = check.value?.status
  if (s === 'completed') return '已完成'
  if (s === 'cancelled') return '已取消'
  if (s === 'pending') return '进行中'
  return ''
})

onLoad(async (options) => {
  checkId.value = Number(options?.id || 0)
  if (checkId.value) await load()
})

async function load() {
  loaded.value = false
  try {
    const data = await getInventoryCheckById(checkId.value).catch(() => null)
    check.value = data
    items.value = (data?.items || []).map((i: any) => {
      const isTool = i.item_type === 'tool'
      // 工具逐件口径：仅"扫过/提交过"的编码记为已录入（避免预置 actual=0 即显示已录入），未扫默认 0（缺）
      const entered = isTool ? getEnteredCodes(checkId.value).has(i.item_code) : isItemEntered(checkId.value, i)
      return {
        ...i,
        entered,
        // 已录入显示实盘值；未录入默认系统量（账实相符无需改）；工具默认 0（未扫=缺）
        actualInput: entered ? Number(i.actual_qty ?? 0) : (isTool ? 0 : Number(i.system_qty ?? 0))
      }
    })
  } finally {
    loaded.value = true
  }
}

/** 提交实盘数量（默认=系统量则无需发请求；差异才提交） */
async function submitItem(it: ScanItem, qty: number): Promise<void> {
  if (locked.value) {
    await showToast('盘库已完成，不可录入', 'none')
    return
  }
  const actual = Math.max(0, Math.floor(qty))
  try {
    await scanInventoryCheck(checkId.value, it.item_code, actual)
    it.actual_qty = actual
    it.diff = actual - Number(it.system_qty)
    it.entered = true
    it.actualInput = actual
    markEntered(checkId.value, it.item_code)
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '提交失败', 'none')
  }
}

function onInputBlur(it: ScanItem, e: any) {
  let val = Number(String(e?.detail?.value ?? '').trim())
  if (!Number.isInteger(val) || val < 0) {
    it.actualInput = it.actual_qty ?? Number(it.system_qty ?? 0)
    return
  }
  // 工具逐件盘点：实盘仅允许 0/1
  if (it.item_type === 'tool') val = val === 0 ? 0 : 1
  if (val === it.actual_qty) return
  submitItem(it, val)
}

/** 扫码：BX- 提示扫箱内工具；命中应盘物料 → 默认以系统量为准并高亮定位；未命中区分"不在本盘库单/编码未识别" */
async function doScan() {
  if (locked.value) {
    await showToast('盘库已完成，不可录入', 'none')
    return
  }
  const res = await scan()
  if (!res?.code) return
  const code = res.code.trim().toUpperCase()
  if (code.startsWith('BX-')) {
    await showToast('工具箱不参与数量盘点，请扫箱内工具', 'none')
    return
  }
  const target = items.value.find((i) => i.item_code === code)
  if (!target) {
    if (code.startsWith('G-')) {
      await showToast('工具不在本盘库单', 'none')
    } else if (code.startsWith('BJ-') || code.startsWith('XH-')) {
      await showToast('物料不在本盘库单', 'none')
    } else {
      await showToast('编码未识别', 'none')
    }
    return
  }
  highlightCode.value = code
  setTimeout(() => (highlightCode.value = ''), 1500)
  if (!target.entered || target.actual_qty === 0) {
    await submitItem(target, target.system_qty)
  } else {
    await showToast('该物料已录入', 'none')
  }
}

/** 完成盘库：未录入项默认按账实相符提交，差异落账 + 写流水 */
async function finish() {
  if (locked.value) {
    await showToast('盘库已完成，不可录入', 'none')
    return
  }
  if (finishing.value) return
  const ok = await showModal({
    title: '完成盘库',
    content: `共 ${totalCount.value} 项，已录入 ${enteredCount.value} 项。确认完成？差异将同步库存。`,
    confirmText: '完成'
  })
  if (!ok) return
  finishing.value = true
  try {
    // 未录入项：默认「账实相符」（actual=系统量，diff=0），
    // 避免完成盘库时后端把它们当成实盘 0 而将库存清零。
    // 注意：工具逐件口径例外——未扫工具保持 actual=0（=盘亏候选），不自动按 system_qty=1 补齐。
    const unentered = items.value.filter((i) => !i.entered && i.item_type !== 'tool')
    if (unentered.length) {
      const results = await Promise.allSettled(
        unentered.map((it) =>
          scanInventoryCheck(checkId.value, it.item_code, Number(it.system_qty ?? 0))
        )
      )
      const failed = results.filter((r) => r.status === 'rejected')
      if (failed.length) {
        await showToast(`有 ${failed.length} 项提交失败，请检查网络后重试`, 'none')
        return
      }
      // 本地标记为账实相符
      unentered.forEach((it) => {
        it.entered = true
        it.actual_qty = Number(it.system_qty ?? 0)
        it.actualInput = Number(it.system_qty ?? 0)
        it.diff = 0
        markEntered(checkId.value, it.item_code)
      })
    }
    await completeInventoryCheck(checkId.value)
    uni.redirectTo({ url: `/pages/inventory/InventoryResult?id=${checkId.value}` })
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '完成失败', 'none')
  } finally {
    finishing.value = false
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: $tm-bg;
  display: flex;
  flex-direction: column;
}

.header {
  background: $tm-card-bg;
  padding: 24rpx 32rpx 20rpx;

  &__top { display: flex; align-items: center; justify-content: space-between; }
  &__title { font-size: 32rpx; font-weight: 600; color: $tm-text; }
  &__status {
    margin-left: 16rpx;
    padding: 2rpx 14rpx;
    border-radius: 999rpx;
    font-size: 22rpx;
    color: $tm-success;
    background: #e8f8ef;
    &--completed { color: $tm-text-secondary; background: $tm-border-light; }
    &--cancelled { color: $tm-danger; background: #fdeaea; }
  }
  &__finish {
    padding: 10rpx 28rpx;
    border-radius: 999rpx;
    background: $tm-success;
    color: #ffffff;
    font-size: 26rpx;
    font-weight: 500;
    &--disabled { background: $tm-border; }
  }
  &__progress-text { margin-top: 16rpx; font-size: 24rpx; color: $tm-text-secondary; }
  &__track { margin-top: 10rpx; height: 12rpx; border-radius: 999rpx; background: $tm-border-light; overflow: hidden; }
  &__fill { height: 100%; border-radius: 999rpx; background: $tm-success; transition: width 0.3s; }
}

.list { flex: 1; padding: 16rpx 24rpx 120rpx; box-sizing: border-box; }

.locked-banner {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin: 12rpx 24rpx 0;
  padding: 16rpx 22rpx;
  border-radius: $tm-radius-sm;
  background: #fdf6ec;
  border: 1rpx solid #faecd8;

  &__icon { font-size: 26rpx; }
  &__text { font-size: 24rpx; color: #e6a23c; line-height: 1.4; }
}

.item {
  background: $tm-card-bg;
  border-radius: $tm-radius-sm;
  padding: 22rpx 26rpx;
  margin-bottom: 14rpx;
  box-shadow: $tm-shadow-card;
  border: 2rpx solid transparent;

  &--entered { border-color: rgba(7, 193, 96, 0.35); }
  &--highlight { background: $tm-warning-bg; }

  &__head { display: flex; align-items: center; gap: 12rpx; }
  &__name { flex: 1; font-size: 28rpx; font-weight: 500; color: $tm-text; }
  &__code { margin-top: 6rpx; font-size: 22rpx; color: $tm-text-muted; }

  &__row { display: flex; align-items: center; justify-content: space-between; margin-top: 14rpx; }
  &__sys { font-size: 24rpx; color: $tm-text-secondary; }

  &__input-wrap {
    display: flex;
    align-items: center;
    gap: 10rpx;
  }
  &__input-label { font-size: 24rpx; color: $tm-text-muted; }
  &__input {
    width: 140rpx;
    height: 56rpx;
    border-radius: 12rpx;
    border: 1rpx solid $tm-border;
    background: $tm-bg;
    text-align: center;
    font-size: 28rpx;
    color: $tm-text;
  }
}

.type-tag {
  padding: 2rpx 12rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  &--spare { color: $tm-primary; background: $tm-primary-bg; }
  &--cons { color: $tm-success; background: #e8f8ef; }
  &--tool { color: #e6a23c; background: #fdf6ec; }
}

.entered-tag { padding: 2rpx 12rpx; border-radius: 999rpx; font-size: 20rpx; color: $tm-success; background: #e8f8ef; }

.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  &__text { font-size: 26rpx; color: $tm-text-muted; }
}

.scan-float {
  position: fixed;
  right: 40rpx;
  bottom: calc(60rpx + env(safe-area-inset-bottom));
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  background: $tm-primary;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(25, 137, 250, 0.4);

  &__icon { font-size: 40rpx; line-height: 1; }
  &__text { margin-top: 4rpx; font-size: 20rpx; color: #ffffff; }

  &--disabled {
    background: $tm-border;
    box-shadow: none;
  }
}
</style>
