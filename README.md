<h1 align="center">DSH峰谷提示插件</h1>

<p align="center"><strong>DeepSeek Harness（DSH）插件</strong>：在会话标题栏显示当前 DeepSeek API 处于峰时还是谷时。</p>

<p align="center">简体中文 | <a href="README.en.md">English</a></p>

- 🟠 **峰时 · 2倍**：高峰时段，价格为谷时的 2 倍
- 🟢 **谷时 · 1倍**：谷时，价格为基准价（1 倍）

悬停可查看距下次切换的倒计时和北京时间高峰时段；**点击徽标会在新标签页打开 DeepSeek 官方价目表**（中文 / English 随界面语言切换）。

## 计价规则

| 时段 | 北京时间 | UTC | 价格 |
| --- | --- | --- | --- |
| 高峰 | 周一至周五 09:00–12:00、14:00–18:00 | 01:00–04:00、06:00–10:00 | 2 倍 |
| 谷时 | 其余所有时间，含周末与中国法定节假日 | 其余所有时间 | 1 倍（基准价） |

以谷时为 1 倍基准，峰时为 2 倍。高峰日不含中国法定节假日。周六、周日即使调休上班，仍按周末（谷时）计算，因为 DeepSeek 的规则只把周一至周五定义为高峰日。

## 安装

### 通过 DSH Web 安装（推荐）

1. 打开 DSH Web，进入左侧 **Plugins（插件）**。
2. 点击 **Add plugin（添加插件）** 旁的箭头，选择 **Install a third-party plugin（安装第三方插件）**。
3. 在地址栏填入：

   ```
   https://github.com/OldCat-CN/deepseek-pricing-window.git
   ```

   或 pnpm 的 GitHub 简写：

   ```
   github:OldCat-CN/deepseek-pricing-window
   ```

4. 点击 **Install（安装）**，完成后启用，并刷新页面。

> 只填 `deepseek-pricing-window` 不行：这是 npm 包名，本项目目前只通过 Git 分发，没有发布到 npm。

### 通过 agent 安装

让 agent 调用 `plugin_manager` 的 `install_bundle`，`target` 填上面的 Git 地址即可。

## 节假日自动更新

仓库里的 `.github/workflows/update-holidays.yml` 每天 02:17 UTC（北京时间 10:17）运行一次：

1. 读取 `client.js` 中 `HOLIDAY_RANGES` 已覆盖的最后一年。
2. 如果当前时间还没到这一年的 **12 月 15 日**，跳过抓取（月度心跳仍可能写入）。
3. 如果下一年还缺失，从 [holiday-cn](https://github.com/NateScarlet/holiday-cn) 抓取该年数据（先试 GitHub raw，再试 jsDelivr）。
4. 校验：`papers` 必须引用 `gov.cn` 的国务院通知；元旦、春节、清明、劳动、端午、中秋、国庆七组齐全；放假日不少于 20 天；日期必须在该年内且不重复。
5. 校验通过后更新 `client.js`，运行冒烟测试，提交并推送；如果抓取或校验失败，工作流报错，第二天继续重试，直到下一年数据被写入。

为了避免 GitHub 在仓库 60 天无提交后自动停用定时任务，工作流每月首次运行会提交一次 `data/checked.json` 心跳（记录最近检查时间和覆盖年份）。如果你不需要这个心跳，可以删掉工作流里的提交步骤，改为手动触发。

**注意**：自动更新的是 GitHub 仓库里的数据；已经安装到 DSH 的副本不会自动拉取。仓库更新后，用户需要重新安装（或安装固定 commit 后使用 Update）才能拿到新的节假日表。

## 计算方式与数据来源

- 全部按 UTC 计算，不依赖本机时区；界面按北京时间说明。
- 每次渲染扫描未来 16 天内的窗口边界，得到下次切换时间。
- 高峰窗口：周一至周五 01:00–04:00、06:00–10:00 UTC。
- 节假日：以 `client.js` 的 `HOLIDAY_RANGES` 为准，当前由 2026–2027 年国务院放假安排起步，之后由上面的工作流维护。
- 规则来源：[DeepSeek 模型 & 价格](https://api-docs.deepseek.com/zh-cn/quick_start/pricing)（2026-11-19 读取）。

## 限制

- 徽标只显示时段与倍数关系，不显示具体单价；价格可能随时调整，以官方页面为准。
- 仅 Web GUI，且只在打开会话时显示；无会话的首页不显示。
- 原生 `title` 提示在触屏设备上不可用；键盘聚焦时由屏幕阅读器读出同样的详细说明。
- 自动更新依赖社区维护的 holiday-cn 数据集。脚本会校验国务院通知链接和数据结构，但仍建议偶尔看一眼机器人的提交。
- 已安装的副本不会自动更新；Git 安装不会出现在 npm 的版本更新列表里。

## 开发

- `client.js`：Client 半，负责槽位注册、峰谷计算、徽标渲染和点击跳转。
- `index.js`：Host 半（空实现）。
- `cordis.patch.yml`：插入插件行。
- `locale/*.json`：插件管理页的标题与描述。
- `icon.svg`：插件图标。
- `test/verify-window.mjs`：本地冒烟测试，模拟 React 与槽位，验证 6 个时间点以及中英文链接。
- `scripts/update-holidays.mjs`：节假日抓取、校验、写回和心跳。
- `.github/workflows/update-holidays.yml`：每日定时任务。

运行测试：

```sh
pnpm test
# 或
node test/verify-window.mjs
```

手动检查节假日抓取（不写文件）：

```sh
node scripts/update-holidays.mjs --target-year 2027 --dry-run
```

## License

[MIT](LICENSE)
