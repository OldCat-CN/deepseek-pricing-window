import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
for (const file of ['locale/en.json', 'locale/zh.json']) {
  JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
}
console.log('manifest ok');

const source = fs.readFileSync(path.join(dir, 'client.js'), 'utf8');

let fakeNow = Date.UTC(2026, 10, 19, 8, 31, 0);

class FakeDate extends Date {
  constructor(...args) {
    super(...(args.length ? args : [fakeNow]));
  }
  static now() {
    return fakeNow;
  }
}

const React = {
  createElement(type, props, ...children) {
    return { type, props: props || {}, children };
  },
  useState(initial) {
    return [typeof initial === 'function' ? initial() : initial, () => {}];
  },
  useEffect() {},
};

let definition;
const sandbox = {
  window: { __ModuleLoader__: { load(def) {
    definition = def;
  } } },
  console,
  Date: FakeDate,
  setInterval: () => 0,
  clearInterval: () => {},
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'client.js' });

if (definition.id !== pkg.name) {
  throw new Error('loader id "' + definition.id + '" does not match package name "' + pkg.name + '"');
}
console.log('loader id ok');

const plugin = definition.factory((name) => {
  if (name === 'react') return React;
  throw new Error('unexpected require: ' + name);
});

const dictionaries = new Map();
const components = new Map();
const fakeLocale = {
  active: 'zh',
  register(ns, locale, dict) {
    dictionaries.set(locale, dict);
    return () => dictionaries.delete(locale);
  },
  getLocale() {
    return { active: fakeLocale.active };
  },
  bind() {
    return (key) => {
      const dict = dictionaries.get(fakeLocale.active) || dictionaries.get('zh');
      if (dict && Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
      return key;
    };
  },
  subscribe() {
    return () => {};
  },
};

plugin.apply({
  locale: fakeLocale,
  effect(fn) {
    fn();
  },
  slots: {
    inject(key, callback) {
      callback();
    },
    register(options, comp) {
      components.set(options.name + ':' + (options.id ?? ''), { options, comp });
    },
  },
});

const headerComponent = components.get('conversation.session.header.utilities:deepseek-pricing-window');
if (!headerComponent) throw new Error('header badge slot was not registered');
if (headerComponent.options.id !== 'deepseek-pricing-window') throw new Error('unexpected header slot id');
const heroOptionsComponent = components.get('conversation.hero.options:deepseek-pricing-window');
if (!heroOptionsComponent) throw new Error('hero options badge was not registered');

function collectText(node) {
  if (typeof node === 'string') return node;
  if (!node || typeof node !== 'object') return '';
  return (node.children || []).map(collectText).join('');
}

function renderComponent(component, atMs) {
  fakeNow = atMs;
  const outer = component.comp();
  const inner = outer.type(outer.props);
  return { inner, title: inner.props.title || '', text: collectText(inner) };
}

function render(atMs) {
  return renderComponent(headerComponent, atMs);
}

const cases = [
  [Date.UTC(2026, 10, 19, 8, 31), '峰时 · 2倍', '距离转入谷时约 1小时29分', 'Thursday 08:31 UTC (peak)'],
  [Date.UTC(2026, 10, 19, 4, 0), '谷时 · 1倍', '距离转入峰时约 2小时', 'Thursday 04:00 UTC boundary'],
  [Date.UTC(2026, 10, 19, 1, 0), '峰时 · 2倍', '距离转入谷时约 3小时', 'Thursday 01:00 UTC peak start'],
  [Date.UTC(2026, 10, 21, 2, 0), '谷时 · 1倍', '距离转入峰时约 1天23小时', 'Saturday'],
  [Date.UTC(2026, 9, 1, 2, 0), '谷时 · 1倍', '距离转入峰时约 6天23小时', 'National Day holiday'],
  [Date.UTC(2027, 0, 1, 2, 0), '谷时 · 1倍', '距离转入峰时约 2天23小时', 'New Year holiday 2027'],
];

for (const [at, expectedText, expectedTitlePart, label] of cases) {
  const { inner, title, text } = render(at);
  if (text !== expectedText) {
    throw new Error(label + ': expected badge "' + expectedText + '", got "' + text + '"');
  }
  if (!title.includes(expectedTitlePart)) {
    throw new Error(label + ': expected title to include "' + expectedTitlePart + '"\n' + title);
  }
  if (inner.type !== 'a') {
    throw new Error(label + ': badge is not a link');
  }
  if (inner.props.target !== '_blank' || !String(inner.props.rel).includes('noopener')) {
    throw new Error(label + ': badge link is missing target/rel');
  }
  if (!String(inner.props.href).includes('/zh-cn/quick_start/pricing')) {
    throw new Error(label + ': Chinese locale should link to the Chinese pricing page');
  }
  if (!String(inner.props['aria-label']).includes('官方价目表')) {
    throw new Error(label + ': aria-label does not mention the pricing page');
  }
  console.log('ok  ', label, '->', text);
}

fakeLocale.active = 'en';
const english = render(Date.UTC(2026, 10, 19, 8, 31));
if (english.text !== 'Peak · 2×') {
  throw new Error('English badge text is wrong: ' + english.text);
}
if (!english.inner.props.href.endsWith('/quick_start/pricing') || english.inner.props.href.includes('/zh-cn/')) {
  throw new Error('English locale should link to the English pricing page');
}
if (!english.inner.props['aria-label'].includes('official DeepSeek pricing page')) {
  throw new Error('English aria-label does not mention the pricing page');
}
const englishOffPeak = render(Date.UTC(2026, 10, 19, 4, 0));
if (englishOffPeak.text !== 'Off-peak · 1×') {
  throw new Error('English off-peak badge text is wrong: ' + englishOffPeak.text);
}
console.log('ok   English locale ->', english.text, '/', englishOffPeak.text);
fakeLocale.active = 'zh';

const heroOptions = renderComponent(heroOptionsComponent, Date.UTC(2026, 10, 19, 8, 31));
if (heroOptions.text !== '峰时 · 2倍') {
  throw new Error('hero options badge text is wrong: ' + heroOptions.text);
}
if (heroOptions.inner.type !== 'a') {
  throw new Error('hero options badge is not a link');
}
if (heroOptions.inner.props.style.marginLeft !== 6) {
  throw new Error('hero options badge is missing its left gap');
}
if (!String(heroOptions.inner.props.href).includes('/zh-cn/quick_start/pricing')) {
  throw new Error('hero options badge should link to the Chinese pricing page');
}
console.log('ok   hero options ->', heroOptions.text);

console.log('client smoke test passed');
