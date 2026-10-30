/* -*- coding: utf-8 -*-
 * 基金智库工作台 · 数据源交叉验证展示组件
 * ============================================================
 * 职责：读取 data_service/output/funds.json（真实行情 + 三源交叉验证结果），
 *       在「看市场」页注入真实指数行情栏与数据源状态；
 *       对存在冲突的基金，提供「数据源比对」并排展示。
 *
 * 设计原则：
 *   - 纯前端渐进增强：funds.json 不存在 / fetch 失败时，静默降级，
 *     不影响原有演示原型。
 *   - 不消耗 token：仅读取本地 JSON 文件，数据由 Python 服务离线生成。
 *   - 不一致时「同时列出每个数据源的数据」，不静默取任一值。
 */
(function () {
  "use strict";

  var FUNDS_JSON = "data_service/output/funds.json";
  var state = {
    loaded: false,
    funds: [],
    indexes: [],
    meta: null,
    generated_at: "",
  };

  /* ---------- 工具 ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function fmt(v, digits) {
    if (v === null || v === undefined) return "—";
    var n = Number(v);
    if (isNaN(n)) return "—";
    return n.toFixed(digits === undefined ? 2 : digits);
  }
  function pctClass(v) {
    // A 股惯例：涨红跌绿
    if (v > 0) return "ds-up";
    if (v < 0) return "ds-down";
    return "ds-flat";
  }
  function pctText(v) {
    if (v === null || v === undefined) return "—";
    var n = Number(v);
    var s = (n > 0 ? "+" : "") + n.toFixed(2) + "%";
    return s;
  }

  /* ---------- 加载 funds.json ---------- */
  function load() {
    return fetch(FUNDS_JSON, { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("http " + r.status);
        return r.json();
      })
      .then(function (j) {
        state.loaded = true;
        state.funds = j.funds || [];
        state.indexes = j.indexes || [];
        state.meta = j.meta || null;
        state.generated_at = j.generated_at || "";
        return state;
      })
      .catch(function () {
        state.loaded = false;
        return state;
      });
  }

  /* ---------- 数据源状态栏（注入看市场页头部） ---------- */
  function injectMarketHeader() {
    if (!state.loaded || !state.indexes.length) return;

    var marketPage = document.getElementById("marketPage");
    if (!marketPage) return;

    // 避免重复注入
    if (document.getElementById("dsLiveBar")) return;

    var wrap = el("div", "ds-live-wrap");
    wrap.id = "dsLiveBar";

    // 1) 顶部行情条
    var bar = el("div", "ds-live-bar");

    var left = el("div", "ds-live-left");
    left.appendChild(el("span", "ds-live-title", "实时行情"));
    left.appendChild(el("span", "ds-live-src", "数据源：新浪财经 / 东方财富"));
    left.appendChild(el("span", "ds-live-time", "更新 " + state.generated_at.slice(11)));

    var right = el("div", "ds-live-indexes");
    state.indexes.slice(0, 7).forEach(function (idx) {
      var item = el("div", "ds-idx");
      item.appendChild(el("span", "ds-idx-name", idx.name));
      var price = el("span", "ds-idx-price " + pctClass(idx.pct), fmt(idx.price));
      item.appendChild(price);
      var pct = el("span", "ds-idx-pct " + pctClass(idx.pct), pctText(idx.pct));
      item.appendChild(pct);
      right.appendChild(item);
    });

    bar.appendChild(left);
    bar.appendChild(right);
    wrap.appendChild(bar);

    // 2) 指数涨跌条形图（横向，红涨绿跌）
    var chart = el("div", "ds-idx-chart");
    var chartHead = el("div", "ds-idx-chart-head");
    chartHead.appendChild(el("span", "ds-idx-chart-title", "主要指数当日涨跌"));
    chartHead.appendChild(el("span", "ds-idx-chart-sub", "红涨绿跌 · 真实行情"));
    chart.appendChild(chartHead);

    var maxAbs = 0;
    state.indexes.forEach(function (i) { maxAbs = Math.max(maxAbs, Math.abs(Number(i.pct) || 0)); });
    maxAbs = maxAbs || 4.5;

    state.indexes.forEach(function (idx) {
      var pct = Number(idx.pct) || 0;
      var row = el("div", "ds-idx-row");
      var name = el("span", "ds-idx-row-name", idx.name);
      var track = el("div", "ds-idx-track");
      var fill = el("div", "ds-idx-fill " + (pct >= 0 ? "up" : "down"));
      var w = Math.min(100, Math.abs(pct) / maxAbs * 100);
      fill.style.width = w + "%";
      track.appendChild(fill);
      var val = el("span", "ds-idx-row-val " + pctClass(pct), pctText(pct));
      row.appendChild(name);
      row.appendChild(track);
      row.appendChild(val);
      chart.appendChild(row);
    });
    wrap.appendChild(chart);

    // 注入到 marketPage 的 demo-notice 之后、hero-grid 之前
    var anchor = marketPage.querySelector(".demo-notice");
    if (anchor && anchor.nextSibling) {
      marketPage.insertBefore(wrap, anchor.nextSibling);
    } else {
      marketPage.insertBefore(wrap, marketPage.firstChild);
    }
  }

  /* ---------- 数据源状态入口（追加到看市场头部按钮区） ---------- */
  function injectSourceEntry() {
    if (!state.loaded) return;
    var heading = document.querySelector("#marketPage .heading-actions");
    if (!heading || document.getElementById("dsSourceBtn")) return;

    var btn = el("button", "btn btn-secondary");
    btn.id = "dsSourceBtn";
    btn.innerHTML =
      '<svg><use href="#i-info"/></svg>数据源管理';
    btn.addEventListener("click", function () {
      if (window.FundThinkTank) window.FundThinkTank.openDrawer("dsSources");
    });
    heading.insertBefore(btn, heading.firstChild);
  }

  /* ---------- 数据源比对抽屉内容 ---------- */
  function sourceDrawerHTML() {
    if (!state.loaded) {
      return '<div class="ds-empty">未检测到本地数据服务输出（data_service/output/funds.json）。<br>请先运行 <code>python data_service/run.py</code> 生成真实行情数据。</div>';
    }
    var html = "";
    html += '<div class="ds-drawer-head">';
    html += '<span class="section-kicker">数据源管理</span>';
    html += "<h2>三源数据状态</h2>";
    html += '<p>主源「东方财富」+ 验证源「盈米」+ 兜底源「蛋卷」，逐字段比对，不一致时并排列出各源数据。</p>';
    html += "</div>";

    // 汇总统计卡
    var conflictCount = state.funds.filter(function (f) { return f.conflict; }).length;
    var okCount = state.funds.length - conflictCount;
    html += '<div class="ds-stat-grid">';
    html += '<div class="ds-stat"><strong>' + state.funds.length + '</strong><span>监测基金</span></div>';
    html += '<div class="ds-stat ok"><strong>' + okCount + '</strong><span>多源一致</span></div>';
    html += '<div class="ds-stat conflict"><strong>' + conflictCount + '</strong><span>存在差异</span></div>';
    html += '<div class="ds-stat"><strong>' + state.indexes.length + '</strong><span>指数行情</span></div>';
    html += "</div>";

    // 元信息
    html += '<div class="ds-meta">';
    html += '<span>数据生成时间：' + (state.generated_at || "—") + '</span>';
    html += '<span>盈米源：' + (state.meta && state.meta.yingmi_enabled ? "已启用" : "未启用") + '</span>';
    html += '<button class="btn btn-secondary btn-small" id="dsRefreshBtn"><svg><use href="#i-sliders"/></svg>刷新数据</button>';
    html += "</div>";

    // 数据源健康度
    html += '<div class="ds-source-strip">';
    var names = ["东方财富(主)", "盈米(验证)", "蛋卷(兜底)"];
    var statesMap = sourceHealth();
    names.forEach(function (n) {
      var ok = statesMap[n];
      html +=
        '<div class="ds-src ' + (ok ? "ok" : "down") + '">' +
        '<span class="ds-src-dot"></span>' + n +
        '<small>' + (ok ? "正常" : "未接入/异常") + "</small></div>";
    });
    html += "</div>";

    if (state.meta && state.meta.yingmi_enabled === false) {
      html += '<div class="ds-note"><svg><use href="#i-alert"/></svg><span>盈米源未配置 API Key，当前自动降级为「东方财富 + 蛋卷」双源交叉验证。配置后自动启用三源比对。</span></div>';
    }

    // 基金比对列表
    html += '<div class="ds-fund-list">';
    if (!state.funds.length) {
      html += '<div class="ds-empty">暂无基金数据。</div>';
    } else {
      state.funds.forEach(function (f) {
        var conflictCls = f.conflict ? "conflict" : "ok";
        html += '<div class="ds-fund-card ' + conflictCls + '">';
        html += '<div class="ds-fund-head">';
        html += '<div class="ds-fund-title"><strong>' + (f.name || f.code) + "</strong><span>" + f.code + "</span></div>";
        html += '<span class="ds-fund-tag ' + conflictCls + '">' + (f.conflict ? "⚠ 数据不一致" : "✓ 多源一致") + "</span>";
        html += "</div>";

        // 采用值
        html += '<div class="ds-adopt">采用值：净值 <b>' + fmt(f.nav, 4) + "</b> · 涨跌 <b class='" + pctClass(f.pct) + "'>" + pctText(f.pct) + "</b> · 净值日期 " + (f.nav_date || "—") + ' · <small>来源 ' + f.adopted_source + "</small></div>";

        // 并排比对表（核心：每个源一列）
        html += '<table class="ds-compare"><thead><tr><th>数据源</th><th>单位净值</th><th>累计净值</th><th>日涨跌</th><th>净值日期</th></tr></thead><tbody>';
        (f.sources || []).forEach(function (s) {
          html +=
            "<tr>" +
            "<td>" + s.name + "</td>" +
            "<td>" + fmt(s.nav, 4) + "</td>" +
            "<td>" + fmt(s.acc_nav, 4) + "</td>" +
            '<td class="' + pctClass(s.pct) + '">' + pctText(s.pct) + "</td>" +
            "<td>" + (s.nav_date || "—") + "</td></tr>";
        });
        html += "</tbody></table>";

        // 冲突明细
        if (f.conflict && f.conflicts && f.conflicts.length) {
          html += '<div class="ds-conflict-note">';
          f.conflicts.forEach(function (c) {
            var fieldName = { nav: "单位净值", acc_nav: "累计净值", pct: "日涨跌幅", nav_date: "净值日期", scale: "规模" }[c.field] || c.field;
            var vals = Object.keys(c.values).map(function (k) { return k + " " + fmt(c.values[k], 4); }).join(" ／ ");
            html += "<div>字段「" + fieldName + "」不一致：" + vals + "</div>";
          });
          html += "</div>";
        }
        html += "</div>";
      });
    }
    html += "</div>";

    html += '<div class="ds-disclaimer"><svg><use href="#i-alert"/></svg><span>以上为免费公开接口拉取的真实数据（原型演示与内部试用），不构成投资建议。数据源可能与官方披露存在时点差异，正式使用需保留来源、时点与人工复核记录。</span></div>';
    return html;
  }

  function sourceHealth() {
    // 依据 funds.json 中各源是否出现在 sources 中判断健康度
    var health = { "东方财富(主)": false, "盈米(验证)": false, "蛋卷(兜底)": false };
    state.funds.forEach(function (f) {
      (f.sources || []).forEach(function (s) {
        if (s.name === "东方财富") health["东方财富(主)"] = true;
        if (s.name === "盈米") health["盈米(验证)"] = true;
        if (s.name === "蛋卷") health["蛋卷(兜底)"] = true;
      });
    });
    return health;
  }

  /* ---------- 初始化 ---------- */
  function init() {
    load().then(function () {
      if (!state.loaded) return; // 静默降级，不影响原型
      injectMarketHeader();
      injectSourceEntry();
    });

    // 刷新按钮（事件委托，抽屉内容动态注入）
    document.addEventListener("click", function (e) {
      var btn = e.target.closest("#dsRefreshBtn");
      if (!btn) return;
      btn.disabled = true;
      btn.textContent = "刷新中…";
      reload().then(function () {
        if (window.FundThinkTank) window.FundThinkTank.renderDrawer();
        if (window.FundThinkTank) window.FundThinkTank.showToast("数据已刷新", "success");
      }).catch(function () {
        if (window.FundThinkTank) window.FundThinkTank.showToast("刷新失败（本地服务未运行）", "error");
      });
    });
  }

  /* ---------- 导出 ---------- */
  window.DataSourceBadge = {
    init: init,
    state: state,
    sourceDrawerHTML: sourceDrawerHTML,
    reload: function () {
      return load().then(function () {
        // 重新注入（先移除旧栏）
        var old = document.getElementById("dsLiveBar");
        if (old) old.parentNode.removeChild(old);
        injectMarketHeader();
        return state;
      });
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
