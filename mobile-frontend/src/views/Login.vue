<template>
  <div class="login-page">
    <div class="login-header">
      <div class="logo-icon">🔧</div>
      <h1>T3GTC 工器具管理</h1>
      <p>请使用手机号登录</p>
    </div>

    <van-form @submit="handleLogin" class="login-form">
      <van-cell-group inset>
        <van-field
          v-model="phone"
          type="tel"
          maxlength="11"
          placeholder="请输入手机号"
          :rules="[{ required: true, message: '请输入手机号' }]"
          left-icon="phone-o"
        />
        <van-field
          v-model="password"
          type="password"
          placeholder="请输入密码"
          :rules="[{ required: true, message: '请输入密码' }]"
          left-icon="lock"
        />
      </van-cell-group>
      <div style="margin: 8px 16px 0">
        <van-checkbox v-model="rememberMe" shape="square">记住密码</van-checkbox>
      </div>
      <div style="margin: 16px">
        <van-button round block type="primary" native-type="submit" :loading="loading">
          登录
        </van-button>
      </div>
    </van-form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { login } from '@/api'
import { showToast } from 'vant'

const REMEMBER_KEY = 'saved_credentials'

const router = useRouter()
const authStore = useAuthStore()
const phone = ref('')
const password = ref('')
const rememberMe = ref(false)
const loading = ref(false)

onMounted(() => {
  try {
    const saved = localStorage.getItem(REMEMBER_KEY)
    if (saved) {
      const cred = JSON.parse(saved)
      phone.value = cred.phone || ''
      password.value = cred.password || ''
      rememberMe.value = true
    }
  } catch {
    // ignore
  }
})

async function handleLogin() {
  if (!phone.value || !password.value) return
  loading.value = true
  try {
    const res = await login(phone.value, password.value)
    authStore.setToken(res.access_token)
    authStore.setUser(res.user)

    // 记住密码
    if (rememberMe.value) {
      localStorage.setItem(REMEMBER_KEY, JSON.stringify({
        phone: phone.value,
        password: password.value
      }))
    } else {
      localStorage.removeItem(REMEMBER_KEY)
    }

    showToast('登录成功')
    router.push('/dashboard')
  } catch (e: any) {
    showToast(e.response?.data?.message || '登录失败，请检查手机号或密码')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-header {
  text-align: center;
  margin-bottom: 40px;
  color: #fff;
}

.logo-icon {
  font-size: 64px;
  margin-bottom: 12px;
}

.login-header h1 {
  font-size: 24px;
  margin-bottom: 8px;
}

.login-header p {
  font-size: 14px;
  opacity: 0.8;
}

.login-form {
  width: 100%;
}
</style>
