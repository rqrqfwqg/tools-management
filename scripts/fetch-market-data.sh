#!/bin/bash
OUT="/tmp/stock-data-$(date +%Y%m%d).txt"
echo "=== A股收盘数据 $(date '+%Y-%m-%d') ===" > "$OUT"
echo -e "\n--- 指数 ---" >> "$OUT"
curl -s 'https://qt.gtimg.cn/q=sh000001,sh000300,sz399001,sz399006' | iconv -f GBK -t UTF-8 2>/dev/null >> "$OUT"

BOARD=$(npx -y westock-data-clawhub@1.0.4 board 2>&1)

echo -e "\n--- 行业板块涨幅 ---" >> "$OUT"
echo "$BOARD" | sed -n '/^\*\*行业板块涨幅/,/^\*\*概念板块涨幅/p' >> "$OUT"

echo -e "\n--- 概念板块涨幅 ---" >> "$OUT"
echo "$BOARD" | sed -n '/^\*\*概念板块涨幅/,/^\*\*行业资金流/p' >> "$OUT"

echo -e "\n--- 资金流入 ---" >> "$OUT"
echo "$BOARD" | sed -n '/^\*\*行业资金流/,/^\*\*行业资金流流出/p' >> "$OUT"

echo "DONE. $(wc -c < "$OUT") bytes"
