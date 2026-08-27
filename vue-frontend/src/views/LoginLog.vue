<template>
  <div class="login-log-page">
    <el-card>
      <template #header>
        <div class="page-header">
          <span class="title">登录日志（安全审计）</span>
          <span class="sub">记录管理员与用户的登录 IP、时间、方式，供安全追溯</span>
        </div>
      </template>

      <el-form :inline="true" class="filters">
        <el-form-item label="结果">
          <el-select v-model="filterSuccess" placeholder="全部" clearable style="width: 120px" @change="loadData(1)">
            <el-option label="成功" value="1" />
            <el-option label="失败" value="0" />
          </el-select>
        </el-form-item>
        <el-form-item label="方式">
          <el-select v-model="filterMethod" placeholder="全部" clearable style="width: 140px" @change="loadData(1)">
            <el-option label="账号密码" value="password" />
            <el-option label="微信登录" value="wx" />
            <el-option label="微信手机号" value="wx_phone" />
          </el-select>
        </el-form-item>
        <el-form-item label="来源">
          <el-select v-model="filterClient" placeholder="全部" clearable style="width: 140px" @change="loadData(1)">
            <el-option label="网页端" value="web" />
            <el-option label="小程序" value="miniprogram" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData(1)">查询</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="list" v-loading="loading" border stripe style="width: 100%">
        <el-table-column label="登录时间" width="180">
          <template #default="{ row }">{{ formatTime(row.login_at) }}</template>
        </el-table-column>
        <el-table-column label="账号" prop="username" width="140" />
        <el-table-column label="角色" prop="role" width="100" />
        <el-table-column label="登录 IP" prop="login_ip" width="150" />
        <el-table-column label="方式" width="120">
          <template #default="{ row }">
            <el-tag>{{ methodLabel(row.login_method) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="来源" width="100">
          <template #default="{ row }">
            <el-tag :type="row.client === 'miniprogram' ? 'warning' : 'info'">{{ clientLabel(row.client) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="结果" width="90">
          <template #default="{ row }">
            <el-tag :type="row.success ? 'success' : 'danger'">{{ row.success ? '成功' : '失败' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="失败原因" prop="fail_reason" min-width="160" />
        <el-table-column label="客户端" prop="user_agent" min-width="220" show-overflow-tooltip />
      </el-table>

      <el-pagination
        class="pager"
        background
        layout="total, prev, pager, next"
        :total="total"
        :page-size="pageSize"
        :current-page="page"
        @current-change="loadData"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getLoginLogs } from '@/api'

interface LoginLogItem {
  log_id: number
  user_id: number | null
  username: string
  role: string
  login_ip: string
  login_method: string
  client: string
  user_agent: string
  success: boolean
  fail_reason: string
  login_at: string
}

const list = ref<LoginLogItem[]>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(50)
const filterSuccess = ref('')
const filterMethod = ref('')
const filterClient = ref('')

function formatTime(iso?: string) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function methodLabel(method?: string) {
  if (method === 'password') return '账号密码'
  if (method === 'wx') return '微信登录'
  if (method === 'wx_phone') return '微信手机号'
  return method || '-'
}

function clientLabel(client?: string) {
  if (client === 'miniprogram') return '小程序'
  if (client === 'web') return '网页端'
  return client || '-'
}

async function loadData(p?: number) {
  if (p) page.value = p
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: page.value, page_size: pageSize.value }
    if (filterSuccess.value) params.success = filterSuccess.value
    if (filterMethod.value) params.method = filterMethod.value
    if (filterClient.value) params.client = filterClient.value
    const res = await getLoginLogs(params)
    list.value = res.list || []
    total.value = res.total || 0
  } catch (e) {
    // 查询失败时保持列表为空
  } finally {
    loading.value = false
  }
}

onMounted(() => loadData(1))
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.page-header .title {
  font-size: 16px;
  font-weight: 600;
}
.page-header .sub {
  font-size: 12px;
  color: #909399;
}
.filters {
  margin-bottom: 12px;
}
.pager {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
