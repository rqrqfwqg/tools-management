/**
 * scanHistory — 扫码记录持久化存储（小程序适配版）
 *
 * 自 mobile-frontend/src/store/scanHistory.ts 拷贝并适配：
 * localStorage 直接调用 → utils/storage.ts（get/set/remove）
 * 存储 key 沿用 'scan_history'（设计文档 §8.1），最近 50 条。
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ScanRecord } from '@/types'
import { get, set, remove } from '@/utils/storage'

const STORAGE_KEY = 'scan_history'
const MAX_RECORDS = 50

function loadRecords(): ScanRecord[] {
  try {
    const raw = get(STORAGE_KEY)
    if (!raw) return []
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveRecords(records: ScanRecord[]): void {
  set(STORAGE_KEY, records)
}

export const useScanHistoryStore = defineStore('scanHistory', () => {
  const records = ref<ScanRecord[]>(loadRecords())

  /** 总记录数 */
  const count = computed(() => records.value.length)

  /** 最近 N 条（倒序，最新的在前） */
  const recent = computed(() => [...records.value].reverse())

  /**
   * 添加一条扫码记录
   */
  function addRecord(record: Omit<ScanRecord, 'scanned_at'>): void {
    const entry: ScanRecord = {
      ...record,
      scanned_at: new Date().toISOString()
    }
    records.value.push(entry)

    // 保留最近 MAX_RECORDS 条
    if (records.value.length > MAX_RECORDS) {
      records.value = records.value.slice(-MAX_RECORDS)
    }

    saveRecords(records.value)
  }

  /**
   * 清空所有记录
   */
  function clearAll(): void {
    records.value = []
    remove(STORAGE_KEY)
  }

  return {
    records,
    count,
    recent,
    addRecord,
    clearAll
  }
})
