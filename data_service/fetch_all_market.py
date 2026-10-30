# -*- coding: utf-8 -*-
"""
全市场公募基金列表抓取（东方财富 rankhandler 接口，免费公开，零 token）
========================================================================
拉取全市场约 2 万只公募基金的基础信息，输出 output/all_funds.json。

字段（东财 rankhandler 逗号分隔，索引从 0 起）：
  0 代码  1 名称  2 拼音  3 净值日期  4 单位净值  5 累计净值
  6 日涨跌  7 近1周  8 近1月  9 近3月  10 近6月  11 近1年
  12 近2年  13 近3年  14 今年来  15 成立来  16 成立日期
  17 基金类型代码  19 管理费  20 托管费  22 销售服务费  24 规模(亿)

分类统计（接口返回）：zs 指数 / gp 股票 / hh 混合 / zq 债券 / qdii / fof

说明：
  - 全市场列表用主源（东财）快照，不做三源交叉验证（2 万只三源比对不现实）。
  - 三源交叉验证仍只针对「活跃客户持仓 + 用户正在查看」的基金（见 run.py）。
"""

import json
import re
import os

import requests

import config


RANK_URL = "http://fund.eastmoney.com/data/rankhandler.aspx"

# 基金类型代码 -> 类型名
TYPE_MAP = {
    "1": "股票型", "2": "债券型", "3": "混合型", "4": "货币型",
    "5": "指数型", "6": "QDII", "7": "FOF", "8": "REITs",
    "9": "商品型", "10": "其他",
}

# 收益字段顺序（索引 6 起）
RET_FIELDS = [
    ("d1", "日涨跌"), ("w1", "近1周"), ("m1", "近1月"), ("m3", "近3月"),
    ("m6", "近6月"), ("y1", "近1年"), ("y2", "近2年"), ("y3", "近3年"),
    ("ytd", "今年来"), ("all", "成立来"),
]


def _get(params):
    headers = dict(config.HEADERS)
    headers["Referer"] = "http://fund.eastmoney.com/data/fundranking.html"
    try:
        r = requests.get(RANK_URL, params=params, headers=headers,
                         timeout=config.HTTP_TIMEOUT,
                         proxies={"http": None, "https": None})
        if r.status_code == 200:
            return r.text
    except requests.RequestException:
        pass
    return None


def _f(v):
    """安全转 float。"""
    v = (v or "").replace("%", "").strip()
    if v in ("", "—", "-", "null"):
        return None
    try:
        return float(v)
    except ValueError:
        return None


def parse_record(raw):
    """解析单条逗号分隔记录为 dict。"""
    fields = raw.split(",")
    if len(fields) < 6:
        return None
    code = fields[0].strip()
    if not code or not code.isdigit():
        return None
    rec = {
        "code": code,
        "name": fields[1].strip(),
        "nav_date": fields[3].strip() if len(fields) > 3 else "",
        "nav": _f(fields[4]) if len(fields) > 4 else None,
        "acc_nav": _f(fields[5]) if len(fields) > 5 else None,
    }
    # 收益字段
    for i, (key, _label) in enumerate(RET_FIELDS):
        idx = 6 + i
        rec[key] = _f(fields[idx]) if len(fields) > idx else None
    # 成立日期
    rec["est_date"] = fields[16].strip() if len(fields) > 16 else ""
    # 类型
    rec["type_code"] = fields[17].strip() if len(fields) > 17 else ""
    rec["type"] = TYPE_MAP.get(rec["type_code"], rec["type_code"] or "其他")
    # 规模（亿）：rankhandler 字段 24 可能为规模变动（带符号），负值置 None 避免误导
    raw_scale = _f(fields[24]) if len(fields) > 24 else None
    rec["scale"] = raw_scale if (raw_scale is not None and raw_scale >= 0) else None
    # 费率
    rec["fee_mgmt"] = fields[19].strip() if len(fields) > 19 else ""
    rec["fee_custody"] = fields[20].strip() if len(fields) > 20 else ""
    return rec


def fetch_all_market(page_size=10000, max_pages=None):
    """
    分页拉取全市场基金列表。
    返回 {funds: [...], total: int, categories: {...}}
    """
    # 第一页获取总数
    text = _get({"op": "ph", "dt": "kf", "ft": "all", "rs": "", "gs": 0,
                 "sc": "1nzf", "st": "desc", "sd": "2026-10-28", "ed": "2026-10-29",
                 "qdii": "", "tabSubtype": "", "pi": 1, "pn": 1, "dx": 1})
    if not text:
        return {"funds": [], "total": 0, "categories": {}}

    total = 0
    m = re.search(r"allRecords:(\d+)", text)
    if m:
        total = int(m.group(1))
    all_pages = 1
    m = re.search(r"allPages:(\d+)", text)
    if m:
        all_pages = int(m.group(1))

    # 分类统计
    categories = {}
    for key in ("zs", "gp", "hh", "zq", "qdii", "fof"):
        m = re.search(r"%s_count:(\d+)" % key, text)
        if m:
            categories[key] = int(m.group(1))

    # 计算实际分页数
    pages = all_pages if page_size <= 1 else (total // page_size + (1 if total % page_size else 0))
    if max_pages:
        pages = min(pages, max_pages)

    funds = []
    seen = set()
    for pi in range(1, pages + 1):
        text = _get({"op": "ph", "dt": "kf", "ft": "all", "rs": "", "gs": 0,
                     "sc": "1nzf", "st": "desc", "sd": "2026-10-28", "ed": "2026-10-29",
                     "qdii": "", "tabSubtype": "", "pi": pi, "pn": page_size, "dx": 1})
        if not text:
            continue
        m = re.search(r"datas:\[(.*?)\],allRecords", text, re.S)
        if not m:
            continue
        raw_items = m.group(1).split('","')
        for raw in raw_items:
            raw = raw.strip().strip('"').strip()
            rec = parse_record(raw)
            if rec and rec["code"] not in seen:
                seen.add(rec["code"])
                funds.append(rec)
        print("  分页 %d/%d 完成，累计 %d 只" % (pi, pages, len(funds)))

    return {"funds": funds, "total": total, "categories": categories}


if __name__ == "__main__":
    print("== 拉取全市场公募基金列表 ==")
    result = fetch_all_market()
    print("总数: %d，实得: %d" % (result["total"], len(result["funds"])))
    print("分类:", result["categories"])

    out_path = os.path.join(config.OUTPUT_DIR, "all_funds.json")
    payload = {
        "generated_at": __import__("datetime").datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total": result["total"],
        "categories": result["categories"],
        "funds": result["funds"],
        "source": "东方财富",
        "note": "全市场公募基金列表（主源快照），三源交叉验证仅针对活跃/查看中基金",
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    print("[ok] 已输出 -> %s（%.2f MB）" % (out_path, os.path.getsize(out_path) / 1024 / 1024))
