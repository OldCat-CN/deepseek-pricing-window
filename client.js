window.__ModuleLoader__.load({
  id: 'deepseek-pricing-window',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'deepseek-pricing-window';

    const HOUR = 60 * 60 * 1000;
    const DAY = 24 * HOUR;

    // DeepSeek peak windows in UTC hours [start, end), Monday through Friday.
    const PEAK_WINDOWS = [
      [1, 4],
      [6, 10],
    ];
    const BOUNDARY_HOURS = [1, 4, 6, 10];

    // Days off from the State Council notices for 2026 and 2027.
    const HOLIDAY_RANGES = [
      ['2026-01-01', '2026-01-03'],
      ['2026-02-15', '2026-02-23'],
      ['2026-04-04', '2026-04-06'],
      ['2026-05-01', '2026-05-05'],
      ['2026-06-19', '2026-06-21'],
      ['2026-09-25', '2026-09-27'],
      ['2026-10-01', '2026-10-07'],
      ['2027-01-01', '2027-01-03'],
      ['2027-02-05', '2027-02-13'],
      ['2027-04-03', '2027-04-05'],
      ['2027-05-01', '2027-05-05'],
      ['2027-06-09', '2027-06-09'],
      ['2027-09-15', '2027-09-15'],
      ['2027-10-01', '2027-10-07'],
    ];

    function parseDay(text) {
      const parts = text.split('-').map(Number);
      return Date.UTC(parts[0], parts[1] - 1, parts[2]);
    }

    function dayKey(ms) {
      const date = new Date(ms);
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      return date.getUTCFullYear() + '-' + month + '-' + day;
    }

    const HOLIDAYS = new Set();
    for (const [start, end] of HOLIDAY_RANGES) {
      for (let cursor = parseDay(start); cursor <= parseDay(end); cursor += DAY) {
        HOLIDAYS.add(dayKey(cursor));
      }
    }

    const HOLIDAY_YEARS = HOLIDAY_RANGES.flatMap(([start, end]) => [
      Number(start.slice(0, 4)),
      Number(end.slice(0, 4)),
    ]);
    const FIRST_HOLIDAY_YEAR = Math.min(...HOLIDAY_YEARS);
    const LAST_HOLIDAY_YEAR = Math.max(...HOLIDAY_YEARS);

    function isPeakAt(ms) {
      const date = new Date(ms);
      const weekday = date.getUTCDay();
      if (weekday === 0 || weekday === 6) return false;
      if (HOLIDAYS.has(dayKey(ms))) return false;
      const hour = date.getUTCHours();
      for (const [start, end] of PEAK_WINDOWS) {
        if (hour >= start && hour < end) return true;
      }
      return false;
    }

    function nextSwitchAt(ms) {
      const peak = isPeakAt(ms);
      const date = new Date(ms);
      const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
      for (let offset = 0; offset <= 16; offset += 1) {
        for (const hour of BOUNDARY_HOURS) {
          const candidate = midnight + offset * DAY + hour * HOUR;
          if (candidate <= ms) continue;
          if (isPeakAt(candidate) !== peak) return candidate;
        }
      }
      return null;
    }

    function formatRemaining(ms, t) {
      const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
      const days = Math.floor(totalMinutes / 1440);
      const hours = Math.floor((totalMinutes % 1440) / 60);
      const minutes = totalMinutes % 60;
      const parts = [];
      if (days > 0) parts.push(days + t('dayUnit'));
      if (hours > 0) parts.push(hours + t('hourUnit'));
      if (days === 0 && (minutes > 0 || parts.length === 0)) {
        parts.push(minutes + t('minuteUnit'));
      }
      return parts.join(t('join'));
    }

    const DICT_EN = {
      peak: 'Peak',
      offPeak: 'Off-peak',
      peakRate: '2×',
      offPeakRate: '50% off',
      peakSummary: 'DeepSeek API is in peak hours, twice the off-peak rate.',
      offPeakSummary: 'DeepSeek API is off-peak, half the peak rate.',
      toOffPeak: 'Off-peak begins in about',
      toPeak: 'Peak hours begin in about',
      peakWindow:
        'Peak: Mon-Fri 09:00-12:00 and 14:00-18:00 Beijing time, excluding Chinese public holidays.',
      offPeakWindow:
        'Off-peak: all other hours, including weekends and Chinese public holidays.',
      holidayTablePrefix: 'Holiday table: ',
      holidayTableSuffix: '.',
      sourceNote: 'Rates follow the official DeepSeek pricing page.',
      dayUnit: 'd',
      hourUnit: 'h',
      minuteUnit: 'm',
      join: ' ',
      sentenceEnd: '.',
    };

    const DICT_ZH = {
      peak: '峰时',
      offPeak: '谷时',
      peakRate: '2倍',
      offPeakRate: '5折',
      peakSummary: '当前为 DeepSeek API 峰时，价格为谷时的 2 倍。',
      offPeakSummary: '当前为 DeepSeek API 谷时，价格为峰时的 5 折。',
      toOffPeak: '距离转入谷时约',
      toPeak: '距离转入峰时约',
      peakWindow: '峰时：北京时间周一至周五 9:00-12:00、14:00-18:00（中国法定节假日除外）。',
      offPeakWindow: '谷时：其余时段，含周末与中国法定节假日。',
      holidayTablePrefix: '节假日表：',
      holidayTableSuffix: ' 年。',
      sourceNote: '价格以 DeepSeek 官方价目表为准。',
      dayUnit: '天',
      hourUnit: '小时',
      minuteUnit: '分',
      join: '',
      sentenceEnd: '。',
    };

    function Badge({ t }) {
      const [now, setNow] = React.useState(() => Date.now());
      const [, setLocaleRevision] = React.useState(0);

      React.useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
      }, []);

      React.useEffect(
        () => t.subscribe(() => setLocaleRevision((revision) => revision + 1)),
        [t],
      );

      const peak = isPeakAt(now);
      const next = nextSwitchAt(now);
      const stateLabel = t.phrase(peak ? 'peak' : 'offPeak');
      const rateLabel = t.phrase(peak ? 'peakRate' : 'offPeakRate');

      const lines = [t.phrase(peak ? 'peakSummary' : 'offPeakSummary')];
      if (next !== null) {
        const duration = formatRemaining(next - now, t.phrase);
        lines.push(t.phrase(peak ? 'toOffPeak' : 'toPeak') + ' ' + duration + t.phrase('sentenceEnd'));
      }
      lines.push(
        t.phrase('peakWindow'),
        t.phrase('offPeakWindow'),
        t.phrase('holidayTablePrefix') +
          FIRST_HOLIDAY_YEAR +
          '-' +
          LAST_HOLIDAY_YEAR +
          t.phrase('holidayTableSuffix'),
        t.phrase('sourceNote'),
      );
      const title = lines.join('\n');

      const dotStyle = {
        width: 6,
        height: 6,
        borderRadius: '50%',
        flex: '0 0 auto',
        background: peak
          ? 'var(--dsw-alias-state-warn-primary)'
          : 'var(--dsw-alias-state-success-primary)',
      };
      const badgeStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 22,
        padding: '0 8px',
        borderRadius: 6,
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 12,
        lineHeight: '20px',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        userSelect: 'none',
        cursor: 'help',
        outlineOffset: 2,
      };
      const stateStyle = { color: 'var(--dsw-alias-label-primary)' };

      return h(
        'span',
        {
          title,
          role: 'note',
          tabIndex: 0,
          'aria-label': title,
          style: badgeStyle,
        },
        h('span', { style: dotStyle }),
        h('span', { style: stateStyle }, stateLabel),
        h('span', null, ' · ' + rateLabel),
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const locale = ctx.locale;

        ctx.effect(() => {
          const disposers = [
            locale.register(NS, 'en', DICT_EN),
            locale.register(NS, 'zh', DICT_ZH),
          ];
          return () => {
            for (const dispose of disposers.reverse()) dispose();
          };
        });

        const translate = locale.bind(NS);
        const t = {
          phrase: (key) => translate(key),
          subscribe: (listener) => locale.subscribe(listener),
        };

        function PricingBadge() {
          return h(Badge, { t });
        }

        ctx.slots.inject('conversation.session.header.utilities', () =>
          ctx.slots.register(
            {
              name: 'conversation.session.header.utilities',
              id: 'deepseek-pricing-window',
              order: 30,
            },
            PricingBadge,
          ),
        );
      },
    };
  },
});
