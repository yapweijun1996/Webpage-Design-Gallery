'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const runners = require('../lib/runners');

const MODELS = ['gpt-6.2-sol', 'gpt-6.1-terra'];
const EFFORTS = ['medium', 'xhigh'];
const RUNNERS = ['codex', 'pi'];
const PROJECT = '/tmp/swarm project';

function replay(runner, chunks) {
  const parser = runners.get(runner).createParser();
  const events = [];
  for (const chunk of chunks) events.push(...parser.push(chunk));
  return events.concat(parser.end());
}

function* randomChunks(bytes, seed) {
  for (let offset = 0; offset < bytes.length;) {
    seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
    const size = 1 + (seed >>> 24) % 43;
    yield bytes.subarray(offset, offset + size);
    offset += size;
  }
}

const fixtureCases = [
  ['codex', 'codex-json-sample.jsonl', [
    { kind: 'thought', text: 'I’ll create `hello.txt` containing `hi`.' },
    { kind: 'action', verb: 'editing', target: `/bin/zsh -lc "printf '%s' hi > hello.txt"`, sections: [] },
    { kind: 'thought', text: 'done' },
    { kind: 'done', ok: true, usage: {
      input_tokens: 59352, cached_input_tokens: 29568, cache_write_input_tokens: 0,
      output_tokens: 65, reasoning_output_tokens: 0,
    } },
  ]],
  ['codex', 'codex-json-search-sample.jsonl', [
    { kind: 'thought', text: '我会查找公司创立年份的来源。' },
    { kind: 'action', verb: 'researching', target: 'Goh Joo Hin Singapore founded 1940 1945 company official', sections: [] },
    { kind: 'thought', text: 'Goh Joo Hin was founded in **1940**, according to its [company profile on LinkedIn](https://sg.linkedin.com/company/goh-joo-hin).' },
    { kind: 'done', ok: true, usage: {
      input_tokens: 62358, cached_input_tokens: 29056, cache_write_input_tokens: 0,
      output_tokens: 103, reasoning_output_tokens: 0,
    } },
  ]],
  ['pi', 'pi-json-tool-sample.jsonl', [
    { kind: 'usage', usage: {
      input: 1257, output: 23, cacheRead: 0, cacheWrite: 0, reasoning: 0, totalTokens: 1280,
      cost: { input: 1257 * 0.000002, output: 0.00023, cacheRead: 0, cacheWrite: 0, total: 0.002744 },
    } },
    { kind: 'action', verb: 'editing', target: 'hello.txt', sections: [] },
    { kind: 'usage', usage: {
      input: 1295, output: 5, cacheRead: 0, cacheWrite: 0, reasoning: 0, totalTokens: 1300,
      cost: { input: 0.00259, output: 0.00005, cacheRead: 0, cacheWrite: 0, total: 0.00264 },
    } },
    { kind: 'thought', text: 'done' },
    { kind: 'done', ok: true },
  ]],
];

for (const [name, file, expected] of fixtureCases) {
  test(`${file} emits the same events for line-by-line and seeded chunk replay`, () => {
    const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', file), 'utf8');
    const lineEvents = replay(name, fixture.match(/[^\n]*\n|[^\n]+$/g));
    assert.deepEqual(lineEvents, expected);
    for (const seed of [1, 42, 20261121]) {
      assert.deepEqual(replay(name, randomChunks(Buffer.from(fixture), seed)), lineEvents, `seed ${seed}`);
    }
    assert.deepEqual(replay(name, randomChunks(Buffer.from(fixture.trimEnd()), 42)), lineEvents);
  });
}

function pushEvent(parser, event) {
  return parser.push(JSON.stringify(event) + '\n');
}

test('Manager channel envelopes come only from completed assistant text on the opted-in parser', () => {
  const messages = [{ to: ['02'], kind: 'assign', text: 'Build the hero', task: 'Use the approved concept' }];
  const json = JSON.stringify({ swarmChannel: messages });
  for (const name of RUNNERS) {
    const runner = runners.get(name);
    const parser = runner.createParser({ managerChannel: true });
    const assistant = text => name === 'codex'
      ? { type: 'item.completed', item: { type: 'agent_message', text } }
      : { type: 'message_end', message: { role: 'assistant', content: [{ type: 'text', text }] } };
    const tool = name === 'codex'
      ? { type: 'item.completed', item: { type: 'command_execution', aggregated_output: json } }
      : { type: 'message_end', message: { role: 'toolResult', content: [{ type: 'text', text: json }] } };
    assert.deepEqual(pushEvent(parser, tool), []);
    assert.deepEqual(pushEvent(parser, assistant('Thinking aloud')), [{ kind: 'thought', text: 'Thinking aloud' }]);
    assert.deepEqual(pushEvent(parser, assistant(json)), [{ kind: 'manager-channel', messages }]);
    assert.deepEqual(pushEvent(parser, assistant('```json\n{"swarmChannel":[]}\n```')), [{ kind: 'manager-channel', messages: [] }]);
    assert.deepEqual(pushEvent(parser, assistant(`This is an example: ${json}`)), [{ kind: 'thought', text: `This is an example: ${json}` }]);
    assert.deepEqual(pushEvent(runner.createParser(), assistant(json)), [{ kind: 'thought', text: json }]);
    assert.equal(pushEvent(parser, assistant('{"swarmChannel":false}'))[0].kind, 'error');
    assert.equal(pushEvent(parser, assistant('a'.repeat(96 * 1024 + 1)))[0].kind, 'error');
    assert.deepEqual(parser.end(), []);
  }
});

test('pi emits one thought at each assistant message end and clears text between messages', () => {
  const parser = runners.get('pi').createParser();
  const start = { type: 'message_start', message: { role: 'assistant', content: [] } };
  const delta = (type, text) => ({ type: 'message_update', assistantMessageEvent: { type, delta: text } });
  const end = (...content) => ({ type: 'message_end', message: { role: 'assistant', content } });

  assert.deepEqual(pushEvent(parser, start), []);
  assert.deepEqual(pushEvent(parser, delta('text_delta', 'draft ')), []);
  assert.deepEqual(pushEvent(parser, delta('toolcall_delta', '{"path":"hello.txt"}')), []);
  assert.deepEqual(pushEvent(parser, delta('text_delta', 'wording')), []);
  assert.deepEqual(pushEvent(parser, end(
    { type: 'text', text: 'Final ' }, { type: 'toolCall', name: 'read' }, { type: 'text', text: 'wording.' },
  )), [{ kind: 'thought', text: 'Final wording.' }]);
  assert.deepEqual(pushEvent(parser, { type: 'turn_end', message: { role: 'assistant' } }), []);

  assert.deepEqual(pushEvent(parser, start), []);
  assert.deepEqual(pushEvent(parser, delta('text_delta', 'Streamed ')), []);
  assert.deepEqual(pushEvent(parser, delta('text_delta', 'fallback.')), []);
  assert.deepEqual(pushEvent(parser, end()), [{ kind: 'thought', text: 'Streamed fallback.' }]);
  assert.deepEqual(pushEvent(parser, end({ type: 'toolCall', name: 'write' })), []);
  assert.deepEqual(parser.end(), []);
});

test('codex classifies command verbs and collects section references in order', () => {
  const parser = runners.get('codex').createParser();
  const cases = [
    ['cat sections/02-hero.css', 'reading', ['02']],
    ['sed -n 1,20p notes/03.md', 'reading', ['03']],
    ['printf x > sections/05-features.html', 'editing', ['05']],
    ['rg foo discussion/04.md', 'reading', ['04']],
    ['/bin/zsh -lc "sed -i s/a/b/ sections/05-features.html"', 'editing', ['05']],
    ['node test.js sections/02-hero.css notes/03.md discussion/02.md', 'running', ['02', '03']],
    ['cat subsections/02-hero.css notes/031.md', 'reading', []],
  ];
  for (const [command, verb, sections] of cases) {
    const item = { type: 'command_execution', command };
    assert.deepEqual(pushEvent(parser, { type: 'item.started', item }), [
      { kind: 'action', verb, target: command, sections },
    ]);
    assert.deepEqual(pushEvent(parser, { type: 'item.completed', item }), []);
  }
});

test('codex emits each completed search once and falls back to the item text', () => {
  const parser = runners.get('codex').createParser();
  const item = { id: 'search-1', type: 'web_search', query: '', text: ' references for notes/03.md ' };
  const completed = { type: 'item.completed', item };
  const expected = [{ kind: 'action', verb: 'researching', target: 'references for notes/03.md', sections: [] }];
  assert.deepEqual(pushEvent(parser, { type: 'item.started', item: { ...item, query: 'draft query' } }), []);
  assert.deepEqual(pushEvent(parser, completed), expected);
  assert.deepEqual(pushEvent(parser, completed), []);
  assert.deepEqual(pushEvent(parser, { ...completed, item: { ...item, id: 'search-2' } }), expected);
  assert.deepEqual(pushEvent(parser, { ...completed, item: { type: 'web_search', query: '' } }), []);
});

test('pi normalizes read, write, edit, and bash actions from execution starts', () => {
  const parser = runners.get('pi').createParser();
  const cases = [
    ['read', { path: '/work/notes/03.md' }, 'reading', '/work/notes/03.md', ['03']],
    ['write', { path: 'sections/05-features.html' }, 'editing', 'sections/05-features.html', ['05']],
    ['edit', { path: './sections/02-hero.css' }, 'editing', './sections/02-hero.css', ['02']],
    ['bash', { command: 'rg foo discussion/04.md notes/03.md' }, 'running', 'rg foo discussion/04.md notes/03.md', ['04', '03']],
  ];
  for (const [toolName, args, verb, target, sections] of cases) {
    assert.deepEqual(pushEvent(parser, { type: 'tool_execution_start', toolName, args }), [
      { kind: 'action', verb, target, sections },
    ]);
  }
});

test('pi classifies web-related bash starts as research and uses the first URL', () => {
  const parser = runners.get('pi').createParser();
  for (const [command, target] of [
    ["curl -fsSL 'https://example.test/notes/03.md?a=1&b=2' https://other.test", 'https://example.test/notes/03.md?a=1&b=2'],
    ['wget http://example.test/resource', 'http://example.test/resource'],
    ['wget http://example.test/resource&&echo done', 'http://example.test/resource'],
    ['python fetch.py https://example.test/doc', 'https://example.test/doc'],
    ['curl --version', 'curl --version'],
    ['command wget --help', 'command wget --help'],
  ]) {
    const event = { type: 'tool_execution_start', toolName: 'bash', args: { command } };
    assert.deepEqual(pushEvent(parser, event), [{ kind: 'action', verb: 'researching', target, sections: [] }]);
  }
  const event = { type: 'tool_execution_start', toolName: 'bash', args: { command: 'node wget-helper.js' } };
  assert.deepEqual(pushEvent(parser, event), [
    { kind: 'action', verb: 'running', target: 'node wget-helper.js', sections: [] },
  ]);
});

test('codex drops the known config warning and emits fatal item and turn errors', () => {
  const parser = runners.get('codex').createParser();
  const errorItem = message => ({ type: 'item.completed', item: { type: 'error', message } });
  assert.deepEqual(pushEvent(parser, errorItem('Warning: ignoring unrecognized configuration settings: foo')), []);
  assert.deepEqual(pushEvent(parser, errorItem('Out of context.')), [{ kind: 'error', text: 'Out of context.' }]);
  assert.deepEqual(pushEvent(parser, { type: 'turn.failed', error: { message: 'Turn timed out.' } }), [
    { kind: 'error', text: 'Turn timed out.' },
  ]);
  assert.deepEqual(pushEvent(parser, { type: 'turn.completed' }), [{ kind: 'done', ok: true }]);
});

test('codex ignores the real config warning text that contains a count (regression: every real turn was marked failed)', () => {
  const parser = runners.get('codex').createParser();
  const warn = JSON.stringify({ type: 'item.completed', item: { id: 'item_0', type: 'error', message: 'Codex is ignoring 3 unrecognized configuration settings. Check for typos or deprecated settings.\n  user (/x/config.toml): `agent` is ignored.' } });
  const one = JSON.stringify({ type: 'item.completed', item: { id: 'item_1', type: 'error', message: 'Codex is ignoring 1 unrecognized configuration setting. Check for typos.' } });
  assert.deepEqual(parser.push(warn + '\n' + one + '\n'), []);
});

test('pi ignores a tool failure as a fatal event and reports an aborted run', () => {
  const parser = runners.get('pi').createParser();
  assert.deepEqual(pushEvent(parser, { type: 'tool_execution_end', toolName: 'bash', isError: true }), []);
  assert.deepEqual(pushEvent(parser, { type: 'agent_end', willRetry: false }), []);
  assert.deepEqual(pushEvent(parser, { type: 'agent_settled', aborted: true }), [{ kind: 'error', text: 'pi run aborted.' }]);
});

test('both parsers skip invalid and blank lines and preserve UTF-8 across byte splits', () => {
  const text = 'Ready 好 👍';
  const codex = { type: 'item.completed', item: { type: 'agent_message', text } };
  const pi = { type: 'message_end', message: { role: 'assistant', content: [{ type: 'text', text }] } };
  for (const [name, event] of [['codex', codex], ['pi', pi]]) {
    const bytes = Buffer.from(`\nnot JSON\r\n \r\nnull\n42\n${JSON.stringify(event)}`);
    const chunks = [...bytes].map(byte => Buffer.from([byte]));
    assert.deepEqual(replay(name, chunks), [{ kind: 'thought', text }]);
  }
});

function setEnv(t, values) {
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  t.after(() => assign(previous));
  assign(values);

  function assign(entries) {
    for (const [key, value] of Object.entries(entries)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

for (const name of RUNNERS) {
  for (const model of MODELS) {
    for (const effort of EFFORTS) {
      test(`${name} builds the exact ${model} ${effort} command`, t => {
        setEnv(t, { SWARM_TEST: '0', SWARM_MODEL: 'bad-model', SWARM_EFFORT: 'low', SWARM_CODEX: 'fake', SWARM_PI: 'fake' });
        const runner = runners.get(name);
        const args = name === 'codex'
          ? ['exec', '--json', '-m', model, '-c', 'model_reasoning_effort=' + effort,
            '-s', 'workspace-write', '--skip-git-repo-check', '-C', PROJECT, '-']
          : ['-p', '--mode', 'json', '--model', 'openai-codex/' + model, '--thinking', effort,
            '--no-session', '--no-extensions', '--no-skills', '--no-context-files'];
        assert.equal(runner.name, name);
        assert.deepEqual(runner.buildCommand({ model, effort, projectDir: PROJECT }), {
          command: name, args, cwd: PROJECT, input: 'stdin',
        });
        for (const research of [false, 'true', true]) {
          const expectedArgs = name === 'codex' && research === true
            ? args.toSpliced(6, 0, '-c', 'web_search="live"')
            : args;
          assert.deepEqual(runner.buildCommand({ model, effort, projectDir: PROJECT, research }), {
            command: name, args: expectedArgs, cwd: PROJECT, input: 'stdin',
          });
        }
      });
    }
  }
}

test('non-allowlisted runners, models and reasoning efforts are rejected', async () => {
  for (const name of ['bash', 'constructor', '__proto__']) assert.throws(() => runners.get(name), /Unsupported runner/);
  for (const name of RUNNERS) {
    const runner = runners.get(name);
    for (const research of [undefined, true]) {
      for (const model of ['other-model', 'constructor', [MODELS[0]]]) {
        assert.throws(() => runner.buildCommand({ model, effort: 'medium', projectDir: PROJECT, research }), /Unsupported model/);
      }
      assert.throws(() => runner.buildCommand({ model: MODELS[0], effort: 'low', projectDir: PROJECT, research }),
        /Unsupported reasoning effort/);
    }
    await assert.rejects(runner.readiness({ model: 'other-model' }), /Unsupported model/);
  }
});

test('adds only explicit absolute project skill directories to the Pi command', () => {
  const options = { model: MODELS[0], effort: 'medium', projectDir: PROJECT };
  const skillDirs = [path.join(PROJECT, 'skills', 'accessibility'), path.join(PROJECT, 'skills', 'design QA')];
  const pi = runners.get('pi');
  const command = pi.buildCommand({ ...options, skillDirs });
  assert.ok(command.args.includes('--no-skills'));
  assert.deepEqual(command.args.slice(-4), ['--skill', skillDirs[0], '--skill', skillDirs[1]]);
  assert.throws(() => pi.buildCommand({ ...options, skillDirs: ['skills/relative'] }), /absolute paths/);
  const codex = runners.get('codex');
  assert.deepEqual(codex.buildCommand({ ...options, skillDirs }), codex.buildCommand(options));
});

test('both binaries require the exact SWARM_TEST gate for fake executable overrides', t => {
  const overrides = { SWARM_CODEX: '/tmp/fake codex', SWARM_PI: '/tmp/fake pi' };
  setEnv(t, { ...overrides, SWARM_TEST: '1' });
  for (const name of RUNNERS) {
    const runner = runners.get(name);
    const override = overrides[`SWARM_${name.toUpperCase()}`];
    for (const SWARM_TEST of [undefined, 'true', '0']) {
      assert.equal(runner.binary({ ...overrides, SWARM_TEST }), name);
    }
    assert.equal(runner.binary({ SWARM_TEST: '1' }), name);
    assert.equal(runner.binary({ ...overrides, SWARM_TEST: '1' }), override);
    assert.equal(runner.buildCommand({ model: MODELS[0], effort: 'medium', projectDir: PROJECT }).command, override);
  }
});

function fakeRunner(t, name, script) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-runner-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const executable = path.join(temp, `fake ${name}`);
  if (script) fs.writeFileSync(executable, '#!/bin/sh\nset -eu\n' + script, { mode: 0o700 });
  setEnv(t, { SWARM_TEST: '1', [`SWARM_${name.toUpperCase()}`]: executable });
  return runners.get(name);
}

function probeScript(name, authOutput, version = `printf '%s\\n' '${name} 1.2.3'`) {
  const authArgs = name === 'codex' ? 'login status' : 'auth check --model openai-codex/gpt-6.1-terra --json';
  return `case "$*" in\n  '--version') ${version} ;;\n  '${authArgs}') ${authOutput} ;;\n  *) exit 64 ;;\nesac\n`;
}

for (const name of RUNNERS) {
  test(`${name} readiness executes the expected version and authentication probes`, async t => {
    const output = name === 'codex' ? "printf '%s\\n' 'Logged in using ChatGPT' >&2" : `printf '%s\\n' '{"status":"ready"}'`;
    const runner = fakeRunner(t, name, probeScript(name, output));
    const result = await runner.readiness({ model: MODELS[1] });
    assert.equal(result.ok, true);
    assert.equal(result.version, `${name} 1.2.3`);
    assert.equal(result.login, true);
    assert.match(result.detail, /ready/i);
    assert.ok(Number.isFinite(result.ms) && result.ms >= 0);
  });

  test(`${name} readiness reports missing login`, async t => {
    const output = name === 'codex' ? "printf '%s\\n' 'Not logged in' >&2; exit 1" : `printf '%s\\n' '{"status":"missing"}'`;
    const runner = fakeRunner(t, name, probeScript(name, output));
    const result = await runner.readiness({ model: MODELS[1] });
    assert.equal(result.ok, false);
    assert.equal(result.version, `${name} 1.2.3`);
    assert.equal(result.login, false);
    assert.match(result.detail, /not logged in/i);
  });

  test(`${name} readiness reports a missing binary`, async t => {
    const runner = fakeRunner(t, name);
    const result = await runner.readiness({ model: MODELS[1] });
    assert.equal(result.ok, false);
    assert.equal(result.version, '');
    assert.equal(result.login, false);
    assert.match(result.detail, /binary not found/i);
  });

  test(`${name} readiness stops a hanging probe within the injected timeout`, async t => {
    const auth = name === 'codex' ? 'exec /bin/sleep 5' : 'exit 64';
    const version = name === 'codex' ? "printf '%s\\n' 'codex 1.2.3'" : 'exec /bin/sleep 5';
    const runner = fakeRunner(t, name, probeScript(name, auth, version));
    const result = await runner.readiness({ model: MODELS[1], timeoutMs: 1000 });
    assert.equal(result.ok, false);
    assert.equal(result.version, name === 'codex' ? 'codex 1.2.3' : '');
    assert.equal(result.login, false);
    assert.match(result.detail, /timed out after 1000 ms/i);
    assert.ok(result.ms < 4000, `Readiness took ${result.ms} ms`);
  });
}

test('readiness shares one timeout budget across both probes', async t => {
  const runner = fakeRunner(t, 'codex', probeScript(
    'codex', "printf '%s\\n' 'Logged in'", `: > "$0.version"; printf '%s\\n' 'codex 1.2.3'`,
  ));
  const marker = runner.binary() + '.version';
  t.mock.method(performance, 'now', () => fs.existsSync(marker) ? 8000 : 0);
  const result = await runner.readiness({ model: MODELS[1], timeoutMs: 8000 });
  assert.equal(result.version, 'codex 1.2.3');
  assert.equal(result.ok, false);
  assert.match(result.detail, /timed out after 8000 ms/i);
});

test('readiness passes CLI configuration without inheriting server credentials', async t => {
  const runner = fakeRunner(t, 'codex', probeScript('codex', 'test "$CODEX_HOME" = "/fixture/codex" && test -z "${OPENAI_API_KEY:-}" && test -z "${SWARM_SETTINGS:-}"'));
  setEnv(t, { CODEX_HOME: '/fixture/codex', OPENAI_API_KEY: 'fixture-key', SWARM_SETTINGS: '/fixture/settings.json' });
  assert.equal((await runner.readiness({ model: MODELS[1] })).ok, true);
});

test('codex classifies a curl fetch that does not touch project files as researching', () => {
  const parser = runners.get('codex').createParser();
  const ev = parser.push(JSON.stringify({ type: 'item.started', item: { type: 'command_execution', command: '/bin/zsh -lc "curl -Ls https://example.com/x | rg -o logo > /tmp/out.txt"' } }) + '\n');
  assert.equal(ev[0].verb, 'researching');
  const own = parser.push(JSON.stringify({ type: 'item.started', item: { type: 'command_execution', command: "/bin/zsh -lc 'curl -s https://example.com > sections/02-hero.html'" } }) + '\n');
  assert.equal(own[0].verb, 'editing');
});
