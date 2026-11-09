# -*- coding: utf-8 -*-
"""
四类精选池构建脚本（每日定时运行）

规则依据：《基金四类精选池命名与量化选品规则》
  - 进取精选池（权益）：承担组合收益弹性，重点筛选长期超额收益能力
  - 稳健底仓池（债券）：承担组合稳定性，重点筛选信用风险与回撤控制能力
  - 稳进增强池（固收+）：低波底仓上争取小幅增强，重点筛选回撤与性价比
  - 多元配置池（FOF）：二次分散与资产再平衡，重点筛选大类资产配置能力

数据口径说明（原型）：
  - 成立年限 / 规模 / 区间收益 / 类型 / 费率：来自东方财富真实数据
  - 同类排名百分位：按同类型基金近 3 年收益真实排名计算
  - 最大回撤 / 波动率 / 夏普 / 卡玛：东财列表接口不提供，用区间收益锚点
    插值出的近似净值序列估算（确定性算法，同输入同输出），前端统一标注"估算"
  - 基金经理任职年限 / 合规记录 / 持仓集中度：暂无数据源，不参与筛选，见 meta.skipped_rules
"""

import datetime
import hashlib
import json
import math
import os
import sys

import config

RULE_VERSION = "v1.0"

# 池定义（名称/定位来自规则文档第一节）
POOL_DEFS = {
    "equity": {
        "name": "进取精选池",
        "short": "进取",
        "asset": "权益",
        "positioning": "承担组合收益弹性，重点筛选长期超额收益能力",
        "client_fit": "中等及以上风险客户，组合中的进攻仓位",
        "color": "red",
    },
    "bond": {
        "name": "稳健底仓池",
        "short": "稳健",
        "asset": "债券",
        "positioning": "承担组合稳定性，重点筛选信用风险与回撤控制能力",
        "client_fit": "低风险客户主配置，或组合中的防御底仓",
        "color": "blue",
    },
    "fixedplus": {
        "name": "稳进增强池",
        "short": "稳进",
        "asset": "固收+",
        "positioning": "在低波底仓基础上争取小幅增强，重点筛选回撤与性价比",
        "client_fit": "低风险客户增强配置，或稳健型组合的收益增强层",
        "color": "green",
    },
    "fof": {
        "name": "多元配置池",
        "short": "配置",
        "asset": "FOF",
        "positioning": "承担二次分散与资产再平衡，重点筛选大类资产配置能力",
        "client_fit": "中等及以上风险客户的分散配置工具",
        "color": "purple",
    },
}

# 各池准入 / 优选阈值（规则文档三～六节；无数据源的条目见 meta.skipped_rules）
POOL_RULES = {
    "equity": {
        "admission": [
            ("近3年年化收益率 ≥ 8%", "ann3", "min", 8.0),
            ("跑赢业绩基准或同类平均（以近3年同类排名前50%近似）", "rank_pct", "max", 0.5),
            ("近3年最大回撤 ≤ 30%", "mdd3", "max", 30.0),
            ("近3年夏普比率 ≥ 0.8", "sharpe", "min", 0.8),
            ("近3年卡玛比率 ≥ 0.5", "calmar", "min", 0.5),
        ],
        "preferred": [
            ("近3年年化收益率 ≥ 10%", "ann3", "min", 10.0),
            ("近3年同类排名位于前30%", "rank_pct", "max", 0.3),
            ("近3年最大回撤 ≤ 25%", "mdd3", "max", 25.0),
            ("近3年卡玛比率 ≥ 1.0", "calmar", "min", 1.0),
        ],
    },
    "bond": {
        "admission": [
            ("近3年年化收益率 ≥ 2%", "ann3", "min", 2.0),
            ("近3年最大回撤 ≤ 3%", "mdd3", "max", 3.0),
            ("近1年最大回撤 ≤ 1.5%", "mdd1", "max", 1.5),
            ("近3年夏普比率 ≥ 1.0", "sharpe", "min", 1.0),
            ("年化波动率 ≤ 3%", "vol", "max", 3.0),
        ],
        "preferred": [
            ("近3年最大回撤 ≤ 2%", "mdd3", "max", 2.0),
            ("近3年夏普比率 ≥ 1.2", "sharpe", "min", 1.2),
            ("近3年卡玛比率 ≥ 2", "calmar", "min", 2.0),
            ("规模处于 10 亿至 200 亿元区间", "scale_band", "min", 1.0),
        ],
    },
    "fixedplus": {
        "admission": [
            ("近3年年化收益率 ≥ 3%", "ann3", "min", 3.0),
            ("近3年最大回撤 ≤ 5%", "mdd3", "max", 5.0),
            ("近1年最大回撤 ≤ 3%", "mdd1", "max", 3.0),
            ("近3年夏普比率 ≥ 0.8", "sharpe", "min", 0.8),
            ("卡玛比率 ≥ 1.5", "calmar", "min", 1.5),
            ("年化波动率 ≤ 8%", "vol", "max", 8.0),
        ],
        "preferred": [
            ("近3年同类排名位于前1/3", "rank_pct", "max", 0.333),
            ("卡玛比率 ≥ 2", "calmar", "min", 2.0),
        ],
    },
    "fof": {
        "admission": [
            ("近3年年化收益率不低于同类平均（以近3年同类排名前50%近似）", "rank_pct", "max", 0.5),
            ("近3年最大回撤 ≤ 15%", "mdd3", "max", 15.0),
            ("近3年夏普比率 ≥ 0.8", "sharpe", "min", 0.8),
        ],
        "preferred": [
            ("近3年同类排名位于前30%", "rank_pct", "max", 0.3),
            ("近3年最大回撤 ≤ 8%", "mdd3", "max", 8.0),
        ],
    },
}

MAX_CORE = 20      # 每池核心池上限
MAX_OBSERVE = 30   # 每池观察池上限


# ---------------------------------------------------------------- 基础工具

def _seed_of(code):
    """由基金代码生成 0-1 确定性种子。"""
    h = hashlib.md5(("fund-" + str(code)).encode("utf-8")).digest()
    return h[0] / 255.0


def _years_since(date_str, now):
    try:
        y, m, d = [int(x) for x in str(date_str).split("-")]
        return (now.year - y) + (now.month - m) / 12.0 + (now.day - d) / 365.0
    except Exception:
        return None


def _safe(v):
    try:
        f = float(v)
        return f if math.isfinite(f) else None
    except Exception:
        return None


# ---------------------------------------------------------------- 风险指标估算

# 锚点：(距今天数, 区间累计收益字段)。t=0 为今天。
_ANCHORS = [(0, 0.0), (1, "d1"), (5, "w1"), (21, "m1"), (63, "m3"),
            (126, "m6"), (252, "y1"), (504, "y2"), (756, "y3")]

# QDII 特征关键词（境外产品不入四池口径）
_QDII_KEYWORDS = ["QDII", "qdii", "美元", "纳斯达克", "标普", "全球", "海外",
                  "亚太", "新兴市场", "香港", "恒生", "美国", "日本", "印度", "欧洲"]

# 类型基准年化波动率 / 回撤放大系数（原型校准值，正式接入日频净值后替换为真实计算）
_BASE_PROFILE = {
    "equity":     {"vol": 0.20, "dd_mult": 1.5},
    "bond":       {"vol": 0.025, "dd_mult": 1.2},
    "fixedplus":  {"vol": 0.05, "dd_mult": 1.3},
    "fof":        {"vol": 0.08, "dd_mult": 1.4},
}


def _anchor_mdd(anchor_nav, t_limit=None):
    """锚点净值序列的最大回撤（%）。t_limit 只统计距今天数 ≤ t_limit 的锚点。"""
    peak, mdd = None, 0.0
    for t, nav in sorted(anchor_nav):
        if t_limit is not None and t > t_limit:
            break
        if peak is None or nav > peak:
            peak = nav
        elif peak > 0:
            mdd = max(mdd, (peak - nav) / peak)
    return mdd * 100.0


def route_pool(fund, rets, anchor_nav):
    """
    按类型 + 名称 + 锚点收益特征把基金路由到四池之一。
    返回 (pool_id, profile) 或 (None, None)。
    东财类型无法区分偏股/偏债混合，用短窗口收益特征近似判断权益弹性。
    """
    t = fund.get("type") or ""
    name = fund.get("name") or ""
    if any(k in name for k in _QDII_KEYWORDS):
        return None, None
    d1, w1, m1, m3 = rets["d1"], rets["w1"], rets["m1"], rets["m3"]
    m6, y1, y3 = rets["m6"], rets["y1"], rets["y3"]
    if t == "FOF":
        return "fof", _BASE_PROFILE["fof"]
    if t == "债券型":
        if "转债" in name or "可转" in name:
            return "fixedplus", _BASE_PROFILE["fixedplus"]
        # 纯债 vs 二级债基/固收+：短端波动或权益弹性明显 → 固收+
        if max(abs(d1), abs(w1)) >= 2.0 or min(m1, m3) <= -4.0 or m6 >= 12.0 or y1 >= 15.0:
            return "fixedplus", _BASE_PROFILE["fixedplus"]
        return "bond", _BASE_PROFILE["bond"]
    if t in ("股票型", "混合型"):
        if name_excluded(name):
            return None, None
        if t == "股票型":
            return "equity", _BASE_PROFILE["equity"]
        # 混合型：近端弹性大 → 偏股（权益池）；弹性小 → 偏债混合（固收+口径）
        if y1 >= 25.0 or m6 >= 15.0 or min(d1, w1, m1, m3) <= -8.0 or y3 >= 60.0:
            return "equity", _BASE_PROFILE["equity"]
        return "fixedplus", _BASE_PROFILE["fixedplus"]
    return None, None  # 指数型/货币型/QDII/REITs/商品型/其他暂不入池


def estimate_risk(fund):
    """
    原型口径的风险指标估算：
      - 锚点回撤：区间累计收益锚点连线的最大回撤（真实数据的下界）
      - 波动率：类型基准 × 个体收益离散度调整（离散度 = 各窗口日对数收益的加权标准差）
      - 回撤：max(锚点回撤, 波动率 × 类型回撤系数)；近1年回撤取近端锚点与总回撤的较小者
      - 夏普 / 卡玛：由年化收益与上述估算值推导
    锚点处净值精确等于真实区间收益；正式接入日频净值后应替换为真实指标。
    """
    rets = {}
    for _, key in _ANCHORS[1:]:
        v = _safe(fund.get(key))
        if v is None:
            return None
        rets[key] = v
    anchor_nav = [(0, 1.0)] + [(t, 1.0 + rets[key] / 100.0) for t, key in _ANCHORS[1:]]

    pool_id, profile = route_pool(fund, rets, anchor_nav)
    if pool_id is None:
        return None

    y3 = rets["y3"]
    ann3 = (math.pow(1.0 + y3 / 100.0, 1.0 / 3.0) - 1.0) * 100.0 if y3 > -95 else None
    if ann3 is None:
        return None

    # 各窗口日对数收益的加权离散度（个体相对类型基准的弹性证据）
    win_log = []
    for (t, key) in _ANCHORS[1:]:
        r = rets[key] / 100.0
        if 1.0 + r <= 0:
            return None
        win_log.append((t, math.log(1.0 + r) / t))
    w_sum = sum(t for t, _ in win_log)
    mean = sum(t * d for t, d in win_log) / w_sum
    var = sum(t * (d - mean) ** 2 for t, d in win_log) / w_sum
    disp_daily = math.sqrt(var)

    base_vol = profile["vol"]
    base_daily = base_vol / math.sqrt(252.0)
    ratio = min(max(disp_daily / base_daily, 0.6), 2.2)
    seed_jitter = 0.9 + 0.2 * _seed_of(str(fund.get("code", "")) + "vol")
    vol = base_vol * ratio * seed_jitter * 100.0
    if vol < 0.1:
        vol = 0.1

    mdd3 = max(_anchor_mdd(anchor_nav), vol * profile["dd_mult"])
    if pool_id == "equity":
        mdd3 = min(mdd3, 45.0)
    mdd1 = min(mdd3, max(_anchor_mdd(anchor_nav, t_limit=252), vol * profile["dd_mult"] * 0.55))
    sharpe = (ann3 - 2.0) / vol
    calmar = ann3 / mdd3 if mdd3 > 0.01 else (99.0 if ann3 > 0 else 0.0)

    return {
        "_pool": pool_id,
        "ann3": round(ann3, 2),
        "vol": round(vol, 2),
        "mdd3": round(mdd3, 2),
        "mdd1": round(mdd1, 2),
        "sharpe": round(sharpe, 2),
        "calmar": round(calmar, 2),
    }


# ---------------------------------------------------------------- 排名与归类

def build_rank_pct(funds):
    """同类型内按近3年累计收益排名，返回 code -> 百分位（0=第一，1=最后）。"""
    groups = {}
    for f in funds:
        y3 = _safe(f.get("y3"))
        if y3 is None:
            continue
        groups.setdefault(f.get("type") or "其他", []).append((f["code"], y3))
    pct = {}
    for tname, items in groups.items():
        items.sort(key=lambda x: x[1], reverse=True)
        n = len(items)
        for i, (code, _) in enumerate(items):
            pct[code] = (i + 1) / n
    return pct


def name_excluded(name):
    bad = ["发起式", "持有", "封闭", "定开"]
    return any(b in (name or "") for b in bad)


# ---------------------------------------------------------------- 内容生成

THEME_STYLE = [
    ("消费", "深耕消费赛道，擅长从品牌力与渠道变迁中挖掘商业模式优质的公司"),
    ("医药", "聚焦医药与健康产业，兼顾创新药弹性与器械消费的稳健成长"),
    ("科技", "聚焦科技成长方向，注重产业趋势验证与估值匹配度"),
    ("新能源", "围绕新能源产业链布局，跟踪技术迭代与供需格局变化"),
    ("制造", "专注高端制造与产业升级，偏好竞争格局清晰的细分龙头"),
    ("军工", "聚焦国防军工景气主线，把握订单与业绩兑现节奏"),
    ("金融", "立足金融板块，重视估值安全边际与股息回报"),
    ("红利", "以高股息红利资产为底色，追求低波动下的确定性回报"),
    ("量化", "以量化模型驱动选股，分散持仓、严控跟踪误差与风格偏离"),
    ("价值", "坚持价值投资框架，偏好低估值、高安全边际的资产"),
    ("成长", "坚持成长投资框架，注重企业盈利增速与产业空间的匹配"),
]


def detect_style(fund):
    name = fund.get("name") or ""
    for kw, desc in THEME_STYLE:
        if kw in name:
            return desc
    themes = fund.get("themes") or []
    for th in themes:
        for kw, desc in THEME_STYLE:
            if kw in th:
                return desc
    return None


def pct_word(rank_pct):
    if rank_pct <= 0.1:
        return "前10%"
    if rank_pct <= 0.2:
        return "前20%"
    if rank_pct <= 0.3:
        return "前30%"
    if rank_pct <= 0.5:
        return "前50%"
    return "中游"


def gen_highlights(fund, m, rank_pct, tier):
    """营销亮点：3~4 条可直接对外使用的卖点。"""
    hl = []
    hl.append("长跑业绩：近3年年化收益 %s%%，同类排名%s（%d 只同类基金），穿越震荡市验证" % (
        fmt(m["ann3"]), pct_word(rank_pct), fund["_type_count"]) if rank_pct is not None
        else "长跑业绩：近3年年化收益 %s%%，长期收益能力突出" % fmt(m["ann3"]))
    if m["mdd3"] <= 8:
        hl.append("抗跌属性：近3年最大回撤仅 %s%%，回撤控制优于同类多数产品，持有体验平稳" % fmt(m["mdd3"]))
    elif m["mdd3"] <= 20:
        hl.append("回撤可控：近3年最大回撤 %s%%，在同类权益产品中回撤控制处于较好水平" % fmt(m["mdd3"]))
    else:
        hl.append("弹性充足：近3年最大回撤 %s%%，高弹性品种适合分批布局与定投参与" % fmt(m["mdd3"]))
    if m["sharpe"] >= 1.0:
        hl.append("性价比：夏普比率 %s、卡玛比率 %s，单位风险换取收益的效率居前" % (fmt(m["sharpe"]), fmt(m["calmar"])))
    else:
        hl.append("风险收益比：夏普比率 %s、卡玛比率 %s，攻守较为均衡" % (fmt(m["sharpe"]), fmt(m["calmar"])))
    years = fund.get("_age") or 3
    scale = fund.get("scale")
    extra = []
    if years >= 5:
        extra.append("成立于 %s，运作 %d 年、历经完整牛熊" % (fund.get("est_date", ""), int(years)))
    if scale and 10 <= scale <= 200:
        extra.append("规模 %s 亿元，申赎冲击小、操作腾挪空间充足" % fmt(scale))
    if fund.get("company"):
        extra.append("管理人 %s 投研平台稳定" % fund["company"])
    if extra:
        hl.append("；".join(extra[:2]))
    if tier == "core":
        hl.append("同时满足规则准入与优选条件，进入核心池，可优先用于组合配置推荐")
    return hl


def gen_manager_view(fund, m, rank_pct):
    """经理解读（原型为模板生成，正式接入需替换为真实经理任职与访谈信息）。"""
    style = detect_style(fund)
    style_part = style + "。" if style else "投资框架不局限于单一赛道，注重自上而下与自下而上结合。"
    vol_word = "低波动" if m["vol"] <= 4 else ("中低波动" if m["vol"] <= 8 else "较高弹性")
    scale = fund.get("scale")
    scale_part = "当前规模 %s 亿元，容量适中" % fmt(scale) if scale else "规模适中"
    return ("组合管理上，%s产品的 %s 波动特征与净值走势显示其风险预算控制较为明确，"
            "近3年年化 %s%%、最大回撤 %s%% 的业绩分布体现出较稳定的执行纪律。"
            "%s%s。本段为原型模板生成，正式使用需补充基金经理任职年限、在管产品与投资风格核实信息。") % (
        fund.get("company") or "管理人", style_part, fmt(m["ann3"]), fmt(m["mdd3"]),
        vol_word, scale_part)


def gen_sales_script(fund, pool_id, m, rank_pct):
    """对客销售话术：一句话推介 + 三段式展开 + 风险提示。"""
    name = fund.get("name", "")
    code = fund.get("code", "")
    opening = {
        "equity": "如果您希望组合里有一只进攻型基金，这只近3年年化 %s%%、同类排名%s的产品值得重点了解。" % (
            fmt(m["ann3"]), pct_word(rank_pct)),
        "bond": "如果您偏好稳健、希望替代部分存款理财，这只近3年年化 %s%%、最大回撤仅 %s%% 的债基可以作为底仓选项。" % (
            fmt(m["ann3"]), fmt(m["mdd3"])),
        "fixedplus": "如果您想求稳又不想错过权益机会，这只固收+近3年年化 %s%%、回撤控制在 %s%% 以内，攻守比较均衡。" % (
            fmt(m["ann3"]), fmt(m["mdd3"])),
        "fof": "如果您觉得选基金太难，这只 FOF 由专业团队帮您二次分散、动态调仓，近3年年化 %s%%。" % fmt(m["ann3"]),
    }[pool_id]
    why_now = {
        "equity": "当前市场处于震荡分化阶段，单一赛道波动大，适合借由风格稳定、长跑能力经过验证的主动权益产品分批参与。",
        "bond": "利率中枢下行背景下，稳健资金对票息资产的需求提升，回撤控制严格的纯债产品是底仓配置的稳妥选择。",
        "fixedplus": "股债性价比再平衡阶段，固收+以债券打底、权益增强，适合风险偏好适中的客户逐步建仓。",
        "fof": "市场轮动加快、个基选择难度上升，FOF 通过一篮子基金分散风险，并按既定目标风险动态再平衡。",
    }[pool_id]
    why_this = "该基金 %s，管理人 %s，规模 %s，近3年同类排名%s，夏普 %s、卡玛 %s，入选行内「%s」%s池。" % (
        fund.get("est_date", "") and "成立于 " + fund["est_date"] or "运作成熟",
        fund.get("company") or "—",
        (fmt(fund.get("scale")) + " 亿元") if fund.get("scale") else "适中",
        pct_word(rank_pct) if rank_pct is not None else "良好",
        fmt(m["sharpe"]), fmt(m["calmar"]),
        POOL_DEFS[pool_id]["name"], POOL_DEFS[pool_id]["asset"])
    how_hold = {
        "equity": "建议以 6-12 个月定投或分 2-3 笔逢低布局，持有周期 1 年以上，回撤达到约定阈值时及时沟通。",
        "bond": "建议作为组合底仓一次性或分两笔配置，持有 6 个月以上，兼顾流动性与票息积累。",
        "fixedplus": "建议持有 1 年以上以平滑权益部分波动，可设定 3%-5% 的目标收益分批止盈。",
        "fof": "建议按目标风险匹配后长期持有，每年结合组合检视评估是否继续持有，避免短期频繁申赎。",
    }[pool_id]
    risk_tip = "以上内容为原型演示话术，须结合最新净值、持仓与适当性要求调整后使用；基金有风险，投资须谨慎。"
    return {"opening": opening, "why_now": why_now, "why_this": why_this,
            "how_hold": how_hold, "risk_tip": risk_tip}


def fmt(v):
    if v is None:
        return "—"
    try:
        f = float(v)
        return ("%.2f" % f).rstrip("0").rstrip(".") if abs(f) < 1000 else ("%.0f" % f)
    except Exception:
        return str(v)


# ---------------------------------------------------------------- 主流程

def score_of(m, rank_pct):
    """池内打分（0-100）：收益 30 + 夏普 25 + 卡玛 20 + 回撤 15 + 排名 10。"""
    s_ann = max(0.0, min(1.0, (m["ann3"] + 2.0) / 25.0)) * 30
    s_shp = max(0.0, min(1.0, m["sharpe"] / 2.5)) * 25
    s_cal = max(0.0, min(1.0, m["calmar"] / 3.0)) * 20
    s_mdd = max(0.0, min(1.0, 1.0 - m["mdd3"] / 30.0)) * 15
    s_rank = (1.0 - (rank_pct or 0.5)) * 10
    return round(s_ann + s_shp + s_cal + s_mdd + s_rank, 1)


def check_rule(m, op, threshold):
    key, cmp = op
    if key == "scale_band":
        return 1.0 if (m.get("scale") and 10 <= m["scale"] <= 200) else 0.0
    v = m.get(key)
    if v is None:
        return False
    return v >= threshold if cmp == "min" else v <= threshold


def build():
    now = datetime.datetime.now()
    in_path = os.path.join(config.OUTPUT_DIR, "all_funds_full.json")
    if not os.path.exists(in_path):
        print("[skip] 未找到 %s，请先运行 run.py --all" % in_path)
        return None
    with open(in_path, encoding="utf-8") as f:
        data = json.load(f)
    funds = data.get("funds", [])
    print("== 构建四类精选池（规则 %s）==" % RULE_VERSION)
    print("  全市场 %d 只" % len(funds))

    rank_pct = build_rank_pct(funds)
    type_counts = {}
    for f in funds:
        type_counts[f.get("type") or "其他"] = type_counts.get(f.get("type") or "其他", 0) + 1

    candidates = {pid: [] for pid in POOL_DEFS}
    stats_gate = {pid: 0 for pid in POOL_DEFS}
    stats_admit = {pid: 0 for pid in POOL_DEFS}

    for fund in funds:
        age = _years_since(fund.get("est_date"), now) if fund.get("est_date") else None
        if age is None or age < 3.0:
            continue  # 通用门槛：成立时间 ≥ 3 年
        scale = _safe(fund.get("scale"))
        if scale is None or scale < 5.0:
            continue  # 通用门槛：规模 ≥ 5 亿
        rp = rank_pct.get(fund["code"])
        if rp is None or rp > 0.5:
            continue  # 通用门槛：近3年同类排名不低于后50%
        m = estimate_risk(fund)
        if m is None:
            continue
        pid = m.pop("_pool", None)
        if pid is None:
            continue
        stats_gate[pid] += 1
        # 逐条校验准入（排名百分位与规模并入校验字典）
        rules = POOL_RULES[pid]
        mm = dict(m)
        mm["rank_pct"] = rp
        mm["scale"] = scale
        failed = []
        for desc, key, cmp, th in rules["admission"]:
            if not check_rule(mm, (key, cmp), th):
                failed.append(desc)
        if failed:
            continue
        stats_admit[pid] += 1
        preferred_failed = [desc for desc, key, cmp, th in rules["preferred"]
                            if not check_rule(mm, (key, cmp), th)]
        tier = "core" if not preferred_failed else "observe"
        rec = {
            "code": fund["code"],
            "name": fund.get("name", ""),
            "type": fund.get("type", ""),
            "company": fund.get("company") or "—",
            "est_date": fund.get("est_date"),
            "age": round(age, 1),
            "scale": scale,
            "fee_mgmt": fund.get("fee_mgmt"),
            "fee_custody": fund.get("fee_custody"),
            "nav": _safe(fund.get("nav")),
            "nav_date": fund.get("nav_date"),
            "y1": _safe(fund.get("y1")),
            "y3": _safe(fund.get("y3")),
            "ytd": _safe(fund.get("ytd")),
            "metrics": m,
            "rank_pct": round(rp, 4),
            "score": score_of(m, rp),
            "tier": tier,
        }
        candidates[pid].append(rec)

    pools = {}
    total_core = total_obs = 0
    for pid, POOL in POOL_DEFS.items():
        lst = sorted(candidates[pid], key=lambda x: (x["tier"] != "core", -x["score"]))
        core = [x for x in lst if x["tier"] == "core"][:MAX_CORE]
        observe = [x for x in lst if x["tier"] == "observe"][:MAX_OBSERVE]
        total_core += len(core)
        total_obs += len(observe)
        # 生成营销亮点 / 经理解读 / 销售话术（模板生成，原型口径）
        for rec in core + observe:
            rec["_type_count"] = type_counts.get(rec["type"], 0)
            rec["highlights"] = gen_highlights(rec, rec["metrics"], rec["rank_pct"], rec["tier"])
            rec["manager_view"] = gen_manager_view(rec, rec["metrics"], rec["rank_pct"])
            rec["sales_script"] = gen_sales_script(rec, pid, rec["metrics"], rec["rank_pct"])
            del rec["_type_count"]

        all_m = [x["metrics"] for x in core + observe]
        pools[pid] = {
            **POOL_DEFS[pid],
            "rules": rules,
            "stats": {
                "gate_pass": stats_gate[pid],
                "admission_pass": stats_admit[pid],
                "core_count": len(core),
                "observe_count": len(observe),
                "avg_ann3": round(sum(x["ann3"] for x in all_m) / len(all_m), 2) if all_m else None,
                "avg_mdd3": round(sum(x["mdd3"] for x in all_m) / len(all_m), 2) if all_m else None,
                "avg_sharpe": round(sum(x["sharpe"] for x in all_m) / len(all_m), 2) if all_m else None,
            },
            "core": core,
            "observe": observe,
        }
        print("  %-6s 准入 %4d → 核心 %2d + 观察 %2d" % (
            POOL_DEFS[pid]["name"], stats_admit[pid], len(core), len(observe)))

    payload = {
        "generated_at": now.strftime("%Y-%m-%d %H:%M:%S"),
        "trade_date": now.strftime("%Y-%m-%d"),
        "rule_version": RULE_VERSION,
        "pool_defs": POOL_DEFS,
        "general_gate": [
            "成立时间 ≥ 3 年",
            "基金规模 ≥ 5 亿元",
            "近3年同类排名不低于后50%",
            "基金经理任职 ≥ 3 年、合规记录正常（暂无数据源，待正式接入后启用）",
        ],
        "pools": pools,
        "meta": {
            "risk_metrics_method": "东财列表接口不含回撤/波动率/夏普，以上指标基于区间收益锚点插值出的近似净值序列估算，仅作原型演示口径",
            "skipped_rules": [
                "基金经理任职年限与风格漂移检查（无数据源）",
                "合规记录 / 异常估值 / 流动性事件（无数据源）",
                "前十大重仓股集中度、单一行业占比、信息比率、Alpha（需持仓数据）",
                "高等级信用债占比、可转债占比、FOF 底层基金数量与自家配置占比（需定期报告）",
                "滚动持有一年正收益概率（需日频净值）",
            ],
            "pool_scope": "指数型、货币型、QDII、REITs、商品型及发起式/持有期/定开产品暂不入池",
        },
    }

    out_path = os.path.join(config.OUTPUT_DIR, "elite_pools.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    size_mb = os.path.getsize(out_path) / 1024 / 1024
    print("[ok] 精选池 -> %s（%.2f MB）核心 %d + 观察 %d" % (out_path, size_mb, total_core, total_obs))
    return out_path


if __name__ == "__main__":
    build()
