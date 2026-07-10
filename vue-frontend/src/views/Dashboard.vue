<template>
  <div>
    <h2>仪表盘</h2>

    <!-- 工具统计 -->
    <h3 style="margin:16px 0 8px;color:#606266">工器具</h3>
    <el-row :gutter="16">
      <el-col :span="6" v-for="stat in toolStats" :key="stat.label">
        <el-card shadow="hover" class="stat-card" @click="goTo(stat.route, stat.filter)">
          <div class="stat-icon" :style="{ background: stat.bg }">
            <el-icon :size="28" :color="stat.color"><component :is="stat.icon" /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value" :style="{ color: stat.color }">{{ stat.value }}</div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 订单统计 -->
    <h3 style="margin:24px 0 8px;color:#606266">领用订单</h3>
    <el-row :gutter="16">
      <el-col :span="6" v-for="stat in orderStats" :key="stat.label">
        <el-card shadow="hover" class="stat-card" @click="goTo(stat.route, stat.filter)">
          <div class="stat-icon" :style="{ background: stat.bg }">
            <el-icon :size="28" :color="stat.color"><component :is="stat.icon" /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value" :style="{ color: stat.color }">{{ stat.value }}</div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 用户统计 -->
    <h3 style="margin:24px 0 8px;color:#606266">用户</h3>
    <el-row :gutter="16">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card" @click="goTo('/users')">
          <div class="stat-icon" style="background:#f0e6ff">
            <el-icon :size="28" color="#9b59b6"><User /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value" style="color:#9b59b6">{{ userTotal }}</div>
            <div class="stat-label">用户总数</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 物料统计 -->
    <h3 style="margin:24px 0 8px;color:#606266">物料</h3>
    <el-row :gutter="16">
      <el-col :span="6" v-for="stat in materialStats" :key="stat.label">
        <el-card shadow="hover" class="stat-card" @click="goTo(stat.route)">
          <div class="stat-icon" :style="{ background: stat.bg }">
            <el-icon :size="28" :color="stat.color"><component :is="stat.icon" /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value" :style="{ color: stat.color }">{{ stat.value }}</div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getDashboard, getSpareParts, getConsumables, getInventoryChecks } from '@/api'
import { Box, CircleCheck, Van, SetUp, List, Clock, CircleClose, Refresh, User, Goods, Warning } from '@element-plus/icons-vue'

const router = useRouter()

const toolStats = ref([
  { label: '工器具总数', value: 0, icon: Box, color: '#409EFF', bg: '#e6f1fc', route: '/tools', filter: '' },
  { label: '可用数量', value: 0, icon: CircleCheck, color: '#67C23A', bg: '#e6f7e6', route: '/tools', filter: 'available' },
  { label: '借出中', value: 0, icon: Van, color: '#E6A23C', bg: '#fdf3e0', route: '/tools', filter: 'borrowed' },
  { label: '维保中', value: 0, icon: SetUp, color: '#F56C6C', bg: '#fde6e6', route: '/tools', filter: 'maintenance' },
])

const orderStats = ref([
  { label: '订单总数', value: 0, icon: List, color: '#409EFF', bg: '#e6f1fc', route: '/orders', filter: '' },
  { label: '待审核', value: 0, icon: Clock, color: '#E6A23C', bg: '#fdf3e0', route: '/orders', filter: 'pending' },
  { label: '已批准', value: 0, icon: CircleClose, color: '#67C23A', bg: '#e6f7e6', route: '/orders', filter: 'approved' },
  { label: '已归还', value: 0, icon: Refresh, color: '#909399', bg: '#ebeef5', route: '/orders', filter: 'returned' },
])

const userTotal = ref(0)

const materialStats = ref([
  { label: '备件总数', value: 0, icon: Goods, color: '#409EFF', bg: '#e6f1fc', route: '/spare-parts' },
  { label: '消耗品种类', value: 0, icon: Box, color: '#67C23A', bg: '#e6f7e6', route: '/consumables' },
  { label: '待盘库数', value: 0, icon: List, color: '#E6A23C', bg: '#fdf3e0', route: '/inventory-checks' },
  { label: '低库存消耗品', value: 0, icon: Warning, color: '#F56C6C', bg: '#fde6e6', route: '/consumables' },
])

onMounted(async () => {
  try {
    const data = await getDashboard()
    toolStats.value[0].value = data.tools_total
    toolStats.value[1].value = data.tools_available
    toolStats.value[2].value = data.tools_borrowed
    toolStats.value[3].value = data.tools_maintenance
    orderStats.value[0].value = data.orders_total
    orderStats.value[1].value = data.orders_pending
    orderStats.value[2].value = data.orders_approved
    orderStats.value[3].value = data.orders_returned
    userTotal.value = data.users_total
  } catch (e: any) {
    console.error('加载仪表盘数据失败', e)
  }

  // 物料统计（独立计数，简单求和）
  try {
    const [spares, consumables, checks] = await Promise.all([
      getSpareParts(),
      getConsumables(),
      getInventoryChecks()
    ])
    materialStats.value[0].value = spares.length
    materialStats.value[1].value = consumables.length
    materialStats.value[2].value = (checks || []).filter((c: any) => c.status === 'pending').length
    materialStats.value[3].value = (consumables || []).filter(
      (c: any) => c.warning_qty != null && c.stock_qty <= c.warning_qty
    ).length
  } catch (e: any) {
    console.error('加载物料统计失败', e)
  }
})

const goTo = (route: string, filter?: string) => {
  if (filter) {
    router.push({ path: route, query: { status: filter } })
  } else {
    router.push(route)
  }
}
</script>

<style scoped>
.stat-card {
  cursor: pointer;
  transition: all 0.3s;
}
.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.stat-card :deep(.el-card__body) {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
}
.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.stat-info {
  flex: 1;
}
.stat-value {
  font-size: 28px;
  font-weight: bold;
  line-height: 1.2;
}
.stat-label {
  color: #999;
  font-size: 13px;
  margin-top: 4px;
}
</style>
