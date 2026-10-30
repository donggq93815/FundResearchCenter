# -*- coding: utf-8 -*-
"""
基金智库工作台 · 数据服务主入口
========================================================================
用法：
  python run.py                     # 拉取活跃基金 + 指数，交叉验证后输出 funds.json
  python run.py --codes 110022,161725   # 指定基金代码（用户正在查看的基金）

三源流程：
  主源 A（东方财富）+ 验证源 B（盈米，可选）+ 兜底源 C（蛋卷）
  → cross_validate.validate() 逐字段比对 → 输出 output/funds.json

控流策略：
  - 指数行情：仅主源 A，交易日内定时刷新
  - 基金净值：主源 A + 兜底源 C 全量拉取；验证源 B（盈米）仅对
    活跃客户持仓基金 + 正在查看基金做比对，不全市场拉取
"""

import argparse
import json
import os
import sys

import config
import cross_validate
import fetch_akshare as src_a
import fetch_danjuan as src_c
import fetch_yingmi as src_b


def load_active_codes():
    """加载活跃客户持仓基金代码（默认清单，可由业务层注入）。"""
    codes = list(config.ACTIVE_FUND_CODES)
    # 兜底：读取 config 同目录 active_funds.txt（每行一个代码）
    f = os.path.join(config.BASE_DIR, "active_funds.txt")
    if os.path.exists(f):
        with open(f, "r", encoding="utf-8") as fh:
            for line in fh:
                c = line.strip()
                # 过滤空行与注释行
                if not c or c.startswith("#"):
                    continue
                if c not in codes:
                    codes.append(c)
    return codes


def validate_one(code, b_nav=None, b_basic=None):
    """对单只基金做三源交叉验证，返回统一结果 dict。"""
    # 主源 A
    a_nav = src_a.fetch_fund_nav(code)
    # 兜底源 C
    c_nav = src_c.fetch_fund_nav(code)
    c_basic = src_c.fetch_fund_basic(code)
    # 验证源 B（批量预取，由调用方传入）
    if b_nav is None:
        b_nav = src_b.fetch_fund_nav(code)
    if b_basic is None:
        b_basic = src_b.fetch_fund_basic(code)

    name = ""
    if c_basic:
        name = c_basic.get("name", "")
    elif b_basic:
        name = b_basic.get("name", "")

    records = [a_nav, b_nav, c_nav]
    scale_records = [c_basic, b_basic]

    result = cross_validate.validate(code, records, name=name,
                                     scale_records=scale_records)

    # 标记各源健康状态（拉取失败 -> 该源在 sources 中缺省，前端可见）
    if a_nav is None:
        result.setdefault("_a_down", True)
    if b_nav is None:
        result.setdefault("_b_down", True)
    if c_nav is None:
        result.setdefault("_c_down", True)
    return result


def main():
    parser = argparse.ArgumentParser(description="基金智库数据服务")
    parser.add_argument("--codes", type=str, default="",
                        help="逗号分隔的基金代码（用户正在查看的基金）")
    parser.add_argument("--all", action="store_true",
                        help="同时拉取全市场公募基金列表（约2万只，输出 all_funds.json）")
    args = parser.parse_args()

    codes = load_active_codes()
    if args.codes:
        for c in args.codes.split(","):
            c = c.strip()
            if c and c not in codes:
                codes.append(c)

    if not codes:
        print("[warn] 未找到活跃基金代码，使用示例代码 110022,161725")
        codes = ["110022", "161725"]

    print("== 拉取基金（%d 只）三源交叉验证 ==" % len(codes))

    # 盈米（验证源 B）批量预取，避免逐只调用
    b_nav_map = src_b.fetch_funds_nav_batch(codes) if config.YINGMI_API_KEY else {}
    b_basic_map = src_b.fetch_funds_basic_batch(codes) if config.YINGMI_API_KEY else {}

    funds = []
    for code in codes:
        try:
            r = validate_one(code, b_nav=b_nav_map.get(code),
                             b_basic=b_basic_map.get(code))
            funds.append(r)
            flag = "⚠冲突" if r["conflict"] else "✓一致"
            srcs = "/".join(s["name"] for s in r["sources"])
            print("  %s %s [%s] nav=%s date=%s" % (
                code, flag, srcs, r["nav"], r["nav_date"]))
        except Exception as e:  # noqa: BLE001
            print("  %s 处理失败: %s" % (code, e))
            funds.append({"code": code, "error": str(e), "conflict": True,
                          "sources": []})

    # 指数行情（仅主源 A）
    print("\n== 拉取指数行情（主源 A） ==")
    indexes = src_a.fetch_index_spot()
    for i in indexes:
        print("  %s %s price=%s pct=%s%%" % (i["code"], i["name"], i["price"], i["pct"]))

    # 汇总输出
    payload = {
        "generated_at": _now(),
        "funds": funds,
        "indexes": indexes,
        "meta": {
            "sources": ["东方财富(主)", "盈米(验证)", "蛋卷(兜底)"],
            "yingmi_enabled": bool(config.YINGMI_API_KEY),
            "note": "三源交叉验证：不一致时前端并排列出各源数据，不静默取值",
        },
    }
    out_path = os.path.join(config.OUTPUT_DIR, "funds.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print("\n[ok] 已输出 -> %s" % out_path)


def run_all_market():
    """拉取全市场公募基金列表（独立步骤，数据量大，单独文件输出）。"""
    import datetime
    import fetch_all_market
    print("\n== 拉取全市场公募基金列表（主源快照） ==")
    result = fetch_all_market.fetch_all_market()
    print("  全市场共 %d 只（实得 %d 只）" % (result["total"], len(result["funds"])))

    out_path = os.path.join(config.OUTPUT_DIR, "all_funds.json")
    payload = {
        "generated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total": result["total"],
        "categories": result["categories"],
        "funds": result["funds"],
        "source": "东方财富",
        "note": "全市场公募基金列表（主源快照），三源交叉验证仅针对活跃/查看中基金",
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    print("[ok] 已输出 -> %s（%.2f MB）" % (out_path, os.path.getsize(out_path) / 1024 / 1024))


def _now():
    import datetime
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


if __name__ == "__main__":
    import sys
    main()
    if "--all" in sys.argv:
        run_all_market()
