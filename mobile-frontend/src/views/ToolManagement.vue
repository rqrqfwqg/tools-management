<template>
  <div class="page-container">
    <div class="page-title">工器具管理</div>

    <!-- 搜索筛选 -->
    <div class="filter-bar">
      <van-search v-model="keyword" placeholder="搜索名称/编码" shape="round" />
      <van-dropdown-menu>
        <van-dropdown-item v-model="statusFilter" :options="statusOptions" @change="onFilterChange" />
      </van-dropdown-menu>
    </div>

    <!-- 工具列表 -->
    <div v-if="filteredList.length === 0" class="empty-state">
      <p>暂无数据</p>
    </div>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="listLoading"
        :finished="true"
        finished-text=""
      >
        <van-card
          v-for="tool in filteredList"
          :key="tool.tool_id"
          :num="tool.status === 'available' ? 2 : 1"
          :price="tool.tool_code"
          :desc="tool.category_name + ' | ' + (tool.warehouse || '未分配仓库')"
          :title="tool.tool_name"
          :thumb="tool.image_url ? tool.image_url : ''"
          style="margin-bottom: 8px"
        >
          <template #tags>
            <van-tag :type="statusTagType(tool.status)" size="medium">
              {{ statusLabel(tool.status) }}
            </van-tag>
            <van-tag v-if="tool.shelf" plain type="primary" size="medium" style="margin-left: 4px">
              {{ tool.shelf }}
            </van-tag>
          </template>
          <template #footer>
            <van-button
              v-if="tool.status === 'available'"
              size="small"
              type="primary"
              @click="addToCart(tool)"
              :disabled="cartStore.hasItem(tool.tool_id)"
            >
              {{ cartStore.hasItem(tool.tool_id) ? '已添加' : '领用' }}
            </van-button>
          </template>
        </van-card>
      </van-list>
    </van-pull-refresh>

    <!-- 浮动购物车按钮 -->
    <div v-if="cartCount > 0" class="cart-float" @click="$router.push('/cart')">
      <van-badge :content="cartCount">
        <van-icon name="cart-o" size="28" />
      </van-badge>
    </div>

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
import { useCartStore } from '@/store/cart'
import { getTools } from '@/api'
import { showToast } from 'vant'

const route = useRoute()
const cartStore = useCartStore()

const list = ref<any[]>([])
const keyword = ref('')
const statusFilter = ref('')
const refreshing = ref(false)
const listLoading = ref(false)
const active = ref(1)

const statusOptions = [
  { text: '全部状态', value: '' },
  { text: '可用', value: 'available' },
  { text: '借出', value: 'borrowed' },
  { text: '维修', value: 'maintenance' },
  { text: '报废', value: 'scrapped' }
]

const statusLabel = (s: string) => {
  const map: Record<string, string> = { available: '可用', borrowed: '借出', maintenance: '维修', scrapped: '报废' }
  return map[s] || s
}

const statusTagType = (s: string) => {
  const map: Record<string, string> = { available: 'success', borrowed: 'warning', maintenance: 'primary', scrapped: '' }
  return (map[s] || '') as any
}

const cartCount = computed(() => cartStore.count)

const filteredList = computed(() => {
  return list.value.filter(t => {
    if (statusFilter.value && t.status !== statusFilter.value) return false
    if (keyword.value) {
      const kw = keyword.value.toLowerCase()
      if (!t.tool_name?.toLowerCase().includes(kw) && !t.tool_code?.toLowerCase().includes(kw)) return false
    }
    return true
  })
})

function addToCart(tool: any) {
  cartStore.addItem({
    tool_id: tool.tool_id,
    tool_name: tool.tool_name,
    tool_code: tool.tool_code,
    warehouse: tool.warehouse || '',
    image_url: tool.image_url || ''
  })
  showToast('已添加到领用篮')
}

function onFilterChange() {}

async function onRefresh() {
  try {
    list.value = await getTools()
  } finally {
    refreshing.value = false
  }
}

onMounted(async () => {
  if (route.query.status) {
    statusFilter.value = route.query.status as string
  }
  try {
    list.value = await getTools()
  } catch (e) {
    console.error('加载工具列表失败', e)
  }
})
</script>

<style scoped>
.cart-float {
  position: fixed;
  right: 16px;
  bottom: 80px;
  width: 56px;
  height: 56px;
  background: #1989fa;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 4px 12px rgba(25,137,250,0.4);
  z-index: 100;
}
</style>
