(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const escapeHTML = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;

  /* ============================ 参数配置表（§13，演示版本 P1.3） ============================ */
  const PARAM_VERSION = "P1.3";
  const LAMBDA_COEF = { base: 3.0, risk: 0.8, age: 0.02, term: 0.3, liq: 2.0 };
  const BAND_MARGIN = 10;
  const MARKET_W = { val: 0.4, trend: 0.35, vol: 0.25 };
  const SIGNAL_TH = { over: 70, neutral: 55, watch: 45 };
  const ACTIVE_EQUITY_CAP = 15;
  const FUND_CAP = 0.6;
  const REBAL_DEV = 10, REBAL_SINGLE = 8, NOISE_PCT = 1;
  const RISK_FREE = 1.7;
  const MARKET_DATE = "2026-10-27";

  /* ============================ 资产、中枢与市场状态 ============================ */
  const ASSETS = [
    { id: "equity", name: "A 股权益", color: "#247cc1" },
    { id: "bond", name: "债券", color: "#5b8f6b" },
    { id: "cash", name: "货币", color: "#8a6bb5" },
    { id: "gold", name: "黄金", color: "#c0783a" }
  ];
  const ASSET_MAP = Object.fromEntries(ASSETS.map(a => [a.id, a]));

  const BANDS = [
    { key: "conservative", label: "保守型", max: 2.5, w: { equity: 10, bond: 60, cash: 25, gold: 5 } },
    { key: "stable", label: "稳健型", max: 3.5, w: { equity: 25, bond: 50, cash: 15, gold: 10 } },
    { key: "balanced", label: "平衡型", max: 4.5, w: { equity: 40, bond: 35, cash: 10, gold: 15 } },
    { key: "growth", label: "成长型", max: 5.5, w: { equity: 55, bond: 20, cash: 5, gold: 20 } },
    { key: "aggressive", label: "进取型", max: 99, w: { equity: 70, bond: 10, cash: 0, gold: 20 } }
  ];

  /* 市场输入（演示）：分位数、200 日均线比、年化波动率 */
  const MARKET_INPUT = {
    equity: { valDesc: "PE_TTM 处于近 10 年 18% 分位", valPct: 18, p200: 1.10, vol: 18, lastChange: "标配 → 超配（本月）" },
    bond: { valDesc: "10 年期国债收益率处于近 10 年 15% 分位", valPct: 15, yieldBasis: true, p200: 1.01, vol: 3.2, lastChange: "标配 → 观察（本月）" },
    cash: { valDesc: "资金利率处于近 3 年中位", valPct: 50, p200: 1.00, vol: 0.3, lastChange: "连续 4 个月标配" },
    gold: { valDesc: "金价处于近 10 年 96% 分位", valPct: 96, p200: 1.12, vol: 14, lastChange: "标配 → 低配（本月，降一档）" }
  };

  const TILT = { over: 8, neutral: 0, watch: -2, under: -8 };
  const SIGNAL_META = { over: { label: "超配", cls: "over" }, neutral: { label: "标配", cls: "neutral" }, watch: { label: "观察", cls: "watch" }, under: { label: "低配", cls: "under" } };

  /* 预期收益/波动（BL 融合后演示值）与相关系数 */
  const EXP = { equity: { mu: 10.5, vol: 22 }, bond: { mu: 3.2, vol: 3.5 }, cash: { mu: 1.8, vol: 0.5 }, gold: { mu: 4.5, vol: 15 } };
  const CORR = { "equity|bond": .15, "equity|cash": 0, "equity|gold": .10, "bond|cash": .10, "bond|gold": .20, "cash|gold": 0 };
  const corrOf = (a, b) => a === b ? 1 : (CORR[`${a}|${b}`] ?? CORR[`${b}|${a}`] ?? 0);
  const RISK_BOUNDS = { 1: { vol: 3, mdd: 4 }, 2: { vol: 6, mdd: 8 }, 3: { vol: 12, mdd: 15 }, 4: { vol: 20, mdd: 25 }, 5: { vol: 28, mdd: 35 } };
  const BENCH = { 1: 2.0, 2: 4.0, 3: 7.0, 4: 9.0, 5: 11.0 };

  /* ============================ 演示客户（FR-1.1/1.2） ============================ */
  const pfCustomers = [
    { id: "C001", name: "王雅琳", mask: "王*琳", risk: 3, age: 48, term: 24, liq: 0.15, aum: 864000, expDate: "2027-01-15", lastRebal: "2026-05-12", segment: "稳健理财客户", holdings: [{ fund: "F002", pct: 30, days: 900 }, { fund: "F007", pct: 15, days: 500 }, { fund: "F009", pct: 25, days: 1200 }, { fund: "F013", pct: 30, days: 5, recent: true }] },
    { id: "C002", name: "周志强", mask: "周*强", risk: 4, age: 40, term: 36, liq: 0.05, aum: 1280000, expDate: "2026-12-02", lastRebal: "2026-06-18", segment: "组合持仓客户", holdings: [{ fund: "F002", pct: 40, days: 700 }, { fund: "F006", pct: 20, days: 400 }, { fund: "F007", pct: 5, days: 300 }, { fund: "F015", pct: 5, days: 200 }, { fund: "F009", pct: 10, days: 800 }, { fund: "F013", pct: 20, days: 5, recent: true }] },
    { id: "C003", name: "李文娟", mask: "李*娟", risk: 2, age: 52, term: 12, liq: 0.20, aum: 526000, expDate: "2026-11-08", lastRebal: "2025-10-20", segment: "基金关注客户", holdings: [{ fund: "F009", pct: 60, days: 1500 }, { fund: "F013", pct: 40, days: 400 }] },
    { id: "C004", name: "陈国栋", mask: "陈*栋", risk: 4, age: 38, term: 60, liq: 0.05, aum: 2103000, expDate: "2027-03-21", lastRebal: "2026-07-05", segment: "长期配置客户", holdings: [{ fund: "F001", pct: 36, days: 1000 }, { fund: "F002", pct: 24, days: 600 }, { fund: "F015", pct: 20, days: 500 }, { fund: "F013", pct: 20, days: 90 }] },
    { id: "C005", name: "郑海涛", mask: "郑*涛", risk: 5, age: 32, term: 60, liq: 0.05, aum: 3200000, expDate: "2027-06-30", lastRebal: null, segment: "新签约客户", holdings: [] },
    { id: "C006", name: "吴敏", mask: "吴*", risk: 2, age: 47, term: 24, liq: 0.15, aum: 960000, expDate: "2025-08-20", lastRebal: null, segment: "测评过期客户", holdings: [] }
  ];
  const custMap = Object.fromEntries(pfCustomers.map(c => [c.id, c]));

  /* ============================ 优选基金池（§4.3，演示分数） ============================ */
  const POOL = {
    equity: [
      { id: "F007", score: 88, active: true, reasons: ["近 3 年同类排名前 15%（演示）", "与已选基金持仓重合度仅 0.31", "经理任职 10 年穿越牛熊"] },
      { id: "F001", score: 84, active: false, reasons: ["指数增强：跟踪沪深 300 力争超额", "沃德优选池产品", "风格透明、便于向客户解释"] },
      { id: "F002", score: 81, active: true, reasons: ["科技行业基金认定（暴露 82%）", "近 1 年收益 21.4%，同类前 10%", "高波动，仅作卫星配置"] },
      { id: "F005", score: 79, active: true, swap: true, reasons: ["制造行业基金认定（暴露 80%）", "叠加机器人主题特征", "回撤控制优于同类均值"] },
      { id: "F003", score: 76, active: true, swap: true, reasons: ["医药行业基金认定（暴露 86%）", "经理任职 7 年", "板块估值处于低位区间"] }
    ],
    bond: [
      { id: "F009", score: 86, reasons: ["纯债运作，回撤小", "夏普比率 1.24 同类领先", "沃德优选池产品"] },
      { id: "F010", score: 82, swap: true, reasons: ["二级债基攻守兼备", "重点持营产品", "近 1 年收益 5.6%"] },
      { id: "F011", score: 80, swap: true, reasons: ["短债波动极低", "流动性好，申赎灵活"] }
    ],
    cash: [
      { id: "F013", score: 90, reasons: ["现金管理工具", "规模大、申赎便利", "收益稳定"] }
    ],
    gold: [
      { id: "F015", score: 85, reasons: ["黄金与股债相关性低", "组合对冲工具", "近 3 年收益 38%（演示）"] }
    ]
  };
  const SWAP_POOL = { equity: ["F002", "F005", "F003"], bond: ["F010", "F011"] };
  const ASSET_OF = { F001: "equity", F002: "equity", F003: "equity", F004: "equity", F005: "equity", F006: "equity", F007: "equity", F008: "equity", F009: "bond", F010: "bond", F011: "bond", F012: "bond", F013: "cash", F014: "equity", F015: "gold", F016: "bond", F017: "gold" };

  /* ============================ 状态 ============================ */
  const state = { selected: null, scheme: null, adjusted: false, override: null, simMode: false, simProfile: null, savedVersion: null, swapStep: { equity: 0, bond: 0 }, adviceStatus: "draft", search: "" };

  /* ============================ 工具 ============================ */
  const fmtPct = (v, d = 1) => `${v > 0 ? "+" : ""}${v.toFixed(d)}%`;
  const fmtW = v => `${v.toFixed(1)}%`;
  const fmtMoney = v => `¥${v.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const pctText = v => `${(v * 100).toFixed(1)}%`;
  const hashStr = s => { let h = 0; for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0; return h >>> 0; };
  const mulberry32 = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  function calcLambda(p) {
    const agePenalty = Math.max(p.age - 40, 0);
    return LAMBDA_COEF.base + LAMBDA_COEF.risk * (p.risk - 1) - LAMBDA_COEF.age * agePenalty + LAMBDA_COEF.term * Math.log(p.term / 12 + 1) - LAMBDA_COEF.liq * p.liq;
  }
  const bandOf = lambda => BANDS.find(b => lambda < b.max) || BANDS[BANDS.length - 1];

  function marketState(override) {
    return ASSETS.map(asset => {
      const input = MARKET_INPUT[asset.id];
      const sVal = input.yieldBasis ? input.valPct : 100 - input.valPct;
      const sTrend = 100 / (1 + Math.exp(-20 * (input.p200 - 1)));
      const sVol = 100 * (1 - Math.min(input.vol / 25, 1));
      const m = MARKET_W.val * sVal + MARKET_W.trend * sTrend + MARKET_W.vol * sVol;
      let signal = m >= SIGNAL_TH.over ? "over" : m >= SIGNAL_TH.neutral ? "neutral" : m >= SIGNAL_TH.watch ? "watch" : "under";
      if (override && override[asset.id]) signal = override[asset.id];
      return { ...asset, sVal, sTrend, sVol, m, signal, valDesc: input.valDesc, trendDesc: `现价 / 200 日均线 ${input.p200.toFixed(2)}`, volDesc: `年化波动率 ${input.vol}%`, lastChange: input.lastChange };
    });
  }

  /* ============================ 权重求解（§4.1/4.4，启发式解） ============================ */
  function solveWeights(base, signals, cust) {
    const mins = {}, maxs = {}, w = {};
    ASSETS.forEach(a => {
      mins[a.id] = Math.max(0, base[a.id] - BAND_MARGIN);
      maxs[a.id] = Math.min(100, base[a.id] + BAND_MARGIN);
      w[a.id] = Math.min(maxs[a.id], Math.max(mins[a.id], base[a.id] + TILT[signals[a.id]]));
    });
    const liqMin = cust.liq * 100 + 5;
    mins.cash = Math.max(mins.cash, liqMin);
    w.cash = Math.max(w.cash, liqMin);
    const compliance = [];
    if (cust.risk === 1) { w.equity = 0; mins.equity = 0; maxs.equity = 0; compliance.push(`C1 客户不得配置权益类：A 股权益权重置 0（适当性硬约束）`); }
    if (cust.risk === 2 && w.equity > 20) { compliance.push(`C2 客户权益上限 20%：A 股权益 ${fmtW(w.equity)} → 20%`); w.equity = 20; maxs.equity = 20; }
    const notes = [`流动性附加约束：货币权重 ≥ 流动性需求 ${pctText(cust.liq)} + 5% = ${fmtW(liqMin)}`];
    for (let iter = 0; iter < 80; iter += 1) {
      const sum = ASSETS.reduce((s, a) => s + w[a.id], 0);
      if (Math.abs(sum - 100) < 0.01) break;
      const dir = sum < 100 ? 1 : -1;
      const movable = ASSETS.filter(a => dir > 0 ? w[a.id] < maxs[a.id] - 1e-9 : w[a.id] > mins[a.id] + 1e-9);
      if (!movable.length) break;
      const room = movable.reduce((s, a) => s + (dir > 0 ? maxs[a.id] - w[a.id] : w[a.id] - mins[a.id]), 0);
      const need = Math.min(Math.abs(sum - 100), room);
      movable.forEach(a => { const cap = dir > 0 ? maxs[a.id] - w[a.id] : w[a.id] - mins[a.id]; w[a.id] += dir * need * (cap / room); });
    }
    let residual = +(100 - ASSETS.reduce((s, a) => s + w[a.id], 0)).toFixed(6);
    const biggest = ASSETS.reduce((big, a) => (w[a.id] > w[big] ? a.id : big), "equity");
    w[biggest] = +(w[biggest] + residual).toFixed(4);
    ASSETS.forEach(a => { w[a.id] = Math.round(w[a.id] * 10) / 10; });
    residual = +(100 - ASSETS.reduce((s, a) => s + w[a.id], 0)).toFixed(6);
    if (Math.abs(residual) > 0.001) w[biggest] = +(w[biggest] + residual).toFixed(1);
    return { w, mins, maxs, liqMin, compliance, notes };
  }

  /* ============================ 基金分配（§4.4.3 softmax） ============================ */
  function normalizeWithCaps(items, capOf) {
    for (let iter = 0; iter < 80; iter += 1) {
      const sum = items.reduce((s, x) => s + x.w, 0);
      const over = items.filter(x => x.w > capOf(x) + 1e-9);
      const under = items.filter(x => x.w < capOf(x) - 1e-9);
      if (Math.abs(sum - 100) < 0.01 || !over.length || !under.length) break;
      let excess = 0;
      over.forEach(x => { excess += x.w - capOf(x); x.w = capOf(x); });
      const room = under.reduce((s, x) => s + capOf(x) - x.w, 0);
      if (room < 1e-9) break;
      under.forEach(x => { x.w += excess * ((capOf(x) - x.w) / room); });
    }
    return items;
  }

  function allocate(assetId, assetWeight, picks, cust) {
    if (assetWeight <= 0.05 || !picks.length) return { items: [], note: "" };
    const exps = picks.map(p => Math.exp(p.score / 10));
    const sum = exps.reduce((s, e) => s + e, 0);
    const items = picks.map((p, i) => ({ ...p, w: assetWeight * exps[i] / sum }));
    if (items.length > 1) {
      normalizeWithCaps(items, x => FUND_CAP * assetWeight);
      if (assetId === "equity") {
        normalizeWithCaps(items, x => x.active ? Math.min(FUND_CAP * assetWeight, ACTIVE_EQUITY_CAP) : FUND_CAP * assetWeight);
      }
    }
    /* 归一至资产权重并按 0.1 取整 */
    for (let iter = 0; iter < 80; iter += 1) {
      const s = items.reduce((acc, x) => acc + x.w, 0);
      if (Math.abs(s - assetWeight) < 0.005) break;
      const dir = s < assetWeight ? 1 : -1;
      const movable = items.filter(x => dir > 0 ? x.w < capOfItem(x) - 1e-9 : x.w > 0.05);
      if (!movable.length) break;
      const room = movable.reduce((acc, x) => acc + (dir > 0 ? capOfItem(x) - x.w : x.w), 0);
      const need = Math.min(Math.abs(s - assetWeight), room);
      movable.forEach(x => { const cap = dir > 0 ? capOfItem(x) - x.w : x.w; x.w += dir * need * (cap / room); });
    }
    function capOfItem(x) { return x.active ? Math.min(FUND_CAP * assetWeight, ACTIVE_EQUITY_CAP) : FUND_CAP * assetWeight; }
    items.forEach(x => { x.w = Math.round(x.w * 10) / 10; });
    const residual = +(assetWeight - items.reduce((s, x) => s + x.w, 0)).toFixed(6);
    if (items.length) items[0].w = +(items[0].w + residual).toFixed(1);
    const note = picks.length === 1 ? `优选池内${ASSET_MAP[assetId].name}达标基金仅 1 只，全额配置（演示口径）` : "";
    return { items, note };
  }

  /* ============================ 组合生成（§4 全链路） ============================ */
  function currentProfile() {
    const c = state.selected;
    if (!c) return null;
    return state.simProfile ? { ...c, ...state.simProfile, sim: true } : c;
  }

  function buildScheme() {
    const cust = currentProfile();
    if (!cust) return null;
    const lambda = calcLambda(cust);
    const band = bandOf(lambda);
    const market = marketState(state.adjusted ? state.override : null);
    const signals = Object.fromEntries(market.map(m => [m.id, m.signal]));
    const solved = solveWeights(band.w, signals, cust);
    const picks = {};
    ASSETS.forEach(a => {
      const pool = POOL[a.id];
      let chosen = pool.filter(p => !p.swap).slice(0, 3);
      if (a.id === "equity" && chosen.length < 3) chosen = pool.slice(0, 3);
      if (a.id === "bond") {
        const second = SWAP_POOL.bond[state.swapStep.bond % SWAP_POOL.bond.length];
        chosen = [pool[0], pool.find(p => p.id === second)];
      }
      if (a.id === "equity") {
        const satellite = SWAP_POOL.equity[state.swapStep.equity % SWAP_POOL.equity.length];
        chosen = [pool[0], pool[1], pool.find(p => p.id === satellite)];
      }
      picks[a.id] = chosen;
    });
    const funds = {};
    const poolNotes = [];
    ASSETS.forEach(a => {
      const res = allocate(a.id, solved.w[a.id], picks[a.id], cust);
      funds[a.id] = res.items;
      if (res.note) poolNotes.push(res.note);
    });
    /* 组合预期表现（演示协方差 + 蒙特卡洛） */
    const mu = ASSETS.reduce((s, a) => s + solved.w[a.id] / 100 * EXP[a.id].mu, 0);
    let variance = 0;
    ASSETS.forEach(a => ASSETS.forEach(b => { variance += (solved.w[a.id] / 100) * (solved.w[b.id] / 100) * EXP[a.id].vol / 100 * EXP[b.id].vol / 100 * corrOf(a.id, b.id); }));
    const vol = Math.sqrt(Math.max(variance, 0)) * 100;
    const sharpe = vol > 0 ? (mu - RISK_FREE) / vol : 0;
    const mdd = -(vol * 2.1);
    const rng = mulberry32(hashStr(`${cust.id}|${cust.risk}|${cust.age}|${cust.term}|${cust.liq.toFixed(2)}|${state.adjusted ? "adj" : "base"}|${state.swapStep.equity}|${state.swapStep.bond}`));
    const paths = [];
    for (let i = 0; i < 1000; i += 1) {
      let value = 1;
      for (let m2 = 0; m2 < 12; m2 += 1) {
        const u1 = Math.max(rng(), 1e-9), u2 = rng();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        value *= 1 + mu / 1200 + z * (vol / 100) / Math.sqrt(12);
      }
      paths.push((value - 1) * 100);
    }
    paths.sort((a, b) => a - b);
    const mc = { p10: paths[99], p50: paths[499], p90: paths[899] };
    return { cust, lambda, band, market, weights: solved.w, mins: solved.mins, maxs: solved.maxs, liqMin: solved.liqMin, compliance: solved.compliance, notes: solved.notes, funds, poolNotes, exp: { mu, vol, sharpe, mdd, mc } };
  }

  /* ============================ 持仓诊断（§5） ============================ */
  function portfolioRisk(holdings) {
    let variance = 0, mdd = 0, rp = 0;
    const total = holdings.reduce((s, h) => s + h.pct, 0) || 1;
    holdings.forEach(h => {
      const info = window.FundPicker.library[h.fund];
      if (!info) return;
      const wi = h.pct / total;
      rp += wi * info.ret.y1;
      mdd += wi * Math.abs(info.drawdown);
    });
    holdings.forEach(hi => holdings.forEach(hj => {
      const a = window.FundPicker.library[hi.fund], b = window.FundPicker.library[hj.fund];
      if (!a || !b) return;
      const wa = hi.pct / total, wb = hj.pct / total;
      const ca = ASSET_OF[hi.fund], cb = ASSET_OF[hj.fund];
      const rho = ca === "cash" || cb === "cash" ? 0 : ca === cb ? .8 : corrOf(ca, cb);
      variance += wa * wb * (a.volatility / 100) * (b.volatility / 100) * rho;
    }));
    return { vol: Math.sqrt(Math.max(variance, 0)) * 100, mdd: -mdd, rp };
  }

  function diagnose(cust, targetWeights) {
    if (!cust.holdings.length) return null;
    const actual = { equity: 0, bond: 0, cash: 0, gold: 0 };
    cust.holdings.forEach(h => { actual[ASSET_OF[h.fund]] += h.pct; });
    const devs = {};
    let devSum = 0;
    ASSETS.forEach(a => { devs[a.id] = actual[a.id] - targetWeights[a.id]; devSum += Math.abs(devs[a.id]); });
    const D = devSum;
    const risk = portfolioRisk(cust.holdings);
    const bounds = RISK_BOUNDS[cust.risk];
    const riskFlag = risk.vol > bounds.vol ? 1 : 0;
    const mddFlag = Math.abs(risk.mdd) > bounds.mdd ? 1 : 0;
    const returnFlag = (BENCH[cust.risk] - risk.rp) > 5 ? 1 : 0;
    const fundFlag = cust.holdings.some(h => h.fund === "F006") ? 1 : 0;
    const diag = 100 - 40 * Math.min(D / 15, 1) - 30 * riskFlag - 20 * fundFlag - 10 * returnFlag;
    const grade = diag >= 85 ? { label: "优", cls: "grade-excellent", color: "#1f7a52" } : diag >= 70 ? { label: "良", cls: "grade-good", color: "#2b7a92" } : diag >= 55 ? { label: "中", cls: "grade-mid", color: "#9a6a1d" } : { label: "差", cls: "grade-poor", color: "#a83d44" };
    /* 问题清单 */
    const problems = [];
    if (D > 15) problems.push({ sev: "high", title: "组合显著偏离目标配置", data: `总偏离度 D = ${D.toFixed(1)}%（阈值 15%）`, impact: "组合风险收益特征已明显偏离客户画像对应的应有配置，建议再平衡。" });
    else if (D > 5) problems.push({ sev: "mid", title: "组合轻度偏离目标配置", data: `总偏离度 D = ${D.toFixed(1)}%（阈值 5%）`, impact: "暂不强制调仓，建议纳入下次检视关注。" });
    else problems.push({ sev: "low", title: "资产结构合理", data: `总偏离度 D = ${D.toFixed(1)}%`, impact: "结构与客户画像匹配，维持现有配置即可。" });
    ASSETS.forEach(a => {
      if (Math.abs(devs[a.id]) >= 8 && D > 15) {
        problems.push({ sev: Math.abs(devs[a.id]) >= 15 ? "high" : "mid", title: `${a.name}${devs[a.id] > 0 ? "超配" : "低配"} ${Math.abs(devs[a.id]).toFixed(1)} 个百分点`, data: `实际 ${fmtW(actual[a.id])} vs 目标 ${fmtW(targetWeights[a.id])}`, impact: devs[a.id] > 0 ? "超出部分放大了与该资产相关的风险暴露。" : "低于目标意味着可能错失该资产的配置作用。" });
      }
    });
    if (riskFlag) problems.push({ sev: "high", title: "组合波动超出客户承受区间", data: `组合年化波动率 ${risk.vol.toFixed(1)}%，超出 C${cust.risk} 上限 ${bounds.vol}%`, impact: "在市场调整阶段，回撤体验可能明显超出客户预期，需优先处理。" });
    if (mddFlag) problems.push({ sev: "high", title: "组合最大回撤超出承受区间", data: `估算最大回撤 ${risk.mdd.toFixed(1)}%，超出 C${cust.risk} 上限 ${bounds.mdd}%`, impact: "历史上同等持仓在类似行情中的回撤已越过客户承受边界。" });
    if (fundFlag) problems.push({ sev: "high", title: "持仓基金优选资格弱化", data: "工银前沿医疗股票A：Score 近 6 月下降 24 分；基金经理变更预警", impact: "若连续两个报告期未改善，将被移出优选池，建议评估替换。" });
    if (returnFlag) problems.push({ sev: "mid", title: "收益待改善", data: `组合近 1 年收益 ${fmtPct(risk.rp)}，跑输同类基准（${BENCH[cust.risk]}%）超 5 个百分点`, impact: "需结合持仓结构分析收益来源，避免仅以短期业绩判断。" });
    return { actual, devs, D, risk, bounds, diag, grade, problems, riskFlag, mddFlag, fundFlag, returnFlag };
  }

  /* ============================ 再平衡（§6） ============================ */
  function rebalance(cust, scheme, diag) {
    if (!diag) return null;
    const V = cust.aum;
    const targetByFund = {};
    ASSETS.forEach(a => (scheme.funds[a.id] || []).forEach(item => { targetByFund[item.id] = (targetByFund[item.id] || 0) + item.w; }));
    const currentByFund = {};
    cust.holdings.forEach(h => { currentByFund[h.fund] = (currentByFund[h.fund] || 0) + h.pct; });
    const fundIds = [...new Set([...Object.keys(targetByFund), ...cust.holdings.map(h => h.fund)])];
    const rows = fundIds.map(id => {
      const info = window.FundPicker.library[id];
      const cur = (currentByFund[id] || 0) / 100 * V;
      const tgt = (targetByFund[id] || 0) / 100 * V;
      const delta = tgt - cur;
      const holding = cust.holdings.find(h => h.fund === id);
      const noise = Math.abs(delta) / V * 100 < NOISE_PCT;
      const selling = delta < 0;
      const recentSell = selling && holding && holding.days < 7;
      let trigger = delta > 0 ? "补足目标配置缺口" : "降至目标权重";
      if (id === "F006") trigger = "优选资格弱化 + 经理变更预警（基金触发）";
      else if (Math.abs(devOf(id, diag)) >= REBAL_SINGLE) trigger = "单资产偏离超阈值（偏离触发）";
      return { id, name: info ? info.name : id, cur, tgt, delta, noise, recentSell, feeTip: recentSell ? `持有 ${holding.days} 天，惩罚性赎回费 1.5% ≈ ${fmtMoney(Math.abs(delta) * 0.015)}` : "", holding };
    });
    /* 当前与调仓后的风险收益对比 */
    const post = portfolioRiskFromWeights(targetByFund);
    const improve = { volBefore: diag.risk.vol, volAfter: post.vol, sharpeBefore: (diag.risk.rp - RISK_FREE) / Math.max(diag.risk.vol, 0.1), sharpeAfter: (post.rp - RISK_FREE) / Math.max(post.vol, 0.1), mddBefore: diag.risk.mdd, mddAfter: post.mdd };
    /* 触发规则 */
    const monthsSince = cust.lastRebal ? Math.round((new Date("2026-10-28") - new Date(cust.lastRebal)) / (30 * 24 * 3600 * 1000)) : null;
    const triggers = [
      { key: "dev", label: `偏离触发：D=${diag.D.toFixed(1)}% 或单资产 |Dev|>${REBAL_SINGLE}%`, on: diag.D > REBAL_DEV || ASSETS.some(a => Math.abs(diag.devs[a.id]) > REBAL_SINGLE) },
      { key: "time", label: `时间触发：距上次再平衡 ${monthsSince ?? "—"} 个月（≥6）`, on: monthsSince !== null && monthsSince >= 6 },
      { key: "event", label: "事件触发：某资产信号切换两档", on: false },
      { key: "fund", label: "基金触发：持仓基金移出优选池 / 经理变更", on: diag.fundFlag === 1 }
    ];
    return { rows, triggers, triggered: triggers.some(t => t.on), improve };
  }

  function devOf(fundId, diag) {
    if (!diag) return 0;
    const asset = ASSET_OF[fundId];
    return diag.devs[asset] ?? 0;
  }

  function portfolioRiskFromWeights(byFund) {
    const holdings = Object.entries(byFund).map(([fund, pct]) => ({ fund, pct }));
    return portfolioRisk(holdings);
  }

  /* ============================ 渲染 ============================ */
  function renderSteps(stage) {
    const steps = [["1", "选择客户"], ["2", "生成组合"], ["3", "持仓诊断"], ["4", "再平衡建议"]];
    const cls = i => i + 1 < stage ? "done" : i + 1 === stage ? "active" : "";
    $("#pfSteps").innerHTML = steps.map(([n, label], i) => `${i ? `<span class="pf-step-arrow"></span>` : ""}<span class="pf-step ${cls(i)}"><i>${i + 1 < stage ? icon("check") : n}</i>${label}</span>`).join("");
  }

  function renderCustomers() {
    const kw = state.search.trim().toLowerCase();
    const list = pfCustomers.filter(c => !kw || c.name.toLowerCase().includes(kw) || c.mask.includes(state.search.trim()) || c.id.toLowerCase().includes(kw));
    const grid = $("#pfCustomerGrid");
    if (!list.length) { grid.innerHTML = `<div class="pf-empty" style="grid-column:1/-1;min-height:120px">${icon("search")}<strong>未找到匹配客户</strong><p>支持姓名、客户号搜索；演示客户共 6 位。</p></div>`; return; }
    grid.innerHTML = list.map(c => {
      const expired = new Date(c.expDate) < new Date("2026-10-28");
      return `<button class="pf-cust-card ${state.selected && state.selected.id === c.id ? "selected" : ""}" data-pf-cust="${c.id}">
        <span class="pf-cust-name"><strong>${c.mask}</strong>${c.sim ? `<span class="pf-cust-flag sim">模拟</span>` : expired ? `<span class="pf-cust-flag warn">测评过期</span>` : `<span class="risk-c c${c.risk}">C${c.risk}</span>`}</span>
        <span class="pf-cust-meta"><span>${(c.aum / 10000).toFixed(1)} 万</span><span>${c.segment}</span></span>
        <span class="pf-cust-id">${c.id} · 测评至 ${c.expDate}</span>
      </button>`;
    }).join("");
  }

  function renderProfile() {
    const body = $("#pfProfileBody");
    const c = state.selected;
    if (!c) { $("#pfProfileSection").hidden = true; return; }
    $("#pfProfileSection").hidden = false;
    const profile = currentProfile();
    const lambda = calcLambda(profile);
    const band = bandOf(lambda);
    const expired = new Date(c.expDate) < new Date("2026-10-28");
    const holdingsValue = c.holdings.reduce((s, h) => s + h.pct, 0) / 100 * c.aum;
    body.innerHTML = `
      ${state.simMode ? `<div class="pf-banner sim">${icon("info")}<span><b>模拟客户模式（FR-1.4）：</b>画像参数由客户经理手动输入，用于面谈演练；<b>模拟方案不得导出或对客户展示</b>。当前画像：C${profile.risk} · ${profile.age} 岁 · 期限 ${profile.term} 个月 · 流动性 ${pctText(profile.liq)}</span></div>` : ""}
      <div class="pf-profile">
        <div class="pf-profile-top">
          <div class="pf-profile-id">
            <div class="pf-avatar">${c.mask[0]}</div>
            <div><strong>${c.mask}</strong><small>${c.id} · ${c.segment} · 风险测评有效期至 ${c.expDate}</small>${!state.simMode ? `<button class="text-btn" data-pf-open-customer="${c.id}">${icon("user")}查看客户详情</button>` : ""}</div>
          </div>
          <div class="pf-lambda"><div><b>${lambda.toFixed(2)}</b><small>λ 风险效用</small></div><span class="pf-type">${band.label}</span><small style="align-self:center">按 §4.1.1 公式实时计算</small></div>
        </div>
        <div class="pf-profile-grid">
          <div class="pf-profile-cell"><span>金融资产规模（AUM）</span><strong>${(c.aum / 10000).toFixed(1)} 万元</strong><small>行内 CRM · T+1</small></div>
          <div class="pf-profile-cell"><span>投资期限</span><strong>${profile.term} 个月</strong><small>${profile.term >= 36 ? "长期" : profile.term >= 12 ? "中期" : "短期"}</small></div>
          <div class="pf-profile-cell"><span>流动性需求</span><strong>${pctText(profile.liq)}</strong><small>6 个月内可能动用比例</small></div>
          <div class="pf-profile-cell"><span>现有持仓市值</span><strong>${c.holdings.length ? `${(holdingsValue / 10000).toFixed(1)} 万元` : "无持仓"}</strong><small>${c.holdings.length ? `${c.holdings.length} 只基金` : "将以建议方案为起点"}</small></div>
        </div>
        ${expired ? `<div class="pf-blocked">${icon("alert")}<span><b>风险测评已过期（FR-1.3）：</b>该客户测评于 ${c.expDate} 到期，系统已拦截方案生成。请先引导客户完成风险测评，再使用本功能。</span></div>` : ""}
        <div class="pf-profile-actions">
          <button class="btn btn-primary" id="pfGenerateBtn" ${expired ? "disabled" : ""}>${icon("sparkles")}生成组合</button>
          <button class="btn btn-secondary" id="pfOpenSimBtn">${icon("sliders")}模拟调整画像</button>
          ${c.holdings.length ? `<button class="btn btn-secondary" data-pf-jump-diag>${icon("search")}仅查看诊断</button>` : ""}
          <span class="pf-note">生成过程约需 3 秒内返回（演示为即时计算）</span>
        </div>
      </div>`;
  }

  function donutSVG(weights) {
    const r = 70, c = 2 * Math.PI * r;
    let offset = 0;
    const segs = ASSETS.filter(a => weights[a.id] > 0).map(a => {
      const len = weights[a.id] / 100 * c;
      const seg = `<circle cx="90" cy="90" r="${r}" fill="none" stroke="${a.color}" stroke-width="26" stroke-dasharray="${(len - 1.5).toFixed(2)} ${(c - len + 1.5).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 90 90)"><title>${a.name} ${fmtW(weights[a.id])}</title></circle>`;
      offset += len;
      return seg;
    }).join("");
    return `<svg viewBox="0 0 180 180" role="img" aria-label="大类资产权重环形图">${segs}</svg>`;
  }

  function sparkSVG(spark) {
    const w = 96, h = 30;
    const min = Math.min(...spark), max = Math.max(...spark), span = Math.max(max - min, 0.01);
    const pts = spark.map((v, i) => `${(i / (spark.length - 1) * (w - 4) + 2).toFixed(1)},${(h - 4 - (v - min) / span * (h - 8) + 2).toFixed(1)}`).join(" ");
    const up = spark[spark.length - 1] >= 0;
    return `<svg class="pf-spark" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="${up ? "#c05a56" : "#188a68"}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function renderScheme() {
    const section = $("#pfSchemeSection"), body = $("#pfSchemeBody");
    if (!state.scheme) { section.hidden = true; return; }
    section.hidden = false;
    const s = state.scheme;
    const cust = s.cust;
    const version = state.savedVersion ? `<span>方案版本 <b>${state.savedVersion}</b></span>` : "";
    const dis = state.simMode ? "disabled" : "";
    const simTitle = state.simMode ? ` title="模拟方案不得导出"` : "";
    const actions = `
      <button class="btn btn-secondary btn-small" id="pfRegenBtn">${icon("refresh")}换一批</button>
      <button class="btn btn-secondary btn-small" id="pfCompareBtn">${icon("compare")}方案对比</button>
      <button class="btn btn-secondary btn-small" id="pfBasisBtn">${icon("sliders")}查看计算依据</button>
      <button class="btn btn-secondary btn-small" id="pfSaveBtn" ${dis}${simTitle}>${icon("check")}保存方案</button>
      <button class="btn btn-secondary btn-small" id="pfPdfBtn" ${dis}${simTitle}>${icon("download")}导出 PDF</button>
      ${state.adjusted ? `<button class="btn btn-secondary btn-small" id="pfUndoAdjustBtn">${icon("arrow-left")}恢复原方案</button>` : `<button class="btn btn-secondary btn-small" id="pfAdjustBtn">${icon("sliders")}模拟主管微调</button>`}`;
    const fundRows = ASSETS.map(a => {
      const items = s.funds[a.id] || [];
      if (!items.length || s.weights[a.id] <= 0) return "";
      return `<div class="pf-asset-block">
        <div class="pf-asset-head"><i style="background:${a.color}"></i><strong>${a.name}</strong><span class="sig-badge ${SIGNAL_META[s.market.find(m => m.id === a.id).signal].cls}">${SIGNAL_META[s.market.find(m => m.id === a.id).signal].label}</span><span class="pf-asset-w">${fmtW(s.weights[a.id])}</span></div>
        <div class="pf-fund-rows">${items.map(item => {
          const info = window.FundPicker.library[item.id];
          return `<div class="pf-fund-row">
            <button class="pf-fund-name" data-open-type="screenerFund" data-open-id="${item.id}"><strong>${escapeHTML(info.name)}</strong><small>${info.code} · ${info.sub} · 评分 ${item.score}</small></button>
            <span class="pf-fund-w">${fmtW(item.w)}</span>
            ${sparkSVG(info.spark)}
            <span class="pf-reasons">${item.reasons.slice(0, 3).map(r => `<span class="reason-tag">${escapeHTML(r)}</span>`).join("")}<span class="reason-tag score">Score ${item.score}</span></span>
            <button class="pf-swap-btn" data-pf-swap="${a.id}" title="换一批同类备选">${icon("refresh")}</button>
          </div>`;
        }).join("")}</div>
      </div>`;
    }).join("");
    const marketCells = s.market.map(m => `
      <div class="pf-market-cell">
        <span><i style="width:8px;height:8px;border-radius:2px;background:${m.color};display:inline-block"></i>${m.name}<span class="sig-badge ${SIGNAL_META[m.signal].cls}" style="margin-left:4px">${SIGNAL_META[m.signal].label}</span><span class="pf-m-score">M ${m.m.toFixed(1)}</span></span>
        <div class="pf-market-bar"><i style="width:${m.m}%"></i></div>
        <div class="pf-market-meta"><span>${m.valDesc}</span><span>${m.trendDesc}</span><span>${m.volDesc}</span></div>
      </div>`).join("");
    body.innerHTML = `
      ${state.adjusted ? `<div class="pf-banner warn" style="margin:14px 14px 0">${icon("alert")}<span><b>本方案经人工微调：</b>A 股权益信号强制降一档（超配 → 标配），规则“A股单日跌幅>5% → 权益信号降一档，幅度上限 ±10%”。A 股权重 ${state.prevWeights ? fmtW(state.prevWeights.equity) : "—"} → ${fmtW(s.weights.equity)}，微调已留痕并可回放。</span><button class="text-btn" data-pf-adjust-log>查看调整内容</button></div>` : ""}
      <div class="pf-scheme-toolbar">
        <div class="pf-scheme-meta"><span>客户 <b>${cust.mask}</b></span><span>λ = <b>${s.lambda.toFixed(2)}</b> · ${s.band.label}</span><span>参数版本 <b>${PARAM_VERSION}</b></span><span>市场数据 <b>${MARKET_DATE}</b></span>${version}</div>
        <div class="pf-scheme-actions">${actions}</div>
      </div>
      <div class="pf-scheme-grid">
        <div class="pf-scheme-left">
          <div class="pf-donut-wrap">
            <div class="pf-donut">${donutSVG(s.weights)}<div class="pf-donut-center"><strong>${s.band.label}</strong><span>C${cust.risk} · λ ${s.lambda.toFixed(2)}</span><b>${state.adjusted ? "已微调" : "参考方案"}</b></div></div>
            <div class="pf-legend">${ASSETS.map(a => `<div class="pf-legend-row"><i style="background:${a.color}"></i><span class="pf-leg-name">${a.name}<span class="sig-badge ${SIGNAL_META[s.market.find(m => m.id === a.id).signal].cls}">${SIGNAL_META[s.market.find(m => m.id === a.id).signal].label}</span></span><span class="pf-leg-w">${fmtW(s.weights[a.id])}</span></div>`).join("")}</div>
          </div>
          <div class="pf-exp-grid">
            <div class="pf-exp-cell"><span>预期年化收益</span><strong>${fmtPct(s.exp.mu)}</strong><small>BL 融合估计</small></div>
            <div class="pf-exp-cell"><span>预期年化波动</span><strong>${s.exp.vol.toFixed(1)}%</strong><small>Ledoit-Wolf 收缩估计</small></div>
            <div class="pf-exp-cell"><span>夏普比率（估计）</span><strong>${s.exp.sharpe.toFixed(2)}</strong><small>无风险利率 ${RISK_FREE}%</small></div>
          </div>
          <div class="pf-mc-range">
            <div class="pf-mc-row"><span>悲观 10%</span><div class="pf-mc-track"><div class="pf-mc-fill" style="left:${Math.max(0, Math.min(100, 50 + s.exp.mc.p10))}%;right:${Math.max(0, Math.min(100, 50 - s.exp.mc.p10))}%"></div></div><b>${fmtPct(s.exp.mc.p10)}</b></div>
            <div class="pf-mc-row"><span>中位 50%</span><div class="pf-mc-track"><div class="pf-mc-fill" style="left:${Math.max(0, Math.min(100, 50 + s.exp.mc.p50 / 2))}%;right:${Math.max(0, Math.min(100, 50 - s.exp.mc.p50 / 2))}%"></div></div><b>${fmtPct(s.exp.mc.p50)}</b></div>
            <div class="pf-mc-row"><span>乐观 90%</span><div class="pf-mc-track"><div class="pf-mc-fill" style="left:${Math.max(0, Math.min(100, 50 + s.exp.mc.p90 / 2))}%;right:${Math.max(0, Math.min(100, 50 - s.exp.mc.p90 / 2))}%"></div></div><b>${fmtPct(s.exp.mc.p90)}</b></div>
            <div class="pf-mc-note">蒙特卡洛 1000 条路径（12 个月，月度正态模拟）· 演示口径，不代表收益承诺</div>
          </div>
          ${s.compliance.length ? `<div class="pf-pool-note">${icon("shield")}<span>${s.compliance.join("；")}。</span></div>` : ""}
          ${s.poolNotes.length ? `<div class="pf-pool-note">${icon("info")}<span>${s.poolNotes.join("；")}。</span></div>` : ""}
        </div>
        <div class="pf-scheme-right"><div class="pf-fund-list">${fundRows || `<div class="pf-empty">${icon("info")}<strong>当前无权益类配置</strong><p>适当性硬约束生效，全部资金配置于固收与现金类资产。</p></div>`}</div></div>
      </div>
      <div class="pf-market-panel">${marketCells}</div>
      <div class="pf-market-foot"><span>市场状态每月首个交易日批量重算；重大事件触发临时重算</span><span>数据截至 ${MARKET_DATE}（最近可用交易日）</span></div>`;
    renderSteps(state.selected?.holdings?.length ? (state.diag ? 4 : 3) : 2);
  }

  function structRows(diag, weights) {
    return ASSETS.map(a => {
      const actual = diag.actual[a.id], target = weights[a.id];
      return `<div class="pf-struct-row"><span>${a.name}</span><div class="pf-struct-bars">
        <div class="pf-struct-track"><i class="target" style="width:${Math.min(100, target)}%;background:${a.color}"></i></div>
        <div class="pf-struct-track"><i style="width:${Math.min(100, actual)}%;background:${a.color}"></i></div>
      </div><b>${fmtW(actual)}</b></div>`;
    }).join("");
  }

  function renderDiagnosis() {
    const section = $("#pfDiagSection"), body = $("#pfDiagBody");
    const cust = state.selected;
    if (!cust || !state.scheme) { section.hidden = true; return; }
    section.hidden = false;
    if (!cust.holdings.length) {
      body.innerHTML = `<div class="pf-rebal-off">${icon("info")}<span><b>该客户暂无持仓（FR-3.4）：</b>跳过诊断，直接以左侧配置参考方案为起点开展沟通。方案确认后可转为客户的基准组合。</span></div>`;
      renderSteps(3);
      return;
    }
    const diag = state.diag, reb = state.rebalance;
    const facts = [
      { label: "组合年化波动率", value: `${diag.risk.vol.toFixed(1)}%`, cls: diag.riskFlag ? "bad" : "ok", note: `C${cust.risk} 上限 ${diag.bounds.vol}%` },
      { label: "估算最大回撤", value: `${diag.risk.mdd.toFixed(1)}%`, cls: diag.mddFlag ? "bad" : "ok", note: `C${cust.risk} 上限 ${diag.bounds.mdd}%` },
      { label: "近 1 年组合收益", value: fmtPct(diag.risk.rp), cls: diag.returnFlag ? "bad" : "ok", note: `同类基准 ${BENCH[cust.risk]}%` },
      { label: "总偏离度 D", value: `${diag.D.toFixed(1)}%`, cls: diag.D > 15 ? "bad" : "ok", note: diag.D > 15 ? "显著偏离" : diag.D > 5 ? "轻度偏离" : "结构合理" }
    ];
    body.innerHTML = `
      <div class="pf-diag-top">
        <div class="pf-ring-wrap"><div class="pf-ring">
          <svg viewBox="0 0 160 160"><circle cx="80" cy="80" r="64" fill="none" stroke="#eef3f8" stroke-width="14"/><circle cx="80" cy="80" r="64" fill="none" stroke="${diag.grade.color}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${(diag.diag / 100 * 2 * Math.PI * 64).toFixed(1)} ${(2 * Math.PI * 64).toFixed(1)}" transform="rotate(-90 80 80)"/></svg>
          <div class="pf-ring-center"><strong>${Math.round(diag.diag)}</strong><b class="${diag.grade.cls}">${diag.grade.label}</b><small>诊断总评分（0–100）</small></div>
        </div></div>
        <div class="pf-problem-list">${diag.problems.map(p => `<div class="pf-problem"><span class="sev"><span class="sev-badge ${p.sev}">${p.sev === "high" ? "严重" : p.sev === "mid" ? "关注" : "良好"}</span></span><div><strong>${escapeHTML(p.title)}</strong><span class="pf-prob-data">${icon("info")}${escapeHTML(p.data)}</span><p>${escapeHTML(p.impact)}</p></div></div>`).join("")}</div>
      </div>
      <div class="pf-diag-facts">${facts.map(f => `<div class="pf-diag-cell"><span>${f.label}</span><strong class="${f.cls}">${f.value}</strong><small style="color:var(--ink-500);font-size:8px">${f.note}</small></div>`).join("")}</div>
      <div class="pf-struct">
        <div class="pf-struct-legend" style="padding:0 16px 8px"><span><i style="background:#9db0c2"></i>目标权重（虚线参照）</span><span><i style="background:var(--brand-500)"></i>实际权重</span></div>
        ${structRows(diag, state.scheme.weights)}
      </div>
      ${reb ? `
      <div class="pf-rebal-head">
        <div class="pf-trigger-chips">${reb.triggers.map(t => `<span class="trigger-chip ${t.on ? "on" : ""}">${t.on ? "● " : "○ "}${escapeHTML(t.label)}</span>`).join("")}</div>
        ${reb.triggered ? `<button class="btn btn-secondary btn-small" id="pfScriptBtn">${icon("message")}一键生成沟通话术</button>` : ""}
      </div>
      ${reb.triggered ? `
      <div class="pf-table-wrap"><table class="pf-table">
        <thead><tr><th>基金</th><th class="num">当前市值</th><th class="num">目标市值</th><th class="num">调仓金额</th><th>方向 / 触发原因</th></tr></thead>
        <tbody>${reb.rows.map(r => `<tr class="${r.noise ? "skip" : ""}">
          <td>${escapeHTML(r.name)}<small style="display:block;color:var(--ink-500);font-size:8px">${window.FundPicker.library[r.id]?.code || ""}</small></td>
          <td class="num">${fmtMoney(r.cur)}</td><td class="num">${fmtMoney(r.tgt)}</td>
          <td class="num ${r.noise ? "skip" : r.delta > 0 ? "buy" : "sell"}">${r.delta > 0 ? "+" : ""}${fmtMoney(r.delta)}${r.recentSell ? `<span class="fee-tip">${escapeHTML(r.feeTip)} → 降级为“观察”</span>` : ""}</td>
          <td>${r.noise ? `<span class="skip">已忽略（低于 ${NOISE_PCT}% 噪音阈值）</span>` : r.delta > 0 ? "买入" : "卖出"} · <span style="color:var(--ink-500)">${escapeHTML(r.trigger || "")}</span></td>
        </tr>`).join("")}</tbody>
      </table></div>
      <div class="pf-improve">
        <span>调仓后预期改善：波动率 <b>${diag.risk.vol.toFixed(1)}% → ${reb.improve.volAfter.toFixed(1)}%</b></span>
        <span>夏普 <b>${reb.improve.sharpeBefore.toFixed(2)} → ${reb.improve.sharpeAfter.toFixed(2)}</b></span>
        <span>估算回撤 <b>${diag.risk.mdd.toFixed(1)}% → ${reb.improve.mddAfter.toFixed(1)}%</b></span>
        <span style="margin-left:auto">交易摩擦控制：噪音过滤 ${NOISE_PCT}% · 赎回费率惩罚提示已标注</span>
      </div>
      <div class="pf-rebal-actions">
        <button class="btn btn-secondary btn-small" id="pfPdfBtn2">${icon("download")}导出诊断报告 PDF</button>
        <span class="pf-status">建议单状态：<span class="status-flow">${[["draft", "草稿"], ["contacted", "已沟通"], ["confirmed", "客户确认"], ["rejected", "客户拒绝"]].map(([k, label]) => `<button class="${state.adviceStatus === k ? "on" : ""}" data-pf-status="${k}">${label}</button>`).join("")}</span></span>
      </div>` : `<div class="pf-rebal-off">${icon("info")}<span><b>未触发再平衡条件</b>：当前总偏离 D = ${diag.D.toFixed(1)}%，未超过 10% 阈值，且无单资产偏离超 8%、无基金预警。建议下次定期检视时复核。</span></div>`}` : ""}
      <div class="pf-market-foot" style="margin-top:0"><span>诊断基于持仓权重与基金净值序列计算（演示）</span><span>客户敏感信息已脱敏 · 全链路留痕 ≥ 5 年</span></div>`;
  }

  /* ============================ 计算依据抽屉（FR-2.4） ============================ */
  function basisHTML() {
    const s = state.scheme;
    if (!s) return `<div class="empty-state"><strong>尚未生成方案</strong><p>请先选择客户并生成组合。</p></div>`;
    const cust = s.cust;
    const tiltRows = s.market.map(m => `<tr><td>${m.name}</td><td>${m.sVal.toFixed(0)} / ${m.sTrend.toFixed(0)} / ${m.sVol.toFixed(0)}</td><td>${m.m.toFixed(1)}</td><td>${SIGNAL_META[m.signal].label}（倾斜 ${TILT[m.signal] >= 0 ? "+" : ""}${TILT[m.signal]}pp）</td></tr>`).join("");
    const weightRows = ASSETS.map(a => `<tr><td>${a.name}</td><td>${fmtW(s.band.w[a.id])}</td><td>${fmtW(s.mins[a.id])} ~ ${fmtW(s.maxs[a.id])}</td><td>${fmtW(s.weights[a.id])}</td></tr>`).join("");
    const fundRows = ASSETS.map(a => (s.funds[a.id] || []).map(item => {
      const peers = (s.funds[a.id] || []).filter(x => x.id !== item.id);
      return `<tr><td>${window.FundPicker.library[item.id].name}</td><td>${item.score}</td><td>${fmtW(item.w)}</td><td>${item.reasons[0]}</td></tr>`;
    }).join("")).join("");
    return `
      <section class="drawer-section"><div class="drawer-section-title"><h3>一 · 客户画像与 λ（§4.1）</h3><span>参数版本 ${PARAM_VERSION}</span></div>
        <div class="pf-basis-formula">λ = ${LAMBDA_COEF.base} + ${LAMBDA_COEF.risk}×(${cust.risk}−1) − ${LAMBDA_COEF.age}×max(${cust.age}−40, 0) + ${LAMBDA_COEF.term}×ln(${cust.term}/12+1) − ${LAMBDA_COEF.liq}×${cust.liq.toFixed(2)} = <b>${s.lambda.toFixed(2)}</b> → ${s.band.label}</div>
        <table class="pf-basis-table"><thead><tr><th>资产</th><td>中枢权重</td><td>允许区间（±${BAND_MARGIN}%）</td><td>目标权重</td></tr></thead><tbody>${weightRows}</tbody></table>
        <div class="pf-basis-cols"><div class="pf-basis-col"><span>约束校验</span><p>${[...s.notes, ...s.compliance.length ? s.compliance : ["适当性硬约束：通过"]].map(t => `· ${escapeHTML(t)}`).join("<br>")}</p></div></div>
      </section>
      <section class="drawer-section"><div class="drawer-section-title"><h3>二 · 市场状态评分（§4.2）</h3><span>M = 0.4·估值 + 0.35·趋势 + 0.25·波动</span></div>
        <table class="pf-basis-table"><thead><tr><th>资产</th><td>S估值 / S趋势 / S波动</td><td>综合分 M</td><td>信号</td></tr></thead><tbody>${tiltRows}</tbody></table>
        <div class="pf-basis-cols"><div class="pf-basis-col"><span>信号档位（阈值 70 / 55 / 45）</span><p>≥70 超配 · 55–70 标配 · 45–55 观察（中枢 −2%）· &lt;45 低配。市场状态每月首个交易日批量重算，重大事件触发临时重算。</p></div></div>
      </section>
      <section class="drawer-section"><div class="drawer-section-title"><h3>三 · 优选池与基金分配（§4.3/4.4.3）</h3><span>softmax 温度缩放</span></div>
        <div class="pf-basis-formula">w(i,j) = w_i × e^(Score_j/10) / Σ_k e^(Score_k/10)；单只 ≤ 60%×资产权重；单只主动权益 ≤ 全组合 ${ACTIVE_EQUITY_CAP}%</div>
        <table class="pf-basis-table"><thead><tr><th>基金</th><td>五因子 Score</td><td>建议权重</td><td>入选理由（第一条）</td></tr></thead><tbody>${fundRows}</tbody></table>
      </section>
      <section class="drawer-section"><div class="drawer-section-title"><h3>四 · 预期表现估计（§15）</h3><span>演示参数</span></div>
        <div class="pf-basis-cols"><div class="pf-basis-col"><span>μ / Σ 快照</span><p>μ（BL 融合，δ=3，τ=0.05）：A股 ${EXP.equity.mu}% · 债券 ${EXP.bond.mu}% · 货币 ${EXP.cash.mu}% · 黄金 ${EXP.gold.mu}%；波动率：22% / 3.5% / 0.5% / 15%；相关系数：股-债 0.15 · 股-金 0.10 · 债-金 0.20。组合预期收益 ${fmtPct(s.exp.mu)}，波动 ${s.exp.vol.toFixed(1)}%，夏普 ${s.exp.sharpe.toFixed(2)}。</p></div><div class="pf-basis-col"><span>蒙特卡洛模拟</span><p>1000 条路径 × 12 个月，正态月度收益；1 年累计收益 P10 ${fmtPct(s.exp.mc.p10)} / P50 ${fmtPct(s.exp.mc.p50)} / P90 ${fmtPct(s.exp.mc.p90)}。相同输入（画像哈希 + 参数版本 + 市场日期）命中缓存直接返回，保证可复现。</p></div></div>
      </section>
      <div class="risk-note">本方案为配置参考，不构成投资建议。所有参数以参数表配置化维护，微调须双人复核并留痕。</div>`;
  }

  /* ============================ 方案对比（FR-2.6） ============================ */
  function compareHTML() {
    const cust = currentProfile();
    if (!cust) return `<div class="empty-state"><strong>尚未选择客户</strong></div>`;
    const variants = [];
    const mk = (label, risk) => {
      const profile = { ...cust, risk };
      const lambda = calcLambda(profile);
      const band = bandOf(lambda);
      const market = marketState(null);
      const signals = Object.fromEntries(market.map(m => [m.id, m.signal]));
      const solved = solveWeights(band.w, signals, profile);
      const mu = ASSETS.reduce((s, a) => s + solved.w[a.id] / 100 * EXP[a.id].mu, 0);
      let variance = 0;
      ASSETS.forEach(a => ASSETS.forEach(b => { variance += (solved.w[a.id] / 100) * (solved.w[b.id] / 100) * EXP[a.id].vol / 100 * EXP[b.id].vol / 100 * corrOf(a.id, b.id); }));
      const vol = Math.sqrt(Math.max(variance, 0)) * 100;
      return { label, lambda, weights: solved.w, mu, vol, sharpe: vol > 0 ? (mu - RISK_FREE) / vol : 0, mdd: -(vol * 2.1), current: risk === cust.risk };
    };
    variants.push(mk(`当前方案（C${cust.risk}）`, cust.risk));
    if (cust.risk > 1) variants.push(mk(`降一档（C${cust.risk - 1}）`, cust.risk - 1));
    if (cust.risk < 5) variants.push(mk(`升一档（C${cust.risk + 1}）`, cust.risk + 1));
    const head = variants.map(v => `<th${v.current ? ' style="color:var(--brand-600)"' : ""}>${escapeHTML(v.label)}</th>`).join("");
    const row = (name, fn) => `<tr><td>${name}</td>${variants.map(v => `<td>${fn(v)}</td>`).join("")}</tr>`;
    return `
      <div class="source-line">${icon("info")}最多 3 个方案并列展示（FR-2.6）· 同一市场快照与参数版本 · 权重为信号倾斜后的启发式解</div>
      <table class="cmp-table" style="margin-top:12px"><thead><tr><th>项目</th>${head}</tr></thead><tbody>
        ${row("λ 值", v => v.lambda.toFixed(2))}
        ${ASSETS.map(a => row(`${a.name} 权重`, v => fmtW(v.weights[a.id]))).join("")}
        ${row("预期年化收益", v => fmtPct(v.mu))}
        ${row("预期年化波动", v => `${v.vol.toFixed(1)}%`)}
        ${row("夏普比率（估计）", v => v.sharpe.toFixed(2))}
        ${row("最大回撤（估计）", v => `${v.mdd.toFixed(1)}%`)}
      </tbody></table>
      <div class="risk-note" style="margin-top:14px">对比基于同一客户画像调整风险档位后重新求解；升档方案仍需通过适当性校验（C2 权益上限 20% 等硬约束独立生效）。</div>`;
  }

  /* ============================ AI 话术（FR-4.3） ============================ */
  function aiDraft(prompt) {
    const diag = state.diag, s = state.scheme;
    if (!diag || !s) return "请先选择客户并生成组合，再生成诊断相关话术。";
    const c = s.cust;
    const problems = diag.problems.filter(p => p.sev !== "low").slice(0, 3);
    const lines = problems.length ? problems.map((p, i) => `${i + 1}. ${p.title}（${p.data}）`) : ["组合结构与风险水平总体匹配客户画像，暂无明显问题。"];
    const reb = state.rebalance && state.rebalance.triggered ? state.rebalance.rows.filter(r => !r.noise) : [];
    const trades = reb.length ? reb.map(r => `${r.delta > 0 ? "买入" : "卖出"} ${r.name} 约 ${fmtMoney(Math.abs(r.delta))}`).join("；") : "本次无需调仓";
    return `建组合 · 客户沟通话术草稿（${c.mask}，演示）：\n\n开场：“结合您 C${c.risk} 的风险测评和${c.term}个月的资金期限，我重新为您做了一次组合体检，把结果和您同步一下。”\n\n体检结论：\n${lines.join("\n")}\n\n建议动作：${trades}。调仓后组合波动率预计由 ${diag.risk.vol.toFixed(1)}% 降至 ${state.rebalance.improve.volAfter.toFixed(1)}%。\n\n风险提示：“历史业绩不代表未来表现，以上为配置参考而非投资建议；每一步调整我都会先和您确认后再执行。”\n\n注：本话术由系统基于诊断问题清单模板化生成，可编辑；使用前须人工复核并完成适当性确认。`;
  }

  /* ============================ 事件 ============================ */
  function bindEvents() {
    document.addEventListener("click", event => {
      const page = $("#portfolioPage");
      if (!page || page.hidden) return;
      const custBtn = event.target.closest("[data-pf-cust]");
      if (custBtn) {
        state.selected = custMap[custBtn.dataset.pfCust];
        state.scheme = null; state.diag = null; state.rebalance = null; state.adjusted = false; state.override = null; state.savedVersion = null; state.adviceStatus = "draft";
        state.simMode = false; state.simProfile = null;
        renderCustomers(); renderProfile(); renderScheme(); renderDiagnosis(); renderSteps(1);
        $("#pfProfileSection").scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (event.target.closest("#pfGenerateBtn") || event.target.closest("[data-pf-jump-diag]")) {
        state.swapStep = { equity: 0, bond: 0 };
        regenerate();
        $("#pfSchemeSection").scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (event.target.closest("#pfOpenSimBtn")) { openSim(); return; }
      if (event.target.closest("[data-pf-open-customer]")) { window.FundThinkTank && window.FundThinkTank.openDrawer("customer", event.target.closest("[data-pf-open-customer]").dataset.pfOpenCustomer); return; }
      if (event.target.closest("#pfRegenBtn")) { state.swapStep.equity = (state.swapStep.equity || 0) + 1; state.swapStep.bond = (state.swapStep.bond || 0) + 1; regenerate(); window.FundThinkTank && window.FundThinkTank.showToast("已按备选池 Top 20 更换风格相近的备选基金（FR-2.5）", "info"); return; }
      if (event.target.closest("#pfBasisBtn")) { window.FundThinkTank && window.FundThinkTank.openDrawer("schemeBasis", "basis"); return; }
      if (event.target.closest("#pfCompareBtn")) { window.FundThinkTank && window.FundThinkTank.openDrawer("schemeCompare", "compare"); return; }
      if (event.target.closest("#pfSaveBtn")) { state.savedVersion = `V2026.10.28-00${Math.floor(Math.random() * 9) + 1}`; renderScheme(); window.FundThinkTank && window.FundThinkTank.showToast(`方案已保存：${state.savedVersion}（参数版本 ${PARAM_VERSION} · 市场数据 ${MARKET_DATE} 已快照留痕）`); return; }
      if (event.target.closest("#pfPdfBtn") || event.target.closest("#pfPdfBtn2")) { window.FundThinkTank && window.FundThinkTank.showToast("演示版不生成 PDF；正式导出将含免责页脚、数据日期与生成人工号（FR-2.3/3.3）", "info"); return; }
      if (event.target.closest("#pfAdjustBtn")) {
        state.prevWeights = state.scheme ? { ...state.scheme.weights } : null;
        state.adjusted = true; state.override = { equity: "neutral" }; regenerate();
        window.FundThinkTank && window.FundThinkTank.showToast("已应用微调规则：A 股权益信号超配 → 标配（UC-02 演示）", "info"); return;
      }
      if (event.target.closest("#pfUndoAdjustBtn")) { state.adjusted = false; state.override = null; regenerate(); window.FundThinkTank && window.FundThinkTank.showToast("已恢复模型原始方案", "info"); return; }
      if (event.target.closest("[data-pf-adjust-log]")) { window.FundThinkTank && window.FundThinkTank.openDrawer("schemeBasis", "basis"); return; }
      if (event.target.closest("#pfScriptBtn")) { window.FundThinkTank && window.FundThinkTank.openAi("建组合：生成客户沟通话术"); return; }
      const statusBtn = event.target.closest("[data-pf-status]");
      if (statusBtn) { state.adviceStatus = statusBtn.dataset.pfStatus; renderDiagnosis(); window.FundThinkTank && window.FundThinkTank.showToast(`建议单状态已更新为「${{ draft: "草稿", contacted: "已沟通", confirmed: "客户确认", rejected: "客户拒绝" }[state.adviceStatus]}」，操作已留痕`, "info"); return; }
      const swapBtn = event.target.closest("[data-pf-swap]");
      if (swapBtn) {
        const asset = swapBtn.dataset.pfSwap;
        state.swapStep[asset] = (state.swapStep[asset] || 0) + 1;
        regenerate();
        window.FundThinkTank && window.FundThinkTank.showToast("已从备选池更换风格互补的备选基金（同一经理不超过 1 只）", "info");
        return;
      }
    });

    document.addEventListener("input", event => {
      const page = $("#portfolioPage");
      if (!page || page.hidden) return;
      if (event.target.id === "pfSearchInput") { state.search = event.target.value; renderCustomers(); }
      if (event.target.id === "pfSimRisk") { syncSimUI(); }
      if (["pfSimAge", "pfSimTerm", "pfSimLiq"].includes(event.target.id)) syncSimUI();
    });
  }

  function regenerate() {
    state.scheme = buildScheme();
    state.diag = diagnose(state.scheme.cust, state.scheme.weights);
    state.rebalance = rebalance(state.scheme.cust, state.scheme, state.diag);
    renderScheme();
    renderDiagnosis();
  }

  /* ============================ 模拟画像弹窗（FR-1.4） ============================ */
  function openSim() {
    const c = state.selected;
    if (!c) return;
    const base = state.simProfile || { risk: c.risk, age: c.age, term: c.term, liq: c.liq };
    $("#pfSimRisk").value = base.risk;
    $("#pfSimAge").value = base.age;
    $("#pfSimTerm").value = base.term;
    $("#pfSimLiq").value = Math.round(base.liq * 100);
    syncSimUI();
    $("#pfSimModal").hidden = false;
  }

  function syncSimUI() {
    const risk = Number($("#pfSimRisk").value), age = Number($("#pfSimAge").value), term = Number($("#pfSimTerm").value), liq = Number($("#pfSimLiq").value) / 100;
    $("#pfSimAgeVal").textContent = `${age} 岁`;
    $("#pfSimTermVal").textContent = `${term} 个月`;
    $("#pfSimLiqVal").textContent = `${liq * 100}%`;
    const lambda = calcLambda({ risk, age, term, liq });
    $("#pfSimLambda").textContent = lambda.toFixed(2);
    $("#pfSimType").textContent = bandOf(lambda).label;
  }

  function applySim() {
    const risk = Number($("#pfSimRisk").value), age = Number($("#pfSimAge").value), term = Number($("#pfSimTerm").value), liq = Number($("#pfSimLiq").value) / 100;
    state.simMode = true;
    state.simProfile = { risk, age, term, liq };
    state.adjusted = false; state.override = null; state.savedVersion = null;
    regenerate();
    renderProfile();
    $("#pfSimModal").hidden = true;
    window.FundThinkTank && window.FundThinkTank.showToast("已切换为模拟画像并重新生成方案（不得导出或对客户展示）", "info");
    $("#pfSchemeSection").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ============================ 页面 ============================ */
  function show() {
    $("#todayPage").hidden = true;
    const marketPage = $("#marketPage"); if (marketPage) marketPage.hidden = true;
    const fundPage = $("#fundPage"); if (fundPage) fundPage.hidden = true;
    const customerPage = $("#customerPage"); if (customerPage) customerPage.hidden = true;
    const companionPage = $("#companionPage"); if (companionPage) companionPage.hidden = true;
    const tray = $("#compareTray"); if (tray) tray.hidden = true;
    $("#portfolioPage").hidden = false;
    $$(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.nav === "portfolio"));
    document.title = "建组合｜基金智库工作台";
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function init() {
    renderSteps(1);
    renderCustomers();
    bindEvents();
    const ruleBtn = $("#pfRuleBtn");
    if (ruleBtn) ruleBtn.addEventListener("click", () => window.FundThinkTank && window.FundThinkTank.openDrawer("schemeBasis", "basis"));
    const simOk = $("#pfSimApply");
    if (simOk) simOk.addEventListener("click", applySim);
    const simCancel = $("#pfSimCancel");
    if (simCancel) simCancel.addEventListener("click", () => { $("#pfSimModal").hidden = true; });
    const simClose = $("#pfSimClose");
    if (simClose) simClose.addEventListener("click", () => { $("#pfSimModal").hidden = true; });
    const simEntry = $("#pfSimEntryBtn");
    if (simEntry) simEntry.addEventListener("click", () => { if (state.selected) openSim(); else window.FundThinkTank && window.FundThinkTank.showToast("请先选择客户，再进行模拟画像演练", "info"); });
    const simOverlay = $("#pfSimModal");
    if (simOverlay) simOverlay.addEventListener("click", event => { if (event.target === simOverlay) simOverlay.hidden = true; });
  }

  init();
  window.PortfolioBuilder = { show, basisHTML, compareHTML, aiDraft };
})();
