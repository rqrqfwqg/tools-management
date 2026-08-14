<template>
  <div>
    <h2>安全防护用品管理</h2>

    <!-- 顶部操作栏：新增 / 搜索 / 提醒设置 -->
    <div style="display:flex;gap:12px;align-items:center;margin:12px 0;flex-wrap:wrap">
      <el-button type="primary" @click="openDialog()">新增用品</el-button>
      <el-input
        v-model="keyword"
        placeholder="搜索物品名/型号/品牌/管理人/使用人"
        clearable
        prefix-icon="Search"
        style="width:300px"
      />
      <el-button @click="openSettingsDialog">
        <el-icon style="margin-right:4px"><Setting /></el-icon>提醒设置
      </el-button>
    </div>

    <!-- 提醒概览卡片 -->
    <div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap">
      <div
        class="alert-card"
        :class="{ 'alert-active': alerts.expiring.length > 0 }"
        @click="showExpiringDetail = !showExpiringDetail"
        style="cursor:pointer"
      >
        <div class="alert-num" :style="{ color: alerts.expiring.length > 0 ? '#f56c6c' : '#909399' }">
          {{ alerts.expiring.length }}
        </div>
        <div class="alert-label">即将过期 / 已过期</div>
      </div>
      <div
        class="alert-card"
        :class="{ 'alert-active': alerts.check_due.length > 0 }"
        @click="showCheckDetail = !showCheckDetail"
        style="cursor:pointer"
      >
        <div class="alert-num" :style="{ color: alerts.check_due.length > 0 ? '#409eff' : '#909399' }">
          {{ alerts.check_due.length }}
        </div>
        <div class="alert-label">待定期检查</div>
      </div>
      <div class="alert-card" style="cursor:default">
        <div class="alert-num" style="color:#67c23a">{{ alerts.expiry_alert_days }}</div>
        <div class="alert-label">过期提醒提前期(天)</div>
      </div>
    </div>

    <!-- 即将过期明细 -->
    <el-collapse-transition>
      <div v-if="showExpiringDetail" class="detail-panel">
        <div class="detail-title">即将过期 / 已过期明细</div>
        <el-table :data="alerts.expiring" size="small" border max-height="260">
          <el-table-column prop="name" label="物品名" min-width="120" show-overflow-tooltip />
          <el-table-column prop="expiry_date" label="到期日期" width="120" />
          <el-table-column label="剩余天数" width="110">
            <template #default="{row}">
              <el-tag :type="row.days_to_expiry < 0 ? 'danger' : 'warning'" size="small">
                {{ row.days_to_expiry < 0 ? `已过期 ${Math.abs(row.days_to_expiry)} 天` : `剩 ${row.days_to_expiry} 天` }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="manager" label="管理人" width="100" />
        </el-table>
      </div>
    </el-collapse-transition>

    <!-- 待检查明细 -->
    <el-collapse-transition>
      <div v-if="showCheckDetail" class="detail-panel">
        <div class="detail-title">待定期检查明细</div>
        <el-table :data="alerts.check_due" size="small" border max-height="260">
          <el-table-column prop="name" label="物品名" min-width="120" show-overflow-tooltip />
          <el-table-column prop="last_check_date" label="上次检查" width="120">
            <template #default="{row}">{{ row.last_check_date || '从未检查' }}</template>
          </el-table-column>
          <el-table-column label="下次应检" width="130">
            <template #default="{row}">
              <span v-if="row.next_check_date">{{ row.next_check_date }}</span>
              <el-tag v-else type="info" size="small">待安排</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="manager" label="管理人" width="100" />
        </el-table>
      </div>
    </el-collapse-transition>

    <!-- 主表格 -->
    <el-table :data="list" border style="margin-top:8px">
      <el-table-column prop="name" label="物品名" min-width="120" show-overflow-tooltip />
      <el-table-column prop="model" label="型号" min-width="100" show-overflow-tooltip />
      <el-table-column prop="brand" label="品牌" min-width="100" show-overflow-tooltip />
      <el-table-column prop="production_date" label="生产日期" width="120" />
      <el-table-column prop="expiry_date" label="到期日期" width="120" />
      <el-table-column prop="manager" label="管理人" width="100" show-overflow-tooltip />
      <el-table-column prop="user_name" label="使用人" width="100" show-overflow-tooltip />
      <el-table-column prop="last_check_date" label="上次检查" width="120">
        <template #default="{row}">{{ row.last_check_date || '-' }}</template>
      </el-table-column>
      <el-table-column label="状态" width="110">
        <template #default="{row}">
          <el-tag :type="statusMeta(row).type" size="small">{{ statusMeta(row).label }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{row}">
          <el-button size="small" @click="openDialog(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row.supply_id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增 / 编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="form.supply_id ? '编辑用品' : '新增用品'" width="600px">
      <el-form :model="form" label-width="110px">
        <el-form-item label="物品名" required>
          <el-input v-model="form.name" placeholder="必填" />
        </el-form-item>
        <el-form-item label="型号">
          <el-input v-model="form.model" placeholder="如 A型 / 3M-6200" />
        </el-form-item>
        <el-form-item label="品牌">
          <el-input v-model="form.brand" placeholder="如 3M" />
        </el-form-item>
        <el-form-item label="生产日期">
          <el-date-picker v-model="form.production_date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width:100%" />
        </el-form-item>
        <el-form-item label="到期日期" required>
          <el-date-picker v-model="form.expiry_date" type="date" value-format="YYYY-MM-DD" placeholder="必填" style="width:100%" />
        </el-form-item>
        <el-form-item label="管理人" required>
          <el-input v-model="form.manager" placeholder="必填" />
        </el-form-item>
        <el-form-item label="使用人">
          <el-input v-model="form.user_name" placeholder="选填" />
        </el-form-item>
        <el-form-item label="检查周期(天)">
          <el-input-number v-model="form.check_cycle_days" :min="1" :precision="0" :value-on-clear="90" style="width:100%" />
        </el-form-item>
        <el-form-item label="上次检查日期">
          <el-date-picker v-model="form.last_check_date" type="date" value-format="YYYY-MM-DD" placeholder="可清空" clearable style="width:100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="选填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 提醒设置弹窗 -->
    <el-dialog v-model="settingsVisible" title="提醒设置" width="420px">
      <el-form label-width="140px">
        <el-form-item label="过期提醒提前期(天)">
          <el-input-number v-model="settingsForm.expiry_alert_days" :min="1" :precision="0" :value-on-clear="90" style="width:100%" />
        </el-form-item>
        <div style="color:#909399;font-size:12px;margin-left:140px">
          用品在到期前剩余天数 ≤ 该值时，会在上方"即将过期"卡片中提示。
        </div>
      </el-form>
      <template #footer>
        <el-button @click="settingsVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveSettings">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import {
  getSafetySupplies,
  createSafetySupply,
  updateSafetySupply,
  deleteSafetySupply,
  getSafetySupplyAlerts,
  getSafetySupplySettings,
  updateSafetySupplySettings
} from '@/api'
import type { SafetySupplyAlerts } from '@/types'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Setting } from '@element-plus/icons-vue'

const list = ref<any[]>([])
const keyword = ref('')
const dialogVisible = ref(false)
const settingsVisible = ref(false)
const showExpiringDetail = ref(false)
const showCheckDetail = ref(false)

const alerts = ref<SafetySupplyAlerts>({ expiry_alert_days: 90, expiring: [], check_due: [] })
const expiryAlertDays = ref(90)

const form = ref<any>({})
const settingsForm = ref<{ expiry_alert_days: number }>({ expiry_alert_days: 90 })

// ============ 日期工具（与后端语义一致） ============
function toDateOnly(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '')
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() + 1 !== Number(m[2]) || d.getUTCDate() !== Number(m[3])) return null
  return d
}
function todayStr(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}
function addDaysStr(s: string, days: number): string | null {
  const d = toDateOnly(s)
  if (!d) return null
  return new Date(d.getTime() + days * 86400000).toISOString().slice(0, 10)
}

// 行状态：已过期(危险) / 即将过期(警告) / 待检查(信息) / 正常(成功)
function statusMeta(row: any): { label: string; type: 'danger' | 'warning' | 'info' | 'success' } {
  const t = todayStr()
  const tDate = toDateOnly(t)!
  // 过期
  if (row.expiry_date) {
    const ed = toDateOnly(row.expiry_date)
    if (ed) {
      const diff = Math.round((ed.getTime() - tDate.getTime()) / 86400000)
      if (diff < 0) return { label: '已过期', type: 'danger' }
      if (diff >= 0 && diff <= expiryAlertDays.value) return { label: '即将过期', type: 'warning' }
    }
  }
  // 定期检查
  const cycle = row.check_cycle_days != null ? Number(row.check_cycle_days) : 90
  const nextCheck = row.last_check_date ? addDaysStr(row.last_check_date, cycle) : null
  const checkDue = nextCheck == null ? true : nextCheck <= t
  if (checkDue) return { label: '待检查', type: 'info' }
  return { label: '正常', type: 'success' }
}

// ============ 数据加载 ============
const load = async () => {
  list.value = await getSafetySupplies(keyword.value)
}
const loadAlerts = async () => {
  alerts.value = await getSafetySupplyAlerts()
  expiryAlertDays.value = alerts.value.expiry_alert_days
}
const loadSettings = async () => {
  const s = await getSafetySupplySettings()
  expiryAlertDays.value = s.expiry_alert_days
  settingsForm.value.expiry_alert_days = s.expiry_alert_days
}

// 搜索关键词变化即重新拉取
watch(keyword, () => { load() })

const openDialog = (row?: any) => {
  if (row) {
    form.value = { ...row }
  } else {
    form.value = {
      name: '', model: '', brand: '', production_date: '', expiry_date: '',
      manager: '', user_name: '', check_cycle_days: 90, last_check_date: '', remark: ''
    }
  }
  dialogVisible.value = true
}

const handleSave = async () => {
  try {
    if (form.value.supply_id) {
      await updateSafetySupply(form.value.supply_id, form.value)
      ElMessage.success('更新成功')
    } else {
      await createSafetySupply(form.value)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    await load()
    await loadAlerts()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '保存失败')
  }
}

const handleDelete = async (id: number) => {
  await ElMessageBox.confirm('确定删除该安全防护用品？', '提示', { type: 'warning' })
  try {
    await deleteSafetySupply(id)
    ElMessage.success('删除成功')
    await load()
    await loadAlerts()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '删除失败')
  }
}

const openSettingsDialog = () => {
  // 打开时以最新设置填充
  settingsForm.value.expiry_alert_days = alerts.value.expiry_alert_days
  settingsVisible.value = true
}

const handleSaveSettings = async () => {
  try {
    const res = await updateSafetySupplySettings({ expiry_alert_days: settingsForm.value.expiry_alert_days })
    ElMessage.success('设置已保存')
    alerts.value.expiry_alert_days = res.expiry_alert_days
    expiryAlertDays.value = res.expiry_alert_days
    settingsVisible.value = false
    await loadAlerts()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '保存失败')
  }
}

onMounted(() => { load(); loadAlerts(); loadSettings() })
</script>

<style scoped>
.alert-card {
  background: #f5f7fa;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 14px 22px;
  min-width: 150px;
  text-align: center;
  transition: all .2s;
}
.alert-card.alert-active {
  background: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,.08);
}
.alert-num {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
}
.alert-label {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}
.detail-panel {
  background: #fafafa;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 12px;
}
.detail-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #606266;
}
</style>
