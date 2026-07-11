<template>
  <div class="page-container">
    <van-nav-bar title="物料领用" left-text="返回" left-arrow fixed placeholder @click-left="$router.back()" />

    <van-tabs v-model="activeTab" sticky @change="onTabChange">
      <van-tab title="备件" />
      <van-tab title="消耗品" />
    </van-tabs>

    <van-search v-model="keyword" placeholder="搜索名称/编码" shape="round" />

    <van-pull-refresh v-model="refreshing" @refresh="reload">
      <div v-if="loading" class="center-tip"><van-loading size="20" /> 加载中...</div>
      <div v-else-if="filtered.length === 0" class="empty-state"><p>暂无数据</p></div>
      <MaterialCard
        v-for="item in filtered"
        :key="itemKey(item)"
        :spare="activeTab === 0 ? item : null"
        :consumable="activeTab === 1 ? item : null"
        @click="openDetail"
      />
    </van-pull-refresh>

    <!-- 复用 ScanResultPopup 整组件，borrow/take 逻辑零重写 -->
    <ScanResultPopup
      :show="showPopup"
      :spare="selectedSpare"
      :consumable="selectedConsumable"
      @update:show="onPopupShow"
      @close="onPopupClose"
    />

    <van-tabbar v-model="active" route active-color="#1989fa" inactive-color="#999" safe-area-inset-bottom>
      <van-tabbar-item v-for="t in MATERIAL_TABBAR" :key="t.to" :icon="t.icon" :to="t.to">{{ t.text }}</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMaterialList } from '@/composables/useMaterialList'
import { MATERIAL_TABBAR } from '@/constants/material'
import MaterialCard from '@/components/MaterialCard.vue'
import ScanResultPopup from '@/components/ScanResultPopup.vue'

// 独立物料领用页：备件/消耗品切换 + 搜索 + 列表，点击卡片复用 ScanResultPopup 完成领用
const router = useRouter()
const { keyword, loading, filtered, load } = useMaterialList()

const activeTab = ref(0)
const refreshing = ref(false)
const active = ref(-1)

const showPopup = ref(false)
const selectedSpare = ref<any>(null)
const selectedConsumable = ref<any>(null)

function currentTab(): 'spare' | 'consumable' {
  return activeTab.value === 0 ? 'spare' : 'consumable'
}

async function reload(): Promise<void> {
  try {
    await load(currentTab())
  } finally {
    refreshing.value = false
  }
}

function onTabChange(index: number): void {
  activeTab.value = index
  reload()
}

function itemKey(item: any): string {
  return item.spare_code || item.consumable_code || item.spare_id || item.consumable_id || String(Math.random())
}

function openDetail(item: any): void {
  if (activeTab.value === 0) {
    selectedSpare.value = item
    selectedConsumable.value = null
  } else {
    selectedConsumable.value = item
    selectedSpare.value = null
  }
  showPopup.value = true
}

function onPopupShow(val: boolean): void {
  showPopup.value = val
}

function onPopupClose(): void {
  showPopup.value = false
  selectedSpare.value = null
  selectedConsumable.value = null
}

onMounted(() => {
  load('spare')
})
</script>

<style scoped>
.page-container { min-height: 100vh; background: #f7f8fa; padding-bottom: 60px; }
.center-tip { text-align: center; padding: 40px; color: #969799; display: flex; align-items: center; justify-content: center; gap: 8px; }
.empty-state { text-align: center; padding: 40px; color: #999; }
</style>
