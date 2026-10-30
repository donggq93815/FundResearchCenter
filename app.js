(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const icon = (name, className = "") => `<svg class="${className}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const escapeHTML = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

  const typeLabels = {
    customer: "客户跟进",
    holding: "持仓提醒",
    fund: "基金事件",
    opportunity: "展业线索"
  };
  const priorityLabels = { high: "紧急", medium: "重要", normal: "普通" };

  const customers = {
    C001: {
      id: "C001", name: "王女士", initials: "王", risk: "平衡型 R3", segment: "稳健理财客户", aum: "86.4 万元", lastContact: "12 天前", manager: "陈明远",
      note: "风险测评将在 3 日后到期。当前持有权益与固收产品，沟通前需完成最新风险意愿复核。",
      holdings: [{ fundId: "F001", allocation: "32%", note: "持有体验需关注" }, { fundId: "F003", allocation: "48%", note: "持有稳定" }],
      timeline: [{ date: "2026/10/16", title: "完成季度持仓回访", text: "客户关注净值波动，偏好先解释风险再讨论配置。" }, { date: "2026/09/28", title: "发送基金定期报告摘要", text: "已确认客户收到，暂无额外操作诉求。" }]
    },
    C002: {
      id: "C002", name: "周先生", initials: "周", risk: "平衡型 R3", segment: "组合持仓客户", aum: "128.0 万元", lastContact: "7 天前", manager: "陈明远",
      note: "当前组合触及内部回撤提醒阈值。该提醒用于触发持仓检视，不代表需要立即调整组合。",
      holdings: [{ fundId: "F001", allocation: "28%", note: "组合成分基金" }, { fundId: "F002", allocation: "17%", note: "主题暴露需关注" }],
      timeline: [{ date: "2026/10/21", title: "组合月度回顾", text: "客户可接受中等波动，但不希望短期回撤持续扩大。" }, { date: "2026/10/08", title: "确认长期资金目标", text: "资金期限以 2—3 年为主，保留充足流动性。" }]
    },
    C003: {
      id: "C003", name: "李女士", initials: "李", risk: "稳健型 R2", segment: "基金关注客户", aum: "52.6 万元", lastContact: "5 天前", manager: "陈明远",
      note: "上周主动关注红利低波策略。今日回访以策略风险解释和真实需求确认为主，不直接转化为产品推荐。",
      holdings: [{ fundId: "F003", allocation: "61%", note: "固收持仓为主" }],
      timeline: [{ date: "2026/10/23", title: "客户浏览主题资料", text: "关注红利低波主题，尚未表达明确购买意向。" }, { date: "2026/10/10", title: "完成风险认知沟通", text: "客户更关注本金波动和资金取用便利性。" }]
    },
    C004: {
      id: "C004", name: "陈先生", initials: "陈", risk: "进取型 R4", segment: "长期配置客户", aum: "210.3 万元", lastContact: "31 天前", manager: "陈明远",
      note: "已超过内部建议跟进周期，可先了解近期资金安排与持有体验，再决定是否需要进一步组合检视。",
      holdings: [{ fundId: "F002", allocation: "24%", note: "权益主题持仓" }, { fundId: "F001", allocation: "36%", note: "核心权益持仓" }],
      timeline: [{ date: "2026/09/27", title: "季度资产配置回顾", text: "客户风险承受能力较高，但仍有短期资金安排。" }]
    }
  };

  const funds = {
    F001: {
      id: "F001", name: "交银稳健成长混合 A", code: "DEMO01", type: "混合型", risk: "R3 · 中风险", nav: "1.2846", month: "+2.31%", drawdown: "-3.16%",
      description: "演示基金，用于展示产品详情、公告与客户持有关系的联动。所有指标均非真实数据。",
      announcement: "基金经理变更公告（演示）", announcementText: "产品资料显示基金经理安排发生变化。客户经理应先阅读公告原文，了解变更背景与后续管理安排，再与持有客户沟通。", date: "2026/10/28 08:30",
      customers: ["C001", "C002", "C004"], hotspots: ["H003"]
    },
    F002: {
      id: "F002", name: "交银红利低波指数 A", code: "DEMO02", type: "指数型", risk: "R3 · 中风险", nav: "1.1072", month: "+1.18%", drawdown: "-2.04%",
      description: "跟踪红利低波风格的演示产品。热度上升不代表策略适合所有客户，仍需关注风格轮动与阶段性回撤。",
      announcement: "指数编制说明更新（演示）", announcementText: "用于展示基金资料更新提醒。实际展业时应核对基金管理人公告与正式产品资料。", date: "2026/10/27 17:20",
      customers: ["C002", "C004"], hotspots: ["H001"]
    },
    F003: {
      id: "F003", name: "交银双利债券 A", code: "DEMO03", type: "债券型", risk: "R2 · 中低风险", nav: "1.0638", month: "-0.12%", drawdown: "-0.46%",
      description: "用于展示固收产品陪持有的演示基金。净值波动来源需结合组合久期、利率变化与信用暴露具体分析。",
      announcement: "基金定期报告披露（演示）", announcementText: "定期报告已披露。建议关注资产配置、久期与风险揭示，不仅依据短期收益排名进行沟通。", date: "2026/10/27 19:10",
      customers: ["C001", "C003"], hotspots: ["H002", "H005"]
    }
  };

  const portfolios = {
    P001: {
      id: "P001", name: "稳健增长组合", customerId: "C002", risk: "R3 · 平衡型", month: "-3.20%", alert: "触及内部提醒阈值", updated: "2026/10/28 08:40",
      description: "演示组合。当前提醒用于引导客户经理复核组合结构、客户资金期限与风险意愿，不构成自动调仓建议。",
      allocation: [{ name: "权益类", value: 45, color: "#327fb9" }, { name: "固收类", value: 45, color: "#51a58e" }, { name: "现金类", value: 10, color: "#d7b56b" }],
      holdings: [{ fundId: "F001", weight: "28%" }, { fundId: "F002", weight: "17%" }, { fundId: "F003", weight: "45%" }]
    }
  };

  const hotspots = {
    H001: {
      id: "H001", name: "红利低波策略关注度升温", trend: "up", trendLabel: "升温", related: true,
      summary: "市场讨论重新关注现金流质量与防御特征，相关主题资讯量上升。该内容为演示热点，不构成产品推荐。",
      chain: ["风险偏好变化", "防御风格受关注", "红利策略讨论增加"], funds: ["F002"], customers: ["C002", "C003", "C004"],
      risk: "红利策略同样可能出现净值回撤，且存在风格切换、行业集中和指数编制差异等风险。客户沟通前先完成风险匹配。"
    },
    H002: {
      id: "H002", name: "债市波动引发持有体验关注", trend: "stable", trendLabel: "持续", related: true,
      summary: "固收产品短期净值变化成为客户沟通关注点，需要区分利率波动、久期影响和信用风险。",
      chain: ["利率预期变化", "债券价格波动", "固收产品陪伴需求"], funds: ["F003"], customers: ["C001", "C003"],
      risk: "短期净值波动不等于信用违约，也不宜承诺回本时间。应结合具体产品组合与客户资金期限解释。"
    },
    H003: {
      id: "H003", name: "科技成长板块成交活跃", trend: "up", trendLabel: "新进", related: false,
      summary: "科技成长方向讨论度提升，适合作为晨会观察线索，不应仅依据单日活跃度判断行情持续性。",
      chain: ["产业事件催化", "成交活跃", "成长风格讨论增加"], funds: ["F001"], customers: ["C002"],
      risk: "活跃成交可能同时放大波动。涉及客户持仓时，需要检查行业集中度与客户风险承受能力。"
    },
    H004: {
      id: "H004", name: "黄金资产配置讨论增加", trend: "up", trendLabel: "升温", related: false,
      summary: "多资产配置讨论带动黄金主题关注度上升，后续仍需观察实际利率与风险偏好变化。",
      chain: ["分散配置需求", "避险讨论增加", "黄金主题受关注"], funds: [], customers: [],
      risk: "黄金价格受多因素影响，不能简单视为低风险资产。当前演示数据未关联具体基金。"
    },
    H005: {
      id: "H005", name: "货币基金流动性管理受关注", trend: "down", trendLabel: "降温", related: true,
      summary: "客户对资金取用便利性与现金管理仍有关注，热点热度较前一观察周期回落。",
      chain: ["短期资金安排", "流动性需求", "现金管理讨论"], funds: ["F003"], customers: ["C001"],
      risk: "现金管理工具不等同于存款，沟通时应准确说明产品属性、风险与流动性安排。"
    }
  };

  const tasks = [
    { id: "T001", type: "customer", priority: "high", title: "王女士风险测评将于 3 日后到期", reason: "持有 2 只权益类产品，测评到期前需完成适当性复核与更新提醒。", due: "今天 10:30", status: "pending", relatedType: "customer", relatedId: "C001", relatedLabel: "王女士", action: "查看客户" },
    { id: "T002", type: "holding", priority: "high", title: "周先生组合回撤触及内部提醒阈值", reason: "稳健增长组合出现风险提醒，建议核对持仓结构并准备陪持有沟通。", due: "晨会前", status: "pending", relatedType: "portfolio", relatedId: "P001", relatedLabel: "稳健增长组合", action: "检视组合" },
    { id: "T003", type: "fund", priority: "medium", title: "交银稳健成长混合发布重要公告", reason: "3 名客户持有该演示基金，建议先阅读公告并统一客户沟通口径。", due: "今天 11:30", status: "pending", relatedType: "fund", relatedId: "F001", relatedLabel: "交银稳健成长混合 A", action: "查看基金" },
    { id: "T004", type: "customer", priority: "medium", title: "李女士约定今日回访", reason: "上周关注红利低波策略，本次回访以风险解释和真实需求确认为主。", due: "今天 14:00", status: "pending", relatedType: "customer", relatedId: "C003", relatedLabel: "李女士", action: "查看客户" },
    { id: "T005", type: "customer", priority: "normal", title: "陈先生已超过建议跟进周期", reason: "近 31 天未记录有效跟进，建议先了解近期资金安排与持有体验。", due: "今天 16:00", status: "pending", relatedType: "customer", relatedId: "C004", relatedLabel: "陈先生", action: "查看客户" },
    { id: "T006", type: "fund", priority: "normal", title: "阅读债券基金定期报告并提取陪伴要点", reason: "2 名客户持有相关演示产品，重点关注久期、资产配置与风险揭示。", due: "今天 17:00", status: "pending", relatedType: "fund", relatedId: "F003", relatedLabel: "交银双利债券 A", action: "查看基金" },
    { id: "T007", type: "opportunity", priority: "normal", title: "2 名客户新增关注红利低波主题", reason: "仅作为需求沟通线索，联系前需核对风险等级，不得直接视为购买意向。", due: "今天 17:30", status: "pending", relatedType: "hotspot", relatedId: "H001", relatedLabel: "红利低波策略", action: "查看热点" },
    { id: "T008", type: "customer", priority: "normal", title: "整理昨日客户跟进记录", reason: "补充沟通结果与下一步安排，形成可追踪的找客户闭环。", due: "今天 18:00", status: "pending", relatedType: null, relatedId: null, relatedLabel: null, action: "查看任务" }
  ];

  const state = {
    taskFilter: "all",
    highOnly: false,
    showAll: false,
    hotspotFilter: "all",
    drawerStack: [],
    aiMessages: [],
    searchSelected: 0,
    searchResults: []
  };

  const drawerOverlay = $("#drawerOverlay");
  const drawerContent = $("#drawerContent");
  const briefingModal = $("#briefingModal");
  const searchOverlay = $("#searchOverlay");
  const newTaskModal = $("#newTaskModal");
  const notificationPanel = $("#notificationPanel");

  function activeTasks() {
    return tasks.filter(task => task.status === "pending");
  }

  function taskEntityIcon(type) {
    return ({ customer: "user", fund: "fund", portfolio: "portfolio", hotspot: "flame" })[type] || "file";
  }

  function renderTasks() {
    const allActive = activeTasks();
    let filtered = state.highOnly ? allActive.filter(task => task.priority === "high") : allActive.filter(task => state.taskFilter === "all" || task.type === state.taskFilter);
    const priorityOrder = { high: 0, medium: 1, normal: 2 };
    filtered = filtered.slice().sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    const visible = state.showAll ? filtered : filtered.slice(0, 5);
    const list = $("#taskList");

    if (!visible.length) {
      list.innerHTML = `<div class="empty-state">${icon("check-circle")}<strong>当前筛选下暂无待办</strong><p>可以切换分类，或新建一项找客户任务。</p></div>`;
    } else {
      list.innerHTML = visible.map(task => `
        <article class="task-item ${task.priority}">
          <div class="task-main">
            <div class="task-title-line">
              <span class="priority-badge ${task.priority}">${priorityLabels[task.priority]}</span>
              <span class="type-badge">${typeLabels[task.type]}</span>
              <button class="task-title" data-open-type="task" data-open-id="${task.id}">${escapeHTML(task.title)}</button>
            </div>
            <p class="task-reason">${escapeHTML(task.reason)}</p>
            <div class="task-meta">
              <span class="task-due ${task.priority === "high" ? "urgent" : ""}">${icon("clock")}${escapeHTML(task.due)}</span>
              ${task.relatedType ? `<button class="entity-link" data-open-type="${task.relatedType}" data-open-id="${task.relatedId}">${icon(taskEntityIcon(task.relatedType))}${escapeHTML(task.relatedLabel)}</button>` : ""}
            </div>
          </div>
          <div class="task-actions">
            <button class="task-process-btn" data-process-task="${task.id}">${escapeHTML(task.action)}</button>
            <button class="task-complete-btn" data-complete-task="${task.id}" title="标记为完成" aria-label="完成 ${escapeHTML(task.title)}">${icon("check")}</button>
          </div>
        </article>`).join("");
    }

    $("#summaryAllCount").innerHTML = `${allActive.length}<small>项</small>`;
    $("#summaryHighCount").innerHTML = `${allActive.filter(task => task.priority === "high").length}<small>项</small>`;
    $("#headingTaskCount").textContent = allActive.length;
    $("#taskCountBadge").textContent = state.highOnly || state.taskFilter !== "all" ? filtered.length : allActive.length;
    $(".nav-count").textContent = allActive.length;
    $("#taskListSummary").textContent = filtered.length ? `显示 ${visible.length} 项，共 ${filtered.length} 项待办${state.highOnly ? " · 仅看晨会前优先" : ""}` : "当前分类暂无待办";
    $("#toggleAllTasks").innerHTML = `${state.showAll ? "收起" : "查看全部"}${icon(state.showAll ? "arrow-left" : "arrow-right")}`;
    $$("[data-task-filter]").forEach(button => button.classList.toggle("active", !state.highOnly && button.dataset.taskFilter === state.taskFilter));
  }

  function renderHotspots() {
    const list = Object.values(hotspots).filter(item => state.hotspotFilter === "all" || item.related);
    $("#hotspotList").innerHTML = list.map(item => `
      <button class="hotspot-item" data-open-type="hotspot" data-open-id="${item.id}">
        <span class="hotspot-rank">${String(Object.keys(hotspots).indexOf(item.id) + 1).padStart(2, "0")}</span>
        <span class="hotspot-main"><span class="hotspot-name">${escapeHTML(item.name)}</span><span class="hotspot-meta">${item.funds.length} 只关联基金 · ${item.customers.length} 位客户相关</span></span>
        <span class="hotspot-trend ${item.trend}">${icon(item.trend === "up" ? "trend-up" : item.trend === "down" ? "trend-down" : "minus")}${item.trendLabel}</span>
      </button>`).join("");
  }

  function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `${icon(type === "success" ? "check-circle" : "info")}<span>${escapeHTML(message)}</span>`;
    $("#toastContainer").appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  }

  function syncBodyLock() {
    const anyOpen = [drawerOverlay, briefingModal, searchOverlay, newTaskModal].some(element => !element.hidden);
    document.body.style.overflow = anyOpen ? "hidden" : "";
  }

  function backButton() {
    return state.drawerStack.length > 1 ? `<button class="text-btn drawer-back" data-drawer-back>${icon("arrow-left")}返回上一页</button>` : "";
  }

  function demoBanner(text = "当前内容为演示数据，实际展业请以正式业务系统与产品资料为准。") {
    return `<div class="drawer-banner">${icon("info")}<span>${escapeHTML(text)}</span></div>`;
  }

  function renderCustomer(customer) {
    return `${backButton()}${demoBanner()}
      <div class="profile-card"><div class="profile-avatar">${customer.initials}</div><div class="profile-main"><strong>${customer.name}</strong><span>${customer.segment} · 客户经理 ${customer.manager}</span></div><span class="risk-badge">${customer.risk}</span></div>
      <section class="drawer-section"><div class="detail-grid"><div class="detail-cell"><span>基金保有规模（演示）</span><strong>${customer.aum}</strong></div><div class="detail-cell"><span>最近有效跟进</span><strong>${customer.lastContact}</strong></div></div></section>
      <section class="drawer-section"><div class="drawer-section-title"><h3>当前经营提示</h3><span>需人工复核</span></div><div class="risk-note">${customer.note}</div></section>
      <section class="drawer-section"><div class="drawer-section-title"><h3>主要基金持仓</h3><span>${customer.holdings.length} 只展示产品</span></div><div class="detail-list">${customer.holdings.map(holding => {
        const fund = funds[holding.fundId];
        return `<button class="detail-list-item clickable-list-item" data-open-type="fund" data-open-id="${fund.id}"><span><strong>${fund.name}</strong><small>${holding.note}</small></span><span>占比 ${holding.allocation}</span></button>`;
      }).join("")}</div></section>
      <section class="drawer-section"><div class="drawer-section-title"><h3>最近跟进记录</h3><span>操作留痕</span></div><div class="timeline">${customer.timeline.map(item => `<div class="timeline-item"><strong>${item.title}</strong><span>${item.date}</span><p>${item.text}</p></div>`).join("")}</div></section>
      <div class="drawer-actions"><button class="btn btn-secondary" data-action="record-follow" data-name="${customer.name}">${icon("message")}记录跟进</button><button class="btn btn-primary" data-action="new-task-customer" data-open-id="${customer.id}">${icon("plus")}新建任务</button></div>`;
  }

  function renderFund(fund) {
    return `${backButton()}${demoBanner("基金名称、代码、净值与公告均为演示内容，不代表真实产品信息。")}
      <div class="fund-hero"><div class="fund-hero-top"><div><h3>${fund.name}</h3><p>${fund.code} · ${fund.type}</p></div><span class="risk-badge">${fund.risk}</span></div><div class="fund-metrics"><div><span>演示净值</span><strong>${fund.nav}</strong></div><div><span>近一月（演示）</span><strong class="${fund.month.startsWith("+") ? "up" : "down"}">${fund.month}</strong></div><div><span>区间回撤</span><strong class="down">${fund.drawdown}</strong></div></div></div>
      <div class="source-line">${icon("clock")}演示数据源 · 非实时行情 · 2026/10/28 08:40</div>
      <section class="drawer-section"><div class="drawer-section-title"><h3>重要产品事件</h3><span>优先阅读</span></div><div class="announcement-card"><strong>${fund.announcement}</strong><p>${fund.announcementText}</p><span>${fund.date}</span></div></section>
      <section class="drawer-section"><div class="drawer-section-title"><h3>产品关注要点</h3></div><p style="color:var(--ink-600);font-size:11px;line-height:1.8">${fund.description}</p></section>
      <section class="drawer-section"><div class="drawer-section-title"><h3>持有客户</h3><span>${fund.customers.length} 位演示客户</span></div><div class="detail-list">${fund.customers.map(id => {
        const customer = customers[id];
        return `<button class="detail-list-item clickable-list-item" data-open-type="customer" data-open-id="${id}"><span><strong>${customer.name}</strong><small>${customer.risk} · ${customer.segment}</small></span><span>查看客户${icon("chevron-right")}</span></button>`;
      }).join("")}</div></section>
      ${fund.hotspots.length ? `<section class="drawer-section"><div class="drawer-section-title"><h3>相关市场热点</h3></div><div class="detail-list">${fund.hotspots.map(id => `<button class="detail-list-item clickable-list-item" data-open-type="hotspot" data-open-id="${id}"><span><strong>${hotspots[id].name}</strong><small>${hotspots[id].trendLabel} · 演示热点</small></span><span>查看${icon("chevron-right")}</span></button>`).join("")}</div></section>` : ""}
      <div class="risk-note" style="margin-top:20px">展业提示：不得将短期业绩或市场热点直接等同于购买建议，须结合客户风险承受能力、资金期限与投资目标。</div>
      <div class="drawer-actions"><button class="btn btn-secondary" data-action="ai-fund" data-open-id="${fund.id}">${icon("sparkles")}生成沟通要点</button><button class="btn btn-primary" data-action="new-task-fund" data-open-id="${fund.id}">${icon("plus")}新建任务</button></div>`;
  }

  function renderPortfolio(portfolio) {
    const customer = customers[portfolio.customerId];
    return `${backButton()}${demoBanner("组合指标与风险阈值均为演示内容，提醒仅用于触发人工检视。")}
      <div class="profile-card"><div class="profile-avatar">组</div><div class="profile-main"><strong>${portfolio.name}</strong><span>关联客户：${customer.name} · ${portfolio.risk}</span></div><span class="risk-badge">内部观察</span></div>
      <section class="drawer-section"><div class="detail-grid"><div class="detail-cell"><span>近一月表现（演示）</span><strong class="down">${portfolio.month}</strong></div><div class="detail-cell"><span>当前状态</span><strong>${portfolio.alert}</strong></div></div><div class="source-line">${icon("clock")}${portfolio.updated} · 非实时数据</div></section>
      <section class="drawer-section"><div class="drawer-section-title"><h3>资产配置示意</h3><span>穿透前</span></div><div class="portfolio-allocation"><div class="allocation-donut"></div><div class="allocation-legend">${portfolio.allocation.map(item => `<div class="legend-row"><span><i class="legend-dot" style="background:${item.color}"></i>${item.name}</span><strong>${item.value}%</strong></div>`).join("")}</div></div></section>
      <section class="drawer-section"><div class="drawer-section-title"><h3>组合持仓</h3><span>点击查看基金</span></div><div class="detail-list">${portfolio.holdings.map(holding => `<button class="detail-list-item clickable-list-item" data-open-type="fund" data-open-id="${holding.fundId}"><span><strong>${funds[holding.fundId].name}</strong><small>${funds[holding.fundId].type} · ${funds[holding.fundId].risk}</small></span><span>${holding.weight}</span></button>`).join("")}</div></section>
      <section class="drawer-section"><div class="drawer-section-title"><h3>检视建议</h3><span>非自动调仓</span></div><div class="risk-note">${portfolio.description}</div></section>
      <div class="drawer-actions"><button class="btn btn-secondary" data-action="ai-portfolio" data-open-id="${portfolio.id}">${icon("sparkles")}生成陪伴话术</button><button class="btn btn-primary" data-open-type="customer" data-open-id="${customer.id}">${icon("user")}进入客户详情</button></div>`;
  }

  function renderTask(task) {
    const statusText = task.status === "done" ? "已完成" : task.status === "snoozed" ? "已稍后提醒" : "待处理";
    return `${backButton()}${demoBanner("任务由演示规则生成，实际处理以内部业务制度和客户真实情况为准。")}
      <div class="task-detail-head"><div class="task-title-line"><span class="priority-badge ${task.priority}">${priorityLabels[task.priority]}</span><span class="type-badge">${typeLabels[task.type]}</span><span class="type-badge">${statusText}</span></div><p><strong>${escapeHTML(task.title)}</strong></p><p style="margin-top:7px">${escapeHTML(task.reason)}</p></div>
      <div class="task-stepper"><div class="task-step done" data-step="1">系统触发</div><div class="task-step ${task.status === "pending" ? "current" : "done"}" data-step="2">客户经理处理</div><div class="task-step ${task.status === "done" ? "done" : ""}" data-step="3">结果留痕</div></div>
      <section class="drawer-section"><div class="detail-grid"><div class="detail-cell"><span>计划完成时间</span><strong>${escapeHTML(task.due)}</strong></div><div class="detail-cell"><span>任务来源</span><strong>今日工作规则引擎</strong></div></div></section>
      ${task.relatedType ? `<section class="drawer-section"><div class="drawer-section-title"><h3>关联对象</h3><span>一键进入</span></div><div class="detail-list"><button class="detail-list-item clickable-list-item" data-open-type="${task.relatedType}" data-open-id="${task.relatedId}"><span><strong>${escapeHTML(task.relatedLabel)}</strong><small>${({ customer: "客户详情", fund: "基金详情", portfolio: "组合详情", hotspot: "热点详情" })[task.relatedType]}</small></span><span>打开${icon("chevron-right")}</span></button></div></section>` : ""}
      <section class="drawer-section"><div class="drawer-section-title"><h3>建议处理步骤</h3><span>供参考</span></div><ol class="rule-list"><li>阅读任务触发原因，核对客户与产品最新信息。</li><li>完成适当性、风险等级与资金期限复核。</li><li>记录沟通结果和下一步安排，再关闭任务。</li></ol></section>
      <div class="drawer-actions"><button class="btn btn-secondary" data-snooze-task="${task.id}">${icon("clock")}明日提醒</button>${task.status === "pending" ? `<button class="btn btn-primary" data-complete-task="${task.id}">${icon("check")}完成并留痕</button>` : `<button class="btn btn-primary" data-reopen-task="${task.id}">${icon("arrow-left")}重新打开</button>`}</div>`;
  }

  function renderHotspot(hotspot) {
    return `${backButton()}${demoBanner("热点为演示内容，排序不代表市场预测或产品推荐。")}
      <div class="hotspot-detail-hero"><strong>${hotspot.name}</strong><p>${hotspot.summary}</p><span class="hotspot-trend ${hotspot.trend}" style="margin-top:10px">${icon(hotspot.trend === "up" ? "trend-up" : hotspot.trend === "down" ? "trend-down" : "minus")}${hotspot.trendLabel}</span></div>
      <div class="source-line">${icon("clock")}演示资讯源 · 2026/10/28 08:45 · 非实时资讯</div>
      <section class="drawer-section"><div class="drawer-section-title"><h3>影响链条</h3><span>简化解构</span></div><div class="impact-chain">${hotspot.chain.map((item, index) => `${index ? icon("arrow-right") : ""}<span>${item}</span>`).join("")}</div></section>
      <section class="drawer-section"><div class="drawer-section-title"><h3>关联基金</h3><span>${hotspot.funds.length} 只演示产品</span></div>${hotspot.funds.length ? `<div class="detail-list">${hotspot.funds.map(id => `<button class="detail-list-item clickable-list-item" data-open-type="fund" data-open-id="${id}"><span><strong>${funds[id].name}</strong><small>${funds[id].type} · ${funds[id].risk}</small></span><span>查看${icon("chevron-right")}</span></button>`).join("")}</div>` : `<div class="empty-state" style="min-height:100px;padding:18px"><strong>暂无关联产品</strong><p>当前演示数据未建立产品映射。</p></div>`}</section>
      <section class="drawer-section"><div class="drawer-section-title"><h3>相关客户</h3><span>基于持有与关注</span></div>${hotspot.customers.length ? `<div class="detail-list">${hotspot.customers.map(id => `<button class="detail-list-item clickable-list-item" data-open-type="customer" data-open-id="${id}"><span><strong>${customers[id].name}</strong><small>${customers[id].risk} · 联系前复核适当性</small></span><span>查看${icon("chevron-right")}</span></button>`).join("")}</div>` : `<div class="empty-state" style="min-height:100px;padding:18px"><strong>暂无直接关联客户</strong><p>不建议将全市场热点无差别用于营销。</p></div>`}</section>
      <div class="risk-note" style="margin-top:20px">${hotspot.risk}</div>
      <div class="drawer-actions"><button class="btn btn-secondary" data-action="ai-hotspot" data-open-id="${hotspot.id}">${icon("sparkles")}生成解读草稿</button><button class="btn btn-primary" data-action="new-task-hotspot" data-open-id="${hotspot.id}">${icon("plus")}转为跟进任务</button></div>`;
  }

  function renderRules(type) {
    const isTask = type === "task";
    if (type === "market") {
      return `${backButton()}${demoBanner("以下为看市场页面的演示模型口径，正式上线前需由投研、风控与合规共同确认。")}
      <section class="drawer-section"><div class="drawer-section-title"><h3>市场温度计算</h3><span>公司模型负责</span></div><ol class="rule-list"><li>先将各类指标标准化为 0—100 的指标温度；温度描述市场状态冷热，不直接等于预期收益。</li><li>单资产温度由趋势、广度、情绪、利率或拥挤度等维度按权重合成。</li><li>综合温度为五类资产加权结果，当前演示权重为：国内权益 30%、海外权益 20%、债券 25%、黄金 10%、美元 15%。</li><li>温度档位：0—19 极冷，20—39 偏冷，40—59 中性，60—79 偏热，80—100 过热。</li><li>不同资产必须标注各自数据时段，跨市场比较前完成时点对齐。</li></ol></section>
      <section class="drawer-section"><div class="drawer-section-title"><h3>AI 观点推断</h3><span>AI 负责解释</span></div><ol class="rule-list"><li>AI 基于公司模型输出的温度、指标分歧和宏观传导关系生成研究观点。</li><li>每条观点必须包含观察期限、置信度、支撑因素、反向风险和失效条件。</li><li>对拥挤度较高或指标背离的资产，AI 必须同时提示趋势支撑与反转风险。</li><li>AI 观点仅用于晨会研究与客户沟通准备，须人工复核，不构成投资建议。</li></ol></section>
      <section class="drawer-section"><div class="drawer-section-title"><h3>模型边界</h3><span>透明原则</span></div><div class="risk-note">温度不是择时信号，综合分数不能替代客户层面的适当性判断。正式版本应展示数据源、更新时间、模型版本、指标权重和历史回测结果；演示权重不代表最终业务参数。</div></section>`;
    }
    return `${backButton()}${demoBanner("以下为首版原型的规则说明，后续可由业务与合规团队共同配置。")}
      <section class="drawer-section"><div class="drawer-section-title"><h3>${isTask ? "任务优先级" : "热点排序依据"}</h3></div>${isTask ? `<ol class="rule-list"><li><strong>紧急：</strong>合规时限、逾期事项和需要优先检视的重大风险提醒。</li><li><strong>重要：</strong>客户约定回访、重要基金公告和组合持仓变化。</li><li><strong>普通：</strong>一般跟进周期提醒与经适当性约束的展业线索。</li><li>同一优先级内按计划完成时间排序，不仅按客户资产规模排序。</li></ol>` : `<ol class="rule-list"><li>资讯讨论度：重要资讯的数量、来源质量与变化趋势。</li><li>市场变化：相关资产和板块是否出现可核实的变化。</li><li>展业关联度：与客户已有持仓、关注基金和待办的关联程度。</li><li>首版仅展示“升温、持续、降温”等状态，不制造虚假精确分数。</li></ol>`}</section>
      <section class="drawer-section"><div class="drawer-section-title"><h3>内容边界</h3></div><div class="risk-note">${isTask ? "系统任务用于辅助安排工作，不能替代客户经理的独立判断。涉及客户沟通与产品推荐时，必须完成适当性复核。" : "热点用于晨会观察与客户沟通准备，不直接生成买卖建议，也不代表热点仍将持续。"}</div></section>`;
  }

  function aiResponse(prompt) {
    if (prompt.includes("看市场") && window.MarketDashboard) {
      return window.MarketDashboard.aiDraft(prompt);
    }
    if ((prompt.includes("配基金") || prompt.includes("选基")) && window.FundPicker) {
      return window.FundPicker.aiDraft(prompt);
    }
    if ((prompt.includes("建组合") || prompt.includes("再平衡") || prompt.includes("诊断")) && window.PortfolioBuilder) {
      return window.PortfolioBuilder.aiDraft(prompt);
    }
    if ((prompt.includes("找客户") || prompt.includes("商机") || prompt.includes("客户经营")) && window.CustomerLink) {
      return window.CustomerLink.aiDraft(prompt);
    }
    if ((prompt.includes("陪持有") || prompt.includes("平行宇宙") || prompt.includes("归因") || prompt.includes("止盈") || prompt.includes("亏损") || prompt.includes("持仓") || prompt.includes("异动")) && window.Companion) {
      return window.Companion.aiDraft(prompt);
    }
    if (prompt.includes("基金") || prompt.includes("公告")) {
      return "以下为基于演示数据生成的沟通草稿：\n\n1. 先说明事实：基金已发布重要公告，建议以正式公告原文为准。\n2. 再了解客户：确认客户是否关注到变化，以及近期资金安排。\n3. 解释影响：说明产品管理安排变化，不推测短期业绩。\n4. 记录后续：如客户需要，可安排进一步产品资料解读。\n\n请客户经理复核后使用，不构成投资建议。";
    }
    if (prompt.includes("组合") || prompt.includes("陪伴")) {
      return "以下为陪持有沟通框架：\n\n“我注意到您的组合近期出现了一些波动，想先了解一下您的持有感受和未来资金安排。我们可以一起检视组合结构、风险来源和投资期限，再决定是否需要进一步处理。短期波动本身不代表必须立即调整。”\n\n该文本仅为演示草稿，请结合客户真实情况复核。";
    }
    if (prompt.includes("晨会")) {
      return "晨会 60 秒摘要（演示）：\n\n今日重点不是追逐热点，而是做好持仓解释。会前优先处理 2 项紧急任务；会中讨论红利低波、债市波动与科技成长三个观察方向；会后按客户风险等级与真实需求安排回访。所有行情和资讯均需以正式数据源复核。";
    }
    return "我建议按“事实变化—客户影响—风险边界—下一步动作”组织这段展业内容。\n\n当前为原型演示，我可以基于页面中的演示客户、基金、组合和任务生成摘要或沟通草稿，但不会自动向客户发送内容，也不会生成未经人工确认的投资建议。";
  }

  function renderAi() {
    return `${backButton()}<div class="ai-welcome"><div class="ai-welcome-icon">${icon("sparkles")}</div><h3>今天需要我协助什么？</h3><p>可基于当前演示页面生成晨会摘要、基金沟通要点与陪持有话术。内容须由客户经理复核。</p></div>
      <section class="drawer-section"><div class="drawer-section-title"><h3>快捷提问</h3><span>演示能力</span></div><div class="ai-prompts"><button class="ai-prompt" data-ai-prompt="生成本次晨会的 60 秒摘要">生成本次晨会的 60 秒摘要</button><button class="ai-prompt" data-ai-prompt="解释基金公告并生成客户沟通要点">解释基金公告并生成客户沟通要点</button><button class="ai-prompt" data-ai-prompt="为组合波动客户生成陪持有话术">为组合波动客户生成陪持有话术</button></div></section>
      <div class="ai-conversation" id="aiConversation">${state.aiMessages.map(message => `<div class="chat-message ${message.role}">${escapeHTML(message.text)}</div>`).join("")}</div>
      <form class="ai-input-form" id="aiInputForm"><input name="prompt" maxlength="200" placeholder="输入你的展业问题" aria-label="向 AI 助手提问"><button type="submit" aria-label="发送">${icon("send")}</button></form>
      <div class="source-line">${icon("info")}AI 生成内容仅作草稿，数据来源与时点需人工复核</div>`;
  }

  function openDrawer(type, id, reset = false) {
    if (reset || drawerOverlay.hidden) state.drawerStack = [];
    state.drawerStack.push({ type, id });
    renderDrawer();
    drawerOverlay.hidden = false;
    syncBodyLock();
  }

  function renderDrawer() {
    const current = state.drawerStack[state.drawerStack.length - 1];
    if (!current) return;
    const { type, id } = current;
    let title = "详情";
    let eyebrow = "基金智库";
    let content = "";
    if (type === "customer" && customers[id]) { title = customers[id].name; eyebrow = "客户详情 · 演示"; content = renderCustomer(customers[id]); }
    if (type === "fund" && funds[id]) { title = "基金详情"; eyebrow = "产品档案 · 演示"; content = renderFund(funds[id]); }
    if (type === "portfolio" && portfolios[id]) { title = portfolios[id].name; eyebrow = "组合详情 · 演示"; content = renderPortfolio(portfolios[id]); }
    if (type === "task" && tasks.find(task => task.id === id)) { title = "任务详情"; eyebrow = `${id} · 今日必办`; content = renderTask(tasks.find(task => task.id === id)); }
    if (type === "hotspot" && hotspots[id]) { title = "热点详情"; eyebrow = "市场热点 · 演示"; content = renderHotspot(hotspots[id]); }
    if (type === "screenerFund" && window.FundPicker) { title = "基金详情"; eyebrow = "配基金 · 演示"; content = backButton() + window.FundPicker.detailHTML(id); }
    if (type === "fundCompare" && window.FundPicker) { title = "基金对比"; eyebrow = "最多 5 只 · 演示"; content = backButton() + window.FundPicker.compareHTML(); }
    if (type === "fundPoints" && window.FundPicker) { title = "行业与主题标签判定口径"; eyebrow = "透明规则 · 可配置"; content = backButton() + window.FundPicker.pointsHTML(); }
    if (type === "fundSales" && window.FundPicker) { title = "基金销售一页纸"; eyebrow = "配基金 · AI 辅助起草"; content = backButton() + window.FundPicker.salesHTML(id); }
    if (type === "allMarketFund" && window.FundPicker) { title = "全市场基金详情"; eyebrow = "配基金 · 真实数据"; content = backButton() + window.FundPicker.amsDetailHTML(id); }
    if (type === "schemeBasis" && window.PortfolioBuilder) { title = "方案计算依据"; eyebrow = "建组合 · 透明规则 · 可配置"; content = backButton() + window.PortfolioBuilder.basisHTML(); }
    if (type === "schemeCompare" && window.PortfolioBuilder) { title = "方案对比"; eyebrow = "建组合 · 最多 3 个方案"; content = backButton() + window.PortfolioBuilder.compareHTML(); }
    if (type === "cltCustomer" && window.CustomerLink) { const c = window.CustomerLink; title = "客户画像卡"; eyebrow = "找客户 · 全景画像 · 演示"; content = backButton() + c.detailHTML(id); }
    if (type === "cltScript" && window.CustomerLink) { title = "话术生成"; eyebrow = "找客户 · 8 类场景 · 合规校验"; content = backButton() + window.CustomerLink.scriptHTML(id); }
    if (type === "cpCustomer" && window.Companion) { title = "客户陪持有画像"; eyebrow = "陪持有 · 持仓与归因 · 演示"; content = backButton() + window.Companion.detailHTML(id); }
    if (type === "cpUniverse" && window.Companion) { title = "平行宇宙复盘"; eyebrow = "陪持有 · 假设性回测 · 演示"; content = backButton() + window.Companion.universeDetailHTML(id); }
    if (type === "cpScript" && window.Companion) { title = "陪伴话术"; eyebrow = "陪持有 · 8 类模板 · 合规校验"; content = backButton() + window.Companion.scriptHTML(id); }
    if (type === "cpRules") { title = "陪持有规则与口径"; eyebrow = "陪持有 · 透明规则 · 可配置"; content = backButton() + window.Companion.rulesHTML(); }
    if (type === "dsSources" && window.DataSourceBadge) { title = "数据源管理"; eyebrow = "真实行情 · 三源比对"; content = backButton() + window.DataSourceBadge.sourceDrawerHTML(); }
    if (type === "rules") { title = id === "task" ? "任务排序规则" : id === "market" ? "市场温度与 AI 口径" : "热点排名规则"; eyebrow = "透明规则 · 可配置"; content = renderRules(id); }
    if (type === "ai") { title = "AI 展业助手"; eyebrow = "辅助起草 · 人工复核"; content = renderAi(); }
    if (!content) { title = "内容暂未接入"; content = `${backButton()}<div class="empty-state"><strong>未找到对应内容</strong><p>请返回首页重新选择。</p></div>`; }
    $("#drawerTitle").textContent = title;
    $("#drawerEyebrow").textContent = eyebrow;
    drawerContent.innerHTML = content;
    drawerContent.scrollTop = 0;
  }

  function closeDrawer() {
    drawerOverlay.hidden = true;
    state.drawerStack = [];
    syncBodyLock();
  }

  function openAi(prompt = "") {
    openDrawer("ai", "assistant", true);
    if (prompt) setTimeout(() => handleAiPrompt(prompt), 80);
  }

  function handleAiPrompt(prompt) {
    const cleanPrompt = String(prompt || "").trim();
    if (!cleanPrompt) return;
    state.aiMessages.push({ role: "user", text: cleanPrompt });
    state.aiMessages.push({ role: "assistant", text: aiResponse(cleanPrompt) });
    renderDrawer();
    setTimeout(() => { drawerContent.scrollTop = drawerContent.scrollHeight; }, 0);
  }

  function openBriefing(section = "") {
    briefingModal.hidden = false;
    syncBodyLock();
    if (section) {
      const target = ({ market: "#briefSectionMarket", news: "#briefSectionNews", action: "#briefSectionAction" })[section];
      if (target) setTimeout(() => $(target).scrollIntoView({ block: "start", behavior: "smooth" }), 60);
    } else {
      $(".briefing-document").scrollTop = 0;
    }
  }

  function closeBriefing() {
    briefingModal.hidden = true;
    syncBodyLock();
  }

  const briefingText = `【基金智库晨会摘要｜2026年10月28日】\n今日主线：结构性行情下，做好持仓解释与风险预期管理。\n\n一、市场概览\n不同市场交易时段分别观察，不仅依据单日涨跌判断趋势。\n\n二、重要事件\n1. 防御与现金流质量话题热度上升，需提示风格轮动与回撤风险。\n2. 债市波动引发固收产品持有体验关注，应区分利率、久期与信用风险。\n3. 科技成长板块成交活跃，热点活跃度不等于持续性。\n\n三、今日展业提示\n会前优先检视组合风险提醒并阅读基金公告；会中统一陪伴沟通口径；会后按任务优先级回访。\n\n注：本摘要来自产品原型，所有行情、资讯与产品信息均为演示数据，不构成投资建议。`;

  async function copyText(text, successMessage = "晨会摘要已复制，请复核后使用") {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      showToast(successMessage);
    } catch (error) {
      showToast("复制失败，请在晨会一页纸中手动选择文本", "info");
    }
  }

  function openNewTask(prefill = {}) {
    if (!drawerOverlay.hidden) closeDrawer();
    const form = $("#newTaskForm");
    form.reset();
    if (prefill.title) form.elements.title.value = prefill.title;
    if (prefill.type) form.elements.type.value = prefill.type;
    if (prefill.customer) form.elements.customer.value = prefill.customer;
    if (prefill.reason) form.elements.reason.value = prefill.reason;
    newTaskModal.hidden = false;
    syncBodyLock();
    setTimeout(() => form.elements.title.focus(), 50);
  }

  function closeNewTask() {
    newTaskModal.hidden = true;
    syncBodyLock();
  }

  function getSearchIndex() {
    return [
      ...Object.values(customers).map(item => ({ type: "customer", id: item.id, title: item.name, subtitle: `${item.risk} · ${item.segment}`, label: "客户", icon: "user" })),
      ...Object.values(funds).map(item => ({ type: "fund", id: item.id, title: item.name, subtitle: `${item.code} · ${item.type} · ${item.risk}`, label: "基金", icon: "fund" })),
      ...Object.values(portfolios).map(item => ({ type: "portfolio", id: item.id, title: item.name, subtitle: `${customers[item.customerId].name} · ${item.risk}`, label: "组合", icon: "portfolio" })),
      ...tasks.filter(item => item.status === "pending").map(item => ({ type: "task", id: item.id, title: item.title, subtitle: `${item.due} · ${typeLabels[item.type]}`, label: "任务", icon: "check-circle" })),
      ...Object.values(hotspots).map(item => ({ type: "hotspot", id: item.id, title: item.name, subtitle: `${item.trendLabel} · 市场热点`, label: "热点", icon: "flame" }))
    ];
  }

  function renderSearchResults(query = "") {
    const normalized = query.trim().toLowerCase();
    const all = getSearchIndex();
    state.searchResults = (normalized ? all.filter(item => `${item.title}${item.subtitle}${item.id}`.toLowerCase().includes(normalized)) : all.filter(item => ["C001", "F001", "P001", "T002", "H001"].includes(item.id))).slice(0, 9);
    state.searchSelected = Math.min(state.searchSelected, Math.max(0, state.searchResults.length - 1));
    $("#searchHint").textContent = normalized ? `找到 ${state.searchResults.length} 个匹配结果` : "常用入口与最近访问";
    $("#searchResults").innerHTML = state.searchResults.length ? state.searchResults.map((item, index) => `
      <button class="search-result ${index === state.searchSelected ? "selected" : ""}" data-search-index="${index}">
        <span class="search-result-icon">${icon(item.icon)}</span><span class="search-result-main"><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.subtitle)}</small></span><span class="search-result-type">${item.label}</span>${icon("chevron-right")}
      </button>`).join("") : `<div class="search-empty">未找到匹配内容，可尝试客户姓氏、基金名称或任务关键词。</div>`;
  }

  function openSearch() {
    notificationPanel.hidden = true;
    searchOverlay.hidden = false;
    state.searchSelected = 0;
    $("#searchInput").value = "";
    renderSearchResults();
    syncBodyLock();
    setTimeout(() => $("#searchInput").focus(), 40);
  }

  function closeSearch() {
    searchOverlay.hidden = true;
    syncBodyLock();
  }

  function selectSearchResult(index) {
    const item = state.searchResults[index];
    if (!item) return;
    closeSearch();
    openDrawer(item.type, item.id, true);
  }

  function completeTask(id) {
    const task = tasks.find(item => item.id === id);
    if (!task) return;
    task.status = "done";
    renderTasks();
    if (!drawerOverlay.hidden && state.drawerStack[state.drawerStack.length - 1]?.id === id) renderDrawer();
    showToast(`已完成：${task.title}`);
  }

  function setTaskFilter(filter, highOnly = false) {
    state.taskFilter = filter;
    state.highOnly = highOnly;
    state.showAll = highOnly;
    renderTasks();
    $("#taskSection").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  $("#globalSearchBtn").addEventListener("click", openSearch);
  $("#morningModeBtn").addEventListener("click", () => openBriefing());
  $("#viewBriefBtn").addEventListener("click", () => openBriefing());
  $("#copyBriefBtn").addEventListener("click", () => copyText(briefingText));
  $("#copyFullBriefBtn").addEventListener("click", () => copyText(briefingText));
  $("#printBriefBtn").addEventListener("click", () => window.print());
  $("#newTaskBtn").addEventListener("click", () => openNewTask());
  $("#openAiBtn").addEventListener("click", () => openAi());
  $("#toggleAllTasks").addEventListener("click", () => { state.showAll = !state.showAll; renderTasks(); });
  $("#taskPreferenceBtn").addEventListener("click", () => openDrawer("rules", "task"));
  $("#hotspotRuleBtn").addEventListener("click", () => openDrawer("rules", "hotspot"));
  $("#searchInput").addEventListener("input", event => { state.searchSelected = 0; renderSearchResults(event.target.value); });

  $("#notificationBtn").addEventListener("click", event => {
    event.stopPropagation();
    notificationPanel.hidden = !notificationPanel.hidden;
  });

  $("#newTaskForm").addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(event.target);
    const customerId = data.get("customer");
    const id = `T${String(tasks.length + 1).padStart(3, "0")}`;
    tasks.push({
      id,
      type: data.get("type"),
      priority: data.get("priority"),
      title: data.get("title").trim(),
      reason: data.get("reason").trim() || "由客户经理手动创建，处理时请补充沟通结果与下一步安排。",
      due: `今天 ${data.get("due") || "16:00"}`,
      status: "pending",
      relatedType: customerId ? "customer" : null,
      relatedId: customerId || null,
      relatedLabel: customerId ? customers[customerId].name : null,
      action: customerId ? "查看客户" : "查看任务"
    });
    closeNewTask();
    state.taskFilter = "all";
    state.highOnly = false;
    state.showAll = false;
    renderTasks();
    showToast("新任务已加入今日必办");
    $("#taskSection").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.addEventListener("submit", event => {
    if (event.target.id === "aiInputForm") {
      event.preventDefault();
      const input = event.target.elements.prompt;
      handleAiPrompt(input.value);
    }
  });

  document.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) {
      if (!event.target.closest(".notification-wrap")) notificationPanel.hidden = true;
      return;
    }

    if (button.dataset.openType) openDrawer(button.dataset.openType, button.dataset.openId);
    if (button.hasAttribute("data-close-drawer")) closeDrawer();
    if (button.hasAttribute("data-close-briefing")) closeBriefing();
    if (button.hasAttribute("data-close-new-task")) closeNewTask();
    if (button.hasAttribute("data-drawer-back")) { state.drawerStack.pop(); renderDrawer(); }
    if (button.dataset.taskFilter) setTaskFilter(button.dataset.taskFilter);
    if (button.dataset.summaryFilter) setTaskFilter(button.dataset.summaryFilter === "high" ? "all" : button.dataset.summaryFilter, button.dataset.summaryFilter === "high");
    if (button.dataset.hotspotFilter) {
      state.hotspotFilter = button.dataset.hotspotFilter;
      $$("[data-hotspot-filter]").forEach(item => item.classList.toggle("active", item === button));
      renderHotspots();
    }
    if (button.dataset.completeTask) completeTask(button.dataset.completeTask);
    if (button.dataset.reopenTask) {
      const task = tasks.find(item => item.id === button.dataset.reopenTask);
      if (task) { task.status = "pending"; renderTasks(); renderDrawer(); showToast("任务已重新打开", "info"); }
    }
    if (button.dataset.snoozeTask) {
      const task = tasks.find(item => item.id === button.dataset.snoozeTask);
      if (task) { task.status = "snoozed"; task.due = "明天 09:00"; closeDrawer(); renderTasks(); showToast("已转为明日 09:00 提醒", "info"); }
    }
    if (button.dataset.processTask) {
      const task = tasks.find(item => item.id === button.dataset.processTask);
      if (task) openDrawer(task.relatedType || "task", task.relatedId || task.id);
    }
    if (button.dataset.searchIndex !== undefined) selectSearchResult(Number(button.dataset.searchIndex));
    if (button.dataset.briefingSection) openBriefing(button.dataset.briefingSection);
    if (button.dataset.aiPrompt) handleAiPrompt(button.dataset.aiPrompt);
    if (button.dataset.nav) {
      const nav = button.dataset.nav;
      if (nav === "today") {
        ["#marketPage", "#fundPage", "#portfolioPage", "#customerPage", "#companionPage"].forEach(sel => { const el = $(sel); if (el) el.hidden = true; });
        $("#compareTray").hidden = true;
        $("#todayPage").hidden = false;
        $$(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.nav === "today"));
        document.title = "今日工作｜基金智库工作台";
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (nav === "market" && window.MarketDashboard) {
        window.MarketDashboard.show();
      } else if (nav === "fund" && window.FundPicker) {
        window.FundPicker.show();
      } else if (nav === "portfolio" && window.PortfolioBuilder) {
        window.PortfolioBuilder.show();
      } else if (nav === "customer" && window.CustomerLink) {
        window.CustomerLink.show();
      } else if (nav === "companion" && window.Companion) {
        window.Companion.show();
      } else {
        showToast(`“${button.textContent.trim()}”将在后续版本接入，当前原型包含今日工作、看市场、配基金、建组合、陪持有与找客户`, "info");
      }
    }
    if (button.dataset.action === "record-follow") showToast(`已为${button.dataset.name}创建跟进草稿，可在任务中继续完善`, "info");
    if (button.dataset.action === "new-task-customer") {
      const customer = customers[button.dataset.openId];
      openNewTask({ title: `跟进${customer.name}，复核近期持有体验与资金安排`, type: "customer", customer: customer.id, reason: customer.note });
    }
    if (button.dataset.action === "new-task-fund") {
      const fund = funds[button.dataset.openId];
      openNewTask({ title: `阅读${fund.name}产品资料并安排持有客户沟通`, type: "fund", reason: fund.announcementText });
    }
    if (button.dataset.action === "new-task-hotspot") {
      const hotspot = hotspots[button.dataset.openId];
      openNewTask({ title: `复核热点“${hotspot.name}”与相关客户的沟通需求`, type: "opportunity", reason: hotspot.risk });
    }
    if (button.dataset.action === "ai-fund") openAi(`解释${funds[button.dataset.openId].name}基金公告并生成客户沟通要点`);
    if (button.dataset.action === "ai-portfolio") openAi(`为${portfolios[button.dataset.openId].name}波动客户生成陪持有话术`);
    if (button.dataset.action === "ai-hotspot") openAi(`解读热点“${hotspots[button.dataset.openId].name}”，生成晨会摘要`);

    if (!event.target.closest(".notification-wrap")) notificationPanel.hidden = true;
  });

  [drawerOverlay, briefingModal, searchOverlay, newTaskModal].forEach(overlay => {
    overlay.addEventListener("click", event => {
      if (event.target !== overlay) return;
      if (overlay === drawerOverlay) closeDrawer();
      if (overlay === briefingModal) closeBriefing();
      if (overlay === searchOverlay) closeSearch();
      if (overlay === newTaskModal) closeNewTask();
    });
  });

  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (searchOverlay.hidden) openSearch(); else closeSearch();
      return;
    }
    if (!searchOverlay.hidden && ["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) {
      event.preventDefault();
      if (event.key === "ArrowDown") state.searchSelected = Math.min(state.searchSelected + 1, state.searchResults.length - 1);
      if (event.key === "ArrowUp") state.searchSelected = Math.max(state.searchSelected - 1, 0);
      if (event.key === "Enter") { selectSearchResult(state.searchSelected); return; }
      renderSearchResults($("#searchInput").value);
      const selected = $(".search-result.selected");
      if (selected) selected.scrollIntoView({ block: "nearest" });
      return;
    }
    if (event.key === "Escape") {
      if (!searchOverlay.hidden) closeSearch();
      else if (!newTaskModal.hidden) closeNewTask();
      else if (!briefingModal.hidden) closeBriefing();
      else if (!drawerOverlay.hidden) closeDrawer();
      else notificationPanel.hidden = true;
    }
  });

  window.FundThinkTank = { openDrawer, openAi, showToast, copyText, openBriefing, renderDrawer, closeDrawer };

  renderTasks();
  renderHotspots();
})();
