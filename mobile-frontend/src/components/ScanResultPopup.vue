<template>
  <van-popup
    :show="show"
    position="bottom"
    round
    :style="{ height: '65%' }"
    closeable
    @update:show="$emit('update:show', $event)"
    @closed="$emit('close')"
  >
    <div class="result-panel" v-if="tool">
      <!-- 工具图片 -->
      <div class="result-image-section">
        <van-image
          v-if="tool.image_url"
          :src="tool.image_url"
          fit="cover"
          width="100%"
          height="180"
          radius="8"
        />
        <div v-else class="result-image-placeholder">
          <van-icon name="photo-o" size="48" color="#c8c9cc" />
          <p>暂无图片</p>
        </div>
      </div>

      <!-- 工具信息 -->
      <div class="result-info">
        <div class="result-title">
          <span class="result-name">{{ tool.tool_name }}</span>
          <van-tag :type="statusTagType(tool.status)" size="medium">
            {{ statusLabel(tool.status) }}
          </van-tag>
        </div>

        <van-cell-group inset>
          <van-cell title="工具编码" :value="tool.tool_code" />
          <van-cell title="分类" :value="tool.category_name || '-'" />
          <van-cell title="仓库" :value="tool.warehouse || '未分配'" />
          <van-cell
            title="货架"
            :value="tool.shelf_name || '未分配'"
          />
          <van-cell
            title="货位"
            :value="tool.location_name || '未分配'"
          />
          <van-cell title="借出次数" :value="String(tool.borrow_count || 0)" />
        </van-cell-group>
      </div>

      <!-- 操作按钮 -->
      <div class="result-actions">
        <van-button
          v-if="tool.status === 'available'"
          type="primary"
          block
          round
          :loading="adding"
          @click="handleAddToCart"
        >
          加入领用篮
        </van-button>
        <van-button
          v-else-if="tool.status === 'borrowed'"
          type="warning"
          block
          round
          disabled
        >
          已被借出
        </van-button>
        <van-button
          v-else-if="tool.status === 'reserved'"
          type="default"
          block
          round
          disabled
        >
          已被预留
        </van-button>
        <van-button
          v-else
          type="default"
          block
          round
          disabled
        >
          {{ statusLabel(tool.status) }}
        </van-button>
      </div>
    </div>

    <!-- 无数据状态 -->
    <div v-else class="result-empty">
      <van-loading />
      <p>加载中...</p>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { showSuccessToast, showFailToast } from 'vant'
import type { TagType } from 'vant'
import { useCartStore } from '@/store/cart'
import { useScanHistoryStore } from '@/store/scanHistory'
import type { Tool } from '@/types'

const props = defineProps<{
  show: boolean
  tool: Tool | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  close: []
}>()

const cartStore = useCartStore()
const scanHistoryStore = useScanHistoryStore()
const adding = ref(false)

/** 状态标签映射 */
function statusLabel(status: string): string {
  const map: Record<string, string> = {
    available: '可用',
    borrowed: '已借出',
    reserved: '已预留',
    maintenance: '维修中',
    scrapped: '已报废'
  }
  return map[status] || status
}

function statusTagType(status: string): TagType {
  const map: Record<string, TagType> = {
    available: 'success',
    borrowed: 'danger',
    reserved: 'warning',
    maintenance: 'warning',
    scrapped: 'default'
  }
  return map[status] || 'default'
}

/** 加入领用篮 */
async function handleAddToCart(): Promise<void> {
  if (!props.tool) return
  adding.value = true

  try {
    // 加入领用篮
    cartStore.addItem({
      tool_id: props.tool.tool_id,
      tool_name: props.tool.tool_name,
      tool_code: props.tool.tool_code,
      warehouse: props.tool.warehouse || '',
      image_url: props.tool.image_url || ''
    })

    // 记录扫码历史
    scanHistoryStore.addRecord({
      tool_id: props.tool.tool_id,
      tool_code: props.tool.tool_code,
      tool_name: props.tool.tool_name,
      status: 'available'
    })

    showSuccessToast(`已加入领用篮: ${props.tool.tool_name}`)

    // 关闭弹窗
    emit('update:show', false)
    emit('close')
  } catch (err: any) {
    const msg = err?.response?.data?.message || err?.message || '加入领用篮失败'
    showFailToast(msg)
  } finally {
    adding.value = false
  }
}
</script>

<style scoped>
.result-panel {
  padding: 16px 16px 32px;
  min-height: 50vh;
}

.result-image-section {
  margin-bottom: 16px;
}

.result-image-placeholder {
  width: 100%;
  height: 180px;
  border-radius: 8px;
  background: #f7f8fa;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #c8c9cc;
  font-size: 14px;
}

.result-image-placeholder p {
  margin: 0;
}

.result-info {
  margin-bottom: 20px;
}

.result-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 0 8px;
}

.result-name {
  font-size: 18px;
  font-weight: 600;
  color: #323233;
}

.result-actions {
  padding: 0 8px;
}

.result-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: #969799;
}
</style>
