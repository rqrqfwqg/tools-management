<template>
  <div class="barcode-page">
    <!-- 操作栏 -->
    <div class="barcode-toolbar no-print">
      <div class="toolbar-left">
        <el-radio-group v-model="mode" @change="doFilter">
          <el-radio-button label="工具" value="tools" />
          <el-radio-button label="备件" value="spare" />
          <el-radio-button label="消耗品" value="consumable" />
        </el-radio-group>
        <el-select
          v-model="warehouseFilter"
          placeholder="全部仓库"
          clearable
          style="width: 180px"
          @change="doFilter"
        >
          <el-option label="全部仓库" value="" />
          <el-option
            v-for="wh in warehouses"
            :key="wh.warehouse_name"
            :label="wh.warehouse_name"
            :value="wh.warehouse_name"
          />
        </el-select>
        <el-select
          v-model="categoryFilter"
          placeholder="全部分类"
          clearable
          style="width: 180px"
          @change="doFilter"
        >
          <el-option label="全部分类" value="" />
          <el-option
            v-for="cat in categoryOptions"
            :key="cat.category_name"
            :label="cat.category_name"
            :value="cat.category_name"
          />
        </el-select>
        <el-input
          v-model="keyword"
          placeholder="搜索名称/编码"
          clearable
          style="width: 200px"
          @input="doFilter"
        />
      </div>
      <div class="toolbar-right">
        <span class="tool-count">共 {{ filteredItems.length }} 件</span>
        <el-button type="primary" @click="handlePrint">
          <el-icon style="margin-right:4px"><Printer /></el-icon>
          打印条形码
        </el-button>
      </div>
    </div>

    <!-- 条形码网格 -->
    <div v-if="filteredItems.length === 0" class="empty-hint">
      <el-empty description="暂无匹配数据" />
    </div>
    <div v-else class="barcode-grid" ref="gridRef">
      <div
        v-for="item in filteredItems"
        :key="item.mode + '-' + item.id"
        class="barcode-cell"
      >
        <div class="barcode-svg-wrapper">
          <svg :id="`barcode-${item.mode}-${item.id}`" class="barcode-svg"></svg>
        </div>
        <div class="barcode-info">
          <div class="barcode-code">{{ item.code }}</div>
          <div class="barcode-name">{{ item.name }}</div>
          <div class="barcode-location" v-if="item.shelf_name || item.location_name">
            {{ item.shelf_name }}{{ item.location_name ? ' ' + item.location_name : '' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { Printer } from '@element-plus/icons-vue'
import { getTools, getWarehouses, getCategories, getMaterialCategories, getSpareParts, getConsumables } from '@/api'

// ============ 数据 ============
const mode = ref<'tools' | 'spare' | 'consumable'>('tools')
const allTools = ref<any[]>([])
const allSpares = ref<any[]>([])
const allConsumables = ref<any[]>([])
const warehouses = ref<{ warehouse_name: string }[]>([])
const toolCategories = ref<{ category_name: string }[]>([])
const materialCategories = ref<{ category_name: string }[]>([])

const warehouseFilter = ref('')
const categoryFilter = ref('')
const keyword = ref('')
const filteredItems = ref<any[]>([])
const gridRef = ref<HTMLElement | null>(null)

const categoryOptions = computed(() =>
  mode.value === 'tools' ? toolCategories.value : materialCategories.value
)

// 将不同数据源统一为 { id, mode, code, name, warehouse, shelf_name, location_name }
function normalize() {
  const tools = allTools.value.map((t: any) => ({
    id: t.tool_id, mode: 'tools', code: t.tool_code, name: t.tool_name,
    warehouse: t.warehouse || '', shelf_name: t.shelf_name || '', location_name: t.location_name || ''
  }))
  const spares = allSpares.value.map((s: any) => ({
    id: s.spare_id, mode: 'spare', code: s.spare_code, name: s.spare_name,
    warehouse: s.warehouse_name || '', shelf_name: s.shelf_name || '', location_name: s.location_name || ''
  }))
  const consumables = allConsumables.value.map((c: any) => ({
    id: c.consumable_id, mode: 'consumable', code: c.consumable_code, name: c.consumable_name,
    warehouse: c.warehouse_name || '', shelf_name: c.shelf_name || '', location_name: c.location_name || ''
  }))
  if (mode.value === 'spare') return spares
  if (mode.value === 'consumable') return consumables
  return tools
}

// ============ 筛选 ============
function doFilter() {
  let result = normalize()

  if (warehouseFilter.value) {
    result = result.filter(t => t.warehouse === warehouseFilter.value)
  }
  if (categoryFilter.value) {
    // 分类信息未纳入统一结构，按原集合过滤后重新归一化
    if (mode.value === 'tools') {
      const ids = allTools.value.filter((t: any) => t.category_name === categoryFilter.value).map((t: any) => t.tool_id)
      result = result.filter(t => ids.includes(t.id))
    } else if (mode.value === 'spare') {
      const ids = allSpares.value.filter((s: any) => s.category_name === categoryFilter.value).map((s: any) => s.spare_id)
      result = result.filter(t => ids.includes(t.id))
    } else {
      const ids = allConsumables.value.filter((c: any) => c.category_name === categoryFilter.value).map((c: any) => c.consumable_id)
      result = result.filter(t => ids.includes(t.id))
    }
  }
  if (keyword.value.trim()) {
    const kw = keyword.value.trim().toLowerCase()
    result = result.filter(t => t.name.toLowerCase().includes(kw) || t.code.toLowerCase().includes(kw))
  }

  filteredItems.value = result
  nextTick(() => renderAllBarcodes())
}

// ============ 条形码渲染 ============
let JsBarcodeModule: any = null

async function loadJsBarcode() {
  if (JsBarcodeModule) return JsBarcodeModule
  const mod = await import('jsbarcode')
  JsBarcodeModule = mod.default || mod
  return JsBarcodeModule
}

function renderAllBarcodes() {
  if (!JsBarcodeModule) return
  for (const item of filteredItems.value) {
    const svgEl = document.getElementById(`barcode-${item.mode}-${item.id}`)
    if (!svgEl) continue
    if (svgEl.children.length > 0) continue
    try {
      JsBarcodeModule(svgEl, item.code, {
        format: 'CODE128',
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 12,
        margin: 10
      })
    } catch (e) {
      console.warn(`条形码渲染失败: ${item.code}`, e)
    }
  }
}

// ============ 打印 ============
function handlePrint() {
  window.print()
}

// ============ 加载 ============
onMounted(async () => {
  try {
    const [tools, whs, cats, mcats, spares, consumables] = await Promise.all([
      getTools(),
      getWarehouses(),
      getCategories(),
      getMaterialCategories(),
      getSpareParts(),
      getConsumables()
    ])
    allTools.value = tools
    warehouses.value = whs
    toolCategories.value = cats
    materialCategories.value = mcats
    allSpares.value = spares
    allConsumables.value = consumables

    await loadJsBarcode()
    doFilter()
  } catch (e) {
    console.error('加载条形码数据失败', e)
  }
})

// 切换模式时清空原分类筛选
watch(mode, () => { categoryFilter.value = '' })
</script>

<style scoped>
/* ===== 页面布局 ===== */
.barcode-page {
  padding: 16px 20px 40px;
  min-height: calc(100vh - 80px);
  background: #f5f7fa;
}

/* ===== 工具栏 ===== */
.barcode-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
  padding: 12px 16px;
  background: #fff;
  border-radius: 8px;
  box-shadow:0 1px 4px rgba(0, 0, 0, 0.06);
}

.toolbar-left {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tool-count {
  font-size: 14px;
  color: #909399;
}

/* ===== 空状态 ===== */
.empty-hint {
  display: flex;
  justify-content: center;
  padding-top: 60px;
}

/* ===== 网格 ===== */
.barcode-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
}

@media (max-width: 1400px) {
  .barcode-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
@media (max-width: 1100px) {
  .barcode-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 800px) {
  .barcode-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.barcode-cell {
  background: #fff;
  border-radius: 8px;
  padding: 16px 12px 12px;
  box-shadow:0 1px 4px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  align-items: center;
  page-break-inside: avoid;
}

.barcode-svg-wrapper {
  width: 100%;
  display: flex;
  justify-content: center;
  overflow: hidden;
}

.barcode-svg {
  max-width: 100%;
}

.barcode-info {
  width: 100%;
  text-align: center;
  margin-top: 6px;
}

.barcode-code {
  font-size: 13px;
  font-weight: 700;
  color: #303133;
  font-family: 'Courier New', monospace;
}

.barcode-name {
  font-size: 12px;
  color: #606266;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.barcode-location {
  font-size: 11px;
  color: #909399;
  margin-top: 1px;
}
</style>

<!-- ===== 全局打印样式 ===== -->
<style>
@media print {
  .no-print,
  .el-menu,
  .el-header,
  .el-aside,
  .sidebar,
  .navbar,
  header,
  nav,
  .barcode-toolbar {
    display: none !important;
  }

  body {
    background: #fff !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .barcode-page {
    padding: 0 !important;
    background: #fff !important;
  }

  .barcode-grid {
    display: grid !important;
    grid-template-columns: repeat(5, 1fr) !important;
    gap: 10px !important;
    padding: 8mm 10mm !important;
  }

  .barcode-cell {
    box-shadow: none !important;
    border: 1px solid #e0e0e0;
    padding: 10px 8px 8px !important;
    page-break-inside: avoid;
  }

  .barcode-code {
    font-size: 11px !important;
  }

  .barcode-name {
    font-size: 10px !important;
  }

  .barcode-location {
    font-size: 9px !important;
  }

  @page {
    size: A4;
    margin: 8mm;
  }
}
</style>
