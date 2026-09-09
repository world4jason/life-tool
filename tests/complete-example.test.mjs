import test from 'node:test';
import assert from 'node:assert/strict';
import { EXAMPLE, EXAMPLE_STEPS, createCompleteExample, exampleMetrics } from '../src/complete-example.mjs';
import { validateState, parseBackup, progressFor, actionReadiness, budgetUsage } from '../src/domain.mjs';
import { discoveryCounts } from '../src/discovery-model.mjs';
import { createGuideState } from '../src/guide.mjs';

test('complete case validates without changing the data schema', () => {
 const s = createCompleteExample(); assert.equal(s.version, 2); assert.deepEqual(validateState(s), s);
 assert.deepEqual(parseBackup(JSON.stringify(s)), s);
});
test('every month has one to three events, all with facts and explicit energy', () => {
 const s = createCompleteExample();
 for (let m=1;m<=12;m++) {
  const list=s.events.filter(e=>e.kind==='event'&&e.month===m);
  assert.ok(list.length>=1 && list.length<=3);
  assert.equal(new Set(list.map(e=>e.order)).size,list.length);
 }
 assert.equal(s.events.length,20); assert.equal(s.events.filter(e=>e.kind==='background').length,2);
 assert.ok(s.events.every(e=>e.facts && Number.isInteger(e.energy)));
 assert.ok(s.events.some(e=>e.energy===0)); assert.ok(s.events.some(e=>e.energy<0));
});
test('binary themes explicitly classify all events without overlap', () => {
 const s=createCompleteExample();
 for (const t of s.themes.filter(t=>t.method==='binary')) {
  const c=discoveryCounts(s,t); assert.equal(c.pending.length,0);
  assert.equal(c.related.length+c.unrelated.length,20); assert.ok(c.related.length && c.unrelated.length);
 }
 const f=s.themes.find(t=>t.id==='case-freedom');
 assert.ok(f.eventIds.includes('case-event-3')); assert.ok(f.eventIds.includes('case-event-9'));
 assert.ok(f.unrelatedEventIds.includes('case-event-6'));
});
test('three named groups reference existing cards and allow overlap', () => {
 const s=createCompleteExample(), groups=s.themes.filter(t=>t.method==='group');
 assert.equal(groups.length,3); assert.ok(groups.every(t=>t.label && t.eventIds.length && !t.unrelatedEventIds.length));
 assert.equal(new Set(groups.flatMap(t=>t.eventIds)).size,s.events.length);
 assert.ok(groups.filter(t=>t.eventIds.includes('case-event-10')).length>1);
});
test('six numeric alternatives include choices and rejection reasons', () => {
 const s=createCompleteExample(); assert.equal(s.routes.length,6); assert.equal(s.routes.filter(r=>r.selected).length,2);
 for (const r of s.routes) for (const key of ['title','benefit','cost','firstStep','obstacle','fallback','reason']) assert.ok(r[key]);
 assert.deepEqual(budgetUsage(s).totals,{hours:5,money:1600,energy:5});
 assert.deepEqual(budgetUsage(s).over,[]); assert.deepEqual(budgetUsage(s,0.5).over,['hours']);
});
test('actions have filled quantities, acceptance, context and dates', () => {
 const s=createCompleteExample(); for(const n of s.nodes.filter(n=>n.type==='action')) {
  assert.deepEqual(actionReadiness(n),[]); assert.equal(n.startDate,EXAMPLE.start); assert.equal(n.reviewDate,EXAMPLE.review);
  assert.ok(n.minimum && n.obstacle && n.support && n.unit); assert.ok(n.target>0);
 }
});
test('fixed historical review date does not drift with the reader clock', () => {
 const s=createCompleteExample(); assert.equal(EXAMPLE.review,'2026-01-18'); assert.equal(s.year,2025);
 assert.ok(s.reviews.every(r=>r.date>=EXAMPLE.start && r.date<=EXAMPLE.review));
 assert.ok(s.nodes.every(n=>n.reviewDate===EXAMPLE.review));
});
test('first week and second week show different meaningful outcomes', () => {
 const s=createCompleteExample(), n=s.nodes.find(n=>n.id==='case-a-space');
 const a=progressFor(n,s.reviews,EXAMPLE.firstReview), b=progressFor(n,s.reviews,EXAMPLE.review);
 assert.equal(a.full,2); assert.equal(a.met,true); assert.equal(b.full,1); assert.equal(b.minimum,1); assert.equal(b.met,false);
});
test('result and action are not double counted', () => {
 const s=createCompleteExample(), n=s.nodes.find(n=>n.id==='case-kr-space');
 const p=progressFor(n,s.reviews,EXAMPLE.review); assert.equal(p.full,3); assert.equal(p.met,true); assert.equal(p.records.length,1);
});
test('includes a completed but draining action and a missed occurrence', () => {
 const s=createCompleteExample(); assert.ok(s.reviews.some(r=>r.mode==='full' && r.direction==='drains'));
 assert.ok(s.reviews.some(r=>r.mode==='missed' && r.amount===0));
});
test('explicit zero satisfies an upper bound without inventing data', () => {
 const s=createCompleteExample(),n=s.nodes.find(n=>n.id==='case-a-drink'),p=progressFor(n,s.reviews,EXAMPLE.review);
 assert.equal(p.full,0); assert.equal(p.hasData,true); assert.equal(p.met,true);
 assert.equal(progressFor(n,[],EXAMPLE.review).met,null);
});
test('overview metrics reflect edits instead of fixed counts', () => {
 const s=createCompleteExample(); s.routes[0].selected=false;
 assert.equal(exampleMetrics(s).selected,1); assert.equal(exampleMetrics(s).usage.totals.hours,3);
 s.reviews=[]; assert.equal(exampleMetrics(s).logs,0); assert.equal(exampleMetrics(s).space.hasData,false);
});
test('six concise explanations cover the complete chain', () => {
 assert.equal(EXAMPLE_STEPS.length,6); assert.ok(EXAMPLE_STEPS.every(s=>s.title && s.text && s.why));
});
test('complete case and practice remain different independent fixtures', () => {
 const a=createCompleteExample(),b=createCompleteExample(),g=createGuideState();
 a.events[0].title='modified'; assert.notEqual(a.events[0].title,b.events[0].title);
 assert.equal(g.reviews.length,0); assert.ok(g.events.some(e=>e.energy===null)); assert.ok(b.reviews.length);
});
