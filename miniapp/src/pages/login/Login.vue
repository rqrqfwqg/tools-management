<template>
  <view class="login-page">
    <view class="brand">
      <view class="logo">🔧</view>
      <view class="title">工器通</view>
      <view class="subtitle">扫码领用 · 库存盘点 · 一键盘点</view>
    </view>

    <view class="actions">
      <!-- 微信一键登录：uni.login 换 code → 后端 openid 匹配
           已绑定账号 → 直接进正式账号；未绑定 → 自动进入游客模式（只读），可在「个人中心」绑定账号 -->
      <button
        class="wx-btn"
        :loading="loading"
        :disabled="loading"
        @tap="wxQuickLogin"
      >
        <view class="wx-btn__badge">微</view>
        <text>{{ loading ? '登录中…' : '微信一键登录' }}</text>
      </button>

      <view class="tip">仅限系统已登记账号使用；已绑定微信的账号一键直进，未绑定账号自动进入游客模式（只读），可在个人中心绑定后使用全部功能</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/store/auth'

const authStore = useAuthStore()
const loading = ref(false)

function goHome() {
  // Dashboard 是 tabBar 页，必须用 switchTab 跳转
  uni.switchTab({ url: '/pages/dashboard/Dashboard' })
}

onMounted(() => {
  // 已登录用户（如重新打开小程序）直接进入首页，不重复展示登录页
  if (authStore.isLoggedIn) {
    goHome()
  }
})

/** 微信一键登录：uni.login → 后端 openid 匹配；已绑定进正式账号，未绑定自动转游客（只读） */
async function wxQuickLogin() {
  if (loading.value) return
  loading.value = true
  try {
    const loginRes: any = await uni.login()
    const code = loginRes?.code
    if (!code) {
      uni.showToast({ title: '获取微信登录凭证失败', icon: 'none' })
      return
    }
    const result = await authStore.wxLogin(code)
    if (!result?.access_token) {
      uni.showToast({ title: '微信登录失败，请重试', icon: 'none' })
      return
    }
    if (result.guest) {
      // 未匹配到系统账号 → 自动进入游客模式（只读），个人中心可绑定账号
      uni.showToast({ title: '已进入游客模式（只读），可在个人中心绑定账号', icon: 'none' })
      goHome()
      return
    }
    uni.showToast({ title: '微信登录成功', icon: 'success' })
    goHome()
  } catch (err: any) {
    uni.showToast({ title: err?.data?.message || err?.message || '微信登录失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  background-color: $tm-bg;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 180rpx 48rpx 120rpx;
  box-sizing: border-box;
}

.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.logo {
  width: 160rpx;
  height: 160rpx;
  border-radius: 36rpx;
  background: linear-gradient(135deg, #07c160, #06a850);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 88rpx;
  box-shadow: 0 16rpx 40rpx rgba(7, 193, 96, 0.25);
}

.title {
  margin-top: 40rpx;
  font-size: 44rpx;
  font-weight: 700;
  color: $tm-text;
}

.subtitle {
  margin-top: 16rpx;
  font-size: 26rpx;
  color: #8a8a8a;
}

.actions {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 微信一键登录 */
.wx-btn {
  width: 100%;
  height: 96rpx;
  border-radius: 48rpx;
  background: linear-gradient(135deg, #07c160, #06a850);
  color: #fff;
  font-size: 34rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  line-height: 96rpx;
  padding: 0;
  box-shadow: 0 12rpx 32rpx rgba(7, 193, 96, 0.25);

  &::after {
    border: none;
  }

  &__badge {
    width: 44rpx;
    height: 44rpx;
    border-radius: 10rpx;
    background: #fff;
    color: #07c160;
    font-size: 28rpx;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 16rpx;
  }

  &[disabled] {
    opacity: 0.7;
  }
}

.tip {
  margin-top: 40rpx;
  font-size: 22rpx;
  color: #b0b0b0;
  text-align: center;
  line-height: 32rpx;
}
</style>
