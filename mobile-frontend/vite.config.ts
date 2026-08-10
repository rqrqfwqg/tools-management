import { defineConfig } from 'vite'
import { resolve } from 'path'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { VantResolver } from '@vant/auto-import-resolver'

export default defineConfig({
  plugins: [
    vue(),
    Components({
      resolvers: [VantResolver()]
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 3200,
    proxy: {
      '/api': {
        target: 'http://localhost:3300',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:3300',
        changeOrigin: true
      }
    }
  }
})
