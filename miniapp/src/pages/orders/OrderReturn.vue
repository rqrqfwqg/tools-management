<template>
  <view class="page">
    <view class="bar">
      <text class="bar__title">归还清点</text>
      <text class="bar__sub">{{ loaded ? `已勾选 ${checkedCount}/${items.length}` : '加载中…' }}</text>
    </view>

    <view class="tip">请逐件核对工具，勾选确认无误后才能提交归还。</view>

    <scroll-view scroll-y class="list" v-if="items.length">
      <view
        class="item"
        v-for="it in items"
        :key="it.tool_id"
        :class="{ 'item--checked': it.checked }"
        @tap="toggle(it)"
      >
        <!-- 勾选框 -->
        <view class="check" :class="{ 'check--on': it.checked }">
          <text v-if="it.checked" class="check__mark">✓</text>
        </view>
        <view class="item__main">
          <text class="item__name">{{ it.tool_name }}</text>
          <text class="item__code">{{ it.tool_code }}</text>
        </view>
      </view>
    </scroll-view>

    <view class="empty" v-else>
      <text class="empty__text">{{ loaded ? '该工单无可清点物品' : '加载中…' }}</text>
    </view>

    <!-- 底部操作 -->
    <view class="footer">
      <view class="footer__all" @tap="checkAll">
        <view class="check" :class="{ 'check--on': allChecked }">
          <text v-if="allChecked" class="check__mark">✓</text>
        </view>
        <text class="footer__all-text">全选</text>
      </view>
      <view
        class="footer__submit"
        :class="{ 'footer__submit--disabled': !canSubmit }"
        @tap="submit"
      >
        {{ canSubmit ? '确认归还' : `请先勾选全部 ${items.length} 件` }}
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getChecklist, saveChecklistItem, returnOrder } from '@/api'
import { showToast, showModal } from '@/utils/feedback'

interface ChecklistItem {
  tool_id: number
  tool_code: string
  tool_name: string
  checked: boolean
  [key: string]: any
}

const orderId = ref(0)
const items = ref<ChecklistItem[]>([])
const loaded = ref(false)
const syncing = ref(false)

const checkedCount = computed(() => items.value.filter(i => i.checked).length)
const allChecked = computed(() => items.value.length > 0 && checkedCount.value === items.value.length)
const canSubmit = computed(() => items.value.length > 0 && allChecked.value && !syncing.value)

async function load() {
  loaded.value = false
  try {
    const data = await getChecklist(orderId.value).catch(() => null)
    const list = Array.isArray(data) ? data : data?.items
    items.value = (list || []).map((i: any) => ({
      tool_id: i.tool_id,
      tool_code: i.tool_code || i.item_code || '',
      tool_name: i.tool_name || '',
      checked: !!i.checked
    }))
  } finally {
    loaded.value = true
  }
}

onLoad((options) => {
  orderId.value = Number(options?.id || 0)
  if (orderId.value) load()
})

/** 勾选/取消单项（后端持久化 checked 状态） */
async function toggle(it: ChecklistItem) {
  if (syncing.value) return
  const next = !it.checked
  const prev = it.checked
  it.checked = next
  try {
    await saveChecklistItem(orderId.value, it.tool_id, next)
  } catch (e: any) {
    it.checked = prev
    await showToast(e?.data?.message || e?.message || '保存失败', 'none')
  }
}

/** 一键全选 */
function checkAll() {
  if (syncing.value) return
  const next = !allChecked.value
  items.value.forEach((it) => { it.checked = next })
  // 静默同步（失败不阻断，逐项失败会在归还时兜底）
  items.value.forEach((it) => {
    saveChecklistItem(orderId.value, it.tool_id, next).catch(() => {})
  })
}

/** 确认归还：全部勾选后提交 */
async function submit() {
  if (!canSubmit.value) return
  const ok = await showModal({
    title: '确认归还',
    content: `已清点 ${checkedCount.value} 件物品，确认全部归还？`,
    confirmText: '归还'
  })
  if (!ok) return
  syncing.value = true
  try {
    await returnOrder(orderId.value)
    await showToast('归还成功', 'success')
    setTimeout(() => uni.navigateBack(), 600)
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '归还失败', 'none')
  } finally {
    syncing.value = false
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: $tm-bg;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 32rpx;
  background: $tm-card-bg;

  &__title {
    font-size: 32rpx;
    font-weight: 600;
    color: $tm-text;
  }

  &__sub {
    font-size: 24rpx;
    color: $tm-text-secondary;
  }
}

.tip {
  padding: 16rpx 32rpx;
  font-size: 22rpx;
  color: $tm-warning;
  background: $tm-warning-bg;
}

.list {
  flex: 1;
  padding: 16rpx 24rpx;
  box-sizing: border-box;
}

.item {
  display: flex;
  align-items: center;
  background: $tm-card-bg;
  border-radius: $tm-radius-sm;
  padding: 24rpx 28rpx;
  margin-bottom: 16rpx;
  box-shadow: $tm-shadow-card;

  &--checked {
    border: 1rpx solid $tm-primary;
  }

  &__main {
    flex: 1;
    min-width: 0;
    margin-left: 20rpx;
  }

  &__name {
    display: block;
    font-size: 28rpx;
    font-weight: 500;
    color: $tm-text;
  }

  &__code {
    display: block;
    margin-top: 6rpx;
    font-size: 22rpx;
    color: $tm-text-muted;
  }
}

.check {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  border: 2rpx solid $tm-border;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &--on {
    background: $tm-primary;
    border-color: $tm-primary;
  }

  &__mark {
    color: #ffffff;
    font-size: 28rpx;
    line-height: 1;
  }
}

.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;

  &__text {
    color: $tm-text-muted;
    font-size: 26rpx;
  }
}

.footer {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 20rpx 24rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: $tm-card-bg;
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.04);

  &__all {
    display: flex;
    align-items: center;
    gap: 12rpx;
    padding: 8rpx;
  }

  &__all-text {
    font-size: 26rpx;
    color: $tm-text-secondary;
  }

  &__submit {
    flex: 1;
    text-align: center;
    padding: 22rpx 0;
    border-radius: 999rpx;
    background: $tm-primary;
    color: #ffffff;
    font-size: 30rpx;
    font-weight: 600;

    &--disabled {
      background: $tm-border;
      color: #ffffff;
    }
  }
}
</style>
