# -*- coding: utf-8 -*-
"""
全市场数据瘦身（生成精简版 all_funds.json）
============================================
把 rankhandler 原始字段名改为短字段名、省略空字段，减小文件体积，
加速前端加载（8.5MB -> 约 4.8MB，降 ~44%）。

短字段名映射（前端 fund.js 需同步适配）：
  code->c  name->n  type->t  nav_date->nd  nav->nav  acc_nav->an
  d1->d1 w1->w1 m1->m1 m3->m3 m6->m6 y1->y1 y2->y2 y3->y3 ytd->ytd all->all
  est_date->ed  scale->s  fee_mgmt->fm  fee_custody->fc
  company->co  industry->ind  themes->th
"""

import json
import os

import config


def slim_record(f):
    """把单只基金记录转为精简版（省略 None/空字段）。"""
    r = {"c": f["code"], "n": f.get("name", ""), "t": f.get("type", "其他")}
    if f.get("nav_date"):
        r["nd"] = f["nav_date"]
    if f.get("nav") is not None:
        r["nav"] = f["nav"]
    if f.get("acc_nav") is not None:
        r["an"] = f["acc_nav"]
    for k in ("d1", "w1", "m1", "m3", "m6", "y1", "y2", "y3", "ytd", "all"):
        if f.get(k) is not None:
            r[k] = f[k]
    if f.get("est_date"):
        r["ed"] = f["est_date"]
    if f.get("scale") is not None:
        r["s"] = f["scale"]
    if f.get("fee_mgmt"):
        r["fm"] = f["fee_mgmt"]
    if f.get("fee_custody"):
        r["fc"] = f["fee_custody"]
    if f.get("company"):
        r["co"] = f["company"]
    if f.get("industry"):
        r["ind"] = f["industry"]
    if f.get("themes"):
        r["th"] = f["themes"]
    return r


def slim_all_market(in_path=None, out_path=None):
    """读取完整版 all_funds.json，输出精简版。"""
    if in_path is None:
        in_path = os.path.join(config.OUTPUT_DIR, "all_funds_full.json")
        if not os.path.exists(in_path):
            in_path = os.path.join(config.OUTPUT_DIR, "all_funds.json")
    if out_path is None:
        out_path = os.path.join(config.OUTPUT_DIR, "all_funds.json")

    d = json.load(open(in_path, encoding="utf-8"))
    funds = d.get("funds", [])
    slim = [slim_record(f) for f in funds]
    payload = {
        "generated_at": d.get("generated_at", ""),
        "total": d.get("total", len(funds)),
        "funds": slim,
        "source": "东方财富",
        "slim": True,
    }
    with open(out_path, "w", encoding="utf-8") as fp:
        json.dump(payload, fp, ensure_ascii=False, separators=(",", ":"))
    return out_path


if __name__ == "__main__":
    out = slim_all_market()
    print("[ok] 精简版已输出 -> %s（%.2f MB）" % (out, os.path.getsize(out) / 1024 / 1024))
