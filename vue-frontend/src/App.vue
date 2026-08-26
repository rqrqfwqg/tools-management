<template>
  <el-config-provider :locale="zhCn" :message="{ duration: 2000 }">
    <router-view />
  </el-config-provider>
</template>

<script setup lang="ts">
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: element-plus 中文语言包无类型声明
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
</script>

<style>
body {
  margin: 0;
  padding: 0;
  font-family: 'Microsoft YaHei', Arial, sans-serif;
}

/* 表格自适应优化 */
.el-table .cell {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.el-table .el-table__cell.is-leaf .cell {
  word-break: keep-all;
}
</style>
