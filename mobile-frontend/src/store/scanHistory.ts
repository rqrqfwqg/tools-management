/**
 * scanHistory — 扫码记录持久化存储
 *
 * 将扫码记录保存在 localStorage 中，最近 50 条。
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ScanRecord } from '@/types'

const STORAGE_KEY = 'scan_history'
const MAX_RECORDS = 50

function loadRecords(): ScanRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveRecords(records: ScanRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
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
    localStorage.removeItem(STORAGE_KEY)
  }

  return {
    records,
    count,
    recent,
    addRecord,
    clearAll
  }
})
