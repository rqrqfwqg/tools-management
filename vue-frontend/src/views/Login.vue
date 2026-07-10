<template>
  <div class="login-container">
    <el-card class="login-card">
      <template #header>
        <h2>物料管理系统</h2>
      </template>
      <el-form :model="form" ref="formRef">
        <el-form-item>
          <el-input v-model="form.phone" placeholder="手机号" prefix-icon="Iphone" maxlength="11" autocomplete="tel" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" type="password" placeholder="密码" prefix-icon="Lock" show-password autocomplete="current-password" />
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="rememberMe">记住密码</el-checkbox>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" style="width:100%" @click="handleLogin" :loading="loading">登录</el-button>
        </el-form-item>
        <div style="color:red; font-size:12px; min-height:20px">{{ errorMsg }}</div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

const REMEMBER_KEY = 'saved_credentials'

const router = useRouter()
const loading = ref(false)
const errorMsg = ref('')
const formRef = ref()
const rememberMe = ref(false)

const form = reactive({ phone: '', password: '' })

onMounted(() => {
  try {
    const saved = localStorage.getItem(REMEMBER_KEY)
    if (saved) {
      const cred = JSON.parse(saved)
      form.phone = cred.phone || ''
      form.password = cred.password || ''
      rememberMe.value = true
    }
  } catch {
    // ignore
  }
})

const handleLogin = async () => {
  console.log('=== 登录按钮被点击 ===')
  errorMsg.value = ''

  if (!form.phone || !form.password) {
    errorMsg.value = '请输入手机号和密码'
    return
  }

  loading.value = true
  console.log('开始登录:', form.phone)

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: form.phone, password: form.password })
    })

    console.log('登录响应状态:', res.status)
    const text = await res.text()
    console.log('登录响应内容:', text)

    if (!text) {
      throw new Error('服务器无响应')
    }

    const data = JSON.parse(text)
    console.log('解析后的数据:', data)

    if (data.access_token) {
      console.log('登录成功，保存 token')
      localStorage.setItem('token', data.access_token)

      // 记住密码
      if (rememberMe.value) {
        localStorage.setItem(REMEMBER_KEY, JSON.stringify({
          phone: form.phone,
          password: form.password
        }))
      } else {
        localStorage.removeItem(REMEMBER_KEY)
      }

      ElMessage.success('登录成功')
      setTimeout(() => {
        router.replace('/dashboard')
      }, 500)
    } else {
      errorMsg.value = data.message || '登录失败'
    }
  } catch (e: any) {
    console.error('登录错误:', e)
    errorMsg.value = e.message || '登录失败，请检查网络'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #f0f2f5;
}
.login-card {
  width: 400px;
}
h2 {
  text-align: center;
  margin: 0;
}
</style>
