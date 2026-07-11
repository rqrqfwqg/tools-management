<template>
  <div class="page-container">
    <div class="page-title">物料中心</div>

    <van-grid :column-num="2" :gutter="12">
      <van-grid-item icon="points" text="备件" @click="$router.push('/spare-parts')" />
      <van-grid-item icon="gift-o" text="消耗品" @click="$router.push('/consumables')" />
      <van-grid-item icon="scan" text="盘点" @click="$router.push('/inventory')" />
      <van-grid-item icon="exchange" text="出入库" @click="$router.push('/stock-movements')" />
    </van-grid>

    <!-- 独立物料领用入口（保留扫码领用 + 新增独立领用页，两者都要） -->
    <div class="dispense-entry">
      <van-button type="primary" block round icon="send-gift-o" @click="$router.push('/material-dispense')">
        物料领用
      </van-button>
    </div>

    <van-tabbar v-model="active" route active-color="#1989fa" inactive-color="#999" safe-area-inset-bottom>
      <van-tabbar-item v-for="t in MATERIAL_TABBAR" :key="t.to" :icon="t.icon" :to="t.to">{{ t.text }}</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { MATERIAL_TABBAR } from '@/constants/material'

// 物料中心页：聚合 4 大入口 + 独立领用入口；页底标准 5 项 TabBar（物料高亮由 route 自动处理）
const active = ref(-1)
</script>

<style scoped>
.page-container { min-height: 100vh; background: #f7f8fa; padding-bottom: 60px; }
.page-title { font-size: 18px; font-weight: 600; color: #323233; padding: 16px; }
.dispense-entry { padding: 12px 16px; }
</style>
