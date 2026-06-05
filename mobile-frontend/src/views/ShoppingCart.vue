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

      <!-- 领用人信息（自动使用当前登录账号） -->
      <van-cell-group inset style="margin-top: 12px">
        <van-cell title="领用人" :value="authStore.user?.real_name || '-'" />
        <van-cell title="手机号" :value="authStore.user?.phone || '-'" />
      </van-cell-group>

      <!-- 审批提示 -->
      <div style="padding:12px;margin-top:8px">
        <van-notice-bar
          left-icon="warning-o"
          text="提交后将进入审批流程，由管理员或分队长审批"
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
import { createOrder } from '@/api'
import { showToast, showSuccessToast } from 'vant'

const router = useRouter()
const cartStore = useCartStore()
const authStore = useAuthStore()

const submitting = ref(false)
const needApproval = ref(true)

async function checkout() {
  if (cartStore.items.length === 0) {
    showToast('领用篮为空')
    return
  }

  submitting.value = true
  try {
    const tool_ids = cartStore.items.map(i => i.tool_id)
    const warehouse = cartStore.items[0].warehouse || ''
    const res = await createOrder({ tool_ids, warehouse })
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
