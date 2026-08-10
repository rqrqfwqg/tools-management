<template>
  <view class="login-page">
    <view class="brand">
      <view class="logo">🔧</view>
      <view class="title">工器具管理系统</view>
      <view class="subtitle">扫码领用 · 库存盘点 · 一键盘点</view>
    </view>

    <view class="actions">
      <button
        class="wx-btn"
        :loading="loading"
        :disabled="loading"
        @tap="handleWxLogin"
      >
        <text class="wx-icon">💬</text>
        <text>{{ loading ? '登录中…' : '微信一键登录' }}</text>
      </button>
      <view class="tip">登录即表示同意《用户协议》与《隐私政策》</view>
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

async function handleWxLogin() {
  if (loading.value) return
  loading.value = true
  try {
    // 1. 取微信登录临时 code（mp-weixin 下 uni.login 直接返回 code，无需用户授权弹窗）
    const loginRes = await uni.login()
    const code = (loginRes as any).code
    if (!code) {
      uni.showToast({ title: '获取登录凭证失败', icon: 'none' })
      return
    }

    // 2. code → 后端 jscode2session 换 openid → 查找/自动注册 → 签发 JWT
    //    authStore.wxLogin 内部已写入 token + user 到 storage
    const result = await authStore.wxLogin(code)
    if (result?.access_token) {
      if (result.is_new_user) {
        uni.showToast({ title: '账号已创建', icon: 'success' })
      } else {
        uni.showToast({ title: '登录成功', icon: 'success' })
      }
      // 新用户可在「我的」页绑定手机号，这里不阻塞主流程
      goHome()
    } else {
      uni.showToast({ title: '登录失败，请重试', icon: 'none' })
    }
  } catch (err: any) {
    // 后端未配置 WX_APPID/WX_SECRET 时会返回「微信登录未配置」
    const msg = err?.message || err?.errMsg || '登录失败'
    uni.showToast({ title: msg, icon: 'none' })
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

.tip {
  margin-top: 32rpx;
  font-size: 22rpx;
  color: #b0b0b0;
  text-align: center;
}
</style>
