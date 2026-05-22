<template>
  <div class="page-container">
    <van-nav-bar title="领用篮" left-text="返回" left-arrow @click-left="$router.back()" fixed placeholder />

    <div v-if="cartStore.items.length === 0" class="empty-state" style="margin-top: 60px">
      <van-icon name="cart-o" size="64" color="#ccc" />
      <p style="margin-top: 12px">领用篮为空</p>
      <p style="font-size: 12px; color: #999">去工器具页面添加工具</p>
      <van-button type="primary" round style="margin-top: 16px" @click="$router.push('/tools')">
        去挑选工具
      </van-button>
    </div>

    <div v-else>
      <div
        v-for="item in cartStore.items"
        :key="item.tool_id"
        class="card"
        style="display:flex;justify-content:space-between;align-items:center"
      >
        <div>
          <div style="font-weight:600">{{ item.tool_name }}</div>
          <div style="font-size:12px;color:#999;margin-top:4px">{{ item.tool_code }}</div>
          <van-tag type="primary" style="margin-top:4px">{{ item.warehouse || '未分配' }}</van-tag>
        </div>
        <van-icon name="cross" color="#ee0a24" size="20" @click="cartStore.removeItem(item.tool_id)" />
      </div>

      <!-- 领用人信息 -->
      <van-cell-group inset style="margin-top: 12px">
        <van-field v-model="borrowerName" label="领用人" placeholder="请输入领用人姓名" />
        <van-field v-model="borrowerPhone" label="手机号" placeholder="请输入手机号" type="tel" maxlength="11" />
      </van-cell-group>

      <!-- 审批提示 -->
      <div v-if="needApproval" style="padding:12px;margin-top:8px">
        <van-notice-bar
          left-icon="warning-o"
          text="此工具位于隔离区内，提交后将进入审批流程"
          color="#f9a825"
          background="#fff9c4"
        />
      </div>

      <div style="margin:16px 0">
        <van-button round block type="primary" @click="checkout" :loading="submitting">
          提交领用申请
        </van-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCartStore } from '@/store/cart'
import { useAuthStore } from '@/store/auth'
import { getWarehouses, createOrder } from '@/api'
import { showToast, showSuccessToast } from 'vant'

const router = useRouter()
const cartStore = useCartStore()
const authStore = useAuthStore()

const borrowerName = ref(authStore.user?.real_name || '')
const borrowerPhone = ref(authStore.user?.phone || '')
const submitting = ref(false)
const needApproval = ref(false)

async function checkout() {
  if (!borrowerName.value || !borrowerPhone.value) {
    showToast('请填写领用人信息')
    return
  }
  if (cartStore.items.length === 0) {
    showToast('领用篮为空')
    return
  }

  // 检查仓库类型
  const firstItem = cartStore.items[0]
  if (firstItem.warehouse) {
    try {
      const warehouses = await getWarehouses()
      const wh = warehouses.find((w: any) => w.warehouse_name === firstItem.warehouse)
      needApproval.value = wh ? (wh.is_restricted !== false) : true
    } catch (e) {
      needApproval.value = true
    }
  }

  submitting.value = true
  try {
    const items = cartStore.items.map(i => ({
      tool_id: i.tool_id,
      tool_name: i.tool_name,
      tool_code: i.tool_code
    }))
    const warehouse = cartStore.items[0].warehouse || ''
    const res = await createOrder({
      borrower_name: borrowerName.value,
      borrower_phone: borrowerPhone.value,
      warehouse,
      items
    })
    const msg = res.status === 'approved' ? '领用成功（无需审批）' : '申请已提交，等待审批'
    showSuccessToast(msg)
    cartStore.clearAll()
    router.push('/orders')
  } catch (e: any) {
    showToast(e.response?.data?.message || '提交失败')
  } finally {
    submitting.value = false
  }
}
</script>
