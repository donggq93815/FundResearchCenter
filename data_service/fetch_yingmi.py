# -*- coding: utf-8 -*-
"""
验证源 B：盈米（且慢）—— 免费 MCP 接口（SSE 通道），不消耗 token
========================================================================
协议：MCP over SSE
  1. GET  {base}/mcp/sse?apiKey={key}  建立 SSE 长连接，拿到 sessionId
     （SSE 事件 event: endpoint -> data: /mcp/messages?sessionId=xxx）
  2. POST {base}/mcp/messages?sessionId=xxx  发送 JSON-RPC
     （initialize -> notifications/initialized -> tools/call）
  3. 工具响应通过 SSE 通道异步推送（event: message -> data: {...}）

关键工具（已实测）：
  - BatchGetFundNavHistory：入参 {fundCodes:[...], isDesc:true, dimensionType:'oneMonth'}
    返回文本格式（非 JSON），含 navDate/nav/dailyReturn，需解析。
  - BatchGetFundsDetail：基金详情（规模/基准/风险等级/类型等）。

注意：SSE 连接必须保持存活期间才能 POST，故用后台线程持续读取 SSE 流。
未配置 Key 时 fetch 函数返回 None，由交叉验证引擎降级为双源。
"""

import json
import queue
import re
import threading
import time
import uuid

import requests

import config


# ---------------------------------------------------------------------------
# MCP SSE 客户端
# ---------------------------------------------------------------------------
class YingmiMCPClient:
    """轻量 MCP over SSE 客户端（保持 SSE 连接 + JSON-RPC 调用）。"""

    def __init__(self, api_key=None, base=None, timeout=30):
        self.api_key = api_key or config.YINGMI_API_KEY
        self.base = (base or "https://stargate.yingmi.com").rstrip("/")
        self.timeout = timeout
        self._sess_id = None
        self._resp_q = queue.Queue()
        self._sse_thread = None
        self._msg_url = None
        self._id = 0

    # ---- SSE 连接 ----
    def _sse_reader(self):
        url = "%s/mcp/sse?apiKey=%s" % (self.base, self.api_key)
        try:
            r = requests.get(url, headers={"Accept": "text/event-stream"},
                             timeout=self.timeout * 4,
                             proxies={"http": None, "https": None}, stream=True)
            for raw in r.iter_lines(decode_unicode=False):
                if raw is None:
                    continue
                # 手动 UTF-8 解码（SSE 内容为 UTF-8，requests 默认 latin-1 会乱码中文）
                if isinstance(raw, bytes):
                    try:
                        line = raw.decode("utf-8")
                    except UnicodeDecodeError:
                        line = raw.decode("utf-8", errors="replace")
                else:
                    line = raw
                if line.startswith("data: "):
                    data = line[6:].strip()
                    if "sessionId" in data:
                        m = re.search(r"sessionId=([a-zA-Z0-9-]+)", data)
                        if m:
                            self._sess_id = m.group(1)
                            self._msg_url = "%s/mcp/messages?sessionId=%s" % (
                                self.base, self._sess_id)
                        continue
                    # JSON-RPC 响应
                    try:
                        obj = json.loads(data)
                        self._resp_q.put(obj)
                    except json.JSONDecodeError:
                        pass
        except requests.RequestException:
            pass

    def connect(self):
        if self._sess_id:
            return True
        self._sse_thread = threading.Thread(target=self._sse_reader, daemon=True)
        self._sse_thread.start()
        # 等待 sessionId
        for _ in range(100):
            if self._sess_id:
                return True
            time.sleep(0.1)
        return False

    # ---- JSON-RPC ----
    def _post(self, method, params, rid):
        if not self._msg_url:
            return False
        payload = {"jsonrpc": "2.0", "id": rid, "method": method, "params": params}
        try:
            r = requests.post(self._msg_url, json=payload,
                              headers={"Content-Type": "application/json"},
                              timeout=self.timeout,
                              proxies={"http": None, "https": None})
            return r.status_code in (200, 202)
        except requests.RequestException:
            return False

    def _call(self, method, params, wait=None):
        self._id += 1
        rid = self._id
        if not self._post(method, params, rid):
            return None
        wait = wait or self.timeout
        try:
            while True:
                obj = self._resp_q.get(timeout=wait)
                if obj.get("id") == rid:
                    return obj
        except queue.Empty:
            return None

    def initialize(self):
        if not self.connect():
            return False
        r = self._call("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "fund-think-tank", "version": "1.0"},
        })
        if r is None:
            return False
        # 发送 initialized 通知
        self._post("notifications/initialized", {}, 0)
        time.sleep(0.3)
        return True

    def call_tool(self, tool_name, arguments):
        """调用工具，返回 result.content 中的文本（可能为 JSON 字符串或自定义格式）。"""
        if not self._sess_id and not self.initialize():
            return None
        r = self._call("tools/call", {"name": tool_name, "arguments": arguments})
        if r is None:
            return None
        if "error" in r:
            return None
        result = r.get("result", {})
        content = result.get("content", [])
        for c in content:
            if c.get("type") == "text":
                return c.get("text", "")
        return result


# ---------------------------------------------------------------------------
# 返回文本解析（盈米 BatchGetFundNavHistory 返回自定义文本格式）
# ---------------------------------------------------------------------------
def _parse_nav_text(text):
    """
    解析 BatchGetFundNavHistory 的文本返回，形如：
      [1]:
        - fundCode: "110022"
          data:
            code: "110022"
            data[18]{navDate,nav,dailyReturn}:
              2026年10月28日,2.767,"-0.82%"
              ...
    返回最新一条 {nav, nav_date, pct} 或 None。
    """
    if not text:
        return None
    # 匹配数据行：日期,净值,涨跌幅
    pattern = re.compile(
        r"(\d{4})年(\d{1,2})月(\d{1,2})日\s*,\s*([\d.]+)\s*,\s*[\"]?(-?[\d.]+)%?[\"]?"
    )
    m = pattern.search(text)
    if not m:
        return None
    y, mo, d, nav, pct = m.groups()
    nav_date = "%04d-%02d-%02d" % (int(y), int(mo), int(d))
    return {
        "nav": float(nav),
        "nav_date": nav_date,
        "pct": float(pct),
    }


# ---------------------------------------------------------------------------
# 对外接口（与主源 A / 兜底源 C 字段同构）
# ---------------------------------------------------------------------------
_client = None


def _get_client():
    global _client
    if not config.YINGMI_API_KEY:
        return None
    if _client is None:
        _client = YingmiMCPClient(config.YINGMI_API_KEY)
    return _client


def fetch_fund_nav(code):
    """
    拉取单只基金最新净值（盈米 BatchGetFundNavHistory）。
    返回同构 dict 或 None（无 Key / 失败时降级）。
    """
    client = _get_client()
    if client is None:
        return None
    text = client.call_tool("BatchGetFundNavHistory", {
        "fundCodes": [code],
        "isDesc": True,
        "dimensionType": "oneMonth",
    })
    parsed = _parse_nav_text(text)
    if not parsed:
        return None
    return {
        "source": "盈米",
        "code": code,
        "name": "",
        "nav": parsed["nav"],
        "acc_nav": None,  # 盈米 nav 接口未返回累计净值
        "nav_date": parsed["nav_date"],
        "pct": parsed["pct"],
        "status": "",
    }


def fetch_funds_nav_batch(codes):
    """
    批量拉取多只基金最新净值（盈米 BatchGetFundNavHistory，单次最多 20 只）。
    返回 {code: 净值 dict 或 None}。
    """
    client = _get_client()
    if client is None:
        return {c: None for c in codes}
    result = {}
    # 分批，每批最多 20 只
    for i in range(0, len(codes), 20):
        chunk = codes[i:i + 20]
        text = client.call_tool("BatchGetFundNavHistory", {
            "fundCodes": chunk,
            "isDesc": True,
            "dimensionType": "oneMonth",
        })
        parsed_map = _parse_nav_batch_text(text, chunk)
        for c in chunk:
            p = parsed_map.get(c)
            if not p:
                result[c] = None
                continue
            result[c] = {
                "source": "盈米",
                "code": c,
                "name": "",
                "nav": p["nav"],
                "acc_nav": None,
                "nav_date": p["nav_date"],
                "pct": p["pct"],
                "status": "",
            }
    return result


def _parse_nav_batch_text(text, codes):
    """
    解析 BatchGetFundNavHistory 批量返回的文本，按 fundCode 分段。
    返回 {code: {nav, nav_date, pct}}。
    """
    result = {}
    if not text:
        return result
    # 文本形如：
    #   [1]:
    #     - fundCode: "519300"
    #       data: ... data[N]{...}: 2026年10月28日,1.0121,0.81% ...
    #   [2]:
    #     - fundCode: "011234"
    # 按 "fundCode:" 切分
    parts = re.split(r'fundCode:\s*"(\d+)"', text)
    # parts 形如 [pre, code1, block1, code2, block2, ...]
    for i in range(1, len(parts), 2):
        code = parts[i]
        block = parts[i + 1] if i + 1 < len(parts) else ""
        m = re.search(
            r"(\d{4})年(\d{1,2})月(\d{1,2})日\s*,\s*([\d.]+)\s*,\s*[\"]?(-?[\d.]+)%?[\"]?",
            block,
        )
        if m:
            y, mo, d, nav, pct = m.groups()
            result[code] = {
                "nav": float(nav),
                "nav_date": "%04d-%02d-%02d" % (int(y), int(mo), int(d)),
                "pct": float(pct),
            }
    return result


def fetch_fund_basic(code):
    """
    拉取基金详情（盈米 BatchGetFundsDetail），返回 JSON 结构。
    正确解析名称/规模/风险等级等字段。
    """
    client = _get_client()
    if client is None:
        return None
    text = client.call_tool("BatchGetFundsDetail", {"fundCodes": [code]})
    if not text:
        return None
    # BatchGetFundsDetail 返回 JSON 数组（可能外层包裹 [1]: 等前缀）
    data = _parse_detail_json(text, code)
    if not data:
        return None
    summary = data.get("summary") or {}
    scale = _parse_scale(summary.get("netAsset"))
    return {
        "source": "盈米",
        "code": code,
        "name": summary.get("fundName", ""),
        "scale": scale,
        "manager": "",
        "company": "",
        "type": summary.get("fundInvestType", ""),
        "risk": summary.get("risk5Level"),
    }


def _parse_scale(net_asset):
    """解析规模字段，如 '10.15亿' -> 10.15。"""
    if net_asset is None:
        return None
    if isinstance(net_asset, (int, float)):
        return float(net_asset)
    s = str(net_asset).strip()
    m = re.search(r"([\d.]+)\s*亿", s)
    if m:
        return float(m.group(1))
    m = re.search(r"([\d.]+)\s*万", s)
    if m:
        return float(m.group(1)) / 10000.0  # 万 -> 亿
    try:
        return float(s)
    except ValueError:
        return None


def _parse_detail_json(text, code):
    """从 BatchGetFundsDetail 返回文本中提取指定 code 的 data 对象。"""
    if not text:
        return None
    # 尝试直接 JSON 解析
    try:
        obj = json.loads(text)
    except json.JSONDecodeError:
        # 可能带 [1]: 等前缀，尝试提取 JSON 数组
        m = re.search(r"(\[.*\])", text, re.S)
        if not m:
            return None
        try:
            obj = json.loads(m.group(1))
        except json.JSONDecodeError:
            return None
    items = obj if isinstance(obj, list) else [obj]
    for item in items:
        if isinstance(item, dict) and item.get("fundCode") == code:
            return item.get("data") or {}
        # 兼容无 fundCode 包裹的情况
        if isinstance(item, dict) and item.get("summary", {}).get("fundCode") == code:
            return item
    return None


def fetch_funds_basic_batch(codes):
    """
    批量拉取基金详情（盈米 BatchGetFundsDetail，fundCodes 数组）。
    返回 {code: 详情 dict 或 None}。
    """
    client = _get_client()
    if client is None:
        return {c: None for c in codes}
    result = {}
    for i in range(0, len(codes), 20):
        chunk = codes[i:i + 20]
        text = client.call_tool("BatchGetFundsDetail", {"fundCodes": chunk})
        # 解析整个返回，映射每只基金
        parsed_all = _parse_detail_batch(text)
        for c in chunk:
            data = parsed_all.get(c)
            if not data:
                result[c] = None
                continue
            summary = data.get("summary") or {}
            result[c] = {
                "source": "盈米",
                "code": c,
                "name": summary.get("fundName", ""),
                "scale": _parse_scale(summary.get("netAsset")),
                "manager": "",
                "company": "",
                "type": summary.get("fundInvestType", ""),
                "risk": summary.get("risk5Level"),
            }
    return result


def _parse_detail_batch(text):
    """解析 BatchGetFundsDetail 批量返回，返回 {code: data dict}。"""
    result = {}
    if not text:
        return result
    try:
        obj = json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"(\[.*\])", text, re.S)
        if not m:
            return result
        try:
            obj = json.loads(m.group(1))
        except json.JSONDecodeError:
            return result
    items = obj if isinstance(obj, list) else [obj]
    for item in items:
        if not isinstance(item, dict):
            continue
        code = item.get("fundCode")
        data = item.get("data") or item
        if code is None:
            code = (data.get("summary") or {}).get("fundCode")
        if code:
            result[code] = data
    return result


if __name__ == "__main__":
    if not config.YINGMI_API_KEY:
        print("未配置 YINGMI_API_KEY，盈米源跳过。")
    else:
        print("== 盈米净值 110022 ==")
        print(json.dumps(fetch_fund_nav("110022"), ensure_ascii=False, indent=2))
        print("== 盈米净值 161725 ==")
        print(json.dumps(fetch_fund_nav("161725"), ensure_ascii=False, indent=2))
