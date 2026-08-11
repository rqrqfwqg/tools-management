<template>
  <view class="page">
    <!-- 用户信息 -->
    <view class="user">
      <image v-if="avatar" class="user__avatar" :src="avatar" mode="aspectFill" />
      <view v-else class="user__avatar user__avatar--text">{{ avatarText }}</view>
      <view class="user__info">
        <text class="user__name">{{ displayName }}</text>
        <text class="user__role">{{ roleName }}</text>
      </view>
    </view>

    <view class="cell-group">
      <view class="cell">
        <text class="cell__label">手机号</text>
        <text class="cell__value">{{ phone || '未绑定' }}</text>
      </view>
      <view class="cell">
        <text class="cell__label">部门</text>
        <text class="cell__value">{{ deptName || '—' }}</text>
      </view>
      <!-- 微信新用户：绑定手机号后合并为正式员工档案（游客不展示，需用手机号重新登录） -->
      <view class="cell cell--link" v-if="!phone && !auth.isGuest" @tap="bindPhone">
        <text class="cell__label cell__label--primary">绑定手机号</text>
        <text class="cell__arrow">›</text>
      </view>
    </view>

    <!-- 管理入口（仅管理员/审批人可见） -->
    <template v-if="auth.isAdmin || auth.isApprover">
      <view class="group-title">管理</view>
      <view class="cell-group">
        <view class="cell cell--link" v-for="m in adminMenus" :key="m.url" @tap="open(m.url)">
          <text class="cell__label">{{ m.label }}</text>
          <text class="cell__arrow">›</text>
        </view>
      </view>
    </template>

    <view class="logout" @tap="logout">退出登录</view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/store/auth'
import { wxBindPhone } from '@/api'
import { showToast, showInputModal } from '@/utils/feedback'

const auth = useAuthStore()

const avatar = computed(() => auth.user?.wx_avatar || '')
const displayName = computed(
  () => auth.user?.real_name || auth.user?.wx_nickname || '微信用户'
)
const avatarText = computed(() => displayName.value.charAt(0))
const roleName = computed(() => auth.user?.role_name || roleLabel(auth.user?.role))
const phone = computed(() => auth.user?.phone || '')
const deptName = computed(() => auth.user?.dept_name || '')

const adminMenus = [
  { label: '用户管理', url: '/pagesAdmin/UserManagement' },
  { label: '部门管理', url: '/pagesAdmin/DeptManagement' },
  { label: '分类管理', url: '/pagesAdmin/CategoryManagement' },
  { label: '货架管理', url: '/pagesAdmin/ShelfManagement' },
  { label: '仓库管理', url: '/pagesAdmin/WarehouseManagement' },
  { label: '库位管理', url: '/pagesAdmin/LocationManagement' },
  { label: '出入库流水', url: '/pagesStock/StockMovement' }
]

function roleLabel(r?: string): string {
  const map: Record<string, string> = {
    admin: '管理员',
    team_leader: '班组长',
    material_manager: '物料管理员',
    staff: '员工'
  }
  return r ? map[r] || r : ''
}

function open(url: string) {
  uni.navigateTo({ url })
}

/**
 * 绑定手机号：输入本人手机号 → wx-bind-phone 合并为正式员工档案。
 * 合并成功后旧 token 失效（临时微信账号被移除），重新 wx.login 换新 token。
 */
async function bindPhone() {
  const { confirm, content } = await showInputModal({
    title: '绑定手机号',
    placeholderText: '请输入您本人的手机号',
    confirmText: '绑定'
  })
  if (!confirm) return
  const phoneInput = content.trim()
  if (!/^1\d{10}$/.test(phoneInput)) {
    showToast('手机号格式不正确', 'none')
    return
  }
  try {
    const res = await wxBindPhone(phoneInput)
    if (res?.user) auth.setUser(res.user)
    await showToast('绑定成功，正在刷新登录…', 'success')
    // 重新微信登录：合并后临时账号已移除，需换发新账号的 token
    try {
      const loginRes = await uni.login()
      const code = (loginRes as any)?.code
      if (code) await auth.wxLogin(code)
    } catch (re) {
      console.warn('[profile] re-login failed', re)
    }
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '绑定失败', 'none')
  }
}

function logout() {
  uni.showModal({
    title: '提示',
    content: '确定退出登录？',
    success: (res) => {
      if (res.confirm) {
        auth.logout()
        uni.reLaunch({ url: '/pages/login/Login' })
      }
    }
  })
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: $tm-bg;
  padding: 24rpx;
  box-sizing: border-box;
}

.user {
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, $tm-primary, $tm-primary-dark);
  border-radius: $tm-radius;
  padding: 40rpx 32rpx;
  color: #fff;
  box-shadow: $tm-shadow-card;

  &__avatar {
    width: 110rpx;
    height: 110rpx;
    border-radius: 50%;
    margin-right: 28rpx;
    border: 4rpx solid rgba(255, 255, 255, 0.6);

    &--text {
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.25);
      font-size: 44rpx;
      font-weight: 600;
    }
  }

  &__info {
    display: flex;
    flex-direction: column;
  }

  &__name {
    font-size: 36rpx;
    font-weight: 600;
  }

  &__role {
    margin-top: 10rpx;
    font-size: 24rpx;
    opacity: 0.85;
  }
}

.group-title {
  margin: 36rpx 8rpx 16rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: $tm-text;
}

.cell-group {
  background: $tm-card-bg;
  border-radius: $tm-radius-sm;
  overflow: hidden;
  box-shadow: $tm-shadow-card;
}

.cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 28rpx;
  border-bottom: 1rpx solid $tm-border-light;

  &:last-child {
    border-bottom: none;
  }

  &--link:active {
    background: $tm-bg;
  }

  &__label {
    font-size: 28rpx;
    color: $tm-text;

    &--primary {
      color: $tm-primary;
    }
  }

  &__value {
    font-size: 26rpx;
    color: $tm-text-secondary;
  }

  &__arrow {
    font-size: 36rpx;
    color: $tm-text-muted;
    margin-left: 12rpx;
  }
}

.logout {
  margin-top: 60rpx;
  background: $tm-card-bg;
  border-radius: $tm-radius-sm;
  text-align: center;
  padding: 28rpx;
  font-size: 30rpx;
  color: $tm-danger;
  box-shadow: $tm-shadow-card;
}
</style>
