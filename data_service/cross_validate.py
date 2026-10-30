# -*- coding: utf-8 -*-
"""
交叉验证引擎
========================================================================
对同一基金代码，将主源 A（东方财富）、验证源 B（盈米）、兜底源 C（蛋卷）
的净值数据逐字段比对，按容差阈值判定一致性，输出统一结构：

  {
    "code": "110022",
    "name": "...",
    "nav": 2.767,            # 采用的最终值（adopted_source 决定）
    "acc_nav": 2.767,
    "nav_date": "2026-10-28",
    "pct": -0.82,
    "adopted_source": "东方财富",
    "conflict": false,       # 是否存在不一致
    "conflicts": [...],      # 不一致字段明细
    "sources": [             # 各源原始数据（供前端并排展示）
      {"name": "东方财富", "nav": 2.767, "acc_nav": 2.767, "nav_date": "...", "pct": -0.82, "status": "ok"},
      ...
    ]
  }

一致性判定阈值（config）：
  - 单位净值 / 累计净值：绝对差 < NAV_TOLERANCE(0.0001)
  - 日涨跌幅：差值 < PCT_TOLERANCE(0.01 个百分点)
  - 净值日期：完全一致
  - 规模：相对差 < SCALE_TOL(1%)

采用策略：
  - 三源/双源一致 → 采用主源 A（东方财富）
  - 多数一致、单源偏离 → 采多数值，标记偏离源
  - 全不一致 → 不静默取值，采用主源 A 但 conflict=True，前端并排展示
"""

import config

# 需要比对的数值字段及其比对类型
_COMPARE_FIELDS = {
    "nav": "abs",        # 单位净值，绝对差
    "acc_nav": "abs",    # 累计净值，绝对差
    "pct": "abs",        # 日涨跌幅，绝对差
    "nav_date": "eq",    # 净值日期，完全一致
    "scale": "rel",      # 规模，相对差
}

# 主源优先级（用于 adopted 决策）
_SOURCE_PRIORITY = ["东方财富", "天天基金", "盈米", "蛋卷"]


def _consistent(field, values):
    """
    判断一组数值是否"一致"。
    values: [{"name":.., "value":..}, ...]，仅含非 None 值。
    """
    if len(values) < 2:
        return True
    kind = _COMPARE_FIELDS[field]
    base = values[0]["value"]
    for v in values[1:]:
        val = v["value"]
        if kind == "abs":
            if abs(val - base) >= config.NAV_TOLERANCE:
                return False
        elif kind == "eq":
            if str(val) != str(base):
                return False
        elif kind == "rel":
            if base not in (None, 0):
                if abs(val - base) / abs(base) >= config.SCALE_TOL:
                    return False
    return True


def _pick_value(field, records):
    """
    从各源记录中选一个"采用值"。
    records: [{name, nav, acc_nav, nav_date, pct, scale, ...}, ...]
    优先取主源，主源缺失则按优先级取第一个非 None。
    """
    for name in _SOURCE_PRIORITY:
        for r in records:
            if r["name"] == name and r.get(field) is not None:
                return r[field]
    for r in records:
        if r.get(field) is not None:
            return r[field]
    return None


def validate(code, records, name="", scale_records=None):
    """
    交叉验证主入口。
    records: 各源净值 dict 列表（来自 fetch_*.fetch_fund_nav 的返回值，
             为 None 的已由调用方过滤）。
    scale_records: 各源基本信息 dict 列表（含 scale 字段，可选）。
    """
    valid = [r for r in records if r is not None]
    # 过滤掉 nav 为 None 的记录
    valid = [r for r in valid if r.get("nav") is not None]

    conflicts = []
    sources = []

    for r in valid:
        sources.append({
            "name": r.get("source", "?"),
            "nav": r.get("nav"),
            "acc_nav": r.get("acc_nav"),
            "nav_date": r.get("nav_date", ""),
            "pct": r.get("pct"),
            "status": "ok",
        })

    # 逐字段比对
    for field, kind in _COMPARE_FIELDS.items():
        if field == "scale":
            # 规模来自 scale_records，单独处理
            continue
        vals = []
        for r in valid:
            v = r.get(field)
            if v is not None:
                vals.append({"name": r.get("source"), "value": v})
        if len(vals) >= 2 and not _consistent(field, vals):
            conflicts.append({
                "field": field,
                "values": {v["name"]: v["value"] for v in vals},
            })

    # 规模比对（若提供）
    if scale_records:
        srecs = [s for s in scale_records if s and s.get("scale") is not None]
        svals = [{"name": s.get("source"), "value": s["scale"]} for s in srecs]
        if len(svals) >= 2 and not _consistent("scale", svals):
            conflicts.append({
                "field": "scale",
                "values": {v["name"]: v["value"] for v in svals},
            })
        # 规模并入 sources（供前端展示）
        for s in srecs:
            for src in sources:
                if src["name"] == s.get("source"):
                    src["scale"] = s["scale"]

    # 决定采用值（默认主源，主源缺失降级）
    adopted_source = None
    for nm in _SOURCE_PRIORITY:
        for r in valid:
            if r.get("source") == nm:
                adopted_source = nm
                break
        if adopted_source:
            break
    if adopted_source is None and valid:
        adopted_source = valid[0]["source"]

    result = {
        "code": code,
        "name": name,
        "nav": _pick_value("nav", valid),
        "acc_nav": _pick_value("acc_nav", valid),
        "nav_date": _pick_value("nav_date", valid),
        "pct": _pick_value("pct", valid),
        "adopted_source": adopted_source,
        "conflict": len(conflicts) > 0,
        "conflicts": conflicts,
        "sources": sources,
    }
    return result
