<template>
  <view class="page">
    <view class="bar">
      <text class="bar__title">定期检查工单</text>
      <text class="bar__refresh" @tap="load">刷新</text>
    </view>

    <view class="summary">
      <text class="summary__text">系统按检查周期自动生成待检工单，共 {{ list.length }} 项</text>
    </view>

    <scroll-view scroll-y class="list">
      <view v-for="s in list" :key="'c' + s.supply_id" class="card">
        <view class="card__main">
          <view class="card__head">
            <text class="card__name">{{ s.name }}</text>
            <text class="badge" :class="s.next_check_date && s.next_check_date < today ? 'badge--over' : 'badge--due'">
              {{ s.next_check_date && s.next_check_date < today ? '已逾期' : '待检查' }}
            </text>
          </view>
          <text class="card__sub">{{ [s.model, s.brand].filter(Boolean).join(' · ') || '—' }}</text>
          <view class="card__rows">
            <text class="row">管理人 {{ s.manager || '—' }}</text>
            <text class="row">使用人 {{ s.user_name || '—' }}</text>
          </view>
          <view class="card__rows">
            <text class="row">上次检查 {{ s.last_check_date || '无' }}</text>
            <text class="row">应检日期 {{ s.next_check_date || '立即' }}</text>
            <text class="row">周期 {{ s.check_cycle_days || 90 }}天</text>
          </view>
        </view>
        <view class="card__side">
          <text v-if="auth.isMaterialManager" class="btn" @tap="complete(s)">完成检查</text>
          <text v-else class="btn btn--disabled">仅查看</text>
        </view>
      </view>

      <view class="tip" v-if="loaded && !list.length">暂无待检查的用品 🎉</view>
      <view class="tip" v-if="!loaded">加载中…</view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getSafetyAlerts, updateSafetySupply } from '@/api'
import { showToast, showModal } from '@/utils/feedback'
import { useAuthStore } from '@/store/auth'
import type { SafetyCheckDue } from '@/types'

const auth = useAuthStore()
const list = ref<SafetyCheckDue[]>([])
const loaded = ref(false)
const today = (() => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
})()

async function load() {
  loaded.value = false
  try {
    const al = await getSafetyAlerts().catch(() => null)
    list.value = (al?.check_due || []) as SafetyCheckDue[]
  } finally {
    loaded.value = true
  }
}

async function complete(s: SafetyCheckDue) {
  const ok = await showModal({
    title: '完成检查',
    content: `确认「${s.name}」已完成本次定期检查？系统将记录检查日期为今天（${today}）。`
  })
  if (!ok) return
  try {
    await updateSafetySupply(s.supply_id, { last_check_date: today })
    await showToast('已记录检查', 'success')
    load()
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '操作失败', 'none')
  }
}

onShow(() => {
  load()
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

  &__title {
    font-size: 32rpx;
    font-weight: 600;
    color: $tm-text;
  }

  &__refresh {
    font-size: 26rpx;
    color: $tm-primary;
  }
}

.summary {
  padding: 20rpx 32rpx;

  &__text {
    font-size: 24rpx;
    color: $tm-text-secondary;
  }
}

.list {
  flex: 1;
  padding: 0 24rpx 40rpx;
  box-sizing: border-box;
}

.card {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  background: $tm-card-bg;
  border-radius: $tm-radius-sm;
  padding: 24rpx 28rpx;
  margin-bottom: 16rpx;
  box-shadow: $tm-shadow-card;

  &__main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 12rpx;
  }

  &__name {
    font-size: 30rpx;
    color: $tm-text;
    font-weight: 500;
  }

  &__sub {
    margin-top: 8rpx;
    font-size: 24rpx;
    color: $tm-text-muted;
  }

  &__rows {
    display: flex;
    flex-wrap: wrap;
    gap: 8rpx 24rpx;
    margin-top: 8rpx;
  }

  &__side {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    margin-left: 16rpx;
  }
}

.row {
  font-size: 22rpx;
  color: $tm-text-secondary;
}

.badge {
  padding: 2rpx 14rpx;
  border-radius: 999rpx;
  font-size: 20rpx;

  &--over {
    color: $tm-danger;
    background: $tm-danger-bg;
  }

  &--due {
    color: $tm-warning;
    background: $tm-warning-bg;
  }
}

.btn {
  font-size: 26rpx;
  padding: 14rpx 24rpx;
  border-radius: $tm-radius-sm;
  background: $tm-primary;
  color: #fff;

  &--disabled {
    background: $tm-border-light;
    color: $tm-text-muted;
  }
}

.tip {
  padding: 48rpx 0;
  text-align: center;
  font-size: 26rpx;
  color: $tm-text-muted;
}
</style>
