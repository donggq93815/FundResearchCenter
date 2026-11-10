/* =========================================================================
   基金智库 · 移动端交互增强
   -------------------------------------------------------------------------
   只做窄屏下的补充交互，桌面端全部不生效：
     1. 汉堡菜单打开/关闭侧栏抽屉（含遮罩、Esc、点击导航后自动收起）
     2. 配基金页筛选面板在手机上折叠/展开
     3. 断点切换（旋转屏幕、拉伸窗口）时自动复位状态
   ========================================================================= */
(function () {
  "use strict";

  var MOBILE_QUERY = "(max-width: 860px)";
  var mq = window.matchMedia(MOBILE_QUERY);
  var body = document.body;

  function q(sel) { return document.querySelector(sel); }
  function isMobile() { return mq.matches; }

  /* ---------------- 1. 侧栏抽屉 ---------------- */
  var menuBtn = q("#mobileMenuBtn");
  var scrim = q("#mobileScrim");
  var sidebar = q("#appSidebar");

  function setSidebarOpen(open) {
    if (!isMobile()) open = false;
    body.classList.toggle("m-sidebar-open", open);
    if (scrim) scrim.hidden = !open;
    if (menuBtn) menuBtn.setAttribute("aria-expanded", String(open));
    // 抽屉打开时锁定背景滚动，避免误滚动主内容
    body.style.overflow = open ? "hidden" : "";
  }

  function closeSidebar() { setSidebarOpen(false); }

  if (menuBtn) {
    menuBtn.addEventListener("click", function () {
      setSidebarOpen(!body.classList.contains("m-sidebar-open"));
    });
  }
  if (scrim) {
    scrim.addEventListener("click", closeSidebar);
  }
  // 侧栏内点击任意导航项（含 AI 助手卡片外的按钮）后自动收起
  if (sidebar) {
    sidebar.addEventListener("click", function (event) {
      if (event.target.closest("[data-nav], .ai-nav-card button")) closeSidebar();
    });
  }
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && body.classList.contains("m-sidebar-open")) closeSidebar();
  });

  /* ---------------- 2. 配基金 · 筛选面板折叠 ---------------- */
  var filterPanel = q("#fundFilter");

  function setFilterOpen(open) {
    if (!isMobile()) {
      body.classList.remove("m-filter-open");
      return;
    }
    body.classList.toggle("m-filter-open", open);
  }

  if (filterPanel) {
    filterPanel.addEventListener("click", function (event) {
      var head = event.target.closest(".filter-head");
      if (!head) return;
      // 点「重置」时不切换折叠，交给原有逻辑
      if (event.target.closest(".filter-reset")) return;
      if (!isMobile()) return;
      setFilterOpen(!body.classList.contains("m-filter-open"));
    });
  }

  /* ---------------- 3. 断点变化复位 ---------------- */
  function handleBreakpoint() {
    if (!isMobile()) {
      body.classList.remove("m-sidebar-open", "m-filter-open");
      if (scrim) scrim.hidden = true;
      if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
      body.style.overflow = "";
    } else {
      // 进入移动布局时，筛选面板默认收起，避免一屏全是条件
      body.classList.remove("m-filter-open");
    }
  }

  if (mq.addEventListener) {
    mq.addEventListener("change", handleBreakpoint);
  } else if (mq.addListener) {
    mq.addListener(handleBreakpoint);
  }

  /* ---------------- 4. 首次进入 ---------------- */
  handleBreakpoint();

  // 供其他脚本调用（例如展示某基金后跳回列表）
  window.FundMobileUI = {
    openSidebar: function () { setSidebarOpen(true); },
    closeSidebar: closeSidebar,
    openFilter: function () { setFilterOpen(true); },
    closeFilter: function () { setFilterOpen(false); },
    isMobile: isMobile
  };
})();
