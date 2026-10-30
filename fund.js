(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const escapeHTML = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;

  /* ============================ 配置数据 ============================ */
  const strategyGroups = [
    { id: "equity", name: "权益类", subs: ["股票型", "偏股混合型", "平衡混合型", "指数型"] },
    { id: "fixed", name: "固收类", subs: ["纯债型", "一级债基", "二级债基", "短债型"] },
    { id: "fixedplus", name: "固收+", subs: ["偏债混合型", "可转债型"] },
    { id: "money", name: "货币类", subs: ["货币基金"] },
    { id: "qdii", name: "QDII", subs: ["股票型QDII", "债券型QDII", "混合型QDII"] },
    { id: "fof", name: "FOF", subs: ["股票FOF", "债券FOF", "混合FOF"] },
    { id: "alt", name: "另类", subs: ["商品型", "REITs"] }
  ];

  const industries = [
    { id: "finance", name: "金融", cover: "银行、证券、保险" },
    { id: "pharma", name: "医药", cover: "医药生物、医疗健康、创新药" },
    { id: "tech", name: "科技", cover: "电子、计算机、通信、传媒、半导体" },
    { id: "consumer", name: "消费", cover: "食品饮料、家电、商贸零售" },
    { id: "manufacture", name: "制造", cover: "机械设备、汽车、国防军工" },
    { id: "cyclical", name: "周期", cover: "煤炭、钢铁、有色、化工" },
    { id: "utility", name: "公用事业", cover: "电力、环保、公用事业" },
    { id: "realestate", name: "房地产", cover: "房地产、建筑装饰" }
  ];

  const themeGroups = [
    { name: "数字化与人工智能", items: ["AI", "云计算", "物联网", "信息安全"] },
    { name: "高端制造", items: ["机器人", "智能汽车", "工业母机"] },
    { name: "低碳转型", items: ["新能源", "光伏", "储能", "碳中和"] },
    { name: "国企改革", items: ["央企科技", "一带一路"] },
    { name: "人口趋势", items: ["养老产业", "婴童经济"] },
    { name: "ESG", items: ["ESG"] },
    { name: "其他热门概念", items: ["低空经济", "人形机器人"] }
  ];

  const tagDefs = [
    { id: "ward", name: "沃德优选基金", short: "沃德优选", desc: "交行沃德品牌精选基金池，总行产品部维护" },
    { id: "hold", name: "月度重点持营基金", short: "重点持营", desc: "当月重点持续营销，每月初自动切换" },
    { id: "new", name: "月度重点首发基金", short: "重点首发", desc: "当月重点新发，募集结束后自动移除" }
  ];

  const scaleBuckets = { lt1: "小于 1 亿", s1: "1—10 亿", s10: "10—50 亿", s50: "50—100 亿", gt100: "大于 100 亿" };
  const ageBuckets = { lt1: "小于 1 年", a1: "1—3 年", a3: "3—5 年", gt5: "大于 5 年" };

  /* ============================ 实时行情（三源交叉验证数据接入） ============================ */
  // 读取 data_service/output/funds.json，按基金 code 匹配真实净值/涨跌幅。
  // 数据不存在或加载失败时静默降级，不影响演示原型。
  const liveData = { loaded: false, byCode: {}, generatedAt: "" };
  (function loadLiveData() {
    fetch("data_service/output/funds.json", { cache: "no-store" })
      .then(r => (r.ok ? r.json() : Promise.reject("http " + r.status)))
      .then(j => {
        liveData.loaded = true;
        liveData.generatedAt = j.generated_at || "";
        (j.funds || []).forEach(f => { liveData.byCode[f.code] = f; });
        renderResults();
      })
      .catch(() => { liveData.loaded = false; });
  })();

  function liveOf(code) {
    return liveData.byCode[code] || null;
  }  // 实时涨跌幅徽标（红涨绿跌，A 股惯例）
  function livePctBadge(code) {
    const f = liveOf(code);
    if (!f || f.nav === null || f.nav === undefined) return "";
    const v = Number(f.pct);
    const cls = v > 0 ? "live-up" : v < 0 ? "live-down" : "live-flat";
    const sign = v > 0 ? "+" : "";
    return `<span class="live-badge ${cls}" title="实时净值 ${Number(f.nav).toFixed(4)} · ${f.nav_date} · 数据源 ${f.adopted_source}">${sign}${v.toFixed(2)}%<small>实时</small></span>`;
  }
  // 实时净值行（详情抽屉用）
  function liveNavBlock(code) {
    const f = liveOf(code);
    if (!f || f.nav === null || f.nav === undefined) return "";
    const v = Number(f.pct);
    const cls = v > 0 ? "live-up" : v < 0 ? "live-down" : "live-flat";
    return `<div class="live-nav-block">
      <div class="live-nav-row"><span>实时净值</span><strong>${Number(f.nav).toFixed(4)}</strong><b class="${cls}">${v > 0 ? "+" : ""}${v.toFixed(2)}%</b></div>
      <div class="live-nav-meta">净值日期 ${f.nav_date} · 数据源 ${f.adopted_source}${f.conflict ? ' · <span class="live-conflict">多源不一致</span>' : ""}</div>
    </div>`;
  }

  /* ============================ 全市场基金查询 ============================ */
  // 读取 data_service/output/all_funds.json（约 2 万只公募基金），支持按名称/代码搜索。
  // 懒加载：首屏不加载（7MB 文件慢），仅在用户聚焦搜索框时才加载。
  const allMarket = { loaded: false, loading: false, funds: [], total: 0 };

  function ensureAllMarket() {
    if (allMarket.loaded || allMarket.loading) return;
    allMarket.loading = true;
    const countEl = document.getElementById("amsCount");
    if (countEl) countEl.textContent = "加载中…";
    fetch("data_service/output/all_funds.json", { cache: "no-store" })
      .then(r => (r.ok ? r.json() : Promise.reject("http " + r.status)))
      .then(j => {
        allMarket.loaded = true;
        allMarket.loading = false;
        allMarket.funds = j.funds || [];
        allMarket.total = j.total || allMarket.funds.length;
        if (countEl) countEl.textContent = allMarket.total.toLocaleString() + " 只基金";
        // 数据加载完成后，若搜索框已有内容，自动重新渲染结果
        const inp = document.getElementById("allFundInput");
        if (inp && inp.value.trim()) amsRenderResults(inp.value);
      })
      .catch(() => {
        allMarket.loaded = false;
        allMarket.loading = false;
        if (countEl) countEl.textContent = "未加载（本地数据服务未运行）";
      });
  }

  function amsSearch(q) {
    // 按名称或代码搜索全市场基金，返回最多 30 条
    q = (q || "").trim();
    if (!q) return [];
    const lower = q.toLowerCase();
    const result = [];
    for (const f of allMarket.funds) {
      if (f.code.startsWith(q) || f.name.toLowerCase().includes(lower)) {
        result.push(f);
        if (result.length >= 30) break;
      }
    }
    return result;
  }

  function amsRenderResults(q) {
    const box = document.getElementById("amsResults");
    if (!box) return;
    const list = amsSearch(q);
    if (!q.trim()) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    if (!list.length) {
      box.innerHTML = `<div class="ams-empty">未找到匹配基金，请更换关键词（支持名称或 6 位代码）</div>`;
      return;
    }
    box.innerHTML = list.map(f => {
      const d1 = f.d1;
      const d1cls = d1 > 0 ? "live-up" : d1 < 0 ? "live-down" : "live-flat";
      const d1sign = d1 > 0 ? "+" : "";
      return `<button class="ams-item" data-ams-code="${f.code}">
        <div class="ams-item-main">
          <strong>${escapeHTML(f.name)}</strong>
          <span class="ams-item-code">${f.code}</span>
        </div>
        <div class="ams-item-side">
          <span class="ams-item-type">${f.type || "—"}</span>
          <span class="ams-item-nav">${f.nav != null ? Number(f.nav).toFixed(4) : "—"}</span>
          <b class="${d1cls}">${d1 != null ? d1sign + Number(d1).toFixed(2) + "%" : "—"}</b>
        </div>
      </button>`;
    }).join("");
  }

  function amsDetailHTML(code) {
    const f = allMarket.funds.find(x => x.code === code);
    if (!f) return `<div class="empty-state"><strong>未找到该基金</strong><p>请返回重新搜索。</p></div>`;
    const d1 = f.d1;
    const cls = d1 > 0 ? "live-up" : d1 < 0 ? "live-down" : "live-flat";
    const sign = d1 > 0 ? "+" : "";
    const retRow = (label, v) => `<div><span>${label}</span><b class="${v > 0 ? "live-up" : v < 0 ? "live-down" : "live-flat"}">${v != null ? (v > 0 ? "+" : "") + Number(v).toFixed(2) + "%" : "—"}</b></div>`;
    return `
      <div class="fund-hero">
        <div class="fund-hero-top"><div><h3>${escapeHTML(f.name)}</h3><p>${f.code} · ${f.type || "—"} · 成立 ${f.est_date || "—"}</p></div><span class="risk-badge">全市场</span></div>
        <div class="fund-metrics">
          <div><span>单位净值</span><strong>${f.nav != null ? Number(f.nav).toFixed(4) : "—"}</strong></div>
          <div><span>日涨跌</span><strong class="${cls}">${d1 != null ? sign + Number(d1).toFixed(2) + "%" : "—"}</strong></div>
          <div><span>净值日期</span><strong style="font-size:13px">${f.nav_date || "—"}</strong></div>
        </div>
      </div>
      <div class="source-line">${icon("clock")}真实数据 · 数据源：东方财富 · 净值日期 ${f.nav_date || "—"} · 非投资建议</div>
      <section class="drawer-section"><div class="drawer-section-title"><h3>各期业绩</h3><span>真实数据</span></div>
        <div class="detail-facts">
          ${retRow("近 1 周", f.w1)}${retRow("近 1 月", f.m1)}${retRow("近 3 月", f.m3)}
          ${retRow("近 6 月", f.m6)}${retRow("近 1 年", f.y1)}${retRow("近 2 年", f.y2)}
          ${retRow("近 3 年", f.y3)}${retRow("今年以来", f.ytd)}${retRow("成立以来", f.all)}
        </div>
      </section>
      <section class="drawer-section"><div class="drawer-section-title"><h3>基本信息</h3><span>真实数据</span></div>
        <div class="detail-facts">
          <div><span>累计净值</span><b>${f.acc_nav != null ? Number(f.acc_nav).toFixed(4) : "—"}</b></div>
          <div><span>基金类型</span><b>${f.type || "—"}</b></div>
          <div><span>基金规模</span><b>${f.scale != null ? Number(f.scale).toFixed(2) + " 亿" : "—"}</b></div>
          <div><span>管理费</span><b>${f.fee_mgmt || "—"}</b></div>
          <div><span>托管费</span><b>${f.fee_custody || "—"}</b></div>
        </div>
      </section>
      <div class="risk-note" style="margin-top:18px">适当性提示：全市场基金数据来自免费公开接口，仅供原型演示与内部试用，可能存在时点差异；向客户展示前须核对行内产品库与适当性要求，不构成投资建议。</div>`;
  }

  const funds = [
    {
      id: "F001", name: "交银沃德沪深300指数增强A", code: "519300", company: "交银施罗德基金",
      group: "equity", sub: "指数型", tags: ["ward"], industry: null, industryLevel: null, themes: [],
      risk: "R3", ret: { m1: 1.2, m3: 3.6, m6: 5.1, y1: 8.6, y3: 14.2 }, scale: 62.4,
      manager: "张明", managerYears: 6, managerReturn: 41.2, drawdown: -12.3, sharpe: 0.72, volatility: 16.8,
      est: 2019, feeMgmt: 0.80, feeCustody: 0.15,
      mix: [{ name: "金融", pct: 35 }, { name: "科技", pct: 18 }, { name: "消费", pct: 15 }, { name: "制造", pct: 14 }, { name: "其他", pct: 18 }],
      holdings: [{ name: "贵州茅台", weight: "3.8%" }, { name: "宁德时代", weight: "3.1%" }, { name: "招商银行", weight: "2.9%" }, { name: "中国平安", weight: "2.4%" }],
      role: "宽基指数增强，用于承接希望分散配置、降低单一行业暴露的客户。"
    },
    {
      id: "F002", name: "华夏科技先锋混合A", code: "011234", company: "华夏基金",
      group: "equity", sub: "偏股混合型", tags: ["hold"], industry: "tech", industryLevel: "strong",
      themes: [{ name: "AI", level: "normal" }, { name: "云计算", level: "weak" }],
      risk: "R4", ret: { m1: 4.8, m3: 9.2, m6: 12.6, y1: 21.4, y3: 6.8 }, scale: 48.7,
      manager: "李昂", managerYears: 4, managerReturn: 63.5, drawdown: -24.6, sharpe: 0.81, volatility: 26.3,
      est: 2020, feeMgmt: 1.20, feeCustody: 0.20,
      mix: [{ name: "科技", pct: 82 }, { name: "制造", pct: 10 }, { name: "其他", pct: 8 }],
      holdings: [{ name: "中际旭创", weight: "6.2%" }, { name: "北方华创", weight: "5.4%" }, { name: "海光信息", weight: "4.9%" }, { name: "金山办公", weight: "4.1%" }],
      role: "科技行业基金，行业集中度高，适合可承受较大波动的客户作为卫星配置。"
    },
    {
      id: "F003", name: "汇添富医药健康股票A", code: "000083", company: "汇添富基金",
      group: "equity", sub: "股票型", tags: ["ward"], industry: "pharma", industryLevel: "strong",
      themes: [{ name: "养老产业", level: "normal" }],
      risk: "R4", ret: { m1: -1.6, m3: 2.4, m6: 6.9, y1: 12.8, y3: -4.1 }, scale: 88.2,
      manager: "王晴", managerYears: 7, managerReturn: 58.7, drawdown: -21.5, sharpe: 0.66, volatility: 24.1,
      est: 2015, feeMgmt: 1.20, feeCustody: 0.20,
      mix: [{ name: "医药", pct: 86 }, { name: "消费", pct: 6 }, { name: "其他", pct: 8 }],
      holdings: [{ name: "恒瑞医药", weight: "7.1%" }, { name: "迈瑞医疗", weight: "6.3%" }, { name: "药明康德", weight: "5.5%" }, { name: "爱尔眼科", weight: "4.2%" }],
      role: "医药行业基金，适合有行业配置需求且风险承受能力匹配的客户。"
    },
    {
      id: "F004", name: "南方消费升级混合A", code: "005267", company: "南方基金",
      group: "equity", sub: "偏股混合型", tags: [], industry: "consumer", industryLevel: "normal",
      themes: [],
      risk: "R3", ret: { m1: 0.6, m3: -1.2, m6: 2.8, y1: 6.2, y3: 3.4 }, scale: 35.6,
      manager: "刘畅", managerYears: 5, managerReturn: 27.9, drawdown: -18.2, sharpe: 0.58, volatility: 20.4,
      est: 2018, feeMgmt: 1.20, feeCustody: 0.20,
      mix: [{ name: "消费", pct: 71 }, { name: "科技", pct: 10 }, { name: "医药", pct: 8 }, { name: "其他", pct: 11 }],
      holdings: [{ name: "美的集团", weight: "6.8%" }, { name: "五粮液", weight: "5.9%" }, { name: "海尔智家", weight: "4.7%" }, { name: "中国中免", weight: "3.6%" }],
      role: "消费行业特征基金，行业暴露较高但不属于纯主题产品。"
    },
    {
      id: "F005", name: "广发高端制造股票A", code: "007890", company: "广发基金",
      group: "equity", sub: "股票型", tags: ["hold"], industry: "manufacture", industryLevel: "strong",
      themes: [{ name: "机器人", level: "normal" }, { name: "工业母机", level: "weak" }],
      risk: "R4", ret: { m1: 3.1, m3: 7.6, m6: 11.8, y1: 18.9, y3: 9.3 }, scale: 54.3,
      manager: "陈昊", managerYears: 3, managerReturn: 37.4, drawdown: -23.1, sharpe: 0.75, volatility: 25.7,
      est: 2019, feeMgmt: 1.20, feeCustody: 0.20,
      mix: [{ name: "制造", pct: 80 }, { name: "科技", pct: 12 }, { name: "其他", pct: 8 }],
      holdings: [{ name: "汇川技术", weight: "6.4%" }, { name: "三一重工", weight: "5.1%" }, { name: "埃斯顿", weight: "4.3%" }, { name: "中控技术", weight: "3.8%" }],
      role: "制造行业基金，兼具高端制造与机器人主题特征，波动较大。"
    },
    {
      id: "F006", name: "工银前沿医疗股票A", code: "001717", company: "工银瑞信基金",
      group: "equity", sub: "股票型", tags: [], industry: "pharma", industryLevel: "normal",
      themes: [],
      risk: "R4", ret: { m1: -2.4, m3: -5.1, m6: -1.8, y1: -6.4, y3: -14.2 }, scale: 41.2,
      manager: "赵蕾", managerYears: 6, managerReturn: 12.6, drawdown: -27.8, sharpe: 0.32, volatility: 25.0,
      est: 2016, feeMgmt: 1.20, feeCustody: 0.20,
      mix: [{ name: "医药", pct: 74 }, { name: "消费", pct: 10 }, { name: "其他", pct: 16 }],
      holdings: [{ name: "药明生物", weight: "6.0%" }, { name: "泰格医药", weight: "5.2%" }, { name: "联影医疗", weight: "4.6%" }, { name: "凯莱英", weight: "3.9%" }],
      role: "医药行业特征基金，近期回撤较大，沟通时应先解释行业周期与持仓集中度。"
    },
    {
      id: "F007", name: "易方达蓝筹精选混合", code: "005827", company: "易方达基金",
      group: "equity", sub: "偏股混合型", tags: ["ward", "hold"], industry: null, industryLevel: null, themes: [],
      risk: "R3", ret: { m1: 1.8, m3: 4.1, m6: 6.4, y1: 10.1, y3: 1.6 }, scale: 312.5,
      manager: "张坤", managerYears: 10, managerReturn: 96.4, drawdown: -19.4, sharpe: 0.63, volatility: 21.6,
      est: 2018, feeMgmt: 1.20, feeCustody: 0.20,
      mix: [{ name: "消费", pct: 40 }, { name: "金融", pct: 20 }, { name: "科技", pct: 18 }, { name: "制造", pct: 12 }, { name: "其他", pct: 10 }],
      holdings: [{ name: "腾讯控股", weight: "8.2%" }, { name: "贵州茅台", weight: "7.4%" }, { name: "招商银行", weight: "6.1%" }, { name: "美团", weight: "4.7%" }],
      role: "大盘均衡型产品，行业分散度较高，适合作为核心配置的一部分。"
    },
    {
      id: "F008", name: "中欧数字经济混合A", code: "004231", company: "中欧基金",
      group: "equity", sub: "偏股混合型", tags: [], industry: "tech", industryLevel: "weak",
      themes: [{ name: "AI", level: "normal" }, { name: "云计算", level: "normal" }],
      risk: "R4", ret: { m1: 5.6, m3: 12.4, m6: 16.8, y1: 25.3, y3: 4.9 }, scale: 18.9,
      manager: "周远", managerYears: 2, managerReturn: 29.8, drawdown: -28.2, sharpe: 0.71, volatility: 29.4,
      est: 2020, feeMgmt: 1.20, feeCustody: 0.20,
      mix: [{ name: "科技", pct: 56 }, { name: "制造", pct: 12 }, { name: "消费", pct: 10 }, { name: "其他", pct: 22 }],
      holdings: [{ name: "科大讯飞", weight: "5.8%" }, { name: "浪潮信息", weight: "5.0%" }, { name: "用友网络", weight: "4.4%" }, { name: "东方财富", weight: "3.7%" }],
      role: "科技倾向叠加 AI 主题特征，主题集中度中等，需提示净值联动验证结果。"
    },
    {
      id: "F009", name: "招商产业债A", code: "217022", company: "招商基金",
      group: "fixed", sub: "纯债型", tags: ["ward"], industry: null, industryLevel: null, themes: [],
      risk: "R2", ret: { m1: 0.4, m3: 1.1, m6: 2.2, y1: 4.3, y3: 11.8 }, scale: 120.4,
      manager: "马骁", managerYears: 8, managerReturn: 38.6, drawdown: -1.8, sharpe: 1.24, volatility: 2.6,
      est: 2013, feeMgmt: 0.30, feeCustody: 0.10,
      mix: [{ name: "利率债", pct: 45 }, { name: "信用债", pct: 48 }, { name: "其他", pct: 7 }],
      holdings: [{ name: "23 国债 05", weight: "8.6%" }, { name: "22 招商银行二级资本债", weight: "6.2%" }, { name: "23 国开 08", weight: "5.4%" }],
      role: "纯债产品，用于承接低波动需求客户，需说明利率与信用风险来源。"
    },
    {
      id: "F010", name: "易方达稳健收益债券B", code: "110008", company: "易方达基金",
      group: "fixed", sub: "二级债基", tags: ["hold"], industry: null, industryLevel: null, themes: [],
      risk: "R2", ret: { m1: 0.7, m3: 1.6, m6: 3.2, y1: 5.6, y3: 13.4 }, scale: 76.8,
      manager: "胡倩", managerYears: 6, managerReturn: 31.5, drawdown: -3.9, sharpe: 0.96, volatility: 4.8,
      est: 2008, feeMgmt: 0.60, feeCustody: 0.15,
      mix: [{ name: "信用债", pct: 62 }, { name: "利率债", pct: 20 }, { name: "权益", pct: 12 }, { name: "其他", pct: 6 }],
      holdings: [{ name: "22 国开 12", weight: "7.4%" }, { name: "23 中票 AAA", weight: "5.8%" }, { name: "沪深300ETF", weight: "3.2%" }],
      role: "二级债基，含少量权益暴露，需说明净值波动来源。"
    },
    {
      id: "F011", name: "博时安盈短债A", code: "000084", company: "博时基金",
      group: "fixed", sub: "短债型", tags: [], industry: null, industryLevel: null, themes: [],
      risk: "R1", ret: { m1: 0.3, m3: 0.8, m6: 1.5, y1: 2.9, y3: 7.6 }, scale: 45.1,
      manager: "郭敏", managerYears: 4, managerReturn: 14.2, drawdown: -0.6, sharpe: 1.51, volatility: 1.1,
      est: 2014, feeMgmt: 0.20, feeCustody: 0.08,
      mix: [{ name: "短久期信用债", pct: 70 }, { name: "同业存单", pct: 25 }, { name: "其他", pct: 5 }],
      holdings: [{ name: "23 同业存单 AAA", weight: "9.1%" }, { name: "22 短融 AAA", weight: "7.3%" }, { name: "23 国债 03", weight: "5.6%" }],
      role: "短债产品，波动低，适合作为流动性管理与稳健配置工具。"
    },
    {
      id: "F012", name: "交银稳利增强债券A", code: "519723", company: "交银施罗德基金",
      group: "fixedplus", sub: "偏债混合型", tags: ["ward", "new"], industry: null, industryLevel: null, themes: [],
      risk: "R2", ret: { m1: 0.9, m3: 2.1, m6: 3.8, y1: 6.8, y3: 15.1 }, scale: 28.3,
      manager: "何静", managerYears: 5, managerReturn: 26.8, drawdown: -5.2, sharpe: 0.88, volatility: 6.4,
      est: 2016, feeMgmt: 0.60, feeCustody: 0.15,
      mix: [{ name: "债券", pct: 78 }, { name: "权益", pct: 18 }, { name: "其他", pct: 4 }],
      holdings: [{ name: "23 国开 05", weight: "8.2%" }, { name: "22 中票 AAA", weight: "6.4%" }, { name: "红利低波ETF", weight: "4.1%" }],
      role: "固收+产品，用债券打底、少量权益增强，需说明回撤可能高于纯债。"
    },
    {
      id: "F013", name: "天弘现金管家货币A", code: "000198", company: "天弘基金",
      group: "money", sub: "货币基金", tags: [], industry: null, industryLevel: null, themes: [],
      risk: "R1", ret: { m1: 0.2, m3: 0.5, m6: 1.0, y1: 1.9, y3: 6.2 }, scale: 680.5,
      manager: "王珂", managerYears: 7, managerReturn: 16.4, drawdown: 0, sharpe: null, volatility: 0.2,
      est: 2013, feeMgmt: 0.15, feeCustody: 0.05,
      mix: [{ name: "同业存单", pct: 55 }, { name: "短期融资券", pct: 30 }, { name: "银行存款", pct: 15 }],
      holdings: [{ name: "同业存单组合", weight: "55.0%" }, { name: "短期融资券", weight: "30.0%" }, { name: "银行存款", weight: "15.0%" }],
      role: "现金管理工具，不参与收益排名竞争，适合短期闲置资金。"
    },
    {
      id: "F014", name: "华夏恒生中国企业ETF联接(QDII)A", code: "000948", company: "华夏基金",
      group: "qdii", sub: "股票型QDII", tags: ["hold"], industry: null, industryLevel: null, themes: [],
      risk: "R4", ret: { m1: 2.2, m3: 5.4, m6: 8.1, y1: 9.4, y3: -8.6 }, scale: 22.6,
      manager: "林涛", managerYears: 5, managerReturn: 19.3, drawdown: -26.4, sharpe: 0.41, volatility: 24.8,
      est: 2015, feeMgmt: 0.60, feeCustody: 0.15,
      mix: [{ name: "港股科技", pct: 35 }, { name: "金融", pct: 20 }, { name: "消费", pct: 18 }, { name: "其他", pct: 27 }],
      holdings: [{ name: "腾讯控股", weight: "9.6%" }, { name: "阿里巴巴", weight: "8.1%" }, { name: "建设银行", weight: "5.4%" }, { name: "美团", weight: "4.9%" }],
      role: "港股 QDII 产品，需说明交易时段、汇率与区域集中风险。"
    },
    {
      id: "F015", name: "南方黄金ETF联接A", code: "000217", company: "南方基金",
      group: "alt", sub: "商品型", tags: [], industry: null, industryLevel: null, themes: [],
      risk: "R3", ret: { m1: 2.8, m3: 6.1, m6: 9.4, y1: 16.7, y3: 38.2 }, scale: 33.9,
      manager: "徐峰", managerYears: 4, managerReturn: 52.1, drawdown: -14.8, sharpe: 0.69, volatility: 15.2,
      est: 2011, feeMgmt: 0.50, feeCustody: 0.10,
      mix: [{ name: "黄金", pct: 90 }, { name: "现金", pct: 10 }],
      holdings: [{ name: "黄金现货合约", weight: "90.0%" }, { name: "现金及结算备付金", weight: "10.0%" }],
      role: "商品型产品，用于组合分散，需提示金价与实际利率、美元的关系。"
    },
    {
      id: "F016", name: "兴全优选进取FOF A", code: "006291", company: "兴证全球基金",
      group: "fof", sub: "混合FOF", tags: ["new"], industry: null, industryLevel: null, themes: [],
      risk: "R3", ret: { m1: 1.1, m3: 2.8, m6: 4.6, y1: 7.3, y3: 2.1 }, scale: 15.4,
      manager: "郑楠", managerYears: 3, managerReturn: 18.7, drawdown: -16.9, sharpe: 0.55, volatility: 19.7,
      est: 2021, feeMgmt: 0.80, feeCustody: 0.20,
      mix: [{ name: "权益基金", pct: 65 }, { name: "债券基金", pct: 25 }, { name: "货币", pct: 10 }],
      holdings: [{ name: "内部优选权益基金", weight: "42.0%" }, { name: "外部指数基金", weight: "23.0%" }, { name: "纯债基金", weight: "25.0%" }],
      role: "混合 FOF，通过基金组合实现分散，需说明双重收费与底层穿透。"
    },
    {
      id: "F017", name: "中金普洛斯REIT", code: "508056", company: "中金基金",
      group: "alt", sub: "REITs", tags: [], industry: null, industryLevel: null, themes: [],
      risk: "R3", ret: { m1: -0.4, m3: 1.2, m6: 2.6, y1: 4.1, y3: 6.9 }, scale: 58.2,
      manager: "罗翔", managerYears: 2, managerReturn: 8.4, drawdown: -9.7, sharpe: 0.44, volatility: 11.3,
      est: 2021, feeMgmt: 0.30, feeCustody: 0.05,
      mix: [{ name: "仓储物流", pct: 100 }],
      holdings: [{ name: "普洛斯仓储物流园", weight: "100.0%" }],
      role: "公募 REITs，收益来源为基础设施运营，需说明与股债不同的风险特征。"
    }
  ];

  const fundMap = Object.fromEntries(funds.map(fund => [fund.id, fund]));
  const industryMap = Object.fromEntries(industries.map(item => [item.id, item]));
  const tagMap = Object.fromEntries(tagDefs.map(item => [item.id, item]));

  /* ============================ 销售一页纸数据（演示） ============================ */
  const salesData = {
    F001: {
      fit: [{ who: "稳健增值型客户", why: "希望获取市场平均收益，不想承担单一行业或单一基金经理的集中风险。" }, { who: "定投习惯客户", why: "宽基指数适合作为定期定额的底层标的，纪律化摊薄成本。" }, { who: "组合核心仓位客户", why: "已有较多主动型或主题型持仓，需要指数工具平衡组合结构。" }],
      avoid: "追求绝对收益、无法接受指数级别回撤（演示最大回撤 -12.3%）的客户；一年内可能动用该笔资金的客户。",
      highlights: ["指数增强策略：跟踪沪深 300 的基础上力争超额收益，风格透明、便于解释。", "本行标签产品：沃德优选基金池成员，由总行产品部维护名单。", "行业分散：前三大行业占比合计不足七成，单一行业暴露有限（演示）。"],
      script: { open: "您之前提到希望配置一部分跟随市场整体的机会，而不是押注某个热点板块。我为您准备了一份沪深300指数增强产品的资料。", value: "沪深300覆盖A股核心资产，行业和个券都比较分散；指数增强是在跟踪指数的基础上，通过量化方式力争一点超额，整体运作透明、方便我们定期检视。", risk: "需要说明的是，指数增强不保证跑赢指数，市场整体回调时净值同样会下跌，演示口径下最大回撤约 12%。它更适合作为组合的长期底仓，而不是短期博收益的工具。", close: "如果您认可这个思路，可以先从定投或分批建仓开始，把单次波动的影响降下来；之后我们每季度一起检视一次超额情况。" }
    },
    F002: {
      fit: [{ who: "成长进取型客户（C4 及以上）", why: "风险承受能力较高，能接受较大波动换取科技行业的成长弹性。" }, { who: "卫星配置客户", why: "已有均衡底仓，希望增加科技方向暴露、提升组合进攻性。" }],
      avoid: "风险测评 C3 及以下、一年内可能动用资金、或无法接受单年 20% 以上回撤的客户。",
      highlights: ["行业暴露清晰：科技板块持仓约 82%（演示），属于行业基金认定，便于客户理解投向。", "覆盖 AI 与半导体核心环节：重仓光模块、半导体设备等算力产业链标的（演示）。", "经理任职回报领先：任职以来超额收益明显，任职年限 4 年（演示）。"],
      script: { open: "上次您问到科技方向的机会，我整理了一份科技行业基金的资料，先和您对一下风险是否匹配。", value: "这只产品约八成仓位集中在科技板块，覆盖 AI 算力、半导体设备等核心环节。如果您认可科技产业的长期逻辑，它的表达是比较纯粹、不含糊的。", risk: "行业集中度高的产品波动显著大于宽基：演示口径下近一年收益 21% 的同时最大回撤约 25%。它只适合风险测评匹配、且这笔钱至少三年不用动的情况，建议控制在整个权益仓位的一到两成。", close: "如果风险确认没问题，我们可以先给一个小仓位试水，设定好止盈和检视节奏；每次季报披露后我会把行业结构变化同步给您。" }
    },
    F003: {
      fit: [{ who: "长期配置型客户（C4 及以上）", why: "认同医药创新长期逻辑，愿意承受行业周期波动，持有期两年以上。" }, { who: "行业轮动补位客户", why: "组合中医药暴露低，希望通过行业基金补齐这一方向。" }],
      avoid: "短期避险需求、无法接受医药板块持续调整的客户；风险测评不匹配的客户。",
      highlights: ["医药行业基金认定：医药板块持仓约 86%（演示），主题名实相符。", "资深管理团队：现任经理任职 7 年，完整经历医药牛熊周期（演示）。", "产业链覆盖完整：重仓创新药、医疗器械龙头（演示）。"],
      script: { open: "您之前提过想了解医药方向，医药这几年调整比较充分，我准备了一份行业基金的资料和您聊聊。", value: "这只产品八成以上仓位在医药板块，覆盖创新药和器械龙头。医药的需求由人口结构决定，长期确定性较高；调整较长时间后，板块估值处于相对温和区间（演示口径）。", risk: "必须提示：医药受政策与研发进展影响大，短期可能继续跑输大盘，演示口径近三年收益为负。它需要用两年以上的钱来配置，且仓位不宜超过您权益资产的一成半。", close: "如果您认可长期逻辑，可以分两到三批建仓；我会把集采政策和创新药获批进展这些关键变量及时同步给您。" }
    },
    F004: {
      fit: [{ who: "稳健成长型客户（C3 及以上）", why: "看重品牌壁垒与现金流，希望参与消费复苏但不想承担主题基金的高波动。" }],
      avoid: "期待短期高弹性、或对消费板块持否定观点的客户。",
      highlights: ["消费行业特征：消费板块持仓约 71%（演示），行业暴露较高但不属于纯主题产品。", "偏股混合运作：保留一定跨行业调整空间，回撤控制相对行业基金更温和。", "持仓集中白马：重仓家电、白酒龙头，商业模式便于向客户解释（演示）。"],
      script: { open: "结合您偏稳健的偏好，我为您筛选了一只消费方向的偏股混合产品，波动相对可控一些。", value: "这只产品七成左右在消费板块，重仓的都是家电、白酒这类大家耳熟能详的龙头企业。消费企业的现金流和品牌壁垒相对清晰，估值也处于历史中等偏低的区间（演示口径）。", risk: "消费板块的修复节奏和居民收入预期相关，短期可能继续磨底；演示口径近一年收益约 6%，属于中低速区间。适合作为组合中消费方向的稳健表达。", close: "如果您认可，可以先配置一成左右仓位，把消费复苏的节奏放在季度检视里观察。" }
    },
    F005: {
      fit: [{ who: "成长进取型客户（C4 及以上）", why: "看好高端制造与国产替代的长期趋势，能承受行业基金级别波动。" }],
      avoid: "风险测评 C3 及以下、或对制造业周期波动敏感的客户。",
      highlights: ["制造行业基金认定：制造板块持仓约 80%（演示）。", "双主题特征：叠加机器人与工业母机主题特征，符合智能制造方向（演示）。", "超额收益明显：近一年收益约 19%，夏普比率优于同类行业基金均值（演示）。"],
      script: { open: "您上次问到制造业升级的方向，我准备了一份高端制造行业基金的资料，先确认一下风险匹配。", value: "这只产品八成仓位在制造板块，覆盖工控、机器人、工业母机等智能制造核心环节。国产替代和设备更新是持续多年的产业逻辑，行业政策支持也比较明确。", risk: "制造业订单有周期性，且该产品行业集中度高，演示口径最大回撤约 23%。只适合匹配的客户，建议用不影响生活的长期资金配置。", close: "确认风险没问题的话，我们可以从一成仓位开始，把机器人产业链的季度订单数据作为后续检视的抓手。" }
    },
    F006: {
      fit: [{ who: "逆向布局型客户（C4 及以上）", why: "理解医药板块左侧布局逻辑，接受浮亏可能先扩大，持有期三年左右。" }],
      avoid: "无法接受净值继续下跌、或风险测评不匹配的客户——该产品演示口径近一年收益为负、回撤约 28%。",
      highlights: ["调整后的估值吸引力：演示口径下近三年收益为负，板块估值处于低位区间。", "CXO 与创新器械产业链覆盖：重仓研发外包与创新影像设备（演示）。", "行业特征基金：医药持仓约 74%，介于行业基金与均衡产品之间。"],
      script: { open: "这只产品我要先坦诚说明：它近一年是亏钱的。如果您对医药有长期耐心，我们可以聊聊它的左侧价值；如果没有，我就不多占用您时间。", value: "它的持仓集中在创新药产业链的 CXO 和创新器械，是医药里弹性最大的方向，也是过去两年调整最深的方向。如果创新药融资环境回暖，这类资产的修复弹性也最大（演示推断）。", risk: "左侧布局意味着浮亏可能先扩大：演示口径最大回撤约 28%，近一年收益为负。这类配置必须使用三年左右的资金，且仓位要小到不影响您的心态。", close: "如果您决定参与，建议控制在权益仓位的一成以内，并把加仓动作拆到未来两三个季度完成，不急于一次到位。" }
    },
    F007: {
      fit: [{ who: "首次配置权益的客户", why: "行业分散、风格均衡，适合作为权益投资的第一笔底仓。" }, { who: "核心—卫星策略客户", why: "适合作为核心仓位，卫星部分另行配置行业或主题基金。" }],
      avoid: "对某一主题行情有强预期、希望产品风格锐利的客户。",
      highlights: ["大盘均衡风格：前三大行业合计占比不到八成，单一行业暴露有限（演示）。", "长任职经理：现任经理任职 10 年，穿越多轮牛熊（演示）。", "规模与流动性：三百亿级规模，申赎便利，适合承载较大资金（演示）。"],
      script: { open: "对于您这笔准备进入权益市场的资金，我建议先用一只均衡型的产品打底，而不是直接选热点主题。", value: "这只产品持仓分散在消费、金融、科技等多个行业，重仓的都是各行业的龙头公司。经理任职超过十年，风格稳定，规模也足够大，大额进出都方便。它的定位是赚企业长期成长的钱，而不是追轮动。", risk: "均衡意味着在结构性行情里可能跑不赢热门行业：演示口径近一年收益约 10%、近三年收益有限。它的价值在于波动相对温和、拿得住。", close: "建议先配置六到七成的权益预算在这类均衡产品上，剩下的额度再考虑行业方向；我们每半年做一次持仓体检。" }
    },
    F008: {
      fit: [{ who: "成长进取型客户（C4 及以上）", why: "认可数字经济与 AI 产业趋势，接受高波动与小规模产品的不确定性。" }],
      avoid: "风险测评不匹配，或对产品规模、波动敏感的客户。",
      highlights: ["AI＋云计算双主题特征：两个主题持仓覆盖率均达主题特征级（演示）。", "小规模运作灵活：约 19 亿规模便于调仓（演示，同时需提示规模风险）。", "弹性突出：近一年收益约 25%，进攻性强（演示）。"],
      script: { open: "您关注的 AI 方向，我对比下来找到一只数字经济主题特征比较明显的基金，和您同步一下要点。", value: "它一半以上仓位在科技板块，AI 和云计算两个主题的持仓覆盖率都达到主题特征级，重仓 AI 应用与算力基础设施。近一年收益约 25%，在同类里弹性靠前（演示口径）。", risk: "两点必须提示：一是行业集中度高，回撤时幅度也大，演示口径最大回撤约 28%；二是产品规模不到 20 亿，运作灵活但同时波动和不确定性也更高，仓位务必控制。", close: "如果您决定参与，建议把它放在卫星仓、不超过权益资产的一成，并以季度为单位跟踪 AI 主题的净值联动情况。" }
    },
    F009: {
      fit: [{ who: "低波动偏好客户（C2 及以上）", why: "希望收益稳、回撤小，接受收益中枢低于含权产品。" }, { who: "组合压舱石需求", why: "在权益仓位之外配置稳健资产，降低组合整体波动。" }],
      avoid: "追求高收益、或把债券基金等同于存款的客户。",
      highlights: ["纯债运作：不含权益仓位，收益来源清晰（演示）。", "回撤控制优秀：演示口径最大回撤不足 2%，夏普比率高于权益类产品。", "沃德优选产品：进入本行精选基金池（演示）。"],
      script: { open: "您提到希望有一笔波动很小的稳健资产，我准备了一只纯债产品的资料，收益来源比较简单透明。", value: "这只产品只投债券，不碰股票，收益主要来自票息和久期管理。演示口径下近一年收益约 4.3%，最大回撤不到 2%，适合作为您组合里的压舱石。", risk: "需要澄清一个常见误解：纯债基金不是存款，净值也会波动——利率上行阶段可能出现小幅回撤，演示口径下最大回撤约 1.8%。它替代的是现金类资产，而不是高收益资产。", close: "建议把未来半年内确定要用的钱放现金管理，其余稳健部分可以考虑这类纯债产品，我们按季度检视一次即可。" }
    },
    F010: {
      fit: [{ who: "稳健增强需求客户（C2 及以上）", why: "在债券打底的基础上，接受约一成权益仓位换取收益增强。" }],
      avoid: "要求净值只涨不跌、或无法接受二级债基级别回撤（演示最大回撤约 4%）的客户。",
      highlights: ["二级债基经典结构：约 12% 权益仓位增强收益（演示）。", "攻守兼备：演示口径近一年收益约 5.6%、最大回撤约 4%。", "重点持营产品：当月重点持续营销基金池成员（演示）。"],
      script: { open: "介于您说的“太稳的收益不够、股票又嫌波动大”之间，其实有一类二级债基产品，我拿资料给您看。", value: "它的结构是八成多债券打底，一成左右权益增强。演示口径近一年收益约 5.6%，最大回撤约 4%——收益比纯债高一些，波动比股票基金小得多，比较符合您的要求。", risk: "要如实说明：里面那一成股票仓位意味着股债同时走弱时，净值也会回撤，演示口径历史最大回撤约 4%。它不是保本产品，收益也是波动的。", close: "如果这个风险画像您能接受，可以把稳健资产的一部分配置到这类产品上，其余仍留在纯债和现金里，形成梯队。" }
    },
    F011: {
      fit: [{ who: "流动性管理客户（C1 及以上）", why: "短期闲置资金、备用金，随时可能动用。" }],
      avoid: "以长期增值为目标、或希望获取资本市场收益的客户。",
      highlights: ["极低波动：演示口径年化波动率仅 0.2%，回撤几乎可忽略。", "短久期策略：持仓以短融和同业存单为主，利率风险小（演示）。", "灵活申赎：适合作为资金的“中转站”（演示）。"],
      script: { open: "您这笔三个月内可能要用的钱，我建议不要放在活期里，可以看一下短债产品。", value: "这只短债基金主要投短久期债券和同业存单，波动非常小，演示口径近一年收益约 2.9%，明显好于活期和货基的平均水平。用钱时赎回也灵活。", risk: "它是低风险而不是无风险：利率波动同样会带来净值的小幅起伏，只是幅度很小。它的定位是“比现金略好的现金”，不是投资增值工具。", close: "可以把三到六个月的开销和备用金放在这类产品里，长期资金我们另外按您的风险偏好规划。" }
    },
    F012: {
      fit: [{ who: "首次尝试含权产品的稳健客户（C2 及以上）", why: "希望参与权益收益又担心波动，固收+结构提供缓冲。" }, { who: "本行重点产品偏好客户", why: "沃德优选＋重点首发双标签产品，营销资源支持充分（演示）。" }],
      avoid: "需要保本承诺、或无法接受固收+级别回撤（演示最大回撤约 5%）的客户。",
      highlights: ["固收+经典结构：约 78% 债券＋18% 权益（演示）。", "本行双标签：沃德优选与当月重点首发基金池成员（演示）。", "回撤可控：演示口径最大回撤约 5%，波动低于偏股产品一半以上。"],
      script: { open: "您之前说想试试股票类资产但怕波动，我推荐一只固收+产品，它的结构相当于“债券打底、股票增强”。", value: "这只产品近八成仓位是债券，不到两成是股票，其中股票部分还偏红利方向。演示口径近一年收益约 6.8%，最大回撤约 5%，收益弹性比纯债好、波动比偏股基金小很多。它还是我们沃德优选和当月重点首发产品（演示）。", risk: "固收+不等于稳赚：股债同时调整的极端情况下，演示口径历史最大回撤约 5%。如果您对任何回撤都完全不能接受，我们应该退回纯债方案。", close: "建议先用稳健资产中的一部分参与，观察一两个季度的持有体验后再决定是否加量。" }
    },
    F013: {
      fit: [{ who: "活钱管理客户（C1）", why: "日常现金、短期备付资金的停放工具。" }],
      avoid: "追求资本增值、或需要特定期限配置的客户。",
      highlights: ["现金管理工具：风险等级 R1，波动极小（演示）。", "规模效应：超六百亿规模，摊薄成本、申赎便利（演示）。", "组合流动性层：适合作为资产配置的最底层。"],
      script: { open: "您账户里这笔随时要用的活钱，现在放活期有点可惜，我建议换成货币基金。", value: "货币基金投资同业存单、短融这类高流动性资产，演示口径近一年收益约 1.9%，好于活期利率，用钱时赎回也方便。它的作用是让活钱“不闲着”。", risk: "货币基金是低风险产品，但不是存款、也不承诺保本；极少数情况下收益率会波动。它的定位就是现金管理，不承担增值功能。", close: "可以把两到三个月的开销放在这里；再长期的资金，我们再按您的风险偏好逐层规划。" }
    },
    F014: {
      fit: [{ who: "多市场分散需求客户（C4 及以上）", why: "希望分散 A 股单一市场风险，配置港股核心资产。" }, { who: "长期看好中资企业客户", why: "认同中资龙头企业的长期价值重估逻辑。" }],
      avoid: "不了解汇率风险、交易时段差异，或风险测评不匹配的客户。",
      highlights: ["一键配置港股核心：腾讯、阿里等中资龙头为主要持仓（演示）。", "估值相对优势：相对 A 股同类资产存在折价（演示口径）。", "QDII 分散价值：与 A 股相关性相对较低，有组合分散意义。"],
      script: { open: "您提到过担心 A 股单一市场风险，港股通 QDII 这类工具可以帮您把配置范围拓宽一些。", value: "这只产品跟踪港股的中资企业指数，重仓腾讯、阿里这类在 A 股买不到的龙头。同类资产在港股的估值相对 A 股有折价（演示口径），长期看有收敛的可能。", risk: "三点要提前说清：一是 QDII 以外币资产为主，汇率波动会影响净值；二是港股交易时段与 A 股不同，净值更新有时差；三是港股波动不小，演示口径近三年收益为负。必须用长期资金、小仓位参与。", close: "如果确认参与，建议控制在权益仓位的一成以内，并接受按季度检视的节奏——跨境资产的逻辑验证周期更长。" }
    },
    F015: {
      fit: [{ who: "组合分散需求客户（C3 及以上）", why: "黄金与股债相关性低，是组合层面的风险对冲工具。" }, { who: "避险情绪客户", why: "关注地缘与货币信用风险的对冲价值。" }],
      avoid: "希望短期博弈金价涨跌、或预期获得股息/利息现金流的客户。",
      highlights: ["组合对冲工具：金价与股债相关性低，降低组合整体波动（演示逻辑）。", "定价逻辑清晰：核心变量是实际利率与美元走势，便于跟踪。", "弹性充足：演示口径近一年收益约 17%、近三年约 38%。"],
      script: { open: "您提到担心市场不确定性，黄金这类资产在组合里的对冲作用值得考虑，我准备了资料。", value: "这只产品跟踪国内金价，核心定价逻辑是实际利率和美元：利率下行、美元走弱时金价往往受益（演示逻辑）。它的价值不在于单边上涨，而在于和股票、债券的相关性低，能让整个组合更抗波动。演示口径近三年收益约 38%，弹性也不错。", risk: "黄金没有利息和分红，价格完全取决于市场预期，回调时同样干脆；且近三年涨幅较大，短期追高风险不小。建议作为配置的一小部分，而不是主要仓位。", close: "比较稳妥的方式是给组合配 5%—10% 的黄金类资产并长期再平衡，而不是判断金价短期的方向。" }
    },
    F016: {
      fit: [{ who: "省心配置型客户（C3 及以上）", why: "没精力跟踪单只基金，希望由专业团队完成“选基与配比”。" }, { who: "新手起步客户", why: "以一票基金完成多资产、多策略的初步分散。" }],
      avoid: "对费率敏感、或已具备自主选基能力并希望精确控制持仓的客户。",
      highlights: ["二次分散：通过持有约 65% 权益基金＋25% 债券基金实现多策略配置（演示）。", "一票多策略：由 FOF 经理完成底层基金筛选与再平衡。", "当月重点首发产品：新发营销资源支持（演示）。"],
      script: { open: "如果您觉得一个个挑基金太耗精力，其实可以把“选基和配比”这件事交给 FOF 基金经理，我带了资料。", value: "这只 FOF 把资金分散投资在一篮子权益和债券基金上，相当于“基金的组合”。演示口径近一年收益约 7.3%、最大回撤约 17%，介于均衡偏股和稳健产品之间，适合作为一站式配置的起点。", risk: "两点如实说明：一是 FOF 存在双重收费——底层基金的费用之上还有本层管理费；二是申赎确认比普通基金慢，不适合频繁交易的资金。它的价值是省心和纪律化，不是收益最大化。", close: "可以把一部分“不知道怎么配”的资金先放进这类产品，随着您对市场熟悉度提高，再逐步建立主动配置的部分。" }
    },
    F017: {
      fit: [{ who: "稳定分红偏好客户（C3 及以上）", why: "看重基础设施运营产生的现金流与分红，理解不动产属性。" }],
      avoid: "期待资本利得、不了解 REITs 交易机制与流动性限制的客户。",
      highlights: ["收益来源清晰：仓储物流园区的租金现金流（演示）。", "强制分红机制：REITs 按规则将大部分可分配收益用于分红。", "与传统股债低相关：资产类别分散价值（演示逻辑）。"],
      script: { open: "您比较看重稳定的现金流回报，公募 REITs 这类资产和您聊聊——它投的是能收租金的基础设施。", value: "这只 REITs 底层资产是仓储物流园区，收益主要来自租金。按监管要求，REITs 要把绝大部分可分配收益分给持有人，现金流相对透明，和股票、债券的走势相关性也低（演示逻辑）。", risk: "必须说明它的特殊性：一是 REITs 二级市场价格波动可能很大，演示口径最大回撤约 10%；二是租金和出租率受经济周期影响；三是成交活跃度低于普通基金，大额进出有冲击成本。它适合小仓位长期持有收分红。", close: "如果您认可“收租”这个逻辑，可以用一小部分资金参与，把分红现金流作为检视的主要指标，而不是每天盯价格。" }
    }
  };


  /* 演示走势：由收益率与波动率派生，保证同一基金每次一致 */
  const hashString = value => { let hash = 0; for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0; return Math.abs(hash); };
  funds.forEach(fund => {
    const n = 12, end = fund.ret.y1, seedBase = hashString(fund.id), amp = Math.max(1.2, Math.min(7, fund.volatility / 4));
    const points = [];
    for (let i = 0; i < n; i += 1) {
      const t = i / (n - 1);
      const wave = Math.sin(t * Math.PI * (1.5 + (seedBase % 3) * 0.35) + (seedBase % 7)) * amp * 0.55;
      const jitter = (((seedBase * (i + 3) * 9301 + 49297) % 233280) / 233280 - 0.5) * amp * 0.7;
      points.push(+(end * t + wave + jitter).toFixed(2));
    }
    points[0] = 0;
    points[n - 1] = end;
    fund.spark = points;
  });

  /* ============================ 状态 ============================ */
  const state = {
    subs: new Set(["股票型", "偏股混合型", "平衡混合型", "指数型"]),
    tags: new Set(),
    industries: new Set(),
    themes: new Set(),
    risk: new Set(),
    scales: new Set(),
    ages: new Set(),
    perfPeriod: "y1",
    perfMin: null,
    fee: null,
    company: "",
    manager: "",
    sort: "default",
    view: "list",
    compare: [],
    watch: new Set(),
    expanded: new Set(["equity"])
  };

  /* ============================ 工具函数 ============================ */
  const pct = value => (value === null || value === undefined) ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
  const dirClass = value => (value === null || value === undefined) ? "" : value > 0 ? "up" : value < 0 ? "down" : "";
  const activeCategoryIds = () => strategyGroups.filter(group => group.subs.some(sub => state.subs.has(sub))).map(group => group.id);
  const equityActive = () => strategyGroups[0].subs.some(sub => state.subs.has(sub));
  const scaleMatch = (fund, key) => {
    if (key === "lt1") return fund.scale < 1;
    if (key === "s1") return fund.scale >= 1 && fund.scale < 10;
    if (key === "s10") return fund.scale >= 10 && fund.scale < 50;
    if (key === "s50") return fund.scale >= 50 && fund.scale < 100;
    return fund.scale >= 100;
  };
  const ageOf = fund => 2026 - fund.est;
  const ageMatch = (fund, key) => {
    const age = ageOf(fund);
    if (key === "lt1") return age < 1;
    if (key === "a1") return age >= 1 && age < 3;
    if (key === "a3") return age >= 3 && age < 5;
    return age >= 5;
  };

  function industryLabel(fund) {
    if (!fund.industry || !fund.industryLevel) return "";
    const name = industryMap[fund.industry] ? industryMap[fund.industry].name : fund.industry;
    if (fund.industryLevel === "strong") return `${name}行业基金`;
    if (fund.industryLevel === "normal") return `${name}行业特征`;
    return `含${name}倾向`;
  }
  function themeLabel(theme) {
    if (theme.level === "strong") return `${theme.name}主题`;
    if (theme.level === "normal") return `${theme.name}主题特征`;
    return `含${theme.name}倾向`;
  }
  const levelClass = level => level === "strong" ? "level-strong" : level === "normal" ? "level-normal" : "level-weak";

  function matches(fund) {
    if (state.subs.size && !state.subs.has(fund.sub)) return false;
    if (state.tags.size && !fund.tags.some(tag => state.tags.has(tag))) return false;
    if (equityActive()) {
      if (state.industries.size && !state.industries.has(fund.industry)) return false;
      if (state.themes.size && !fund.themes.some(theme => state.themes.has(theme.name))) return false;
    }
    if (state.risk.size && !state.risk.has(fund.risk)) return false;
    if (state.scales.size && ![...state.scales].some(key => scaleMatch(fund, key))) return false;
    if (state.ages.size && ![...state.ages].some(key => ageMatch(fund, key))) return false;
    if (state.fee) {
      if (state.fee === "low" && fund.feeMgmt > 0.30) return false;
      if (state.fee === "mid" && !(fund.feeMgmt > 0.30 && fund.feeMgmt <= 0.80)) return false;
      if (state.fee === "high" && fund.feeMgmt <= 0.80) return false;
    }
    if (state.perfMin !== null && state.perfMin !== "") {
      const value = fund.ret[state.perfPeriod];
      if (value === null || value === undefined || value < Number(state.perfMin)) return false;
    }
    if (state.company && !fund.company.toLowerCase().includes(state.company.toLowerCase())) return false;
    if (state.manager && !fund.manager.toLowerCase().includes(state.manager.toLowerCase())) return false;
    return true;
  }

  const tagMatchCount = fund => (state.tags.size ? fund.tags.filter(tag => state.tags.has(tag)).length : fund.tags.length);

  function sorted(list) {
    const copy = [...list];
    const byY1 = (a, b) => b.ret.y1 - a.ret.y1;
    switch (state.sort) {
      case "y1desc": return copy.sort(byY1);
      case "m3desc": return copy.sort((a, b) => b.ret.m3 - a.ret.m3);
      case "ddasc": return copy.sort((a, b) => Math.abs(a.drawdown) - Math.abs(b.drawdown));
      case "sharpedesc": return copy.sort((a, b) => (b.sharpe ?? -9) - (a.sharpe ?? -9));
      case "scaledesc": return copy.sort((a, b) => b.scale - a.scale);
      case "estdesc": return copy.sort((a, b) => b.est - a.est);
      default: return copy.sort((a, b) => (tagMatchCount(b) - tagMatchCount(a)) || byY1(a, b));
    }
  }

  const filtered = () => (state.subs.size ? sorted(funds.filter(matches)) : []);

  /* ============================ 筛选面板 ============================ */
  function renderFilterPanel() {
    const panel = $("#fundFilter");
    if (!panel) return;
    const catHTML = strategyGroups.map(group => {
      const count = funds.filter(fund => group.subs.includes(fund.sub)).length;
      return `
        <div class="cat-item" data-cat="${group.id}">
          <div class="cat-row">
            <button class="cat-check" data-cat-toggle="${group.id}" aria-label="选择${group.name}">${icon("check")}</button>
            <button class="cat-name" data-cat-toggle="${group.id}">${group.name}<span class="cat-count">${count}</span></button>
            <button class="cat-expand" data-cat-expand="${group.id}" aria-label="展开${group.name}">${icon("chevron-down")}</button>
          </div>
          <div class="cat-chips">${group.subs.map(sub => `<button class="mini-chip" data-sub="${sub}">${sub}<small>${funds.filter(fund => fund.sub === sub).length}</small></button>`).join("")}</div>
          <div class="cat-hint">${group.subs.join(" / ")}</div>
        </div>`;
    }).join("");

    const tagHTML = tagDefs.map(tag => `
      <button class="tag-card" data-tag="${tag.id}">
        <span class="tag-glyph">${icon(tag.id === "ward" ? "shield" : tag.id === "hold" ? "trend-up" : "sparkles")}</span>
        <span class="tag-body"><strong>${tag.short}<span class="cat-count"> ${funds.filter(fund => fund.tags.includes(tag.id)).length}</span></strong><small>${tag.desc}</small></span>
        <span class="tag-toggle">${icon("check")}</span>
      </button>`).join("");

    const industryHTML = industries.map(item =>
      `<button class="industry-chip" data-industry="${item.id}">${item.name}<small>${funds.filter(fund => fund.industry === item.id).length}</small></button>`).join("");

    const themeHTML = themeGroups.map(group => `
      <div class="theme-group">
        <div class="theme-title">${group.name}</div>
        <div class="theme-chips">${group.items.map(item => `<button class="theme-chip" data-theme="${item}">${item}</button>`).join("")}</div>
      </div>`).join("");

    panel.innerHTML = `
      <div class="filter-head"><h2>筛选条件</h2><button class="filter-reset" id="filterReset">重置</button></div>

      <section class="filter-step">
        <div class="step-head"><span class="step-no">1</span><h3>策略类型</h3><span class="step-required">必选</span></div>
        <p class="step-hint">先选大类，可再勾选子类；选中项常驻结果区顶部。</p>
        <div class="cat-list">${catHTML}</div>
      </section>

      <section class="filter-step">
        <div class="step-head"><span class="step-no">2</span><h3>交行特色标签</h3></div>
        <p class="step-hint">可独立勾选、叠加使用；命中多个标签优先展示。</p>
        <div class="tag-stack">${tagHTML}</div>
      </section>

      <section class="filter-step equity-only" id="equityFilter">
        <div class="step-head"><span class="step-no">3</span><h3>行业与概念</h3><span class="step-required" style="color:#2f6a8e;background:#eef6fb">权益类专属</span></div>
        <p class="step-hint">申万 2021 版 31 个一级行业归集为 8 大板块，可叠加主题概念。</p>
        <div class="aux-label">行业板块 <small>可多选</small></div>
        <div class="industry-grid">${industryHTML}</div>
        ${themeHTML}
        <div class="filter-note">${icon("alert")}<span>行业/主题基金集中度较高，波动可能显著大于宽基产品，请结合客户风险承受能力审慎推荐。</span></div>
      </section>

      <section class="filter-step">
        <button class="aux-toggle" id="auxToggle"><h3>辅助筛选</h3><span class="aux-meta">7 项条件 ${icon("chevron-down")}</span></button>
        <div class="aux-body" id="auxBody">
          <div class="aux-field">
            <div class="aux-label">风险等级 <small>可多选</small></div>
            <div class="chip-row">${["R1", "R2", "R3", "R4", "R5"].map(risk => `<button class="risk-chip" data-risk="${risk}">${risk}</button>`).join("")}</div>
          </div>
          <div class="aux-field">
            <div class="aux-label">基金公司 <small>名称搜索</small></div>
            <label class="search-field">${icon("search")}<input id="companyInput" type="text" placeholder="输入基金公司名称" autocomplete="off"></label>
          </div>
          <div class="aux-field">
            <div class="aux-label">业绩表现 <small>收益率下限</small></div>
            <div class="range-row">
              <select id="perfPeriod">
                <option value="m1">近 1 月</option>
                <option value="m3">近 3 月</option>
                <option value="m6">近 6 月</option>
                <option value="y1" selected>近 1 年</option>
                <option value="y3">近 3 年</option>
              </select>
              <span>≥</span>
              <input id="perfMin" type="number" step="1" min="-50" max="200" placeholder="不限">
              <span>%</span>
            </div>
          </div>
          <div class="aux-field">
            <div class="aux-label">基金规模</div>
            <div class="chip-row">${Object.entries(scaleBuckets).map(([key, label]) => `<button class="mini-chip" data-scale="${key}">${label}</button>`).join("")}</div>
          </div>
          <div class="aux-field">
            <div class="aux-label">成立年限</div>
            <div class="chip-row">${Object.entries(ageBuckets).map(([key, label]) => `<button class="mini-chip" data-age="${key}">${label}</button>`).join("")}</div>
          </div>
          <div class="aux-field">
            <div class="aux-label">基金经理 <small>姓名搜索</small></div>
            <label class="search-field">${icon("search")}<input id="managerInput" type="text" placeholder="输入基金经理姓名" autocomplete="off"></label>
          </div>
          <div class="aux-field">
            <div class="aux-label">费率区间 <small>管理费分档</small></div>
            <div class="chip-row">
              <button class="mini-chip" data-fee="low">≤ 0.30%</button>
              <button class="mini-chip" data-fee="mid">0.30%—0.80%</button>
              <button class="mini-chip" data-fee="high">&gt; 0.80%</button>
            </div>
          </div>
        </div>
      </section>`;
  }

  function syncFilterUI() {
    $$(".cat-item").forEach(item => {
      const group = strategyGroups.find(entry => entry.id === item.dataset.cat);
      item.classList.toggle("on", group.subs.some(sub => state.subs.has(sub)));
      item.classList.toggle("open", state.expanded.has(group.id));
    });
    $$("[data-sub]").forEach(chip => chip.classList.toggle("active", state.subs.has(chip.dataset.sub)));
    $$("[data-tag]").forEach(card => card.classList.toggle("active", state.tags.has(card.dataset.tag)));
    $$("[data-industry]").forEach(chip => chip.classList.toggle("active", state.industries.has(chip.dataset.industry)));
    $$("[data-theme]").forEach(chip => chip.classList.toggle("active", state.themes.has(chip.dataset.theme)));
    $$("[data-risk]").forEach(chip => chip.classList.toggle("active", state.risk.has(chip.dataset.risk)));
    $$("[data-scale]").forEach(chip => chip.classList.toggle("active", state.scales.has(chip.dataset.scale)));
    $$("[data-age]").forEach(chip => chip.classList.toggle("active", state.ages.has(chip.dataset.age)));
    $$("[data-fee]").forEach(chip => chip.classList.toggle("active", state.fee === chip.dataset.fee));
    const equityBlock = $("#equityFilter");
    if (equityBlock) equityBlock.classList.toggle("show", equityActive());
    const companyInput = $("#companyInput");
    if (companyInput && companyInput.value !== state.company) companyInput.value = state.company;
    const managerInput = $("#managerInput");
    if (managerInput && managerInput.value !== state.manager) managerInput.value = state.manager;
    const perfMin = $("#perfMin");
    if (perfMin && String(perfMin.value) !== String(state.perfMin ?? "")) perfMin.value = state.perfMin ?? "";
    const perfPeriod = $("#perfPeriod");
    if (perfPeriod) perfPeriod.value = state.perfPeriod;
  }

  /* ============================ 工具栏 ============================ */
  function activeChips() {
    const chips = [];
    state.subs.forEach(sub => chips.push({ label: sub, remove: `sub:${sub}` }));
    state.tags.forEach(tag => chips.push({ label: tagMap[tag].short, remove: `tag:${tag}` }));
    if (equityActive()) {
      state.industries.forEach(id => chips.push({ label: industryMap[id].name, remove: `industry:${id}` }));
      state.themes.forEach(name => chips.push({ label: name, remove: `theme:${name}` }));
    }
    state.risk.forEach(risk => chips.push({ label: risk, remove: `risk:${risk}` }));
    state.scales.forEach(key => chips.push({ label: scaleBuckets[key], remove: `scale:${key}` }));
    state.ages.forEach(key => chips.push({ label: ageBuckets[key], remove: `age:${key}` }));
    if (state.perfMin !== null && state.perfMin !== "") {
      const periodLabel = { m1: "近 1 月", m3: "近 3 月", m6: "近 6 月", y1: "近 1 年", y3: "近 3 年" }[state.perfPeriod];
      chips.push({ label: `${periodLabel} ≥ ${state.perfMin}%`, remove: "perf" });
    }
    if (state.fee) chips.push({ label: { low: "管理费 ≤ 0.30%", mid: "管理费 0.30%—0.80%", high: "管理费 > 0.80%" }[state.fee], remove: "fee" });
    if (state.company) chips.push({ label: `公司：${state.company}`, remove: "company" });
    if (state.manager) chips.push({ label: `经理：${state.manager}`, remove: "manager" });
    return chips;
  }

  function renderToolbar(count) {
    const chips = activeChips();
    const chipHTML = chips.map(chip => `<span class="active-chip">${escapeHTML(chip.label)}<button data-remove="${chip.remove}" aria-label="移除${escapeHTML(chip.label)}">${icon("x")}</button></span>`).join("");
    const sortOptions = [
      ["default", "默认：特色标签优先 + 近 1 年降序"],
      ["y1desc", "近 1 年收益率 高→低"],
      ["m3desc", "近 3 月收益率 高→低"],
      ["ddasc", "最大回撤 小→大"],
      ["sharpedesc", "夏普比率 高→低"],
      ["scaledesc", "基金规模 大→小"],
      ["estdesc", "成立时间 新→旧"]
    ];
    $("#fundToolbar").innerHTML = `
      <div class="active-chips">${chipHTML}${chips.length ? `<button class="chips-clear" id="chipsClear">清空全部</button>` : ""}</div>
      <div class="toolbar-row">
        <div class="result-count">共 <b>${count}</b> 只基金<span>演示数据 · 仅作流程展示</span></div>
        <div class="toolbar-actions">
          <label class="sort-select"><span>排序</span><select id="fundSort">${sortOptions.map(([value, label]) => `<option value="${value}" ${state.sort === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
          <div class="view-toggle">
            <button class="${state.view === "list" ? "active" : ""}" data-view="list" aria-label="列表视图">${icon("list")}</button>
            <button class="${state.view === "card" ? "active" : ""}" data-view="card" aria-label="卡片视图">${icon("grid")}</button>
          </div>
          <button class="compare-entry ${state.compare.length ? "has-selection" : ""}" data-open-compare>${icon("compare")}对比 <b>${state.compare.length}/5</b></button>
        </div>
      </div>`;
  }

  /* ============================ 结果渲染 ============================ */
  function tagBadges(fund) {
    if (!fund.tags.length) return `<span class="muted">—</span>`;
    return fund.tags.map(tag => `<span class="tag-badge ${tag}">${tagMap[tag].short}</span>`).join("");
  }

  function labelChips(fund) {
    const items = [];
    if (fund.industry && fund.industryLevel) items.push(`<span class="label-chip ${levelClass(fund.industryLevel)}">${industryLabel(fund)}</span>`);
    fund.themes.forEach(theme => items.push(`<span class="label-chip ${levelClass(theme.level)}">${themeLabel(theme)}</span>`));
    return items.length ? items.join("") : `<span class="muted">—</span>`;
  }

  function rowActions(fund) {
    const comparing = state.compare.includes(fund.id);
    return `<div class="row-actions">
      <button class="icon-btn ${comparing ? "compare-on" : ""}" data-compare-id="${fund.id}" title="${comparing ? "移出对比" : "加入对比"}" aria-pressed="${comparing}">${icon("compare")}</button>
      <button class="icon-btn ${state.watch.has(fund.id) ? "on" : ""}" data-watch-id="${fund.id}" title="加入自选">${icon("star")}</button>
      <button class="icon-btn" data-poster-id="${fund.id}" title="基金销售一页纸">${icon("file")}</button>
    </div>`;
  }

  function renderTableView(list) {
    return `<div class="fund-table-wrap"><table class="fund-table">
      <thead><tr>
        <th>基金名称 / 代码</th><th>特色标签</th><th>策略类型</th><th>行业 / 概念</th><th>风险</th>
        <th class="num">近 1 年</th><th class="num">规模</th><th>基金经理</th><th class="num">实时</th><th style="text-align:right">操作</th>
      </tr></thead>
      <tbody>${list.map(fund => `
        <tr class="${state.compare.includes(fund.id) ? "compare-on" : ""}">
          <td><button class="fund-name-btn" data-open-type="screenerFund" data-open-id="${fund.id}"><strong>${escapeHTML(fund.name)}</strong><small>${fund.code} · ${escapeHTML(fund.company)}</small></button></td>
          <td>${tagBadges(fund)}</td>
          <td>${fund.sub}</td>
          <td>${labelChips(fund)}</td>
          <td><span class="risk-pill ${fund.risk.toLowerCase()}">${fund.risk}</span></td>
          <td class="cell-num"><span class="ret ${dirClass(fund.ret.y1)}">${pct(fund.ret.y1)}</span></td>
          <td class="cell-num">${fund.scale.toFixed(1)} 亿</td>
          <td><div class="manager-cell">${escapeHTML(fund.manager)}<small>任职 ${fund.managerYears} 年</small></div></td>
          <td class="cell-num live-cell">${livePctBadge(fund.code)}</td>
          <td>${rowActions(fund)}</td>
        </tr>`).join("")}
      </tbody></table></div>`;
  }

  function renderCardView(list) {
    return `<div class="fund-cards">${list.map(fund => `
      <div class="fund-card ${state.compare.includes(fund.id) ? "compare-on" : ""}">
        <div class="fund-card-top">
          <button class="fund-card-title" data-open-type="screenerFund" data-open-id="${fund.id}"><strong>${escapeHTML(fund.name)}</strong><small>${fund.code} · ${fund.sub}</small></button>
          ${livePctBadge(fund.code)}
          <span class="risk-pill ${fund.risk.toLowerCase()}">${fund.risk}</span>
        </div>
        <div class="fund-card-tags">${tagBadges(fund)}</div>
        <div class="fund-card-metrics">
          <div><span>近 1 年</span><strong class="${dirClass(fund.ret.y1)}">${pct(fund.ret.y1)}</strong></div>
          <div><span>最大回撤</span><strong class="down">${fund.drawdown.toFixed(1)}%</strong></div>
          <div><span>规模</span><strong>${fund.scale.toFixed(1)} 亿</strong></div>
        </div>
        <div class="fund-card-labels">${labelChips(fund)}</div>
        <div class="fund-card-foot">
          <span class="fund-card-manager">经理 <b>${escapeHTML(fund.manager)}</b> · ${fund.managerYears} 年</span>
          ${rowActions(fund)}
        </div>
      </div>`).join("")}</div>`;
  }

  function renderResults() {
    const list = filtered();
    renderToolbar(list.length);
    const area = $("#fundResultArea");
    if (!area) return;
    if (!state.subs.size) {
      area.innerHTML = `<div class="empty-result">${icon("sliders")}<strong>请先选择策略类型</strong><p>策略类型为必选条件：在左侧勾选权益类、固收类等大类，或展开后选择具体子类。</p></div>`;
      renderCompareTray();
      return;
    }
    if (!list.length) {
      area.innerHTML = `<div class="empty-result">${icon("search")}<strong>当前组合无匹配产品</strong><p>建议放宽筛选条件，或减少行业概念与特色标签的叠加。</p><button class="btn btn-secondary btn-small" id="emptyReset">放宽筛选条件</button></div>`;
      const emptyReset = $("#emptyReset");
      if (emptyReset) emptyReset.addEventListener("click", resetAll, { once: true });
    } else {
      area.innerHTML = state.view === "list" ? renderTableView(list) : renderCardView(list);
    }
    renderCompareTray();
  }

  /* ============================ 对比 ============================ */
  function renderCompareTray() {
    const tray = $("#compareTray");
    if (!tray) return;
    if (!state.compare.length) { tray.hidden = true; tray.innerHTML = ""; return; }
    tray.hidden = false;
    tray.innerHTML = `<div class="compare-tray-inner">
      <div class="tray-label">已选 <b>${state.compare.length}</b> / 5 只</div>
      <div class="tray-chips">${state.compare.map(id => `<span class="tray-chip"><span>${escapeHTML(fundMap[id].name)}</span><button data-compare-remove="${id}" aria-label="移除">${icon("x")}</button></span>`).join("")}</div>
      <div class="tray-actions"><button class="tray-ghost" data-compare-clear>清空</button><button class="tray-primary" data-open-compare>开始对比</button></div>
    </div>`;
  }

  function toggleCompare(id) {
    const index = state.compare.indexOf(id);
    if (index >= 0) state.compare.splice(index, 1);
    else if (state.compare.length >= 5) { window.FundThinkTank && window.FundThinkTank.showToast("最多同时对比 5 只基金", "info"); return; }
    else state.compare.push(id);
    renderResults();
  }

  function compareChart(selected) {
    const width = 620, height = 172, padL = 34, padR = 12, padT = 12, padB = 22;
    const all = selected.flatMap(fund => fund.spark);
    const max = Math.max(...all, 1), min = Math.min(...all, -1);
    const span = Math.max(max - min, 1);
    const x = index => padL + (index / 11) * (width - padL - padR);
    const y = value => padT + (1 - (value - min) / span) * (height - padT - padB);
    const colors = ["#247cc1", "#c0783a", "#5b8f6b", "#8a6bb5", "#c05a56"];
    const grid = [0, 0.25, 0.5, 0.75, 1].map(ratio => {
      const value = max - span * ratio;
      return `<line x1="${padL}" y1="${y(value)}" x2="${width - padR}" y2="${y(value)}" stroke="#e8eff6" stroke-width="1"/><text x="${padL - 6}" y="${y(value) + 3}" fill="#93a3b4" font-size="8" text-anchor="end">${value.toFixed(0)}%</text>`;
    }).join("");
    const monthLabels = ["-11", "-9", "-7", "-5", "-3", "-1", "现在"].map((label, index) => {
      const pointIndex = index === 6 ? 11 : index * 2 - (index === 6 ? 0 : 2) + 2;
      const idx = index === 6 ? 11 : Math.min(11, Math.max(0, Math.round(index * 1.8)));
      return `<text x="${x(idx)}" y="${height - 6}" fill="#93a3b4" font-size="8" text-anchor="middle">${label}</text>`;
    }).join("");
    const lines = selected.map((fund, index) => {
      const points = fund.spark.map((value, i) => `${x(i).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
      return `<polyline points="${points}" fill="none" stroke="${colors[index % colors.length]}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
    }).join("");
    return `<svg class="cmp-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="近 12 个月业绩走势叠加（演示）">${grid}${lines}${monthLabels}</svg>`;
  }

  function compareHTML() {
    const selected = state.compare.map(id => fundMap[id]).filter(Boolean);
    if (!selected.length) return `<div class="empty-state"><strong>尚未选择对比基金</strong><p>请在列表中勾选 2—5 只基金。</p></div>`;
    const colors = ["#247cc1", "#c0783a", "#5b8f6b", "#8a6bb5", "#c05a56"];
    const legend = selected.map((fund, index) => `<span><i style="background:${colors[index % colors.length]}"></i>${escapeHTML(fund.name)}</span>`).join("");
    const rows = [
      { label: "近 1 年收益率", values: selected.map(fund => fund.ret.y1), format: value => pct(value), best: "max" },
      { label: "近 3 月收益率", values: selected.map(fund => fund.ret.m3), format: value => pct(value), best: "max" },
      { label: "最大回撤", values: selected.map(fund => fund.drawdown), format: value => `${value.toFixed(1)}%`, best: "minAbs" },
      { label: "年化波动率", values: selected.map(fund => fund.volatility), format: value => `${value.toFixed(1)}%`, best: "min" },
      { label: "夏普比率", values: selected.map(fund => fund.sharpe), format: value => value === null ? "—" : value.toFixed(2), best: "max" },
      { label: "基金规模", values: selected.map(fund => fund.scale), format: value => `${value.toFixed(1)} 亿`, best: null },
      { label: "管理费", values: selected.map(fund => fund.feeMgmt), format: value => `${value.toFixed(2)}%`, best: "min" },
      { label: "托管费", values: selected.map(fund => fund.feeCustody), format: value => `${value.toFixed(2)}%`, best: "min" }
    ];
    const bestIndex = (values, mode) => {
      if (!mode) return -1;
      const numeric = values.map((value, index) => ({ value: value === null ? null : (mode === "minAbs" ? Math.abs(value) : value), index })).filter(item => item.value !== null);
      if (!numeric.length) return -1;
      const target = numeric.reduce((best, item) => mode === "max" ? (item.value > best.value ? item : best) : (item.value < best.value ? item : best), numeric[0]);
      return target.index;
    };
    const metricTable = `<table class="cmp-table"><thead><tr><th>指标</th>${selected.map(fund => `<th>${escapeHTML(fund.code)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => {
      const best = bestIndex(row.values, row.best);
      return `<tr><td>${row.label}</td>${row.values.map((value, index) => `<td class="${index === best ? "best" : ""}">${row.format(value)}</td>`).join("")}</tr>`;
    }).join("")}</tbody></table>`;
    const structure = `<div class="detail-list">${selected.map(fund => `<div class="detail-list-item"><span><strong>${escapeHTML(fund.name)}</strong><small>${fund.mix.slice(0, 3).map(item => `${item.name} ${item.pct}%`).join(" · ")}</small></span><span>${fund.sub}</span></div>`).join("")}</div>`;
    const managerTable = `<table class="cmp-table"><thead><tr><th>项目</th>${selected.map(fund => `<th>${escapeHTML(fund.manager)}</th>`).join("")}</tr></thead><tbody>
      <tr><td>任职年限</td>${selected.map(fund => `<td>${fund.managerYears} 年</td>`).join("")}</tr>
      <tr><td>任职回报（演示）</td>${selected.map(fund => `<td>${pct(fund.managerReturn)}</td>`).join("")}</tr>
      <tr><td>策略类型</td>${selected.map(fund => `<td>${fund.sub}</td>`).join("")}</tr>
    </tbody></table>`;
    return `<div class="cmp-head">${selected.map(fund => `<span class="cmp-fund-tag"><i style="background:${colors[selected.indexOf(fund) % colors.length]}"></i>${escapeHTML(fund.name)}</span>`).join("")}</div>
      <div class="source-line">${icon("clock")}近 12 个月业绩走势 · 演示数据 · 2026/10/28</div>
      <section class="drawer-section"><div class="drawer-section-title"><h3>业绩走势叠加</h3><span>起点归一为 0</span></div>
        <div class="cmp-chart-card">${compareChart(selected)}<div class="cmp-legend">${legend}</div></div>
      </section>
      <section class="drawer-section"><div class="drawer-section-title"><h3>风险与收益指标</h3><span>绿色为同组较优</span></div>${metricTable}</section>
      <section class="drawer-section"><div class="drawer-section-title"><h3>持仓结构</h3><span>前三大行业（演示）</span></div>${structure}</section>
      <section class="drawer-section"><div class="drawer-section-title"><h3>基金经理与费率</h3><span>费率见上表</span></div>${managerTable}</section>
      <div class="risk-note" style="margin-top:18px">对比结果仅用于辅助筛选，不构成购买建议。导出或对外使用前须复核数据时点、适当性与合规文案。</div>
      <div class="drawer-actions"><button class="btn btn-secondary" data-compare-pdf>${icon("download")}导出对比 PDF</button><button class="btn btn-primary" data-compare-watch>${icon("star")}全部加入自选</button></div>`;
  }

  /* ============================ 详情 ============================ */
  function detailHTML(id) {
    const fund = fundMap[id];
    if (!fund) return `<div class="empty-state"><strong>未找到该基金</strong><p>请返回列表重新选择。</p></div>`;
    const labelList = [];
    if (fund.industry && fund.industryLevel) labelList.push(`<span class="label-chip ${levelClass(fund.industryLevel)}">${industryLabel(fund)}</span>`);
    fund.themes.forEach(theme => labelList.push(`<span class="label-chip ${levelClass(theme.level)}">${themeLabel(theme)}</span>`));
    const mixRows = fund.mix.map(item => `<div class="mix-row"><span>${item.name}</span><div class="mix-track"><div class="mix-fill" style="width:${item.pct}%"></div></div><b>${item.pct}%</b></div>`).join("");
    return `${window.FundThinkTank ? "" : ""}
      <div class="fund-hero">
        <div class="fund-hero-top"><div><h3>${escapeHTML(fund.name)}</h3><p>${fund.code} · ${fund.sub} · ${escapeHTML(fund.company)}</p></div><span class="risk-badge">${fund.risk}</span></div>
        <div class="fund-metrics"><div><span>近 1 年（演示）</span><strong class="${dirClass(fund.ret.y1)}">${pct(fund.ret.y1)}</strong></div><div><span>最大回撤</span><strong class="down">${fund.drawdown.toFixed(1)}%</strong></div><div><span>夏普比率</span><strong>${fund.sharpe === null ? "—" : fund.sharpe.toFixed(2)}</strong></div></div>
      </div>
      <div class="source-line">${icon("clock")}演示数据 · 净值 T+1 · 2026/10/28 08:40 · 非实时行情</div>
      ${liveNavBlock(fund.code)}
      <div class="screener-tag-row">${fund.tags.length ? tagBadges(fund) : ""}${labelList.join("")}${!fund.tags.length && !labelList.length ? `<span class="muted">暂无特色标签与行业概念标签</span>` : ""}</div>
      <section class="drawer-section"><div class="drawer-section-title"><h3>产品定位</h3><span>人工复核</span></div><p style="color:var(--ink-600);font-size:11px;line-height:1.8">${fund.role}</p></section>
      <section class="drawer-section"><div class="drawer-section-title"><h3>关键指标</h3><span>演示数据</span></div>
        <div class="screener-kpis"><div><span>基金规模</span><strong>${fund.scale.toFixed(1)} 亿</strong></div><div><span>成立年份</span><strong>${fund.est}</strong></div><div><span>年化波动率</span><strong>${fund.volatility.toFixed(1)}%</strong></div></div>
        <div class="detail-facts" style="margin-top:10px">
          <div><span>基金经理</span><b>${escapeHTML(fund.manager)}</b></div><div><span>任职年限</span><b>${fund.managerYears} 年</b></div>
          <div><span>近 3 月</span><b class="${dirClass(fund.ret.m3)}">${pct(fund.ret.m3)}</b></div><div><span>近 3 年</span><b class="${dirClass(fund.ret.y3)}">${pct(fund.ret.y3)}</b></div>
          <div><span>管理费</span><b>${fund.feeMgmt.toFixed(2)}%</b></div><div><span>托管费</span><b>${fund.feeCustody.toFixed(2)}%</b></div>
        </div>
      </section>
      <section class="drawer-section"><div class="drawer-section-title"><h3>行业分布</h3><span>穿透前</span></div><div class="mix-bars">${mixRows}</div></section>
      <section class="drawer-section"><div class="drawer-section-title"><h3>主要持仓</h3><span>演示</span></div><div class="holding-tags">${fund.holdings.map(item => `<span>${item.name}<small>${item.weight}</small></span>`).join("")}</div></section>
      <div class="risk-note" style="margin-top:18px">适当性提示：本页风险等级为 ${fund.risk}，向客户展示前须核对客户风险承受能力、资金期限与投资目标；不匹配时应给出强提示并不得主动推荐。</div>
      <div class="drawer-actions">
        <button class="btn btn-secondary" data-compare-id="${fund.id}">${icon("compare")}${state.compare.includes(fund.id) ? "移出对比" : "加入对比"}</button>
        <button class="btn btn-secondary" data-fund-ai="${fund.id}">${icon("sparkles")}沟通要点</button>
        <button class="btn btn-primary" data-poster-id="${fund.id}">${icon("file")}销售一页纸</button>
      </div>`;
  }

  /* ============================ 销售一页纸 ============================ */
  const riskCustomerMap = { R1: "C1（保守型）及以上", R2: "C2（稳健型）及以上", R3: "C3（平衡型）及以上", R4: "C4（成长型）及以上", R5: "C5（进取型）" };

  function salesHTML(id) {
    const fund = fundMap[id];
    const sales = salesData[id];
    if (!fund || !sales) return `<div class="empty-state"><strong>未找到该基金的一页纸</strong><p>请返回列表重新选择。</p></div>`;
    const mixText = fund.mix.slice(0, 3).map(item => `${item.name} ${item.pct}%`).join("、");
    const facts = [
      ["基金代码", fund.code], ["策略类型", fund.sub], ["基金公司", escapeHTML(fund.company)],
      ["风险等级", `${fund.risk} · 建议适用 ${riskCustomerMap[fund.risk]}`], ["基金规模", `${fund.scale.toFixed(1)} 亿元`], ["成立时间", `${fund.est} 年`],
      ["基金经理", `${escapeHTML(fund.manager)}（任职 ${fund.managerYears} 年）`], ["管理费 / 托管费", `${fund.feeMgmt.toFixed(2)}% / ${fund.feeCustody.toFixed(2)}%`],
      ["近 1 年收益", pct(fund.ret.y1)], ["近 3 年收益", pct(fund.ret.y3)], ["最大回撤", `${fund.drawdown.toFixed(1)}%`], ["主要投向", mixText]
    ];
    return `
      <div class="fund-hero">
        <div class="fund-hero-top"><div><h3>基金销售一页纸</h3><p>${escapeHTML(fund.name)} · ${fund.code} · ${fund.sub}</p></div><span class="risk-badge">${fund.risk}</span></div>
        <div class="fund-metrics"><div><span>近 1 年（演示）</span><strong class="${dirClass(fund.ret.y1)}">${pct(fund.ret.y1)}</strong></div><div><span>最大回撤</span><strong class="down">${fund.drawdown.toFixed(1)}%</strong></div><div><span>基金规模</span><strong>${fund.scale.toFixed(1)} 亿</strong></div></div>
      </div>
      <div class="source-line">${icon("clock")}演示数据 · 2026/10/28 08:40<span class="ai-badge" style="margin-left:8px">${icon("sparkles")}AI 辅助起草 · 须人工复核</span></div>
      <div class="screener-tag-row">${tagBadges(fund)}${labelChips(fund)}</div>

      <section class="drawer-section"><div class="drawer-section-title"><h3>一 · 产品基本信息</h3><span>以正式产品资料为准</span></div>
        <div class="detail-facts">${facts.map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join("")}</div>
        <p class="sales-positioning">${escapeHTML(fund.role)}</p>
      </section>

      <section class="drawer-section"><div class="drawer-section-title"><h3>二 · 适配客户</h3><span>适当性匹配优先</span></div>
        <div class="detail-list">${sales.fit.map(item => `<div class="detail-list-item"><span><strong>${escapeHTML(item.who)}</strong><small>${escapeHTML(item.why)}</small></span></div>`).join("")}</div>
        <div class="risk-note" style="margin-top:10px"><strong>不适用情形：</strong>${escapeHTML(sales.avoid)}</div>
      </section>

      <section class="drawer-section"><div class="drawer-section-title"><h3>三 · 营销亮点</h3><span>基于演示数据</span></div>
        <ol class="rule-list sales-highlights">${sales.highlights.map(item => `<li>${escapeHTML(item)}</li>`).join("")}</ol>
      </section>

      <section class="drawer-section"><div class="drawer-section-title"><h3>四 · 沟通话术</h3><span>演示草稿 · 禁止承诺收益</span></div>
        <div class="sales-script">
          <div class="script-block"><span>开场 · 建立关联</span><p>${escapeHTML(sales.script.open)}</p></div>
          <div class="script-block"><span>价值说明 · 讲清逻辑</span><p>${escapeHTML(sales.script.value)}</p></div>
          <div class="script-block risk"><span>风险应对 · 主动提示</span><p>${escapeHTML(sales.script.risk)}</p></div>
          <div class="script-block"><span>促成与后续 · 留下动作</span><p>${escapeHTML(sales.script.close)}</p></div>
        </div>
      </section>

      <div class="risk-note" style="margin-top:18px">合规提示：本页由 AI 基于演示数据起草，历史业绩不代表未来表现，投资有风险，选择需谨慎。对外使用前须经合规文案模板校验，不得自行删改风险提示语；客户推荐前须完成适当性匹配复核。</div>
      <div class="drawer-actions"><button class="btn btn-secondary" data-sales-copy="${fund.id}">${icon("copy")}复制一页纸文本</button><button class="btn btn-primary" data-fund-ai="${fund.id}">${icon("sparkles")}AI 细化话术</button></div>`;
  }

  function salesText(id) {
    const fund = fundMap[id];
    const sales = salesData[id];
    if (!fund || !sales) return "";
    const lines = [
      `【基金销售一页纸 · 演示稿】`,
      `${fund.name}（${fund.code} · ${fund.sub} · ${fund.risk}）`,
      ``,
      `一、产品基本信息`,
      `基金公司：${fund.company}｜规模：${fund.scale.toFixed(1)} 亿元｜成立：${fund.est} 年`,
      `经理：${fund.manager}（任职 ${fund.managerYears} 年）｜管理费 ${fund.feeMgmt.toFixed(2)}% / 托管费 ${fund.feeCustody.toFixed(2)}%`,
      `近 1 年 ${pct(fund.ret.y1)}｜近 3 年 ${pct(fund.ret.y3)}｜最大回撤 ${fund.drawdown.toFixed(1)}%`,
      `定位：${fund.role}`,
      ``,
      `二、适配客户`,
      ...sales.fit.map(item => `· ${item.who}：${item.why}`),
      `不适用：${sales.avoid}`,
      ``,
      `三、营销亮点`,
      ...sales.highlights.map((item, index) => `${index + 1}. ${item}`),
      ``,
      `四、沟通话术`,
      `【开场】${sales.script.open}`,
      `【价值】${sales.script.value}`,
      `【风险】${sales.script.risk}`,
      `【促成】${sales.script.close}`,
      ``,
      `合规提示：本页为 AI 演示草稿，历史业绩不代表未来表现，投资有风险，选择需谨慎。对外使用须经合规校验，禁止承诺收益或删改风险提示语。`
    ];
    return lines.join("\n");
  }

  /* ============================ 判定口径 ============================ */
  function pointsHTML() {
    return `${window.FundThinkTank ? "" : ""}
      <section class="drawer-section"><div class="drawer-section-title"><h3>四层证据判定框架</h3><span>权重递减</span></div>
        <div class="layer-strip"><span><b>合同与风格库</b>硬约束</span>${icon("arrow-right")}<span><b>持仓暴露度</b>实际投向</span>${icon("arrow-right")}<span><b>净值联动</b>防伪概念</span>${icon("arrow-right")}<span><b>名称与基准</b>辅助加分</span></div>
        <p style="margin-top:9px;color:var(--ink-600);font-size:10px;line-height:1.75">避免仅凭基金名称或单季持仓误判；名称与基准不得单独作为强依据，防止挂名蹭概念。</p>
      </section>
      <section class="drawer-section"><div class="drawer-section-title"><h3>行业板块判定</h3><span>申万 2021 版</span></div>
        <ol class="rule-list">
          <li><strong>合同强约束型：</strong>合同约定 80% 以上非现金资产投向某行业，且风格库主要覆盖该行业，直接认定为行业基金。</li>
          <li><strong>持仓验证型：</strong>对应板块持仓占比 ≥80% 为行业基金，60%—80% 为行业特征，30%—60% 为行业倾向，低于 30% 不展示。</li>
          <li><strong>指数基金：</strong>以跟踪指数成分股行业分布为准；某板块权重 ≥80% 直接认定，宽基指数不打行业标签。</li>
        </ol>
      </section>
      <section class="drawer-section"><div class="drawer-section-title"><h3>主题概念判定</h3><span>四步</span></div>
        <ol class="rule-list">
          <li>建立主题词库与成分股映射，由产品管理部联合数据供应商维护。</li>
          <li>计算主题持仓覆盖率：≥80% 主题基金，≥60% 主题特征，≥30% 主题倾向，低于 30% 不展示。</li>
          <li>净值联动校验：与主题指数相关性持续偏低时降低标签等级。</li>
          <li>名称与基准仅作加分项，持仓和净值均不匹配时不得仅凭名称打标。</li>
        </ol>
      </section>
      <section class="drawer-section"><div class="drawer-section-title"><h3>标签分级展示规则</h3><span>前端差异化</span></div>
        <table class="points-table"><thead><tr><th>标签等级</th><th>判定条件</th><th>展示方式</th></tr></thead><tbody>
          <tr><td>主题（行业）基金</td><td>合同约定 80% 以上，或覆盖率 ≥80%</td><td>高亮主标签</td></tr>
          <tr><td>主题特征基金</td><td>覆盖率 ≥60%</td><td>普通标签</td></tr>
          <tr><td>主题倾向基金</td><td>覆盖率 ≥30%</td><td>弱标签</td></tr>
          <tr><td>不展示</td><td>覆盖率 &lt;30% 或净值明显不匹配</td><td>不展示概念标签</td></tr>
        </tbody></table>
      </section>
      <section class="drawer-section"><div class="drawer-section-title"><h3>更新与漂移监控</h3><span>可审计</span></div>
        <ol class="rule-list">
          <li>定期报告披露后 T+1 重算标签；主动权益基金每月做轻量校验。</li>
          <li>连续两个报告期覆盖率跌破 60%，或净值相关性显著下降，系统自动降级。</li>
          <li>沃德优选与重点持营/首发基金标签变更需产品管理部确认。</li>
          <li>每次变更保留版本号、触发原因、数据源与生效时间。</li>
        </ol>
      </section>
      <div class="risk-note">以上为演示口径。正式上线前需由投研、风控与合规共同确认阈值、数据源与审计要求。</div>`;
  }

  function aiDraft(prompt) {
    const matched = funds.find(fund => prompt.includes(fund.name));
    if (matched && salesData[matched.id]) {
      const sales = salesData[matched.id];
      return `${matched.name}沟通话术草稿（演示）：\n\n【开场】${sales.script.open}\n\n【价值说明】${sales.script.value}\n\n【风险应对】${sales.script.risk}\n\n【促成与后续】${sales.script.close}\n\n适当性提示：该产品风险等级 ${matched.risk}，建议适用 ${riskCustomerMap[matched.risk]}，推荐前须完成客户风险承受能力匹配复核。以上为 AI 演示草稿，请结合客户真实情况修改后使用，不构成投资建议。`;
    }
    const list = filtered().slice(0, 3);
    const names = list.map(fund => `${fund.name}（${fund.code}，${fund.sub}，${fund.risk}，近 1 年 ${pct(fund.ret.y1)}）`).join("；");
    const tagText = state.tags.size ? `已叠加特色标签：${[...state.tags].map(tag => tagMap[tag].short).join("、")}。` : "未叠加交行特色标签。";
    const conceptText = (state.industries.size || state.themes.size) ? `行业概念条件：${[...state.industries].map(id => industryMap[id].name).concat([...state.themes]).join("、")}。` : "";
    return `配基金 · 选基说明（演示）：\n\n当前筛选条件命中 ${filtered().length} 只基金。${tagText}${conceptText}\n\n可优先复核：${names || "暂无匹配产品"}。\n\n使用建议：先确认客户风险承受能力与资金期限，再解释产品策略、行业集中度和最大回撤；特色标签与行业概念只用于缩小范围，不等于购买建议。\n\n以上均为演示数据，须人工复核后使用，不构成投资建议。`;
  }

  /* ============================ 事件 ============================ */
  function toggleCategory(groupId) {
    const group = strategyGroups.find(entry => entry.id === groupId);
    const allOn = group.subs.every(sub => state.subs.has(sub));
    if (allOn) group.subs.forEach(sub => state.subs.delete(sub));
    else { group.subs.forEach(sub => state.subs.add(sub)); state.expanded.add(groupId); }
    if (!equityActive()) { state.industries.clear(); state.themes.clear(); }
    syncFilterUI(); renderResults();
  }

  function toggleSet(set, value) { if (set.has(value)) set.delete(value); else set.add(value); }

  function resetAll() {
    state.subs = new Set(["股票型", "偏股混合型", "平衡混合型", "指数型"]);
    state.tags.clear(); state.industries.clear(); state.themes.clear();
    state.risk.clear(); state.scales.clear(); state.ages.clear();
    state.perfPeriod = "y1"; state.perfMin = null; state.fee = null;
    state.company = ""; state.manager = ""; state.sort = "default";
    syncFilterUI(); renderResults();
    window.FundThinkTank && window.FundThinkTank.showToast("筛选条件已重置", "info");
  }

  function bindEvents() {
    document.addEventListener("click", event => {
      const target = event.target;
      const page = $("#fundPage");
      if (!page || page.hidden) return;

      const catToggle = target.closest("[data-cat-toggle]");
      if (catToggle) { toggleCategory(catToggle.dataset.catToggle); return; }
      const catExpand = target.closest("[data-cat-expand]");
      if (catExpand) {
        const id = catExpand.dataset.catExpand;
        if (state.expanded.has(id)) state.expanded.delete(id); else state.expanded.add(id);
        syncFilterUI(); return;
      }
      const sub = target.closest("[data-sub]");
      if (sub) { toggleSet(state.subs, sub.dataset.sub); if (!equityActive()) { state.industries.clear(); state.themes.clear(); } syncFilterUI(); renderResults(); return; }
      const tag = target.closest("[data-tag]");
      if (tag) { toggleSet(state.tags, tag.dataset.tag); syncFilterUI(); renderResults(); return; }
      const industry = target.closest("[data-industry]");
      if (industry) { toggleSet(state.industries, industry.dataset.industry); syncFilterUI(); renderResults(); return; }
      const theme = target.closest("[data-theme]");
      if (theme) { toggleSet(state.themes, theme.dataset.theme); syncFilterUI(); renderResults(); return; }
      const risk = target.closest("[data-risk]");
      if (risk) { toggleSet(state.risk, risk.dataset.risk); syncFilterUI(); renderResults(); return; }
      const scale = target.closest("[data-scale]");
      if (scale) { toggleSet(state.scales, scale.dataset.scale); syncFilterUI(); renderResults(); return; }
      const age = target.closest("[data-age]");
      if (age) { toggleSet(state.ages, age.dataset.age); syncFilterUI(); renderResults(); return; }
      const fee = target.closest("[data-fee]");
      if (fee) { state.fee = state.fee === fee.dataset.fee ? null : fee.dataset.fee; syncFilterUI(); renderResults(); return; }

      if (target.closest("#auxToggle")) {
        const body = $("#auxBody");
        body.classList.toggle("open");
        $("#auxToggle").classList.toggle("open");
        return;
      }
      if (target.closest("#filterReset")) { resetAll(); return; }
      if (target.closest("#chipsClear")) { resetAll(); return; }
      const remove = target.closest("[data-remove]");
      if (remove) {
        const [kind, value] = remove.dataset.remove.split(":");
        if (kind === "sub") state.subs.delete(value);
        if (kind === "tag") state.tags.delete(value);
        if (kind === "industry") state.industries.delete(value);
        if (kind === "theme") state.themes.delete(value);
        if (kind === "risk") state.risk.delete(value);
        if (kind === "scale") state.scales.delete(value);
        if (kind === "age") state.ages.delete(value);
        if (kind === "perf") { state.perfMin = null; }
        if (kind === "fee") state.fee = null;
        if (kind === "company") state.company = "";
        if (kind === "manager") state.manager = "";
        syncFilterUI(); renderResults(); return;
      }
      const view = target.closest("[data-view]");
      if (view) { state.view = view.dataset.view; renderResults(); return; }
      if (target.closest("[data-open-compare]")) { window.FundThinkTank && window.FundThinkTank.openDrawer("fundCompare", "compare"); return; }
      const compareBtn = target.closest("[data-compare-id]");
      if (compareBtn) { toggleCompare(compareBtn.dataset.compareId); return; }
      const compareRemove = target.closest("[data-compare-remove]");
      if (compareRemove) { toggleCompare(compareRemove.dataset.compareRemove); return; }
      if (target.closest("[data-compare-clear]")) { state.compare = []; renderResults(); return; }
      const watchBtn = target.closest("[data-watch-id]");
      if (watchBtn) {
        const id = watchBtn.dataset.watchId;
        const on = !state.watch.has(id);
        if (on) state.watch.add(id); else state.watch.delete(id);
        window.FundThinkTank && window.FundThinkTank.showToast(on ? "已加入自选（演示）" : "已移出自选", "info");
        renderResults(); return;
      }
      const poster = target.closest("[data-poster-id]");
      if (poster) { window.FundThinkTank && window.FundThinkTank.openDrawer("fundSales", poster.dataset.posterId); return; }
      const salesCopy = target.closest("[data-sales-copy]");
      if (salesCopy) { window.FundThinkTank && window.FundThinkTank.copyText(salesText(salesCopy.dataset.salesCopy), "一页纸文本已复制，请复核并经合规确认后使用"); return; }
      const fundAi = target.closest("[data-fund-ai]");
      if (fundAi) { const fund = fundMap[fundAi.dataset.fundAi]; window.FundThinkTank && window.FundThinkTank.openAi(`配基金：${fund.name}的客户沟通要点`); return; }
      if (target.closest("[data-compare-pdf]")) { window.FundThinkTank && window.FundThinkTank.showToast("演示版不生成真实 PDF，导出将自动嵌入免责声明与操作人信息", "info"); return; }
      if (target.closest("[data-compare-watch]")) {
        state.compare.forEach(id => state.watch.add(id));
        window.FundThinkTank && window.FundThinkTank.showToast("已全部加入自选（演示）", "info");
        return;
      }
      const amsItem = target.closest("[data-ams-code]");
      if (amsItem) { window.FundThinkTank && window.FundThinkTank.openDrawer("allMarketFund", amsItem.dataset.amsCode); return; }
    });

    document.addEventListener("input", event => {
      const page = $("#fundPage");
      if (!page || page.hidden) return;
      if (event.target.id === "companyInput") { state.company = event.target.value.trim(); renderResults(); }
      if (event.target.id === "managerInput") { state.manager = event.target.value.trim(); renderResults(); }
      if (event.target.id === "perfMin") {
        state.perfMin = event.target.value === "" ? null : Number(event.target.value);
        renderResults();
      }
      if (event.target.id === "allFundInput") { ensureAllMarket(); amsRenderResults(event.target.value); }
    });

    document.addEventListener("change", event => {
      const page = $("#fundPage");
      if (!page || page.hidden) return;
      if (event.target.id === "fundSort") { state.sort = event.target.value; renderResults(); }
      if (event.target.id === "perfPeriod") { state.perfPeriod = event.target.value; renderResults(); }
    });
  }

  function show() {
    $("#todayPage").hidden = true;
    const marketPage = $("#marketPage");
    if (marketPage) marketPage.hidden = true;
    const portfolioPage = $("#portfolioPage");
    if (portfolioPage) portfolioPage.hidden = true;
    const customerPage = $("#customerPage");
    if (customerPage) customerPage.hidden = true;
    const companionPage = $("#companionPage");
    if (companionPage) companionPage.hidden = true;
    $("#fundPage").hidden = false;
    $$(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.nav === "fund"));
    document.title = "配基金｜基金智库工作台";
    renderCompareTray();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function init() {
    renderFilterPanel();
    syncFilterUI();
    renderResults();
    bindEvents();
    const pointsBtn = $("#fundPointsBtn");
    if (pointsBtn) pointsBtn.addEventListener("click", () => window.FundThinkTank && window.FundThinkTank.openDrawer("fundPoints", "points"));
    const aiBtn = $("#fundAiBtn");
    if (aiBtn) aiBtn.addEventListener("click", () => window.FundThinkTank && window.FundThinkTank.openAi("配基金：当前筛选结果说明"));
  }

  const library = Object.fromEntries(funds.map(fund => [fund.id, {
    id: fund.id, name: fund.name, code: fund.code, company: fund.company, sub: fund.sub, risk: fund.risk,
    ret: fund.ret, scale: fund.scale, manager: fund.manager, managerYears: fund.managerYears,
    drawdown: fund.drawdown, volatility: fund.volatility, sharpe: fund.sharpe, spark: fund.spark,
    tags: fund.tags, industry: fund.industry, themes: fund.themes
  }]));

  init();
  window.FundPicker = { show, detailHTML, compareHTML, pointsHTML, salesHTML, aiDraft, reset: resetAll, library, amsDetailHTML };
})();
