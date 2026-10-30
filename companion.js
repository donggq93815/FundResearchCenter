(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const escapeHTML = value => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;

  /* ============================ 参数（演示初始值） ============================ */
  const PARAM_VER = "HOLD-P1.0";
  const DATA_DATE = "2026-10-28";
  const OWNER = "陈明远 · 上海徐汇支行";
  const MKT_TEMP = 56; // 看市场综合温度（演示）
  /* 优先级分 = 0.40×严重度 + 0.30×客户价值 + 0.20×客户等级 + 0.10×时效性 */
  const PRI_W = { sev: 0.40, val: 0.30, level: 0.20, time: 0.10 };
  const bandOf = score => score >= 80 ? "P0" : score >= 60 ? "P1" : "P2";
  const laneOf = pri => pri === "P0" ? "今日必访" : pri === "P1" ? "本周跟进" : "维护池";

  const RISK_NOTE = "风险提示：基金有风险，投资须谨慎。历史业绩不代表未来表现，本材料为展业辅助草稿，不构成收益承诺或投资建议。请根据自身风险承受能力审慎决策。";
  const RISK_NOTE_ELDER = RISK_NOTE + "（适老版提示：如您不方便线上操作，可到网点由客户经理当面协助；可邀请家属共同了解，但不要求家属代办。）";
  const BANNED = ["保本", "保证收益", "稳赚", "必涨", "零风险", "无风险", "翻倍", "一定涨", "绝对安全", "只赚不赔"];
  const PU_NOTE = "以下为基于历史净值的假设性回测，不构成收益预测或投资建议；历史业绩不代表未来表现。";

  const money = v => `¥${v.toFixed(2)} 万`;
  const pct = (v, d = 1) => `${v >= 0 ? "+" : ""}${v.toFixed(d)}%`;
  const fundOf = fid => (window.FundPicker && window.FundPicker.library && window.FundPicker.library()[fid]) || { id: fid, name: fid };

  /* ============================ 14 条事件规则 H-01~H-14 ============================ */
  const RULES = [
    { id: "H-01", name: "单日大跌（股票/混合 ≤ −3%）", cat: "净值", sev: 80, action: "安抚任务" },
    { id: "H-02", name: "单日急跌 ≤ −5%", cat: "净值", sev: 95, action: "安抚 + 经理必访" },
    { id: "H-03", name: "股票型距 1 年高点回撤 ≥15%", cat: "净值", sev: 80, action: "复盘任务" },
    { id: "H-04", name: "距 1 年低点反弹 ≥10% 且仍亏损", cat: "净值", sev: 55, action: "沟通窗口" },
    { id: "H-05", name: "基金经理变更", cat: "公告", sev: 75, action: "评估/审视任务" },
    { id: "H-06", name: "规模降幅 >50% 或 <0.5 亿", cat: "公告", sev: 75, action: "风险提示" },
    { id: "H-07", name: "外部评级下调", cat: "公告", sev: 60, action: "关注任务" },
    { id: "H-08", name: "限购/大额限购", cat: "公告", sev: 55, action: "告知任务" },
    { id: "H-09", name: "收益 ≥20% 且估值分位 >80%", cat: "止盈", sev: 75, action: "止盈沟通" },
    { id: "H-10", name: "亏损 ≤−15% 且持有 <180 天", cat: "亏损", sev: 80, action: "安抚 + 诊断" },
    { id: "H-11", name: "30 天申赎 ≥3 次", cat: "行为", sev: 55, action: "行为干预" },
    { id: "H-12", name: "买入 <7 天赎回", cat: "行为", sev: 55, action: "投教提示" },
    { id: "H-13", name: "定投连续缺扣 ≥2 期", cat: "定投", sev: 60, action: "断供唤醒" },
    { id: "H-14", name: "温度进入过热/冰点", cat: "市场", sev: 55, action: "批量复检（默认仅私银/沃德且权益>50%）" }
  ];

  /* ============================ 演示客户（持仓 + 单基金归因 + 单基金交易流水） ============================ */
  /* 平行宇宙/归因/获得感均以【单只基金】为分析对象；attri 与 trades 挂在每只 holding 下 */
  const CUSTOMERS = [
    {
      id: "C001", name: "王雅琳", cid: "6222****4821", age: 42, risk: 4, level: "A", value: 90, elderly: false,
      seg: "沃德客户", fundMV: 148.2, pnl: 12.86, pnlDay: 0.42, daysAvg: 196,
      holdings: [
        { fid: "F002", name: "交银红利低波指数 A", mv: 86.4, pnl: 9.6, days: 210, bench: "沪深300", benchR: 6.2, fundR: 11.1,
          attri: { alpha: 3.4, beta: 6.2, gamma: -2.0, fee: -0.2, total: 7.4, seg: { timing: -1.4, stop: 0, sip: 0, cost: -0.2 } },
          trades: [
            { d: "2026-01-12", type: "申购", amt: 40, note: "低位建仓", gain: 6.2, risk: -0.6, disc: "低位补仓" },
            { d: "2026-08-15", type: "赎回", amt: 18, note: "浮亏中赎回", gain: -1.5, risk: -0.2, disc: "低位卖出（杀跌）" }
          ] },
        { fid: "F001", name: "交银稳健成长混合 A", mv: 61.8, pnl: 5.2, days: 182, bench: "沪深300", benchR: 6.2, fundR: 8.9,
          attri: { alpha: 2.7, beta: 6.2, gamma: -3.7, fee: -0.1, total: 5.1, seg: { timing: -3.2, stop: 0, sip: 0, cost: -0.1 } },
          trades: [
            { d: "2026-05-20", type: "申购", amt: 35, note: "阶段高点追加", gain: -4.1, risk: 1.3, disc: "高位追加" }
          ] }
      ],
      events: ["H-09"], sipMiss: 0, touchWeek: 1
    },
    {
      id: "C002", name: "周志强", cid: "6217****9335", age: 48, risk: 5, level: "A", value: 85, elderly: false,
      seg: "私银客户", fundMV: 92.6, pnl: -17.02, pnlDay: -0.86, daysAvg: 235,
      holdings: [
        { fid: "F006", name: "交银智选科技混合", mv: 52.8, pnl: -18.4, days: 320, bench: "沪深300", benchR: 6.2, fundR: -12.2,
          attri: { alpha: -2.6, beta: 6.0, gamma: -3.2, fee: -0.3, total: -0.1, seg: { timing: -1.6, stop: -1.2, sip: 0, cost: -0.4 } },
          trades: [
            { d: "2026-02-03", type: "申购", amt: 60, note: "追涨科技主题", gain: -12.2, risk: 2.4, disc: "高位追加" },
            { d: "2026-06-30", type: "赎回", amt: 15, note: "亏损中恐慌赎回", gain: -2.1, risk: -0.3, disc: "低位卖出（杀跌）" }
          ] },
        { fid: "F003", name: "交银双利债券 A", mv: 39.8, pnl: -8.2, days: 150, bench: "中证全债", benchR: 3.1, fundR: -5.1,
          attri: { alpha: -1.8, beta: 2.9, gamma: -1.4, fee: -0.1, total: -0.4, seg: { timing: -0.8, stop: 0, sip: 0, cost: -0.1 } },
          trades: [
            { d: "2026-09-10", type: "申购", amt: 40, note: "资金切换", gain: -1.0, risk: -0.8, disc: "合理分批" }
          ] }
      ],
      events: ["H-02", "H-03", "H-10"], sipMiss: 0, touchWeek: 0
    },
    {
      id: "C006", name: "陈美玲", cid: "6228****5517", age: 52, risk: 2, level: "C", value: 55, elderly: false,
      seg: "代发工资客户", fundMV: 12.8, pnl: -0.32, pnlDay: -0.02, daysAvg: 380,
      holdings: [
        { fid: "F008", name: "交银二级债基", mv: 12.8, pnl: -0.32, days: 380, bench: "中证全债", benchR: 3.1, fundR: 2.8,
          attri: { alpha: 0.4, beta: 2.9, gamma: -0.6, fee: -0.1, total: 2.6, seg: { timing: 0, stop: 0, sip: -0.6, cost: -0.1 } },
          trades: [
            { d: "2026-01-05", type: "申购", amt: 12, note: "定投计划启动", gain: 0.4, risk: -0.2, disc: "定投执行" }
          ] }
      ],
      events: ["H-13"], sipMiss: 3, sipPlan: "F008 二级债基月定投 2000 元", touchWeek: 1
    },
    {
      id: "C004", name: "张建国", cid: "6213****7042", age: 68, risk: 2, level: "B", value: 60, elderly: true,
      seg: "老年客户", fundMV: 41.5, pnl: 1.86, pnlDay: 0.05, daysAvg: 330,
      holdings: [
        { fid: "F010", name: "交银纯债 A", mv: 30.2, pnl: 2.1, days: 460, bench: "中证全债", benchR: 3.1, fundR: 4.6,
          attri: { alpha: 0.9, beta: 3.0, gamma: 0.2, fee: 0, total: 4.1, seg: { timing: 0, stop: 0, sip: 0.2, cost: 0 } },
          trades: [
            { d: "2025-07-18", type: "申购", amt: 30, note: "稳健配置", gain: 2.1, risk: -0.4, disc: "长期持有" }
          ] },
        { fid: "F013", name: "交银货币 A", mv: 11.3, pnl: 0.4, days: 200, bench: "货基", benchR: 1.2, fundR: 1.4,
          attri: { alpha: 0.2, beta: 1.2, gamma: 0, fee: 0, total: 1.4, seg: { timing: 0, stop: 0, sip: 0, cost: 0 } },
          trades: [
            { d: "2026-03-02", type: "申购", amt: 11, note: "现金管理", gain: 0.4, risk: 0, disc: "长期持有" }
          ] }
      ],
      events: ["H-08"], sipMiss: 0, touchWeek: 0
    },
    {
      id: "C008", name: "赵子轩", cid: "6229****8126", age: 30, risk: 4, level: "C", value: 70, elderly: false,
      seg: "研究型客户", fundMV: 16.8, pnl: 3.02, pnlDay: 0.21, daysAvg: 240,
      holdings: [
        { fid: "F002", name: "交银红利低波指数 A", mv: 12.6, pnl: 16.2, days: 240, bench: "沪深300", benchR: 6.2, fundR: 13.4,
          attri: { alpha: 3.1, beta: 5.9, gamma: -1.8, fee: -0.2, total: 7.0, seg: { timing: -0.8, stop: 0, sip: 0, cost: -0.2 } },
          trades: [
            { d: "2026-02-10", type: "申购", amt: 8, note: "首次建仓", gain: 5.2, risk: -0.5, disc: "长期持有" },
            { d: "2026-07-20", type: "申购", amt: 6, note: "浮盈后追加", gain: -0.8, risk: 0.6, disc: "高位追加" },
            { d: "2026-10-15", type: "赎回", amt: 2, note: "买入 12 天赎回", gain: -1.1, risk: -0.1, disc: "短期频繁（<7 天赎回费 1.5%）" }
          ] }
      ],
      events: ["H-09", "H-11", "H-12"], sipMiss: 0, touchWeek: 2
    }
  ];

  const customerOf = id => CUSTOMERS.find(c => c.id === id);
  const holdingOf = (custId, fid) => { const c = customerOf(custId); return c && c.holdings.find(h => h.fid === fid); };

  /* ============================ 事件任务（由规则引擎生成，FR-HOLD-03） ============================ */
  const TASKS = [
    { id: "T-H-01", cust: "C002", rule: "H-02", theme: "F006 单日急跌 −5.2%，安抚 + 经理必访", pri: "P0", lane: "today", due: "2026-10-28", status: "待处理", next: "当日电话安抚（豁免事由：单日急跌）", source: "陪持有 · 异动监控", log: [{ t: "2026-10-28 08:35", s: "待处理", by: "系统", note: "H-02 命中" }] },
    { id: "T-H-02", cust: "C002", rule: "H-10", theme: "F006 亏损 −18.4% 且持有 320 天，安抚 + 诊断", pri: "P0", lane: "today", due: "2026-10-28", status: "已触达", next: "发送持仓诊断复盘材料", source: "陪持有 · 亏损安抚", log: [{ t: "2026-10-28 09:00", s: "待处理", by: "系统", note: "H-10 命中" }, { t: "2026-10-28 10:20", s: "已触达", by: "陈明远", note: "电话沟通 12 分钟（本周触达 1/2）" }] },
    { id: "T-H-03", cust: "C001", rule: "H-09", theme: "F002 浮盈 9.6% 且估值分位 84%，止盈沟通", pri: "P1", lane: "week", due: "2026-10-30", status: "待处理", next: "准备双向沟通要点（继续持有 / 部分止盈）", source: "陪持有 · 止盈建议", log: [{ t: "2026-10-28 08:40", s: "待处理", by: "系统", note: "H-09 命中" }] },
    { id: "T-H-04", cust: "C006", rule: "H-13", theme: "定投连续缺扣 3 期，断供唤醒", pri: "P1", lane: "week", due: "2026-10-30", status: "待处理", next: "了解断供原因（资金/意愿）", source: "陪持有 · 定投监控", log: [{ t: "2026-10-28 08:45", s: "待处理", by: "系统", note: "H-13 命中" }] },
    { id: "T-H-05", cust: "C008", rule: "H-11", theme: "30 天申赎 3 次，行为干预 + 投教", pri: "P2", lane: "pool", due: "2026-11-05", status: "待处理", next: "经理侧提示（中性表述，不贴标签）", source: "陪持有 · 行为识别", log: [{ t: "2026-10-28 08:50", s: "待处理", by: "系统", note: "H-11 命中" }] },
    { id: "T-H-06", cust: "C004", rule: "H-08", theme: "F010 限购，适老版告知", pri: "P2", lane: "pool", due: "2026-11-05", status: "待处理", next: "电话告知（适老版，营销 ≤1 次/周）", source: "陪持有 · 公告告知", log: [{ t: "2026-10-28 08:55", s: "待处理", by: "系统", note: "H-08 命中" }] }
  ];

  const touchCount = custId => TASKS.filter(t => t.cust === custId && t.log.some(l => l.s === "已触达")).length;

  /* ============================ 状态机（复用找客户 FR-CLT-04） ============================ */
  const NEXT_STATE = { "待处理": ["已触达", "已关闭"], "已触达": ["已沟通", "已关闭"], "已沟通": ["已完成", "已关闭"], "已完成": [], "已关闭": [] };
  const REQUIRED = { "已触达": ["channel", "time"], "已沟通": ["point", "feedback"], "已完成": ["result"], "已关闭": ["reason"] };

  /* ============================ 止盈三策略 / 亏损分档 ============================ */
  const TAKEPROFIT = {
    A: { name: "目标收益", rule: "股票 20% / 混合 15% / 指数 15% / 债券 5% 触发止盈沟通" },
    B: { name: "移动止盈", rule: "自最高浮盈回落 8pp 且最高浮盈曾 ≥5pp 触发" },
    C: { name: "估值止盈", rule: "估值分位 >85% 作为辅助确认（不单独触发）" }
  };
  const LOSS_TIERS = [
    { name: "观察", cond: "亏损 <5% 且持有 <90 天", action: "不生成任务，进入观察名单", sla: "—" },
    { name: "主动沟通", cond: "亏损 5%–15%，或 ≥5% 且持有 ≥90 天", action: "安抚任务 + 话术", sla: "3 个工作日" },
    { name: "深度安抚+复盘", cond: "亏损 ≥15%，或 ≥10% 且持有 ≥180 天", action: "安抚 + 持仓诊断复盘任务", sla: "24 小时（P0）" }
  ];

  /* ============================ 平行宇宙 U0-U5 ============================ */
  const UNIVERSE = [
    { key: "U0", name: "真实世界", short: "实际", desc: "客户真实交易序列", value: "对比基准" },
    { key: "U1", name: "买入并持有", short: "不操作", desc: "持有期内不做任何申赎", value: "衡量 γ 总量" },
    { key: "U2", name: "不做止盈", short: "不止盈", desc: "删除全部止盈类赎回", value: "检验止盈行为贡献" },
    { key: "U3", name: "不杀跌", short: "不杀跌", desc: "删除亏损状态下的赎回", value: "检验恐慌卖出影响" },
    { key: "U4", name: "按参考组合执行", short: "纪律化", desc: "按建组合目标权重再平衡", value: "检验纪律化配置价值" },
    { key: "U5", name: "纯定投 / 一次性买入", short: "定投", desc: "全部资金按定投或一次性投入", value: "检验投入方式差异" }
  ];

  /* 单只基金的 U0-U5 四项对比（区间收益/最大回撤/波动率/期末市值，演示）
     以该基金的 α/β/γ 归因为锚点生成，使不同宇宙的差异可解释。
     γ 为负 → 客户真实操作(U0)劣于买入持有(U1)，差值 ≈ −γ；反之亦然。 */
  function universeOf(h) {
    const base = h.attri.total;              // U0 真实收益（单基金）
    const gamma = h.attri.gamma;             // 客户行为净影响（单基金）
    const gapU1 = -gamma;                    // U1 买入并持有 相对 U0 的差
    const hasStopLoss = h.trades.some(t => t.disc.includes("杀跌") || (t.gain < -1 && t.type === "赎回"));
    const hasTakeProfit = h.trades.some(t => t.gain > 0 && t.type === "赎回");
    // 波动/回撤随基金类型浮动：权益类(基准沪深300)波动更大；亏损越深回撤越大
    const isEq = h.bench === "沪深300";
    const baseDD = -(isEq ? 12 : 5) - Math.max(0, -h.pnl) * 0.08;
    const baseVol = (isEq ? 13 : 6) + Math.max(0, -h.pnl) * 0.1;
    const round = (v, d = 1) => Number(v.toFixed(d));
    return {
      U0: { r: base, dd: round(baseDD), vol: round(baseVol), mv: h.mv, d: "真实交易序列" },
      U1: { r: base + gapU1, dd: round(baseDD * 0.8), vol: round(baseVol * 0.88), mv: h.mv * (1 + gapU1 / 100), d: "买入并持有（γ 反推）" },
      U2: { r: base + (hasTakeProfit ? -0.8 : 0.1), dd: round(baseDD * 0.95), vol: round(baseVol * 0.97), mv: h.mv * (1 + (hasTakeProfit ? -0.8 : 0.1) / 100), d: hasTakeProfit ? "删除止盈赎回后收益反降" : "无止盈交易，与 U0 基本一致" },
      U3: { r: base + (hasStopLoss ? 1.5 : 0.1), dd: round(baseDD * 0.85), vol: round(baseVol * 0.92), mv: h.mv * (1 + (hasStopLoss ? 1.5 : 0.1) / 100), d: hasStopLoss ? "不杀跌，避免低位恐慌卖出" : "无亏损赎回，与 U0 基本一致" },
      U4: { r: base + 0.5 + (isEq ? 0.4 : 0.2), dd: round(baseDD * 0.72), vol: round(baseVol * 0.78), mv: h.mv * (1 + (0.5 + (isEq ? 0.4 : 0.2)) / 100), d: "按目标权重再平衡，纪律化降波动" },
      U5: { r: base + 0.3, dd: round(baseDD * 0.88), vol: round(baseVol * 0.9), mv: h.mv * (1 + 0.3 / 100), d: "定投平滑投入，收益略高于一次性" }
    };
  }

  /* ============================ 获得感评分（FR-HOLD-11） ============================ */
  function gainScore(trade) {
    let ret; if (trade.gain > 0) ret = 60 + Math.min(40, trade.gain * 6); else if (trade.gain < 0) ret = Math.max(0, 40 + trade.gain * 6); else ret = 50;
    let vol = trade.risk < 0 ? 60 + Math.min(40, -trade.risk * 30) : 50 - Math.min(30, trade.risk * 12);
    const discScore = { "长期持有": 100, "定投执行": 100, "低位补仓": 85, "合理分批": 80, "高位追加": 40, "短期频繁（<7 天赎回费 1.5%）": 20, "低位卖出（杀跌）": 25 }[trade.disc] ?? 60;
    const total = 0.5 * ret + 0.3 * vol + 0.2 * discScore;
    return { ret: ret.toFixed(0), vol: vol.toFixed(0), disc: discScore, total: total.toFixed(0) };
  }

  /* ============================ 播报模板（FR-HOLD-02） ============================ */
  function buildBriefing(c, period) {
    const elder = c.elderly;
    const h = c.events.map(e => RULES.find(r => r.id === e).name).join("、") || "暂无命中事件";
    const head = period === "daily" ? "日报" : "周报";
    const body = `${period === "daily" ? "今日" : "本周"}：${c.name} 持仓基金 ${money(c.fundMV)}，累计盈亏 ${pct(c.pnl, 2)}（T+1）。市场综合温度 ${MKT_TEMP}（演示值），权益略暖、固收平稳，不作为择时依据。持仓提示：${h}。`;
    return { head, body, riskNote: elder ? RISK_NOTE_ELDER : RISK_NOTE, elder };
  }

  /* ============================ 话术库（FR-HOLD-08，8 类模板） ============================ */
  const SCRIPTS = [
    { key: "soothe", name: "下跌安抚" }, { key: "rise", name: "上涨解读" }, { key: "range", name: "震荡持有" },
    { key: "hold", name: "长期持有" }, { key: "take", name: "止盈沟通" }, { key: "review", name: "亏损复盘" },
    { key: "sip", name: "定投唤醒" }, { key: "guide", name: "行为引导" }
  ];
  const SCRIPT_BODY = {
    soothe: "注意到您持有的基金近期回撤比较大，想先跟您聊聊持有感受。短期波动不代表必须马上处理，我们可以一起看持仓结构、回撤来源和您的资金期限，再决定是继续持有、分批调整还是先停一停。",
    rise: "您持有的基金近期表现不错，可以先看看收益背后的来源（市场、产品本身还是投入时点），再结合您的资金目标和风险承受能力，决定是否需要部分落袋或继续观察。",
    range: "近期市场震荡为主，单一方向都不持续。对您来说更重要的是持仓和资金期限的匹配，短期涨跌不必过度反应，有变化我会第一时间跟您说明。",
    hold: "长期持有更看重的是选对方向后的耐心。净值短期波动是常态，关键在于您的资金期限是否足够长、风险是否匹配，我们按季度一起检视一次就够。",
    take: "您持有的基金收益已经比较可观，可以考虑部分止盈把收益落袋，保留剩余仓位继续观察。是否止盈、止盈多少都由您决定，我可以先把费率和赎回到账时间说明白。",
    review: "想跟您一起复盘一下这笔持仓：先看回撤来源和持有期间的市场环境，再结合当时的买入时点，一起总结经验。复盘不是为了找错，而是为了之后做得更稳。",
    sip: "看到您的定投最近几期没有扣款成功，想确认一下是资金安排原因还是想暂停。如果只是账户余额问题，补上即可继续；如果想法变了，我们也可以重新规划。",
    guide: "结合您的账户情况，提醒两个小点：一是近期交易频率有所上升，频繁申赎会产生费用；二是可以关注定投这类平滑波动的工具。有空我给您做一次快速检视。"
  };
  function buildScript(key, c) {
    const call = `${c.name.slice(0, 1)}${c.elderly || c.name.endsWith("琳") || c.name.endsWith("静") || c.name.endsWith("岚") || c.name.endsWith("芬") || c.name.endsWith("玲") ? "女士" : "先生"}`;
    const slots = `（客户画像：${c.age} 岁 · ${c.risk} 级风险 · ${c.seg}；市场要点：综合温度 ${MKT_TEMP} 演示值；事件要点：${c.events.length ? c.events.join("、") : "无"}）`;
    return { body: `[${call}] ${SCRIPT_BODY[key] || SCRIPT_BODY.hold}${slots}（跟进提示：请记录客户反馈并约定下次跟进时间。）`, riskNote: c.elderly ? RISK_NOTE_ELDER : RISK_NOTE, key };
  }

  /* ============================ 状态 ============================ */
  const state = { tab: "overview", cust: null, univCust: null, univSel: "U0", scriptCtx: null, modal: null, recordTask: null };
  let scriptVersion = 1;

  /* ============================ 渲染：页面骨架 ============================ */
  function pageTabs() {
    const tabs = [["overview", "持仓总览"], ["monitor", "异动事件"], ["universe", "平行宇宙"]];
    return `<div class="cp-tabs">${tabs.map(([k, n]) => `<button class="cp-tab ${state.tab === k ? "active" : ""}" data-cp-tab="${k}">${n}</button>`).join("")}</div>`;
  }

  /* 持仓总览（FR-HOLD-01） */
  function overviewHTML() {
    const totalPnl = CUSTOMERS.reduce((s, c) => s + c.pnl, 0);
    const totalDay = CUSTOMERS.reduce((s, c) => s + c.pnlDay, 0);
    const totalMV = CUSTOMERS.reduce((s, c) => s + c.fundMV, 0);
    const pending = TASKS.filter(t => t.status === "待处理").length;
    const top = [...CUSTOMERS].sort((a, b) => b.pnl - a.pnl);
    const bottom = [...CUSTOMERS].sort((a, b) => a.pnl - b.pnl);
    const events = [...TASKS].sort((a, b) => (RULES.find(r => r.id === b.rule).sev - RULES.find(r => r.id === a.rule).sev));
    const rankRow = (c, i) => `<tr class="cp-row" data-cp-open="${c.id}" tabindex="0"><td><strong>${c.name}</strong><span>${c.cid}</span></td><td>${money(c.fundMV)}</td><td class="${c.pnl > 0 ? "up" : c.pnl < 0 ? "down" : ""}">${pct(c.pnl, 2)}</td><td class="${c.pnlDay > 0 ? "up" : c.pnlDay < 0 ? "down" : ""}">${pct(c.pnlDay, 2)}</td><td>${c.holdings.length} 只</td><td>${money(c.pnl, 2)}</td></tr>`;
    return `
    <div class="cp-kpi-grid">
      <div class="cp-kpi"><span>基金客户数</span><b>${CUSTOMERS.length}</b><small>本人名下（演示）</small></div>
      <div class="cp-kpi"><span>基金保有市值</span><b>${money(totalMV)}</b><small>T+1 口径</small></div>
      <div class="cp-kpi"><span>累计盈亏</span><b class="${totalPnl > 0 ? "up" : "down"}">${pct(totalPnl, 2)}</b><small>含浮盈浮亏</small></div>
      <div class="cp-kpi"><span>今日盈亏</span><b class="${totalDay > 0 ? "up" : "down"}">${pct(totalDay, 2)}</b><small>T+1</small></div>
      <div class="cp-kpi"><span>待办任务</span><b>${pending}</b><small>陪持有来源</small></div>
    </div>
    <section class="card cp-section">
      <div class="card-header compact"><div><div class="card-title-row"><h2>盈亏榜（按客户）</h2></div><p>浮盈 Top / 浮亏 Bottom · 点击客户进入陪持有画像 · 支持切片下钻</p></div></div>
      <div class="cp-table-wrap"><table class="cp-table"><thead><tr><th>客户</th><th>基金市值</th><th>累计盈亏</th><th>今日盈亏</th><th>持仓数</th><th>盈亏额</th></tr></thead><tbody>
        ${top.map(rankRow).join("")}</tbody></table></div>
    </section>
    <section class="card cp-section">
      <div class="card-header compact"><div><div class="card-title-row"><h2>异动榜（近 7 日）</h2></div><p>按优先级分排序 · 14 条事件规则命中 · 去重后进入任务中心</p></div></div>
      <div class="cp-table-wrap"><table class="cp-table"><thead><tr><th>客户</th><th>规则</th><th>事件</th><th>优先级</th><th>状态</th></tr></thead><tbody>
        ${events.map(t => { const c = customerOf(t.cust); const r = RULES.find(x => x.id === t.rule); return `<tr class="cp-row" data-cp-open="${t.cust}" tabindex="0"><td><strong>${c.name}</strong></td><td><span class="cp-rule">${t.rule}</span></td><td>${escapeHTML(t.theme)}</td><td><span class="cp-pri p${t.pri}">${t.pri}</span></td><td><span class="cp-state s${t.status}">${t.status}</span></td></tr>`; }).join("")}</tbody></table></div>
    </section>`;
  }

  /* 异动监控 + 事件任务（FR-HOLD-03） */
  function monitorHTML() {
    const lanes = [["today", "今日必访", "P0 · 当日"], ["week", "本周跟进", "P1 · 3 个工作日"], ["pool", "维护池", "P2 · 本周下期"]];
    const laneHTML = lanes.map(([key, name, hint]) => {
      const list = TASKS.filter(t => t.lane === key);
      const cards = list.map(t => {
        const c = customerOf(t.cust);
        const r = RULES.find(x => x.id === t.rule);
        const nexts = NEXT_STATE[t.status] || [];
        return `<div class="cp-task">
          <div class="cp-task-head"><button class="cp-link" data-cp-open="${t.cust}">${c.name}</button><span class="cp-rule">${t.rule} ${r.name}</span></div>
          <p class="cp-task-theme">${escapeHTML(t.theme)}</p>
          <div class="cp-task-meta"><span class="cp-pri p${t.pri}">${t.pri}</span><span>时效 ${t.due}</span><span class="cp-state s${t.status}">${t.status}</span><span>本周触达 ${touchCount(t.cust)}/2</span></div>
          <p class="cp-task-next"><i>下次：</i>${escapeHTML(t.next)}</p>
          <div class="cp-task-actions">${nexts.map(n => `<button class="btn btn-secondary btn-small" data-cp-advance="${t.id}|${n}">→ ${n}</button>`).join("")}<button class="text-btn" data-cp-log="${t.id}">流转留痕</button></div>
        </div>`;
      }).join("");
      return `<div class="cp-lane"><div class="cp-lane-head"><strong>${name}</strong><span>${hint}</span><b>${list.length}</b></div>${cards || `<div class="cp-empty small">暂无任务</div>`}</div>`;
    }).join("");
    return `
    <section class="card cp-section">
      <div class="card-header compact"><div><div class="card-title-row"><h2>14 条事件规则</h2><span class="count-badge">${RULES.length}</span></div><p>优先级分 = 0.40×严重度 + 0.30×客户价值 + 0.20×客户等级 + 0.10×时效性 · 同客户+同基金+同规则 30 天去重</p></div><span class="cp-param-badge">参数 ${PARAM_VER}</span></div>
      <div class="cp-rules-grid">${RULES.map(r => `<div class="cp-rule-card"><span class="cp-rule">${r.id}</span><b>${r.name}</b><span class="cp-rule-cat">${r.cat}</span><span>严重度 ${r.sev}</span><small>${r.action}</small></div>`).join("")}</div>
    </section>
    <section class="card cp-section">
      <div class="card-header compact"><div><div class="card-title-row"><h2>事件任务</h2><span class="count-badge">${TASKS.length}</span></div><p>状态机：待处理 → 已触达 → 已沟通 → 已完成 / 已关闭；不允许跳步；必填校验；与找客户任务中心同源</p></div><span class="cp-param-badge">频控：主动 ≤2 次/周 · 老年营销 ≤1 次/周 · 静默 20:00–9:00</span></div>
      <div class="cp-lanes">${laneHTML}</div>
    </section>`;
  }

  /* 平行宇宙（FR-HOLD-09/10/11） */
  function universeListHTML() {
    return `<section class="card cp-section">
      <div class="card-header compact"><div><div class="card-title-row"><h2>选择客户</h2></div><p>平行宇宙 / 归因 / 获得感均以【单只基金】为分析对象：先选客户，再选该客户持有的某只基金</p></div></div>
      <div class="cp-cust-grid">${CUSTOMERS.map(c => `<button class="cp-cust-card" data-cp-univ-cust="${c.id}">
        <div class="cp-cust-head"><strong>${c.name}</strong><span class="risk-c c${c.risk}">${c.risk} 级</span>${c.elderly ? `<span class="cp-flag">老年</span>` : ""}</div>
        <div class="cp-cust-line">基金 ${money(c.fundMV)} · 持仓 ${c.holdings.length} 只</div>
        <div class="cp-cust-line ${c.pnl > 0 ? "up" : c.pnl < 0 ? "down" : ""}">累计盈亏 ${pct(c.pnl, 2)}</div>
        <div class="cp-cust-tags">${c.holdings.map(h => `<span>${escapeHTML(h.name)}</span>`).join("")}</div>
      </button>`).join("")}</div>
    </section>`;
  }

  /* 选择某客户后，展示该客户持有的基金列表，供选择单只基金进入平行宇宙 */
  function universeFundListHTML(custId) {
    const c = customerOf(custId);
    if (!c) return "";
    return `<div class="cp-back-row"><button class="text-btn" data-cp-univ-list-back>${icon("arrow-left")}返回客户列表</button><span class="cp-param-badge">${c.name} · 持有 ${c.holdings.length} 只基金</span></div>
    <section class="card cp-section">
      <div class="card-header compact"><div><div class="card-title-row"><h2>选择要分析的基金</h2></div><p>逐只基金独立做生命周期回顾、α/β/γ 归因、U0–U5 反事实对比与逐笔获得感</p></div></div>
      <div class="cp-fund-list">${c.holdings.map(h => `<button class="cp-fund-card" data-cp-univ="${c.id}|${h.fid}">
        <div class="cp-fund-head"><strong>${escapeHTML(h.name)}</strong><span class="cp-fund-chip">${h.fid}</span></div>
        <div class="cp-fund-line"><span>市值 ${money(h.mv)}</span><span>持有 ${h.days} 天</span><span>基准 ${escapeHTML(h.bench)}</span></div>
        <div class="cp-fund-line ${h.pnl > 0 ? "up" : h.pnl < 0 ? "down" : ""}">累计盈亏 ${pct(h.pnl, 1)} · 区间收益 ${pct(h.fundR, 1)}（基准 ${pct(h.benchR, 1)}）</div>
        <div class="cp-fund-trades"><span>${h.trades.length} 笔交易</span><span>α ${pct(h.attri.alpha, 1)} · β ${pct(h.attri.beta, 1)} · γ ${pct(h.attri.gamma, 1)}</span></div>
      </button>`).join("")}</div>
    </section>`;
  }

  function universeDetailHTML(key) {
    const [custId, fid] = String(key).split("|");
    const c = customerOf(custId);
    const h = holdingOf(custId, fid);
    if (!c || !h) return "";
    state.univCust = custId;
    state.univFid = fid;
    const uni = universeOf(h);
    const sel = state.univSel || "U0";
    const cur = uni[sel];
    const base = uni.U0.r;         // 真实世界(U0)收益，作差异基准
    const baseDD = uni.U0.dd;      // 真实世界(U0)最大回撤
    const baseVol = uni.U0.vol;    // 真实世界(U0)波动率
    const a = h.attri;
    const timeline = h.trades.map(t => `<div class="cp-tl-item"><span class="cp-tl-date">${t.d}</span><span class="cp-tl-type">${t.type}</span><div><strong>${money(t.amt)}</strong><p>${escapeHTML(t.note)}</p></div><span class="cp-tl-gain ${t.gain > 0 ? "up" : t.gain < 0 ? "down" : ""}">${pct(t.gain, 1)}pp</span></div>`).join("");
    const tradeCards = h.trades.map((t, i) => {
      const g = gainScore(t);
      return `<div class="cp-gain-card"><div class="cp-gain-head"><strong>${t.d} · ${t.type}</strong><span>${money(t.amt)}</span></div>
        <div class="cp-gain-grid"><div><span>收益影响</span><b class="${t.gain > 0 ? "up" : t.gain < 0 ? "down" : ""}">${pct(t.gain, 1)}pp</b></div><div><span>风险影响</span><b>波动 ${t.risk > 0 ? "+" : ""}${t.risk.toFixed(1)}</b></div><div><span>纪律标签</span><b>${t.disc}</b></div></div>
        <div class="cp-gain-score"><span>获得感分（经理侧）</span><b>${g.total}</b><small>0.5×收益 ${g.ret} + 0.3×波动 ${g.vol} + 0.2×纪律 ${g.disc}</small></div>
        <p class="cp-gain-note">${t.gain < 0 ? "负贡献交易：展示当时可得信息，避免后见之明偏差。" : "中性表述：获得感分仅经理侧复盘排序，不对客展示、不贴标签。"}</p>
      </div>`;
    }).join("");
    return `<div class="cp-back-row"><button class="text-btn" data-cp-univ-back>${icon("arrow-left")}返回基金列表</button><span class="cp-param-badge">假设性回测 · 参数可复核</span></div>
    <div class="cp-banner">${icon("alert")}<span>${PU_NOTE}</span></div>
    <section class="card cp-section">
      <div class="card-header compact"><div><div class="card-title-row"><h2>${escapeHTML(h.name)} · 生命周期时间轴</h2></div><p>客户 ${c.name} · 确认份额日至当前 · 多笔按先进先出（FIFO）归集 · 数据 T+1</p></div><span class="cp-fund-chip">${h.fid} · 基准 ${escapeHTML(h.bench)}</span></div>
      <div class="cp-timeline">${timeline || `<p class="cp-dim-line">该基金暂无交易记录。</p>`}</div>
    </section>
    <section class="card cp-section">
      <div class="card-header compact"><div><div class="card-title-row"><h2>收益归因（α / β / γ）</h2></div><p>投资总收益 = α（基金选择）+ β（市场）+ γ（客户行为）+ 费用影响（单列）· 本基金区间收益 ${pct(h.fundR, 1)}，基准 ${escapeHTML(h.bench)} ${pct(h.benchR, 1)}</p></div></div>
      <div class="cp-attri">
        <div class="cp-attri-total"><span>投资总收益</span><b class="${a.total > 0 ? "up" : "down"}">${pct(a.total, 1)}</b><small>= α + β + γ + 费用</small></div>
        <div class="cp-attri-items">
          <div><span>α 基金选择</span><b class="${a.alpha > 0 ? "up" : "down"}">${pct(a.alpha, 1)}</b><small>超额收益</small></div>
          <div><span>β 市场</span><b class="${a.beta > 0 ? "up" : "down"}">${pct(a.beta, 1)}</b><small>基准区间收益</small></div>
          <div><span>γ 客户行为</span><b class="${a.gamma > 0 ? "up" : "down"}">${pct(a.gamma, 1)}</b><small>实际 − 买入持有</small></div>
          <div><span>费用影响</span><b class="down">${pct(a.fee, 1)}</b><small>单列不入三项</small></div>
        </div>
      </div>
      <details class="cp-seg"><summary>γ 二级拆解（仅用于解释，不用于评价客户）</summary>
        <div class="cp-seg-grid">
          <div><span>择时贡献</span><b>${pct(a.seg.timing, 1)}</b></div>
          <div><span>止盈止损贡献</span><b>${pct(a.seg.stop, 1)}</b></div>
          <div><span>定投纪律贡献</span><b>${pct(a.seg.sip, 1)}</b></div>
          <div><span>交易成本</span><b>${pct(a.seg.cost, 1)}</b></div>
        </div>
        <p class="cp-dim-line">基准指数缺失时该项标「数据不足」，归因降级为仅 β+实际收益，不得用 0 补齐。</p>
      </details>
    </section>
    <section class="card cp-section">
      <div class="card-header compact"><div><div class="card-title-row"><h2>平行宇宙对比（U0–U5）</h2></div><p>四项对比维度：区间收益 / 最大回撤 / 波动率 / 期末市值 · 假设显著标注 · 相对真实世界(U0)的差异用红绿标注</p></div></div>
      <div class="cp-univ-tabs">${UNIVERSE.map(u => `<button class="${sel === u.key ? "active" : ""}" data-cp-univ-sel="${u.key}">${u.key} ${u.name}</button>`).join("")}</div>
      <div class="cp-univ-desc"><b>${sel}</b> ${UNIVERSE.find(u => u.key === sel).desc} — ${UNIVERSE.find(u => u.key === sel).value}${cur.d ? `（本基金：${cur.d}）` : ""}</div>
      <div class="cp-univ-table-wrap"><table class="cp-univ-table">
        <thead><tr><th>对比维度</th>${UNIVERSE.map(u => `<th class="${sel === u.key ? "col-active" : ""}">${u.key}<small>${u.short || u.name}</small></th>`).join("")}</tr></thead>
        <tbody>
          <tr><td>区间收益</td>${UNIVERSE.map(u => { const v = uni[u.key].r; const diff = v - base; return `<td class="${sel === u.key ? "col-active" : ""}"><b class="${v > 0 ? "up" : v < 0 ? "down" : ""}">${pct(v, 1)}</b>${u.key !== "U0" ? `<small class="${diff > 0 ? "up" : diff < 0 ? "down" : ""}">${diff > 0 ? "▲" : diff < 0 ? "▼" : "—"}${Math.abs(diff).toFixed(1)}pp</small>` : ""}</td>`; }).join("")}</tr>
          <tr><td>最大回撤</td>${UNIVERSE.map(u => { const v = uni[u.key].dd; const diff = v - baseDD; return `<td class="${sel === u.key ? "col-active" : ""}"><b class="down">${v.toFixed(1)}%</b>${u.key !== "U0" ? `<small class="${diff < 0 ? "up" : "down"}">${diff < 0 ? "▲" : "▼"}${Math.abs(diff).toFixed(1)}pp</small>` : ""}</td>`; }).join("")}</tr>
          <tr><td>波动率</td>${UNIVERSE.map(u => { const v = uni[u.key].vol; const diff = v - baseVol; return `<td class="${sel === u.key ? "col-active" : ""}"><b>${v.toFixed(1)}%</b>${u.key !== "U0" ? `<small class="${diff < 0 ? "up" : "down"}">${diff < 0 ? "▼" : "▲"}${Math.abs(diff).toFixed(1)}pp</small>` : ""}</td>`; }).join("")}</tr>
          <tr><td>期末市值</td>${UNIVERSE.map(u => { const v = uni[u.key].mv; const diff = v - h.mv; return `<td class="${sel === u.key ? "col-active" : ""}"><b>${money(v)}</b>${u.key !== "U0" ? `<small class="${diff > 0 ? "up" : diff < 0 ? "down" : ""}">${diff > 0 ? "▲" : diff < 0 ? "▼" : "—"}${Math.abs(diff).toFixed(1)}万</small>` : ""}</td>`; }).join("")}</tr>
        </tbody>
      </table></div>
    </section>
    <section class="card cp-section">
      <div class="card-header compact"><div><div class="card-title-row"><h2>逐笔交易获得感分析</h2></div><p>本基金每笔申赎/转换/断供对收益与波动的影响评分 · 中性表述 · 不排名不贴标签</p></div></div>
      <div class="cp-gain-list">${tradeCards}</div>
    </section>`;
  }

  /* 客户陪持有画像（抽屉） */
  function detailHTML(custId) {
    const c = customerOf(custId);
    if (!c) return "";
    const holdings = c.holdings.map(h => `<tr><td><strong>${escapeHTML(h.name)}</strong></td><td>${money(h.mv)}</td><td class="${h.pnl > 0 ? "up" : h.pnl < 0 ? "down" : ""}">${pct(h.pnl, 1)}</td><td>${h.days} 天</td><td>${escapeHTML(h.bench)}</td></tr>`).join("");
    const tasks = TASKS.filter(t => t.cust === custId).map(t => `<div class="cp-hist-task"><span>${escapeHTML(t.theme)}</span><span class="cp-state s${t.status}">${t.status}</span></div>`).join("");
    const tier = c.pnl < 0 ? (Math.abs(c.pnl) >= 15 || (Math.abs(c.pnl) >= 10 && c.daysAvg >= 180) ? LOSS_TIERS[2] : Math.abs(c.pnl) >= 5 ? LOSS_TIERS[1] : LOSS_TIERS[0]) : null;
    return `
    ${c.elderly ? `<div class="cp-banner amber">${icon("info")}老年客户（${c.age} 岁）：营销类触达 ≤1 次/周；优先电话/面谈；材料适老版；记录单独标记。</div>` : ""}
    <section class="drawer-section"><div class="drawer-section-title"><h3>基本信息</h3><span>数据 T+1</span></div>
      <div class="cp-facts">
        <div><span>客户号</span><b>${c.cid}</b></div><div><span>年龄</span><b>${c.age} 岁</b></div>
        <div><span>风险等级</span><b>${c.risk} 级</b></div><div><span>价值层</span><b>${c.level} 层 · ${c.seg}</b></div>
        <div><span>基金市值</span><b>${money(c.fundMV)}</b></div><div><span>累计盈亏</span><b class="${c.pnl > 0 ? "up" : c.pnl < 0 ? "down" : ""}">${pct(c.pnl, 2)}</b></div>
        <div><span>今日盈亏</span><b class="${c.pnlDay > 0 ? "up" : "down"}">${pct(c.pnlDay, 2)}</b></div><div><span>本周触达</span><b>${touchCount(custId)}/2</b></div>
      </div></section>
    <section class="drawer-section"><div class="drawer-section-title"><h3>基金持仓</h3><span>${c.holdings.length} 只 · 点击进入基金</span></div>
      <table class="cp-mini-table"><thead><tr><th>基金</th><th>市值</th><th>盈亏</th><th>持有</th><th>基准</th></tr></thead><tbody>${holdings}</tbody></table></section>
    <section class="drawer-section"><div class="drawer-section-title"><h3>归因概览（按单只基金）</h3><span>α/β/γ 可复算 · 点击进入该基金平行宇宙</span></div>
      <div class="cp-attri-fund-list">${c.holdings.map(h => `<button class="cp-attri-fund" data-cp-univ="${custId}|${h.fid}">
        <span class="cp-fund-name">${escapeHTML(h.name)}</span>
        <span class="cp-fund-abg"><i>α</i><b class="${h.attri.alpha > 0 ? "up" : "down"}">${pct(h.attri.alpha, 1)}</b><i>β</i><b class="${h.attri.beta > 0 ? "up" : "down"}">${pct(h.attri.beta, 1)}</b><i>γ</i><b class="${h.attri.gamma > 0 ? "up" : "down"}">${pct(h.attri.gamma, 1)}</b></span>
        <span class="cp-fund-total">总收益 <b class="${h.attri.total > 0 ? "up" : "down"}">${pct(h.attri.total, 1)}</b></span>
        ${icon("chevron-right")}
      </button>`).join("")}</div></section>
    ${tier ? `<section class="drawer-section"><div class="drawer-section-title"><h3>亏损安抚分档</h3><span>超出风险等级上调一档</span></div>
      <div class="cp-tier"><span>${tier.name}</span><b>${tier.cond}</b><p>${tier.action} · 时效 ${tier.sla}</p></div></section>` : ""}
    ${c.sipMiss >= 2 ? `<div class="cp-banner amber">${icon("alert")}定投连续缺扣 ${c.sipMiss} 期：已生成断供唤醒任务（H-13）。</div>` : ""}
    <section class="drawer-section"><div class="drawer-section-title"><h3>命中事件</h3><span>${c.events.length} 条</span></div>
      <div class="cp-tags">${c.events.map(e => `<span>${e} ${RULES.find(r => r.id === e).name}</span>`).join("") || `<p class="cp-dim-line">暂无命中事件。</p>`}</div></section>
    <section class="drawer-section"><div class="drawer-section-title"><h3>任务历史</h3><span>与任务中心一致</span></div>${tasks || `<p class="cp-dim-line">暂无任务。</p>`}</section>
    <div class="drawer-actions"><button class="btn btn-secondary" data-cp-script="${custId}|soothe">${icon("message")}生成安抚话术</button><button class="btn btn-primary" data-cp-univ-cust="${custId}">${icon("sparkles")}平行宇宙复盘（选基金）</button></div>`;
  }

  /* 话术抽屉（FR-HOLD-08） */
  function scriptHTML(key) {
    const [custId, sceneKey] = key.split("|");
    const c = customerOf(custId);
    const s = buildScript(sceneKey || "soothe", c);
    state.scriptCtx = { custId, key: s.key };
    return `<div class="cp-script-meta"><span>场景</span><select id="cpSceneSel">${SCRIPTS.map(sc => `<option value="${sc.key}" ${sc.key === s.key ? "selected" : ""}>${sc.name}</option>`).join("")}</select><span>客户</span><b>${c.name}（${c.risk} 级${c.elderly ? " · 适老版" : ""}）</b></div>
    <div class="cp-slots"><span>模板槽位</span><p>{称呼} {持仓要点} {市场要点} {事件要点} {风险提示·锁定} {跟进提示}</p></div>
    <label class="cp-script-label">草稿正文（经理可编辑；发送前须二次校验）<textarea id="cpScriptBody" rows="9">${escapeHTML(s.body)}</textarea></label>
    <div class="cp-banned-result" id="cpBannedResult"></div>
    <div class="cp-risk-note">${icon("shield")}<b>风险提示（锁定，不可删除）</b><p>${escapeHTML(s.riskNote)}</p></div>
    <div class="cp-script-actions">
      <button class="btn btn-secondary btn-small" id="cpScriptCheck">${icon("shield")}违禁词校验</button>
      <button class="btn btn-secondary btn-small" id="cpScriptRecheck">${icon("check")}发送前二次校验</button>
      <button class="btn btn-primary btn-small" id="cpScriptSend">${icon("send")}生成草稿并留痕</button>
    </div>
    <div class="cp-script-log" id="cpScriptLog"></div>
    <div class="cp-rules"><b>硬规则（FR-HOLD-08）</b><ul><li>违禁词零漏放，命中即拦截，不可跳过。</li><li>风险提示语句锁定不可删除。</li><li>生成版与发送版全部留痕（版本/校验/渠道/时间/对象）。</li><li>与找客户话术引擎共用校验规则。</li></ul></div>`;
  }

  function validateScript(text) { return BANNED.filter(w => text.includes(w)); }
  function runScriptCheck(finalCheck) {
    const text = $("#cpScriptBody").value;
    const hits = validateScript(text);
    const box = $("#cpBannedResult");
    if (hits.length) { box.innerHTML = `<span class="bad">${icon("x")}违禁词拦截：${hits.map(escapeHTML).join("、")} — 命中即拦截，不可跳过</span>`; return false; }
    box.innerHTML = `<span class="ok">${icon("check-circle")}校验通过：无违禁词 · 风险提示已锁定${finalCheck ? " · 二次校验通过（发送版留痕）" : " · 生成版留痕"}</span>`;
    const log = $("#cpScriptLog");
    log.innerHTML = `<div class="cp-log-line">V${finalCheck ? ++scriptVersion : scriptVersion} · ${new Date().toLocaleTimeString("zh-CN", { hour12: false }).slice(0, 5)} · ${finalCheck ? "发送前二次校验通过" : "生成版校验通过"} · 渠道：经理确认后发送 · 接收：${state.scriptCtx.custId}</div>` + log.innerHTML;
    return true;
  }

  /* ============================ 弹窗：任务推进 ============================ */
  function openModal(html) { $("#cpModalContent").innerHTML = html; $("#cpModal").hidden = false; }
  function closeModal() { $("#cpModal").hidden = true; $("#cpModalContent").innerHTML = ""; }

  function advanceHTML(taskId, target) {
    const t = TASKS.find(x => x.id === taskId);
    const c = customerOf(t.cust);
    const fields = {
      "已触达": `<label class="cp-f-field"><span>触达渠道 *</span><select name="channel"><option value="">请选择渠道</option><option>电话</option><option>面谈</option><option>企业微信</option><option>短信</option><option>系统内消息</option></select></label><label class="cp-f-field"><span>触达时间 *</span><input name="time" type="time" value="15:00"></label>`,
      "已沟通": `<label class="cp-f-field"><span>沟通要点 *</span><textarea name="point" rows="3" placeholder="客户反馈、已说明的风险、持仓解释要点"></textarea></label><label class="cp-f-field"><span>客户反馈 *</span><select name="feedback"><option value="">请选择反馈</option><option>接受</option><option>犹豫</option><option>拒绝</option><option>需跟进</option></select></label>`,
      "已完成": `<label class="cp-f-field"><span>结果 *</span><select name="result"><option>继续持有</option><option>部分止盈</option><option>完成安抚</option><option>暂缓</option></select></label><label class="cp-f-field"><span>下一步</span><input name="next" placeholder="选填"></label>`,
      "已关闭": `<label class="cp-f-field"><span>关闭原因 *</span><textarea name="reason" rows="2" placeholder="手工关闭必须填写原因"></textarea></label>`
    }[target] || "";
    return `<div class="cp-modal-head"><span class="eyebrow">FR-HOLD 状态机</span><h3>${c.name} · ${escapeHTML(t.theme)}</h3><p>${t.status} → <b>${target}</b>${REQUIRED[target] ? "（带 * 为必填）" : ""}</p></div>
    <form id="cpAdvanceForm" data-task="${taskId}" data-target="${target}">${fields}
      <label class="cp-f-field"><span>备注 / 留痕说明</span><input name="note" placeholder="状态变更将记录操作人、时间、前后状态"></label>
      <div class="cp-modal-foot"><button type="button" class="btn btn-secondary" data-cp-modal-close>取消</button><button type="submit" class="btn btn-primary">确认流转</button></div>
    </form>`;
  }

  /* ============================ AI 话术 ============================ */
  function aiDraft() {
    const p0 = TASKS.filter(t => t.pri === "P0" && t.status !== "已完成").length;
    const loss = CUSTOMERS.filter(c => c.pnl < -5).length;
    return `陪持有 · 监控摘要（演示，参数 ${PARAM_VER}）：
1. 今日必访 P0 任务 ${p0} 项：优先处理单日急跌安抚与深度亏损复盘。
2. 亏损超 5% 客户 ${loss} 位，其中周志强（−18.4%）进入深度安抚+复盘（24h P0）。
3. 止盈提醒：王雅琳 / 赵子轩浮盈达标，准备「继续持有 / 部分止盈」双向沟通要点。
4. 行为干预：赵子轩 30 天申赎 3 次，仅经理侧中性提示，不贴标签。
5. 平行宇宙仅经理侧复盘，对客需转「假设情景说明」并附固定风险提示。

所有草稿须经理复核后使用；触达须通过频控（主动 ≤2 次/周）与静默时段（20:00–9:00）校验。`;
  }

  /* ============================ 规则与口径（抽屉） ============================ */
  function rulesHTML() {
    return `<section class="drawer-section"><div class="drawer-section-title"><h3>优先级分</h3><span>可复算</span></div>
      <ol class="rule-list"><li>优先级分 = 0.40×严重度 + 0.30×客户价值 + 0.20×客户等级 + 0.10×时效性</li><li>≥80 → P0（今日必访）；60–79 → P1（本周跟进）；<60 → P2（维护池）。</li><li>去重：同客户 + 同基金 + 同规则 30 天不重复；同一任务 7 天不重复提醒经理。</li></ol></section>
    <section class="drawer-section"><div class="drawer-section-title"><h3>止盈三策略（FR-HOLD-04）</h3></div>
      <ol class="rule-list"><li><strong>策略 A 目标收益：</strong>股票 20% / 混合 15% / 指数 15% / 债券 5% 触发止盈沟通。</li><li><strong>策略 B 移动止盈：</strong>自最高浮盈回落 8pp 且最高浮盈曾 ≥5pp 触发。</li><li><strong>策略 C 估值止盈：</strong>估值分位 >85% 作为辅助确认（不单独触发）。</li><li>输出为止盈沟通任务与资金去向建议（货基/短债/分批再配置），不构成买卖指令；同笔 30 天不重复。</li></ol></section>
    <section class="drawer-section"><div class="drawer-section-title"><h3>亏损分档（FR-HOLD-05）</h3></div>
      <ol class="rule-list"><li><strong>观察：</strong>亏损 <5% 且持有 <90 天，不生成任务。</li><li><strong>主动沟通：</strong>亏损 5%–15%，或 ≥5% 且持有 ≥90 天，安抚任务 + 话术，3 个工作日。</li><li><strong>深度安抚+复盘：</strong>亏损 ≥15%，或 ≥10% 且持有 ≥180 天，24 小时（P0）。</li><li>超出客户风险承受等级时上调一档；分档依据、持有天数、浮亏比例在任务卡可下钻。</li></ol></section>
    <section class="drawer-section"><div class="drawer-section-title"><h3>行为识别阈值（FR-HOLD-06）</h3></div>
      <ol class="rule-list"><li>申赎频率 ≥3 笔/30 天 → 行为干预任务 + 投教。</li><li>平均持有期 <30 天 → 投教提示（含 7 天赎回费率）。</li><li>追涨：阶段高点买入占比 >80% → 经理侧提示。</li><li>杀跌：低位卖出占比 >70% → 经理侧提示。</li><li>仅生成经理侧任务，中性表述，不对客户贴标签。</li></ol></section>
    <section class="drawer-section"><div class="drawer-section-title"><h3>频控与合规</h3></div>
      <div class="risk-note">主动触达 ≤2 次/周/客户；老年营销 ≤1 次/周；同内容 7 天不重复；静默 20:00–9:00；默认「草稿 + 经理确认」；豁免需注明事由并计入合规报表。平行宇宙为假设性回测，仅经理侧复盘，对客需转「假设情景说明」并附固定风险提示。</div></section>`;
  }

  /* ============================ 渲染页面 ============================ */
  function renderPage() {
    const body = $("#cpBody");
    let uniContent;
    if (state.tab === "overview") uniContent = overviewHTML();
    else if (state.tab === "monitor") uniContent = monitorHTML();
    else uniContent = state.univCust ? universeFundListHTML(state.univCust) : universeListHTML();
    body.innerHTML = pageTabs() + uniContent;
  }

  /* ============================ 主 show ============================ */
  function show() {
    ["#todayPage", "#marketPage", "#fundPage", "#portfolioPage", "#customerPage"].forEach(sel => { const el = $(sel); if (el) el.hidden = true; });
    const tray = $("#compareTray"); if (tray) tray.hidden = true;
    $("#companionPage").hidden = false;
    $$(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.nav === "companion"));
    document.title = "陪持有｜基金智库工作台";
    state.tab = "overview";
    renderPage();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  /* ============================ 事件 ============================ */
  function bind() {
    document.addEventListener("click", event => {
      const page = $("#companionPage");
      if (!page || page.hidden) {
        if (!event.target.closest("#cpModal")) return;
      }
      const tabBtn = event.target.closest("[data-cp-tab]");
      if (tabBtn) { state.tab = tabBtn.dataset.cpTab; if (state.tab !== "universe") { state.univCust = null; } renderPage(); return; }
      if (event.target.closest("#cpRuleBtn")) { window.FundThinkTank && window.FundThinkTank.openDrawer("cpRules", "rules", true); return; }
      if (event.target.closest("#cpAiBtn")) { window.FundThinkTank && window.FundThinkTank.openAi("生成陪持有持仓与异动监控摘要"); return; }
      const openBtn = event.target.closest("[data-cp-open]");
      if (openBtn) { window.FundThinkTank && window.FundThinkTank.openDrawer("cpCustomer", openBtn.dataset.cpOpen); return; }
      const univCustBtn = event.target.closest("[data-cp-univ-cust]");
      if (univCustBtn) { state.univCust = univCustBtn.dataset.cpUnivCust; state.univSel = "U0"; state.tab = "universe"; if (window.FundThinkTank && window.FundThinkTank.closeDrawer) window.FundThinkTank.closeDrawer(); renderPage(); return; }
      const univListBack = event.target.closest("[data-cp-univ-list-back]");
      if (univListBack) { state.univCust = null; state.univSel = "U0"; renderPage(); return; }
      const univBtn = event.target.closest("[data-cp-univ]");
      if (univBtn) {
        state.univSel = "U0";
        window.FundThinkTank && window.FundThinkTank.openDrawer("cpUniverse", univBtn.dataset.cpUniv, true);
        return;
      }
      const univSel = event.target.closest("[data-cp-univ-sel]");
      if (univSel) { state.univSel = univSel.dataset.cpUnivSel; window.FundThinkTank && window.FundThinkTank.renderDrawer(); return; }
      const univBack = event.target.closest("[data-cp-univ-back]");
      if (univBack) { state.univSel = "U0"; state.tab = "universe"; if (window.FundThinkTank && window.FundThinkTank.closeDrawer) window.FundThinkTank.closeDrawer(); renderPage(); return; }
      const scriptBtn = event.target.closest("[data-cp-script]");
      if (scriptBtn) { window.FundThinkTank && window.FundThinkTank.openDrawer("cpScript", scriptBtn.dataset.cpScript, true); return; }
      const advBtn = event.target.closest("[data-cp-advance]");
      if (advBtn) { const [tid, target] = advBtn.dataset.cpAdvance.split("|"); openModal(advanceHTML(tid, target)); return; }
      const logBtn = event.target.closest("[data-cp-log]");
      if (logBtn) {
        const t = TASKS.find(x => x.id === logBtn.dataset.cpLog);
        window.FundThinkTank && window.FundThinkTank.showToast(`留痕：${t.log.map(l => `${l.t} ${l.s}`).join(" → ")}（操作人/时间/前后状态已记录）`, "info");
        return;
      }
      if (event.target.closest("[data-cp-modal-close]")) { closeModal(); return; }
      if (event.target.id === "cpScriptCheck") { runScriptCheck(false); return; }
      if (event.target.id === "cpScriptRecheck") { runScriptCheck(true); return; }
      if (event.target.id === "cpScriptSend") {
        if (!runScriptCheck(true)) { window.FundThinkTank && window.FundThinkTank.showToast("违禁词命中，已拦截发送", "warn"); return; }
        const c = customerOf(state.scriptCtx.custId);
        window.FundThinkTank && window.FundThinkTank.showToast("草稿已生成并留痕：系统不直发，经理确认后经企微/短信发送（默认草稿模式）");
        return;
      }
    });

    document.addEventListener("change", event => {
      const page = $("#companionPage");
      if (!page || page.hidden) return;
      if (event.target.id === "cpSceneSel") {
        const c = customerOf(state.scriptCtx.custId);
        const s = buildScript(event.target.value, c);
        $("#cpScriptBody").value = s.body;
        runScriptCheck(false);
      }
    });

    document.addEventListener("input", event => {
      const page = $("#companionPage");
      if (!page || page.hidden) return;
      if (event.target.id === "cpScriptBody") {
        const hits = validateScript(event.target.value);
        const box = $("#cpBannedResult");
        if (box) box.innerHTML = hits.length ? `<span class="bad">${icon("x")}实时拦截：命中违禁词 ${hits.map(escapeHTML).join("、")}</span>` : "";
      }
    });

    document.addEventListener("submit", event => {
      const form = event.target;
      if (form.id === "cpAdvanceForm") {
        event.preventDefault();
        const taskId = form.dataset.task, target = form.dataset.target;
        const missing = (REQUIRED[target] || []).filter(name => !form.elements[name].value.trim());
        if (missing.length) { window.FundThinkTank && window.FundThinkTank.showToast(`必填字段未完成：${missing.join("、")}（状态机校验）`, "warn"); return; }
        const t = TASKS.find(x => x.id === taskId);
        if (target === "已触达") {
          const c = customerOf(t.cust);
          if (touchCount(t.cust) >= 2 && !t.log.some(l => l.note.includes("豁免"))) {
            window.FundThinkTank && window.FundThinkTank.showToast("频控拦截：该客户本周主动触达已达 2 次上限；如为重要事件豁免请在备注注明事由", "warn");
            return;
          }
          if (c.elderly && touchCount(t.cust) >= 1 && !t.log.some(l => l.note.includes("豁免"))) {
            window.FundThinkTank && window.FundThinkTank.showToast("老年客户营销类触达 ≤1 次/周，已达上限（服务类可豁免）", "warn");
            return;
          }
        }
        const note = form.elements.note.value.trim();
        t.log.push({ t: `2026-10-28 ${new Date().toTimeString().slice(0, 5)}`, s: target, by: "陈明远", note: note || `${target}流转` });
        t.status = target;
        if (target === "已完成" && form.elements.next) t.next = form.elements.next.value || "已闭环";
        if (target === "已关闭") t.next = `已关闭（${form.elements.reason.value.slice(0, 12)}…）`;
        closeModal();
        renderPage();
        window.FundThinkTank && window.FundThinkTank.showToast(`状态已流转：${t.status}（操作人/时间/前后状态已留痕）`);
        return;
      }
    });

    const cpModal = $("#cpModal");
    if (cpModal) cpModal.addEventListener("click", event => { if (event.target === cpModal) closeModal(); });
  }

  /* ============================ 启动 ============================ */
  function init() {
    if (!$("#companionPage")) return;
    bind();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.Companion = { show, aiDraft, detailHTML, scriptHTML, universeDetailHTML, rulesHTML };
})();
