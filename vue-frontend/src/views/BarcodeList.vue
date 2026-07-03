<template>
  <div class="barcode-page">
    <!-- 操作栏 -->
    <div class="barcode-toolbar no-print">
      <div class="toolbar-left">
        <!-- 模式切换：工具条形码 / 工具箱条形码 -->
        <el-radio-group v-model="mode" size="default" @change="onModeChange">
          <el-radio-button value="tool">工具条形码</el-radio-button>
          <el-radio-button value="toolkit">工具箱条形码</el-radio-button>
        </el-radio-group>

        <!-- 工具模式筛选 -->
        <template v-if="mode === 'tool'">
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
        </template>

        <!-- 工具箱模式筛选 -->
        <template v-if="mode === 'toolkit'">
          <el-input
            v-model="kitKeyword"
            placeholder="搜索工具箱名称/编码"
            clearable
            style="width: 200px"
            @input="doFilter"
          />
        </template>
      </div>
      <div class="toolbar-right">
        <span class="tool-count">
          共 {{ mode === 'tool' ? filteredTools.length : filteredToolkits.length }} 件 ·
          {{ Math.max(1, Math.ceil(mode === 'tool' ? filteredTools.length / 24 : filteredToolkits.length / 10)) }} 页
        </span>
        <el-button type="primary" @click="handlePrint">
          <el-icon style="margin-right:4px"><Printer /></el-icon>
          打印条形码
        </el-button>
      </div>
    </div>

    <!-- 工具条形码网格 -->
    <div v-if="mode === 'tool' && filteredTools.length === 0" class="empty-hint">
      <el-empty description="暂无匹配工具" />
    </div>
    <div v-if="mode === 'tool' && filteredTools.length > 0" class="barcode-grid" ref="gridRef">
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

    <!-- 工具箱条形码网格 -->
    <div v-if="mode === 'toolkit' && filteredToolkits.length === 0" class="empty-hint">
      <el-empty description="暂无匹配工具箱" />
    </div>
    <div v-if="mode === 'toolkit' && filteredToolkits.length > 0" class="barcode-grid toolkit-grid" ref="kitGridRef">
      <div
        v-for="kit in filteredToolkits"
        :key="kit.toolkit_id"
        class="barcode-cell toolkit-cell"
      >
        <div class="barcode-svg-wrapper">
          <svg :id="`kit-barcode-${kit.toolkit_id}`" class="barcode-svg"></svg>
        </div>
        <div class="barcode-info">
          <div class="barcode-code">{{ kit.toolkit_code }}</div>
          <div class="barcode-name">{{ kit.toolkit_name }}</div>
          <div class="barcode-location">{{ kit.tool_count }} 件工具</div>
        </div>
      </div>
    </div>

    <!-- 打印用布局已改为新窗口生成，此处不需要 -->
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { Printer } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getTools, getWarehouses, getCategories, getToolkits } from '@/api'
import type { Tool } from '@/types'

// ============ 模式切换 ============
const mode = ref<'tool' | 'toolkit'>('tool')

// ============ 工具数据 ============
const allTools = ref<Tool[]>([])
const warehouses = ref<{ warehouse_name: string }[]>([])
const categories = ref<{ category_name: string }[]>([])

const warehouseFilter = ref('')
const categoryFilter = ref('')
const keyword = ref('')
const filteredTools = ref<Tool[]>([])
const gridRef = ref<HTMLElement | null>(null)

// ============ 工具箱数据 ============
const allToolkits = ref<any[]>([])
const kitKeyword = ref('')
const filteredToolkits = ref<any[]>([])
const kitGridRef = ref<HTMLElement | null>(null)

// ============ 筛选 ============
function doFilter() {
  if (mode.value === 'tool') {
    filterTools()
  } else {
    filterToolkits()
  }
  // 数据变更后重新渲染条形码（屏幕浏览）
  nextTick(() => renderAllBarcodes())
}

function filterTools() {
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
}

function filterToolkits() {
  let result = [...allToolkits.value]

  if (kitKeyword.value.trim()) {
    const kw = kitKeyword.value.trim().toLowerCase()
    result = result.filter(
      k =>
        k.toolkit_name.toLowerCase().includes(kw) ||
        (k.toolkit_code && k.toolkit_code.toLowerCase().includes(kw))
    )
  }

  filteredToolkits.value = result
}

function onModeChange() {
  // 切换模式时重新筛选并渲染
  doFilter()
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

  if (mode.value === 'tool') {
    for (const tool of filteredTools.value) {
      const svgEl = document.getElementById(`barcode-${tool.tool_id}`)
      if (!svgEl) continue
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
  } else {
    for (const kit of filteredToolkits.value) {
      const svgEl = document.getElementById(`kit-barcode-${kit.toolkit_id}`)
      if (!svgEl) continue
      if (svgEl.children.length > 0) continue
      try {
        JsBarcodeModule(svgEl, kit.toolkit_code, {
          format: 'CODE128',
          width: 2,
          height: 60,
          displayValue: true,
          fontSize: 14,
          margin: 10
        })
      } catch (e) {
        console.warn(`条形码渲染失败: ${kit.toolkit_code}`, e)
      }
    }
  }
}

// ============ 打印 ============
function handlePrint() {
  if (mode.value === 'tool') {
    handlePrintTools()
  } else {
    handlePrintToolkits()
  }
}

function handlePrintTools() {
  const tools = filteredTools.value
  if (tools.length === 0) return

  const ITEMS_PER_PAGE = 24 // 3列×8行
  const pages: Tool[][] = []
  for (let i = 0; i < tools.length; i += ITEMS_PER_PAGE) {
    pages.push(tools.slice(i, i + ITEMS_PER_PAGE))
  }

  const pagesHtml = pages.map((pageTools, pageIdx) => {
    const cellsHtml = pageTools.map(tool => {
      const loc = tool.shelf_name || tool.location_name
        ? `${tool.shelf_name || ''}${tool.location_name ? ' ' + tool.location_name : ''}`
        : ''
      return `<div class="cell">
        <svg class="bc" data-code="${tool.tool_code}"></svg>
        <div class="code">${tool.tool_code}</div>
        <div class="name">${escapeHtml(tool.tool_name)}</div>
        ${loc ? `<div class="loc">${escapeHtml(loc)}</div>` : ''}
      </div>`
    }).join('\n')
    return `<div class="page${pageIdx < pages.length - 1 ? ' page-break' : ''}">${cellsHtml}</div>`
  }).join('\n')

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) {
    ElMessage.warning('弹窗被拦截，请允许弹窗后重试')
    return
  }

  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>工具条形码打印 - 共 ${tools.length} 件 ${pages.length} 页</title>
<style>
  @page { size: A4; margin: 8mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, "Microsoft YaHei", sans-serif; background: #fff; }
  .page { width: 194mm; min-height: 281mm; display: flex; flex-wrap: wrap; align-content: flex-start; gap: 0; }
  .page-break { page-break-after: always; break-after: page; }
  .cell {
    width: 64mm; height: 34mm;
    border: 0.5pt solid #666;
    border-radius: 1mm;
    padding: 1.5mm 2mm;
    text-align: center;
    overflow: hidden;
    page-break-inside: avoid;
    break-inside: avoid;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    margin-right: 1mm; margin-bottom: 1mm;
  }
  .cell:nth-child(3n) { margin-right: 0; }
  .bc { max-width: 58mm; height: 16mm; }
  .code { font-size: 9pt; font-weight: 700; font-family: "Courier New", monospace; margin-top: 0.5mm; }
  .name { font-size: 7.5pt; color: #333; margin-top: 0.3mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 58mm; }
  .loc { font-size: 7pt; color: #888; }
</style></head><body>
${pagesHtml}
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
<script>
  document.querySelectorAll('.bc').forEach(function(svg) {
    var code = svg.getAttribute('data-code');
    try { JsBarcode(svg, code, { format: 'CODE128', width: 1.5, height: 50, displayValue: false, margin: 0 }); }
    catch(e) { svg.textContent = code; }
  });
  setTimeout(function() { window.print(); }, 800);
<\/script>
</body></html>`)
  win.document.close()
}

function handlePrintToolkits() {
  const toolkits = filteredToolkits.value
  if (toolkits.length === 0) return

  const ITEMS_PER_PAGE = 10 // 2列×5行
  const pages: any[][] = []
  for (let i = 0; i < toolkits.length; i += ITEMS_PER_PAGE) {
    pages.push(toolkits.slice(i, i + ITEMS_PER_PAGE))
  }

  const pagesHtml = pages.map((pageKits, pageIdx) => {
    const cellsHtml = pageKits.map(kit => {
      return `<div class="cell">
        <svg class="bc" data-code="${kit.toolkit_code}"></svg>
        <div class="code">${kit.toolkit_code}</div>
        <div class="name">${escapeHtml(kit.toolkit_name)}</div>
        <div class="loc">${kit.tool_count} 件工具</div>
      </div>`
    }).join('\n')
    return `<div class="page${pageIdx < pages.length - 1 ? ' page-break' : ''}">${cellsHtml}</div>`
  }).join('\n')

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) {
    ElMessage.warning('弹窗被拦截，请允许弹窗后重试')
    return
  }

  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>工具箱条形码打印 - 共 ${toolkits.length} 箱 ${pages.length} 页</title>
<style>
  @page { size: A4; margin: 8mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, "Microsoft YaHei", sans-serif; background: #fff; }
  .page { width: 194mm; min-height: 281mm; display: flex; flex-wrap: wrap; align-content: flex-start; gap: 0; }
  .page-break { page-break-after: always; break-after: page; }
  .cell {
    width: 96mm; height: 52mm;
    border: 0.5pt solid #666;
    border-radius: 1mm;
    padding: 2mm 3mm;
    text-align: center;
    overflow: hidden;
    page-break-inside: avoid;
    break-inside: avoid;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    margin-right: 1mm; margin-bottom: 1mm;
  }
  .cell:nth-child(2n) { margin-right: 0; }
  .bc { max-width: 88mm; height: 20mm; }
  .code { font-size: 11pt; font-weight: 700; font-family: "Courier New", monospace; margin-top: 0.5mm; }
  .name { font-size: 9pt; color: #333; margin-top: 0.5mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 88mm; }
  .loc { font-size: 8pt; color: #888; }
</style></head><body>
${pagesHtml}
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
<script>
  document.querySelectorAll('.bc').forEach(function(svg) {
    var code = svg.getAttribute('data-code');
    try { JsBarcode(svg, code, { format: 'CODE128', width: 2, height: 60, displayValue: false, margin: 0 }); }
    catch(e) { svg.textContent = code; }
  });
  setTimeout(function() { window.print(); }, 800);
<\/script>
</body></html>`)
  win.document.close()
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ============ 加载 ============
onMounted(async () => {
  try {
    const [tools, whs, cats, kits] = await Promise.all([
      getTools(),
      getWarehouses(),
      getCategories(),
      getToolkits()
    ])
    allTools.value = tools
    warehouses.value = whs
    categories.value = cats
    allToolkits.value = kits

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

/* 工具箱条形码用更宽的卡片，2列布局 */
.toolkit-grid {
  grid-template-columns: repeat(4, 1fr);
}

@media (max-width: 1400px) {
  .barcode-grid {
    grid-template-columns: repeat(4, 1fr);
  }
  .toolkit-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 1100px) {
  .barcode-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  .toolkit-grid {
    grid-template-columns: repeat(2, 1fr);
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

/* 工具箱卡片稍大 */
.toolkit-cell {
  padding: 20px 16px 16px;
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

/* ===== 打印区已改为新窗口生成，此处不需要 ===== */
</style>
