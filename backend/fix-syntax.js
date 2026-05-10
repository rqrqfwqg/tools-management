const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'server.js');
let content = fs.readFileSync(filePath, 'utf8');

// 移除所有TypeScript类型注解
// 模式1: (param: Type) => 替换为 (param) =>
content = content.replace(/\((\w+):\s*\w+\)/g, '($1)');

// 模式2: : Type（在函数返回值等位置）- 这个比较复杂，需要更精确匹配
// 先处理简单的箭头函数参数

// 写回文件
fs.writeFileSync(filePath, content, 'utf8');

console.log('TypeScript语法已清理完成');

// 验证语法
try {
  require(filePath);
  console.log('✓ 语法检查通过');
} catch (e) {
  console.error('✗ 仍有语法错误:', e.message);
}
