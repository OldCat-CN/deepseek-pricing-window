# DeepSeek pricing window

A **DeepSeek Harness (DSH) plugin** that shows whether the DeepSeek API is in peak or off-peak hours in every session header.

English | [简体中文](README.md)

- 🟠 **Peak · 2×**: peak hours, twice the off-peak rate
- 🟢 **Off-peak · 50% off**: off-peak hours, half the peak rate

Hover the badge for the next switch countdown, the Beijing-time peak windows, and the holiday-table range. **Clicking the badge opens the official DeepSeek pricing page** in a new tab, in Chinese or English to match the UI language.

## Rule

| Window | Beijing time | UTC | Rate |
| --- | --- | --- | --- |
| Peak | Mon–Fri 09:00–12:00, 14:00–18:00 | 01:00–04:00, 06:00–10:00 | base price |
| Off-peak | every other hour, including weekends and Chinese public holidays | every other hour | 50% of peak |

Weekday public holidays are excluded from peak. Weekend make-up workdays stay off-peak, because DeepSeek defines peak as Monday through Friday only.

## Install

### Through the DSH Web UI (recommended)

1. Open **Plugins** in the DSH Web sidebar.
2. Open the **Add plugin** arrow and choose **Install a third-party plugin**.
3. Enter:

   ```
   https://github.com/OldCat-CN/deepseek-pricing-window.git
   ```

   or the pnpm GitHub shorthand:

   ```
   github:OldCat-CN/deepseek-pricing-window
   ```

4. Click **Install**, enable the bundle, and refresh the page.

> Typing only `deepseek-pricing-window` does not work: that is an npm package name, and this project is distributed through Git only.

### Through an agent

Ask the agent to call `plugin_manager` with `install_bundle` and the Git address above.

## Automatic holiday updates

`.github/workflows/update-holidays.yml` runs every day at 02:17 UTC (10:17 Beijing):

1. Read the last year covered by `HOLIDAY_RANGES` in `client.js`.
2. If that year's December 15 has not arrived, stop.
3. If the next year is missing, fetch it from [holiday-cn](https://github.com/NateScarlet/holiday-cn) (GitHub raw first, jsDelivr second).
4. Validate: `papers` must cite a `gov.cn` State Council notice; all seven holiday groups (New Year, Spring Festival, Qingming, Labour Day, Dragon Boat, Mid-Autumn, National Day) must be present; at least 20 days off; every date in the target year and unique.
5. On success, update `client.js`, run the smoke test, commit, and push. On failure, the workflow fails and retries the next day until the new year is committed.

To keep GitHub from disabling the schedule after 60 days without repository activity, the workflow commits a `data/checked.json` heartbeat on its first run each month (last check time and covered year). Remove that commit step if you prefer manual runs.

**Note**: the automation updates the GitHub repository, not installed copies. After a repository update, users must reinstall (or install a commit-pinned spec and use Update) to receive the new holiday table.

## How it is calculated

- Everything is computed in UTC, independent of the machine time zone; the UI explains windows in Beijing time.
- Each render scans the next 16 days of window boundaries to find the next switch.
- Peak windows: Monday to Friday, 01:00–04:00 and 06:00–10:00 UTC.
- Holidays come from `HOLIDAY_RANGES` in `client.js`, starting with the 2026–2027 State Council schedules and maintained by the workflow above.
- Rule source: [DeepSeek models & pricing](https://api-docs.deepseek.com/quick_start/pricing) (read on 2026-11-19).

## Limitations

- The badge shows the window and rate relation only, not unit prices; prices can change, so check the official page.
- Web GUI only, and only while a session is open; the no-session landing page shows nothing.
- The native `title` tooltip is unavailable on touch screens; keyboard focus exposes the same details through the accessible name.
- The updater depends on the community-maintained holiday-cn dataset. It validates the government-notice link and shape, but it is still worth glancing at the bot commits.
- Installed copies do not auto-update, and Git installs do not appear in npm version listings.

## Development

- `client.js`: Client half — slot registration, peak/off-peak math, badge rendering, and the pricing link.
- `index.js`: Host half (empty).
- `cordis.patch.yml`: inserts the plugin row.
- `locale/*.json`: Plugin Manager title and description.
- `icon.svg`: plugin icon.
- `test/verify-window.mjs`: local smoke test with a React/slot mock; covers six timestamps plus the Chinese and English links.
- `scripts/update-holidays.mjs`: fetch, validate, write back, and heartbeat.
- `.github/workflows/update-holidays.yml`: daily schedule.

Run the tests:

```sh
pnpm test
# or
node test/verify-window.mjs
```

Check the updater without writing files:

```sh
node scripts/update-holidays.mjs --target-year 2027 --dry-run
```

## License

[MIT](LICENSE)
