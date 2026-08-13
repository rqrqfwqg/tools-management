// 微信订阅消息授权 composable
// 微信订阅消息是「一次性」授权：用户需在客户端 wx.requestSubscribeMessage 点「允许」，
// 服务端才能向该用户推送一条；推完即消耗。没有永久订阅。
// 因此要在用户每次打开小程序、领用/归还后都重新请求授权（续期），
// 这样后端每天 8:00/20:00 的未归还提醒才能尽量送达（原则：启动 + 领用/归还时自动请求）。
import { WX_TPL_CLAIM, WX_TPL_REMIND, hasWxTemplates } from '@/config/wechat'

export type SubType = 'claim' | 'remind' | 'both'

let launchAsked = false

/**
 * 请求订阅消息授权（封装 uni.requestSubscribeMessage）。
 * - 非微信环境（如 H5 调试）自动忽略。
 * - 模板 ID 未配置时跳过（不弹窗、不报错）。
 * - 仅收集已配置模板的 ID；wx 会弹一次授权框，用户可逐项选择「允许/拒绝/总是保持」。
 * @param type 'claim'=领用成功模板, 'remind'=未归还提醒模板, 'both'=两个都请求
 * @param force 是否忽略 launch 去重（显式业务动作如领用/归还应传 true 以续期）
 */
export function requestSubscribe(type: SubType = 'both', force = false): void {
  // 仅在微信小程序运行时有效
  if (typeof uni === 'undefined' || !uni.requestSubscribeMessage) return
  if (!hasWxTemplates()) {
    console.warn('[WxSubscribe] 模板 ID 未配置，跳过授权请求')
    return
  }
  // 启动场景去重：onLaunch 最多请求一次，避免重复弹窗
  if (!force && launchAsked) return

  const tmplIds: string[] = []
  if ((type === 'claim' || type === 'both') && WX_TPL_CLAIM) tmplIds.push(WX_TPL_CLAIM)
  if ((type === 'remind' || type === 'both') && WX_TPL_REMIND) tmplIds.push(WX_TPL_REMIND)
  if (!tmplIds.length) return

  if (!force) launchAsked = true

  uni.requestSubscribeMessage({
    tmplIds,
    success: () => console.log('[WxSubscribe] 授权成功', tmplIds),
    fail: (err: any) => console.warn('[WxSubscribe] 授权失败/用户拒绝', err)
  })
}

/** App 启动时调用（内部去重） */
export function requestSubscribeOnLaunch(): void {
  requestSubscribe('both', false)
}
