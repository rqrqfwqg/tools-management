/**
 * storage — 统一存储层（抹平 localStorage → uni storage）
 *
 * 约定（设计文档 §8.1）：所有持久化读写必须经本模块，禁止页面直用 uni.*Storage*。
 * 存储 key 统一：token / user / scan_history / inventory_entered_<checkId>
 */
const TOKEN_KEY = 'token'
const USER_KEY = 'user'

/** 读取原始值（uni storage 在 App 端直接存对象、H5 端存字符串，此处原样返回） */
export function get(key: string): any {
  try {
    return uni.getStorageSync(key)
  } catch (err) {
    console.warn(`[storage] get ${key} failed`, err)
    return null
  }
}

/** 读取字符串值（缺失/空返回 ''） */
export function getString(key: string): string {
  const value = get(key)
  if (value == null) return ''
  return typeof value === 'string' ? value : String(value)
}

/** 读取并解析 JSON（兼容已序列化字符串与对象两种存储形态） */
export function getJSON<T = any>(key: string): T | null {
  try {
    const value = get(key)
    if (value == null || value === '') return null
    if (typeof value === 'object') return value as T
    return JSON.parse(String(value)) as T
  } catch (err) {
    console.warn(`[storage] getJSON ${key} failed`, err)
    return null
  }
}

/** 写入（任意可序列化值；uni storage 自动处理） */
export function set(key: string, value: any): void {
  try {
    uni.setStorageSync(key, value)
  } catch (err) {
    console.warn(`[storage] set ${key} failed`, err)
  }
}

/** 删除指定 key */
export function remove(key: string): void {
  try {
    uni.removeStorageSync(key)
  } catch (err) {
    console.warn(`[storage] remove ${key} failed`, err)
  }
}

/** 清空全部本地存储 */
export function clear(): void {
  try {
    uni.clearStorageSync()
  } catch (err) {
    console.warn('[storage] clear failed', err)
  }
}

/* ===== 鉴权便捷方法（key 统一收口，避免散落字符串） ===== */

/** 读取登录 token（request.ts 拦截器使用） */
export function getToken(): string {
  return getString(TOKEN_KEY)
}

/** 写入登录 token */
export function setToken(token: string): void {
  set(TOKEN_KEY, token)
}

/** 读取缓存的用户对象 */
export function getStoredUser<T = any>(): T | null {
  return getJSON<T>(USER_KEY)
}

/** 写入缓存的用户对象 */
export function setStoredUser(user: any): void {
  set(USER_KEY, user)
}

/** 清空鉴权相关存储（401 / 退出登录时调用） */
export function clearAuth(): void {
  remove(TOKEN_KEY)
  remove(USER_KEY)
  remove('saved_credentials')
}
