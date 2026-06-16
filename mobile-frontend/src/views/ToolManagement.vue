<template>
  <div class="page-container">
    <div class="page-title">工器具管理</div>

    <!-- 工具 / 工具箱 切换 -->
    <van-tabs v-model:active="viewMode" class="mode-tabs">
      <van-tab title="工具" name="tools" />
      <van-tab title="工具箱" name="kits" />
    </van-tabs>

    <!-- 工具箱视图 -->
    <div v-if="viewMode === 'kits'" class="kit-view">
      <div v-if="toolkits.length === 0" style="text-align:center;padding:40px;color:#999">
        暂无工具包，请在PC端工具箱管理中创建
      </div>
      <van-cell
        v-for="kit in toolkits"
        :key="kit.toolkit_id"
        :title="kit.toolkit_name"
        :label="`${kit.tool_count || 0} 件工具`"
        is-link
        @click="openKitDetail(kit.toolkit_name)"
      />
    </div>

    <!-- 工具视图 -->
    <template v-if="viewMode === 'tools'">

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
        <div
          v-for="tool in filteredList"
          :key="tool.tool_id"
          class="tool-card"
        >
          <div class="tool-card-left" @click="openDetail(tool)">
            <div class="tool-card-thumb">
              <img v-if="tool.image_url" :src="tool.image_url" alt="" />
              <van-icon v-else name="photo-o" size="36" color="#c8c9cc" />
            </div>
            <div class="tool-card-info">
              <div class="tool-card-title">
                {{ tool.tool_name }}
                <van-tag :type="statusTagType(tool.status)" size="medium" class="status-inline">
                  {{ statusLabel(tool.status) }}
                </van-tag>
              </div>
              <div class="tool-card-code">{{ tool.tool_code }}</div>
              <div class="tool-card-desc">{{ cardDesc(tool) }}</div>
              <div class="tool-card-tags">
                <van-tag v-if="tool.location_name" plain type="warning" size="medium">
                  {{ tool.location_name }}
                </van-tag>
                <van-tag v-if="tool.toolkit_name" plain type="success" size="medium">
                  {{ tool.toolkit_name }}
                </van-tag>
              </div>
            </div>
          </div>
          <div class="tool-card-right" @click.stop="handleQuickBorrow(tool)">
            <van-button
              v-if="tool.status === 'available'"
              size="normal"
              type="primary"
              :disabled="cartStore.hasItem(tool.tool_id)"
              class="tool-borrow-btn"
            >
              {{ cartStore.hasItem(tool.tool_id) ? '已添加' : '领用' }}
            </van-button>
            <span v-else class="tool-card-unavail">{{ statusLabel(tool.status) }}</span>
          </div>
        </div>
      </van-list>
    </van-pull-refresh>
    </template>

    <!-- 工具箱详情弹出层 -->
    <van-action-sheet v-model:show="showKitDetail" :title="selectedKit">
      <div class="kit-detail-panel">
        <div v-if="kitDetailTools.length === 0" style="text-align:center;padding:30px;color:#999">
          该工具包为空
        </div>
        <div
          v-for="tool in kitDetailTools"
          :key="tool.tool_id"
          class="tool-card"
        >
          <div class="tool-card-left" @click="openDetail(tool)">
            <div class="tool-card-thumb">
              <img v-if="tool.image_url" :src="tool.image_url" alt="" />
              <van-icon v-else name="photo-o" size="36" color="#c8c9cc" />
            </div>
            <div class="tool-card-info">
              <div class="tool-card-title">
                {{ tool.tool_name }}
                <van-tag :type="statusTagType(tool.status)" size="medium" class="status-inline">
                  {{ statusLabel(tool.status) }}
                </van-tag>
              </div>
              <div class="tool-card-code">{{ tool.tool_code }}</div>
              <div class="tool-card-desc">{{ cardDesc(tool) }}</div>
              <div class="tool-card-tags">
                <van-tag v-if="tool.location_name" plain type="warning" size="medium">
                  {{ tool.location_name }}
                </van-tag>
                <van-tag v-if="tool.toolkit_name" plain type="success" size="medium">
                  {{ tool.toolkit_name }}
                </van-tag>
              </div>
            </div>
          </div>
          <div class="tool-card-right" @click.stop="handleQuickBorrow(tool)">
            <van-button
              v-if="tool.status === 'available'"
              size="normal"
              type="primary"
              :disabled="cartStore.hasItem(tool.tool_id)"
              class="tool-borrow-btn"
            >
              {{ cartStore.hasItem(tool.tool_id) ? '已添加' : '领用' }}
            </van-button>
            <span v-else class="tool-card-unavail">{{ statusLabel(tool.status) }}</span>
          </div>
        </div>
        <div class="kit-detail-actions">
          <van-button type="success" block round @click="borrowKitAll">
            借一箱（{{ kitDetailTools.filter(t => t.status === 'available').length }} 件可用）
          </van-button>
        </div>
      </div>
    </van-action-sheet>

    <!-- 工具详情弹出层 -->
    <van-popup v-model:show="showDetail" position="bottom" round :style="{ height: '80%' }" closeable>
      <div class="detail-panel" v-if="detailTool">
        <!-- 工具图片 -->
        <div class="detail-image-section">
          <van-image
            v-if="detailTool.image_url"
            :src="detailTool.image_url"
            fit="cover"
            width="100%"
            height="200"
            radius="8"
            @click="previewImage"
          />
          <div v-else class="detail-image-placeholder">
            <van-icon name="photo-o" size="56" color="#c8c9cc" />
            <p>暂无图片</p>
          </div>
        </div>

        <!-- 工具基本信息 -->
        <van-cell-group inset>
          <van-cell title="工具名称" :value="detailTool.tool_name" />
          <van-cell title="工具编码" :value="detailTool.tool_code" />
          <van-cell title="分类" :value="detailTool.category_name || '-'" />
          <van-cell title="状态">
            <template #value>
              <van-tag :type="statusTagType(detailTool.status)" size="medium">
                {{ statusLabel(detailTool.status) }}
              </van-tag>
            </template>
          </van-cell>
          <van-cell title="仓库" :value="detailTool.warehouse || '未分配'" />
          <van-cell title="货架" :value="detailTool.shelf_name || '未分配'" />
          <van-cell title="货位" :value="detailTool.location_name || '未分配'" />
          <van-cell title="描述" :label="detailTool.description || '无'" />
        </van-cell-group>

        <!-- 图片上传（仅管理员/审批人可见） -->
        <div v-if="authStore.isApprover" class="upload-section">
          <div class="upload-title">更新图片</div>
          <div class="upload-buttons">
            <van-button
              type="primary"
              size="small"
              icon="photograph"
              :loading="uploading"
              @click="triggerCamera"
            >拍照</van-button>
            <van-button
              type="default"
              size="small"
              icon="photo"
              :loading="uploading"
              @click="triggerGallery"
            >相册</van-button>
            <van-button
              v-if="detailTool.image_url"
              type="danger"
              size="small"
              icon="delete-o"
              :loading="uploading"
              @click="deleteImage"
            >删除</van-button>
          </div>
          <!-- 上传进度提示 -->
          <div v-if="uploadMsg" class="upload-msg" :class="{ 'upload-error': uploadError }">
            {{ uploadMsg }}
          </div>
          <!-- 隐藏的文件选择器 -->
          <input
            ref="cameraInput"
            type="file"
            accept="image/*"
            capture="environment"
            style="display:none"
            @change="onFileChange"
          />
          <input
            ref="galleryInput"
            type="file"
            accept="image/*"
            style="display:none"
            @change="onFileChange"
          />
        </div>

        <!-- 领用按钮 -->
        <div class="detail-actions">
          <van-button
            v-if="detailTool.status === 'available'"
            type="primary"
            block
            round
            @click="addToCart(detailTool); showDetail = false"
            :disabled="cartStore.hasItem(detailTool.tool_id)"
          >{{ cartStore.hasItem(detailTool.tool_id) ? '已在领用篮' : '加入领用篮' }}</van-button>
        </div>
      </div>
    </van-popup>

    <!-- 图片预览 -->
    <van-image-preview
      v-model:show="showPreview"
      :images="previewImages"
      :start-position="0"
    />

    <!-- 浮动购物车按钮 -->
    <div v-if="cartCount > 0" class="cart-float" @click="$router.push('/cart')">
      <van-badge :content="cartCount">
        <van-icon name="cart-o" size="28" />
      </van-badge>
    </div>

    <!-- 扫码浮动按钮 -->
    <div class="scan-float" @click="$router.push('/scan')">
      <van-icon name="scan" size="28" />
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
import { useAuthStore } from '@/store/auth'
import { getTools, getWarehouses, getShelves, getLocations, getToolkits, uploadToolImage, updateTool } from '@/api'
import { showToast, showSuccessToast, showFailToast } from 'vant'

const route = useRoute()
const cartStore = useCartStore()
const authStore = useAuthStore()

const list = ref<any[]>([])
const keyword = ref('')
const statusFilter = ref('')
const warehouseFilter = ref('')
const shelfFilter = ref('')
const locationFilter = ref('')
const toolkitFilter = ref('')
const toolkits = ref<any[]>([])
const refreshing = ref(false)
const listLoading = ref(false)
const active = ref(1)
const showFilter = ref(false)
const viewMode = ref('tools')
const showKitDetail = ref(false)
const selectedKit = ref('')

// 工具详情 + 图片上传
const showDetail = ref(false)
const detailTool = ref<any>(null)
const uploading = ref(false)
const uploadMsg = ref('')
const uploadError = ref(false)
const cameraInput = ref<HTMLInputElement | null>(null)
const galleryInput = ref<HTMLInputElement | null>(null)
const showPreview = ref(false)
const previewImages = ref<string[]>([])

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

const cardDesc = (tool: any) => {
  const parts = [tool.category_name || '']
  parts.push(tool.warehouse || '未分配仓库')
  if (tool.shelf_name) parts.push(tool.shelf_name)
  if (tool.location_name) parts.push(tool.location_name)
  return parts.join(' > ')
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
  ...toolkits.value.map(k => ({ text: k.toolkit_name, value: k.toolkit_name }))
])

const kitDetailTools = computed(() =>
  list.value.filter(t => t.toolkit_name === selectedKit.value)
)

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
    if (toolkitFilter.value && t.toolkit_name !== toolkitFilter.value) return false
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

function handleQuickBorrow(tool: any) {
  if (tool.status !== 'available' || cartStore.hasItem(tool.tool_id)) return
  addToCart(tool)
}

// ===== 工具详情 + 图片上传 =====
function openDetail(tool: any) {
  detailTool.value = { ...tool }
  showDetail.value = true
  uploadMsg.value = ''
  uploadError.value = false
}

function triggerCamera() {
  cameraInput.value?.click()
}

function triggerGallery() {
  galleryInput.value?.click()
}

function previewImage() {
  if (detailTool.value?.image_url) {
    previewImages.value = [detailTool.value.image_url]
    showPreview.value = true
  }
}

async function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file || !detailTool.value) return

  // 前端预检：限制 10MB
  if (file.size > 10 * 1024 * 1024) {
    showFailToast('图片不能超过 10MB')
    target.value = ''
    return
  }

  uploading.value = true
  uploadMsg.value = '上传中...'
  uploadError.value = false

  try {
    const formData = new FormData()
    formData.append('file', file)

    const res = await uploadToolImage(detailTool.value.tool_id, formData)
    // 更新本地状态
    detailTool.value.image_url = res.image_url
    // 同步更新列表中对应工具的 image_url
    const idx = list.value.findIndex(t => t.tool_id === detailTool.value!.tool_id)
    if (idx > -1) list.value[idx].image_url = res.image_url

    uploadMsg.value = `上传成功 (已压缩至 ${(res.compressed_size / 1024).toFixed(0)}KB)`
    showSuccessToast('图片上传成功')
  } catch (err: any) {
    uploadError.value = true
    const msg = err.response?.data?.message || err.message || '上传失败'
    uploadMsg.value = msg
    showFailToast(msg)
  } finally {
    uploading.value = false
    target.value = ''
  }
}

async function deleteImage() {
  if (!detailTool.value) return
  uploading.value = true
  uploadMsg.value = '删除中...'
  uploadError.value = false

  try {
    // 通过更新工具清空 image_url
    await updateTool(detailTool.value.tool_id, { image_url: '' })
    detailTool.value.image_url = ''
    const idx = list.value.findIndex(t => t.tool_id === detailTool.value!.tool_id)
    if (idx > -1) list.value[idx].image_url = ''
    uploadMsg.value = ''
    showSuccessToast('图片已删除')
  } catch (err: any) {
    uploadError.value = true
    uploadMsg.value = err.response?.data?.message || '删除失败'
    showFailToast('删除失败')
  } finally {
    uploading.value = false
  }
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
  const kitTools = list.value.filter(t => t.toolkit_name === toolkitFilter.value && t.status === 'available')
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

function getKitToolCount(kitName: string) {
  return list.value.filter(t => t.toolkit_name === kitName).length
}

function openKitDetail(kitName: string) {
  selectedKit.value = kitName
  showKitDetail.value = true
}

function borrowKitAll() {
  const avail = kitDetailTools.value.filter(t => t.status === 'available')
  if (avail.length === 0) {
    showToast('该工具包中没有可用工具')
    return
  }
  avail.forEach(t => {
    cartStore.addItem({
      tool_id: t.tool_id,
      tool_name: t.tool_name,
      tool_code: t.tool_code,
      warehouse: t.warehouse || '',
      image_url: t.image_url || ''
    })
  })
  showToast(`已将"${selectedKit.value}"中 ${avail.length} 件工具加入领用篮`)
  showKitDetail.value = false
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
/* 模式切换 */
.mode-tabs {
  margin-bottom: 4px;
}

.kit-view {
  padding: 0 12px;
  min-height: 60vh;
}

.kit-detail-panel {
  padding: 0 16px 24px;
  max-height: 65vh;
  overflow-y: auto;
}

.kit-detail-actions {
  padding: 16px 0;
}

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

.scan-float {
  position: fixed;
  right: 16px;
  bottom: 148px;
  width: 56px;
  height: 56px;
  background: #07c160;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 4px 12px rgba(7,193,96,0.4);
  z-index: 100;
  cursor: pointer;
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

/* ===== 左右分区工具卡片 ===== */
.tool-card {
  display: flex;
  background: #fff;
  border-radius: 8px;
  margin: 0 12px 8px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  min-height: 88px;
}

.tool-card-left {
  flex: 1;
  display: flex;
  padding: 10px;
  min-width: 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.tool-card-left:active {
  background: #f5f5f5;
}

.tool-card-thumb {
  width: 64px;
  height: 64px;
  border-radius: 6px;
  overflow: hidden;
  background: #f7f8fa;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
}
.tool-card-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tool-card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.tool-card-title {
  font-size: 15px;
  font-weight: 600;
  color: #323233;
  line-height: 1.3;
  display: flex;
  align-items: center;
  gap: 6px;
}

.tool-card-title .status-inline {
  flex-shrink: 0;
}

.tool-card-title::after {
  content: '';
}

.tool-card-code {
  font-size: 12px;
  color: #969799;
  margin-top: 1px;
}

.tool-card-desc {
  font-size: 12px;
  color: #969799;
  margin-top: 1px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.tool-card-right {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 12px;
  min-width: 72px;
  cursor: pointer;
  border-left: 1px solid #f0f0f0;
  -webkit-tap-highlight-color: transparent;
}
.tool-card-right:active {
  background: #f0f8ff;
}

.tool-card-unavail {
  color: #969799;
  font-size: 13px;
  white-space: nowrap;
}

.tool-borrow-btn {
  flex-shrink: 0;
}

/* ===== 工具详情弹出层 ===== */
.detail-panel {
  padding: 16px 16px 32px;
  min-height: 50vh;
}

.detail-image-section {
  margin-bottom: 16px;
}

.detail-image-placeholder {
  width: 100%;
  height: 200px;
  border-radius: 8px;
  background: #f7f8fa;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #c8c9cc;
  font-size: 14px;
}

.detail-image-placeholder p {
  margin: 0;
}

/* 图片上传 */
.upload-section {
  margin-top: 16px;
  padding: 0 8px;
}

.upload-title {
  font-size: 14px;
  font-weight: 600;
  color: #323233;
  margin-bottom: 10px;
}

.upload-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.upload-msg {
  margin-top: 10px;
  font-size: 13px;
  color: #07c160;
}

.upload-msg.upload-error {
  color: #ee0a24;
}

/* 底部操作 */
.detail-actions {
  margin-top: 24px;
  padding: 0 8px;
}
</style>
