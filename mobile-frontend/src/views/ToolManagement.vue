<template>
  <div class="page-container">
    <div class="page-title">工器具管理</div>

    <!-- 搜索 + 筛选按钮 -->
    <div class="filter-bar">
      <van-search v-model="keyword" placeholder="搜索名称/编码" shape="round" />
      <div class="filter-row">
        <button class="filter-btn" @click="showFilter = true">
          筛选 <span v-if="activeFilterCount" class="filter-badge">{{ activeFilterCount }}</span>
        </button>
        <div class="filter-tags">
          <van-tag
            v-if="statusFilter"
            closeable
            size="medium"
            type="primary"
            @close="statusFilter = ''"
          >{{ statusLabel(statusFilter) }}</van-tag>
          <van-tag
            v-if="warehouseFilter"
            closeable
            size="medium"
            type="success"
            @close="onClearWarehouse"
          >{{ warehouseFilter }}</van-tag>
          <van-tag
            v-if="shelfFilter"
            closeable
            size="medium"
            type="warning"
            @close="onClearShelf"
          >{{ shelfFilter }}</van-tag>
          <van-tag
            v-if="locationFilter"
            closeable
            size="medium"
            @close="onClearLocation"
          >{{ locationFilter }}</van-tag>
          <van-tag
            v-if="toolkitFilter"
            closeable
            size="medium"
            type="success"
            @close="toolkitFilter = ''"
          >{{ toolkitFilter }}</van-tag>
        </div>
      </div>
    </div>

    <!-- 筛选弹出面板 -->
    <van-action-sheet
      v-model:show="showFilter"
      title="筛选条件"
      :close-on-click-action="false"
    >
      <div class="filter-panel">
        <!-- 状态 -->
        <div class="filter-section">
          <div class="filter-label">状态</div>
          <div class="filter-options">
            <van-tag
              v-for="opt in statusOptions"
              :key="opt.value"
              :type="statusFilter === opt.value ? 'primary' : 'default'"
              size="large"
              @click="statusFilter = opt.value"
            >{{ opt.text }}</van-tag>
          </div>
        </div>
        <!-- 仓库 -->
        <div class="filter-section">
          <div class="filter-label">仓库</div>
          <div class="filter-options">
            <van-tag
              v-for="opt in warehouseOptions"
              :key="opt.value"
              :type="warehouseFilter === opt.value ? 'primary' : 'default'"
              size="large"
              @click="selectWarehouse(opt.value)"
            >{{ opt.text }}</van-tag>
          </div>
        </div>
        <!-- 货架 -->
        <div class="filter-section">
          <div class="filter-label">货架</div>
          <div class="filter-options">
            <van-tag
              v-for="opt in shelfOptions"
              :key="opt.value"
              :type="shelfFilter === opt.value ? 'primary' : 'default'"
              size="large"
              @click="selectShelf(opt.value)"
            >{{ opt.text }}</van-tag>
          </div>
        </div>
        <!-- 货位 -->
        <div class="filter-section">
          <div class="filter-label">货位</div>
          <div class="filter-options">
            <van-tag
              v-for="opt in locationOptions"
              :key="opt.value"
              :type="locationFilter === opt.value ? 'primary' : 'default'"
              size="large"
              @click="locationFilter = opt.value"
            >{{ opt.text }}</van-tag>
          </div>
        </div>
        <!-- 工具包 -->
        <div class="filter-section">
          <div class="filter-label">工具包</div>
          <div class="filter-options">
            <van-tag
              v-for="k in toolkitOptions"
              :key="k.value"
              :type="toolkitFilter === k.value ? 'primary' : 'default'"
              size="large"
              @click="toolkitFilter = k.value"
            >{{ k.text }}</van-tag>
          </div>
        </div>
        <!-- 工具包快捷操作 -->
        <div v-if="toolkitFilter" class="filter-section">
          <van-button type="success" block round @click="handleBorrowKit">借一箱：{{ toolkitFilter }}</van-button>
        </div>
        <!-- 底部操作 -->
        <div class="filter-actions">
          <van-button plain type="default" @click="clearAllFilters" block>重置</van-button>
        </div>
      </div>
    </van-action-sheet>

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
            <van-tag v-if="tool.toolkit" plain type="success" size="medium" style="margin-left: 4px">
              {{ tool.toolkit }}
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
import { getTools, getWarehouses, getShelves, getLocations, getToolkits } from '@/api'
import { showToast } from 'vant'

const route = useRoute()
const cartStore = useCartStore()

const list = ref<any[]>([])
const keyword = ref('')
const statusFilter = ref('')
const warehouseFilter = ref('')
const shelfFilter = ref('')
const locationFilter = ref('')
const toolkitFilter = ref('')
const toolkits = ref<string[]>([])
const refreshing = ref(false)
const listLoading = ref(false)
const active = ref(1)
const showFilter = ref(false)

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

const activeFilterCount = computed(() => {
  let n = 0
  if (statusFilter.value) n++
  if (warehouseFilter.value) n++
  if (shelfFilter.value) n++
  if (locationFilter.value) n++
  if (toolkitFilter.value) n++
  return n
})

const toolkitOptions = computed(() => [
  { text: '全部工具包', value: '' },
  ...toolkits.value.map(k => ({ text: k, value: k }))
])

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
    if (toolkitFilter.value && t.toolkit !== toolkitFilter.value) return false
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

function selectWarehouse(val: string) {
  warehouseFilter.value = val
  shelfFilter.value = ''
  locationFilter.value = ''
}

function selectShelf(val: string) {
  shelfFilter.value = val
  locationFilter.value = ''
}

function onClearWarehouse() {
  selectWarehouse('')
}

function onClearShelf() {
  selectShelf('')
}

function onClearLocation() {
  locationFilter.value = ''
}

function clearAllFilters() {
  statusFilter.value = ''
  warehouseFilter.value = ''
  shelfFilter.value = ''
  locationFilter.value = ''
  toolkitFilter.value = ''
}

function handleBorrowKit() {
  const kitTools = list.value.filter(t => t.toolkit === toolkitFilter.value && t.status === 'available')
  if (kitTools.length === 0) {
    showToast(`工具包"${toolkitFilter.value}"中没有可用工具`)
    return
  }
  kitTools.forEach(t => {
    cartStore.addItem({
      tool_id: t.tool_id,
      tool_name: t.tool_name,
      tool_code: t.tool_code,
      warehouse: t.warehouse || '',
      image_url: t.image_url || ''
    })
  })
  showToast(`已将"${toolkitFilter.value}"中 ${kitTools.length} 件工具加入领用篮`)
}

async function onRefresh() {
  try {
    const [tools, whs, shs, locs, kits] = await Promise.all([
      getTools(), getWarehouses(), getShelves(), getLocations(), getToolkits()
    ])
    list.value = tools
    warehouses.value = whs
    shelves.value = shs
    locations.value = locs
    toolkits.value = kits
  } finally {
    refreshing.value = false
  }
}

onMounted(async () => {
  if (route.query.status) {
    statusFilter.value = route.query.status as string
  }
  try {
    const [tools, whs, shs, locs, kits] = await Promise.all([
      getTools(), getWarehouses(), getShelves(), getLocations(), getToolkits()
    ])
    list.value = tools
    warehouses.value = whs
    shelves.value = shs
    locations.value = locs
    toolkits.value = kits
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

/* 筛选行 */
.filter-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 0 16px 10px;
}

.filter-btn {
  flex-shrink: 0;
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  background: #fff;
  color: #323233;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
}

.filter-btn:active {
  background: #f5f5f5;
}

.filter-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: #ee0a24;
  color: #fff;
  font-size: 10px;
  line-height: 1;
}

.filter-tags {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 28px;
  align-items: center;
}

/* 筛选面板 */
.filter-panel {
  padding: 0 16px 24px;
  max-height: 60vh;
  overflow-y: auto;
}

.filter-section {
  margin-top: 16px;
}

.filter-label {
  font-size: 14px;
  font-weight: 600;
  color: #323233;
  margin-bottom: 8px;
}

.filter-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-options .van-tag {
  cursor: pointer;
  user-select: none;
}

.filter-actions {
  margin-top: 20px;
}
</style>
