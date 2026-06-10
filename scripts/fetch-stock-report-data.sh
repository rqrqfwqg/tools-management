#!/bin/bash
# 采集A股收盘报告所需数据，输出为JSON格式供后续处理
OUTPUT_FILE="/tmp/stock-report-data.json"

echo "{" > "$OUTPUT_FILE"

# 1. 指数数据
echo '"indices": ' >> "$OUTPUT_FILE"
curl -s 'https://qt.gtimg.cn/q=sh000001,sh000300,sz399001,sz399006' | iconv -f GBK -t UTF-8 2>/dev/null | python3 -c "
import sys, json
lines = sys.stdin.read().strip().split('\n')
data = {}
for line in lines:
    parts = line.split('~')
    if len(parts) > 3:
        name = parts[1]
        price = parts[3]
        change = parts[31]
        changePct = parts[32]
        high = parts[33]
        low = parts[34]
        data[name] = {'price': price, 'change': change, 'changePct': changePct, 'high': high, 'low': low}
print(json.dumps(data, ensure_ascii=False))
" >> "$OUTPUT_FILE"
echo ',' >> "$OUTPUT_FILE"

# 2. Board数据（行业+概念板块排行）
echo '"board_industry": ' >> "$OUTPUT_FILE"
npx -y westock-data-clawhub@1.0.4 board 2>&1 | python3 -c "
import sys, json, re
lines = sys.stdin.read().strip().split('\n')
# 找行业板块部分
in_industry = False
in_concept = False
industry_data = []
concept_data = []
section = ''
for line in lines:
    if '行业板块涨幅排名' in line:
        section = 'industry'
        continue
    if '概念板块涨幅排名' in line:
        section = 'concept'
        continue
    if '涨幅排名' in line:
        section = 'other'
        continue
    if section == 'industry' and line.startswith('|') and not line.startswith('|---'):
        cells = [c.strip() for c in line.split('|')[1:-1]]
        if len(cells) >= 5 and cells[1] != 'name':
            industry_data.append({'rank': cells[0], 'name': cells[1], 'changePct': cells[2], 'turnover': cells[3], 'leadStock': cells[4]})
    if section == 'concept' and line.startswith('|') and not line.startswith('|---'):
        cells = [c.strip() for c in line.split('|')[1:-1]]
        if len(cells) >= 5 and cells[1] != 'name':
            concept_data.append({'rank': cells[0], 'name': cells[1], 'changePct': cells[2], 'turnover': cells[3], 'leadStock': cells[4]})

# 输出行业板块TOP5 + 概念板块TOP5
result = {'industry_top5': industry_data[:5], 'concept_top5': concept_data[:5]}
print(json.dumps(result, ensure_ascii=False))
" >> "$OUTPUT_FILE"
echo ',' >> "$OUTPUT_FILE"

# 3. 资金流向总览（from board输出中的资金流入排行）
echo '"fund_flow": ' >> "$OUTPUT_FILE"
npx -y westock-data-clawhub@1.0.4 board 2>&1 | python3 -c "
import sys, json, re
lines = sys.stdin.read().strip().split('\n')
in_fund = False
fund_in = []
fund_out = []
for line in lines:
    if '主力资金净流入排名' in line:
        in_fund = True
        continue
    if '主力资金净流出排名' in line:
        in_fund = False
        continue
    if in_fund and line.startswith('|') and not line.startswith('|---'):
        cells = [c.strip() for c in line.split('|')[1:-1]]
        if len(cells) >= 4 and cells[1] != 'name':
            fund_in.append({'rank': cells[0], 'name': cells[1], 'changePct': cells[2], 'fundNetInflow': cells[3]})

print(json.dumps({'in_top5': fund_in[:5]}, ensure_ascii=False))
" >> "$OUTPUT_FILE"
echo ',' >> "$OUTPUT_FILE"

# 4. 最强板块领头羊行情（从board输出提取股票代码）
echo '"top_stocks_quote": ' >> "$OUTPUT_FILE"
npx -y westock-data-clawhub@1.0.4 board 2>&1 | python3 -c "
import sys, json, re
lines = sys.stdin.read().strip().split('\n')
section = ''
stocks_found = []
for line in lines:
    if '行业板块涨幅排名' in line:
        section = 'industry'
        continue
    if '概念板块涨幅排名' in line:
        section = 'concept'
        continue
    if '涨幅排名' in line:
        section = 'other'
        continue
    if section in ('industry', 'concept') and line.startswith('|') and not line.startswith('|---'):
        cells = [c.strip() for c in line.split('|')[1:-1]]
        if len(cells) >= 5 and cells[1] != 'name':
            ls = cells[4]
            # 提取股票名称和涨跌幅
            stocks_found.append({'sector': cells[1], 'changePct': cells[2], 'leadStock': cells[4]})

# 取第一个行业板块和第一个概念板块的领涨股
top_industry = stocks_found[0] if stocks_found and stocks_found[0] else None
# 概念板块从后半部分找
concept_start = len([s for s in stocks_found if s['sector'] in [x['sector'] for x in stocks_found[:5]]])  # rough
top_concept = None
for s in stocks_found:
    if s.get('category') == 'concept':
        top_concept = s
        break
if not top_concept and len(stocks_found) > 5:
    top_concept = stocks_found[5]

result = {'top_industry': top_industry, 'top_concept': top_concept}
print(json.dumps(result, ensure_ascii=False))
" >> "$OUTPUT_FILE"

echo "}" >> "$OUTPUT_FILE"
echo "数据已保存到 $OUTPUT_FILE"
