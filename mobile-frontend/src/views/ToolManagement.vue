<template>
  <div class="page-container">
    <div class="page-title">工器具管理</div>

    <!-- 搜索筛选 -->
    <div class="filter-bar">
      <van-search v-model="keyword" placeholder="搜索名称/编码" shape="round" />
      <van-dropdown-menu>
        <van-dropdown-item v-model="statusFilter" :options="statusOptions" @change="onFilterChange" />
        <van-dropdown-item v-model="warehouseFilter" :options="warehouseOptions" title="仓库" @change="onWarehouseFilterChange" />
        <van-dropdown-item v-model="shelfFilter" :options="shelfOptions" title="货架" @change="onShelfFilterChange" />
        <van-dropdown-item v-model="locationFilter" :options="locationOptions" title="货位" />
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
import { getTools, getWarehouses, getShelves, getLocations } from '@/api'
import { showToast } from 'vant'

const route = useRoute()
const cartStore = useCartStore()

const list = ref<any[]>([])
const keyword = ref('')
const statusFilter = ref('')
const warehouseFilter = ref('')
const shelfFilter = ref('')
const locationFilter = ref('')
const refreshing = ref(false)
const listLoading = ref(false)
const active = ref(1)

// 下拉数据源
const warehouses = ref<any[]>([])
const shelves = ref<any[]>([])
const locations = ref<any[]>([])

const statusOptions = [
  { text: '全部状态', value: '' },
  { text: '可用', value: 'available' },
  { text: '借出', value: 'borrowed' },
  { text: '维修', value: 'maintenance' },
  { text: '报废', value: 'scrapped' }
]

const warehouseOptions = computed(() => [
  { text: '全部仓库', value: '' },
  ...warehouses.value.map(w => ({ text: w.warehouse_name, value: w.warehouse_name }))
])

const shelfOptions = computed(() => {
  const base = [{ text: '全部货架', value: '' }]
  const filtered = warehouseFilter.value
    ? shelves.value.filter(s => {
        const w = warehouses.value.find(ww => ww.warehouse_name === warehouseFilter.value)
        return w ? s.warehouse_id === w.warehouse_id : false
      })
    : shelves.value
  return [...base, ...filtered.map(s => ({ text: s.shelf_name, value: s.shelf_name }))]
})

const locationOptions = computed(() => {
  const base = [{ text: '全部货位', value: '' }]
  const filtered = shelfFilter.value
    ? locations.value.filter(l => {
        const s = shelves.value.find(ss => ss.shelf_name === shelfFilter.value)
        return s ? l.shelf_id === s.shelf_id : false
      })
    : locations.value
  return [...base, ...filtered.map(l => ({ text: l.location_name || l.location_code, value: l.location_name || l.location_code }))]
})

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
    if (warehouseFilter.value && t.warehouse !== warehouseFilter.value) return false
    if (shelfFilter.value) {
      const s = shelves.value.find(ss => ss.shelf_name === shelfFilter.value)
      if (s && t.shelf_id !== s.shelf_id) return false
    }
    if (locationFilter.value) {
      const l = locations.value.find(ll => (ll.location_name || ll.location_code) === locationFilter.value)
      if (l && t.storage_location_id !== l.location_id) return false
    }
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

function onWarehouseFilterChange() {
  // 仓库切换时重置货架和货位
  shelfFilter.value = ''
  locationFilter.value = ''
}

function onShelfFilterChange() {
  // 货架切换时重置货位
  locationFilter.value = ''
}

async function onRefresh() {
  try {
    const [tools, whs, shs, locs] = await Promise.all([
      getTools(), getWarehouses(), getShelves(), getLocations()
    ])
    list.value = tools
    warehouses.value = whs
    shelves.value = shs
    locations.value = locs
  } finally {
    refreshing.value = false
  }
}

onMounted(async () => {
  if (route.query.status) {
    statusFilter.value = route.query.status as string
  }
  try {
    const [tools, whs, shs, locs] = await Promise.all([
      getTools(), getWarehouses(), getShelves(), getLocations()
    ])
    list.value = tools
    warehouses.value = whs
    shelves.value = shs
    locations.value = locs
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
