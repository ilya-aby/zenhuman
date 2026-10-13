// Run with: node tests/service-worker.mjs. Uses fixture credentials and no network.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const sources = new Map(['settings.js', 'summary-api.js', 'email-text.js']
  .map(name => [name, read(`src/${name}`)]));
const report = { textContent: '', dataset: {} };
const context = vm.createContext({
  console, crypto: globalThis.crypto, TextEncoder, AbortController, AbortSignal,
  document: { getElementById: () => report }
});
vm.runInContext('globalThis.window = globalThis;', context);
const fixture = read('tests/background.html').match(/<script>([\s\S]*?)<\/script>/)[1];
vm.runInContext(fixture, context);

// Unlike the browser fixture's no-op, load the worker's actual dependencies and
// record missing imports even when production code catches the exception.
const missingImports = [];
context.importScripts = (...names) => {
  for (const name of names) {
    if (!sources.has(name)) {
      missingImports.push(name);
      throw new Error(`Unpackaged worker dependency: ${name}`);
    }
    vm.runInContext(sources.get(name), context, { filename: `src/${name}` });
  }
};
vm.runInContext(read('src/background.js'), context, { filename: 'src/background.js' });
assert.deepEqual(missingImports, [], 'A fresh install must not request missing worker scripts');
assert.equal(typeof vm.runInContext('fixtureHandler', context), 'function', 'Worker registers its message handler');

await vm.runInContext(read('tests/background.js'), context, { filename: 'tests/background.js' });
assert.equal(report.dataset.result, 'pass', report.textContent);
console.log('PASS: Worker starts using packaged dependencies only');
console.log(report.textContent);
