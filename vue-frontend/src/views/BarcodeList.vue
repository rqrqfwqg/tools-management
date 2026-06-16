<template>
  <div class="barcode-page">
    <!-- 操作栏 -->
    <div class="barcode-toolbar no-print">
      <div class="toolbar-left">
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
            v-for="cat in categories"
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
        <span class="tool-count">共 {{ filteredTools.length }} 件</span>
        <el-button type="primary" @click="handlePrint">
          <el-icon style="margin-right:4px"><Printer /></el-icon>
          打印条形码
        </el-button>
      </div>
    </div>

    <!-- 条形码网格 -->
    <div v-if="filteredTools.length === 0" class="empty-hint">
      <el-empty description="暂无匹配工具" />
    </div>
    <div v-else class="barcode-grid" ref="gridRef">
      <div
        v-for="tool in filteredTools"
        :key="tool.tool_id"
        class="barcode-cell"
      >
        <div class="barcode-svg-wrapper">
          <svg :id="`barcode-${tool.tool_id}`" class="barcode-svg"></svg>
        </div>
        <div class="barcode-info">
          <div class="barcode-code">{{ tool.tool_code }}</div>
          <div class="barcode-name">{{ tool.tool_name }}</div>
          <div class="barcode-location" v-if="tool.shelf_name || tool.location_name">
            {{ tool.shelf_name }}{{ tool.location_name ? ' ' + tool.location_name : '' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import { Printer } from '@element-plus/icons-vue'
import { getTools, getWarehouses, getCategories } from '@/api'
import type { Tool } from '@/types'

// ============ 数据 ============
const allTools = ref<Tool[]>([])
const warehouses = ref<{ warehouse_name: string }[]>([])
const categories = ref<{ category_name: string }[]>([])

const warehouseFilter = ref('')
const categoryFilter = ref('')
const keyword = ref('')
const filteredTools = ref<Tool[]>([])
const gridRef = ref<HTMLElement | null>(null)

// ============ 筛选 ============
function doFilter() {
  let result = [...allTools.value]

  if (warehouseFilter.value) {
    result = result.filter(t => t.warehouse === warehouseFilter.value)
  }
  if (categoryFilter.value) {
    result = result.filter(t => t.category_name === categoryFilter.value)
  }
  if (keyword.value.trim()) {
    const kw = keyword.value.trim().toLowerCase()
    result = result.filter(
      t =>
        t.tool_name.toLowerCase().includes(kw) ||
        t.tool_code.toLowerCase().includes(kw)
    )
  }

  filteredTools.value = result

  // 数据变更后重新渲染条形码
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
  for (const tool of filteredTools.value) {
    const svgEl = document.getElementById(`barcode-${tool.tool_id}`)
    if (!svgEl) continue
    // 已渲染过则跳过（防止重复渲染撕裂）
    if (svgEl.children.length > 0) continue
    try {
      JsBarcodeModule(svgEl, tool.tool_code, {
        format: 'CODE128',
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 12,
        margin: 10
      })
    } catch (e) {
      console.warn(`条形码渲染失败: ${tool.tool_code}`, e)
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
    const [tools, whs, cats] = await Promise.all([
      getTools(),
      getWarehouses(),
      getCategories()
    ])
    allTools.value = tools
    warehouses.value = whs
    categories.value = cats

    // 加载 JsBarcode 并首次渲染
    await loadJsBarcode()

    doFilter()
  } catch (e) {
    console.error('加载条形码数据失败', e)
  }
})
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
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
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
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
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
  /* 隐藏侧边栏、顶栏、工具栏 */
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

  /* 页面背景 */
  body {
    background: #fff !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .barcode-page {
    padding: 0 !important;
    background: #fff !important;
  }

  /* A4 适配：5列网格 */
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
