<template>
  <view class="page">
    <view class="bar">
      <text class="bar__title">{{ isEdit ? '编辑用品' : '录入用品' }}</text>
    </view>

    <scroll-view scroll-y class="form">
      <view class="field">
        <text class="field__label">物品名<text class="req">*</text></text>
        <input v-model="form.name" class="field__input" placeholder="如：安全帽 / 防毒面具" placeholder-class="ph" />
      </view>

      <view class="field">
        <text class="field__label">型号</text>
        <input v-model="form.model" class="field__input" placeholder="选填" placeholder-class="ph" />
      </view>

      <view class="field">
        <text class="field__label">品牌</text>
        <input v-model="form.brand" class="field__input" placeholder="选填" placeholder-class="ph" />
      </view>

      <view class="field">
        <text class="field__label">生产日期</text>
        <picker mode="date" :value="form.production_date" @change="onDate('production_date', $event)">
          <view class="field__picker" :class="{ 'field__picker--empty': !form.production_date }">
            {{ form.production_date || '选填，点击选择' }}
          </view>
        </picker>
      </view>

      <view class="field">
        <text class="field__label">到期日期<text class="req">*</text></text>
        <picker mode="date" :value="form.expiry_date" @change="onDate('expiry_date', $event)">
          <view class="field__picker" :class="{ 'field__picker--empty': !form.expiry_date }">
            {{ form.expiry_date || '必填，点击选择' }}
          </view>
        </picker>
      </view>

      <view class="field">
        <text class="field__label">管理人<text class="req">*</text></text>
        <input v-model="form.manager" class="field__input" placeholder="负责管理的人员" placeholder-class="ph" />
      </view>

      <view class="field">
        <text class="field__label">使用人</text>
        <input v-model="form.user_name" class="field__input" placeholder="选填" placeholder-class="ph" />
      </view>

      <view class="field">
        <text class="field__label">检查周期（天）</text>
        <input v-model="form.check_cycle_days" class="field__input" type="number" placeholder="默认 90" placeholder-class="ph" />
      </view>

      <view class="field">
        <text class="field__label">上次检查日期</text>
        <picker mode="date" :value="form.last_check_date" @change="onDate('last_check_date', $event)">
          <view class="field__picker" :class="{ 'field__picker--empty': !form.last_check_date }">
            {{ form.last_check_date || '选填，点击选择' }}
          </view>
        </picker>
      </view>

      <view class="field">
        <text class="field__label">备注</text>
        <textarea v-model="form.remark" class="field__textarea" placeholder="选填" placeholder-class="ph" :auto-height="true" />
      </view>

      <view class="hint">下次检查日期 = 上次检查日期 + 检查周期（天）。留空则视为立即待检。</view>
    </scroll-view>

    <view class="submit-bar">
      <view class="submit-bar__btn" :class="{ 'is-disabled': submitting }" @tap="submit">
        {{ submitting ? '提交中…' : isEdit ? '保存修改' : '提交录入' }}
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import {
  getSafetySupplies,
  createSafetySupply,
  updateSafetySupply
} from '@/api'
import { toArray } from '@/utils/status'
import { showToast } from '@/utils/feedback'
import type { SafetySupply } from '@/types'

const id = ref<number | null>(null)
const isEdit = computed(() => id.value != null)
const submitting = ref(false)

interface FormState {
  name: string
  model: string
  brand: string
  production_date: string
  expiry_date: string
  manager: string
  user_name: string
  check_cycle_days: string
  last_check_date: string
  remark: string
}

const empty: FormState = {
  name: '',
  model: '',
  brand: '',
  production_date: '',
  expiry_date: '',
  manager: '',
  user_name: '',
  check_cycle_days: '90',
  last_check_date: '',
  remark: ''
}
const form = reactive<FormState>({ ...empty })

function onDate(key: keyof FormState, e: any) {
  form[key] = e.detail.value
}

function fill(s: SafetySupply) {
  form.name = s.name
  form.model = s.model || ''
  form.brand = s.brand || ''
  form.production_date = s.production_date || ''
  form.expiry_date = s.expiry_date || ''
  form.manager = s.manager || ''
  form.user_name = s.user_name || ''
  form.check_cycle_days = String(s.check_cycle_days ?? 90)
  form.last_check_date = s.last_check_date || ''
  form.remark = s.remark || ''
}

async function loadEdit() {
  if (id.value == null) return
  try {
    const list = toArray(await getSafetySupplies().catch(() => [])) as SafetySupply[]
    const found = list.find((s) => s.supply_id === id.value)
    if (found) fill(found)
    else await showToast('未找到该用品', 'none')
  } catch {
    /* 忽略 */
  }
}

async function submit() {
  if (submitting.value) return
  if (!form.name.trim()) {
    await showToast('物品名不能为空', 'none')
    return
  }
  if (!form.expiry_date) {
    await showToast('到期日期不能为空', 'none')
    return
  }
  if (!form.manager.trim()) {
    await showToast('管理人不能为空', 'none')
    return
  }
  const payload: Record<string, any> = {
    name: form.name.trim(),
    model: form.model.trim(),
    brand: form.brand.trim(),
    production_date: form.production_date || '',
    expiry_date: form.expiry_date,
    manager: form.manager.trim(),
    user_name: form.user_name.trim(),
    check_cycle_days: form.check_cycle_days ? Number(form.check_cycle_days) : 90,
    last_check_date: form.last_check_date || null,
    remark: form.remark.trim()
  }

  submitting.value = true
  try {
    if (isEdit.value) {
      await updateSafetySupply(id.value as number, payload)
      await showToast('已保存', 'success')
    } else {
      await createSafetySupply(payload)
      await showToast('录入成功', 'success')
    }
    setTimeout(() => uni.navigateBack(), 600)
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '提交失败', 'none')
  } finally {
    submitting.value = false
  }
}

onLoad((options) => {
  if (options && options.id) {
    id.value = Number(options.id)
  }
})

onMounted(() => {
  if (isEdit.value) loadEdit()
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: $tm-bg;
  display: flex;
  flex-direction: column;
}

.bar {
  padding: 24rpx 32rpx;
  background: $tm-card-bg;

  &__title {
    font-size: 32rpx;
    font-weight: 600;
    color: $tm-text;
  }
}

.form {
  flex: 1;
  padding: 20rpx 24rpx 40rpx;
  box-sizing: border-box;
}

.field {
  background: $tm-card-bg;
  border-radius: $tm-radius-sm;
  padding: 24rpx 28rpx;
  margin-bottom: 16rpx;
  display: flex;
  flex-direction: column;
  box-shadow: $tm-shadow-card;

  &__label {
    font-size: 26rpx;
    color: $tm-text-secondary;
    margin-bottom: 12rpx;
  }

  &__input {
    font-size: 30rpx;
    color: $tm-text;
    background: transparent;
  }

  &__picker {
    font-size: 30rpx;
    color: $tm-text;
    padding: 6rpx 0;

    &--empty {
      color: $tm-text-muted;
    }
  }

  &__textarea {
    font-size: 30rpx;
    color: $tm-text;
    min-height: 120rpx;
    background: transparent;
  }
}

.req {
  color: $tm-danger;
  margin-left: 4rpx;
}

.ph {
  color: $tm-text-muted;
}

.hint {
  font-size: 22rpx;
  color: $tm-text-muted;
  padding: 8rpx 8rpx 0;
  line-height: 1.6;
}

.submit-bar {
  padding: 20rpx 32rpx;
  background: $tm-card-bg;
  border-top: 1rpx solid $tm-border;
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.06);

  &__btn {
    text-align: center;
    padding: 22rpx 0;
    border-radius: 999rpx;
    background: $tm-primary;
    color: #ffffff;
    font-size: 30rpx;
    font-weight: 600;

    &.is-disabled {
      opacity: 0.6;
    }
  }
}
</style>
