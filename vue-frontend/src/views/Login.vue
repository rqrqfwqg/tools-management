<template>
  <div class="login-container">
    <el-card class="login-card">
      <template #header>
        <h2>工器具管理系统</h2>
      </template>
      <el-form :model="form" ref="formRef">
        <el-form-item>
          <el-input v-model="form.phone" placeholder="手机号" prefix-icon="Iphone" maxlength="11" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" type="password" placeholder="密码" prefix-icon="Lock" show-password />
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
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

const router = useRouter()
const loading = ref(false)
const errorMsg = ref('')
const formRef = ref()

const form = reactive({ phone: '', password: '' })

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
    // 直接调用 API，不用 auth store
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
      ElMessage.success('登录成功')

      // 跳转到首页
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
