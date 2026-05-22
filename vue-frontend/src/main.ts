import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import { ElMessage } from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'

const app = createApp(App)
const pinia = createPinia()

// 全局 Vue 错误处理
app.config.errorHandler = (err: unknown, _instance, _info) => {
  console.error('[全局错误]', err)
  ElMessage.error(err instanceof Error ? err.message : '发生未知错误，请刷新重试')
}

// 全局未捕获 Promise 错误（仅警告，不阻塞页面）
app.config.warnHandler = (msg, _instance, _trace) => {
  console.warn('[Vue 警告]', msg)
}

app.use(pinia)
app.use(router)
app.use(ElementPlus)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.mount('#app')
