import test from 'node:test';
import assert from 'node:assert/strict';
import { validateState, clone, removeEntity } from '../src/domain.mjs';
import { GUIDE_STEPS, createGuideState, prepareGuideStep } from '../src/guide.mjs';

test('six guide steps have concrete actions and form targets', () => {
  assert.equal(GUIDE_STEPS.length, 6);
  for (const step of GUIDE_STEPS) assert.ok(step.text && step.action && step.form && step.target && step.field);
});
test('guide sample conforms to v2 backup schema', () => {
  assert.deepEqual(validateState(createGuideState()).version, 2);
});
test('scoring example begins unrated, never implicit zero', () => {
  assert.equal(createGuideState().events.find(e => e.id === 'demo-event-5').energy, null);
});
test('new examples have no selected route or fabricated reviews', () => {
  const s = createGuideState();
  assert.ok(s.routes.every(r => !r.selected)); assert.equal(s.reviews.length, 0);
  assert.equal(s.nodes.length, 0);
});
test('early chapters do not create action plans', () => {
  const s = createGuideState(); assert.equal(prepareGuideStep(s, 4), s);
});
test('skipping to review creates valid, clearly fictional experiment', () => {
  const s = createGuideState(), before = clone(s), next = prepareGuideStep(s, 6);
  assert.deepEqual(s, before); assert.equal(next.nodes.length, 2);
  assert.equal(next.nodes[1].routeId, 'demo-route-1'); validateState(next);
});
for (const [id, period] of [['demo-route-1', 'week'], ['demo-route-2', 'month'], ['demo-route-3', 'week']]) {
  test(`experiment follows selected route ${id}`, () => {
    const s = createGuideState(); s.routes.find(r => r.id === id).selected = true;
    const n = prepareGuideStep(s, 5, id).nodes.find(n => n.type === 'action');
    assert.equal(n.routeId, id); assert.equal(n.period, period);
    assert.ok(n.acceptance && n.trigger && n.fallback && n.reviewDate);
  });
}
test('revisiting a chapter never overwrites an edited experiment', () => {
  const s = prepareGuideStep(createGuideState(), 5);
  s.nodes[1].title = '我的修改'; s.nodes[1].target = 3;
  assert.equal(prepareGuideStep(s, 6), s);
  assert.equal(s.nodes[1].title, '我的修改'); assert.equal(s.nodes[1].target, 3);
});
test('deleted action can be recreated without duplicate parent identifiers', () => {
  const s = removeEntity(prepareGuideStep(createGuideState(), 5), 'nodes', 'guide-action');
  const next = prepareGuideStep(s, 6); assert.equal(next.nodes.length, 2); validateState(next);
});
test('guide sessions never share mutable data', () => {
  const a = createGuideState(), b = createGuideState(); a.events[0].title = 'edited';
  assert.notEqual(a.events[0].title, b.events[0].title);
});
