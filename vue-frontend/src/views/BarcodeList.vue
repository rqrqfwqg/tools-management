<template>
  <div class="barcode-page">
    <!-- 操作栏 -->
    <div class="barcode-toolbar no-print">
      <div class="toolbar-left">
        <!-- 模式切换：工具 / 工具箱 / 备件 / 消耗品 条形码 -->
        <el-radio-group v-model="mode" size="default" @change="onModeChange">
          <el-radio-button value="tool">工具条形码</el-radio-button>
          <el-radio-button value="toolkit">工具箱条形码</el-radio-button>
          <el-radio-button value="spare">备件条形码</el-radio-button>
          <el-radio-button value="consumable">消耗品条形码</el-radio-button>
        </el-radio-group>

        <!-- 工具 / 备件 / 消耗品 模式筛选 -->
        <template v-if="mode === 'tool' || mode === 'spare' || mode === 'consumable'">
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
        </template>

        <!-- 工具箱模式筛选 -->
        <template v-if="mode === 'toolkit'">
          <el-input
            v-model="kitKeyword"
            placeholder="搜索工具箱名称/编码"
            clearable
            style="width: 220px"
            @input="doFilter"
          />
        </template>
      </div>
      <div class="toolbar-right">
        <span class="tool-count">
          共 {{ filteredCount }} 件 · {{ pageCount }} 页
        </span>
        <span class="tool-count selected-count">已选 {{ selectedCountInMode }} 项</span>
        <el-button size="small" @click="selectAllInMode">全选</el-button>
        <el-button size="small" @click="clearAllInMode">取消全选</el-button>
        <el-select
          v-model="shelfSelect"
          placeholder="按货架批量选"
          clearable
          size="small"
          style="width: 160px"
          @change="selectByShelf"
        >
          <el-option
            v-for="opt in shelfOptionsInMode"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
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
    <div v-if="mode === 'tool' && filteredTools.length > 0" class="barcode-grid" :key="`grid-${mode}`">
      <div v-for="tool in filteredTools" :key="tool.tool_id" class="barcode-cell">
        <el-checkbox
          class="cell-check"
          :model-value="isSelected(currentType, tool.tool_id)"
          @change="toggleSelect(currentType, tool.tool_id)"
        />
        <div class="barcode-svg-wrapper">
          <svg :id="`barcode-tool-${tool.tool_id}`" class="barcode-svg"></svg>
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
    <div v-if="mode === 'toolkit' && filteredToolkits.length > 0" class="barcode-grid toolkit-grid" :key="`grid-${mode}`">
      <div v-for="kit in filteredToolkits" :key="kit.toolkit_id" class="barcode-cell toolkit-cell">
        <el-checkbox
          class="cell-check"
          :model-value="isSelected(currentType, kit.toolkit_id)"
          @change="toggleSelect(currentType, kit.toolkit_id)"
        />
        <div class="barcode-svg-wrapper">
          <svg :id="`barcode-toolkit-${kit.toolkit_id}`" class="barcode-svg"></svg>
        </div>
        <div class="barcode-info">
          <div class="barcode-code">{{ kit.toolkit_code }}</div>
          <div class="barcode-name">{{ kit.toolkit_name }}</div>
          <div class="barcode-location">{{ kit.tool_count }} 件工具</div>
        </div>
      </div>
    </div>

    <!-- 备件条形码网格 -->
    <div v-if="mode === 'spare' && filteredSpares.length === 0" class="empty-hint">
      <el-empty description="暂无匹配备件" />
    </div>
    <div v-if="mode === 'spare' && filteredSpares.length > 0" class="barcode-grid" :key="`grid-${mode}`">
      <div v-for="s in filteredSpares" :key="s.spare_id" class="barcode-cell">
        <el-checkbox
          class="cell-check"
          :model-value="isSelected(currentType, s.spare_id)"
          @change="toggleSelect(currentType, s.spare_id)"
        />
        <div class="barcode-svg-wrapper">
          <svg :id="`barcode-spare-${s.spare_id}`" class="barcode-svg"></svg>
        </div>
        <div class="barcode-info">
          <div class="barcode-code">{{ s.spare_code }}</div>
          <div class="barcode-name">{{ s.spare_name }}</div>
          <div class="barcode-location" v-if="s.shelf_name || s.location_name">
            {{ s.shelf_name }}{{ s.location_name ? ' ' + s.location_name : '' }}
          </div>
        </div>
      </div>
    </div>

    <!-- 消耗品条形码网格 -->
    <div v-if="mode === 'consumable' && filteredConsumables.length === 0" class="empty-hint">
      <el-empty description="暂无匹配消耗品" />
    </div>
    <div v-if="mode === 'consumable' && filteredConsumables.length > 0" class="barcode-grid" :key="`grid-${mode}`">
      <div v-for="c in filteredConsumables" :key="c.consumable_id" class="barcode-cell">
        <el-checkbox
          class="cell-check"
          :model-value="isSelected(currentType, c.consumable_id)"
          @change="toggleSelect(currentType, c.consumable_id)"
        />
        <div class="barcode-svg-wrapper">
          <svg :id="`barcode-consumable-${c.consumable_id}`" class="barcode-svg"></svg>
        </div>
        <div class="barcode-info">
          <div class="barcode-code">{{ c.consumable_code }}</div>
          <div class="barcode-name">{{ c.consumable_name }}</div>
          <div class="barcode-location" v-if="c.shelf_name || c.location_name">
            {{ c.shelf_name }}{{ c.location_name ? ' ' + c.location_name : '' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { Printer } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  getTools,
  getWarehouses,
  getCategories,
  getToolkits,
  getMaterialCategories,
  getSpareParts,
  getConsumables
} from '@/api'
import type { Tool } from '@/types'

// ============ 模式切换 ============
const mode = ref<'tool' | 'toolkit' | 'spare' | 'consumable'>('tool')

// 当前模式（用于模板中复选框 / 选择逻辑的 type 键）
const currentType = computed(() => mode.value)

// ============ 数据 ============
const allTools = ref<Tool[]>([])
const allToolkits = ref<any[]>([])
const allSpares = ref<any[]>([])
const allConsumables = ref<any[]>([])

const warehouses = ref<{ warehouse_name: string }[]>([])
const categories = ref<{ category_name: string }[]>([]) // 工具分类
const materialCategories = ref<{ category_name: string }[]>([]) // 备件/消耗品分类

// 筛选条件
const warehouseFilter = ref('')
const categoryFilter = ref('')
const keyword = ref('')
const kitKeyword = ref('')

// 各模式结果集
const filteredTools = ref<Tool[]>([])
const filteredToolkits = ref<any[]>([])
const filteredSpares = ref<any[]>([])
const filteredConsumables = ref<any[]>([])

// ============ 派生 ============
const categoryOptions = computed(() => {
  if (mode.value === 'tool') return categories.value
  return materialCategories.value
})

const PAGE_SIZE: Record<string, number> = { tool: 24, toolkit: 10, spare: 24, consumable: 24 }

const filteredCount = computed(() => {
  switch (mode.value) {
    case 'tool': return filteredTools.value.length
    case 'toolkit': return filteredToolkits.value.length
    case 'spare': return filteredSpares.value.length
    case 'consumable': return filteredConsumables.value.length
    default: return 0
  }
})

const pageCount = computed(() =>
  Math.max(1, Math.ceil(filteredCount.value / (PAGE_SIZE[mode.value] || 24)))
)

// ============ 条形码可选打印：选中状态 ============
// 选中键集合，键格式：`${type}:${id}`
const selectedKeys = ref<Set<string>>(new Set())

// 记录用户「主动取消」的键；被记入此集合的项在后续自动全选（筛选/模式切换后）
// 时不会被重新勾回，直到用户显式选中（全选 / 按货架选 / 手动勾选）。
const explicitlyUnselected = ref<Set<string>>(new Set())

// 由于 Vue 对 Set 的响应式：每次变更后必须重新赋值触发更新
function selKey(type: string, id: string | number): string {
  return `${type}:${id}`
}

// 当前模式下可见（已筛选）的列表
function itemsInMode(): any[] {
  switch (mode.value) {
    case 'tool': return filteredTools.value
    case 'toolkit': return filteredToolkits.value
    case 'spare': return filteredSpares.value
    case 'consumable': return filteredConsumables.value
    default: return []
  }
}

// 取当前模式下某条目的 id 字段
function getIdOf(item: any): string {
  switch (mode.value) {
    case 'tool': return String(item.tool_id)
    case 'toolkit': return String(item.toolkit_id)
    case 'spare': return String(item.spare_id)
    case 'consumable': return String(item.consumable_id)
    default: return ''
  }
}

// 取某条目的货架名（备件/消耗品/工具用 shelf_name 或 location_name）
function getShelfOf(item: any): string {
  return item?.shelf_name || item?.location_name || ''
}

function isSelected(type: string, id: string | number): boolean {
  return selectedKeys.value.has(selKey(type, id))
}

// 切换某条目的勾选状态：
// - 若当前已选中 → 取消选中，并把该键记入 explicitlyUnselected（主动取消）
// - 若当前未选中 → 选中，并从 explicitlyUnselected 移除（主动选中）
// 每次变更后均重新赋值以触发响应式
function toggleSelect(type: string, id: string | number) {
  const key = selKey(type, id)
  const sel = new Set(selectedKeys.value)
  const un = new Set(explicitlyUnselected.value)
  if (sel.has(key)) {
    sel.delete(key)
    un.add(key)
  } else {
    sel.add(key)
    un.delete(key)
  }
  selectedKeys.value = sel
  explicitlyUnselected.value = un
}

// 对当前 mode 的 filtered 列表全选；同时把这些键从 explicitlyUnselected 移除
// （因为它们现在是「显式选中」，不应再被视为主动取消）
function selectAllInMode() {
  const next = new Set(selectedKeys.value)
  const un = new Set(explicitlyUnselected.value)
  for (const item of itemsInMode()) {
    const key = selKey(currentType.value, getIdOf(item))
    next.add(key)
    un.delete(key)
  }
  selectedKeys.value = next
  explicitlyUnselected.value = un
}

// 对当前 mode 的 filtered 列表全清；同时把这些键加入 explicitlyUnselected，
// 之后 ensureAllVisibleSelected 不会再把它们自动勾回
function clearAllInMode() {
  const next = new Set(selectedKeys.value)
  const un = new Set(explicitlyUnselected.value)
  for (const item of itemsInMode()) {
    const key = selKey(currentType.value, getIdOf(item))
    next.delete(key)
    un.add(key)
  }
  selectedKeys.value = next
  explicitlyUnselected.value = un
}

// 把当前 mode filtered 列表中指定货架（shelf_name 或 location_name）的项加入选中，
// 并从 explicitlyUnselected 移除这些键（显式选中）
function selectByShelf(shelf: string) {
  if (!shelf) return
  const next = new Set(selectedKeys.value)
  const un = new Set(explicitlyUnselected.value)
  for (const item of itemsInMode()) {
    if (getShelfOf(item) === shelf) {
      const key = selKey(currentType.value, getIdOf(item))
      next.add(key)
      un.delete(key)
    }
  }
  selectedKeys.value = next
  explicitlyUnselected.value = un
  shelfSelect.value = '' // 选中后重置下拉，便于连续按货架批量选
}

// 当前模式按货架批量选所用的去重货架名
const shelfOptionsInMode = computed(() => {
  const set = new Set<string>()
  for (const item of itemsInMode()) {
    const s = getShelfOf(item)
    if (s) set.add(s)
  }
  return Array.from(set).map(s => ({ label: s, value: s }))
})

// 当前模式已选中数量
const selectedCountInMode = computed(() => {
  let count = 0
  for (const item of itemsInMode()) {
    if (isSelected(currentType.value, getIdOf(item))) count++
  }
  return count
})

// 按货架批量选下拉框的绑定值
const shelfSelect = ref('')

// 默认行为：可见即默认选中，但跳过被用户「主动取消」的键（explicitlyUnselected）。
// 不动 explicitlyUnselected 集合本身，仅决定 selectedKeys 是否补齐该项。
function ensureAllVisibleSelected() {
  const next = new Set(selectedKeys.value)
  for (const item of itemsInMode()) {
    const key = selKey(currentType.value, getIdOf(item))
    if (!explicitlyUnselected.value.has(key)) {
      next.add(key)
    }
  }
  selectedKeys.value = next
}

// ============ 筛选 ============
function doFilter() {
  switch (mode.value) {
    case 'tool': filterTools(); break
    case 'toolkit': filterToolkits(); break
    case 'spare': filterSpares(); break
    case 'consumable': filterConsumables(); break
  }
  nextTick(() => {
    renderAllBarcodes()
    // 默认把当前模式所有可见项加入选中，兼容旧的「打印全部」习惯
    ensureAllVisibleSelected()
  })
}

function filterTools() {
  let result = [...allTools.value]
  if (warehouseFilter.value) result = result.filter(t => t.warehouse === warehouseFilter.value)
  if (categoryFilter.value) result = result.filter(t => t.category_name === categoryFilter.value)
  if (keyword.value.trim()) {
    const kw = keyword.value.trim().toLowerCase()
    result = result.filter(
      t => t.tool_name.toLowerCase().includes(kw) || t.tool_code.toLowerCase().includes(kw)
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

function filterSpares() {
  let result = [...allSpares.value]
  if (warehouseFilter.value) result = result.filter(s => s.warehouse_name === warehouseFilter.value)
  if (categoryFilter.value) result = result.filter(s => s.category_name === categoryFilter.value)
  if (keyword.value.trim()) {
    const kw = keyword.value.trim().toLowerCase()
    result = result.filter(
      s => s.spare_name.toLowerCase().includes(kw) || s.spare_code.toLowerCase().includes(kw)
    )
  }
  filteredSpares.value = result
}

function filterConsumables() {
  let result = [...allConsumables.value]
  if (warehouseFilter.value) result = result.filter(c => c.warehouse_name === warehouseFilter.value)
  if (categoryFilter.value) result = result.filter(c => c.category_name === categoryFilter.value)
  if (keyword.value.trim()) {
    const kw = keyword.value.trim().toLowerCase()
    result = result.filter(
      c => c.consumable_name.toLowerCase().includes(kw) || c.consumable_code.toLowerCase().includes(kw)
    )
  }
  filteredConsumables.value = result
}

function onModeChange() {
  // 切换模式时先同步清空筛选条件（warehouse/category/keyword/kitKeyword），
  // 再重新筛选并渲染。这样 doFilter 一定在筛选已清空后执行，避免读到旧模式的旧值
  // （watch(mode) 的清空属于 pre-flush 回调，会在同步 change 事件之后才执行，作为兜底）。
  warehouseFilter.value = ''
  categoryFilter.value = ''
  keyword.value = ''
  kitKeyword.value = ''
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

function renderBarcode(id: string, code: string, fontSize = 12) {
  const svgEl = document.getElementById(id)
  if (!svgEl) return
  // 绘制前先清空 SVG，保证 SVG 永远反映「当前」code，杜绝模式切换/筛选时的串码残留
  while (svgEl.firstChild) {
    svgEl.removeChild(svgEl.firstChild)
  }
  try {
    JsBarcodeModule(svgEl, code, {
      format: 'CODE128',
      width: 2,
      height: 60,
      displayValue: true,
      fontSize,
      margin: 10
    })
  } catch (e) {
    console.warn(`条形码渲染失败: ${code}`, e)
  }
}

function renderAllBarcodes() {
  if (!JsBarcodeModule) return
  if (mode.value === 'tool') {
    for (const tool of filteredTools.value) {
      renderBarcode(`barcode-tool-${tool.tool_id}`, tool.tool_code)
    }
  } else if (mode.value === 'toolkit') {
    for (const kit of filteredToolkits.value) {
      renderBarcode(`barcode-toolkit-${kit.toolkit_id}`, kit.toolkit_code, 14)
    }
  } else if (mode.value === 'spare') {
    for (const s of filteredSpares.value) {
      renderBarcode(`barcode-spare-${s.spare_id}`, s.spare_code)
    }
  } else if (mode.value === 'consumable') {
    for (const c of filteredConsumables.value) {
      renderBarcode(`barcode-consumable-${c.consumable_id}`, c.consumable_code)
    }
  }
}

// ============ 打印 ============
function handlePrint() {
  // 当前模式未勾选任何项时，给出提示并不弹窗
  if (selectedCountInMode.value === 0) {
    ElMessage.warning('请先勾选要打印的条形码')
    return
  }
  switch (mode.value) {
    case 'tool': handlePrintTools(); break
    case 'toolkit': handlePrintToolkits(); break
    case 'spare': handlePrintSpares(); break
    case 'consumable': handlePrintConsumables(); break
  }
}

// 通用打印：工具 / 备件 / 消耗品 共用 A4 标签布局（3列 × 8行）
function buildPrintHtml(
  title: string,
  items: { code: string; name: string; loc: string }[],
  perPage = 24,
  cellW = '64mm',
  cellH = '34mm',
  cols = 3
) {
  if (items.length === 0) return
  const pages: { code: string; name: string; loc: string }[][] = []
  for (let i = 0; i < items.length; i += perPage) {
    pages.push(items.slice(i, i + perPage))
  }

  const pagesHtml = pages
    .map((pageItems, pageIdx) => {
      const cellsHtml = pageItems
        .map(
          it => `<div class="cell">
        <svg class="bc" data-code="${it.code}"></svg>
        <div class="code">${it.code}</div>
        <div class="name">${escapeHtml(it.name)}</div>
        ${it.loc ? `<div class="loc">${escapeHtml(it.loc)}</div>` : ''}
      </div>`
        )
        .join('\n')
      return `<div class="page${pageIdx < pages.length - 1 ? ' page-break' : ''}">${cellsHtml}</div>`
    })
    .join('\n')

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) {
    ElMessage.warning('弹窗被拦截，请允许弹窗后重试')
    return
  }

  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${title}</title>
<style>
  @page { size: A4; margin: 8mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, "Microsoft YaHei", sans-serif; background: #fff; }
  .page { width: 194mm; min-height: 281mm; display: flex; flex-wrap: wrap; align-content: flex-start; gap: 0; }
  .page-break { page-break-after: always; break-after: page; }
  .cell {
    width: ${cellW}; height: ${cellH};
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
  .cell:nth-child(${cols}n) { margin-right: 0; }
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

function handlePrintTools() {
  const items = filteredTools.value
    .filter(t => isSelected('tool', t.tool_id))
    .map(t => ({
      code: t.tool_code,
      name: t.tool_name,
      loc: t.shelf_name || t.location_name
        ? `${t.shelf_name || ''}${t.location_name ? ' ' + t.location_name : ''}`
        : ''
    }))
  buildPrintHtml(`工具条形码打印 - 共 ${items.length} 件 ${pageCount.value} 页`, items)
}

function handlePrintSpares() {
  const items = filteredSpares.value
    .filter(s => isSelected('spare', s.spare_id))
    .map(s => ({
      code: s.spare_code,
      name: s.spare_name,
      loc: s.shelf_name || s.location_name
        ? `${s.shelf_name || ''}${s.location_name ? ' ' + s.location_name : ''}`
        : ''
    }))
  buildPrintHtml(`备件条形码打印 - 共 ${items.length} 件 ${pageCount.value} 页`, items)
}

function handlePrintConsumables() {
  const items = filteredConsumables.value
    .filter(c => isSelected('consumable', c.consumable_id))
    .map(c => ({
      code: c.consumable_code,
      name: c.consumable_name,
      loc: c.shelf_name || c.location_name
        ? `${c.shelf_name || ''}${c.location_name ? ' ' + c.location_name : ''}`
        : ''
    }))
  buildPrintHtml(`消耗品条形码打印 - 共 ${items.length} 件 ${pageCount.value} 页`, items)
}

function handlePrintToolkits() {
  const toolkits = filteredToolkits.value.filter(k => isSelected('toolkit', k.toolkit_id))
  if (toolkits.length === 0) return

  const ITEMS_PER_PAGE = 10 // 2列×5行
  const pages: any[][] = []
  for (let i = 0; i < toolkits.length; i += ITEMS_PER_PAGE) {
    pages.push(toolkits.slice(i, i + ITEMS_PER_PAGE))
  }

  const pagesHtml = pages
    .map((pageKits, pageIdx) => {
      const cellsHtml = pageKits
        .map(
          kit => `<div class="cell">
        <svg class="bc" data-code="${kit.toolkit_code}"></svg>
        <div class="code">${kit.toolkit_code}</div>
        <div class="name">${escapeHtml(kit.toolkit_name)}</div>
        <div class="loc">${kit.tool_count} 件工具</div>
      </div>`
        )
        .join('\n')
      return `<div class="page${pageIdx < pages.length - 1 ? ' page-break' : ''}">${cellsHtml}</div>`
    })
    .join('\n')

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) {
    ElMessage.warning('弹窗被拦截，请允许弹窗后重试')
    return
  }

  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>工具箱条形码打印 - 共 ${toolkits.length} 箱 ${pageCount.value} 页</title>
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
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ============ 加载 ============
onMounted(async () => {
  try {
    const [tools, whs, cats, kits, mcats, spares, consumables] = await Promise.all([
      getTools(),
      getWarehouses(),
      getCategories(),
      getToolkits(),
      getMaterialCategories(),
      getSpareParts(),
      getConsumables()
    ])
    allTools.value = tools
    warehouses.value = whs
    categories.value = cats
    allToolkits.value = kits
    materialCategories.value = mcats
    allSpares.value = spares
    allConsumables.value = consumables

    // 加载 JsBarcode 并首次渲染
    await loadJsBarcode()
    doFilter()
    // 首次加载后确保当前模式可见项默认选中
    ensureAllVisibleSelected()
  } catch (e) {
    console.error('加载条形码数据失败', e)
  }
})

// 切换模式时清空筛选条件，避免跨类型误筛选
watch(mode, () => {
  warehouseFilter.value = ''
  categoryFilter.value = ''
  keyword.value = ''
  kitKeyword.value = ''
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
  flex-wrap: wrap;
}

.tool-count {
  font-size: 14px;
  color: #909399;
}

.selected-count {
  color: #409eff;
  font-weight: 600;
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

/* 单元格左上角的选择性打印复选框 */
.cell-check {
  align-self: flex-start;
  height: 22px;
  margin-bottom: 8px;
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
</style>
