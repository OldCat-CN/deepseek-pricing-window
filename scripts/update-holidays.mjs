import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clientPath = path.join(root, 'client.js');
const checkedPath = path.join(root, 'data', 'checked.json');

const BEGIN = '    // BEGIN HOLIDAY_RANGES (managed by scripts/update-holidays.mjs)';
const END = '    // END HOLIDAY_RANGES';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const targetIndex = args.indexOf('--target-year');
const targetOverride = targetIndex >= 0 ? Number(args[targetIndex + 1]) : null;
if (targetIndex >= 0 && !Number.isInteger(targetOverride)) {
  throw new Error('--target-year needs an integer year');
}

function readClient() {
  const source = fs.readFileSync(clientPath, 'utf8');
  const begin = source.indexOf(BEGIN);
  const end = source.indexOf(END);
  if (begin < 0 || end < 0 || end <= begin) {
    throw new Error('HOLIDAY_RANGES markers not found in client.js');
  }
  const literal = source.slice(begin, end).match(/const HOLIDAY_RANGES = (\[[\s\S]*?\]);/);
  if (!literal) throw new Error('HOLIDAY_RANGES literal not found');
  const ranges = vm.runInNewContext('(' + literal[1] + ')');
  if (!Array.isArray(ranges) || ranges.length === 0) throw new Error('HOLIDAY_RANGES is empty');
  for (const range of ranges) {
    if (
      !Array.isArray(range) ||
      range.length !== 2 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(range[0]) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(range[1])
    ) {
      throw new Error('Invalid HOLIDAY_RANGES entry: ' + JSON.stringify(range));
    }
  }
  return { source, begin, end: end + END.length, ranges };
}

function renderBlock(ranges) {
  const lines = ranges.map(([start, end]) => `      ['${start}', '${end}'],`);
  return [BEGIN, '    const HOLIDAY_RANGES = [', ...lines, '    ];', END].join('\n');
}

function yearsOf(ranges) {
  return ranges.flatMap(([start, end]) => [Number(start.slice(0, 4)), Number(end.slice(0, 4))]);
}

function nextDay(date) {
  const value = new Date(date + 'T00:00:00Z');
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function toRanges(dates) {
  const ranges = [];
  for (const date of [...dates].sort()) {
    const last = ranges[ranges.length - 1];
    if (last && nextDay(last[1]) === date) last[1] = date;
    else ranges.push([date, date]);
  }
  return ranges;
}

function mergeRanges(existing, added) {
  const seen = new Set();
  return [...existing, ...added]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .filter(([start, end]) => {
      const key = start + '|' + end;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function validate(data, year) {
  if (!data || data.year !== year) {
    throw new Error(`Holiday data year is ${data && data.year}, expected ${year}`);
  }
  const papers = Array.isArray(data.papers) ? data.papers : [];
  if (!papers.some((paper) => typeof paper === 'string' && paper.includes('gov.cn'))) {
    throw new Error('Holiday data does not cite a gov.cn notice');
  }
  const offDays = (Array.isArray(data.days) ? data.days : []).filter((day) => day && day.isOffDay === true);
  if (offDays.length < 20) {
    throw new Error(`Only ${offDays.length} days off found; refusing to update`);
  }
  const names = new Set(offDays.map((day) => String(day.name)));
  for (const expected of ['元旦', '春节', '清明', '劳动', '端午', '中秋', '国庆']) {
    if (![...names].some((name) => name.includes(expected))) {
      throw new Error(`Holiday data is missing ${expected}`);
    }
  }
  const dates = new Set();
  for (const day of offDays) {
    const date = day.date;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('Invalid holiday date: ' + date);
    }
    if (!date.startsWith(`${year}-`)) {
      throw new Error(`Holiday date ${date} is outside ${year}`);
    }
    if (dates.has(date)) throw new Error('Duplicate holiday date: ' + date);
    const parsed = new Date(date + 'T00:00:00Z');
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
      throw new Error('Invalid calendar date: ' + date);
    }
    dates.add(date);
  }
  return [...dates];
}

async function fetchHolidayData(year) {
  const urls = [
    `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${year}.json`,
    `https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${year}.json`,
  ];
  const errors = [];
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'dsh-deepseek-pricing-window-updater' },
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      console.log(`Fetched ${year} holiday data from ${url}`);
      return data;
    } catch (error) {
      errors.push(`${url}: ${error.message}`);
    }
  }
  throw new Error('Could not fetch holiday data:\n' + errors.join('\n'));
}

function updateChecked(lastHolidayYear) {
  const now = new Date();
  const current = fs.existsSync(checkedPath) ? JSON.parse(fs.readFileSync(checkedPath, 'utf8')) : {};
  const month = now.toISOString().slice(0, 7);
  const needsMonth = typeof current.checkedAt !== 'string' || current.checkedAt.slice(0, 7) !== month;
  const needsYear = current.lastHolidayYear !== lastHolidayYear;
  if (!needsMonth && !needsYear) return false;
  const next = {
    checkedAt: now.toISOString(),
    lastHolidayYear,
    nextHolidayYear: lastHolidayYear + 1,
    source: 'https://github.com/NateScarlet/holiday-cn',
  };
  fs.mkdirSync(path.dirname(checkedPath), { recursive: true });
  fs.writeFileSync(checkedPath, JSON.stringify(next, null, 2) + '\n');
  return true;
}

async function main() {
  const { source, begin, end, ranges } = readClient();
  const lastYear = Math.max(...yearsOf(ranges));
  const now = new Date();
  const trigger = new Date(Date.UTC(lastYear, 11, 15, 0, 0, 0));
  const targetYear = targetOverride ?? lastYear + 1;
  const due = targetOverride !== null || now >= trigger;

  let clientChanged = false;
  if (due) {
    const data = await fetchHolidayData(targetYear);
    const dates = validate(data, targetYear);
    const added = toRanges(dates);
    const merged = mergeRanges(ranges, added);
    const updated = source.slice(0, begin) + renderBlock(merged) + source.slice(end);
    clientChanged = updated !== source;
    console.log(`Validated ${dates.length} days off for ${targetYear} in ${added.length} ranges.`);
    if (dryRun) {
      console.log('Dry run:', JSON.stringify(added));
      return;
    }
    if (clientChanged) {
      fs.writeFileSync(clientPath, updated);
      try {
        execFileSync(process.execPath, [path.join(root, 'test/verify-window.mjs')], { stdio: 'inherit' });
      } catch (error) {
        fs.writeFileSync(clientPath, source);
        throw error;
      }
    }
  } else {
    console.log(`No holiday update due: ${targetYear} is only fetched after ${trigger.toISOString()}.`);
  }

  if (dryRun) {
    console.log('Dry run: no files written.');
    return;
  }

  const finalYear = Math.max(...yearsOf(readClient().ranges));
  const checkedChanged = updateChecked(finalYear);
  console.log(
    `Holiday data: ${lastYear} -> ${finalYear}; checked heartbeat ${checkedChanged ? 'updated' : 'unchanged'}; client ${clientChanged ? 'updated' : 'unchanged'}.`,
  );
}

await main();
