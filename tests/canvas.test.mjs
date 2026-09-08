import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, newEvent, newTheme, newRoute, newNode, validateState } from '../src/domain.mjs';
import { validCanvasLayout, groupScene, binaryScene, journeyScene, worldPoint, zoomAt, fitCamera, bounds, contains, overlaps } from '../src/canvas-model.mjs';
const fixture = () => { const s = blankState(); s.events = [1,2,3].map((month,i) => ({ ...newEvent(month), id:`event-${i}`, title:`事件 ${i}`, energy: i ? -6 : null })); return s; };
test('canvas sanitizes malformed layout without modifying domain data', () => {
 const l=validCanvasLayout({version:1,positions:{'frame:pool':{x:1e9,y:NaN},'constructor':{x:1,y:2},'card:pool:a':{x:Infinity,y:1},'frame:ok':{x:1e9,y:-1e9}},camera:{x:3,y:8,z:9}});
 assert.deepEqual(l.positions,{'frame:ok':{x:20000,y:-20000}});assert.equal(l.camera.z,2);
});
test('unknown layout versions are harmless',()=>assert.deepEqual(validCanvasLayout({version:5}),{version:1,positions:{},camera:null}));
test('zoom keeps the point under the pointer stable',()=>{
 const c={x:-80,y:44,z:.8},p={x:450,y:200};assert.deepEqual(worldPoint(zoomAt(c,1.5,p),p),worldPoint(c,p));
});
test('zoom limits protect tiny and unbounded views',()=>{
 assert.equal(zoomAt({x:0,y:0,z:1},100,{x:0,y:0}).z,2);assert.equal(zoomAt({x:0,y:0,z:1},.001,{x:0,y:0}).z,.3);
});
test('fit and hit testing handle negative coordinates',()=>{
 const r={x:-300,y:-50,w:1000,h:400};const c=fitCamera(r,1200,600);assert.equal(c.z,1);assert.equal(c.x,400);assert(contains(r,{x:-200,y:0}));assert(overlaps(r,{x:-305,y:-55,w:50,h:50}));
});
test('blank group canvas starts with an event pool and a creation target',()=>{
 const s=fixture(),before=JSON.stringify(s),scene=groupScene(s);assert.equal(scene.cards.length,3);assert.equal(scene.frames.length,2);assert.equal(JSON.stringify(s),before);assert.equal(scene.cards[0].event.energy,null);
});
test('same event can have two references without duplicating the event',()=>{
 const s=fixture();s.themes=[{...newTheme(),id:'a',method:'group',label:'A',eventIds:['event-0']},{...newTheme(),id:'b',method:'group',label:'B',eventIds:['event-0']}];
 const scene=groupScene(s);assert.equal(s.events.length,3);assert.equal(scene.cards.filter(c=>c.event.id==='event-0').length,2);assert.equal(new Set(scene.cards.map(c=>c.key)).size,4);
});
test('moving a frame translates its cards but not their memberships',()=>{
 const s=fixture(),a=groupScene(s),l=validCanvasLayout({version:1,positions:{'frame:pool':{x:1000,y:-300}}}),b=groupScene(s,l);
 assert.equal(b.cards[0].x-a.cards[0].x,976);assert.equal(b.cards[0].y-a.cards[0].y,-324);assert.equal(s.themes.length,0);
});
test('binary canvas retains pending, unrelated and negative related separately',()=>{
 const s=fixture(),t={...newTheme(),method:'binary',eventIds:['event-1'],unrelatedEventIds:['event-2']};const a=binaryScene(s,t);
 assert.equal(a.cards.find(n=>n.event.id==='event-0').frameId,'pending');assert.equal(a.cards.find(n=>n.event.id==='event-1').frameId,'related');assert.equal(a.cards.find(n=>n.event.id==='event-2').frameId,'unrelated');assert(a.frames.every(f=>f.locked));
});
test('route map projects actual parent relations and never invents a cycle',()=>{
 const s=fixture(),t={...newTheme(),id:'theme-a',method:'group',label:'自由'};s.themes=[t];const r={...newRoute(t.id),id:'route-a',title:'少排事情'};s.routes=[r];
 const p={...newNode('objective'),id:'parent-a',routeId:r.id,themeIds:[t.id]},n={...newNode('action',p.id),id:'action-a',routeId:r.id,themeIds:[t.id]};s.nodes=[p,n];
 const before=JSON.stringify(s),m=journeyScene(s,t.id);assert.equal(m.cards.length,4);assert(m.edges.some(e=>e.from==='node:parent-a'&&e.to==='node:action-a'));assert.equal(JSON.stringify(s),before);
});
test('canvas labels do not become future goals',()=>{
 const s=fixture();s.themes=[{...newTheme(),method:'group',label:'焦慮',eventIds:['event-1']}];groupScene(s);assert.equal(s.themes[0].intention,'');assert.equal(validateState(s).version,2);
});
test('layout is disposable and does not change quantitative review records',()=>{
 const s=fixture();const before=JSON.stringify(s);groupScene(s,validCanvasLayout({version:1,positions:{'card:pool:event-0':{x:800,y:-40}}}));assert.equal(JSON.stringify(s),before);
});
test('large valid event set yields unique bounded-size cards',()=>{
 const s=blankState();for(let m=1;m<=12;m++)for(let o=1;o<=3;o++)s.events.push({...newEvent(m),id:`e-${m}-${o}`,order:o});
 const sc=groupScene(s);assert.equal(sc.cards.length,36);assert(sc.cards.every(c=>c.w>=220));assert.equal(new Set(sc.cards.map(n=>n.key)).size,36);assert(bounds(sc.frames).h>0);
});
