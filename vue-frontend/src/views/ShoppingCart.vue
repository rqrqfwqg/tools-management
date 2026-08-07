<template>
  <div>
    <h2>工具购物车</h2>
    <div v-if="cartStore.toolItems.length === 0" style="text-align: center; padding: 50px; color: #999;">
      <el-icon size="60"><ShoppingCart /></el-icon>
      <p style="margin-top: 20px; font-size: 16px;">购物车是空的</p>
      <template v-if="cartStore.materialItems.length > 0">
        <p style="margin-top: 8px; font-size: 14px;">当前购物车为物料（备件）条目，请到物料领用购物车结算。</p>
        <el-button type="primary" @click="$router.push('/material-cart')" style="margin-top: 20px;">
          去物料领用购物车
        </el-button>
      </template>
      <el-button v-else type="primary" @click="$router.push('/tools')" style="margin-top: 20px;">
        去添加工具
      </el-button>
    </div>

      <div v-else>
      <el-table :data="cartStore.toolItems" border style="margin-top: 15px;">
        <el-table-column label="图片" width="100">
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

        <el-table-column label="类型" width="80">
          <template #default="{row}">
            <el-tag :type="row.item_type === 'spare' ? 'warning' : 'info'" size="small">
              {{ row.item_type === 'spare' ? '备件' : '工具' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="编码" min-width="100" show-overflow-tooltip>
          <template #default="{row}">{{ row.spare_code || row.tool_code }}</template>
        </el-table-column>
        <el-table-column label="名称" min-width="120" show-overflow-tooltip>
          <template #default="{row}">{{ row.spare_name || row.tool_name }}</template>
        </el-table-column>
        <el-table-column prop="category_name" label="分类" min-width="80" show-overflow-tooltip />
        <el-table-column prop="storage_location" label="位置" min-width="100" show-overflow-tooltip />

        <el-table-column label="操作" min-width="100">
          <template #default="{row}">
            <el-button size="small" type="danger" @click="handleRemove(cartStore.keyOf(row))">
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
        <div v-for="item in cartStore.toolItems" :key="item.tool_id" style="margin: 5px 0; color: #666;">
          • {{ item.tool_name }} ({{ item.tool_code }})
        </div>
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
import { createOrder } from '@/api'
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
  purpose: ''
})

const getImageUrl = (path: string) => {
  if (!path) return ''
  if (path.startsWith('http')) return path
  return path
}

const handleRemove = (toolId: string) => {
  cartStore.removeFromCart(toolId)
  ElMessage.success('已从购物车移除')
}

const handleCheckout = async () => {
  if (cartStore.toolItems.length === 0) {
    ElMessage.warning('购物车是空的')
    return
  }
  // 根据工具属性自动填写仓库
  const warehouses = [...new Set(cartStore.toolItems.map(item => item.warehouse).filter(Boolean))] as string[]
  checkoutForm.warehouse = warehouses.length === 1 ? warehouses[0] : (warehouses.join('、') || '')
  checkoutForm.scene = ''
  checkoutForm.expected_return = null
  checkoutForm.purpose = ''

  checkoutDialogVisible.value = true
}

const handleSubmitOrder = async () => {
  if (!checkoutForm.warehouse || !checkoutForm.scene) {
    ElMessage.warning('请填写仓库和使用场景')
    return
  }

  submitting.value = true
  try {
    // T04：工具购物车仅提交 tool_ids（物料单走 MaterialCartView）
    const orderData = cartStore.buildOrderPayload({
      warehouse: checkoutForm.warehouse,
      scene: checkoutForm.scene,
      expected_return: checkoutForm.expected_return
        ? new Date(checkoutForm.expected_return).toISOString()
        : null,
      purpose: checkoutForm.purpose
    })

    await createOrder(orderData)
    ElMessage.success('领用申请已提交，等待审批')
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
