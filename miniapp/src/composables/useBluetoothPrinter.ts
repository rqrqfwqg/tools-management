/**
 * useBluetoothPrinter — 微信小程序 BLE 蓝牙打印框架（精臣条码机）
 * ---------------------------------------------------------------
 * 职责：
 *  - 初始化蓝牙适配器
 *  - 扫描附近 BLE 设备（可按名称前缀过滤，如 'JC' / 'Jingchen'）
 *  - 连接设备 → 发现服务 → 找到可写特征（write / writeNoResponse）
 *  - 分包写入（BLE MTU = 20 字节/包，顺序发送，避免溢出）
 *  - 断开 / 关闭适配器
 *
 * 精臣专属指令（图片光栅/浓度等）不在此处，由 utils/escpos.ts 的
 * buildLabel / TODO 项承载；本 composable 只负责「可靠地把字节流送到打印机」。
 *
 * 用法：
 *   const p = useBluetoothPrinter()
 *   await p.init()
 *   p.startScan('JC')
 *   const dev = await p.waitForPick() // 或自行从 p.devices 选
 *   await p.connect(dev)
 *   await p.printLabel({ code: 'SI-1A2B3C4D', title: '备件单品', name: '膨胀螺栓' })
 */
import { ref } from 'vue'
import { buildLabel, type LabelSpec } from '@/utils/escpos'

/** 把 uni.* 回调式 API 包成 Promise（fail 即 reject） */
function callUni<T = any>(method: string, params: Record<string, any> = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    ;(uni as any)[method]({
      ...params,
      success: (res: T) => resolve(res),
      fail: (err: any) => reject(err)
    })
  })
}

export interface PrinterDevice {
  deviceId: string
  name: string
  localName?: string
  RSSI?: number
  /** 是否已连接（前端维护） */
  connected?: boolean
}

const MTU = 20

export function useBluetoothPrinter() {
  const adapterAvailable = ref(false)
  const scanning = ref(false)
  const connecting = ref(false)
  const connected = ref(false)
  const devices = ref<PrinterDevice[]>([])
  const currentDevice = ref<PrinterDevice | null>(null)
  const error = ref('')

  // 连接后的写入目标
  let serviceId = ''
  let characteristicId = ''
  let connDeviceId = ''

  /** 初始化蓝牙适配器 */
  async function init(): Promise<boolean> {
    error.value = ''
    try {
      await callUni('openBluetoothAdapter')
      adapterAvailable.value = true
      // 监听连接状态变化（断连自动复位）
      uni.onBLEConnectionStateChange((res: any) => {
        if (res.deviceId === connDeviceId && !res.connected) {
          connected.value = false
          currentDevice.value = null
          error.value = '打印机已断开'
        }
      })
      return true
    } catch (e: any) {
      const msg = e?.errMsg || String(e)
      // 已开启也算可用
      if (msg.indexOf('already opened') >= 0 || msg.indexOf('already init') >= 0) {
        adapterAvailable.value = true
        return true
      }
      error.value = '蓝牙初始化失败：' + msg
      return false
    }
  }

  /** 开始扫描；namePrefix 为空则列出全部；onFound 可选回调 */
  function startScan(namePrefix = '', onFound?: (d: PrinterDevice) => void) {
    if (!adapterAvailable.value) return
    devices.value = []
    scanning.value = true
    uni.onBluetoothDeviceFound((res: any) => {
      const list: any[] = res.devices || []
      for (const raw of list) {
        const name = raw.name || raw.localName || ''
        if (namePrefix && !name.toUpperCase().includes(namePrefix.toUpperCase())) continue
        if (!raw.deviceId) continue
        const dev: PrinterDevice = {
          deviceId: raw.deviceId,
          name,
          localName: raw.localName,
          RSSI: raw.RSSI
        }
        // 去重（同名同 id 更新 RSSI）
        const idx = devices.value.findIndex((d) => d.deviceId === dev.deviceId)
        if (idx >= 0) devices.value[idx] = { ...devices.value[idx], ...dev }
        else devices.value.push(dev)
        onFound?.(dev)
      }
    })
    uni.startBluetoothDevicesDiscovery({
      services: [],
      allowDuplicatesKey: false,
      success: () => {},
      fail: (e: any) => {
        error.value = '扫描失败：' + (e?.errMsg || e)
        scanning.value = false
      }
    })
  }

  function stopScan() {
    if (scanning.value) {
      uni.stopBluetoothDevicesDiscovery({})
      scanning.value = false
    }
  }

  /** 连接设备并解析可写特征 */
  async function connect(dev: PrinterDevice): Promise<boolean> {
    if (!dev?.deviceId) return false
    connecting.value = true
    error.value = ''
    try {
      await callUni('createBLEConnection', { deviceId: dev.deviceId })
      const svcRes: any = await callUni('getBLEDeviceServices', { deviceId: dev.deviceId })
      const services: any[] = svcRes.services || []
      if (!services.length) throw new Error('未找到服务')
      // 取第一个服务（多数标签机仅一个主服务）
      const svc = services[0]
      serviceId = svc.uuid
      const charRes: any = await callUni('getBLEDeviceCharacteristics', {
        deviceId: dev.deviceId,
        serviceId
      })
      const chars: any[] = charRes.characteristics || []
      const wchar =
        chars.find((c) => c.properties?.write) ||
        chars.find((c) => c.properties?.writeNoResponse)
      if (!wchar) throw new Error('未找到可写特征')
      characteristicId = wchar.uuid
      connDeviceId = dev.deviceId
      currentDevice.value = dev
      connected.value = true
      stopScan()
      return true
    } catch (e: any) {
      error.value = '连接失败：' + (e?.errMsg || e?.message || e)
      connected.value = false
      return false
    } finally {
      connecting.value = false
    }
  }

  /** 分包写入（每包 20 字节，顺序发送） */
  async function writeBytes(bytes: Uint8Array): Promise<void> {
    if (!connected.value || !connDeviceId || !serviceId || !characteristicId) {
      throw new Error('打印机未连接')
    }
    for (let i = 0; i < bytes.length; i += MTU) {
      const chunk = bytes.subarray(i, i + MTU)
      // subarray 共享 buffer，需拷贝成独立 ArrayBuffer 再传
      const ab = chunk.slice().buffer
      await callUni('writeBLECharacteristicValue', {
        deviceId: connDeviceId,
        serviceId,
        characteristicId,
        value: ab
      })
    }
  }

  /** 便捷：构建标签字节流并打印（复用 utils/escpos.buildLabel） */
  async function printLabel(spec: LabelSpec): Promise<void> {
    const bytes = buildLabel(spec)
    await writeBytes(bytes)
  }

  /** 断开当前设备 */
  async function disconnect(): Promise<void> {
    if (connDeviceId) {
      try {
        await callUni('closeBLEConnection', { deviceId: connDeviceId })
      } catch (e) {
        /* 忽略断开失败 */
      }
    }
    connected.value = false
    currentDevice.value = null
    connDeviceId = ''
    serviceId = ''
    characteristicId = ''
  }

  /** 关闭适配器（页面卸载时调用） */
  async function close(): Promise<void> {
    await disconnect()
    try {
      await callUni('closeBluetoothAdapter')
    } catch (e) {
      /* 忽略 */
    }
    adapterAvailable.value = false
  }

  return {
    // 状态
    adapterAvailable,
    scanning,
    connecting,
    connected,
    devices,
    currentDevice,
    error,
    // 动作
    init,
    startScan,
    stopScan,
    connect,
    writeBytes,
    printLabel,
    disconnect,
    close
  }
}
