<template>
  <view class="page">
    <view class="head">
      <text class="head__title">蓝牙打印（精臣）</text>
      <text class="head__sub">逐张/连续打印备件二维码标签</text>
    </view>

    <view class="card">
      <view class="row">
        <text class="label">打印机</text>
        <text class="value">{{ connectedName || '未连接' }}</text>
      </view>
      <view class="actions">
        <button class="btn" @tap="scanDevices">搜索设备</button>
        <button class="btn btn--primary" :disabled="connecting" @tap="connectSelected">连接</button>
        <button class="btn btn--danger" @tap="disconnect">断开</button>
      </view>

      <scroll-view scroll-y class="device-list" v-if="devices.length">
        <view
          v-for="d in devices"
          :key="d.deviceId"
          class="device"
          :class="{ 'device--active': d.deviceId === deviceId }"
          @tap="pickDevice(d)"
        >
          <text class="device__name">{{ d.name || '未知' }}</text>
          <text class="device__id">{{ d.deviceId }}</text>
        </view>
      </scroll-view>
    </view>

    <view class="card">
      <view class="row">
        <text class="label">标签内容</text>
        <text class="hint">每行一个编码（备件二维码 SI-XXXX），或与名称用英文逗号隔开（名称,编码）</text>
      </view>
      <textarea class="textarea" v-model="raw" placeholder="SI-ABC12345 每行一个；格式：名称,编码（如 断路器,SI-ABC12346）" />
      <view class="actions">
        <button class="btn btn--primary" :disabled="!deviceId" @tap="printAll">连续打印</button>
        <button class="btn" @tap="clearList">清空</button>
      </view>
      <text class="hint">{{ statusText }}</text>
    </view>

    <view class="card">
      <text class="hint">说明：默认使用精臣通用 BLE-UART 服务/特征 UUID。若你的机型不同，请在下方 JS 中修改 SERVICE_UUID / WRITE_UUID。打印指令为 TSPL，如机型用 ESC/POS，请修改 buildLabel()。</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'

// ===== 精臣打印机 BLE 配置（如机型不同请在此修改） =====
const SERVICE_UUID = '49535343-FE7D-4AE5-8FA9-9FAFD205E455' // 通用 BLE UART 服务（多数精臣/汉印模块）
const WRITE_UUID = '49535343-1E4D-4BD9-BA61-23C647249616'   // 写特征
const NOTIFY_UUID = '49535343-1E4D-4BD9-BA61-23C647249616'  // 通知特征（同 UUID 或 Read）

const devices = ref<any[]>([])
const deviceId = ref('')
const connectedName = ref('')
const connecting = ref(false)
const raw = ref('')
const statusText = ref('')

function str2ab(str: string) {
  const buf = new ArrayBuffer(str.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < str.length; i++) view[i] = str.charCodeAt(i) & 0xff
  return buf
}

function pickDevice(d: any) {
  deviceId.value = d.deviceId
  connectedName.value = d.name || '未知'
}
function scanDevices() {
  devices.value = []
  statusText.value = '搜索中…'
  uni.openBluetoothAdapter({
    success: () => {
      uni.startBluetoothDevicesDiscovery({
        services: [], // 不过滤，列出全部附近蓝牙
        success: () => {
          uni.onBluetoothDeviceFound((res) => {
            const list = res.devices || []
            list.forEach((d: any) => {
              if (d.name && !devices.value.find(x => x.deviceId === d.deviceId)) {
                devices.value.push({ deviceId: d.deviceId, name: d.name })
              }
            })
            statusText.value = `已发现 ${devices.value.length} 台设备`
          })
          setTimeout(() => uni.stopBluetoothDevicesDiscovery(), 8000)
        },
        fail: (e) => { statusText.value = '搜索失败：' + (e.errMsg || e) }
      })
    },
    fail: (e) => { statusText.value = '蓝牙不可用：' + (e.errMsg || e) }
  })
}

function connectSelected() {
  if (!deviceId.value) { statusText.value = '请先选择设备'; return }
  connecting.value = true
  uni.createBLEConnection({
    deviceId: deviceId.value,
    success: () => {
      statusText.value = '已连接 ' + connectedName.value
      uni.notifyBLECharacteristicValueChange({
        deviceId: deviceId.value, serviceId: SERVICE_UUID, characteristicId: NOTIFY_UUID,
        state: true, fail: () => {}
      })
    },
    fail: (e) => { statusText.value = '连接失败：' + (e.errMsg || e) },
    complete: () => { connecting.value = false }
  })
}

function disconnect() {
  if (!deviceId.value) return
  uni.closeBLEConnection({ deviceId: deviceId.value })
  deviceId.value = ''; connectedName.value = ''
  statusText.value = '已断开'
}

// 单份标签的 TSPL 指令（精臣常见 TSPL 语法；如机型不同请改此处）
function buildLabel(name: string, code: string) {
  const lines: string[] = []
  lines.push('SIZE 40 mm,30 mm')
  lines.push('GAP 2 mm,0')
  lines.push('CLS')
  lines.push(`TEXT 10,10,"TSS24.BF2",0,1,1,${name}`)
  // 二维码：QRCODE x,y,ECC,cell,mode,rotation,data（部分机型需省去 model 字段，按实际调整）
  lines.push(`QRCODE 10,60,L,6,A,${code}`)
  lines.push(`TEXT 10,180,"TSS24.BF2",0,1,1,${code}`)
  lines.push('PRINT 1,1')
  lines.push('')
  return lines.join('\n')
}

async function writeChunks(cmd: string) {
  const buf = str2ab(cmd)
  const bytes = new Uint8Array(buf)
  const CHUNK = 20 // 部分机型 MTU≈23，按 20 字节分包
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.slice(i, i + CHUNK)
    await new Promise<void>((resolve) => {
      uni.writeBLECharacteristicValue({
        deviceId: deviceId.value, serviceId: SERVICE_UUID, characteristicId: WRITE_UUID,
        value: slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength) as any,
        success: () => resolve(),
        fail: () => resolve()
      })
    })
  }
}

async function printAll() {
  if (!deviceId.value) { statusText.value = '请先连接打印机'; return }
  const items = raw.value.split('\n').map(s => s.trim()).filter(Boolean).map(line => {
    const idx = line.indexOf(',')
    if (idx > 0) return { name: line.slice(0, idx), code: line.slice(idx + 1) }
    return { name: line, code: line }
  })
  if (!items.length) { statusText.value = '请先输入标签内容'; return }
  statusText.value = `正在连续打印 ${items.length} 张…`
  for (let i = 0; i < items.length; i++) {
    await writeChunks(buildLabel(items[i].name, items[i].code))
    await new Promise(r => setTimeout(r, 300)) // 标签间隙等待
  }
  statusText.value = `已发送 ${items.length} 张`
}
function clearList() { raw.value = '' }
</script>

<style scoped>
.page { padding: 16px; }
.head { margin-bottom: 12px; }
.head__title { font-size: 18px; font-weight: bold; }
.head__sub { font-size: 12px; color: #888; margin-top: 4px; display: block; }
.card { background: #fff; border-radius: 10px; padding: 14px; margin-bottom: 12px; }
.row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.label { font-weight: bold; }
.value { color: #333; }
.hint { font-size: 12px; color: #999; display: block; margin: 6px 0; }
.actions { display: flex; gap: 8px; }
.btn { flex: 1; background: #f2f3f5; border-radius: 8px; padding: 10px 0; font-size: 14px; border: none; }
.btn--primary { background: #6D5CF9; color: #fff; }
.btn--danger { background: #fde2e2; color: #ee0a24; }
.device-list { max-height: 200px; }
.device { padding: 10px; border-bottom: 1px solid #eee; }
.device--active { background: #eef0ff; }
.device__name { font-size: 14px; }
.device__id { font-size: 11px; color: #999; margin-left: 8px; }
.textarea { width: 100%; height: 140px; border: 1px solid #ddd; border-radius: 8px; padding: 8px; box-sizing: border-box; font-size: 13px; }
</style>
