<template>
  <div>
    <h2>工具箱管理</h2>
    <p style="color:#888;margin-bottom:16px">工具箱是独立实体，创建后可向其中添加工具。领用时可按工具箱一键打包借出。</p>

    <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
      <el-button type="primary" @click="openCreateDialog">新建工具箱</el-button>
      <el-input v-model="searchKit" placeholder="搜索工具箱名称" clearable style="width:220px" />
    </div>

    <!-- 工具箱主表格（可展开） -->
    <el-table
      :data="filteredKits"
      border
      row-key="toolkit_id"
      @expand-change="onExpandChange"
      :expand-row-keys="expandedRows"
      style="width:100%"
    >
      <el-table-column type="expand">
        <template #default="{ row }">
          <!-- 子表格：工具箱内的工具 -->
          <div style="padding:8px 20px 12px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <span style="font-size:13px;color:#666">共 {{ row.tool_count }} 件工具</span>
              <el-input
                v-model="subSearchMap[row.toolkit_id]"
                placeholder="在子表格中搜索名称/编码"
                clearable
                size="small"
                style="width:220px"
              />
              <el-button size="small" type="primary" @click="openAddTools(row)">添加工具</el-button>
            </div>
            <el-table :data="getFilteredKitTools(row)" border size="small" max-height="300">
              <el-table-column label="编号" width="70">
                <template #default="{ row: t }">{{ t.toolkit_seq }}</template>
              </el-table-column>
              <el-table-column label="编码" min-width="100">
                <template #default="{ row: t }">{{ t.tool_code }}</template>
              </el-table-column>
              <el-table-column label="名称" show-overflow-tooltip>
                <template #default="{ row: t }">{{ t.tool_name }}</template>
              </el-table-column>
              <el-table-column label="分类" min-width="80">
                <template #default="{ row: t }">{{ t.category_name }}</template>
              </el-table-column>
              <el-table-column label="状态" width="80">
                <template #default="{ row: t }">
                  <el-tag :type="statusType(t.status)" size="small">{{ statusText(t.status) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="仓库" min-width="80">
                <template #default="{ row: t }">{{ t.warehouse }}</template>
              </el-table-column>
              <el-table-column label="操作" min-width="80">
                <template #default="{ row: t }">
                  <el-button size="small" type="danger" @click="handleRemoveTool(row.toolkit_id, t.tool_id)">移出</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </template>
      </el-table-column>

      <el-table-column prop="toolkit_id" label="ID" width="60" />
      <el-table-column prop="toolkit_name" label="工具箱名称" show-overflow-tooltip />
      <el-table-column prop="toolkit_code" label="条形码编码" min-width="110">
        <template #default="{ row }">
          <span style="font-family:'Courier New',monospace;font-weight:700;color:#303133">{{ row.toolkit_code || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="description" label="描述" show-overflow-tooltip />
      <el-table-column label="工具数量" width="100">
        <template #default="{ row }">
          <el-tag type="success" size="small">{{ row.tool_count }} 件</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" min-width="160">
        <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" min-width="360" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="openEditDialog(row)">编辑</el-button>
          <el-button size="small" @click="openAddTools(row)">添加工具</el-button>
          <el-button size="small" type="danger" @click="handleDeleteKit(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="filteredKits.length === 0 && loaded" style="text-align:center;padding:40px;color:#999">
      暂无工具箱，点击"新建工具箱"创建
    </div>

    <!-- 新建/编辑工具箱对话框 -->
    <el-dialog v-model="dialogVisible" :title="dialogMode === 'create' ? '新建工具箱' : '编辑工具箱'" width="480px">
      <el-form :model="kitForm" label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="kitForm.toolkit_name" placeholder="例如：电气试验箱" />
        </el-form-item>
        <el-form-item label="条形码编码">
          <el-input v-model="kitForm.toolkit_code" placeholder="留空则自动生成，格式 BX-{id}" clearable />
          <div style="font-size:12px;color:#909399;margin-top:4px">格式：BX-{序号}，如 BX-1、BX-2。留空系统自动生成。</div>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="kitForm.description" type="textarea" :rows="2" placeholder="工具箱的描述说明（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveKit" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 添加工具对话框 -->
    <el-dialog v-model="addDialogVisible" :title="`向「${currentKit?.toolkit_name}」添加工具`" width="520px">
      <el-form label-width="80px">
        <el-form-item label="选择工具">
          <el-select v-model="addToolIds" multiple filterable placeholder="搜索并选择工具" style="width:100%">
            <el-option
              v-for="tool in availableTools"
              :key="tool.tool_id"
              :label="`${tool.tool_code} - ${tool.tool_name} (${tool.status === 'available' ? '可用' : tool.status})`"
              :value="tool.tool_id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAddTools" :loading="saving">确认添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import {
  getToolkits, getToolkitDetail, getTools,
  createToolkit, updateToolkit, deleteToolkit,
  addToolsToKit, removeToolFromKit
} from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const loaded = ref(false)
const allTools = ref<any[]>([])
const kits = ref<any[]>([])
const kitToolsMap = ref<Record<number, any[]>>({})
const expandedRows = ref<number[]>([])
const searchKit = ref('')
const subSearchMap = reactive<Record<number, string>>({})
const saving = ref(false)

const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const kitForm = ref({ toolkit_id: 0, toolkit_name: '', description: '', toolkit_code: '' })

const addDialogVisible = ref(false)
const currentKit = ref<any>(null)
const addToolIds = ref<number[]>([])

const filteredKits = computed(() => {
  if (!searchKit.value) return kits.value
  const kw = searchKit.value.toLowerCase()
  return kits.value.filter((k: any) => k.toolkit_name.toLowerCase().includes(kw))
})

const availableTools = computed(() => {
  if (!currentKit.value) return allTools.value
  const kitTools = kitToolsMap.value[currentKit.value.toolkit_id] || []
  const inKitIds = new Set(kitTools.map((t: any) => t.tool_id))
  return allTools.value.filter(t => !inKitIds.has(t.tool_id))
})

function getFilteredKitTools(kit: any) {
  const tools = kitToolsMap.value[kit.toolkit_id] || []
  const kw = (subSearchMap[kit.toolkit_id] || '').toLowerCase()
  if (!kw) return tools
  return tools.filter((t: any) =>
    t.tool_name?.toLowerCase().includes(kw) || t.tool_code?.toLowerCase().includes(kw)
  )
}

async function loadAll() {
  try {
    const [toolkits, tools] = await Promise.all([getToolkits(), getTools()])
    allTools.value = tools
    kits.value = toolkits
    loaded.value = true
  } catch (e) {
    console.error('加载失败', e)
  }
}

async function onExpandChange(row: any, expandedRowsArr: any[]) {
  expandedRows.value = expandedRowsArr.map((r: any) => r.toolkit_id)
  // 展开时懒加载工具列表
  if (expandedRows.value.includes(row.toolkit_id) && !kitToolsMap.value[row.toolkit_id]) {
    try {
      const detail = await getToolkitDetail(row.toolkit_id)
      kitToolsMap.value[row.toolkit_id] = detail.tools || []
      // 更新 tool_count
      const idx = kits.value.findIndex(k => k.toolkit_id === row.toolkit_id)
      if (idx > -1) kits.value[idx].tool_count = detail.tools?.length || 0
    } catch (e) {
      console.error('加载工具箱详情失败', e)
    }
  }
}

function openCreateDialog() {
  dialogMode.value = 'create'
  kitForm.value = { toolkit_id: 0, toolkit_name: '', description: '', toolkit_code: '' }
  dialogVisible.value = true
}

function openEditDialog(row: any) {
  dialogMode.value = 'edit'
  kitForm.value = { ...row }
  dialogVisible.value = true
}

async function handleSaveKit() {
  if (!kitForm.value.toolkit_name) { ElMessage.warning('请输入工具箱名称'); return }
  saving.value = true
  try {
    if (dialogMode.value === 'create') {
      await createToolkit({
        toolkit_name: kitForm.value.toolkit_name,
        description: kitForm.value.description,
        toolkit_code: kitForm.value.toolkit_code || undefined
      })
      ElMessage.success('创建成功')
    } else {
      await updateToolkit(kitForm.value.toolkit_id, {
        toolkit_name: kitForm.value.toolkit_name,
        description: kitForm.value.description,
        toolkit_code: kitForm.value.toolkit_code
      })
      ElMessage.success('更新成功')
    }
    dialogVisible.value = false
    await loadAll()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

function openAddTools(row: any) {
  currentKit.value = row
  addToolIds.value = []
  addDialogVisible.value = true
}

async function handleAddTools() {
  if (addToolIds.value.length === 0) { ElMessage.warning('请至少选择一个工具'); return }
  if (!currentKit.value) return
  saving.value = true
  try {
    await addToolsToKit(currentKit.value.toolkit_id, addToolIds.value)
    ElMessage.success(`已添加 ${addToolIds.value.length} 个工具`)
    addDialogVisible.value = false
    // 刷新子表格
    const detail = await getToolkitDetail(currentKit.value.toolkit_id)
    kitToolsMap.value[currentKit.value.toolkit_id] = detail.tools || []
    const idx = kits.value.findIndex(k => k.toolkit_id === currentKit.value.toolkit_id)
    if (idx > -1) kits.value[idx].tool_count = detail.tools?.length || 0
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '添加失败')
  } finally {
    saving.value = false
  }
}

async function handleRemoveTool(kitId: number, toolId: number) {
  try {
    await removeToolFromKit(kitId, toolId)
    ElMessage.success('已从工具箱移出')
    // 刷新子表格
    const detail = await getToolkitDetail(kitId)
    kitToolsMap.value[kitId] = detail.tools || []
    const idx = kits.value.findIndex(k => k.toolkit_id === kitId)
    if (idx > -1) kits.value[idx].tool_count = detail.tools?.length || 0
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '移出失败')
  }
}

async function handleDeleteKit(row: any) {
  await ElMessageBox.confirm(`确定删除工具箱"${row.toolkit_name}"？将同时移除其中所有工具关联。`, '警告', { type: 'warning' })
  try {
    await deleteToolkit(row.toolkit_id)
    ElMessage.success(`工具箱"${row.toolkit_name}"已删除`)
    delete kitToolsMap.value[row.toolkit_id]
    await loadAll()
  } catch (e: any) {
    if (e !== 'cancel' && e !== 'close') {
      ElMessage.error(e.response?.data?.message || '删除失败')
    }
  }
}

function formatDate(d: string) {
  if (!d) return '-'
  return new Date(d).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const statusType = (s: string) => ({ available: 'success', borrowed: 'warning', maintenance: 'info', scrapped: 'danger' }[s] || 'info')
const statusText = (s: string) => ({ available: '可用', borrowed: '借出', maintenance: '维修', scrapped: '报废' }[s] || s)

onMounted(loadAll)
</script>
