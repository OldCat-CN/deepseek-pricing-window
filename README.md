# DeepSeek 价格时段

在 DeepSeek Harness Web 的每个会话标题栏右侧，显示当前 DeepSeek API 的计价时段：

- 🟠 **峰时 · 2倍**：高峰时段，价格为谷时的 2 倍
- 🟢 **谷时 · 5折**：空闲时段，价格为峰时的 5 折

悬停或聚焦徽标，可查看距下次切换的倒计时、北京时间高峰时段、节假日表范围和当前规则。

## 计价规则

| 时段 | 北京时间 | UTC | 价格 |
| --- | --- | --- | --- |
| 高峰 | 周一至周五 09:00–12:00、14:00–18:00 | 01:00–04:00、06:00–10:00 | 基准价 |
| 谷时 | 其余所有时间，含周末与中国法定节假日 | 其余所有时间 | 高峰的 5 折 |

高峰日不含中国法定节假日。周六、周日即使调休上班，仍按周末（谷时）计算，因为 DeepSeek 的规则只把周一至周五定义为高峰日。

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

## 计算方式与数据来源

- 全部按 UTC 计算，不依赖本机时区；界面按北京时间说明。
- 高峰窗口：周一至周五 01:00–04:00、06:00–10:00 UTC。
- 节假日：内置国务院 2026、2027 年放假安排中的放假日；周末始终为谷时。
- 每次渲染扫描未来 16 天内的窗口边界，得到下次切换时间。
- 规则来源：[DeepSeek 模型 & 价格](https://api-docs.deepseek.com/zh-cn/quick_start/pricing)（2026-11-19 读取）。

## 限制

- 节假日表覆盖 2026–2027；2028 年起工作日的法定假日会被当作峰时，需要更新 `client.js` 里的 `HOLIDAY_RANGES`。
- 徽标只显示时段与倍数关系，不显示具体单价；价格可能随时调整，以官方页面为准。
- 仅 Web GUI，且只在打开会话时显示；无会话的首页不显示。
- 原生 `title` 提示在触屏设备上不可用；键盘聚焦时由屏幕阅读器读出同样的详细说明。
- Git 安装不会自动更新；需要更新时重新安装，或安装固定 commit 的地址后使用 Update。

## 开发

- `client.js`：Client 半，负责槽位注册、峰谷计算与徽标渲染。
- `index.js`：Host 半（空实现）。
- `cordis.patch.yml`：插入插件行。
- `locale/*.json`：插件管理页的标题与描述。
- `icon.svg`：插件图标。
- `test/verify-window.mjs`：本地冒烟测试，模拟 React 与槽位，验证 6 个时间点。

运行测试：

```sh
pnpm test
# 或
node test/verify-window.mjs
```

## License

[MIT](LICENSE)

---

## English

A session-header badge for DeepSeek Harness that shows whether DeepSeek API pricing is in peak or off-peak hours.

- Peak: Monday to Friday, 09:00–12:00 and 14:00–18:00 Beijing time (01:00–04:00 and 06:00–10:00 UTC), excluding Chinese public holidays.
- Off-peak: every other hour, including weekends and Chinese public holidays, at half the peak rate.

Hover or focus the badge for the next switch countdown, the peak windows, and the holiday-table range. The rule is computed in UTC; Chinese public holidays for 2026–2027 are built in.

Install from Git: `https://github.com/OldCat-CN/deepseek-pricing-window.git` (or `github:OldCat-CN/deepseek-pricing-window`) in **Plugins → Add plugin → Install a third-party plugin**. Typing only `deepseek-pricing-window` does not work: the package is not published to npm.
