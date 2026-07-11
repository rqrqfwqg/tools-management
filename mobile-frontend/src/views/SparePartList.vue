<template>
  <div class="page-container">
    <van-nav-bar title="备件" left-text="返回" left-arrow fixed placeholder @click-left="$router.back()" />

    <van-search v-model="keyword" placeholder="搜索名称/编码" shape="round" />

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list :finished="true" finished-text="">
        <div v-if="filteredList.length === 0" class="empty-state"><p>暂无数据</p></div>
        <div v-for="sp in filteredList" :key="sp.spare_id" class="tool-card" @click="openDetail(sp)">
          <div class="tool-card-left">
            <div class="tool-card-thumb">
              <img v-if="sp.image_url" :src="sp.image_url" alt="" />
              <van-icon v-else name="photo-o" size="36" color="#c8c9cc" />
            </div>
            <div class="tool-card-info">
              <div class="tool-card-title">
                {{ sp.spare_name }}
                <van-tag :type="statusTagType(sp.status)" size="medium" class="status-in-line">
                  {{ statusLabel(sp.status) }}
                </van-tag>
              </div>
              <div class="tool-card-code">{{ sp.spare_code }}</div>
              <div class="tool-card-desc">{{ cardDesc(sp) }}</div>
            </div>
          </div>
        </div>
      </van-list>
    </van-pull-refresh>

    <!-- 详情弹出层 -->
    <van-popup v-model:show="showDetail" position="bottom" round :style="{ height: '75%' }" closeable>
      <div class="detail-panel" v-if="detailSpare">
        <div class="detail-image-section">
          <van-image v-if="detailSpare.image_url" :src="detailSpare.image_url" fit="cover" width="100%" height="200" radius="8" />
          <div v-else class="detail-image-placeholder">
            <van-icon name="photo-o" size="56" color="#c8c9cc" />
            <p>暂无图片</p>
          </div>
        </div>
        <van-cell-group inset>
          <van-cell title="备件名称" :value="detailSpare.spare_name" />
          <van-cell title="备件编码" :value="detailSpare.spare_code" />
          <van-cell title="分类" :value="detailSpare.category_name || '-'" />
          <van-cell title="状态">
            <template #value>
              <van-tag :type="statusTagType(detailSpare.status)" size="medium">{{ statusLabel(detailSpare.status) }}</van-tag>
            </template>
          </van-cell>
          <van-cell title="仓库" :value="detailSpare.warehouse_name || '未分配'" />
          <van-cell title="货架" :value="detailSpare.shelf_name || '未分配'" />
          <van-cell title="货位" :value="detailSpare.location_name || '未分配'" />
          <van-cell title="描述" :label="detailSpare.description || '无'" />
        </van-cell-group>
        <div class="detail-actions">
          <van-button
            v-if="detailSpare.status === 'available'"
            type="primary" block round :loading="borrowing"
            @click="handleBorrow(detailSpare)"
          >
            扫码领用（生成工单）
          </van-button>
          <van-button v-else type="default" block round disabled>
            {{ statusLabel(detailSpare.status) }}
          </van-button>
        </div>
      </div>
    </van-popup>

    <!-- 扫码浮动按钮 -->
    <div class="scan-float" @click="$router.push('/scan')">
      <van-icon name="scan" size="28" />
    </div>

    <van-tabbar v-model="active" route active-color="#1989fa" inactive-color="#999" safe-area-inset-bottom>
      <van-tabbar-item icon="home-o" to="/dashboard">首页</van-tabbar-item>
      <van-tabbar-item icon="orders-o" to="/tools">工具</van-tabbar-item>
      <van-tabbar-item icon="apps-o" to="/material-center">物料</van-tabbar-item>
      <van-tabbar-item icon="description" to="/orders">工单</van-tabbar-item>
      <van-tabbar-item icon="contact" to="/profile">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getSpareParts, borrowSpareByCode } from '@/api/material'
import { showSuccessToast, showFailToast, showToast } from 'vant'

const router = useRouter()
const list = ref<any[]>([])
const keyword = ref('')
const refreshing = ref(false)
const showDetail = ref(false)
const detailSpare = ref<any>(null)
const borrowing = ref(false)
const active = ref(-1)

const statusLabel = (s: string) => {
  const map: Record<string, string> = { available: '可用', borrowed: '借出', reserved: '预留', maintenance: '维修' }
  return map[s] || s
}
const statusTagType = (s: string): any => {
  const map: Record<string, string> = { available: 'success', borrowed: 'warning', reserved: 'primary', maintenance: 'danger' }
  return map[s] || 'default'
}
const cardDesc = (sp: any) => {
  const parts: string[] = []
  if (sp.category_name) parts.push(sp.category_name)
  if (sp.warehouse_name) parts.push(sp.warehouse_name)
  if (sp.shelf_name) parts.push(sp.shelf_name)
  if (sp.location_name) parts.push(sp.location_name)
  return parts.join(' > ')
}
const filteredList = computed(() => {
  if (!keyword.value) return list.value
  const kw = keyword.value.toLowerCase()
  return list.value.filter((t: any) =>
    t.spare_name?.toLowerCase().includes(kw) || t.spare_code?.toLowerCase().includes(kw))
})

function openDetail(sp: any) {
  detailSpare.value = { ...sp }
  showDetail.value = true
}

async function handleBorrow(sp: any) {
  borrowing.value = true
  try {
    const res = await borrowSpareByCode(sp.spare_code, { scene: '移动端领用' })
    showSuccessToast(`领用成功！工单号：${res.order_no}`)
    showDetail.value = false
  } catch (e: any) {
    showFailToast(e?.response?.data?.message || e?.message || '领用失败')
  } finally {
    borrowing.value = false
  }
}

async function onRefresh() {
  try {
    list.value = await getSpareParts()
  } finally {
    refreshing.value = false
  }
}

onMounted(async () => {
  try { list.value = await getSpareParts() } catch (e) { console.error('加载备件列表失败', e); showToast('加载失败') }
})
</script>

<style scoped>
.page-container { min-height: 100vh; background: #f7f8fa; padding-bottom: 60px; }

.empty-state { text-align: center; padding: 40px; color: #999; }

.tool-card {
  display: flex;
  background: #fff;
  border-radius: 8px;
  margin: 0 12px 8px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  min-height: 88px;
}
.tool-card-left { flex: 1; display: flex; padding: 10px; min-width: 0; cursor: pointer; }
.tool-card-thumb {
  width: 64px; height: 64px; border-radius: 6px; overflow: hidden;
  background: #f7f8fa; flex-shrink: 0; display: flex; align-items: center; justify-content: center; margin-right: 10px;
}
.tool-card-thumb img { width: 100%; height: 100%; object-fit: cover; }
.tool-card-info { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
.tool-card-title { font-size: 15px; font-weight: 600; color: #323233; line-height: 1.3; display: flex; align-items: center; gap: 6px; }
.tool-card-code { font-size: 12px; color: #969799; margin-top: 1px; }
.tool-card-desc { font-size: 12px; color: #969799; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.detail-panel { padding: 16px 16px 32px; min-height: 50vh; }
.detail-image-section { margin-bottom: 16px; }
.detail-image-placeholder {
  width: 100%; height: 200px; border-radius: 8px; background: #f7f8fa;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #c8c9cc; font-size: 14px;
}
.detail-actions { margin-top: 24px; padding: 0 8px; }

.scan-float {
  position: fixed; right: 16px; bottom: 70px; width: 56px; height: 56px;
  background: #07c160; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  color: #fff; box-shadow: 0 4px 12px rgba(7, 193, 96, 0.4); z-index: 100; cursor: pointer;
}
</style>
