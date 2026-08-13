<template>
  <view class="page">
    <view class="bar">
      <text class="bar__title">安全防护用品</text>
      <view class="bar__actions">
        <text v-if="auth.isMaterialManager" class="bar__add" @tap="goForm()">+ 录入</text>
        <text class="bar__refresh" @tap="load">刷新</text>
      </view>
    </view>

    <!-- 页签 -->
    <view class="tabs">
      <view class="tabs__item" :class="{ 'tabs__item--active': tab === 'ledger' }" @tap="tab = 'ledger'">用品台账</view>
      <view class="tabs__item" :class="{ 'tabs__item--active': tab === 'alert' }" @tap="tab = 'alert'">
        预警提醒
        <text v-if="alertBadge > 0" class="tabs__badge">{{ alertBadge }}</text>
      </view>
    </view>

    <!-- ===== 台账 ===== -->
    <view v-if="tab === 'ledger'">
      <view class="search">
        <input
          v-model="keyword"
          class="search__input"
          placeholder="搜索物品名/型号/品牌/管理人"
          placeholder-class="search__ph"
          confirm-type="search"
        />
      </view>

      <scroll-view scroll-y class="list">
        <view
          v-for="s in filtered"
          :key="'s' + s.supply_id"
          class="card"
          @tap="onCardTap(s)"
        >
          <view class="card__main">
            <view class="card__head">
              <text class="card__name">{{ s.name }}</text>
              <text class="tag" :class="expiryClass(s)">{{ expiryLabel(s) }}</text>
            </view>
            <text class="card__sub">{{ [s.model, s.brand].filter(Boolean).join(' · ') || '—' }}</text>
            <view class="card__rows">
              <text class="row">到期 {{ s.expiry_date }}</text>
              <text class="row">下次检查 {{ nextCheck(s) || '未检查' }}</text>
            </view>
            <view class="card__rows">
              <text class="row">管理人 {{ s.manager || '—' }}</text>
              <text class="row">使用人 {{ s.user_name || '—' }}</text>
            </view>
            <view class="card__flags" v-if="isExpiring(s.supply_id) || isCheckDue(s.supply_id)">
              <text v-if="isExpiring(s.supply_id)" class="flag flag--exp">临期</text>
              <text v-if="isCheckDue(s.supply_id)" class="flag flag--chk">待检</text>
            </view>
          </view>

          <view class="card__side" v-if="auth.isMaterialManager" @tap.stop>
            <text class="op op--del" @tap="onDelete(s)">删除</text>
          </view>
        </view>

        <view class="tip" v-if="loaded && !filtered.length">暂无数据</view>
        <view class="tip" v-if="!loaded">加载中…</view>
      </scroll-view>
    </view>

    <!-- ===== 预警 ===== -->
    <view v-else class="alerts">
      <view class="stat">
        <view class="stat__item">
          <text class="stat__num stat__num--warn">{{ alerts?.expiring.length || 0 }}</text>
          <text class="stat__label">即将到期</text>
        </view>
        <view class="stat__item">
          <text class="stat__num stat__num--chk">{{ alerts?.check_due.length || 0 }}</text>
          <text class="stat__label">待定期检查</text>
        </view>
      </view>

      <view class="inspect-btn" v-if="auth.isMaterialManager" @tap="goInspection">
        定期检查工单（{{ alerts?.check_due.length || 0 }}）
        <text class="inspect-btn__arrow">›</text>
      </view>
      <view class="inspect-btn inspect-btn--disabled" v-else>
        定期检查工单（{{ alerts?.check_due.length || 0 }}）
      </view>

      <view class="section" v-if="(alerts?.expiring.length || 0)">
        <text class="section__title">即将到期（{{ alerts.expiry_alert_days }} 天内）</text>
        <view
          v-for="s in alerts.expiring"
          :key="'e' + s.supply_id"
          class="alert-card"
          @tap="onCardTap(s)"
        >
          <view class="alert-card__main">
            <text class="alert-card__name">{{ s.name }}</text>
            <text class="alert-card__sub">{{ s.manager }} · 到期 {{ s.expiry_date }}</text>
          </view>
          <text class="alert-card__days" :class="s.days_to_expiry < 0 ? 'is-expired' : 'is-soon'">
            {{ s.days_to_expiry < 0 ? `已过期${-s.days_to_expiry}天` : `${s.days_to_expiry}天后到期` }}
          </text>
        </view>
      </view>

      <view class="section" v-if="(alerts?.check_due.length || 0)">
        <text class="section__title">待定期检查</text>
        <view
          v-for="s in alerts.check_due"
          :key="'c' + s.supply_id"
          class="alert-card"
          @tap="onCardTap(s)"
        >
          <view class="alert-card__main">
            <text class="alert-card__name">{{ s.name }}</text>
            <text class="alert-card__sub">
              上次 {{ s.last_check_date || '无' }} · 应检 {{ s.next_check_date || '立即' }}
            </text>
          </view>
          <text class="alert-card__go" @tap.stop="goInspection">去检查 ›</text>
        </view>
      </view>

      <view class="tip" v-if="loaded && !(alerts?.expiring.length || 0) && !(alerts?.check_due.length || 0)">
        当前没有临期或待检查的用品 🎉
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  getSafetySupplies,
  getSafetyAlerts,
  deleteSafetySupply
} from '@/api'
import { toArray } from '@/utils/status'
import { showToast, showModal } from '@/utils/feedback'
import { useAuthStore } from '@/store/auth'
import type { SafetySupply, SafetyAlerts } from '@/types'

const auth = useAuthStore()
const tab = ref<'ledger' | 'alert'>('ledger')
const keyword = ref('')
const supplies = ref<SafetySupply[]>([])
const alerts = ref<SafetyAlerts | null>(null)
const loaded = ref(false)

const alertBadge = computed(
  () => (alerts.value?.expiring.length || 0) + (alerts.value?.check_due.length || 0)
)

const filtered = computed<SafetySupply[]>(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return supplies.value
  return supplies.value.filter((s) =>
    [s.name, s.model, s.brand, s.manager, s.user_name]
      .some((f) => f && String(f).toLowerCase().includes(kw))
  )
})

// ===== 日期工具 =====
function parseDate(s?: string | null): Date | null {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s))
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}
function fmt(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
function todayStr(): string {
  return fmt(new Date())
}
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

// ===== 派生状态 =====
function expiryDays(s: SafetySupply): number | null {
  const d = parseDate(s.expiry_date)
  if (!d) return null
  return daysBetween(parseDate(todayStr())!, d)
}
function expiryStatus(s: SafetySupply): 'expired' | 'soon' | 'ok' {
  const days = expiryDays(s)
  if (days == null) return 'ok'
  if (days < 0) return 'expired'
  const alertDays = alerts.value?.expiry_alert_days ?? 90
  if (days <= alertDays) return 'soon'
  return 'ok'
}
function expiryLabel(s: SafetySupply): string {
  const st = expiryStatus(s)
  if (st === 'expired') return '已过期'
  if (st === 'soon') return '即将到期'
  return '正常'
}
function expiryClass(s: SafetySupply): string {
  const st = expiryStatus(s)
  return st === 'expired' ? 'tag--danger' : st === 'soon' ? 'tag--warn' : 'tag--ok'
}
function nextCheck(s: SafetySupply): string | null {
  const lc = parseDate(s.last_check_date)
  if (!lc) return null
  return fmt(addDays(lc, Number(s.check_cycle_days) || 90))
}

const expiringIds = computed(() => new Set((alerts.value?.expiring || []).map((s) => s.supply_id)))
const checkDueIds = computed(() => new Set((alerts.value?.check_due || []).map((s) => s.supply_id)))
function isExpiring(id: number): boolean {
  return expiringIds.value.has(id)
}
function isCheckDue(id: number): boolean {
  return checkDueIds.value.has(id)
}

// ===== 操作 =====
function onCardTap(s: SafetySupply) {
  if (auth.isMaterialManager) goForm(s.supply_id)
  else showToast('仅查看，编辑请联系物料管理员', 'none')
}
function goForm(id?: number) {
  uni.navigateTo({ url: `/pages/material/SafetySupplyForm${id != null ? `?id=${id}` : ''}` })
}
function goInspection() {
  uni.navigateTo({ url: '/pages/material/SafetyInspection' })
}
async function onDelete(s: SafetySupply) {
  const ok = await showModal({ title: '删除确认', content: `确定删除「${s.name}」？此操作不可恢复。` })
  if (!ok) return
  try {
    await deleteSafetySupply(s.supply_id)
    await showToast('已删除', 'success')
    load()
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '删除失败', 'none')
  }
}

async function load() {
  loaded.value = false
  try {
    const [list, al] = await Promise.all([
      getSafetySupplies().catch(() => []),
      getSafetyAlerts().catch(() => null)
    ])
    supplies.value = toArray(list) as SafetySupply[]
    alerts.value = (al as SafetyAlerts) || { expiry_alert_days: 90, expiring: [], check_due: [] }
  } finally {
    loaded.value = true
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

  &__actions {
    display: flex;
    align-items: center;
    gap: 32rpx;
  }

  &__add {
    font-size: 26rpx;
    color: $tm-primary;
    font-weight: 500;
  }

  &__refresh {
    font-size: 26rpx;
    color: $tm-primary;
  }
}

.tabs {
  display: flex;
  margin: 20rpx 24rpx 0;
  background: $tm-card-bg;
  border-radius: $tm-radius-sm;
  position: relative;

  &__item {
    flex: 1;
    text-align: center;
    padding: 18rpx 0;
    font-size: 28rpx;
    color: $tm-text-secondary;
    border-radius: $tm-radius-sm;
    position: relative;

    &--active {
      background: $tm-primary;
      color: #ffffff;
      font-weight: 600;
    }
  }

  &__badge {
    display: inline-block;
    min-width: 28rpx;
    height: 28rpx;
    line-height: 28rpx;
    padding: 0 6rpx;
    margin-left: 8rpx;
    border-radius: 999rpx;
    background: $tm-danger;
    color: #fff;
    font-size: 18rpx;
    vertical-align: middle;
  }
}

.search {
  padding: 20rpx 24rpx 8rpx;

  &__input {
    background: $tm-card-bg;
    border-radius: 999rpx;
    padding: 16rpx 28rpx;
    font-size: 26rpx;
    color: $tm-text;
  }

  &__ph {
    color: $tm-text-muted;
  }
}

.list {
  flex: 1;
  padding: 8rpx 24rpx 40rpx;
  box-sizing: border-box;
}

.card {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  background: $tm-card-bg;
  border-radius: $tm-radius-sm;
  padding: 24rpx 28rpx;
  margin-top: 16rpx;
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
    gap: 24rpx;
    margin-top: 8rpx;
  }

  &__flags {
    margin-top: 12rpx;
    display: flex;
    gap: 10rpx;
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

.tag {
  padding: 2rpx 14rpx;
  border-radius: 999rpx;
  font-size: 20rpx;

  &--danger {
    color: $tm-danger;
    background: $tm-danger-bg;
  }

  &--warn {
    color: $tm-warning;
    background: $tm-warning-bg;
  }

  &--ok {
    color: $tm-success;
    background: $tm-success-bg;
  }
}

.flag {
  padding: 2rpx 12rpx;
  border-radius: 999rpx;
  font-size: 20rpx;

  &--exp {
    color: $tm-danger;
    background: $tm-danger-bg;
  }

  &--chk {
    color: $tm-warning;
    background: $tm-warning-bg;
  }
}

.op {
  font-size: 24rpx;
  padding: 8rpx 18rpx;
  border-radius: $tm-radius-sm;

  &--del {
    color: $tm-danger;
    background: $tm-danger-bg;
  }
}

.tip {
  padding: 48rpx 0;
  text-align: center;
  font-size: 26rpx;
  color: $tm-text-muted;
}

// ===== 预警 =====
.alerts {
  flex: 1;
  padding: 20rpx 24rpx 40rpx;
  box-sizing: border-box;
}

.stat {
  display: flex;
  gap: 20rpx;

  &__item {
    flex: 1;
    background: $tm-card-bg;
    border-radius: $tm-radius-sm;
    padding: 28rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: $tm-shadow-card;
  }

  &__num {
    font-size: 48rpx;
    font-weight: 700;

    &--warn {
      color: $tm-warning;
    }

    &--chk {
      color: $tm-primary;
    }
  }

  &__label {
    margin-top: 6rpx;
    font-size: 24rpx;
    color: $tm-text-secondary;
  }
}

.inspect-btn {
  margin-top: 20rpx;
  background: $tm-primary;
  color: #fff;
  border-radius: $tm-radius-sm;
  padding: 26rpx 32rpx;
  font-size: 30rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: space-between;

  &--disabled {
    background: $tm-border-light;
    color: $tm-text-muted;
  }

  &__arrow {
    font-size: 36rpx;
  }
}

.section {
  margin-top: 28rpx;

  &__title {
    font-size: 26rpx;
    color: $tm-text-secondary;
    font-weight: 600;
    margin-bottom: 12rpx;
    display: block;
  }
}

.alert-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: $tm-card-bg;
  border-radius: $tm-radius-sm;
  padding: 22rpx 28rpx;
  margin-bottom: 14rpx;
  box-shadow: $tm-shadow-card;

  &__main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  &__name {
    font-size: 28rpx;
    color: $tm-text;
    font-weight: 500;
  }

  &__sub {
    margin-top: 6rpx;
    font-size: 22rpx;
    color: $tm-text-muted;
  }

  &__days {
    font-size: 24rpx;
    flex-shrink: 0;
    margin-left: 16rpx;

    &.is-expired {
      color: $tm-danger;
    }

    &.is-soon {
      color: $tm-warning;
    }
  }

  &__go {
    font-size: 26rpx;
    color: $tm-primary;
    flex-shrink: 0;
    margin-left: 16rpx;
  }
}
</style>
