<template>
  <view class="login-page">
    <view class="brand">
      <view class="logo">🔧</view>
      <view class="title">项目管理部工具物料管理系统</view>
      <view class="subtitle">扫码领用 · 库存盘点 · 一键盘点</view>
    </view>

    <view class="actions">
      <!-- 个人主体小程序无法获取微信手机号，统一用「手机号免密登录」 -->
      <block v-if="!autoLogging">
        <view class="phone-box">
          <input
            class="phone-box__input"
            v-model="phone"
            type="number"
            maxlength="11"
            placeholder="输入手机号登录（系统已登记）"
            placeholder-class="phone-box__ph"
            :disabled="loading"
            @confirm="phoneLogin"
          />
          <button
            class="phone-box__btn"
            :loading="loading"
            :disabled="loading"
            @tap="phoneLogin"
          >
            <text>{{ loading ? '登录中…' : '登 录' }}</text>
          </button>
        </view>
        <view class="tip">请输入您在系统中登记的手机号登录；首次登录后自动记住本机账号，下次打开免输入。若账号已失效或清空，将重新提示输入。</view>
      </block>
      <view v-else class="auto-tip">正在自动登录…</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/store/auth'
import { getLoginPhone, setLoginPhone, clearLoginPhone } from '@/utils/storage'

const authStore = useAuthStore()
const phone = ref('')
const loading = ref(false)
/** 启动自动登录中（读取本机记住的手机号向服务端校验），期间隐藏表单 */
const autoLogging = ref(false)

function goHome() {
  // Dashboard 是 tabBar 页，必须用 switchTab 跳转
  uni.switchTab({ url: '/pages/dashboard/Dashboard' })
}

/**
 * 启动自动登录：若本机记住了手机号，向服务端校验该账号是否仍有效。
 * 有效 → 直接进入；失效（401 / 账号被删）→ 清除记住的手机号并回到输入表单。
 */
onMounted(async () => {
  const saved = getLoginPhone()
  if (!saved) return // 首次使用：展示输入表单
  autoLogging.value = true
  try {
    const result = await authStore.accountLogin(saved)
    if (result?.access_token) {
      goHome()
      return
    }
    // 兜底：无 token（极少数情况）
    clearLoginPhone()
    uni.showToast({ title: '登录已失效，请重新输入手机号', icon: 'none' })
  } catch (e: any) {
    // 账号已失效（如被删除、token 过期）→ 清除记住的手机号
    clearLoginPhone()
    const msg = e?.data?.message || e?.message || ''
    uni.showToast({ title: msg || '登录已失效，请重新输入手机号', icon: 'none' })
  } finally {
    autoLogging.value = false
  }
})

/** 手机号登录：校验格式 → /auth/login 免密签发 → 记住本机账号 */
async function phoneLogin() {
  if (loading.value) return
  const p = phone.value.trim()
  if (!/^1\d{10}$/.test(p)) {
    uni.showToast({ title: '请输入正确的 11 位手机号', icon: 'none' })
    return
  }
  loading.value = true
  try {
    const result = await authStore.accountLogin(p)
    if (!result?.access_token) {
      uni.showToast({ title: '登录失败，请重试', icon: 'none' })
      return
    }
    // 记住本机登录账号，下次启动自动登录
    setLoginPhone(p)
    uni.showToast({ title: '登录成功', icon: 'success' })
    phone.value = ''
    goHome()
  } catch (e: any) {
    uni.showToast({ title: e?.data?.message || e?.message || '手机号未登记或登录失败', icon: 'none' })
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

/* 手机号登录 */
.phone-box {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24rpx;

  &__input {
    width: 100%;
    height: 96rpx;
    border-radius: 48rpx;
    background: #f5f6f8;
    border: 1rpx solid #e5e5e5;
    padding: 0 36rpx;
    font-size: 32rpx;
    color: $tm-text;
    box-sizing: border-box;
  }

  &__ph {
    color: #b0b0b0;
  }

  &__btn {
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

    &[disabled] {
      opacity: 0.7;
    }
  }
}

.tip {
  margin-top: 36rpx;
  font-size: 22rpx;
  color: #b0b0b0;
  text-align: center;
  line-height: 32rpx;
}

.auto-tip {
  margin-top: 36rpx;
  font-size: 28rpx;
  color: #8a8a8a;
}
</style>
