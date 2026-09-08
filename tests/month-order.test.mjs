import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, newEvent, validateState, sortedEvents } from '../src/domain.mjs';
import { reorderMonthlyEvents } from '../src/month-order.mjs';
const sample = () => {
  const s = blankState(2025);
  for (const [id, month] of [['a', 1], ['b', 1], ['c', 1], ['d', 2]]) {
    s.events.push({ ...newEvent(month, s.events), id, title: id, energy: id === 'a' ? null : 5,
      feelings: ['自在', '自訂詞'], origin: 'mixed', influence: 'shared', important: true, private: true });
  }
  s.events.push({ ...newEvent(1, [], 'background'), id: 'bg', title: 'daily' });
  s.reflection.notice = '舊版內容';
  return s;
};
const ids = events => sortedEvents(events).map(e => e.id);
for (const [eventId, index, expected] of [
  ['a', 2, ['b', 'c', 'a', 'd']], ['c', 0, ['c', 'a', 'b', 'd']],
  ['a', 1, ['b', 'a', 'c', 'd']], ['b', 2, ['a', 'c', 'b', 'd']]
]) test(`move ${eventId} to ${index} inserts instead of swapping endpoints`, () => {
  const s = sample(); const next = reorderMonthlyEvents(s.events, eventId, index);
  assert.deepEqual(ids(next), expected); validateState({ ...s, events: next });
});
test('does not mutate the input or lose any non-order metadata', () => {
  const s = sample(), copy = structuredClone(s), next = reorderMonthlyEvents(s.events, 'c', 0);
  assert.deepEqual(s, copy);
  for (const e of next) {
    const { order, ...rest } = e, { order: oldOrder, ...old } = s.events.find(x => x.id === e.id);
    assert.deepEqual(rest, old);
  }
  assert.equal(next.find(e => e.id === 'd'), s.events.find(e => e.id === 'd'));
  assert.equal(next.find(e => e.id === 'bg'), s.events.find(e => e.id === 'bg'));
});
test('no-op keeps the original event array', () => {
  const s = sample(); assert.equal(reorderMonthlyEvents(s.events, 'a', 0), s.events);
});
test('normalizes gaps only in the month actually moved', () => {
  const s = sample(); s.events = s.events.filter(e => e.id !== 'b');
  const next = reorderMonthlyEvents(s.events, 'c', 0);
  assert.deepEqual(sortedEvents(next).filter(e => e.month === 1).map(e => e.order), [1, 2]);
  validateState({ ...s, events: next });
});
for (const index of [-1, 3, 1.5, NaN, '1']) test(`reject invalid destination ${index}`, () => {
  assert.throws(() => reorderMonthlyEvents(sample().events, 'a', index));
});
for (const id of ['bg', 'missing']) test(`reject non-monthly card ${id}`, () => {
  assert.throws(() => reorderMonthlyEvents(sample().events, id, 0));
});
test('legacy observations and metadata survive a backup roundtrip after ordering', () => {
  const s = sample(), next = validateState({ ...s, events: reorderMonthlyEvents(s.events, 'a', 2) });
  assert.equal(next.reflection.notice, s.reflection.notice);
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(next))), next);
});
