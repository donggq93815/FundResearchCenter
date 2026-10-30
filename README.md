# 基金智库工作台

交行客户经理展业用桌面高保真可点击 Web 原型，覆盖六大业务模块：今日工作、看市场、配基金、建组合、陪持有、找客户。

## 数据服务

`data_service/` 提供真实行情数据（免费公开 API，不消耗 token）：

- **主源**：东方财富（基金净值 + 全市场基金列表）+ 新浪财经（指数行情）
- **验证源**：盈米（且慢，MCP 协议）
- **兜底源**：蛋卷基金

三源交叉验证，不一致时前端并排列出各源数据。

### 运行方式

```bash
# 拉取活跃基金三源交叉验证 + 指数行情
python data_service/run.py

# 同时拉取全市场约 2 万只公募基金列表
python data_service/run.py --all
```

### 环境变量

- `YINGMI_API_KEY`：盈米 API Key（可选，到 qieman.com/mcp 免费申请）。未配置时自动降级为双源（东财 + 蛋卷）。

## 定时更新（全自动，无需人工发布）

GitHub Actions 每个工作日（周一至周五）北京时间 20:30 自动运行 `data_service/run.py --all`，生成最新数据并提交回仓库 main 分支（`.github/workflows/update-data.yml`）。

前端页面的行情数据采用**三级自动降级加载**，用户每次访问都会自动拉到最新数据，无需人工重新发布：

1. **GitHub raw**（`raw.githubusercontent.com`，缓存约 5 分钟）—— 更新最快，优先使用
2. **jsDelivr CDN**（`cdn.jsdelivr.net/gh/...@main`）—— CDN 加速兜底
3. **本地发布快照**（发布时打包的 JSON）—— 完全离线兜底

> 说明：只要仓库保持**公开（public）**，前端即可直接读取 raw / jsDelivr 的最新数据。数据更新后约 5 分钟，所有访问者打开页面即看到最新行情。

需在仓库 Settings → Secrets and variables → Actions 配置 `YINGMI_API_KEY`。

## 免责声明

所有数据为免费公开接口拉取，仅供原型演示与内部试用，不构成投资建议。正式使用需保留数据来源、时点与人工复核记录。
