# -*- coding: utf-8 -*-
"""
主源 A：东方财富（免费公开 REST/JSON 接口，纯 requests，零 token）
========================================================================
功能：
  1. fetch_fund_nav(code)            — 单只基金最新净值（东财 f10/lsjz 接口）
  2. fetch_fund_basic(code)          — 基金基本信息（名称/规模/经理）
  3. fetch_index_spot()              — 指数行情（东财 push2 批量）
所有函数均返回统一 dict 结构，供交叉验证引擎消费。

说明：天天基金 fundgz.1234567.com.cn/js/{code}.js 接口已下线（返回"页面未找到"），
已切换为更稳定的东财 f10/lsjz 历史净值接口（含单位净值/累计净值/日涨跌幅/净值日期）。
"""

import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

import config


def _get(url, params=None, referer=None):
    """带重试的 GET 请求，返回 requests.Response 或 None。"""
    headers = dict(config.HEADERS)
    if referer:
        headers["Referer"] = referer
    last_err = None
    for attempt in range(config.HTTP_RETRY):
        try:
            # 显式禁用系统代理：部分 http 接口会被本机代理(127.0.0.1)拦截
            resp = requests.get(url, params=params, headers=headers,
                                timeout=config.HTTP_TIMEOUT,
                                proxies={"http": None, "https": None})
            if resp.status_code == 200:
                return resp
            last_err = "HTTP %s" % resp.status_code
        except Exception as e:  # noqa: BLE001
            last_err = str(e)
        time.sleep(config.RETRY_BACKOFF ** attempt)
    return None


def fetch_fund_nav(code):
    """
    拉取单只基金最新净值（东财 f10/lsjz 历史净值接口）。
    返回：
      {"source": "东方财富", "code": ..., "name": "", "nav": 单位净值,
       "acc_nav": 累计净值, "nav_date": 净值日期(YYYY-MM-DD),
       "pct": 日涨跌幅, "status": 申购/赎回状态}
    失败返回 None。
    """
    url = config.FUND_NAV_URL
    params = {
        "fundCode": code,
        "pageIndex": 1,
        "pageSize": 1,
        "startDate": "",
        "endDate": "",
    }
    resp = _get(url, params=params, referer="http://fundf10.eastmoney.com/")
    if resp is None:
        return None
    try:
        j = resp.json()
    except json.JSONDecodeError:
        return None
    if j.get("ErrCode") != 0:
        return None
    lst = (j.get("Data") or {}).get("LSJZList") or []
    if not lst:
        return None
    d = lst[0]  # 最新一条
    def _f(v):
        try:
            return float(v) if v not in (None, "") else None
        except (TypeError, ValueError):
            return None

    return {
        "source": "东方财富",
        "code": code,
        "name": "",  # 名称由 fetch_fund_basic 补充
        "nav": _f(d.get("DWJZ")),          # 单位净值
        "acc_nav": _f(d.get("LJJZ")),      # 累计净值
        "nav_date": d.get("FSRQ", ""),     # 净值日期
        "pct": _f(d.get("JZZZL")),         # 日涨跌幅
        "status": "%s/%s" % (d.get("SGZT", ""), d.get("SHZT", "")),
    }


def fetch_fund_basic(code):
    """
    拉取基金基本信息（东财 FundMNFInfo 接口）。
    返回 {"source":..., "code":..., "name":..., "scale": 规模(亿), ...}
    """
    params = {
        "pageIndex": 1,
        "pageSize": 1,
        "plat": "Android",
        "deviceid": "1234567890",
        "product": "EFund",
        "version": "6.2.8",
        "Fcodes": code,
    }
    resp = _get(config.FUND_MNF_URL, params=params,
                referer="http://fundmobapi.eastmoney.com/")
    if resp is None:
        return None
    try:
        j = resp.json()
    except json.JSONDecodeError:
        return None
    datas = j.get("Datas") or []
    if not datas:
        return None
    d = datas[0]
    # 规模单位：接口返回为元，转换为亿元
    scale_raw = d.get("NETNAV")  # 用规模字段兜底，不同版本字段名有差异
    scale = None
    for key in ("ENDNAV", "SCALE", "ASSETVALUE"):
        if d.get(key):
            try:
                scale = round(float(d[key]) / 1e8, 4)
            except (TypeError, ValueError):
                scale = None
            break
    return {
        "source": "天天基金",
        "code": code,
        "name": d.get("SHORTNAME", ""),
        "scale": scale,                                   # 规模（亿元）
        "manager": d.get("JJJL", ""),                     # 基金经理
        "company": d.get("JJGS", ""),                     # 基金公司
        "type": d.get("FTYPE", ""),                       # 基金类型
    }


def fetch_index_spot(codes=None):
    """
    拉取指数行情。
    优先走新浪财经（纯 https 直连稳定），失败时回退东财 push2。
    返回 [{code, name, price, pct, change, ...}, ...]
    """
    # 1) 新浪财经（主用）
    sina = _fetch_index_sina()
    if sina:
        return sina
    # 2) 东财 push2（备用）
    return _fetch_index_eastmoney(codes)


def _fetch_index_sina():
    """新浪财经指数行情（s_sh/s_sz 前缀）。"""
    sina_codes = list(config.SINA_INDEX_CODES.values())
    url = config.SINA_INDEX_URL.format(codes=",".join(sina_codes))
    resp = _get(url, referer="https://finance.sina.com.cn/")
    if resp is None:
        return []
    resp.encoding = "gbk"
    result = []
    for line in resp.text.splitlines():
        m = re.search(r'hq_str_(s_[a-z]{2}\d+)="([^"]*)"', line)
        if not m:
            continue
        sina_code = m.group(1)
        fields = m.group(2).split(",")
        if len(fields) < 4 or not fields[0]:
            continue
        # 反查标准代码
        std_code = None
        for k, v in config.SINA_INDEX_CODES.items():
            if v == sina_code:
                std_code = k
                break
        def _f(v):
            try:
                return float(v)
            except (TypeError, ValueError):
                return None

        result.append({
            "source": "新浪财经",
            "code": std_code or sina_code,
            "name": fields[0],
            "price": _f(fields[1]),
            "change": _f(fields[2]),
            "pct": _f(fields[3]),
            "volume": _f(fields[4]) if len(fields) > 4 else None,
        })
    return result


def _fetch_index_eastmoney(codes=None):
    """东财 push2 批量指数行情（备用）。"""
    codes = codes or config.INDEX_CODES
    secids = ",".join(codes)
    params = {
        "fltt": 2,
        "invt": 2,
        "fields": "f12,f14,f2,f3,f4,f6",
        "secids": secids,
    }
    resp = _get(config.INDEX_SPOT_URL, params=params,
                referer="https://quote.eastmoney.com/")
    if resp is None:
        return []
    try:
        j = resp.json()
    except json.JSONDecodeError:
        return []
    diff = (j.get("data") or {}).get("diff") or []
    result = []
    for item in diff:
        result.append({
            "source": "东方财富",
            "code": item.get("f12", ""),
            "name": item.get("f14", ""),
            "price": item.get("f2"),
            "pct": item.get("f3"),
            "change": item.get("f4"),
            "volume": item.get("f6"),
        })
    return result


def fetch_funds_nav_batch(codes):
    """
    并发拉取多只基金最新净值（受 config.MAX_CONCURRENCY 控制）。
    返回 {code: 净值 dict 或 None}
    """
    result = {}
    with ThreadPoolExecutor(max_workers=config.MAX_CONCURRENCY) as ex:
        futures = {ex.submit(fetch_fund_nav, c): c for c in codes}
        for fut in as_completed(futures):
            c = futures[fut]
            try:
                result[c] = fut.result()
            except Exception:  # noqa: BLE001
                result[c] = None
    return result


if __name__ == "__main__":
    # 自测：拉取两只示例基金 + 指数行情
    print("== 基金最新净值 ==")
    for c in ("110022", "161725"):
        r = fetch_fund_nav(c)
        print(c, "->", json.dumps(r, ensure_ascii=False, indent=2))

    print("\n== 指数行情 ==")
    idx = fetch_index_spot()
    for i in idx:
        print(i)
