<template>
  <div class="page-container">
    <van-nav-bar title="消耗品" left-text="返回" left-arrow fixed placeholder @click-left="$router.back()" />

    <van-search v-model="keyword" placeholder="搜索名称/编码" shape="round" />

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list :finished="true" finished-text="">
        <div v-if="filteredList.length === 0" class="empty-state"><p>暂无数据</p></div>
        <div v-for="c in filteredList" :key="c.consumable_id" class="tool-card" @click="openDetail(c)">
          <div class="tool-card-left">
            <div class="tool-card-thumb">
              <img v-if="c.image_url" :src="c.image_url" alt="" />
              <van-icon v-else name="photo-o" size="36" color="#c8c9cc" />
            </div>
            <div class="tool-card-info">
              <div class="tool-card-title">
                {{ c.consumable_name }}
                <van-tag :type="lowStock(c) ? 'warning' : 'success'" size="medium" class="status-in-line">
                  {{ lowStock(c) ? '库存预警' : '正常' }}
                </van-tag>
              </div>
              <div class="tool-card-code">{{ c.consumable_code }}</div>
              <div class="tool-card-desc">{{ cardDesc(c) }}</div>
              <div class="tool-card-stock">库存：{{ c.stock_qty }} {{ c.unit || '' }}</div>
            </div>
          </div>
          <div class="tool-card-right" @click.stop="openTake(c)">
            <van-button size="normal" type="primary" class="tool-borrow-btn">直领</van-button>
          </div>
        </div>
      </van-list>
    </van-pull-refresh>

    <!-- 详情弹出层 -->
    <van-popup v-model:show="showDetail" position="bottom" round :style="{ height: '75%' }" closeable>
      <div class="detail-panel" v-if="detailConsumable">
        <div class="detail-image-section">
          <van-image v-if="detailConsumable.image_url" :src="detailConsumable.image_url" fit="cover" width="100%" height="200" radius="8" />
          <div v-else class="detail-image-placeholder">
            <van-icon name="photo-o" size="56" color="#c8c9cc" />
            <p>暂无图片</p>
          </div>
        </div>
        <van-cell-group inset>
          <van-cell title="消耗品名称" :value="detailConsumable.consumable_name" />
          <van-cell title="消耗品编码" :value="detailConsumable.consumable_code" />
          <van-cell title="分类" :value="detailConsumable.category_name || '-'" />
          <van-cell title="当前库存" :value="`${detailConsumable.stock_qty} ${detailConsumable.unit || ''}`" />
          <van-cell title="预警值" :value="detailConsumable.warning_qty != null ? String(detailConsumable.warning_qty) : '-'" />
          <van-cell title="仓库" :value="detailConsumable.warehouse_name || '未分配'" />
          <van-cell title="货架" :value="detailConsumable.shelf_name || '未分配'" />
          <van-cell title="货位" :value="detailConsumable.location_name || '未分配'" />
          <van-cell title="描述" :label="detailConsumable.description || '无'" />
        </van-cell-group>
        <div class="detail-actions">
          <van-button type="primary" block round :loading="taking" @click="handleTake(detailConsumable)">
            扫码直领
          </van-button>
        </div>
      </div>
    </van-popup>

    <!-- 数量输入弹窗 -->
    <van-dialog v-model:show="showTake" title="确认领用" show-cancel-button @confirm="submitTake">
      <div class="take-panel" v-if="takeTarget">
        <p>名称：<strong>{{ takeTarget.consumable_name }}</strong></p>
        <p>当前库存：<strong>{{ takeTarget.stock_qty }}</strong> {{ takeTarget.unit || '' }}</p>
        <van-field
          v-model="takeQty"
          type="digit"
          label="领用数量"
          :border="false"
          placeholder="请输入数量"
        />
      </div>
    </van-dialog>

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
import { getConsumables, getConsumableByCode, takeConsumableByCode } from '@/api/material'
import { showSuccessToast, showFailToast, showToast, showLoadingToast, closeToast } from 'vant'

const router = useRouter()
const list = ref<any[]>([])
const keyword = ref('')
const refreshing = ref(false)
const showDetail = ref(false)
const detailConsumable = ref<any>(null)
const showTake = ref(false)
const takeTarget = ref<any>(null)
const takeQty = ref('1')
const taking = ref(false)
const active = ref(-1)

const lowStock = (c: any) => c.warning_qty != null && c.stock_qty <= c.warning_qty
const cardDesc = (c: any) => {
  const parts: string[] = []
  if (c.category_name) parts.push(c.category_name)
  if (c.warehouse_name) parts.push(c.warehouse_name)
  if (c.shelf_name) parts.push(c.shelf_name)
  if (c.location_name) parts.push(c.location_name)
  return parts.join(' > ')
}
const filteredList = computed(() => {
  if (!keyword.value) return list.value
  const kw = keyword.value.toLowerCase()
  return list.value.filter((t: any) =>
    t.consumable_name?.toLowerCase().includes(kw) || t.consumable_code?.toLowerCase().includes(kw))
})

function openDetail(c: any) {
  detailConsumable.value = { ...c }
  showDetail.value = true
}

function openTake(c: any) {
  takeTarget.value = { ...c }
  takeQty.value = '1'
  showTake.value = true
}

async function submitTake() {
  if (!takeTarget.value) return
  const qty = parseInt(takeQty.value)
  if (!qty || qty <= 0) { showToast('请输入有效数量'); return false }
  if (qty > takeTarget.value.stock_qty) { showToast(`超出库存（${takeTarget.value.stock_qty}）`); return false }
  taking.value = true
  try {
    await takeConsumableByCode(takeTarget.value.consumable_code, qty)
    showSuccessToast('领用成功')
    showTake.value = false
    showDetail.value = false
    await onRefresh()
  } catch (e: any) {
    showFailToast(e?.response?.data?.message || e?.message || '领用失败')
  } finally {
    taking.value = false
  }
}

async function handleTake(c: any) {
  takeTarget.value = { ...c }
  takeQty.value = '1'
  showTake.value = true
}

async function onRefresh() {
  try {
    list.value = await getConsumables()
  } finally {
    refreshing.value = false
  }
}

onMounted(async () => {
  try { list.value = await getConsumables() } catch (e) { console.error('加载消耗品列表失败', e); showToast('加载失败') }
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
.tool-card-stock { font-size: 12px; color: #1989fa; margin-top: 2px; }
.tool-card-right {
  display: flex; align-items: center; justify-content: center; padding: 10px 12px;
  min-width: 64px; cursor: pointer; border-left: 1px solid #f0f0f0;
}
.tool-borrow-btn { flex-shrink: 0; }

.detail-panel { padding: 16px 16px 32px; min-height: 50vh; }
.detail-image-section { margin-bottom: 16px; }
.detail-image-placeholder {
  width: 100%; height: 200px; border-radius: 8px; background: #f7f8fa;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #c8c9cc; font-size: 14px;
}
.detail-actions { margin-top: 24px; padding: 0 8px; }
.take-panel { padding: 12px 16px; }
.take-panel p { margin: 6px 0; font-size: 14px; }

.scan-float {
  position: fixed; right: 16px; bottom: 70px; width: 56px; height: 56px;
  background: #07c160; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  color: #fff; box-shadow: 0 4px 12px rgba(7, 193, 96, 0.4); z-index: 100; cursor: pointer;
}
</style>
