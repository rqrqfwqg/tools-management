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
        <span class="tool-count">共 {{ filteredTools.length }} 件 · 打印 {{ printPages.length }} 页</span>
        <el-button type="primary" @click="handlePrint">
          <el-icon style="margin-right:4px"><Printer /></el-icon>
          打印条形码
        </el-button>
      </div>
    </div>

    <!-- 条形码网格（屏幕浏览用） -->
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

    <!-- 打印用布局（A4 分页，3列×8行=24个/页） -->
    <div class="print-area">
      <div
        v-for="(page, pageIdx) in printPages"
        :key="pageIdx"
        class="print-page"
      >
        <div
          v-for="tool in page"
          :key="tool.tool_id"
          class="print-cell"
        >
          <svg :id="`print-barcode-${tool.tool_id}`" class="print-barcode-svg"></svg>
          <div class="print-cell-code">{{ tool.tool_code }}</div>
          <div class="print-cell-name">{{ tool.tool_name }}</div>
          <div class="print-cell-loc" v-if="tool.shelf_name || tool.location_name">
            {{ tool.shelf_name }}{{ tool.location_name ? ' ' + tool.location_name : '' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { Printer } from '@element-plus/icons-vue'
import { getTools, getWarehouses, getCategories } from '@/api'
import type { Tool } from '@/types'

// ============ A4 打印参数 ============
// A4: 210mm×297mm，页边距 10mm → 可打印 190mm×277mm
// 每个标签: 宽 62mm × 高 34mm（含间距），3列×8行 = 24个/页
const PRINT_COLS = 3
const PRINT_ROWS = 8
const ITEMS_PER_PAGE = PRINT_COLS * PRINT_ROWS // 24

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

  // 数据变更后重新渲染条形码（屏幕+打印）
  nextTick(() => {
    renderAllBarcodes()
    nextTick(() => renderPrintBarcodes())
  })
}

// ============ 打印分页 ============
const printPages = computed<Tool[][]>(() => {
  const pages: Tool[][] = []
  for (let i = 0; i < filteredTools.value.length; i += ITEMS_PER_PAGE) {
    pages.push(filteredTools.value.slice(i, i + ITEMS_PER_PAGE))
  }
  return pages.length > 0 ? pages : [[]]
})

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
  // 打印前确保打印区条形码已渲染
  renderPrintBarcodes()
  window.print()
}

// ============ 渲染打印区条形码 ============
function renderPrintBarcodes() {
  if (!JsBarcodeModule) return
  for (const tool of filteredTools.value) {
    const svgEl = document.getElementById(`print-barcode-${tool.tool_id}`)
    if (!svgEl) continue
    if (svgEl.children.length > 0) continue
    try {
      JsBarcodeModule(svgEl, tool.tool_code, {
        format: 'CODE128',
        width: 1.5,
        height: 40,
        displayValue: false,
        margin: 2
      })
    } catch (e) {
      console.warn(`打印条形码渲染失败: ${tool.tool_code}`, e)
    }
  }
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

/* ===== 打印区（屏幕上隐藏） ===== */
.print-area {
  display: none;
}
</style>

<!-- ===== 全局打印样式（A4 分页） ===== -->
<style>
@media print {
  /* 隐藏所有非打印元素 */
  .no-print,
  .el-menu,
  .el-header,
  .el-aside,
  .sidebar,
  .navbar,
  header,
  nav,
  .barcode-toolbar,
  .barcode-grid {
    display: none !important;
  }

  /* 显示打印区 */
  .print-area {
    display: block !important;
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

  /* A4 页面：每页明确分页 */
  .print-page {
    width: 100%;
    page-break-after: always;
    page-break-inside: avoid;
    break-after: page;
    break-inside: avoid;
  }

  .print-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }

  /* 每个标签：3列布局，inline-block 保证不被切断 */
  .print-cell {
    display: inline-block;
    vertical-align: top;
    width: 62mm;
    height: 33mm;
    margin: 0;
    padding: 2mm 2mm;
    box-sizing: border-box;
    border: 0.5pt solid #888;
    border-radius: 1mm;
    text-align: center;
    overflow: hidden;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* 用负 margin 消除 inline-block 间距，每行3个 */
  .print-page {
    font-size: 0; /* 消除 inline-block 空白 */
    letter-spacing: 0;
  }

  .print-cell {
    font-size: 10px; /* 重置字号 */
    margin-right: 1mm;
    margin-bottom: 1mm;
  }

  /* 每3个换行 */
  .print-cell:nth-child(3n) {
    margin-right: 0;
  }

  .print-barcode-svg {
    max-width: 100%;
    height: 38px;
  }

  .print-cell-code {
    font-size: 9pt;
    font-weight: 700;
    font-family: 'Courier New', monospace;
    margin-top: 1mm;
  }

  .print-cell-name {
    font-size: 8pt;
    color: #333;
    margin-top: 0.5mm;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .print-cell-loc {
    font-size: 7pt;
    color: #888;
  }

  @page {
    size: A4;
    margin: 8mm;
  }
}
</style>
