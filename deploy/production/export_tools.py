#!/usr/bin/env python3
"""Export 131 tools from local API with names instead of IDs"""
import json, urllib.request, urllib.error

BASE = "http://localhost:3000/api"
TOKEN = None

def api(path):
    req = urllib.request.Request(f"{BASE}{path}")
    if TOKEN:
        req.add_header("Authorization", f"Bearer {TOKEN}")
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())

# Login
login_data = json.dumps({"username": "admin", "password": "123456"}).encode()
req = urllib.request.Request(f"{BASE}/auth/login", data=login_data, headers={"Content-Type": "application/json"})
with urllib.request.urlopen(req) as resp:
    TOKEN = json.loads(resp.read())["access_token"]

# Fetch all
shelves = api("/shelves")
locations = api("/storage-locations")
warehouses = api("/warehouses")
categories = api("/tool-categories")
tools_data = api("/tools?limit=200")
tools = tools_data.get("tools", tools_data) if isinstance(tools_data, dict) else tools_data

shelf_by_id = {s["shelf_id"]: s["shelf_name"] for s in shelves}
loc_by_id = {l["location_id"]: l["location_name"] for l in locations}
wh_by_id = {w["warehouse_id"]: w["warehouse_name"] for w in warehouses}
cat_by_id = {c["category_id"]: c["category_name"] for c in categories}

g_tools = []
for t in tools:
    if not t.get("tool_code", "").startswith("G-"):
        continue
    g_tools.append({
        "tool_code": t["tool_code"],
        "tool_name": t["tool_name"],
        "category_name": cat_by_id.get(t["category_id"], ""),
        "warehouse_name": wh_by_id.get(t["warehouse_id"], "主仓库"),
        "shelf_name": shelf_by_id.get(t["shelf_id"], ""),
        "location_name": loc_by_id.get(t["storage_location_id"], ""),
        "status": t.get("status", "available"),
        "description": t.get("description", ""),
        "scene": t.get("scene", ""),
    })

with open("deploy/production/tools-data.json", "w", encoding="utf-8") as f:
    json.dump(g_tools, f, ensure_ascii=False)

print(f"{len(g_tools)} tools exported")
print(json.dumps(g_tools[0], ensure_ascii=False))
print(json.dumps(g_tools[-1], ensure_ascii=False))
