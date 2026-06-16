#!/usr/bin/env python
"""批量导入工具到工器具管理系统 — 通过 API"""
import requests
import sys
import openpyxl

BASE = "http://localhost:3000/api"
TOKEN = None

def api(method, path, data=None):
    headers = {"Authorization": f"Bearer {TOKEN}"} if TOKEN else {}
    url = f"{BASE}{path}"
    try:
        if method == "GET":
            r = requests.get(url, headers=headers, timeout=10)
        elif method == "POST":
            r = requests.post(url, json=data, headers=headers, timeout=10)
        else:
            raise ValueError(f"Unknown method: {method}")
    except requests.exceptions.ConnectionError:
        print(f"  ❌ 连接失败: {url} (后端未启动?)")
        sys.exit(1)
    if r.status_code >= 400:
        print(f"  ❌ {method} {path} -> {r.status_code}: {r.text[:200]}")
        return None
    return r.json()

# ===== 1. Login =====
print("🔐 登录...")
resp = api("POST", "/auth/login", {"username": "admin", "password": "123456"})
if not resp or "access_token" not in resp:
    print("❌ 登录失败")
    sys.exit(1)
TOKEN = resp["access_token"]
print(f"  ✅ admin 登录成功\n")

# ===== 2. Load Excel =====
print("📖 读取 Excel...")
wb = openpyxl.load_workbook("工具录入清单_待补充.xlsx")
ws = wb.active
tools = []
for row in ws.iter_rows(min_row=2, values_only=True):
    if row[0] and str(row[0]).startswith("G-"):
        tools.append({
            "tool_code": str(row[0]).strip(),
            "tool_name": str(row[1]).strip() if row[1] else "",
            "cat":       str(row[2]).strip() if row[2] else "",
            "wh":        str(row[3]).strip() if row[3] else "主仓库",
            "shelf":     str(row[4]).strip() if row[4] else "",
            "loc":       str(row[5]).strip() if row[5] else "",
        })
print(f"  ✅ {len(tools)} 条记录\n")

# ===== 3. Categories =====
print("📂 分类...")
CAT_CODES = {"电动工具": "DDGJ", "手动工具": "SDGJ", "仪表": "YB"}
existing = api("GET", "/tool-categories") or []
cat_map = {c["category_name"]: c["category_id"] for c in existing}
for cn, cc in CAT_CODES.items():
    if cn in cat_map:
        print(f"  ✓ {cn} (id={cat_map[cn]})")
        continue
    r = api("POST", "/tool-categories", {"category_name": cn, "category_code": cc})
    if r:
        cat_map[cn] = r["category_id"]
        print(f"  ✅ 新建: {cn} [{cc}] (id={cat_map[cn]})")

# ===== 4. Warehouse =====
print("\n🏭 仓库...")
existing = api("GET", "/warehouses") or []
wh_map = {w["warehouse_name"]: w["warehouse_id"] for w in existing}
needed = set(t["wh"] for t in tools)
for wn in needed:
    if wn in wh_map:
        print(f"  ✓ {wn} (id={wh_map[wn]})")
        continue
    r = api("POST", "/warehouses", {"warehouse_name": wn, "warehouse_code": wn})
    if r:
        wh_map[wn] = r["warehouse_id"]
        print(f"  ✅ 新建: {wn} (id={wh_map[wn]})")

MAIN_WH_ID = wh_map.get("主仓库")

# ===== 5. Shelves =====
print("\n📦 货架...")
SHELF_MAP = {"1号货架": "HJ-01", "2号货架": "HJ-02", "3号货架": "HJ-03"}
existing = api("GET", "/shelves") or []
shelf_map = {s["shelf_name"]: s["shelf_id"] for s in existing}
needed = set(t["shelf"] for t in tools)
for sn in needed:
    if sn in shelf_map:
        print(f"  ✓ {sn} (id={shelf_map[sn]})")
        continue
    sc = SHELF_MAP.get(sn, sn)
    r = api("POST", "/shelves", {"shelf_name": sn, "shelf_code": sc, "warehouse_id": MAIN_WH_ID})
    if r:
        shelf_map[sn] = r["shelf_id"]
        print(f"  ✅ 新建: {sn} [{sc}] (id={shelf_map[sn]})")

# ===== 6. Storage Locations =====
print("\n📍 货位...")
existing = api("GET", "/storage-locations") or []
loc_map = {l["location_name"]: l["location_id"] for l in existing}
needed = sorted(set(t["loc"] for t in tools))

def loc_code(ln):
    """'1号货架-1层' -> 'HJ01-01'"""
    parts = ln.split("-")
    shelf_num = parts[0][0]  # "1"
    layer_num = parts[-1][0] if parts[-1][0].isdigit() else parts[-1]
    return f"HJ{shelf_num.zfill(2)}-{str(layer_num).zfill(2)}"

for ln in needed:
    if ln in loc_map:
        print(f"  ✓ {ln} (id={loc_map[ln]})")
        continue
    shelf_name = ln.rsplit("-", 1)[0]  # "1号货架-1层" -> "1号货架"
    sid = shelf_map.get(shelf_name)
    lc = loc_code(ln)
    r = api("POST", "/storage-locations", {
        "location_name": ln, "location_code": lc,
        "warehouse_id": MAIN_WH_ID, "shelf_id": sid
    })
    if r:
        loc_map[ln] = r["location_id"]
        print(f"  ✅ 新建: {ln} [{lc}] (id={loc_map[ln]})")
    else:
        print(f"  ❌ 失败: {ln}")

# ===== 7. Import Tools =====
print(f"\n{'='*55}")
print(f"🔧 批量导入 {len(tools)} 件工具...")
print(f"{'='*55}")

ok = 0
fail = 0
errs = []

for i, t in enumerate(tools):
    data = {
        "tool_code": t["tool_code"],
        "tool_name": t["tool_name"],
        "category_id": cat_map.get(t["cat"]),
        "warehouse_id": MAIN_WH_ID,
        "shelf_id": shelf_map.get(t["shelf"]),
        "storage_location_id": loc_map.get(t["loc"]),
        "status": "available",
    }
    r = api("POST", "/tools", data)
    if r and "tool_id" in r:
        ok += 1
    else:
        fail += 1
        errs.append(f"{t['tool_code']} {t['tool_name']}")

    if (i + 1) % 25 == 0:
        print(f"  [{i+1:3d}/{len(tools)}] ✅{ok} ❌{fail}")

# final line
print(f"  [{len(tools)}/{len(tools)}] ✅{ok} ❌{fail}")

print(f"\n{'='*55}")
print(f"📊 导入完成: {ok}/{len(tools)} 成功" + (f", {fail} 失败" if fail else ""))
if errs:
    print(f"\n失败明细 (前10):")
    for e in errs[:10]:
        print(f"  ❌ {e}")
    if len(errs) > 10:
        print(f"  ... 及其他 {len(errs)-10} 条")
