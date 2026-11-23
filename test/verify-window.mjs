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
  Fragment: Symbol('Fragment'),
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
const heroComponent = components.get('conversation.hero.frame:deepseek-pricing-window-hero');
if (!heroComponent) throw new Error('hero badge layer was not registered');

function collectText(node) {
  if (typeof node === 'string') return node;
  if (!node || typeof node !== 'object') return '';
  return (node.children || []).map(collectText).join('');
}

function render(atMs) {
  fakeNow = atMs;
  const outer = headerComponent.comp();
  const inner = outer.type(outer.props);
  return { inner, title: inner.props.title || '', text: collectText(inner) };
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

fakeNow = Date.UTC(2026, 10, 19, 8, 31);
const inactiveHero = heroComponent.comp({ hero: false, children: 'body-content' });
if (inactiveHero !== 'body-content') {
  throw new Error('hero layer should pass through the scroll body when not on the home');
}
const activeHero = heroComponent.comp({ hero: true, children: 'body-content' });
if (!activeHero || activeHero.type !== React.Fragment) {
  throw new Error('hero layer should wrap the scroll body on the home');
}
if (activeHero.children[0] !== 'body-content') {
  throw new Error('hero layer should keep the scroll body first');
}
const heroWrapper = activeHero.children[1];
if (!heroWrapper || heroWrapper.props.style.position !== 'absolute') {
  throw new Error('hero badge is not absolutely positioned');
}
const heroBadgeElement = heroWrapper.children[0];
const heroBadge = heroBadgeElement.type(heroBadgeElement.props);
if (collectText(heroBadge) !== '峰时 · 2倍') {
  throw new Error('hero badge text is wrong: ' + collectText(heroBadge));
}
if (!String(heroBadge.props.href).includes('/zh-cn/quick_start/pricing')) {
  throw new Error('hero badge should link to the Chinese pricing page');
}
console.log('ok   hero layer ->', collectText(heroBadge));

console.log('client smoke test passed');
