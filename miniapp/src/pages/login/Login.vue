<template>
  <view class="login-page">
    <view class="brand">
      <view class="logo">🔧</view>
      <view class="title">工器通</view>
      <view class="subtitle">扫码领用 · 库存盘点 · 一键盘点</view>
    </view>

    <view class="actions">
      <!-- 微信一键登录：uni.login 换 code → 后端 openid 匹配；未绑定账号时引导绑定 -->
      <button
        class="wx-btn"
        :loading="loading"
        :disabled="loading"
        @tap="wxQuickLogin"
      >
        <view class="wx-btn__badge">微</view>
        <text>{{ loading ? '登录中…' : '微信一键登录' }}</text>
      </button>

      <!-- 首次使用（微信未绑定系统账号）时显示：输入账号完成绑定 -->
      <view v-if="pendingWxCode" class="bind-form">
        <view class="bind-form__title">绑定系统账号</view>
        <view class="bind-form__desc">当前微信未绑定系统账号，请输入手机号或用户名完成绑定；绑定后每次打开一键登录直接进入。</view>
        <input
          class="bind-form__input"
          v-model="account"
          placeholder="请输入手机号或用户名"
          placeholder-class="bind-form__ph"
          :disabled="loading"
          @confirm="accountLogin"
        />
        <button
          class="login-btn"
          :loading="loading"
          :disabled="loading"
          @tap="accountLogin"
        >
          <text>{{ loading ? '绑定中…' : '绑定并登录' }}</text>
        </button>
      </view>

      <view class="tip">仅限系统已登记账号使用；首次使用需输入账号完成一次绑定，之后「微信一键登录」直接进入</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/store/auth'

const authStore = useAuthStore()
const loading = ref(false)
const account = ref('')
/** 微信一键登录已拿到 code 但未匹配账号时暂存，绑定账号时随 /auth/login 提交 */
const pendingWxCode = ref('')

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

/** 微信一键登录：uni.login → 后端 openid 匹配正式账号；未绑定则引导输入账号完成绑定 */
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
      // 未绑定系统账号 → 引导输入账号完成绑定（记住 code，绑定成功后下次一键登录直接进正式账号）
      pendingWxCode.value = code
      uni.showToast({ title: '请输入账号完成绑定', icon: 'none' })
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

/** 绑定账号：手机号/用户名免密匹配 → 后端签发 token 并绑定当前微信 openid → 持久化到本机 */
async function accountLogin() {
  if (loading.value) return
  const id = account.value.trim()
  if (!id) {
    uni.showToast({ title: '请输入手机号或用户名', icon: 'none' })
    return
  }
  loading.value = true
  try {
    const result = await authStore.accountLogin(id, pendingWxCode.value || undefined)
    if (result?.access_token) {
      uni.showToast({
        title: result.bound_openid ? '已绑定微信，登录成功' : '登录成功',
        icon: 'success'
      })
      goHome()
    } else {
      uni.showToast({ title: '绑定失败，请重试', icon: 'none' })
    }
  } catch (err: any) {
    const msg = err?.data?.message || err?.message || err?.errMsg || '绑定失败'
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

/* 首次绑定表单（仅微信未绑定账号时出现） */
.bind-form {
  width: 100%;
  margin-top: 48rpx;
  background: $tm-card-bg;
  border-radius: $tm-radius;
  padding: 40rpx 32rpx 36rpx;
  box-shadow: $tm-shadow-card;
  box-sizing: border-box;

  &__title {
    font-size: 32rpx;
    font-weight: 600;
    color: $tm-text;
    margin-bottom: 16rpx;
  }

  &__desc {
    font-size: 24rpx;
    color: $tm-text-secondary;
    line-height: 36rpx;
    margin-bottom: 28rpx;
  }

  &__input {
    width: 100%;
    height: 88rpx;
    border-radius: 16rpx;
    background: $tm-bg;
    border: 1rpx solid $tm-border;
    padding: 0 24rpx;
    box-sizing: border-box;
    font-size: 30rpx;
    color: $tm-text;
  }

  &__ph {
    color: $tm-text-muted;
  }
}

.login-btn {
  width: 100%;
  margin-top: 28rpx;
  height: 92rpx;
  border-radius: 46rpx;
  background-color: #07c160;
  color: #fff;
  font-size: 32rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  line-height: 92rpx;
  padding: 0;

  &::after {
    border: none;
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
