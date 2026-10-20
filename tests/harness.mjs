// Runs an n8n Code-node source file outside n8n with mocked globals.
import { loadCode } from '../tools/build-workflows.mjs';

export function runCode(file, { input = [], nodes = {}, env = {}, executionId = 'test-1', mode = 'all' } = {}) {
  const src = loadCode(file);
  const wrap = (j) => (j && j.json ? j : { json: j });
  const items = input.map(wrap);
  const $input = { all: () => items, first: () => items[0], item: items[0] };
  const $ = (name) => {
    if (!(name in nodes)) throw new Error(`test: node "${name}" not mocked`);
    const list = [].concat(nodes[name]).map(wrap);
    return { first: () => list[0], all: () => list, item: list[0], isExecuted: true };
  };
  const fn = new Function('$input', '$json', '$', '$env', '$execution', `return (async () => {\n${src}\n})();`);
  return fn($input, items[0] && items[0].json, $, { TZ: 'UTC', ...env }, { id: executionId }).then((out) => {
    if (mode === 'each' || !Array.isArray(out)) return [].concat(out).map(wrap);
    return out.map(wrap);
  });
}
