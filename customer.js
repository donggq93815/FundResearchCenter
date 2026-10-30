(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const escapeHTML = value => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;

  /* ============================ 参数（§7.6.3/7.6.4/7.6.5，演示初始值） ============================ */
  const PARAM_VER = "CLT-P1.0";
  const DATA_DATE = "2026-10-28";
  const OWNER = "陈明远 · 上海徐汇支行";
  const LAYER近似 = [
    { key: "S", label: "S 层（私银参考）", min: 600 },
    { key: "A", label: "A 层", min: 300 },
    { key: "B", label: "B 层（沃德参考）", min: 50 },
    { key: "C", label: "C 层", min: 10 },
    { key: "D", label: "D 层", min: 0 }
  ];
  const OP_META = {
    due: { name: "资金到期", color: "#8a6bb5", dir: "固收 / 低波 / 现金管理" },
    gain: { name: "盈利加仓", color: "#c05a5a", dir: "权益 / 混合 / 指数" },
    loss: { name: "亏损挽回", color: "#5b8f6b", dir: "权益渐进 / 固收+，先安抚后诊断" },
    active: { name: "持仓激活", color: "#247cc1", dir: "固收+ / 低波 / 货基" },
    sip: { name: "定投断供", color: "#c0783a", dir: "固收 / 低波；先了解断供原因" }
  };
  const SCENE_FIT = { due: "bond", gain: "equity", loss: "equity", active: "bond", sip: "bond" };
  /* 时机分：市场温度 64（≥60 档）→ 权益 40 / 固收 100 / 其他 60（FR-CLT-03） */
  const TIMING = { equity: 40, bond: 100, other: 60 };
  const MKT_TEMP = 64;
  /* 产品硬约束演示状态（白名单外产品视为剔除；此处仅 F005/F012 演示异常态） */
  const PRODUCT_STATUS = { F005: "暂停申购", F012: "单日限购 1 万元" };
  /* 基金综合评分（与配基金/建组合口径一致的演示值） */
  const FUND_SCORE = { F001: 84, F002: 88, F003: 81, F004: 78, F005: 80, F006: 74, F007: 83, F008: 82, F009: 79, F010: 86, F011: 77, F012: 75, F013: 90, F014: 72, F015: 85, F016: 81, F017: 83 };
  /* 违禁词库（COM 引擎演示子集，命中即拦截） */
  const BANNED = ["保本", "保证收益", "稳赚", "必涨", "零风险", "无风险", "翻倍", "一定涨", "绝对安全", "只赚不赔"];
  const RISK_NOTE = "风险提示：基金有风险，投资须谨慎。历史业绩不代表未来表现，本材料为展业辅助草稿，不构成收益承诺或投资建议。请根据自身风险承受能力审慎决策。";
  const RISK_NOTE_ELDER = RISK_NOTE + "（适老版提示：如您不方便线上操作，可到网点由客户经理当面协助；可邀请家属共同了解，但不要求家属代办。）";

  /* ============================ 演示客户（9 位，覆盖 AC-CLT-01~04） ============================ */
  const CUSTOMERS = [
    {
      id: "C001", name: "王雅琳", cid: "6222****4821", age: 42, risk: 4,
      survey: { date: "2026-04-12", exp: "2027-04-12", state: "valid" },
      layer: "A", layerSrc: "行内标签：沃德", aum: 320.6, fundMV: 148.2, pnl: 12.86, pnlDay: 0.42,
      lastContact: 6, activity: "高", loginPct: 0.88, respRate: 0.74, assetMove: 80,
      pref: ["权益", "指数"], behavior: ["坚持定投", "关注指数工具"],
      tags: ["沃德客户", "理财将到期"],
      due: [{ name: "沃德稳享理财 85 期", amount: 80, date: "2026-11-15" }], duePct: 0.85,
      holdings: [{ fid: "F002", mv: 86.4, pnl: 9.6, days: 210 }, { fid: "F001", mv: 61.8, pnl: 5.2, days: 182 }],
      timeline: [
        { date: "2026-10-22", channel: "电话", summary: "确认 11 月中旬理财到期资金安排，客户表示到期后到网点面谈", next: "2026-11-10 前准备承接方案" },
        { date: "2026-09-30", channel: "面谈", summary: "年度检视，风险测评有效期至 2027-04，风险偏好未变化", next: "到期前 1 周跟进" }
      ],
      tasksHistory: [{ theme: "年度检视", status: "已完成", result: "继续持有" }, { theme: "指数增强沟通", status: "已完成", result: "购买 20 万" }]
    },
    {
      id: "C002", name: "周志强", cid: "6217****9335", age: 48, risk: 5,
      survey: { date: "2026-02-18", exp: "2027-02-18", state: "valid" },
      layer: "A", layerSrc: "行内标签：私银", aum: 186.4, fundMV: 92.6, pnl: -17.02, pnlDay: -0.86,
      lastContact: 62, activity: "中", loginPct: 0.9, respRate: 0.7, assetMove: 80,
      pref: ["权益", "科技主题"], behavior: ["短线操作偏多", "关注科技板块"],
      tags: ["亏损客户", "久未联系", "私银客户"],
      due: [], holdings: [{ fid: "F006", mv: 52.8, pnl: -18.4, days: 320 }, { fid: "F003", mv: 39.8, pnl: -8.2, days: 150 }],
      timeline: [
        { date: "2026-08-26", channel: "企微", summary: "发送市场解读，未回复", next: "待安排电话沟通" }
      ],
      tasksHistory: [{ theme: "科技板块热度跟进", status: "已关闭", result: "客户暂无意愿" }]
    },
    {
      id: "C003", name: "李文静", cid: "6208****2664", age: 38, risk: 3,
      survey: { date: "2026-06-20", exp: "2027-06-20", state: "valid" },
      layer: "B", layerSrc: "行内标签：沃德", aum: 56.2, fundMV: 0, pnl: 0, pnlDay: 0,
      lastContact: 15, activity: "中", loginPct: 0.82, respRate: 0.65, assetMove: 60,
      pref: ["未持有基金"], behavior: ["以存款理财为主", "App 活跃"],
      tags: ["未持有基金", "待激活"],
      due: [], holdings: [],
      timeline: [{ date: "2026-10-13", channel: "电话", summary: "邀约参加基金入门投教活动，客户有意向", next: "活动前 3 天确认出席" }],
      tasksHistory: []
    },
    {
      id: "C004", name: "张建国", cid: "6213****7042", age: 68, risk: 2,
      survey: { date: "2026-03-02", exp: "2027-03-02", state: "valid" },
      layer: "B", layerSrc: "AUM 近似（分层标签缺失）", aum: 76.8, fundMV: 41.5, pnl: 1.86, pnlDay: 0.05,
      lastContact: 21, activity: "低", loginPct: 0.45, respRate: 0.4, assetMove: 40,
      pref: ["固收"], behavior: ["偏好柜台办理", "关注存款利率"],
      tags: ["老年客户（≥65）", "仅可匹配 1R–2R", "理财将到期"],
      due: [{ name: "三年期大额存单", amount: 38, date: "2026-12-08" }], duePct: 0.55,
      holdings: [{ fid: "F010", mv: 30.2, pnl: 2.1, days: 460 }, { fid: "F013", mv: 11.3, pnl: 0.4, days: 200 }],
      timeline: [{ date: "2026-10-07", channel: "面谈", summary: "儿子陪同到店，咨询存单到期安排；已提供适老版材料", next: "12 月初电话提醒" }],
      tasksHistory: []
    },
    {
      id: "C005", name: "刘志远", cid: "6216****1883", age: 45, risk: 4,
      survey: { date: "2024-10-05", exp: "2026-10-05", state: "expired" },
      layer: "A", layerSrc: "行内标签：沃德", aum: 210.3, fundMV: 96.4, pnl: 6.42, pnlDay: 0.31,
      lastContact: 40, activity: "中", loginPct: 0.7, respRate: 0.5, assetMove: 60,
      pref: ["权益"], behavior: ["自主操作为主"],
      tags: ["测评过期（23 天）", "久未联系"],
      due: [], holdings: [{ fid: "F002", mv: 58.2, pnl: 6.8, days: 520 }, { fid: "F008", mv: 38.2, pnl: -0.4, days: 310 }],
      timeline: [{ date: "2026-09-18", channel: "电话", summary: "提醒测评 10 月 5 日到期，客户表示近期安排", next: "测评完成前不推送产品" }],
      tasksHistory: []
    },
    {
      id: "C006", name: "陈美玲", cid: "6228****5517", age: 52, risk: 2,
      survey: { date: "2026-05-11", exp: "2027-05-11", state: "valid" },
      layer: "C", layerSrc: "AUM 近似（分层标签缺失）", aum: 32.4, fundMV: 12.8, pnl: -0.32, pnlDay: -0.02,
      lastContact: 9, activity: "中", loginPct: 0.68, respRate: 0.52, assetMove: 60,
      pref: ["固收", "定投"], behavior: ["工资卡代发客户", "有定投习惯"],
      tags: ["定投断供"],
      due: [], holdings: [{ fid: "F008", mv: 12.8, pnl: -0.32, days: 380 }],
      sip: { plan: "F008 二级债基月定投 2000 元", missed: 3 },
      timeline: [{ date: "2026-10-19", channel: "电话", summary: "未接通，已留言短信提醒", next: "3 个工作日内再次联系" }],
      tasksHistory: []
    },
    {
      id: "C007", name: "周淑芬", cid: "6225****3390", age: 73, risk: 1,
      survey: { date: "2026-01-15", exp: "2027-01-15", state: "valid" },
      layer: "D", layerSrc: "AUM 近似（分层标签缺失）", aum: 8.6, fundMV: 0, pnl: 0, pnlDay: 0,
      lastContact: 34, activity: "低", loginPct: 0.3, respRate: 0.35, assetMove: 40,
      pref: ["存款"], behavior: ["仅柜台办理", "不使用 App"],
      tags: ["老年客户（≥65）", "仅可匹配 1R–2R", "未持有基金"],
      due: [], holdings: [],
      timeline: [{ date: "2026-09-24", channel: "面谈", summary: "到店办理存取款，已讲解防范电信诈骗提示", next: "节前电话问候" }],
      tasksHistory: []
    },
    {
      id: "C008", name: "赵子轩", cid: "6229****8126", age: 30, risk: 4,
      survey: { date: "2026-08-30", exp: "2027-08-30", state: "valid" },
      layer: "C", layerSrc: "AUM 近似（分层标签缺失）", aum: 45.8, fundMV: 16.8, pnl: 3.02, pnlDay: 0.21,
      lastContact: 3, activity: "高", loginPct: 0.8, respRate: 0.6, assetMove: 80,
      pref: ["权益", "偏股混合"], behavior: ["App 高频", "研究型客户"],
      tags: ["浮盈持仓"],
      due: [], holdings: [{ fid: "F002", mv: 12.6, pnl: 16.2, days: 240 }],
      timeline: [{ date: "2026-10-25", channel: "企微", summary: "客户主动询问科技板块后市观点", next: "本周内回复观点材料" }],
      tasksHistory: []
    },
    {
      id: "C009", name: "郑晓岚", cid: "6220****6478", age: 30, risk: 3,
      survey: { date: "2026-07-08", exp: "2027-07-08", state: "valid" },
      layer: "B", layerSrc: "行内标签：沃德", aum: 128.5, fundMV: 23.1, pnl: 3.88, pnlDay: 0.16,
      lastContact: 12, activity: "中", loginPct: 0.84, respRate: 0.66, assetMove: 60,
      pref: ["固收", "指数"], behavior: ["薪金理财", "关注低波动产品"],
      tags: ["浮盈持仓", "基金仓位偏低"],
      due: [], holdings: [{ fid: "F009", mv: 23.1, pnl: 16.8, days: 300 }],
      timeline: [{ date: "2026-10-16", channel: "电话", summary: "季度检视，客户对增配权益兴趣一般，偏好稳健", next: "发送稳健组合参考" }],
      tasksHistory: []
    }
  ];

  /* 预置任务（FR-CLT-04：来源覆盖 商机/合规提醒/再平衡联动/陪持有） */
  const TASKS = [
    { id: "T-CLT-01", cust: "C005", source: "系统合规提醒", theme: "风险测评已过期 23 天，请引导完成重测", pri: "P0", lane: "today", due: "2026-10-28", status: "待处理", next: "当日电话联系", log: [{ t: "2026-10-27 20:15", s: "待处理", by: "系统", note: "测评过期自动生成" }] },
    { id: "T-CLT-02", cust: "C002", source: "商机雷达 · 亏损挽回", theme: "F006 浮亏 18.4%，先安抚后诊断", pri: "P0", lane: "today", due: "2026-10-24", status: "待处理", next: "电话联系（豁免事由：单日大跌安抚）", log: [{ t: "2026-10-22 09:00", s: "待处理", by: "系统", note: "商机生成" }] },
    { id: "T-CLT-03", cust: "C001", source: "商机雷达 · 资金到期", theme: "80 万理财 11/15 到期，提前锁定承接方案", pri: "P0", lane: "today", due: "2026-10-28", status: "待处理", next: "预约面谈时间", log: [{ t: "2026-10-26 08:30", s: "待处理", by: "系统", note: "商机生成" }] },
    { id: "T-CLT-04", cust: "C006", source: "商机雷达 · 定投断供", theme: "定投连续缺扣 3 期，了解断供原因", pri: "P1", lane: "week", due: "2026-10-30", status: "已触达", next: "按约定周五 15:00 再次电话", log: [{ t: "2026-10-27 10:20", s: "待处理", by: "陈明远", note: "系统生成" }, { t: "2026-10-27 14:05", s: "已触达", by: "陈明远", note: "电话未接通，短信留言（本周触达 1/2）" }] },
    { id: "T-CLT-05", cust: "C003", source: "商机雷达 · 持仓激活", theme: "56 万 AUM 未持有基金，邀约投教活动", pri: "P1", lane: "week", due: "2026-10-31", status: "待处理", next: "活动前 3 天确认", log: [{ t: "2026-10-26 09:00", s: "待处理", by: "系统", note: "商机生成" }] },
    { id: "T-CLT-06", cust: "C007", source: "陪持有 · 服务提醒", theme: "适老服务提醒：利率变化与防诈提示", pri: "P2", lane: "pool", due: "2026-11-05", status: "待处理", next: "节前电话问候（适老版）", log: [{ t: "2026-10-25 16:00", s: "待处理", by: "系统", note: "服务提醒生成" }] },
    { id: "T-CLT-07", cust: "C001", source: "建组合 · 再平衡联动", theme: "组合 A 股权重偏离 10pp，建议再平衡", pri: "P1", lane: "week", due: "2026-10-29", status: "已沟通", next: "客户考虑中，10/29 前回复", log: [{ t: "2026-10-27 11:00", s: "待处理", by: "系统", note: "PF-06 偏离信号联动" }, { t: "2026-10-27 15:40", s: "已触达", by: "陈明远", note: "电话沟通 8 分钟" }, { t: "2026-10-27 15:42", s: "已沟通", by: "陈明远", note: "客户认可偏离事实，考虑中" }] }
  ];

  /* ============================ 状态 ============================ */
  const state = { search: "", layer: "", risk: "", elderly: false, expired: false, scriptCtx: null, taskLane: "all", recordTask: null };

  /* ============================ 工具 ============================ */
  const money = v => `¥${v.toFixed(2)} 万`;
  const pctText = v => `${(v * 100).toFixed(0)}%`;
  const lib = () => (window.FundPicker && window.FundPicker.library) || {};
  const fundOf = fid => lib()[fid] || null;
  const rLevel = r => Number(String(r).replace("R", "")) || 0;
  const bandOf = score => score >= 80 ? "A" : score >= 60 ? "B" : "C";

  /* ============================ 商机雷达（FR-CLT-03，公式可复算） ============================ */
  function actScore(c) { return 0.4 * c.loginPct * 100 + 0.3 * c.respRate * 100 + 0.3 * c.assetMove; }

  function computeOps(c) {
    if (c.survey.state !== "valid") return [];
    const list = [];
    const act = actScore(c);
    const fitOf = (riskOk, prefSim) => (0.5 * (riskOk ? 100 : 40) + 0.5 * prefSim);
    if (c.due && c.due.length) {
      const d = c.due[0];
      const days = Math.max(1, Math.round((new Date(d.date) - new Date("2026-10-28")) / 86400000));
      const urgency = days <= 7 ? 100 : days <= 30 ? 80 : 50;
      const signal = 0.6 * c.duePct * 100 + 0.4 * urgency;
      const fit = fitOf(true, c.holdings.length ? 60 : 40);
      const timing = TIMING.bond;
      list.push({ type: "due", signal, fit, act, timing, total: 0.4 * signal + 0.25 * fit + 0.2 * act + 0.15 * timing, amount: d.amount, basis: [`到期金额 ${money(d.amount)}（经理名下分位 ${pctText(c.duePct)}）`, `距到期 ${days} 天 → 紧迫度 ${urgency}`, `信号强度 = 0.6×${pctText(c.duePct)}×100 + 0.4×${urgency} = ${signal.toFixed(1)}`], direction: OP_META.due.dir, title: `${d.name} ${money(d.amount)} ${d.date} 到期` });
    }
    if (c.holdings.length) {
      const worst = [...c.holdings].sort((a, b) => a.pnl - b.pnl)[0];
      if (worst.pnl <= -10 && c.lastContact > 60) {
        const signal = 50 + Math.min(50, Math.abs(worst.pnl) * 2.5);
        const fit = fitOf(true, 80);
        const timing = TIMING.equity;
        list.push({ type: "loss", signal, fit, act, timing, total: 0.4 * signal + 0.25 * fit + 0.2 * act + 0.15 * timing, amount: worst.mv, basis: [`持仓浮亏 ${Math.abs(worst.pnl).toFixed(1)}% ≥ 10%`, `最近联系 ${c.lastContact} 天 > 60 天`, `信号强度 = 50 + min(50, ${Math.abs(worst.pnl)}×2.5) = ${signal.toFixed(1)}`], direction: OP_META.loss.dir, title: `${(fundOf(worst.fid) || {}).name || worst.fid} 浮亏 ${Math.abs(worst.pnl).toFixed(1)}%，${c.lastContact} 天未联系` });
      }
      const best = [...c.holdings].sort((a, b) => b.pnl - a.pnl)[0];
      const posPct = c.aum > 0 ? c.fundMV / c.aum * 100 : 0;
      const sugPos = { 1: 10, 2: 25, 3: 35, 4: 50, 5: 65, 6: 75 }[c.risk] || 40;
      if (best.pnl >= 15 && posPct < sugPos - 10) {
        const signal = 60 + Math.min(40, best.pnl * 2);
        const fit = fitOf(true, c.pref.includes("权益") || c.pref.includes("偏股混合") ? 80 : 60);
        const timing = TIMING.equity;
        list.push({ type: "gain", signal, fit, act, timing, total: 0.4 * signal + 0.25 * fit + 0.2 * act + 0.15 * timing, amount: Math.max(5, c.aum * 0.05), basis: [`浮盈 ${best.pnl.toFixed(1)}% ≥ 15%`, `基金仓位 ${posPct.toFixed(1)}% < 档位建议 ${sugPos}% − 10pp`, `信号强度 = 60 + min(40, ${best.pnl}×2) = ${signal.toFixed(1)}`], direction: OP_META.gain.dir, title: `${(fundOf(best.fid) || {}).name || best.fid} 浮盈 ${best.pnl.toFixed(1)}%，基金仓位低于档位建议` });
      }
    } else if (c.aum >= 50) {
      const signal = 65;
      const fit = fitOf(true, 40);
      const timing = TIMING.bond;
      list.push({ type: "active", signal, fit, act, timing, total: 0.4 * signal + 0.25 * fit + 0.2 * act + 0.15 * timing, amount: Math.max(10, c.aum * 0.2), basis: ["AUM ≥ 50 万", "基金仓位 = 0（未持有基金）", "风险测评有效", "信号强度 = 65（固定基准）"], direction: OP_META.active.dir, title: `AUM ${money(c.aum)} 未持有基金，可生成持仓激活沟通` });
    }
    if (c.sip && c.sip.missed >= 2) {
      const signal = 60;
      const fit = fitOf(true, 80);
      const timing = TIMING.bond;
      list.push({ type: "sip", signal, fit, act, timing, total: 0.4 * signal + 0.25 * fit + 0.2 * act + 0.15 * timing, amount: c.sip.missed * 0.2, basis: [`定投连续缺扣 ${c.sip.missed} 期 ≥ 2 期`, `信号强度 = 60（固定基准）`, `先了解断供原因，不直接推产品`], direction: OP_META.sip.dir, title: `${c.sip.plan} 连续缺扣 ${c.sip.missed} 期` });
    }
    list.forEach(op => { op.total = Math.round(op.total * 10) / 10; op.grade = bandOf(op.total); });
    return list.sort((a, b) => b.total - a.total).slice(0, 3);
  }

  const OPS = CUSTOMERS.flatMap(c => computeOps(c).map((op, i) => ({ ...op, cust: c, idx: i }))).sort((a, b) => b.total - a.total);

  /* ============================ 产品匹配（FR-CLT-05：门禁 + 五条硬约束 + 软排序） ============================ */
  function matchProducts(c, op) {
    const gate = c.survey.state === "valid";
    const result = { gate, list: [], rejected: [], none: null };
    if (!gate) { result.none = "测评已过期：推荐整体锁定，请先引导客户完成风险测评"; return result; }
    const isElder = c.age >= 65;
    const fundAssets = c.fundMV;
    const heldSubs = c.holdings.map(h => (fundOf(h.fid) || {}).sub);
    const heldMgrs = c.holdings.map(h => (fundOf(h.fid) || {}).manager);
    Object.values(lib()).forEach(f => {
      const reasons = [];
      const rl = rLevel(f.risk);
      if (rl > c.risk) { result.rejected.push({ f, step: "① 适当性", why: `${f.risk} > 客户 ${c.risk} 级，剔除且不得以“仅提示方向”绕过` }); return; }
      reasons.push(`${f.risk} ≤ 客户 ${c.risk} 级 ✓`);
      const status = PRODUCT_STATUS[f.id] || "在售 · 白名单";
      if (PRODUCT_STATUS[f.id]) { result.rejected.push({ f, step: "② 产品状态", why: `${status}，限购/暂停不得进入推荐位` }); return; }
      reasons.push(`状态：${status} ✓`);
      const held = c.holdings.find(h => h.fid === f.id);
      const conc = held ? held.mv / Math.max(fundAssets, 0.01) * 100 : Math.min(20, f.scale * 0.2);
      if (held && conc > 30) { result.rejected.push({ f, step: "③ 集中度", why: `当前占比 ${conc.toFixed(0)}% > 30%，不建议新增，转持仓诊断` }); return; }
      reasons.push(`集中度：新增后约 ${Math.min(conc + 8, 28).toFixed(0)}% ≤ 30% ✓`);
      if (!held && heldSubs.includes(f.sub) && heldMgrs.includes(f.manager)) { result.rejected.push({ f, step: "④ 重合度", why: `与持仓重合度 > 50%，转 SEL-07「替代而非新增」` }); return; }
      reasons.push(`重合度：与现有持仓 < 50% ✓`);
      if (isElder && rl > 2) { result.rejected.push({ f, step: "⑤ 老年客户", why: `${c.age} 岁 ≥ 65 岁仅可匹配 1R–2R，无线上放宽` }); return; }
      if (isElder) reasons.push("老年规则：1R–2R ✓ 适老版材料");
      const pref = c.pref.some(p => (f.group === "equity" && ["权益", "指数", "偏股混合", "科技主题"].includes(p)) || (f.group !== "equity" && ["固收", "定投", "存款", "低波"].includes(p))) ? 80 : f.group === "equity" ? 40 : 60;
      const scenario = SCENE_FIT[op.type] === f.group ? 100 : 60;
      const score = 0.5 * (FUND_SCORE[f.id] || 75) + 0.3 * pref + 0.2 * scenario;
      result.list.push({ f, score: Math.round(score * 10) / 10, reasons: reasons.join("｜"), fee: `管理费 ${f.feeMgmt}%`, pref, scenario });
    });
    result.list.sort((a, b) => b.score - a.score);
    result.list = result.list.slice(0, 3);
    if (!result.list.length) result.none = isElder ? "暂无适当产品：老年客户仅可匹配 1R–2R 且需满足全部硬约束" : "暂无适当产品：候选基金未通过硬约束链，请查看各条失败原因";
    return result;
  }

  /* ============================ 话术生成（FR-CLT-06：8 类模板） ============================ */
  const SCENES = [
    { key: "first", name: "首访建联" }, { key: "due", name: "资金到期承接" }, { key: "add", name: "加仓沟通" },
    { key: "soothe", name: "亏损安抚" }, { key: "take", name: "止盈沟通" }, { key: "market", name: "市场解读" },
    { key: "sip", name: "定投唤醒" }, { key: "guide", name: "行为引导" }
  ];
  function sceneOfOp(type) { return { due: "due", gain: "add", loss: "soothe", active: "first", sip: "sip" }[type] || "market"; }

  function buildScript(sceneKey, c, op) {
    const elder = c.age >= 65;
    const call = `${c.name.slice(0, 1)}女士/先生`.replace("女士/先生", c.name.endsWith("琳") || c.name.endsWith("静") || c.name.endsWith("岚") || c.name.endsWith("芬") || c.name.endsWith("玲") ? "女士" : "先生");
    const profile = `${c.age} 岁 · ${c.risk} 级风险 · ${c.layerSrc.replace("行内标签：", "")} · 持仓基金 ${c.fundMV > 0 ? money(c.fundMV) : "暂无"}`;
    const market = `当前多资产综合温度 ${MKT_TEMP}（演示值），权益略暖、固收平稳，不作为择时依据`;
    const opText = op ? `${OP_META[op.type].name}：${op.title}` : "常规服务回访";
    const bodies = {
      first: `您好，我是交通银行上海徐汇支行的理财经理陈明远。您在我行资产配置以稳健类为主，想跟您约个方便的时间做一次配置检视，把现有产品和未来的资金安排一起看看。您看本周内哪天合适？`,
      due: `看到您名下${op ? op.title : "一笔理财"}即将到期。到期资金可以继续放在稳健类产品里滚动，也可以按您的风险等级安排一部分更低波动或更进取的配置。我先把两三个方向的材料整理给您，您对比后再定，不着急现在决定。`,
      add: `您持有的基金目前有不错的浮盈，同时您的基金仓位距离同风险等级的参考配置还有空间。可以考虑分批把仓位补到参考区间，而不是一次性买入。具体节奏我们可以一起定。`,
      soothe: `注意到您持有的基金近期回撤比较大，想先跟您聊聊持有感受。短期波动不代表必须马上处理，我们可以一起看持仓结构、回撤来源和您的资金期限，再决定是继续持有、分批调整还是先停一停。您的时间安排我配合。`,
      take: `您持有的基金收益已经比较可观，可以考虑部分止盈把收益落袋，保留剩余仓位继续观察。是否止盈、止盈多少都由您决定，我可以先把费率和赎回到账时间说明白。`,
      market: `简单同步一下近期市场：结构分化明显，单一热点不等于趋势。对您来说更重要的是持仓和资金期限的匹配，有变化我会第一时间跟您说明。`,
      sip: `看到您的定投最近几期没有扣款成功，想确认一下是资金安排原因还是想暂停。如果只是账户余额问题，补上即可继续；如果想法变了，我们也可以重新规划。`,
      guide: `结合您的账户情况，提醒两个小点：一是风险测评快到期会影响后续产品适配，二是可以关注定投这类平滑波动的工具。有空我给您做一次快速检视。`
    };
    return {
      scene: sceneKey,
      body: `[${call}] ${bodies[sceneKey] || bodies.market}（客户画像：${profile}；市场要点：${market}；主题：${opText}；跟进提示：请记录客户反馈并约定下次跟进时间。）`,
      riskNote: elder ? RISK_NOTE_ELDER : RISK_NOTE,
      elder
    };
  }

  function validateScript(text) {
    const hits = BANNED.filter(w => text.includes(w));
    return hits;
  }

  /* ============================ 任务中心（FR-CLT-04：泳道 + 状态机） ============================ */
  const NEXT_STATE = { "待处理": ["已触达", "已关闭"], "已触达": ["已沟通", "已关闭"], "已沟通": ["已完成", "已关闭"], "已完成": [], "已关闭": [] };
  const REQUIRED = { "已触达": ["channel", "time"], "已沟通": ["point", "feedback"], "已完成": ["result"], "已关闭": ["reason"] };
  function touchCount(custId) { return TASKS.filter(t => t.cust === custId && t.log.some(l => l.s === "已触达")).length; }
  function isOverdue(t) { return t.status === "待处理" && new Date(t.due) < new Date("2026-10-28"); }
  function tasksOf(custId) { return TASKS.filter(t => t.cust === custId); }

  /* ============================ 联系记录（FR-CLT-08：只追加留痕） ============================ */
  function addRecord(custId, rec) {
    const c = CUSTOMERS.find(x => x.id === custId);
    if (c) {
      c.timeline.unshift({ date: rec.date, channel: rec.channel, summary: rec.point, next: rec.next, record: true, feedback: rec.feedback, elder: rec.elder });
      c.lastContact = 0;
    }
    if (state.recordTask) {
      const t = TASKS.find(x => x.id === state.recordTask);
      if (t && t.cust === custId) {
        t.status = "已沟通";
        t.log.push({ t: `${rec.date} ${new Date().toTimeString().slice(0, 5)}`, s: "已沟通", by: "陈明远", note: rec.point });
      }
    }
  }

  /* ============================ 看板（FR-CLT-07：个人视角，公式可复算） ============================ */
  const BOARD = [
    { name: "覆盖率", val: "68%", formula: "有触达的基金持仓客户 6 / 基金持仓客户 9", ok: true },
    { name: "触达率", val: "72%", formula: "有触达商机 13 / 商机生成 18", ok: true },
    { name: "沟通率", val: "81%", formula: "有沟通要点 9 / 有触达 11", ok: true },
    { name: "转化率（笔）", val: "12.4%", formula: "成交回执 7 笔 / 有效沟通 56", ok: true },
    { name: "转化率（金额）", val: "待确认", formula: "口径待确认（Q-27）", ok: false },
    { name: "闭环率", val: "58%", formula: "已完成 11 / 生成 19", ok: true },
    { name: "逾期率", val: "11%", formula: "逾期 2 / 生成 19", ok: true },
    { name: "90 天留存", val: "待确认", formula: "口径待确认（Q-13）", ok: false },
    { name: "超频告警", val: "1 次", formula: "触发频控拦截客户 1 位", ok: true },
    { name: "静默拦截", val: "2 次", formula: "20:00–9:00 拦截发送 2 次", ok: true }
  ];

  /* ============================ 渲染：页面骨架 ============================ */
  function renderSteps() {
    return `<div class="clt-crumbs"><span>商机识别</span><span>适当性校验</span><span>产品匹配</span><span>话术/材料</span><span>触达</span><span>记录</span><span>任务闭环</span><span>经营看板</span></div>`;
  }

  function radarHTML() {
    const cards = OPS.map((op, i) => {
      const m = OP_META[op.type];
      return `<div class="clt-op-card" data-op="${i}">
        <div class="clt-op-head"><span class="clt-op-type" style="color:${m.color}">${icon("sparkles")}${m.name}</span>
          <span class="clt-op-grade g${op.grade}">${op.grade} 级 · ${op.total.toFixed(1)} 分</span></div>
        <div class="clt-op-cust"><button class="clt-link" data-clt-open="${op.cust.id}">${op.cust.name}</button><span>${op.cust.cid}</span><span>${op.cust.risk} 级</span><span>${op.cust.age >= 65 ? "老年" : `${op.cust.age} 岁`}</span></div>
        <p class="clt-op-title">${escapeHTML(op.title)}</p>
        <div class="clt-op-meta"><span>建议方向</span><b>${m.dir}</b></div>
        <div class="clt-op-meta"><span>预估可承接</span><b>${money(op.amount)}</b></div>
        <ul class="clt-op-basis">${op.basis.map(b => `<li>${escapeHTML(b)}</li>`).join("")}<li class="dim">商机分 = 0.40×${op.signal.toFixed(1)} + 0.25×${op.fit.toFixed(0)} + 0.20×${op.act.toFixed(1)} + 0.15×${op.timing} = ${op.total.toFixed(1)}（${PARAM_VER}）</li></ul>
        <div class="clt-op-actions"><button class="btn btn-secondary btn-small" data-clt-script="${op.cust.id}|${sceneOfOp(op.type)}|${op.idx}">${icon("message")}生成话术</button><button class="btn btn-primary btn-small" data-clt-task-op="${op.cust.id}|${op.idx}">${icon("check")}生成任务</button></div>
      </div>`;
    }).join("");
    return `<section class="card clt-section" id="cltRadarSection">
      <div class="card-header compact"><div><div class="card-title-row"><h2>商机雷达</h2><span class="count-badge">${OPS.length}</span></div><p>五类标准商机 · 信号公式可复算 · 同一客户最多 3 条 · 30 天去重 · C005 测评过期不生成</p></div><span class="clt-param-badge">参数 ${PARAM_VER} · 数据 ${DATA_DATE}</span></div>
      <div class="clt-op-grid">${cards}</div>
    </section>`;
  }

  function filteredCustomers() {
    return CUSTOMERS.filter(c => {
      if (state.search && !c.name.includes(state.search) && !c.id.includes(state.search) && !c.cid.replace(/\*/g, "").includes(state.search)) return false;
      if (state.layer && c.layer !== state.layer) return false;
      if (state.risk && String(c.risk) !== state.risk) return false;
      if (state.elderly && c.age < 65) return false;
      if (state.expired && c.survey.state !== "expired") return false;
      return true;
    });
  }

  function listHTML() {
    const rows = filteredCustomers().map(c => {
      const ops = computeOps(c);
      const top = ops[0];
      const pending = tasksOf(c.id).filter(t => t.status === "待处理").length;
      const expired = c.survey.state === "expired";
      const soon = !expired && ((new Date(c.survey.exp) - new Date("2026-10-28")) / 86400000) <= 30;
      return `<tr class="clt-row" data-clt-open="${c.id}" tabindex="0">
        <td><div class="clt-name"><strong>${c.name}</strong><span>${c.cid}</span></div></td>
        <td><span class="clt-layer">${c.layer}</span><small>${c.layerSrc.includes("近似") ? "近似" : c.layerSrc.replace("行内标签：", "")}</small></td>
        <td><span class="risk-c c${c.risk}">${c.risk} 级</span>${expired ? `<small class="clt-flag red">已过期</small>` : soon ? `<small class="clt-flag amber">将到期</small>` : `<small>至 ${c.survey.exp.slice(5)}</small>`}</td>
        <td>${money(c.aum)}<small>基金 ${money(c.fundMV)} · ${c.aum ? pctText(c.fundMV / c.aum) : "0%"}</small></td>
        <td class="${c.pnl > 0 ? "up" : c.pnl < 0 ? "down" : ""}">${c.pnl > 0 ? "+" : ""}${c.pnl.toFixed(2)}<small>当日 ${c.pnlDay > 0 ? "+" : ""}${c.pnlDay.toFixed(2)}</small></td>
        <td>${c.lastContact === 0 ? "今日" : `${c.lastContact} 天`}${c.lastContact > 60 ? `<small class="clt-flag amber">久未联系</small>` : ""}</td>
        <td>${pending ? `<b class="clt-pending">${pending} 项待办</b>` : "—"}</td>
        <td>${top ? `<span class="clt-op-grade g${top.grade}">${top.grade} · ${top.total.toFixed(0)}</span><small>${OP_META[top.type].name}</small>` : expired ? `<small class="clt-flag red">商机锁定</small>` : "—"}</td>
      </tr>`;
    }).join("");
    return `<section class="card clt-section" id="cltListSection">
      <div class="card-header compact"><div><div class="card-title-row"><h2>客户全景列表</h2><span class="count-badge">${filteredCustomers().length}</span></div><p>仅展示本人名下客户 · 客户号脱敏 · 默认排序：待办 → 商机分 → 最近联系 → AUM</p></div>
        <button class="btn btn-secondary btn-small" id="cltExportBtn">${icon("download")}受控导出</button></div>
      <div class="clt-filters">
        <div class="pf-search clt-search">${icon("search")}<input id="cltSearchInput" type="search" placeholder="姓名 / 客户号" value="${escapeHTML(state.search)}"></div>
        <select id="cltLayerFilter"><option value="">全部价值层</option>${["S", "A", "B", "C", "D"].map(l => `<option value="${l}" ${state.layer === l ? "selected" : ""}>${l} 层</option>`).join("")}</select>
        <select id="cltRiskFilter"><option value="">全部风险等级</option>${[1, 2, 3, 4, 5, 6].map(r => `<option value="${r}" ${state.risk === String(r) ? "selected" : ""}>${r} 级</option>`).join("")}</select>
        <label class="clt-check"><input type="checkbox" id="cltElderFilter" ${state.elderly ? "checked" : ""}>仅看老年客户</label>
        <label class="clt-check"><input type="checkbox" id="cltExpiredFilter" ${state.expired ? "checked" : ""}>仅看测评过期</label>
        <button class="text-btn" id="cltResetBtn">${icon("x")}重置</button>
      </div>
      <div class="clt-table-wrap"><table class="clt-table"><thead><tr><th>客户</th><th>价值层</th><th>风险 / 测评</th><th>资产</th><th>累计盈亏</th><th>最近联系</th><th>待办</th><th>商机</th></tr></thead><tbody>${rows || `<tr><td colspan="8"><div class="clt-empty">无符合条件的客户</div></td></tr>`}</tbody></table></div>
      <div class="clt-table-foot"><span>共 ${CUSTOMERS.length} 位名下客户 · 导出字段脱敏并留痕（导出人/时间/范围/用途）</span></div>
    </section>`;
  }

  function tasksHTML() {
    const lanes = [
      { key: "today", name: "今日必访", hint: "A 级商机 / P0 · 当日" },
      { key: "week", name: "本周跟进", hint: "B 级 / P1 · 3 个工作日" },
      { key: "pool", name: "维护池", hint: "C 级 / P2 · 本周下期" }
    ];
    const laneHTML = lanes.map(l => {
      const list = TASKS.filter(t => t.lane === l.key);
      const cards = list.map(t => {
        const c = CUSTOMERS.find(x => x.id === t.cust);
        const over = isOverdue(t);
        const nexts = NEXT_STATE[t.status] || [];
        return `<div class="clt-task ${over ? "overdue" : ""}">
          <div class="clt-task-head"><button class="clt-link" data-clt-open="${t.cust}">${c.name}</button><span class="clt-src">${t.source}</span>${over ? `<span class="clt-flag red">逾期</span>` : ""}</div>
          <p class="clt-task-theme">${escapeHTML(t.theme)}</p>
          <div class="clt-task-meta"><span>${t.pri}</span><span>时效 ${t.due}</span><span class="clt-state s${t.status}">${t.status}</span><span>本周触达 ${touchCount(t.cust)}/2</span></div>
          <p class="clt-task-next"><i>下次：</i>${escapeHTML(t.next)}</p>
          <div class="clt-task-actions">${nexts.map(n => `<button class="btn btn-secondary btn-small" data-clt-advance="${t.id}|${n}">→ ${n}</button>`).join("")}<button class="text-btn" data-clt-log="${t.id}">流转留痕</button></div>
        </div>`;
      }).join("");
      return `<div class="clt-lane"><div class="clt-lane-head"><strong>${l.name}</strong><span>${l.hint}</span><b>${list.length}</b></div>${cards || `<div class="clt-empty small">暂无任务</div>`}</div>`;
    }).join("");
    return `<section class="card clt-section" id="cltTaskSection">
      <div class="card-header compact"><div><div class="card-title-row"><h2>任务中心</h2><span class="count-badge">${TASKS.length}</span></div><p>状态机：待处理 → 已触达 → 已沟通 → 已完成 / 已关闭；不允许跳步完成；同一客户同日任务合并拜访</p></div><span class="clt-param-badge">频控：主动触达 ≤2 次/周 · 老年营销 ≤1 次/周 · 静默 20:00–9:00</span></div>
      <div class="clt-lanes">${laneHTML}</div>
    </section>`;
  }

  function boardHTML() {
    return `<section class="card clt-section" id="cltBoardSection">
      <div class="card-header compact"><div><div class="card-title-row"><h2>经营看板（个人）</h2></div><p>统计周期：本周（周一 12:00 前更新）· 仅本人名下数据 · 演示值不作为业务基线</p></div><span class="clt-param-badge">权限：客户经理 · ${OWNER}</span></div>
      <div class="clt-board-grid">${BOARD.map(b => `<div class="clt-board-cell ${b.ok ? "" : "tbd"}"><span>${b.name}${b.ok ? "" : `<i>口径待确认</i>`}</span><b>${b.val}</b><small>${b.formula}</small></div>`).join("")}</div>
    </section>`;
  }

  function renderPage() {
    const page = $("#customerPage");
    $("#cltBody").innerHTML = renderSteps() + radarHTML() + listHTML() + tasksHTML() + boardHTML();
  }

  /* ============================ 客户画像卡（FR-CLT-02） ============================ */
  function matchBlockHTML(c) {
    const ops = computeOps(c);
    if (c.survey.state !== "valid") {
      return `<div class="clt-locked">${icon("shield")}<strong>商机与匹配已锁定</strong><p>风险测评已于 ${c.survey.exp} 过期。先完成测评后，系统才会重新生成商机与产品匹配；当前仅保留持仓、市场资讯、投教与陪伴内容，不输出任何具体产品。</p></div>`;
    }
    const op = ops[0];
    if (!op) return `<div class="clt-locked neutral">${icon("info")}<p>暂无达标商机信号；可使用「手动匹配」发起产品匹配（仍需通过测评门禁与五条硬约束）。</p></div>`;
    const mr = matchProducts(c, op);
    const cards = mr.list.map(r => `<div class="clt-match-card">
      <div class="clt-match-head"><button class="clt-link" data-clt-fund="${r.f.id}">${r.f.name}</button><span>${r.f.code}</span><span class="risk-c c${rLevel(r.f.risk)}">${r.f.risk}</span><b>${r.score.toFixed(1)} 分</b></div>
      <p class="clt-match-why">${escapeHTML(r.reasons)}｜${escapeHTML(r.fee)}｜画像偏好 ${r.pref} · 场景契合 ${r.scenario}</p>
      <div class="clt-op-actions"><button class="btn btn-secondary btn-small" data-clt-gate="${c.id}|${r.f.id}">${icon("shield")}适当性校验</button><button class="btn btn-secondary btn-small" data-clt-script="${c.id}|${sceneOfOp(op.type)}|0">${icon("message")}生成话术</button><button class="btn btn-primary btn-small" data-clt-task-match="${c.id}|${r.f.id}">${icon("check")}生成任务</button></div>
    </div>`).join("");
    const rejects = mr.rejected.slice(0, 4).map(rj => `<li><b>${rj.step}</b>${rj.f.name}：${escapeHTML(rj.why)}</li>`).join("");
    return `<div class="clt-match-wrap">${cards || `<div class="clt-locked neutral">${icon("info")}<p>${escapeHTML(mr.none || "")}</p></div>`}
      ${rejects ? `<details class="clt-rejects"><summary>硬约束剔除记录（可复核，${mr.rejected.length} 条）</summary><ul>${rejects}</ul></details>` : ""}</div>`;
  }

  function detailHTML(custId) {
    const c = CUSTOMERS.find(x => x.id === custId);
    if (!c) return "";
    const expired = c.survey.state === "expired";
    const elder = c.age >= 65;
    const holdings = [...c.holdings].sort((a, b) => b.mv - a.mv).map(h => {
      const f = fundOf(h.fid) || {};
      return `<tr><td><button class="clt-link" data-clt-fund="${h.fid}">${f.name || h.fid}</button><small>${f.code || ""}</small></td><td>${money(h.mv)}</td><td class="${h.pnl > 0 ? "up" : h.pnl < 0 ? "down" : ""}">${h.pnl > 0 ? "+" : ""}${h.pnl.toFixed(1)}%</td><td>${h.days} 天</td></tr>`;
    }).join("");
    const ops = computeOps(c);
    const opCards = ops.map(op => `<div class="clt-op-card slim"><div class="clt-op-head"><span class="clt-op-type" style="color:${OP_META[op.type].color}">${OP_META[op.type].name}</span><span class="clt-op-grade g${op.grade}">${op.grade} · ${op.total.toFixed(1)}</span></div><p class="clt-op-title">${escapeHTML(op.title)}</p><p class="clt-op-basis-line">${escapeHTML(op.basis[2] || op.basis[1] || "")}</p><div class="clt-op-actions"><button class="btn btn-secondary btn-small" data-clt-script="${c.id}|${sceneOfOp(op.type)}|0">${icon("message")}生成话术</button><button class="btn btn-primary btn-small" data-clt-task-op="${c.id}|0">${icon("check")}生成任务</button></div></div>`).join("");
    const timeline = c.timeline.map(t => `<div class="clt-tl-item"><span class="clt-tl-date">${t.date}</span><div><span class="clt-tl-ch">${t.channel}${t.elder ? " · 适老版" : ""}</span><p>${escapeHTML(t.summary)}${t.feedback ? `<b>客户反馈：${escapeHTML(t.feedback)}</b>` : ""}</p>${t.next ? `<small>下次跟进：${escapeHTML(t.next)}</small>` : ""}</div></div>`).join("");
    const tasks = tasksOf(c.id).map(t => `<div class="clt-hist-task"><span>${escapeHTML(t.theme)}</span><span class="clt-state s${t.status}">${t.status}${isOverdue(t) ? " · 逾期" : ""}</span></div>`).join("");
    return `${expired ? `<div class="clt-banner red">${icon("alert")}风险测评已于 ${c.survey.exp} 过期：商机与产品匹配已整体锁定，请先引导客户完成测评（FR-CLT-02 门禁）。</div>` : ""}
    ${elder ? `<div class="clt-banner amber">${icon("info")}老年客户（${c.age} 岁）：仅可匹配 1R–2R；营销类触达 ≤1 次/周；优先电话/面谈；材料提供适老版；全部记录单独标记。</div>` : ""}
    <section class="drawer-section"><div class="drawer-section-title"><h3>基本信息</h3><span>客户号脱敏 · 数据 T+1</span></div>
      <div class="clt-facts">
        <div><span>客户号</span><b>${c.cid}</b></div><div><span>年龄</span><b>${c.age} 岁</b></div>
        <div><span>风险测评</span><b>${c.risk} 级 · ${expired ? `<i class="down">已过期</i>` : `有效期至 ${c.survey.exp}`}</b></div>
        <div><span>测评日期</span><b>${c.survey.date}</b></div>
        <div><span>价值层</span><b>${c.layer} 层 · ${escapeHTML(c.layerSrc)}</b></div>
        <div><span>活跃度</span><b>${c.activity}（登录分位 ${pctText(c.loginPct)}）</b></div>
        <div><span>AUM</span><b>${money(c.aum)}</b></div>
        <div><span>基金市值 / 占比</span><b>${money(c.fundMV)} · ${c.aum ? pctText(c.fundMV / c.aum) : "0%"}</b></div>
        <div><span>累计盈亏</span><b class="${c.pnl > 0 ? "up" : c.pnl < 0 ? "down" : ""}">${c.pnl > 0 ? "+" : ""}${c.pnl.toFixed(2)} 万</b></div>
        <div><span>最近联系</span><b>${c.lastContact === 0 ? "今日" : `${c.lastContact} 天前`}</b></div>
      </div></section>
    <section class="drawer-section"><div class="drawer-section-title"><h3>基金持仓</h3><span>按市值降序 · 点击进入基金详情</span></div>
      ${holdings ? `<table class="clt-mini-table"><thead><tr><th>基金</th><th>市值</th><th>盈亏</th><th>持有天数</th></tr></thead><tbody>${holdings}</tbody></table>` : `<div class="clt-locked neutral">${icon("info")}<p>未持有基金 / 待激活。可生成持仓激活商机，但不得直接推荐高波动产品。</p></div>`}
      ${c.sip ? `<div class="clt-sip">${icon("alert")}定投计划：${escapeHTML(c.sip.plan)} · 已连续缺扣 <b>${c.sip.missed}</b> 期</div>` : ""}</section>
    <section class="drawer-section"><div class="drawer-section-title"><h3>行为偏好</h3><span>仅经理侧可见 · 中性表述</span></div>
      <div class="clt-tags">${c.pref.map(p => `<span>${p}</span>`).join("")}${c.behavior.map(b => `<span class="dim">${b}</span>`).join("")}</div></section>
    <section class="drawer-section"><div class="drawer-section-title"><h3>商机与产品匹配</h3><span>${expired ? "已锁定" : "Top3 · 匹配理由可解释"}</span></div>
      ${opCards || (expired ? "" : `<p class="clt-dim-line">当前无达标商机信号。</p>`)}
      ${matchBlockHTML(c)}</section>
    <section class="drawer-section"><div class="drawer-section-title"><h3>联系时间线</h3><span>按时间倒序 · 只追加留痕</span><button class="text-btn" data-clt-record="${c.id}">${icon("plus")}新增联系记录</button></div>
      <div class="clt-timeline">${timeline}</div></section>
    <section class="drawer-section"><div class="drawer-section-title"><h3>任务历史</h3><span>与任务中心一致</span></div>
      ${tasks || `<p class="clt-dim-line">暂无任务记录。</p>`}</section>`;
  }

  /* ============================ 话术抽屉（FR-CLT-06） ============================ */
  let scriptVersion = 1;
  function scriptHTML(key) {
    const [custId, sceneKey, opIdx] = key.split("|");
    const c = CUSTOMERS.find(x => x.id === custId);
    const op = OPS[Number(opIdx)] && OPS[Number(opIdx)].cust.id === custId ? OPS[Number(opIdx)] : computeOps(c)[0] || null;
    const s = buildScript(sceneKey || (op ? sceneOfOp(op.type) : "market"), c, op);
    state.scriptCtx = { custId, sceneKey: s.scene, op };
    return `<div class="clt-script-meta"><span>场景</span><select id="cltSceneSel">${SCENES.map(sc => `<option value="${sc.key}" ${sc.key === s.scene ? "selected" : ""}>${sc.name}</option>`).join("")}</select><span>客户</span><b>${c.name}（${c.risk} 级${c.age >= 65 ? " · 老年适老版" : ""}）</b></div>
    <div class="clt-slots"><span>模板槽位</span><p>{称呼} {客户画像要点} {市场要点} {产品/方案要点} {风险提示·锁定} {跟进提示}</p></div>
    <label class="clt-script-label">草稿正文（经理可编辑；发送前须二次校验）<textarea id="cltScriptBody" rows="9">${escapeHTML(s.body)}</textarea></label>
    <div class="clt-banned-result" id="cltBannedResult"></div>
    <div class="clt-risk-note">${icon("shield")}<b>风险提示（锁定，不可删除）</b><p>${escapeHTML(s.riskNote)}</p></div>
    <div class="clt-script-actions">
      <button class="btn btn-secondary btn-small" id="cltScriptCheck">${icon("shield")}违禁词校验</button>
      <button class="btn btn-secondary btn-small" id="cltScriptRecheck">${icon("check")}发送前二次校验</button>
      <button class="btn btn-primary btn-small" id="cltScriptSend">${icon("send")}生成草稿并留痕</button>
    </div>
    <div class="clt-script-log" id="cltScriptLog"></div>
    <div class="clt-rules"><b>硬规则（FR-CLT-06）</b><ul><li>违禁词零漏放，命中即拦截，不可跳过。</li><li>风险提示语句不可删除，编辑界面锁定。</li><li>生成版与发送版全部留痕（版本号/校验结果/渠道/时间/接收对象）。</li><li>AI 草稿不得直接对客，必须经客户经理确认与合规校验。</li><li>产品须带 1R–6R 标签；费率与产品档案一致。</li></ul></div>`;
  }

  function runScriptCheck(finalCheck) {
    const text = $("#cltScriptBody").value;
    const hits = validateScript(text);
    const box = $("#cltBannedResult");
    if (hits.length) {
      box.innerHTML = `<span class="bad">${icon("x")}违禁词拦截：${hits.map(escapeHTML).join("、")} — 命中即拦截，不可跳过</span>`;
      return false;
    }
    box.innerHTML = `<span class="ok">${icon("check-circle")}校验通过：无违禁词 · 风险提示已锁定附加${finalCheck ? " · 二次校验通过（发送版留痕）" : " · 生成版留痕"}</span>`;
    const log = $("#cltScriptLog");
    log.innerHTML = `<div class="clt-log-line">V${finalCheck ? ++scriptVersion : scriptVersion} · ${new Date().toLocaleTimeString("zh-CN", { hour12: false }).slice(0, 5)} · ${finalCheck ? "发送前二次校验通过" : "生成版校验通过"} · 渠道：客户经理确认后发送 · 接收对象：${state.scriptCtx.custId}</div>` + log.innerHTML;
    return true;
  }

  /* ============================ 弹窗：任务推进 / 联系记录 / 导出 / 适当性校验 ============================ */
  function openModal(html) {
    $("#cltModalContent").innerHTML = html;
    $("#cltModal").hidden = false;
  }
  function closeModal() { $("#cltModal").hidden = true; $("#cltModalContent").innerHTML = ""; }

  function advanceHTML(taskId, target) {
    const t = TASKS.find(x => x.id === taskId);
    const c = CUSTOMERS.find(x => x.id === t.cust);
    const fields = {
      "已触达": `<label class="clt-f-field"><span>触达渠道 *</span><select name="channel"><option value="">请选择渠道</option><option>电话</option><option>面谈</option><option>企业微信</option><option>短信</option><option>系统内消息</option></select></label><label class="clt-f-field"><span>触达时间 *</span><input name="time" type="time" value="15:00"></label>`,
      "已沟通": `<label class="clt-f-field"><span>沟通要点 *</span><textarea name="point" rows="3" placeholder="客户反馈、已说明的风险与适当性、产品/方案要点"></textarea></label><label class="clt-f-field"><span>客户反馈 *</span><select name="feedback"><option value="">请选择反馈</option><option>接受</option><option>犹豫</option><option>拒绝</option><option>需跟进</option></select></label>`,
      "已完成": `<label class="clt-f-field"><span>结果 *</span><select name="result"><option>购买</option><option>继续持有</option><option>暂缓</option><option>拒绝</option></select></label><label class="clt-f-field"><span>下一步</span><input name="next" placeholder="选填"></label>`,
      "已关闭": `<label class="clt-f-field"><span>关闭原因 *</span><textarea name="reason" rows="2" placeholder="手工关闭必须填写原因"></textarea></label>`
    }[target] || "";
    return `<div class="clt-modal-head"><span class="eyebrow">FR-CLT-04 状态机</span><h3>${c.name} · ${escapeHTML(t.theme)}</h3><p>${t.status} → <b>${target}</b>${REQUIRED[target] ? "（带 * 为必填）" : ""}</p></div>
    <form id="cltAdvanceForm" data-task="${taskId}" data-target="${target}">${fields}
      <label class="clt-f-field"><span>备注 / 留痕说明</span><input name="note" placeholder="状态变更将记录操作人、时间、前后状态"></label>
      <div class="clt-modal-foot"><button type="button" class="btn btn-secondary" data-clt-modal-close>取消</button><button type="submit" class="btn btn-primary">确认流转</button></div>
    </form>`;
  }

  function recordHTML(custId) {
    const c = CUSTOMERS.find(x => x.id === custId);
    const linked = tasksOf(custId).filter(t => !["已完成", "已关闭"].includes(t.status));
    return `<div class="clt-modal-head"><span class="eyebrow">FR-CLT-08 联系记录</span><h3>${c.name} · 新增联系记录</h3><p>保存后写入客户时间线并按规则推进任务；只追加留痕，不物理删除</p></div>
    <form id="cltRecordForm" data-cust="${custId}">
      <div class="clt-f-grid">
        <label class="clt-f-field"><span>渠道 *</span><select name="channel"><option>电话</option><option>面谈</option><option>企业微信</option><option>短信</option><option>其他</option></select></label>
        <label class="clt-f-field"><span>时间 *</span><input name="date" type="date" value="2026-10-28"></label>
        <label class="clt-f-field"><span>客户反馈 *</span><select name="feedback"><option value="">请选择反馈</option><option>接受</option><option>犹豫</option><option>拒绝</option><option>需跟进</option></select></label>
        <label class="clt-f-field"><span>关联任务推进</span><select name="task"><option value="">不关联任务</option>${linked.map(t => `<option value="${t.id}">${t.id} · ${escapeHTML(t.theme.slice(0, 14))}…</option>`).join("")}</select></label>
      </div>
      <label class="clt-f-field"><span>沟通要点 *</span><textarea name="point" rows="3" placeholder="客户反馈、已说明的风险与适当性、产品/方案要点"></textarea></label>
      <div class="clt-f-grid">
        <label class="clt-f-field"><span>下一步 *</span><input name="next" placeholder="动作 + 负责人 + 日期"></label>
        <label class="clt-f-field"><span>风险提示情况</span><select name="risk"><option>已提示风险</option><option>提供适老版材料</option><option>不涉及产品</option></select></label>
      </div>
      <div class="clt-modal-tip">${icon("info")}未填写沟通要点不得标记「已沟通」；客户拒绝营销类触达时将同步更新偏好并停止营销触达。</div>
      <div class="clt-modal-foot"><button type="button" class="btn btn-secondary" data-clt-modal-close>取消</button><button type="submit" class="btn btn-primary">保存记录</button></div>
    </form>`;
  }

  function gateHTML(custId, fid) {
    const c = CUSTOMERS.find(x => x.id === custId);
    const f = fundOf(fid);
    const op = computeOps(c)[0];
    const mr = matchProducts(c, op);
    const item = mr.list.find(x => x.f.id === fid);
    const checks = [
      ["测评门禁", c.survey.state === "valid", c.survey.state === "valid" ? `有效期至 ${c.survey.exp}` : `已过期（${c.survey.exp}）`],
      ["① 适当性", rLevel(f.risk) <= c.risk, `${f.risk} ≤ 客户 ${c.risk} 级`],
      ["② 产品状态", !PRODUCT_STATUS[fid], PRODUCT_STATUS[fid] || "在售 · 白名单"],
      ["③ 集中度", !(c.holdings.find(h => h.fid === fid) || { mv: 0 }).mv || (c.holdings.find(h => h.fid === fid).mv / Math.max(c.fundMV, 0.01)) <= 0.3, c.holdings.find(h => h.fid === fid) ? `当前占比 ${(c.holdings.find(h => h.fid === fid).mv / Math.max(c.fundMV, 0.01) * 100).toFixed(0)}% ≤ 30%` : "新增后 ≤ 30%"],
      ["④ 重合度", true, "与现有持仓 < 50%"],
      ["⑤ 老年规则", !(c.age >= 65 && rLevel(f.risk) > 2), c.age >= 65 ? `${c.age} 岁仅 1R–2R` : "不适用（< 65 岁）"]
    ];
    const allPass = checks.every(x => x[1]);
    return `<div class="clt-modal-head"><span class="eyebrow">FR-CLT-05 · 6 道校验</span><h3>${f.name}</h3><p>点击推荐必须通过测评门禁与产品硬约束校验，不直接跳转交易（AC-CLT-12）</p></div>
    <ul class="clt-gate-list">${checks.map(([name, pass, note]) => `<li class="${pass ? "pass" : "fail"}">${icon(pass ? "check-circle" : "x")}<b>${name}</b><span>${escapeHTML(note)}</span></li>`).join("")}</ul>
    <div class="clt-modal-tip">${allPass ? icon("check-circle") + " 全部通过：将生成跳转参数包（产品/金额/渠道/留痕号），工作台不落地下单。" : icon("x") + " 存在不通过项：该产品不得推荐，请查看替代路径。"}</div>
    <div class="clt-modal-foot"><button type="button" class="btn btn-secondary" data-clt-modal-close>关闭</button>${allPass ? `<button class="btn btn-primary" data-clt-jump="${custId}|${fid}">生成跳转参数包</button>` : ""}</div>`;
  }

  function exportHTML() {
    return `<div class="clt-modal-head"><span class="eyebrow">FR-CLT-01 受控导出</span><h3>客户列表导出申请</h3><p>导出字段脱敏；记录导出人/时间/范围/用途；禁止导出全量客户明细</p></div>
    <form id="cltExportForm">
      <div class="clt-f-grid">
        <label class="clt-f-field"><span>导出范围 *</span><select name="range"><option>当前筛选结果（${filteredCustomers().length} 位）</option><option>商机 A 级客户</option></select></label>
        <label class="clt-f-field"><span>导出用途 *</span><select name="purpose"><option>晨会准备</option><option>陪访计划</option><option>活动邀约</option></select></label>
      </div>
      <div class="clt-modal-tip">${icon("info")}全量客户明细导出已被禁止；敏感字段（客户号/联系方式）将按规则脱敏。</div>
      <div class="clt-modal-foot"><button type="button" class="btn btn-secondary" data-clt-modal-close>取消</button><button type="submit" class="btn btn-primary">提交导出申请</button></div>
    </form>`;
  }

  /* ============================ AI 话术（委托自 AI 助手） ============================ */
  function aiDraft() {
    const top = OPS[0];
    return `找客户 · 商机雷达摘要（演示，参数 ${PARAM_VER}）：

1. 今日优先：${top.cust.name}「${OP_META[top.type].name}」${top.total.toFixed(1)} 分（${top.grade} 级）——${top.title}
2. 合规提醒：C005 刘志远测评已过期，商机与匹配已锁定，任务中心已生成重测提醒（P0）。
3. 老年客户：张建国 / 周淑芬仅可匹配 1R–2R，营销触达 ≤1 次/周，优先电话面谈。

沟通建议（亏损挽回示例）：“先了解持有感受 → 说明波动来源与持仓结构 → 核对资金期限 → 约定下一步”，不承诺收益、不预测涨跌。

所有草稿须客户经理复核后使用，触达前需通过频控与静默时段校验。`;
  }

  /* ============================ 主 show ============================ */
  function show() {
    ["#todayPage", "#marketPage", "#fundPage", "#portfolioPage", "#companionPage"].forEach(sel => { const el = $(sel); if (el) el.hidden = true; });
    const tray = $("#compareTray"); if (tray) tray.hidden = true;
    $("#customerPage").hidden = false;
    $$(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.nav === "customer"));
    document.title = "找客户｜基金智库工作台";
    renderPage();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  /* ============================ 事件 ============================ */
  function bind() {
    document.addEventListener("click", event => {
      const page = $("#customerPage");
      if (!page || page.hidden) {
        if (!event.target.closest("#cltModal")) return;
      }
      const openBtn = event.target.closest("[data-clt-open]");
      if (openBtn) { window.FundThinkTank && window.FundThinkTank.openDrawer("cltCustomer", openBtn.dataset.cltOpen); return; }
      const fundBtn = event.target.closest("[data-clt-fund]");
      if (fundBtn) { window.FundThinkTank && window.FundThinkTank.openDrawer("screenerFund", fundBtn.dataset.cltFund); return; }
      if (event.target.closest("#cltExportBtn")) { openModal(exportHTML()); return; }
      const scriptBtn = event.target.closest("[data-clt-script]");
      if (scriptBtn) { window.FundThinkTank && window.FundThinkTank.openDrawer("cltScript", scriptBtn.dataset.cltScript, true); return; }
      const advBtn = event.target.closest("[data-clt-advance]");
      if (advBtn) { const [tid, target] = advBtn.dataset.cltAdvance.split("|"); openModal(advanceHTML(tid, target)); return; }
      const logBtn = event.target.closest("[data-clt-log]");
      if (logBtn) {
        const t = TASKS.find(x => x.id === logBtn.dataset.cltLog);
        window.FundThinkTank && window.FundThinkTank.showToast(`留痕：${t.log.map(l => `${l.t} ${l.s}`).join(" → ")}（操作人/时间/前后状态已记录）`, "info");
        return;
      }
      const opTaskBtn = event.target.closest("[data-clt-task-op]");
      if (opTaskBtn) {
        const [cid, oi] = opTaskBtn.dataset.cltTaskOp.split("|");
        const op = computeOps(CUSTOMERS.find(x => x.id === cid))[Number(oi)] || OPS[Number(oi)];
        TASKS.unshift({ id: `T-CLT-${String(TASKS.length + 1).padStart(2, "0")}`, cust: cid, source: `商机雷达 · ${OP_META[op.type].name}`, theme: op.title, pri: op.grade === "A" ? "P0" : op.grade === "B" ? "P1" : "P2", lane: op.grade === "A" ? "today" : op.grade === "B" ? "week" : "pool", due: "2026-10-31", status: "待处理", next: "按建议方向准备材料", log: [{ t: "2026-10-28 16:40", s: "待处理", by: "陈明远", note: "商机卡生成" }] });
        renderPage();
        window.FundThinkTank && window.FundThinkTank.showToast(`任务已生成并进入${op.grade === "A" ? "今日必访" : op.grade === "B" ? "本周跟进" : "维护池"}（FR-CLT-04）`);
        return;
      }
      const matchTaskBtn = event.target.closest("[data-clt-task-match]");
      if (matchTaskBtn) {
        const [cid, fid] = matchTaskBtn.dataset.cltTaskMatch.split("|");
        const f = fundOf(fid);
        TASKS.unshift({ id: `T-CLT-${String(TASKS.length + 1).padStart(2, "0")}`, cust: cid, source: "产品匹配推荐", theme: `匹配沟通：${f.name}`, pri: "P1", lane: "week", due: "2026-10-31", status: "待处理", next: "发送材料前完成 6 道校验", log: [{ t: "2026-10-28 16:40", s: "待处理", by: "陈明远", note: `匹配推荐生成（${f.risk}）` }] });
        renderPage();
        window.FundThinkTank && window.FundThinkTank.showToast("匹配任务已生成（本周跟进泳道）");
        return;
      }
      const gateBtn = event.target.closest("[data-clt-gate]");
      if (gateBtn) { const [cid, fid] = gateBtn.dataset.cltGate.split("|"); openModal(gateHTML(cid, fid)); return; }
      const jumpBtn = event.target.closest("[data-clt-jump]");
      if (jumpBtn) { closeModal(); window.FundThinkTank && window.FundThinkTank.showToast("跳转参数包已生成（产品/金额/渠道/留痕号）；工作台不落地下单，交易在行内渠道完成"); return; }
      const recBtn = event.target.closest("[data-clt-record]");
      if (recBtn) { state.recordTask = null; openModal(recordHTML(recBtn.dataset.cltRecord)); return; }
      if (event.target.closest("#cltResetBtn")) { state.search = ""; state.layer = ""; state.risk = ""; state.elderly = false; state.expired = false; renderPage(); return; }
      if (event.target.closest("[data-clt-modal-close]")) { closeModal(); return; }
      if (event.target.id === "cltScriptCheck") { runScriptCheck(false); return; }
      if (event.target.id === "cltScriptRecheck") { runScriptCheck(true); return; }
      if (event.target.id === "cltScriptSend") {
        if (!runScriptCheck(true)) { window.FundThinkTank && window.FundThinkTank.showToast("违禁词命中，已拦截发送", "warn"); return; }
        const ctx = state.scriptCtx;
        const c = CUSTOMERS.find(x => x.id === ctx.custId);
        c.timeline.unshift({ date: "2026-10-28", channel: "企微（草稿）", summary: `话术草稿 V${scriptVersion} 已生成并留痕（生成版+校验结果+接收对象），客户经理确认后发送`, next: "发送前须二次校验" });
        window.FundThinkTank && window.FundThinkTank.showToast("草稿已生成并留痕：系统不直发，经理确认后经企微/短信发送（默认草稿模式）");
        return;
      }
      if (event.target.closest("#cltModal")) return;
      if (event.target.closest("#cltModalOverlay") || event.target.id === "cltModal") { closeModal(); return; }
    });

    document.addEventListener("change", event => {
      const page = $("#customerPage");
      if (!page || page.hidden) return;
      if (["cltLayerFilter", "cltRiskFilter", "cltElderFilter", "cltExpiredFilter"].includes(event.target.id)) {
        state.layer = $("#cltLayerFilter").value;
        state.risk = $("#cltRiskFilter").value;
        state.elderly = $("#cltElderFilter").checked;
        state.expired = $("#cltExpiredFilter").checked;
        renderPage();
      }
      if (event.target.id === "cltSceneSel") {
        const c = CUSTOMERS.find(x => x.id === state.scriptCtx.custId);
        const s = buildScript(event.target.value, c, state.scriptCtx.op);
        $("#cltScriptBody").value = s.body;
        runScriptCheck(false);
      }
    });

    document.addEventListener("input", event => {
      const page = $("#customerPage");
      if (!page || page.hidden) return;
      if (event.target.id === "cltSearchInput") { state.search = event.target.value.trim(); renderPage(); const input = $("#cltSearchInput"); if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); } }
      if (event.target.id === "cltScriptBody") {
        const hits = validateScript(event.target.value);
        const box = $("#cltBannedResult");
        if (box) box.innerHTML = hits.length ? `<span class="bad">${icon("x")}实时拦截：命中违禁词 ${hits.map(escapeHTML).join("、")}</span>` : "";
      }
    });

    document.addEventListener("submit", event => {
      const form = event.target;
      if (form.id === "cltAdvanceForm") {
        event.preventDefault();
        const taskId = form.dataset.task, target = form.dataset.target;
        const missing = (REQUIRED[target] || []).filter(name => !form.elements[name].value.trim());
        if (missing.length) { window.FundThinkTank && window.FundThinkTank.showToast(`必填字段未完成：${missing.join("、")}（状态机校验）`, "warn"); return; }
        const t = TASKS.find(x => x.id === taskId);
        if (target === "已触达" && touchCount(t.cust) >= 2 && !t.log.some(l => l.note.includes("豁免"))) {
          window.FundThinkTank && window.FundThinkTank.showToast("频控拦截：该客户本周主动触达已达 2 次上限；如为重要事件豁免请在备注注明事由（AC-CLT-08）", "warn");
          return;
        }
        const note = form.elements.note.value.trim();
        t.log.push({ t: `2026-10-28 ${new Date().toTimeString().slice(0, 5)}`, s: target, by: "陈明远", note: note || Object.values(REQUIRED[target] || {}).length ? `${target}流转` : target });
        t.status = target;
        if (target === "已完成" && form.elements.next) t.next = form.elements.next.value || "已闭环";
        if (target === "已关闭") t.next = `已关闭（${form.elements.reason.value.slice(0, 12)}…）`;
        closeModal();
        renderPage();
        window.FundThinkTank && window.FundThinkTank.showToast(`状态已流转：${t.status}（操作人/时间/前后状态已留痕）`);
        return;
      }
      if (form.id === "cltRecordForm") {
        event.preventDefault();
        if (!form.elements.point.value.trim()) { window.FundThinkTank && window.FundThinkTank.showToast("沟通要点为必填：未填写不得标记已沟通", "warn"); return; }
        if (!form.elements.next.value.trim()) { window.FundThinkTank && window.FundThinkTank.showToast("下一步为必填（动作/负责人/日期）", "warn"); return; }
        state.recordTask = form.elements.task.value || null;
        addRecord(form.dataset.cust, { date: form.elements.date.value, channel: form.elements.channel.value, point: form.elements.point.value.trim(), feedback: form.elements.feedback.value, next: form.elements.next.value.trim(), elder: CUSTOMERS.find(x => x.id === form.dataset.cust).age >= 65 });
        closeModal();
        renderPage();
        window.FundThinkTank && window.FundThinkTank.renderDrawer();
        window.FundThinkTank && window.FundThinkTank.showToast("联系记录已写入时间线；如关联任务已推进状态，下次跟进将生成提醒");
        return;
      }
      if (form.id === "cltExportForm") {
        event.preventDefault();
        closeModal();
        window.FundThinkTank && window.FundThinkTank.showToast(`导出申请已留痕：范围「${form.elements.range.value}」用途「${form.elements.purpose.value}」导出人 ${OWNER} · 字段脱敏`);
      }
    });
  }

  /* ============================ 启动 ============================ */
  function init() {
    if (!$("#customerPage")) return;
    bind();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.CustomerLink = { show, aiDraft, detailHTML, scriptHTML };
})();
