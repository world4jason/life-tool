import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, newEvent, demoState, validateState, parseBackup, clone, removeEntity } from '../src/domain.mjs';
import { discoveryCounts, discoveryCreate, discoveryClassify, discoveryMove, discoveryRename } from '../src/discovery-model.mjs';
import { createGuideState } from '../src/guide.mjs';
function sample() { const s = blankState(2025); s.events = [1,2,3].map(month => ({ ...newEvent(month), title: `事件${month}` })); return s; }
function oldBackup() { const s = demoState(); s.version = 1; for (const t of s.themes) { delete t.method; delete t.unrelatedEventIds; } return s; }
test('v1 migration preserves every existing field without inferring unrelated cards', () => {
  const old = oldBackup(), before = clone(old), next = validateState(old);
  assert.equal(next.version, 2); assert.deepEqual(old, before);
  for (let i = 0; i < old.themes.length; i++) {
    const { method, unrelatedEventIds, ...rest } = next.themes[i];
    assert.equal(method, 'legacy'); assert.deepEqual(unrelatedEventIds, []); assert.deepEqual(rest, old.themes[i]);
  }
  for (const key of ['events','routes','nodes','reviews','reflection','budget']) assert.deepEqual(next[key], old[key]);
});
test('v2 roundtrip retains binary decisions and untouched old plans', () => {
  const s = validateState(oldBackup()); const t = discoveryCreate(s, 'binary', '自由');
  discoveryClassify(s,t.id,s.events[0].id,'unrelated');
  assert.deepEqual(parseBackup(JSON.stringify(s)),s);
});
test('new binary term does not fabricate a direction or negative decisions', () => {
  const s=sample(), t=discoveryCreate(s,'binary','自由');
  assert.equal(t.value,''); assert.equal(t.intention,''); assert.equal(discoveryCounts(s,t).pending.length,3);
});
test('related, unrelated and pending transitions remain disjoint', () => {
  const s=sample(), t=discoveryCreate(s,'binary','自由'), id=s.events[0].id;
  for (const answer of ['related','unrelated','related','pending']) {
    discoveryClassify(s,t.id,id,answer);validateState(s);
    assert.equal(t.eventIds.includes(id),answer==='related');assert.equal(t.unrelatedEventIds.includes(id),answer==='unrelated');
  }
});
test('low energy is not classified as unrelated automatically', () => {
  const s=sample(), t=discoveryCreate(s,'binary','自由');s.events[0].energy=-10;
  discoveryClassify(s,t.id,s.events[0].id,'related');assert.equal(discoveryCounts(s,t).related.length,1);
});
test('terms can disagree about the same event without altering each other', () => {
  const s=sample(), a=discoveryCreate(s,'binary','自由'), b=discoveryCreate(s,'binary','陪伴');
  discoveryClassify(s,a.id,s.events[0].id,'related');discoveryClassify(s,b.id,s.events[0].id,'unrelated');
  assert.deepEqual(a.eventIds,[s.events[0].id]);assert.deepEqual(b.unrelatedEventIds,[s.events[0].id]);
});
test('new events enter pending in every binary term', () => {
  const s=sample(), t=discoveryCreate(s,'binary','自由');s.events.forEach(e=>discoveryClassify(s,t.id,e.id,'related'));
  s.events.push(newEvent(4));assert.equal(discoveryCounts(s,t).pending.length,1);
});
test('zero events has zero total, not a manufactured 100 percent match', () => {
  const s=blankState(),t=discoveryCreate(s,'binary','自由');assert.deepEqual(discoveryCounts(s,t),{related:[],unrelated:[],pending:[],total:0});
});
test('unknown answer, missing term or missing event rejects without mutation', () => {
  const s=sample(),t=discoveryCreate(s,'binary','自由'),before=clone(s);
  for(const args of [[t.id,s.events[0].id,'wrong'],['missing',s.events[0].id,'related'],[t.id,'missing','related']]) assert.throws(()=>discoveryClassify(s,...args));
  assert.deepEqual(s,before);
});
test('group membership never asserts that other events are unrelated', () => {
  const s=sample(),t=discoveryCreate(s,'group','陪伴',[s.events[0].id]);
  assert.deepEqual(t.unrelatedEventIds,[]);assert.equal(t.eventIds.length,1);validateState(s);
});
test('drag into new group creates unnamed group with selected cards', () => {
  const s=sample(),id=discoveryMove(s,[s.events[0].id,s.events[1].id],'','new');
  assert.equal(s.themes[0].id,id);assert.equal(s.themes[0].label,'');assert.equal(s.themes[0].eventIds.length,2);validateState(s);
});
test('moving between groups removes only the source membership', () => {
  const s=sample(), id=s.events[0].id, a=discoveryCreate(s,'group','A',[id]),b=discoveryCreate(s,'group','B'), c=discoveryCreate(s,'group','C',[id]);
  discoveryMove(s,[id],a.id,b.id);assert.deepEqual(a.eventIds,[]);assert.deepEqual(b.eventIds,[id]);assert.deepEqual(c.eventIds,[id]);
});
test('copying to another group keeps the source', () => {
  const s=sample(),id=s.events[0].id,a=discoveryCreate(s,'group','A',[id]),b=discoveryCreate(s,'group','B');
  discoveryMove(s,[id],a.id,b.id,true);assert.deepEqual(a.eventIds,[id]);assert.deepEqual(b.eventIds,[id]);
});
test('removing membership does not delete the event or affect binary answers', () => {
  const s=sample(),id=s.events[0].id,g=discoveryCreate(s,'group','G',[id]),b=discoveryCreate(s,'binary','B');
  discoveryClassify(s,b.id,id,'unrelated');discoveryMove(s,[id],g.id,'pool');
  assert.equal(s.events.length,3);assert.deepEqual(g.eventIds,[]);assert.deepEqual(b.unrelatedEventIds,[id]);
});
test('moving to same group is idempotent and adding deduplicates cards', () => {
  const s=sample(),id=s.events[0].id,g=discoveryCreate(s,'group','G',[id]);
  discoveryMove(s,[id,id],g.id,g.id);assert.deepEqual(g.eventIds,[id]);validateState(s);
});
test('invalid move source or destination does not alter valid groups', () => {
  const s=sample(),g=discoveryCreate(s,'group','G',[s.events[0].id]),before=clone(s);
  assert.throws(()=>discoveryMove(s,[s.events[0].id],g.id,'missing'));
  assert.throws(()=>discoveryMove(s,[s.events[1].id],g.id,'new'));assert.deepEqual(s,before);
});
test('renaming preserves direction, legacy notes, routes and nodes', () => {
  const s=demoState(),before=clone(s),t=s.themes[0];discoveryRename(s,t.id,'自主');
  assert.equal(t.label,'自主');for(const key of Object.keys(t).filter(k=>k!=='label'))assert.deepEqual(t[key],before.themes[0][key]);
  for(const key of ['routes','nodes','reviews'])assert.deepEqual(s[key],before[key]);
});
test('deleting related and unrelated events cleans references, not plans', () => {
  let s=demoState();const before=clone(s.routes),t=discoveryCreate(s,'binary','自由');
  const ids=s.events.slice(0,2).map(e=>e.id);discoveryClassify(s,t.id,ids[0],'related');discoveryClassify(s,t.id,ids[1],'unrelated');
  for(const id of ids)s=removeEntity(s,'events',id);
  assert.deepEqual(s.themes.at(-1).eventIds,[]);assert.deepEqual(s.themes.at(-1).unrelatedEventIds,[]);assert.deepEqual(s.routes,before);
});
test('deleting a theme retains downstream plans and detaches only its references', () => {
  const s=demoState(),t=s.themes[0],n=removeEntity(s,'themes',t.id);
  assert.equal(n.routes.length,s.routes.length);assert.equal(n.nodes.length,s.nodes.length);validateState(n);
});
test('v2 rejects overlapping or dangling classifications', () => {
  const s=sample(),t=discoveryCreate(s,'binary','自由',[s.events[0].id]);t.unrelatedEventIds=[s.events[0].id];
  assert.throws(()=>validateState(s),/重複/);t.unrelatedEventIds=['missing'];assert.throws(()=>validateState(s),/不存在/);
});
test('v2 rejects missing metadata and unrelated lists on groups', () => {
  const s=sample(),t=discoveryCreate(s,'group','G');t.unrelatedEventIds=[s.events[0].id];assert.throws(()=>validateState(s));
  t.unrelatedEventIds=[];delete t.method;assert.throws(()=>validateState(s));
});
test('v1 unselected cards remain unjudged even after migration', () => {
  const s=validateState(oldBackup());assert.ok(s.themes.every(t=>t.method==='legacy'&&t.unrelatedEventIds.length===0));
});
test('theme capacity is still bounded at the transaction validation layer', () => {
  const s=sample();for(let i=0;i<30;i++)discoveryCreate(s,'group',`${i}`);validateState(s);
  discoveryCreate(s,'group','31');assert.throws(()=>validateState(s));
});
test('guided binary example starts with no pre-decided answers', () => {
  const s=createGuideState(),t=s.themes.find(t=>t.method==='binary');assert.ok(t);assert.equal(discoveryCounts(s,t).pending.length,s.events.length);
});
