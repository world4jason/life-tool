import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspace,newEvent,makeDemo,validateWorkspace,parseBackup,chronology,chartPoints,ratedEvents,resourceStatus,deleteEntity,upsertEvent,afterDays} from '../src/model.js';
const demo=()=>makeDemo(2025);
test('blank workspace and demo validate, including distinct score perspectives',()=>{
  assert.deepEqual(validateWorkspace(createWorkspace(2026)),createWorkspace(2026));
  const w=demo();assert.equal(validateWorkspace(w).events.length,13);assert.equal(w.events[0].energyNow,null);
});
test('JSON round trip preserves all state and reviews',()=>{const w=demo();assert.deepEqual(parseBackup(JSON.stringify(w)),w);});
test('two energy perspectives do not destroy each other',()=>{const w=demo();w.events[0].energyNow=-2;assert.equal(ratedEvents(w)[0].energy,6);w.basis='now';assert.equal(ratedEvents(w)[0].energy,-2);assert.equal(w.events[0].energy,6);});
test('unrated events are omitted, zero is a valid rating, background is not plotted',()=>{
  const w=createWorkspace();w.events=[{...newEvent(3),id:'zero',energy:0},{...newEvent(5),id:'unrated',energy:null},{...newEvent(1),id:'daily',energy:10,background:true}];
  const points=chartPoints(w.events);assert.equal(points.length,1);assert.equal(points[0].event.id,'zero');assert.equal(points[0].y,190);
});
test('chronology sorts month then explicit in-month order',()=>{const events=[{...newEvent(12),id:'late'},{...newEvent(1),id:'second',order:2},{...newEvent(1),id:'first'}];assert.deepEqual(chronology(events).map(e=>e.id),['first','second','late']);});
test('upserting reorders a month without mutating input or duplicating ranks',()=>{
  const input=[{...newEvent(1),id:'a',order:1},{...newEvent(1),id:'b',order:2}];
  const result=upsertEvent(input,{...input[1],order:1});assert.deepEqual(chronology(result).map(e=>[e.id,e.order]),[['b',1],['a',2]]);assert.equal(input[0].order,1);
});
test('moving events to background releases monthly positions',()=>{const input=[{...newEvent(1),id:'a',order:1},{...newEvent(1),id:'b',order:2}];const result=upsertEvent(input,{...input[0],background:true});assert.equal(chronology(result)[0].order,1);});
test('selected resource totals exclude unselected routes and do not double count actions',()=>{const w=demo();const r=resourceStatus(w);assert.deepEqual(r.used,{hours:2,money:0,energy:2});assert.deepEqual(r.over,[]);});
test('stress halves time and energy, never money; zero budgets are valid',()=>{const w=demo();w.budget={hours:2,money:6000,energy:2};const r=resourceStatus(w,true);assert.deepEqual(r.limit,{hours:1,money:6000,energy:1});assert.deepEqual(r.over,['hours','energy']);w.budget={hours:0,money:0,energy:0};assert.doesNotThrow(()=>validateWorkspace(w));assert.deepEqual(resourceStatus(w).over,['hours','energy']);});
test('deleting an event unlinks themes without removing other cards',()=>{const w=demo();const next=deleteEntity(w,'events','demo-e4');assert.equal(next.themes[0].eventIds.includes('demo-e4'),false);assert.equal(w.events.length,13);assert.equal(next.events.length,12);assert.doesNotThrow(()=>validateWorkspace(next));});
test('deleting directions preserves routes and actions but unlinks references',()=>{const n=deleteEntity(demo(),'directions','demo-direction1');assert.equal(n.routes[0].directionId,'');assert.deepEqual(n.actions[0].directionIds,[]);assert.doesNotThrow(()=>validateWorkspace(n));});
test('deleting a route preserves experiments and unlinks parent',()=>{const n=deleteEntity(demo(),'routes','demo-route1');assert.equal(n.actions[0].routeId,'');assert.doesNotThrow(()=>validateWorkspace(n));});
test('deleting themes unlinks directions',()=>{const n=deleteEntity(demo(),'themes','demo-theme1');assert.deepEqual(n.directions[0].themeIds,[]);assert.doesNotThrow(()=>validateWorkspace(n));});
test('bad JSON, versions, and oversized imports fail before mutation',()=>{assert.throws(()=>parseBackup('{oops'));assert.throws(()=>parseBackup(JSON.stringify({...demo(),version:99})));assert.throws(()=>parseBackup(' '.repeat(2_000_001)));});
test('score/year/month/frequency bounds reject invalid data',()=>{
  for(const modify of [w=>w.year=2026.5,w=>w.year=1,w=>w.events[0].month=13,w=>w.events[0].energy=11,w=>w.events[0].energy=NaN,w=>w.events[0].energyNow=-11,w=>w.actions[0].period='sometimes',w=>w.budget.hours=169]){
    const w=demo();modify(w);assert.throws(()=>validateWorkspace(w));
  }
});
test('blank names, duplicate IDs and dangling references are rejected',()=>{
  for(const modify of [w=>w.events[0].title='   ',w=>w.events[1].id=w.events[0].id,w=>w.themes[0].eventIds.push('missing'),w=>w.routes[0].directionId='missing',w=>w.actions[0].directionIds=['missing']]){const w=demo();modify(w);assert.throws(()=>validateWorkspace(w));}
});
test('more than three monthly cards fail while daily backgrounds are allowed',()=>{const w=demo();for(let i=0;i<3;i++)w.events.push({...newEvent(1),title:'extra'});assert.throws(()=>validateWorkspace(w));w.events.at(-1).background=true;assert.doesNotThrow(()=>validateWorkspace(w));});
test('invalid calendar dates and reversed experiment dates are rejected',()=>{for(const modify of [w=>w.actions[0].start='2025-02-30',w=>w.actions[0].reviewDate='2020-01-01']){const w=demo();modify(w);assert.throws(()=>validateWorkspace(w));}});
test('date arithmetic handles leap days and year boundaries',()=>{assert.equal(afterDays(1,'2024-02-28'),'2024-02-29');assert.equal(afterDays(1,'2025-12-31'),'2026-01-01');});
test('import is allow-listed and cannot prototype-pollute',()=>{const raw=JSON.parse(JSON.stringify(demo()));raw.__proto__={polluted:true};raw.events[0].html='<script>bad</script>';const result=validateWorkspace(raw);assert.equal(Object.hasOwn(result,'__proto__'),false);assert.equal(Object.hasOwn(result.events[0],'html'),false);assert.equal({}.polluted,undefined);});
test('malicious strings are retained as data rather than interpreted by the model',()=>{const w=demo();w.events[0].title='<img src=x onerror=alert(1)>';assert.equal(parseBackup(JSON.stringify(w)).events[0].title,w.events[0].title);});
