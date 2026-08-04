<template>
  <div>
    <h2>物料领用购物车</h2>
    <div v-if="cartStore.materialItems.length === 0" style="text-align:center;padding:50px;color:#999">
      <el-icon size="60"><ShoppingCart /></el-icon>
      <p style="margin-top:20px;font-size:16px">物料购物车是空的</p>
      <el-button type="primary" @click="$router.push('/spare-parts')" style="margin-top:20px">去添加备件</el-button>
    </div>

    <div v-else>
      <el-alert type="info" :closable="false" style="margin-bottom:12px">
        <template #title>物料领用单按数量领用备件，审批通过后扣减库存；归还时按量回补。</template>
      </el-alert>
      <el-table :data="cartStore.materialItems" border style="margin-top:15px">
        <el-table-column label="图片" width="80">
          <template #default="{row}">
            <el-image v-if="row.image_url" :src="getImageUrl(row.image_url)" fit="cover" style="width:50px;height:50px;border-radius:4px" />
            <div v-else style="width:50px;height:50px;background:#f5f5f5;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#ccc">
              <el-icon><Picture /></el-icon>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="spare_code" label="编码" min-width="110" show-overflow-tooltip />
        <el-table-column prop="spare_name" label="名称" min-width="130" show-overflow-tooltip />
        <el-table-column prop="category_name" label="分类" min-width="90" show-overflow-tooltip />
        <el-table-column label="可用库存" width="100">
          <template #default="{row}">{{ row.stock_qty != null ? row.stock_qty : '-' }}</template>
        </el-table-column>
        <el-table-column label="领用数量" width="180">
          <template #default="{row}">
            <el-input-number
              :model-value="row.quantity"
              :min="1"
              :max="Math.max(Number(row.stock_qty) || 1, 1)"
              :precision="0"
              @update:model-value="(v: number | undefined) => handleQtyChange(row, v)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{row}">
            <el-button size="small" type="danger" @click="cartStore.removeFromCart(cartStore.keyOf(row))">移除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div style="margin-top:30px;text-align:right">
        <el-button @click="cartStore.clearCart()">清空购物车</el-button>
        <el-button type="primary" size="large" @click="handleCheckout">提交领用（{{ cartStore.totalItems }}件）</el-button>
      </div>
    </div>

    <!-- 提交弹窗 -->
    <el-dialog v-model="checkoutDialogVisible" title="确认物料领用信息" width="520px">
      <el-form :model="checkoutForm" label-width="100px">
        <el-form-item label="仓库">
          <el-input v-model="checkoutForm.warehouse" placeholder="根据备件自动填写" readonly />
        </el-form-item>
        <el-form-item label="使用场景">
          <el-input v-model="checkoutForm.scene" placeholder="请输入使用场景" />
        </el-form-item>
        <el-form-item label="预计归还">
          <el-date-picker v-model="checkoutForm.expected_return" type="datetime" placeholder="请选择预计归还时间" style="width:100%" />
        </el-form-item>
        <el-form-item label="用途说明">
          <el-input v-model="checkoutForm.purpose" type="textarea" :rows="3" placeholder="请输入用途说明" />
        </el-form-item>
      </el-form>
      <div style="margin:20px 0;padding:15px;background:#f9f9f9;border-radius:8px">
        <p style="font-weight:bold;margin-bottom:10px">领用备件清单：</p>
        <div v-for="item in cartStore.materialItems" :key="item.spare_id" style="margin:5px 0;color:#666">
          • {{ item.spare_name }} ({{ item.spare_code }}) × {{ item.quantity }}
        </div>
      </div>
      <template #footer>
        <el-button @click="checkoutDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmitOrder">确认提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCartStore } from '@/store/cart'
import { createOrder } from '@/api'
import { ElMessage } from 'element-plus'
import { ShoppingCart, Picture } from '@element-plus/icons-vue'

const router = useRouter()
const cartStore = useCartStore()
const checkoutDialogVisible = ref(false)
const submitting = ref(false)

const getImageUrl = (path: string) => (!path ? '' : path.startsWith('http') ? path : path)

const handleQtyChange = (row: any, v: number | undefined) => {
  cartStore.updateQuantity(cartStore.keyOf(row), v ?? 0)
}

const handleCheckout = async () => {
  if (cartStore.materialItems.length === 0) {
    ElMessage.warning('购物车是空的')
    return
  }
  const warehouses = [...new Set(cartStore.materialItems.map((item: any) => item.warehouse_name || item.warehouse).filter(Boolean))] as string[]
  checkoutForm.warehouse = warehouses.length === 1 ? warehouses[0] : (warehouses.join('、') || '')
  checkoutForm.scene = ''
  checkoutForm.expected_return = null
  checkoutForm.purpose = ''
  checkoutDialogVisible.value = true
}

const checkoutForm = reactive({
  warehouse: '',
  scene: '',
  expected_return: null as Date | null,
  purpose: ''
})

const handleSubmitOrder = async () => {
  if (!checkoutForm.scene) {
    ElMessage.warning('请填写使用场景')
    return
  }
  submitting.value = true
  try {
    const payload = cartStore.buildOrderPayload({
      warehouse: checkoutForm.warehouse,
      scene: checkoutForm.scene,
      expected_return: checkoutForm.expected_return ? new Date(checkoutForm.expected_return).toISOString() : null,
      purpose: checkoutForm.purpose
    })
    await createOrder(payload)
    ElMessage.success('物料领用申请已提交，等待审批')
    cartStore.clearCart()
    checkoutDialogVisible.value = false
    router.push('/material-orders')
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '提交失败')
  } finally {
    submitting.value = false
  }
}
</script>
