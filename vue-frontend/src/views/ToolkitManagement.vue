<template>
  <div>
    <h2>工具箱管理</h2>
    <p style="color:#888;margin-bottom:16px">将多个工具绑定到同一工具包名，领用时可一键打包借出</p>

    <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
      <el-button type="primary" @click="openCreateKit">新建工具包</el-button>
      <el-input v-model="searchKit" placeholder="搜索工具包名" clearable style="width:220px" />
    </div>

    <!-- 工具包列表 -->
    <el-collapse v-model="activeKits">
      <el-collapse-item
        v-for="kit in filteredKits"
        :key="kit.name"
        :title="`${kit.name}（${kit.count} 件工具）`"
        :name="kit.name"
      >
        <template #title>
          <div style="display:flex;align-items:center;gap:8px">
            <el-tag type="success" effect="dark">{{ kit.name }}</el-tag>
            <span style="color:#888;font-size:13px">{{ kit.count }} 件</span>
          </div>
        </template>

        <!-- 工具包内的工具列表 -->
        <el-table :data="kit.tools" size="small" style="margin-bottom:12px">
          <el-table-column label="图片" width="60">
            <template #default="{row}">
              <el-image v-if="row.image_url" :src="row.image_url" fit="cover" style="width:36px;height:36px;border-radius:4px" />
              <div v-else style="width:36px;height:36px;background:#f5f5f5;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#ccc">-</div>
            </template>
          </el-table-column>
          <el-table-column prop="tool_code" label="编码" width="120" />
          <el-table-column prop="tool_name" label="名称" />
          <el-table-column label="状态" width="80">
            <template #default="{row}">
              <el-tag :type="statusType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="warehouse" label="仓库" width="100" />
          <el-table-column label="操作" width="100">
            <template #default="{row}">
              <el-button size="small" type="danger" @click="handleUnbind(row, kit.name)">移出</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div style="display:flex;gap:8px;align-items:center">
          <el-button size="small" type="primary" @click="openAddTool(kit.name)">添加工具</el-button>
          <el-button size="small" type="danger" @click="handleDeleteKit(kit.name)">删除工具包</el-button>
        </div>
      </el-collapse-item>
    </el-collapse>

    <div v-if="filteredKits.length === 0 && loaded" style="text-align:center;padding:40px;color:#999">
      暂无工具包，点击"新建工具包"创建
    </div>

    <!-- 新建工具包 / 添加工具对话框 -->
    <el-dialog v-model="dialogVisible" :title="dialogMode === 'create' ? '新建工具包' : `向「${currentKitName}」添加工具`" width="560px">
      <el-form v-if="dialogMode === 'create'" :model="newKitForm" label-width="80px">
        <el-form-item label="包名">
          <el-input v-model="newKitForm.name" placeholder="例如：电气试验箱" />
        </el-form-item>
        <el-form-item label="选择工具">
          <el-select v-model="newKitForm.toolIds" multiple filterable placeholder="搜索并选择工具" style="width:100%">
            <el-option
              v-for="tool in availableTools"
              :key="tool.tool_id"
              :label="`${tool.tool_code} - ${tool.tool_name}`"
              :value="tool.tool_id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <el-form v-else label-width="80px">
        <el-form-item label="工具包">{{ currentKitName }}</el-form-item>
        <el-form-item label="选择工具">
          <el-select v-model="addToolIds" multiple filterable placeholder="搜索并选择工具" style="width:100%">
            <el-option
              v-for="tool in unboundTools"
              :key="tool.tool_id"
              :label="`${tool.tool_code} - ${tool.tool_name}`"
              :value="tool.tool_id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleDialogConfirm" :loading="saving">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getToolkits, getToolkitDetail, getTools, bindToolkit, unbindToolkit } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const loaded = ref(false)
const allTools = ref<any[]>([])
const kitData = ref<any[]>([])
const activeKits = ref<string[]>([])
const searchKit = ref('')
const saving = ref(false)

const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'add'>('create')
const currentKitName = ref('')
const newKitForm = ref({ name: '', toolIds: [] as number[] })
const addToolIds = ref<number[]>([])

// 已在工具包中的工具ID集合
const boundToolIds = computed(() => {
  const ids = new Set<number>()
  kitData.value.forEach(k => k.tools.forEach((t: any) => ids.add(t.tool_id)))
  return ids
})

const filteredKits = computed(() => {
  if (!searchKit.value) return kitData.value
  const kw = searchKit.value.toLowerCase()
  return kitData.value.filter((k: any) => k.name.toLowerCase().includes(kw))
})

const availableTools = computed(() =>
  allTools.value.filter(t => !boundToolIds.value.has(t.tool_id))
)

const unboundTools = computed(() =>
  allTools.value.filter(t => t.toolkit !== currentKitName.value && (!t.toolkit || t.toolkit !== currentKitName.value))
)

async function loadAll() {
  try {
    const [tools, kitNames] = await Promise.all([getTools(), getToolkits()])
    allTools.value = tools
    const details = await Promise.all(kitNames.map((n: string) => getToolkitDetail(n)))
    kitData.value = details
    loaded.value = true
  } catch (e) {
    console.error('加载失败', e)
  }
}

function openCreateKit() {
  dialogMode.value = 'create'
  newKitForm.value = { name: '', toolIds: [] }
  dialogVisible.value = true
}

function openAddTool(kitName: string) {
  dialogMode.value = 'add'
  currentKitName.value = kitName
  addToolIds.value = []
  dialogVisible.value = true
}

async function handleDialogConfirm() {
  saving.value = true
  try {
    if (dialogMode.value === 'create') {
      const { name, toolIds } = newKitForm.value
      if (!name) { ElMessage.warning('请输入包名'); return }
      if (toolIds.length === 0) { ElMessage.warning('请至少选择一个工具'); return }
      await Promise.all(toolIds.map(id => bindToolkit(id, name)))
      ElMessage.success(`工具包"${name}"创建成功，已绑定 ${toolIds.length} 个工具`)
    } else {
      if (addToolIds.value.length === 0) { ElMessage.warning('请至少选择一个工具'); return }
      await Promise.all(addToolIds.value.map(id => bindToolkit(id, currentKitName.value)))
      ElMessage.success(`已添加 ${addToolIds.value.length} 个工具到"${currentKitName.value}"`)
    }
    dialogVisible.value = false
    await loadAll()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '操作失败')
  } finally {
    saving.value = false
  }
}

async function handleUnbind(tool: any, kitName: string) {
  try {
    await unbindToolkit(tool.tool_id)
    ElMessage.success(`已将"${tool.tool_name}"从"${kitName}"移出`)
    await loadAll()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '解绑失败')
  }
}

async function handleDeleteKit(kitName: string) {
  await ElMessageBox.confirm(`确定删除工具包"${kitName}"？将解绑其中所有工具。`, '警告', { type: 'warning' })
  try {
    const kit = kitData.value.find((k: any) => k.name === kitName)
    if (kit) {
      await Promise.all(kit.tools.map((t: any) => unbindToolkit(t.tool_id)))
    }
    ElMessage.success(`工具包"${kitName}"已删除`)
    await loadAll()
  } catch (e: any) {
    if (e !== 'cancel' && e !== 'close') {
      ElMessage.error(e.response?.data?.message || '删除失败')
    }
  }
}

const statusType = (s: string) => ({ available: 'success', borrowed: 'warning', maintenance: 'info', scrapped: 'danger' }[s] || 'info')
const statusText = (s: string) => ({ available: '可用', borrowed: '借出', maintenance: '维修', scrapped: '报废' }[s] || s)

onMounted(loadAll)
</script>
