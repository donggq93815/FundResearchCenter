# -*- coding: utf-8 -*-
"""
兜底源 C：蛋卷基金（免费公开 REST/JSON 接口，纯 requests，零 token）
========================================================================
接口：
  - https://danjuanfunds.com/djapi/fund/{code}            基金基本信息（名称/规模/经理）
  - https://danjuanfunds.com/djapi/fund/nav/history/{code} 历史净值（最新单位/累计净值+涨跌幅）
与主源 A 字段同构，用于交叉验证。
"""

import json

import requests

import config


def _get(url, params=None):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    }
    try:
        r = requests.get(url, params=params, headers=headers,
                         timeout=config.HTTP_TIMEOUT,
                         proxies={"http": None, "https": None})
        if r.status_code == 200:
            return r.json()
    except (requests.RequestException, json.JSONDecodeError):
        pass
    return None


def fetch_fund_nav(code):
    """
    拉取单只基金最新净值（蛋卷 nav/history 接口）。
    返回与主源 A 同构的 dict；失败返回 None。
    """
    url = config.DANJUAN_NAV_URL.format(code=code)
    j = _get(url)
    if not j:
        return None
    data = j.get("data") or {}
    items = data.get("items") or []
    if not items:
        return None
    d = items[0]  # 最新一条
    def _f(v):
        try:
            return float(v) if v not in (None, "") else None
        except (TypeError, ValueError):
            return None

    return {
        "source": "蛋卷",
        "code": code,
        "name": "",
        "nav": _f(d.get("nav")),              # 单位净值
        "acc_nav": None,                       # 蛋卷 nav/history 接口不提供累计净值
        "nav_date": d.get("date", ""),
        "pct": _f(d.get("percentage")),        # 日涨跌幅
        "status": "",
    }


def fetch_fund_basic(code):
    """
    拉取基金基本信息（蛋卷 fund 接口），含名称/规模/经理/类型。
    """
    url = config.DANJUAN_FUND_URL.format(code=code)
    j = _get(url)
    if not j:
        return None
    d = j.get("data") or {}
    if not d:
        return None
    scale_raw = d.get("totshare", "")  # 如 "101.09亿"
    scale = None
    if isinstance(scale_raw, str) and "亿" in scale_raw:
        try:
            scale = float(scale_raw.replace("亿", ""))
        except ValueError:
            scale = None
    return {
        "source": "蛋卷",
        "code": code,
        "name": d.get("fd_name", ""),
        "full_name": d.get("fd_full_name", ""),
        "scale": scale,
        "manager": d.get("manager_name", ""),
        "company": d.get("keeper_name", ""),
        "type": d.get("fd_type", ""),
    }


if __name__ == "__main__":
    for c in ("110022", "161725"):
        print("== 净值", c, "==")
        print(json.dumps(fetch_fund_nav(c), ensure_ascii=False, indent=2))
        print("== 基本信息", c, "==")
        print(json.dumps(fetch_fund_basic(c), ensure_ascii=False, indent=2))
