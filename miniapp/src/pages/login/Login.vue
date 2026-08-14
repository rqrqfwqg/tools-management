<template>
  <view class="login-page">
    <view class="brand">
      <view class="logo">🔧</view>
      <view class="title">工器具管理系统</view>
      <view class="subtitle">扫码领用 · 库存盘点 · 一键盘点</view>
    </view>

    <view class="actions">
      <!-- 微信手机号授权登录：后端解析手机号匹配系统账号决定权限 -->
      <button
        class="wx-btn"
        open-type="getPhoneNumber"
        :loading="loading"
        :disabled="loading"
        @getphonenumber="onGetPhone"
      >
        <text class="wx-icon">💬</text>
        <text>{{ loading ? '登录中…' : '微信手机号登录' }}</text>
      </button>

      <!-- 游客模式（只读） -->
      <view class="guest-btn" :class="{ 'guest-btn--disabled': loading }" @tap="guestLogin">
        <text>{{ loading ? '登录中…' : '游客模式浏览（只读）' }}</text>
      </view>

      <view class="tip">手机号需与系统员工档案匹配才能操作；未匹配仅可查看</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/store/auth'
import { wxPhoneLogin } from '@/api'

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

/** 微信手机号登录：getPhoneNumber 按钮回调 → 手机号 code + uni.login code → 后端匹配账号 */
async function onGetPhone(e: any) {
  if (loading.value) return
  const detail = e?.detail || {}
  // 用户拒绝授权手机号
  if (detail.errMsg && String(detail.errMsg).includes('fail')) {
    uni.showToast({ title: '未授权手机号，可使用游客模式浏览', icon: 'none' })
    return
  }
  const phoneCode = detail.code
  if (!phoneCode) {
    uni.showToast({ title: '获取手机号失败，请重试', icon: 'none' })
    return
  }

  loading.value = true
  try {
    // 1. 取微信登录临时 code（mp-weixin 下 uni.login 直接返回 code，无需授权弹窗）
    const loginRes = await uni.login()
    const code = (loginRes as any).code
    if (!code) {
      uni.showToast({ title: '获取登录凭证失败', icon: 'none' })
      return
    }

    // 2. 手机号解析 + 账号匹配（后端决定真实账号或游客）
    const result = await wxPhoneLogin(code, phoneCode)
    if (result?.access_token) {
      authStore.setToken(result.access_token)
      authStore.setUser(result.user)
      if (result.guest) {
        uni.showToast({ title: '未匹配到账号，游客模式（只读）', icon: 'none' })
      } else {
        uni.showToast({ title: '登录成功', icon: 'success' })
      }
      goHome()
    } else {
      uni.showToast({ title: '登录失败，请重试', icon: 'none' })
    }
  } catch (err: any) {
    const msg = err?.data?.message || err?.message || err?.errMsg || '登录失败'
    uni.showToast({ title: msg, icon: 'none' })
  } finally {
    loading.value = false
  }
}

/** 游客模式：微信一键登录（不授权手机号）→ 后端未匹配账号返回游客（只读） */
async function guestLogin() {
  if (loading.value) return
  loading.value = true
  try {
    const loginRes = await uni.login()
    const code = (loginRes as any).code
    if (!code) {
      uni.showToast({ title: '获取登录凭证失败', icon: 'none' })
      return
    }
    const result = await authStore.wxLogin(code)
    if (result?.access_token) {
      uni.showToast({ title: '游客模式（只读）', icon: 'none' })
      goHome()
    } else {
      uni.showToast({ title: '登录失败，请重试', icon: 'none' })
    }
  } catch (err: any) {
    uni.showToast({ title: err?.data?.message || err?.message || '登录失败', icon: 'none' })
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

.wx-btn {
  width: 100%;
  height: 96rpx;
  border-radius: 48rpx;
  background-color: #07c160;
  color: #fff;
  font-size: 32rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  border: none;
  line-height: 96rpx;
  padding: 0;
}

.wx-btn::after {
  border: none;
}

.wx-btn[disabled] {
  opacity: 0.7;
}

.wx-icon {
  font-size: 36rpx;
}

.guest-btn {
  width: 100%;
  margin-top: 24rpx;
  height: 88rpx;
  border-radius: 44rpx;
  background: $tm-card-bg;
  color: $tm-text-secondary;
  font-size: 30rpx;
  font-weight: 500;
  border: 1rpx solid $tm-border;
  display: flex;
  align-items: center;
  justify-content: center;

  &--disabled {
    opacity: 0.7;
  }
}

.tip {
  margin-top: 32rpx;
  font-size: 22rpx;
  color: #b0b0b0;
  text-align: center;
}
</style>
