# -*- coding: utf-8 -*-
"""
基金智库工作台 · 数据服务配置
================================
三源数据架构（全部免费公开 API，不消耗 token）：
  - 主源 A：天天基金 / 东方财富（公开 REST/JSON 接口）
  - 验证源 B：盈米（且慢，MCP 协议 / 可选 REST 端点）
  - 兜底源 C：蛋卷基金（公开 REST/JSON 接口）

说明：盈米 API Key 为可选项，留空时自动跳过验证源 B，
仅用 A + C 双源交叉验证（降级为双源模式，不影响主流程）。
"""

import os

# 加载本地 .env（可选，仅供本地开发；GitHub Actions 通过 Secrets 注入环境变量）
_ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(_ENV_PATH):
    try:
        with open(_ENV_PATH, "r", encoding="utf-8") as _f:
            for _line in _f:
                _line = _line.strip()
                if not _line or _line.startswith("#") or "=" not in _line:
                    continue
                _k, _v = _line.split("=", 1)
                os.environ.setdefault(_k.strip(), _v.strip().strip('"').strip("'"))
    except OSError:
        pass

# ---------------------------------------------------------------------------
# 基础路径
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
CACHE_DIR = os.path.join(BASE_DIR, "cache")

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(CACHE_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# 数据源 A：东方财富（主源）
# ---------------------------------------------------------------------------
# 基金历史净值接口（取最新单位净值/累计净值/日涨跌幅/净值日期）
FUND_NAV_URL = "http://api.fund.eastmoney.com/f10/lsjz"
# 基金基本信息（名称、规模、基金经理等）
FUND_MNF_URL = "http://fundmobapi.eastmoney.com/FundMNewApi/FundMNFInfo"
# 指数行情：新浪财经（主用，纯 https 直连稳定）+ 东财 push2（可选备用）
SINA_INDEX_URL = "https://hq.sinajs.cn/list={codes}"
INDEX_SPOT_URL = "https://push2.eastmoney.com/api/qt/ulist.np/get"

# 新浪指数代码（前缀 s_sh=沪 / s_sz=深）
SINA_INDEX_CODES = {
    "000001": "s_sh000001",  # 上证指数
    "399001": "s_sz399001",  # 深证成指
    "399006": "s_sz399006",  # 创业板指
    "000300": "s_sh000300",  # 沪深300
    "000905": "s_sh000905",  # 中证500
    "000016": "s_sh000016",  # 上证50
    "000688": "s_sh000688",  # 科创50
}

# 东财指数代码 -> 名称（常用宽基/行业指数）
INDEX_CODES = [
    "1.000001",  # 上证指数
    "0.399001",  # 深证成指
    "0.399006",  # 创业板指
    "1.000300",  # 沪深300
    "1.000905",  # 中证500
    "1.000016",  # 上证50
    "1.000688",  # 科创50
]

# ---------------------------------------------------------------------------
# 数据源 B：盈米（且慢，验证源）
# ---------------------------------------------------------------------------
# MCP 服务地址（SSE 通道）
YINGMI_MCP_URL = "https://stargate.yingmi.com/mcp/sse"
# API Key：到 https://qieman.com/mcp 免费申请后填入
# 留空 => 自动跳过盈米，降级为 A + C 双源模式
# 注意：Key 应从环境变量 YINGMI_API_KEY 读取，勿硬编码到代码（避免发布后泄露）
YINGMI_API_KEY = os.environ.get("YINGMI_API_KEY", "")

# ---------------------------------------------------------------------------
# 数据源 C：蛋卷基金（兜底源）
# ---------------------------------------------------------------------------
DANJUAN_FUND_URL = "https://danjuanfunds.com/djapi/fund/{code}"
DANJUAN_NAV_URL = "https://danjuanfunds.com/djapi/fund/nav/history/{code}"

# ---------------------------------------------------------------------------
# HTTP 请求通用配置
# ---------------------------------------------------------------------------
HTTP_TIMEOUT = 8              # 单次请求超时（秒）
HTTP_RETRY = 3                # 失败重试次数
RETRY_BACKOFF = 2             # 指数退避基数（秒）
MAX_CONCURRENCY = 8           # 并发上限（ThreadPool）

# 请求头（部分接口需要 Referer / UA）
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0 Safari/537.36",
    "Referer": "http://fund.eastmoney.com/",
}

# ---------------------------------------------------------------------------
# 交叉验证阈值（一致性判定）
# ---------------------------------------------------------------------------
NAV_TOLERANCE = 0.0001        # 单位/累计净值绝对差阈值
PCT_TOLERANCE = 0.01          # 日涨跌幅差值阈值（百分点）
SCALE_TOL = 0.01              # 规模相对差阈值（1%）

# ---------------------------------------------------------------------------
# 控流策略（多源拉取调度）
# ---------------------------------------------------------------------------
# 验证源 B（盈米）只对"活跃客户持仓基金 + 用户正在查看的基金"做实时交叉验证，
# 不做全市场比对。此处为这些基金代码的兜底清单（由前端/业务层注入）。
ACTIVE_FUND_CODES = []        # 例如 ["110022", "161725", ...]，由调用方传入

# 指数行情刷新间隔（秒），仅主源 A，交易日内定时拉取
INDEX_REFRESH_INTERVAL = 300  # 5 分钟

# 全市场净值拉取批次大小（每批基金数）
FUND_BATCH_SIZE = 50
