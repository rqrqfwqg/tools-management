<template>
  <view class="login-page">
    <view class="brand">
      <view class="logo">🔧</view>
      <view class="title">项目管理部工具物料管理系统</view>
      <view class="subtitle">扫码领用 · 库存盘点 · 一键盘点</view>
    </view>

    <view class="actions">
      <!-- 微信一键登录：uni.login 换 code → 后端 openid 匹配
           已绑定账号 → 直接进正式账号；未绑定 → 不再静默进游客，而是弹出绑定窗 -->
      <button
        class="wx-btn"
        :loading="loading"
        :disabled="loading"
        @tap="wxQuickLogin"
      >
        <view class="wx-btn__badge">微</view>
        <text>{{ loading ? '登录中…' : '微信一键登录' }}</text>
      </button>

      <view class="tip">已绑定微信的账号可一键直进；未绑定账号点击后会提示绑定手机号，绑定后即可使用全部功能。</view>
    </view>

    <!-- 未绑定账号时弹出：输入手机号绑定并登录（个人主体小程序无 getPhoneNumber，手动输入） -->
    <view v-if="showBind" class="bind-mask" @tap="enterGuest">
      <view class="bind-card" @tap.stop>
        <view class="bind-card__title">绑定手机号</view>
        <view class="bind-card__desc">检测到该微信尚未绑定系统账号，请输入您在系统中登记的手机号完成绑定，绑定后即可使用全部功能。</view>
        <input
          class="bind-card__input"
          v-model="phone"
          type="number"
          maxlength="11"
          placeholder="输入手机号完成绑定"
          placeholder-class="bind-card__ph"
          :disabled="phoneLoading"
          @confirm="phoneBind"
        />
        <button
          class="bind-card__btn"
          :loading="phoneLoading"
          :disabled="phoneLoading"
          @tap="phoneBind"
        >
          <text>{{ phoneLoading ? '绑定中…' : '绑定并登录' }}</text>
        </button>
        <view class="bind-card__skip" @tap="enterGuest">稍后再说（游客模式）</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/store/auth'

const authStore = useAuthStore()
const loading = ref(false)
const showBind = ref(false)
const phone = ref('')
const phoneLoading = ref(false)

function goHome() {
  // Dashboard 是 tabBar 页，必须用 switchTab 跳转
  uni.switchTab({ url: '/pages/dashboard/Dashboard' })
}

onMounted(() => {
  // 已登录且非游客（已绑定正式账号）才直接进入首页；
  // 游客 token 同样会被持久化，必须回到登录页以便重新「微信一键登录」并触发绑定弹窗，
  // 否则游客会永久困在只读模式、再也看不到绑定入口
  if (authStore.isLoggedIn && !authStore.isGuest) {
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
      // 未匹配到系统账号 → 弹出绑定窗，让用户输手机号绑定当前微信
      showBind.value = true
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

/** 微信一键登录后未绑定触发：输入手机号绑定并登录。
 *  重新 uni.login 拿 code（静默、不弹授权）→ /auth/login 带 wx_code → 匹配系统账号并绑定当前微信 openid。
 *  绑定成功后微信一键登录即可直进正式账号。 */
async function phoneBind() {
  if (phoneLoading.value) return
  const p = phone.value.trim()
  if (!/^1\d{10}$/.test(p)) {
    uni.showToast({ title: '请输入正确的 11 位手机号', icon: 'none' })
    return
  }
  phoneLoading.value = true
  try {
    const loginRes: any = await uni.login()
    const code = loginRes?.code
    if (!code) {
      uni.showToast({ title: '获取微信凭证失败', icon: 'none' })
      return
    }
    const result = await authStore.accountLogin(p, code)
    if (!result?.access_token) {
      uni.showToast({ title: '绑定失败，请重试', icon: 'none' })
      return
    }
    showBind.value = false
    phone.value = ''
    uni.showToast({ title: result.bound_openid ? '绑定成功，已登录' : '登录成功', icon: 'success' })
    goHome()
  } catch (err: any) {
    uni.showToast({ title: err?.data?.message || err?.message || '绑定失败', icon: 'none' })
  } finally {
    phoneLoading.value = false
  }
}

/** 暂不绑定：关闭弹窗进入游客模式（只读） */
function enterGuest() {
  if (phoneLoading.value) return
  showBind.value = false
  uni.showToast({ title: '已进入游客模式（只读）', icon: 'none' })
  goHome()
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

/* 未绑定账号时弹出的绑定窗 */
.bind-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;

  .bind-card {
    width: 560rpx;
    background: #fff;
    border-radius: 24rpx;
    padding: 48rpx 40rpx 36rpx;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;

    &__title {
      font-size: 34rpx;
      font-weight: 700;
      color: #1a1a1a;
    }

    &__desc {
      margin-top: 20rpx;
      font-size: 24rpx;
      color: #8a8a8a;
      line-height: 36rpx;
      text-align: center;
    }

    &__input {
      width: 100%;
      height: 88rpx;
      margin-top: 32rpx;
      border-radius: 44rpx;
      background: #f5f6f8;
      border: 1rpx solid #e5e5e5;
      padding: 0 32rpx;
      font-size: 30rpx;
      color: #1a1a1a;
      box-sizing: border-box;
    }

    &__ph {
      color: #b0b0b0;
    }

    &__btn {
      width: 100%;
      height: 88rpx;
      margin-top: 24rpx;
      border-radius: 44rpx;
      background: linear-gradient(135deg, #3a7afe, #2f6ae8);
      color: #fff;
      font-size: 32rpx;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      line-height: 88rpx;
      padding: 0;

      &::after {
        border: none;
      }

      &[disabled] {
        opacity: 0.7;
      }
    }

    &__skip {
      margin-top: 24rpx;
      font-size: 24rpx;
      color: #8a8a8a;
    }
  }
}
</style>
