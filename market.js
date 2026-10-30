(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const escapeHTML = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;

  const assets = {
    domestic: {
      id: "domestic", name: "国内权益", icon: "market", temp: 64, delta: 2, weight: .30, color: "#247cc1",
      view: "中性偏积极", confidence: "中等", horizon: "1—3 个月", time: "A 股上一交易日 · 演示数据",
      keyMetric: { label: "沪深 300（演示）", value: "+0.42%", direction: "up" },
      headline: "动量与广度共同改善，结构性活跃先于全面趋势确认",
      summary: "价格动量与市场广度同步回升，资产温度进入偏热区，但尚未达到过热。AI 倾向于将当前状态理解为结构性活跃，而非全面趋势确认；若指数继续上行但广度回落，观点需要下调。",
      supports: ["价格趋势与市场广度同向改善，行情并非完全由少数权重支撑。", "成交活跃度有所回升，为结构性机会提供流动性基础。", "估值指标未处于极端区域，仍保留盈利验证的时间窗口。"],
      risks: ["热点过度集中可能导致广度重新走弱。", "盈利预期若未跟上价格变化，温度可能快速回落。"],
      invalidation: "当上涨行业占比连续回落、成交温度下降且指数仍仅靠少数权重维持时，当前“中性偏积极”观点失效。",
      driver: "动量与广度改善", constraint: "盈利验证仍需时间",
      clientMessage: "国内权益近期更像结构性活跃，而不是所有板块同步走强。我们会同时观察上涨范围和成交情况，避免只根据指数短期表现判断市场健康度。",
      stats: [{ label: "市场温度", value: "64", note: "偏热区" }, { label: "沪深 300（演示）", value: "+0.42%", note: "上一交易日", direction: "up" }, { label: "上涨行业占比", value: "63%", note: "市场广度（演示）" }, { label: "成交活跃度", value: "68", note: "历史分位（演示）" }],
      indicators: [{ name: "价格动量", value: "20 日趋势偏强", score: 66, text: "趋势有所改善，但不据此预测单日涨跌。" }, { name: "市场广度", value: "上涨行业占比 63%", score: 62, text: "行业参与度提升，仍需观察是否持续。" }, { name: "成交情绪", value: "成交分位 68%", score: 68, text: "交易活跃，尚未进入极端过热区域。" }, { name: "估值与盈利", value: "估值中性，盈利企稳", score: 56, text: "价格修复需要后续盈利数据验证。" }],
      reading: { fact: "国内权益温度 64，价格动量、市场广度和成交情绪均处于中性偏暖区域。", inference: "当前结构性活跃的置信度高于全面趋势上行，广度是比指数点位更重要的后续验证指标。", action: "对持有权益基金的客户，优先解释持仓风格与行业暴露，不将市场升温直接转化为追加配置建议。" }
    },
    overseas: {
      id: "overseas", name: "海外权益", icon: "portfolio", temp: 56, delta: -1, weight: .20, color: "#6c79b5",
      view: "中性观察", confidence: "中等", horizon: "1—3 个月", time: "海外最近收盘 · 演示数据",
      keyMetric: { label: "标普 500（演示）", value: "-0.18%", direction: "down" },
      headline: "盈利支撑与利率约束并存，资产温度维持中性",
      summary: "海外权益的盈利预期仍提供一定支撑，但估值与利率敏感度限制温度进一步上行。AI 维持中性观察，不同区域与行业不能简单合并为一个方向，后续重点看利率和盈利预期能否形成同向改善。",
      supports: ["企业盈利预期尚未出现明显下修信号。", "主要指数趋势仍处于中性区域，未形成普遍转弱。"],
      risks: ["实际利率上行可能压缩高估值资产的估值空间。", "不同国家和行业分化，汇总指标可能掩盖局部脆弱性。"],
      invalidation: "若盈利预期继续稳定而利率压力缓和，可上调观点；若盈利下修与利率上行同时发生，则应下调至谨慎观察。",
      driver: "盈利预期相对稳定", constraint: "利率与估值约束",
      clientMessage: "海外权益不能只看单一指数。当前盈利仍有支撑，但利率和估值约束也明显，需要结合具体区域、行业与基金持仓解释。",
      stats: [{ label: "市场温度", value: "56", note: "中性区" }, { label: "标普 500（演示）", value: "-0.18%", note: "隔夜", direction: "down" }, { label: "盈利预期", value: "企稳", note: "演示指标" }, { label: "利率敏感度", value: "较高", note: "估值约束" }],
      indicators: [{ name: "价格动量", value: "主要指数震荡", score: 58, text: "趋势未明显转弱，也缺乏同步上行。" }, { name: "市场广度", value: "行业参与分化", score: 52, text: "权重与中小盘表现存在差异。" }, { name: "利率敏感", value: "实际利率约束仍在", score: 48, text: "利率变化对估值形成中间传导。" }, { name: "盈利预期", value: "盈利预期大致稳定", score: 61, text: "盈利支撑仍需后续财报验证。" }],
      reading: { fact: "海外权益温度 56，盈利预期相对稳定，但利率敏感指标仍低于趋势指标。", inference: "资产处于中性观察状态，利率与盈利预期的相对变化比单日海外指数涨跌更重要。", action: "向客户说明海外资产的交易时段、汇率和区域差异，不把隔夜单一指数表现直接映射为全部海外基金表现。" }
    },
    bond: {
      id: "bond", name: "债券", icon: "fund", temp: 47, delta: 1, weight: .25, color: "#369184",
      view: "中性偏积极", confidence: "中低", horizon: "1—3 个月", time: "债市上一交易日 · 演示数据",
      keyMetric: { label: "中证全债（演示）", value: "-0.06%", direction: "down" },
      headline: "资金面提供支撑，利率方向尚未形成明确共识",
      summary: "债券温度处于中性区域，资金面指标提供一定支撑，但利率趋势和久期回报未形成强信号。AI 观点中性偏积极，重点在于票息、久期与波动的平衡，不把短期净值变化直接解释为信用风险。",
      supports: ["资金面指标相对稳定，为短端债券提供支撑。", "信用利差指标未显示显著压力，信用风险暂未成为主要温度来源。"],
      risks: ["利率预期反转可能放大长久期产品净值波动。", "不同久期和信用策略差异较大，综合温度无法替代产品穿透。"],
      invalidation: "若资金面转紧并伴随利率趋势上行，应降低对债券资产的积极判断；若利率下行且信用利差稳定，则温度可能进一步改善。",
      driver: "资金面提供支撑", constraint: "利率方向不清晰",
      clientMessage: "债券基金的短期净值波动需要拆分来看，可能来自利率和久期，不一定就是信用风险。我们会先检查具体产品，再解释波动来源。",
      stats: [{ label: "市场温度", value: "47", note: "中性区" }, { label: "中证全债（演示）", value: "-0.06%", note: "上一交易日", direction: "down" }, { label: "资金面", value: "中性偏松", note: "演示指标" }, { label: "久期敏感度", value: "中等", note: "产品间有差异" }],
      indicators: [{ name: "利率趋势", value: "利率方向震荡", score: 50, text: "尚未形成清晰的单边趋势。" }, { name: "久期回报", value: "长端贡献一般", score: 46, text: "久期策略的收益与波动需同时观察。" }, { name: "信用利差", value: "信用利差基本稳定", score: 43, text: "暂未见明显信用压力，但不能替代主体核查。" }, { name: "资金面", value: "资金面相对稳定", score: 52, text: "流动性对短端形成一定支撑。" }],
      reading: { fact: "债券温度 47，资金面指标略高于利率趋势和久期回报指标。", inference: "当前支撑更多来自流动性而非明确利率趋势，对不同久期产品的影响可能显著不同。", action: "陪持有应先区分利率波动、久期影响和信用风险，避免向客户承诺净值修复时间。" }
    },
    gold: {
      id: "gold", name: "黄金", icon: "sparkles", temp: 72, delta: 4, weight: .10, color: "#c28a35",
      view: "趋势仍存，关注拥挤", confidence: "中等", horizon: "1—3 个月", time: "最近可得收盘 · 演示数据",
      keyMetric: { label: "黄金现货（演示）", value: "+0.65%", direction: "up" },
      headline: "趋势温度较高，但拥挤度已同步进入偏热区",
      summary: "黄金受趋势动量与避险讨论支撑，温度为五类资产最高。AI 认为趋势尚未被证伪，但拥挤度也已偏高，需要提高对实际利率反向变化、美元反弹和高位波动的关注，不能将偏热直接理解为更高预期收益。",
      supports: ["趋势动量仍处于偏热区，价格状态尚未出现明确反转。", "分散配置与避险讨论仍为黄金提供关注度。"],
      risks: ["拥挤度偏高意味着反向变化时波动可能被放大。", "实际利率或美元快速反弹，可能削弱当前支撑。"],
      invalidation: "若实际利率上行、美元走强且黄金趋势动量同步回落，应取消“趋势仍存”的判断，重新评估是否为拥挤交易反转。",
      driver: "趋势与避险讨论", constraint: "拥挤度与实际利率",
      clientMessage: "黄金近期关注度较高，但温度高并不等于风险低。趋势仍在的同时，交易也更拥挤，需要特别留意实际利率和美元变化带来的波动。",
      stats: [{ label: "市场温度", value: "72", note: "偏热区" }, { label: "黄金现货（演示）", value: "+0.65%", note: "最近收盘", direction: "up" }, { label: "实际利率", value: "回落", note: "演示指标" }, { label: "交易拥挤度", value: "偏高", note: "反向风险上升" }],
      indicators: [{ name: "实际利率", value: "实际利率边际回落", score: 62, text: "通过持有成本渠道对黄金形成支撑。" }, { name: "美元传导", value: "美元近期偏弱", score: 55, text: "美元走弱提供支撑，但相关性并非始终稳定。" }, { name: "趋势动量", value: "趋势维持偏强", score: 78, text: "当前主要温度来源，也需警惕高位波动。" }, { name: "交易拥挤", value: "交易拥挤度偏高", score: 74, text: "高温度在此代表拥挤风险，而非积极收益信号。" }],
      reading: { fact: "黄金温度 72，趋势动量与拥挤度同时处于偏热区，是五类资产中温度最高的一类。", inference: "趋势支撑与拥挤风险并存，温度最高不代表最适合追涨，实际利率和美元是关键反向变量。", action: "客户沟通应同时解释分散配置价值和高位波动风险，避免把黄金描述为必然避险或低波动资产。" }
    },
    usd: {
      id: "usd", name: "美元", icon: "trend-down", temp: 41, delta: -2, weight: .15, color: "#647f96",
      view: "中性偏弱", confidence: "中低", horizon: "1—3 个月", time: "最近可得收盘 · 演示数据",
      keyMetric: { label: "美元指数（演示）", value: "-0.22%", direction: "down" },
      headline: "利差支撑有所减弱，趋势动量接近偏冷区",
      summary: "美元温度接近偏冷区，利差与趋势动量未形成强支撑。AI 观点中性偏弱，但置信度仅为中低，因为避险事件可能迅速改变美元状态，并通过实际利率、资金流向等渠道影响黄金和海外权益。",
      supports: ["利差仍提供一定基础，尚未出现所有指标同步走弱。", "避险需求仍可能在特定事件下提供阶段性支撑。"],
      risks: ["地缘或流动性事件可能使美元快速反转走强。", "美元与其他资产的负相关关系并非在所有阶段稳定。"],
      invalidation: "若利差重新扩大并伴随趋势动量回升，应放弃偏弱判断；若仅因短期避险上行，则需区分事件驱动与中期趋势。",
      driver: "利差仍有基础", constraint: "趋势动量偏弱",
      clientMessage: "美元近期温度偏低，但这不代表它会持续单边走弱。美元还受利差和避险需求影响，其变化也会传导到黄金和海外资产。",
      stats: [{ label: "市场温度", value: "41", note: "中性区下沿" }, { label: "美元指数（演示）", value: "-0.22%", note: "最近收盘", direction: "down" }, { label: "利差支撑", value: "减弱", note: "演示指标" }, { label: "避险需求", value: "中性", note: "事件敏感" }],
      indicators: [{ name: "利差因素", value: "利差支撑边际减弱", score: 45, text: "利差仍有基础，但边际方向不利。" }, { name: "避险需求", value: "避险需求中性", score: 43, text: "事件驱动可能造成短期跳升。" }, { name: "趋势动量", value: "美元趋势偏弱", score: 38, text: "进入偏冷区，但不据此推断单边贬值。" }, { name: "相对增长", value: "经济相对优势收窄", score: 44, text: "相对增长通过利率预期影响美元。" }],
      reading: { fact: "美元温度 41，趋势动量进入偏冷区，但利差和避险需求仍处于中性区域。", inference: "当前仅适合中性偏弱判断，不宜外推为持续单边贬值，事件驱动可能快速改变资产联动。", action: "涉及海外基金时，应区分资产本身价格变化与汇率影响，避免将美元走弱简单等同于海外基金一定受益。" }
    }
  };

  const state = { selected: "domestic", period: "month" };
  const assetList = Object.values(assets);
  const compositeTemp = Math.round(assetList.reduce((sum, asset) => sum + asset.temp * asset.weight, 0));
  const compositeDelta = Math.round(assetList.reduce((sum, asset) => sum + asset.delta * asset.weight, 0) * 10) / 10;

  function temperatureBand(score) {
    if (score < 20) return { label: "极冷", className: "cool" };
    if (score < 40) return { label: "偏冷", className: "cool" };
    if (score < 60) return { label: "中性", className: "neutral" };
    if (score < 80) return { label: "偏热", className: "warm" };
    return { label: "过热", className: "hot" };
  }

  function makeSeries(asset, period) {
    const count = period === "week" ? 7 : 12;
    const amplitude = period === "week" ? 1.5 : period === "month" ? 4 : 7;
    const trend = period === "week" ? asset.delta * .45 : period === "month" ? asset.delta * 1.25 : asset.delta * 2.1;
    const wave = [-.55, .12, -.28, .42, -.08, .55, .16, -.36, .28, -.04, .38, 0];
    return Array.from({ length: count }, (_, index) => {
      const progress = index / (count - 1);
      const raw = asset.temp - trend * (1 - progress) + wave[(index + asset.id.length) % wave.length] * amplitude;
      return index === count - 1 ? asset.temp : Math.max(2, Math.min(98, Math.round(raw)));
    });
  }

  function sparkline(asset) {
    const values = makeSeries(asset, "week");
    const min = Math.min(...values) - 1;
    const max = Math.max(...values) + 1;
    const points = values.map((value, index) => `${(index / (values.length - 1)) * 150},${31 - ((value - min) / (max - min)) * 26}`).join(" ");
    return `<svg class="asset-sparkline" viewBox="0 0 150 34" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}" fill="none" stroke="${asset.color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/><circle cx="150" cy="${31 - ((values[values.length - 1] - min) / (max - min)) * 26}" r="2.5" fill="${asset.color}" stroke="none"/></svg>`;
  }

  function renderComposite() {
    $("#compositeTempValue").textContent = compositeTemp;
    $("#compositeTempBand").textContent = temperatureBand(compositeTemp).label;
    $("#temperatureGaugeArc").setAttribute("stroke-dasharray", `${(compositeTemp / 100 * 282.743).toFixed(1)} 283`);
    $(".temperature-change b").textContent = `${compositeDelta >= 0 ? "+" : ""}${compositeDelta.toFixed(1)}`;
    $(".temperature-gauge").setAttribute("aria-label", `综合市场温度 ${compositeTemp} 分`);
  }

  function renderAssetCards() {
    $("#assetCards").innerHTML = assetList.map(asset => {
      const band = temperatureBand(asset.temp);
      return `<button class="asset-temp-card ${state.selected === asset.id ? "active" : ""}" data-asset-id="${asset.id}" aria-pressed="${state.selected === asset.id}">
        <div class="asset-card-top"><span class="asset-name"><i class="asset-name-icon">${icon(asset.icon)}</i>${asset.name}</span><span class="temp-band ${band.className}">${band.label}</span></div>
        <div class="asset-score-row"><span class="asset-score"><strong>${asset.temp}</strong><span>/ 100</span></span><span class="temp-delta ${asset.delta >= 0 ? "warming" : "cooling"}">${icon(asset.delta >= 0 ? "trend-up" : "trend-down")}${asset.delta >= 0 ? "+" : ""}${asset.delta.toFixed(1)}</span></div>
        ${sparkline(asset)}
        <div class="asset-card-bottom"><span class="asset-key-metric"><small>${asset.keyMetric.label}</small><strong class="${asset.keyMetric.direction}">${asset.keyMetric.value}</strong></span><span class="asset-view-short">${asset.view}</span></div>
      </button>`;
    }).join("");
  }

  function renderStats(asset) {
    $("#assetStatStrip").innerHTML = asset.stats.map(stat => `<div class="asset-stat"><span>${stat.label}</span><strong class="${stat.direction || ""}">${stat.value}</strong><small>${stat.note}</small></div>`).join("");
  }

  function renderChart(asset) {
    const values = makeSeries(asset, state.period);
    const width = 680, height = 215, left = 37, right = 18, top = 17, bottom = 32;
    const plotWidth = width - left - right, plotHeight = height - top - bottom;
    const rawMin = Math.min(...values), rawMax = Math.max(...values);
    const min = Math.max(0, Math.floor((rawMin - 5) / 10) * 10);
    const max = Math.min(100, Math.ceil((rawMax + 5) / 10) * 10);
    const range = Math.max(10, max - min);
    const points = values.map((value, index) => ({ x: left + index / (values.length - 1) * plotWidth, y: top + (max - value) / range * plotHeight, value }));
    const line = points.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
    const area = `${left},${top + plotHeight} ${line} ${left + plotWidth},${top + plotHeight}`;
    const ticks = Array.from({ length: 4 }, (_, index) => Math.round(max - index / 3 * range));
    const periodLabel = state.period === "week" ? "近 1 周 · 每日观察值（演示）" : state.period === "month" ? "近 1 月 · 每日观察值（演示）" : "近 3 月 · 周度观察值（演示）";
    $("#chartSubtitle").textContent = periodLabel;
    $("#temperatureChart").innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${asset.name}${periodLabel}，最新温度 ${asset.temp}">
      ${ticks.map((tick, index) => { const y = top + index / 3 * plotHeight; return `<line class="chart-grid-line" x1="${left}" y1="${y}" x2="${left + plotWidth}" y2="${y}"/><text class="chart-axis-label" x="${left - 8}" y="${y + 3}" text-anchor="end">${tick}</text>`; }).join("")}
      <polygon class="chart-temp-area" points="${area}" style="fill:${asset.color}12"/>
      <polyline class="chart-temp-line" points="${line}" style="stroke:${asset.color}"/>
      ${points.map((point, index) => `<circle class="chart-point" cx="${point.x}" cy="${point.y}" r="7"><title>观察点 ${index + 1} · 温度 ${point.value}（演示）</title></circle>`).join("")}
      <circle class="chart-last-dot" cx="${points[points.length - 1].x}" cy="${points[points.length - 1].y}" r="4.5" style="stroke:${asset.color}"/>
      <text class="chart-axis-label" x="${left}" y="${height - 8}">${state.period === "quarter" ? "较早观察周" : "较早观察点"}</text>
      <text class="chart-axis-label" x="${left + plotWidth}" y="${height - 8}" text-anchor="end">当前 · ${asset.temp}</text>
    </svg>`;
  }

  function renderIndicators(asset) {
    $("#indicatorTableBody").innerHTML = asset.indicators.map(item => `<tr><td>${item.name}</td><td>${item.value}</td><td><span class="indicator-score"><span><i style="width:${item.score}%;background:${asset.color}"></i></span><b>${item.score}</b></span></td><td>${item.text}</td></tr>`).join("");
  }

  function renderAiPanel(asset) {
    const band = temperatureBand(asset.temp);
    $("#aiAssetPanel").innerHTML = `<div class="ai-asset-head"><div><span class="section-kicker">AI 资产观点</span><h2>${asset.name}</h2></div><span class="ai-badge">${icon("sparkles")}AI 推断</span></div>
      <div class="ai-stance"><div class="ai-stance-label"><span>研究观点 · ${band.label} ${asset.temp}</span><b>${asset.view}</b></div><h3>${asset.headline}</h3><p>${asset.summary}</p></div>
      <div class="ai-confidence"><div><span>观察期限</span><strong>${asset.horizon}</strong></div><div><span>观点置信度</span><strong>${asset.confidence}</strong></div></div>
      <div class="ai-factor-columns"><section class="ai-factor-section"><h3>${icon("check-circle")}支撑因素</h3><ul class="ai-factor-list">${asset.supports.map(item => `<li>${item}</li>`).join("")}</ul></section><section class="ai-factor-section risk"><h3>${icon("alert")}反向风险</h3><ul class="ai-factor-list">${asset.risks.map(item => `<li>${item}</li>`).join("")}</ul></section></div>
      <div class="ai-invalidation"><strong>观点失效 / 切换条件</strong>${asset.invalidation}</div>
      <div class="ai-asset-actions"><button class="btn btn-primary" data-market-action="client">${icon("message")}生成客户沟通稿</button><button class="btn btn-secondary" data-market-action="method">${icon("file")}查看推断依据</button><div class="ai-generated-note">AI 仅基于演示指标与规则生成研究草稿，须由投研及客户经理复核。</div></div>`;
  }

  function renderComparison() {
    $("#comparisonTableBody").innerHTML = assetList.map(asset => {
      const band = temperatureBand(asset.temp);
      return `<tr data-compare-asset="${asset.id}" class="${state.selected === asset.id ? "active" : ""}"><td>${asset.name}</td><td><span class="comparison-temp"><strong>${asset.temp}</strong><span class="temp-band ${band.className}">${band.label}</span></span></td><td><span class="temp-delta ${asset.delta >= 0 ? "warming" : "cooling"}">${asset.delta >= 0 ? "+" : ""}${asset.delta.toFixed(1)}</span></td><td class="comparison-driver">${asset.driver}</td><td class="comparison-driver">${asset.constraint}</td><td>${asset.view}</td><td>${asset.horizon}</td></tr>`;
    }).join("");
  }

  function renderReading(asset) {
    $("#readingFact").textContent = asset.reading.fact;
    $("#readingInference").textContent = asset.reading.inference;
    $("#readingAction").textContent = asset.reading.action;
  }

  function renderSelectedAsset() {
    const asset = assets[state.selected];
    const band = temperatureBand(asset.temp);
    $("#assetDetailName").textContent = asset.name;
    $("#assetDetailTag").textContent = `${band.label} ${asset.temp}`;
    $("#assetDataTime").textContent = asset.time;
    renderStats(asset);
    renderChart(asset);
    renderIndicators(asset);
    renderAiPanel(asset);
    renderComparison();
    renderReading(asset);
  }

  function selectAsset(id) {
    if (!assets[id]) return;
    state.selected = id;
    renderAssetCards();
    renderSelectedAsset();
  }

  function compositeText() {
    return `【看市场 · 多资产综合解读｜演示】\n综合市场温度：${compositeTemp}/100（${temperatureBand(compositeTemp).label}），较上一观察日 ${compositeDelta >= 0 ? "+" : ""}${compositeDelta.toFixed(1)}。\n\n国内权益 ${assets.domestic.temp}：${assets.domestic.view}，动量与广度改善，但盈利仍需验证。\n海外权益 ${assets.overseas.temp}：${assets.overseas.view}，盈利支撑与利率约束并存。\n债券 ${assets.bond.temp}：${assets.bond.view}，资金面提供支撑，利率方向尚不清晰。\n黄金 ${assets.gold.temp}：${assets.gold.view}，趋势与拥挤风险同时偏高。\n美元 ${assets.usd.temp}：${assets.usd.view}，利差支撑减弱，趋势动量偏弱。\n\n综合判断：当前更像结构性活跃，而非所有资产共同进入强趋势。温度不代表预期收益，以上均为演示内容，不构成投资建议。`;
  }

  function currentAssetText() {
    const asset = assets[state.selected];
    return `【看市场 · ${asset.name}资产观点｜演示】\n市场温度：${asset.temp}/100（${temperatureBand(asset.temp).label}）\nAI 观点：${asset.view}｜期限：${asset.horizon}｜置信度：${asset.confidence}\n\n${asset.summary}\n\n支撑因素：\n${asset.supports.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\n反向风险：\n${asset.risks.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\n失效条件：${asset.invalidation}\n\n展业提示：${asset.reading.action}\n\n以上为演示数据与 AI 草稿，不构成投资建议。`;
  }

  function aiDraft(prompt) {
    const asset = assetList.find(item => prompt.includes(item.name));
    if (asset) {
      return `以下为“看市场”生成的${asset.name}客户沟通草稿：\n\n“${asset.clientMessage}”\n\n当前演示温度为 ${asset.temp}/100，AI 研究观点为“${asset.view}”，观察期限 ${asset.horizon}。沟通时还应说明：${asset.risks[0]}\n\n温度不是买卖信号。请结合客户持仓、风险等级、资金期限和正式数据复核后使用。`;
    }
    return `看市场 · 晨会解读草稿（演示）：\n\n综合温度为 ${compositeTemp}/100，处于${temperatureBand(compositeTemp).label}区。国内权益与黄金温度相对较高，海外权益、债券和美元仍处中性区，当前更像结构性活跃，而非全面趋势共振。\n\n晨会建议按“资产事实—驱动因素—反向风险—客户持仓含义”讨论，不把温度排名直接转化为基金推荐。后续重点验证国内权益广度、海外利率与盈利预期，以及黄金的实际利率和拥挤度变化。\n\n以上均为演示数据，请复核后使用。`;
  }

  function show() {
    $("#todayPage").hidden = true;
    const fundPage = $("#fundPage");
    if (fundPage) fundPage.hidden = true;
    const portfolioPage = $("#portfolioPage");
    if (portfolioPage) portfolioPage.hidden = true;
    const customerPage = $("#customerPage");
    if (customerPage) customerPage.hidden = true;
    const companionPage = $("#companionPage");
    if (companionPage) companionPage.hidden = true;
    const tray = $("#compareTray");
    if (tray) tray.hidden = true;
    $("#marketPage").hidden = false;
    $$(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.nav === "market"));
    document.title = "看市场｜基金智库工作台";
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function openMethodology() {
    if (window.FundThinkTank) window.FundThinkTank.openDrawer("rules", "market");
  }

  $("#marketMethodBtn").addEventListener("click", openMethodology);
  $("#indicatorMethodBtn").addEventListener("click", openMethodology);
  $("#marketMorningBtn").addEventListener("click", () => window.FundThinkTank && window.FundThinkTank.openAi("看市场多资产晨会解读"));
  $("#copyMarketSummaryBtn").addEventListener("click", () => window.FundThinkTank && window.FundThinkTank.copyText(compositeText(), "多资产综合解读已复制，请复核后使用"));
  $("#copyAssetViewBtn").addEventListener("click", () => window.FundThinkTank && window.FundThinkTank.copyText(currentAssetText(), `${assets[state.selected].name}观点已复制，请复核后使用`));

  document.addEventListener("click", event => {
    const assetCard = event.target.closest("[data-asset-id]");
    if (assetCard) selectAsset(assetCard.dataset.assetId);
    const periodButton = event.target.closest("[data-chart-period]");
    if (periodButton) {
      state.period = periodButton.dataset.chartPeriod;
      $$("[data-chart-period]").forEach(button => button.classList.toggle("active", button === periodButton));
      renderChart(assets[state.selected]);
    }
    const comparisonRow = event.target.closest("[data-compare-asset]");
    if (comparisonRow) {
      selectAsset(comparisonRow.dataset.compareAsset);
      $(".asset-detail-grid").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    const action = event.target.closest("[data-market-action]");
    if (action && window.FundThinkTank) {
      if (action.dataset.marketAction === "method") openMethodology();
      if (action.dataset.marketAction === "client") window.FundThinkTank.openAi(`看市场${assets[state.selected].name}资产观点，生成客户沟通稿`);
    }
  });

  renderComposite();
  renderAssetCards();
  renderSelectedAsset();
  window.MarketDashboard = { show, aiDraft, compositeText, currentAssetText };
})();
