<template>
  <div>
    <h2>购物车</h2>
    <div v-if="cartStore.items.length === 0" style="text-align: center; padding: 50px; color: #999;">
      <el-icon size="60"><ShoppingCart /></el-icon>
      <p style="margin-top: 20px; font-size: 16px;">购物车是空的</p>
      <el-button type="primary" @click="$router.push('/tools')" style="margin-top: 20px;">
        去添加工具
      </el-button>
    </div>

    <div v-else>
      <el-table :data="cartStore.items" border style="margin-top: 15px;">
        <el-table-column label="工具图片" width="100">
          <template #default="{row}">
            <el-image
              v-if="row.image_url"
              :src="getImageUrl(row.image_url)"
              fit="cover"
              style="width: 60px; height: 60px; border-radius: 4px;"
            />
            <div v-else style="width: 60px; height: 60px; background: #f5f5f5; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #ccc;">
              <el-icon><Picture /></el-icon>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="tool_code" label="编码" min-width="100" show-overflow-tooltip />
        <el-table-column prop="tool_name" label="名称" min-width="120" show-overflow-tooltip />
        <el-table-column prop="category_name" label="分类" min-width="80" show-overflow-tooltip />
        <el-table-column prop="storage_location" label="位置" min-width="100" show-overflow-tooltip />

        <el-table-column label="操作" min-width="100">
          <template #default="{row}">
            <el-button size="small" type="danger" @click="handleRemove(row.tool_id)">
              移除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div style="margin-top: 30px; text-align: right;">
        <el-button @click="cartStore.clearCart()">清空购物车</el-button>
        <el-button type="primary" @click="handleCheckout" size="large">
          结算领用（{{ cartStore.totalItems }}件）
        </el-button>
      </div>
    </div>

    <!-- 结算对话框 -->
    <el-dialog v-model="checkoutDialogVisible" title="确认领用信息" width="500px">
      <el-form :model="checkoutForm" label-width="100px">
        <el-form-item label="仓库">
          <el-input v-model="checkoutForm.warehouse" placeholder="根据工具自动填写" readonly />
        </el-form-item>
        <el-form-item label="使用场景">
          <el-input v-model="checkoutForm.scene" placeholder="请输入使用场景" />
        </el-form-item>
        <el-form-item label="预计归还">
          <el-date-picker
            v-model="checkoutForm.expected_return"
            type="datetime"
            placeholder="请选择预计归还时间"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="用途说明">
          <el-input
            v-model="checkoutForm.purpose"
            type="textarea"
            :rows="3"
            placeholder="请输入用途说明"
          />
        </el-form-item>
      </el-form>

      <div style="margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 8px;">
        <p style="font-weight: bold; margin-bottom: 10px;">领用工具清单：</p>
        <div v-for="item in cartStore.items" :key="item.tool_id" style="margin: 5px 0; color: #666;">
          • {{ item.tool_name }} ({{ item.tool_code }})
        </div>
        <el-alert
          v-if="!checkoutForm.needApproval"
          type="success"
          :closable="false"
          style="margin-top:10px"
        >
          <template #title>该仓库为隔离区外，领用后无需审批，直接生效</template>
        </el-alert>
        <el-alert
          v-if="checkoutForm.needApproval"
          type="warning"
          :closable="false"
          style="margin-top:10px"
        >
          <template #title>该仓库为隔离区内，领用后需管理员审批方可生效</template>
        </el-alert>
      </div>

      <template #footer>
        <el-button @click="checkoutDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmitOrder" :loading="submitting">
          确认领用
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useCartStore } from '@/store/cart'
import { createOrder, getWarehouses } from '@/api'
import { ElMessage } from 'element-plus'
import { ShoppingCart, Picture } from '@element-plus/icons-vue'

const router = useRouter()
const cartStore = useCartStore()
const checkoutDialogVisible = ref(false)
const submitting = ref(false)

const checkoutForm = reactive({
  warehouse: '',
  scene: '',
  expected_return: null as Date | null,
  purpose: '',
  needApproval: true
})

const getImageUrl = (path: string) => {
  if (!path) return ''
  if (path.startsWith('http')) return path
  return path
}

const handleRemove = (toolId: number) => {
  cartStore.removeFromCart(toolId)
  ElMessage.success('已从购物车移除')
}

const handleCheckout = async () => {
  if (cartStore.items.length === 0) {
    ElMessage.warning('购物车是空的')
    return
  }
  // 根据工具属性自动填写仓库
  const warehouses = [...new Set(cartStore.items.map(item => item.warehouse).filter(Boolean))] as string[]
  checkoutForm.warehouse = warehouses.length === 1 ? warehouses[0] : (warehouses.join('、') || '')
  checkoutForm.scene = ''
  checkoutForm.expected_return = null
  checkoutForm.purpose = ''

  // 查询仓库是否需要审批
  try {
    const whList = await getWarehouses()
    const whNames = warehouses as string[]
    // 只要有任一仓库为隔离区内，就需要审批
    const anyRestricted = whList.some((w: any) =>
      whNames.includes(w.warehouse_name) && w.is_restricted !== false
    )
    checkoutForm.needApproval = anyRestricted
  } catch {
    checkoutForm.needApproval = true // 默认需要审批
  }

  checkoutDialogVisible.value = true
}

const handleSubmitOrder = async () => {
  if (!checkoutForm.warehouse || !checkoutForm.scene) {
    ElMessage.warning('请填写仓库和使用场景')
    return
  }

  submitting.value = true
  try {
    const orderData = {
      tool_ids: cartStore.items.map(item => item.tool_id),
      warehouse: checkoutForm.warehouse,
      scene: checkoutForm.scene,
      expected_return: checkoutForm.expected_return
        ? new Date(checkoutForm.expected_return).toISOString()
        : null,
      purpose: checkoutForm.purpose
    }

    await createOrder(orderData)
    if (checkoutForm.needApproval) {
      ElMessage.success('领用申请已提交，等待管理员审批')
    } else {
      ElMessage.success('领用成功，已直接生效')
    }
    cartStore.clearCart()
    checkoutDialogVisible.value = false
    router.push('/orders')
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '提交失败')
  } finally {
    submitting.value = false
  }
}
</script>
