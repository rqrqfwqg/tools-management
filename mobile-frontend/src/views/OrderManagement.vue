<template>
  <div class="page-container">
    <div class="page-title">领用工单</div>

    <!-- 筛选 -->
    <van-dropdown-menu>
      <van-dropdown-item v-model="statusFilter" :options="statusOptions" />
    </van-dropdown-menu>

    <van-search v-model="keyword" placeholder="搜索单号/领用人" shape="round" />

    <!-- 工单列表 -->
    <div v-if="filteredList.length === 0" class="empty-state">
      <p>暂无工单</p>
    </div>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list v-model:loading="loading" :finished="true" finished-text="">
        <div
          v-for="order in filteredList"
          :key="order.order_id"
          class="card"
          @click="showDetail(order)"
        >
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-weight:600;font-size:15px">{{ order.order_no }}</span>
            <van-tag :type="orderStatusType(order.status)" size="medium">
              {{ orderStatusLabel(order.status) }}
            </van-tag>
          </div>
          <div style="font-size:13px;color:#666;line-height:1.8">
            <div>领用人: {{ order.borrower_name }}</div>
            <div>仓库: {{ order.warehouse }}</div>
            <div>工具数: {{ order.items?.length || 0 }} | {{ formatTime(order.created_at) }}</div>
          </div>
          <!-- 操作按钮 -->
          <div v-if="showActions(order)" style="margin-top:8px;display:flex;gap:8px">
            <van-button
              v-if="order.status === 'pending' && isApprover"
              size="small" type="success" @click.stop="approve(order)"
            >批准</van-button>
            <van-button
              v-if="order.status === 'pending' && isApprover"
              size="small" type="danger" @click.stop="reject(order)"
            >拒绝</van-button>
            <van-button
              v-if="(order.status === 'borrowed' || order.status === 'approved')"
              size="small" type="primary" @click.stop="returnOrder(order)"
            >归还</van-button>
            <van-button
              v-if="order.status === 'pending' || order.status === 'approved'"
              size="small" plain type="default" @click.stop="cancelOrder(order)"
            >取消</van-button>
          </div>
        </div>
      </van-list>
    </van-pull-refresh>

    <!-- 详情弹窗 -->
    <van-action-sheet v-model:show="detailVisible" title="工单详情" :closeable="true">
      <div style="padding:16px">
        <div v-if="currentOrder" style="line-height:2">
          <p><strong>工单号:</strong> {{ currentOrder.order_no }}</p>
          <p><strong>领用人:</strong> {{ currentOrder.borrower_name }}</p>
          <p><strong>手机号:</strong> {{ currentOrder.borrower_phone }}</p>
          <p><strong>仓库:</strong> {{ currentOrder.warehouse }}</p>
          <p><strong>状态:</strong>
            <van-tag :type="orderStatusType(currentOrder.status)" size="medium" style="margin-left:4px">
              {{ orderStatusLabel(currentOrder.status) }}
            </van-tag>
          </p>
          <p><strong>时间:</strong> {{ formatTime(currentOrder.created_at) }}</p>
        </div>
        <div v-if="currentOrder?.items?.length" style="margin-top:12px">
          <h4 style="margin-bottom:8px">工具清单</h4>
          <van-tag
            v-for="item in currentOrder.items" :key="item.tool_id"
            style="margin: 2px 4px 2px 0" type="primary" size="medium"
          >
            {{ item.tool_name }}
          </van-tag>
        </div>
      </div>
    </van-action-sheet>

    <van-tabbar v-model="active" route active-color="#1989fa" inactive-color="#999" safe-area-inset-bottom>
      <van-tabbar-item icon="home-o" to="/dashboard">首页</van-tabbar-item>
      <van-tabbar-item icon="orders-o" to="/tools">工具</van-tabbar-item>
      <van-tabbar-item icon="description" to="/orders">工单</van-tabbar-item>
      <van-tabbar-item icon="contact" to="/profile">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { getOrders, updateOrderStatus, returnOrder as apiReturnOrder } from '@/api'
import { showToast, showConfirmDialog } from 'vant'

const route = useRoute()
const authStore = useAuthStore()
const isApprover = computed(() => authStore.isApprover)

const list = ref<any[]>([])
const keyword = ref('')
const statusFilter = ref('')
const refreshing = ref(false)
const loading = ref(false)
const active = ref(2)
const detailVisible = ref(false)
const currentOrder = ref<any>(null)

const statusOptions = [
  { text: '全部状态', value: '' },
  { text: '待审核', value: 'pending' },
  { text: '已批准', value: 'approved' },
  { text: '借出中', value: 'borrowed' },
  { text: '已归还', value: 'returned' },
  { text: '已拒绝', value: 'rejected' },
  { text: '已取消', value: 'cancelled' }
]

const statusLabels: Record<string, string> = {
  pending: '待审核', approved: '已批准', borrowed: '借出中',
  returned: '已归还', rejected: '已拒绝', cancelled: '已取消'
}

const statusTypes: Record<string, string> = {
  pending: 'warning', approved: 'success', borrowed: 'primary',
  returned: '', rejected: 'danger', cancelled: ''
}

function orderStatusLabel(s: string) { return statusLabels[s] || s }
function orderStatusType(s: string) { return (statusTypes[s] || '') as any }

const filteredList = computed(() => {
  return list.value.filter(o => {
    if (statusFilter.value && o.status !== statusFilter.value) return false
    if (keyword.value) {
      const kw = keyword.value.toLowerCase()
      if (!o.order_no?.toLowerCase().includes(kw) && !o.borrower_name?.toLowerCase().includes(kw)) return false
    }
    return true
  })
})

function formatTime(t: string) {
  if (!t) return ''
  return new Date(t).toLocaleString('zh-CN')
}

function showActions(order: any) {
  return ['pending', 'approved', 'borrowed'].includes(order.status)
}

function showDetail(order: any) {
  currentOrder.value = order
  detailVisible.value = true
}

async function approve(order: any) {
  try {
    await updateOrderStatus(order.order_id, 'approved')
    showToast('已批准')
    await loadOrders()
  } catch (e: any) {
    showToast(e.response?.data?.message || '操作失败')
  }
}

async function reject(order: any) {
  try {
    await updateOrderStatus(order.order_id, 'rejected')
    showToast('已拒绝')
    await loadOrders()
  } catch (e: any) {
    showToast(e.response?.data?.message || '操作失败')
  }
}

async function returnOrder(order: any) {
  try {
    await showConfirmDialog({ title: '确认归还', message: '确定归还该工单的所有工具吗？' })
    await apiReturnOrder(order.order_id)
    showToast('已归还')
    await loadOrders()
  } catch (e: any) {
    if (e !== 'cancel') showToast(e.response?.data?.message || '操作失败')
  }
}

async function cancelOrder(order: any) {
  try {
    await showConfirmDialog({ title: '确认取消', message: '确定取消该工单吗？' })
    await updateOrderStatus(order.order_id, 'cancelled')
    showToast('已取消')
    await loadOrders()
  } catch (e: any) {
    if (e !== 'cancel') showToast(e.response?.data?.message || '操作失败')
  }
}

async function loadOrders() {
  try {
    list.value = await getOrders()
  } catch (e) {
    console.error('加载工单失败', e)
  }
}

async function onRefresh() {
  await loadOrders()
  refreshing.value = false
}

onMounted(async () => {
  if (route.query.status) {
    statusFilter.value = route.query.status as string
  }
  await loadOrders()
})
</script>
