<template>
  <div>
    <h2>仪表盘</h2>
    <el-row :gutter="20">
      <el-col :span="6" v-for="stat in stats" :key="stat.label">
        <el-card shadow="hover">
          <div style="font-size:32px;font-weight:bold;color:#409EFF">{{ stat.value }}</div>
          <div style="color:#999">{{ stat.label }}</div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getDashboard } from '@/api'

const stats = ref([
  { label: '工器具总数', value: 0 },
  { label: '可用数量', value: 0 },
  { label: '领用申请', value: 0 },
  { label: '待审核', value: 0 }
])

onMounted(async () => {
  try {
    const data = await getDashboard()
    stats.value[0].value = data.tools_total
    stats.value[1].value = data.tools_available
    stats.value[2].value = data.orders_total
    stats.value[3].value = data.orders_pending
  } catch (e: any) {
    console.error('加载仪表盘数据失败', e)
  }
})
</script>
