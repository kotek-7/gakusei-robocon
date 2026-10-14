import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register, run, togglePinned, clearRecent, useCommands } from './commands';

test('固定はコマンドを実行せず、実行時の有効条件を維持する', () => {
  let enabled = false, calls = 0;
  register({ id: 'test.pin', title: '操作', category: '検証', enabled: () => enabled, run: () => { calls++; } });
  togglePinned('test.pin');
  assert.ok(useCommands.getState().pinned.includes('test.pin'));
  run('test.pin');
  assert.equal(calls, 0);
  enabled = true;
  run('test.pin');
  assert.equal(calls, 1);
  assert.equal(useCommands.getState().recent[0], 'test.pin');
  clearRecent();
  assert.deepEqual(useCommands.getState().recent, []);
  assert.ok(useCommands.getState().pinned.includes('test.pin'));
  togglePinned('test.pin');
  assert.ok(!useCommands.getState().pinned.includes('test.pin'));
});
test('不明な操作と引数専用の操作は固定しない', () => {
  register({ id: 'test.hidden', title: '内部操作', category: '検証', hidden: true, run: () => {} });
  togglePinned('test.hidden');
  togglePinned('missing');
  assert.ok(!useCommands.getState().pinned.includes('test.hidden'));
  assert.ok(!useCommands.getState().pinned.includes('missing'));
});
