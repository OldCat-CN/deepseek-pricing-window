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
let component;
const fakeLocale = {
  register(ns, locale, dict) {
    dictionaries.set(locale, dict);
    return () => dictionaries.delete(locale);
  },
  bind() {
    return (key) => {
      for (const id of ['zh', 'en']) {
        const dict = dictionaries.get(id);
        if (dict && Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
      }
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
      component = { options, comp };
    },
  },
});

if (!component) throw new Error('no slot registration');
if (component.options.id !== 'deepseek-pricing-window') throw new Error('unexpected slot id');

function collectText(node) {
  if (typeof node === 'string') return node;
  if (!node || typeof node !== 'object') return '';
  return (node.children || []).map(collectText).join('');
}

function render(atMs) {
  fakeNow = atMs;
  const outer = component.comp();
  const inner = outer.type(outer.props);
  return { inner, title: inner.props.title || '', text: collectText(inner) };
}

const holidayLine = '节假日表：2026-2027 年。';
const cases = [
  [Date.UTC(2026, 10, 19, 8, 31), '峰时 · 2倍', '距离转入谷时约 1小时29分', 'Thursday 08:31 UTC (peak)'],
  [Date.UTC(2026, 10, 19, 4, 0), '谷时 · 5折', '距离转入峰时约 2小时', 'Thursday 04:00 UTC boundary'],
  [Date.UTC(2026, 10, 19, 1, 0), '峰时 · 2倍', '距离转入谷时约 3小时', 'Thursday 01:00 UTC peak start'],
  [Date.UTC(2026, 10, 21, 2, 0), '谷时 · 5折', '距离转入峰时约 1天23小时', 'Saturday'],
  [Date.UTC(2026, 9, 1, 2, 0), '谷时 · 5折', '距离转入峰时约 6天23小时', 'National Day holiday'],
  [Date.UTC(2027, 0, 1, 2, 0), '谷时 · 5折', '距离转入峰时约 2天23小时', 'New Year holiday 2027'],
];

for (const [at, expectedText, expectedTitlePart, label] of cases) {
  const { inner, title, text } = render(at);
  if (text !== expectedText) {
    throw new Error(label + ': expected badge "' + expectedText + '", got "' + text + '"');
  }
  if (!title.includes(expectedTitlePart)) {
    throw new Error(label + ': expected title to include "' + expectedTitlePart + '"\n' + title);
  }
  if (!title.includes(holidayLine)) {
    throw new Error(label + ': title is missing "' + holidayLine + '"\n' + title);
  }
  if (inner.props.role !== 'note' || inner.props.tabIndex !== 0) {
    throw new Error(label + ': badge is missing its accessible role/focus');
  }
  if (inner.props['aria-label'] !== title) {
    throw new Error(label + ': aria-label does not match the title');
  }
  console.log('ok  ', label, '->', text);
}

console.log('client smoke test passed');
