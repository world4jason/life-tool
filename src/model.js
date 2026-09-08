/** Pure domain functions. Scores describe an experience, never a person's worth. */
export const VERSION = 1;
export const STORAGE_KEY = 'life-atlas:v1';
export const uid = () => globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
export function afterDays(days, start = today()) {
  const d = new Date(`${start}T12:00:00`); d.setDate(d.getDate()+days);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function createWorkspace(year = new Date().getFullYear()) {
  return { version: VERSION, year, basis: 'then', events: [], themes: [], directions: [], routes: [], actions: [], reviews: [],
    budget: { hours: 6, money: 5000, energy: 10 }, reflection: '', intention: '', updatedAt: '' };
}
export function newEvent(month=1) {
  return {id:uid(),month,order:1,title:'',fact:'',source:'memory',background:false,private:false,energy:null,energyNow:null,
    emotions:[],meaning:'',planned:'unknown',control:'unknown'};
}
export function newTheme() { return {id:uid(),name:'',eventIds:[],counterIds:[],alternative:'',note:''}; }
export function newDirection() { return {id:uid(),name:'',themeIds:[],why:''}; }
export function newRoute(directionId='') { return {id:uid(),directionId,title:'',kind:'other',benefit:'',tradeoff:'',firstStep:'',barrier:'',backup:'',hours:1,money:0,energy:2,confidence:5,selected:false,reason:''}; }
export function newAction(routeId='',directionIds=[]) {
  return {id:uid(),routeId,directionIds,title:'',type:'habit',objective:'',result:'',target:2,unit:'次',period:'week',
    trigger:'',definition:'',obstacle:'',backup:'',support:'',start:today(),reviewDate:afterDays(14),
    confidence:5,status:'trying',notes:''};
}
export function chronology(events) { return events.filter(e=>!e.background).slice().sort((a,b)=>a.month-b.month||a.order-b.order||a.id.localeCompare(b.id)); }
/** Stable touch/keyboard ordering without requiring drag-and-drop. */
export function upsertEvent(events, row) {
  const out=events.filter(e=>e.id!==row.id).map(e=>({...e}));
  if (row.background) out.push({...row});
  else {
    const peers=chronology(out).filter(e=>e.month===row.month);
    peers.splice(Math.min(row.order-1,peers.length),0,{...row});
    peers.forEach((e,i)=>e.order=i+1);
    for (const peer of peers) {
      const i=out.findIndex(e=>e.id===peer.id);
      if(i>=0)out[i]=peer;else out.push(peer);
    }
  }
  for(let m=1;m<=12;m++)chronology(out).filter(e=>e.month===m).forEach((e,i)=>e.order=i+1);
  return out;
}
export function ratedEvents(workspace) {
  return workspace.events.map(e=>({...e,energy:workspace.basis==='now'?(e.energyNow??null):e.energy}));
}
export function chartPoints(events) {
  const list=chronology(events).filter(e=>e.energy!==null);
  const groups=new Map(); list.forEach(e=>groups.set(e.month,[...(groups.get(e.month)||[]),e]));
  return list.map(e=>{const g=groups.get(e.month), i=g.indexOf(e);return {event:e,x:64+(e.month-1)*80+(i-(g.length-1)/2)*18,y:190-e.energy*13};});
}
export function resourceUse(routes) {
  return routes.filter(r=>r.selected).reduce((a,r)=>({hours:a.hours+r.hours,money:a.money+r.money,energy:a.energy+r.energy}),{hours:0,money:0,energy:0});
}
export function resourceStatus(w,stress=false) {
  const used=resourceUse(w.routes),limit={...w.budget}; if(stress){limit.hours/=2;limit.energy/=2;}
  return {used,limit,over:Object.keys(limit).filter(k=>used[k]>limit[k])};
}
export function deleteEntity(w,type,id) {
  const n=structuredClone(w); n[type]=n[type].filter(x=>x.id!==id);
  if(type==='events') n.themes.forEach(t=>{t.eventIds=t.eventIds.filter(x=>x!==id);t.counterIds=t.counterIds.filter(x=>x!==id);});
  if(type==='themes') n.directions.forEach(d=>d.themeIds=d.themeIds.filter(x=>x!==id));
  if(type==='directions') {n.routes.forEach(r=>{if(r.directionId===id)r.directionId='';});n.actions.forEach(a=>a.directionIds=a.directionIds.filter(x=>x!==id));}
  if(type==='routes') n.actions.forEach(a=>{if(a.routeId===id)a.routeId='';});
  if(type==='actions') n.reviews=n.reviews.filter(r=>r.actionId!==id);
  return n;
}
const fail = msg => {throw new Error(msg);};
const obj = x => x && typeof x==='object' && !Array.isArray(x);
const text=(x,label,max=3000)=>{if(typeof x!=='string'||x.length>max)fail(`${label}必須是 ${max} 字以内的文字。`);return x;};
const num=(x,label,min,max,int=false)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max||(int&&!Number.isInteger(x)))fail(`${label}超出允許範圍。`);return x;};
const nonblank=(x,label,max=120)=>{text(x,label,max);if(!x.trim())fail(`${label}不能只含空白。`);return x;};
const bool=(x,label)=>{if(typeof x!=='boolean')fail(`${label}格式不正確。`);return x;};
const one=(x,values,label)=>{if(!values.includes(x))fail(`${label}不是支援的選項。`);return x;};
const arr=(x,label,max)=>{if(!Array.isArray(x)||x.length>max)fail(`${label}格式或數量不正確。`);return x;};
const id=(x)=>{text(x,'卡片 ID',100);if(!/^[\w-]+$/.test(x))fail('卡片 ID 格式不正確。');return x;};
const date=(x,label)=>{text(x,label,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(x)||Number.isNaN(Date.parse(`${x}T12:00:00`))||new Date(`${x}T12:00:00Z`).toISOString().slice(0,10)!==x)fail(`${label}不是有效日期。`);return x;};
const refs=(x,label)=>arr(x,label,200).map(id);
/** Strict, allow-listed import: never merge arbitrary input keys into application state. */
export function validateWorkspace(raw) {
  if(!obj(raw)||raw.version!==VERSION)fail('不支援的備份格式或版本。請選擇拾光匯出的 JSON。');
  const w=createWorkspace(num(raw.year,'年份',1900,2100,true));
  w.basis=one(raw.basis,['then','now'],'評分視角');w.reflection=text(raw.reflection,'年度觀察');w.intention=text(raw.intention,'帶走的選擇');
  if(!obj(raw.budget))fail('缺少資源設定。');
  w.budget={hours:num(raw.budget.hours,'每週時數',0,168),money:num(raw.budget.money,'每月金額',0,1e9),energy:num(raw.budget.energy,'心力',0,100)};
  w.updatedAt=text(raw.updatedAt??'','更新時間',50);
  w.events=arr(raw.events,'事件',100).map(e=>{
    if(!obj(e))fail('事件格式不正確。');
    return {id:id(e.id),month:num(e.month,'月份',1,12,true),order:num(e.order,'月內順序',1,3,true),title:nonblank(e.title,'事件名稱'),fact:text(e.fact,'事件事實'),
      source:one(e.source,['memory','calendar','photo','message','other'],'回憶線索'),background:bool(e.background,'日常背景'),private:bool(e.private,'遮住卡片'),
      energy:e.energy===null?null:num(e.energy,'能量',-10,10,true),energyNow:e.energyNow==null?null:num(e.energyNow,'現在回看能量',-10,10,true),emotions:arr(e.emotions,'情緒',20).map(x=>text(x,'情緒詞',60)),meaning:text(e.meaning,'事件意義'),
      planned:one(e.planned,['planned','unexpected','mixed','unknown'],'預期程度'),control:one(e.control,['direct','together','adapt','unknown'],'回應方式')};
  });
  for(let m=1;m<=12;m++)if(w.events.filter(e=>!e.background&&e.month===m).length>3)fail(`${m} 月超過三張事件卡。`);
  w.themes=arr(raw.themes,'主題',50).map(t=>({id:id(t.id),name:nonblank(t.name,'主題'),eventIds:refs(t.eventIds,'關聯事件'),counterIds:refs(t.counterIds,'例外事件'),alternative:text(t.alternative,'另一種解讀'),note:text(t.note,'主題筆記')}));
  w.directions=arr(raw.directions,'方向',50).map(d=>({id:id(d.id),name:nonblank(d.name,'方向'),themeIds:refs(d.themeIds,'關聯主題'),why:text(d.why,'方向理由')}));
  w.routes=arr(raw.routes,'路線',100).map(r=>({id:id(r.id),directionId:r.directionId===''?'':id(r.directionId),title:nonblank(r.title,'路線'),kind:one(r.kind,['more','less','different','observe','other'],'路線類型'),
    benefit:text(r.benefit,'支持方向'),tradeoff:text(r.tradeoff,'代價'),firstStep:text(r.firstStep,'最小一步'),barrier:text(r.barrier,'阻礙'),backup:text(r.backup,'備案'),hours:num(r.hours,'時數',0,168),money:num(r.money,'金額',0,1e9),energy:num(r.energy,'心力',0,100),confidence:num(r.confidence,'信心',0,10,true),selected:bool(r.selected,'路線選擇'),reason:text(r.reason,'選擇理由')}));
  w.actions=arr(raw.actions,'實驗',100).map(a=>({id:id(a.id),routeId:a.routeId===''?'':id(a.routeId),directionIds:refs(a.directionIds,'支持方向'),title:nonblank(a.title,'實驗'),type:one(a.type,['outcome','habit','project','boundary','process'],'行動類型'),objective:text(a.objective,'目標'),result:text(a.result,'成果'),target:num(a.target,'目標數',0,1e9),unit:text(a.unit,'單位',50),period:one(a.period,['day','week','month','year','trial'],'頻率'),trigger:text(a.trigger,'開始線索'),definition:text(a.definition,'執行驗收'),obstacle:text(a.obstacle,'阻礙'),backup:text(a.backup,'縮小版本'),support:text(a.support,'方向驗收'),start:date(a.start,'開始日期'),reviewDate:date(a.reviewDate,'回顧日期'),confidence:num(a.confidence,'信心',0,10,true),status:one(a.status,['trying','adjust','pause','stop','continue'],'實驗狀態'),notes:text(a.notes,'實驗筆記')}));
  w.reviews=arr(raw.reviews,'回顧',1000).map(r=>({id:id(r.id),actionId:id(r.actionId),date:date(r.date,'回顧日期'),actual:r.actual===null?null:num(r.actual,'實際數量',0,1e9),execution:text(r.execution,'執行觀察'),alignment:one(r.alignment,['yes','mixed','no','unknown'],'方向觀察'),learning:text(r.learning,'學到什麼'),decision:one(r.decision,['continue','adjust','pause','stop'],'回顧決定'),nextDate:r.nextDate===''?'':date(r.nextDate,'下次回顧')}));
  const ids=new Set();for(const key of ['events','themes','directions','routes','actions','reviews'])for(const row of w[key]){if(ids.has(row.id))fail('備份含重複的卡片 ID。');ids.add(row.id);}
  const exists=(key,v)=>!v||w[key].some(x=>x.id===v);
  for(const t of w.themes)if([...t.eventIds,...t.counterIds].some(v=>!exists('events',v)))fail('主題引用了不存在的事件。');
  for(const d of w.directions)if(d.themeIds.some(v=>!exists('themes',v)))fail('方向引用了不存在的主題。');
  for(const r of w.routes)if(!exists('directions',r.directionId))fail('路線引用了不存在的方向。');
  for(const a of w.actions)if(!exists('routes',a.routeId)||a.directionIds.some(v=>!exists('directions',v))||a.reviewDate<a.start)fail('實驗關聯或日期順序不正確。');
  for(const r of w.reviews)if(!exists('actions',r.actionId))fail('回顧引用了不存在的實驗。');
  return w;
}
export function parseBackup(input) {
  if(typeof input!=='string'||input.length>2_000_000)fail('備份過大，請選擇 2 MB 以內的 JSON。');
  let raw;try{raw=JSON.parse(input);}catch{fail('無法讀取 JSON；原有資料沒有變動。');}
  return validateWorkspace(raw);
}
export function makeDemo(year=new Date().getFullYear()-1) {
  const w=createWorkspace(year);
  const entries=[ [1,'和朋友一起煮晚餐',6,'安心','每個人帶一道菜，一起吃到十點。','unexpected'],[2,'專案連續加班',-7,'疲憊','連續兩週十點後離開辦公室。','mixed'],[3,'第一次上舞蹈課',7,'好奇','報名入門班，完整跳完一首歌。','planned'],[4,'一個人的海邊散步',5,'平靜','把手機放在包包裡，走了一個小時。','unexpected'],[5,'搬家後的第一晚',-3,'不安','整理到凌晨，客廳還有十二個箱子。','planned'],[6,'完成一件困難的工作',4,'釋然','完成提案，也說清楚了下次不想重複的工作方式。','planned'],[7,'和家人有了爭執',-6,'委屈','聚餐時對時間安排有不同期待。','unexpected'],[8,'臨時成行的小旅行',8,'自在','週五決定，週六出發；住了一晚。','unexpected'],[9,'回到固定練舞',6,'投入','每週有一個晚上到教室練習。','planned'],[10,'身體提醒我要休息',-5,'擔心','取消週末行程，在家休息。','unexpected'],[11,'說出自己的工作界線',5,'勇敢','和主管確認下班後的聯絡方式。','planned'],[12,'一起做平常的小事',8,'溫暖','和朋友去市場、散步，沒有排滿行程。','mixed'] ];
  w.events=entries.map(([month,title,energy,emotion,fact,planned])=>({...newEvent(month),id:`demo-e${month}`,title,energy,emotions:[emotion],fact,planned,control:month===7?'together':'direct'}));
  w.events.push({...newEvent(1),id:'demo-background',title:'總把日程排得很滿',fact:'多數平日下班後仍安排事情。',background:true,energy:-4,emotions:['疲憊']});
  w.themes=[{id:'demo-theme1',name:'留白才有餘裕',eventIds:['demo-e4','demo-e8','demo-e12'],counterIds:['demo-e3'],alternative:'讓我恢復的也可能是新鮮感，而不只是空閒。',note:'意外發生的好事，需要一點空間。'},{id:'demo-theme2',name:'找回自己的節奏',eventIds:['demo-e3','demo-e9','demo-e11'],counterIds:[],alternative:'也許重點是有人陪伴，而非固定頻率。',note:''}];
  w.directions=[{id:'demo-direction1',name:'為自己保留選擇權',themeIds:['demo-theme1'],why:'不把每一晚都變成另一張待辦清單。'},{id:'demo-direction2',name:'讓身體有表達的空間',themeIds:['demo-theme2'],why:'跳舞可以是享受，不必一直進步。'}];
  w.routes=[{...newRoute('demo-direction1'),id:'demo-route1',title:'每週保留一個空白晚上',kind:'less',benefit:'能自己決定怎麼使用時間。',tradeoff:'少參加一次不是那麼想去的聚會。',firstStep:'在行事曆保留週三晚上。',hours:2,money:0,energy:2,selected:true,reason:'比旅行更容易先試，也不增加預算。',barrier:'臨時邀約',backup:'保留其中三十分鐘，不補課。'}, {...newRoute('demo-direction1'),id:'demo-route2',title:'每個月一趟近郊旅行',kind:'more',benefit:'用離開熟悉環境得到空間。',tradeoff:'需要交通費與安排時間。',firstStep:'先選一個不用過夜的地方。',hours:4,money:6000,energy:5}, {...newRoute('demo-direction1'),id:'demo-route3',title:'暫時維持，只觀察兩週',kind:'observe',benefit:'先確認真正耗損的是什麼。',tradeoff:'改變會晚一點發生。',firstStep:'每晚記一句最有／沒選擇的時刻。',hours:0.5,money:0,energy:1}];
  w.actions=[{...newAction('demo-route1',['demo-direction1']),id:'demo-action1',title:'留一個不用交代的晚上',type:'habit',objective:'增加自己支配時間的感受',target:1,period:'week',unit:'個晚上',trigger:'週日看行事曆時，先保留週三晚上。',definition:'不主動新增承諾，保留至少一小時由自己決定。',obstacle:'朋友臨時邀約。',backup:'先留三十分鐘，並允許改到另一天。',support:'結束時記一句：我感覺多了選擇，還是多了一項任務？',result:'這兩週至少有一次感受到選擇權回到自己手上。'}];
  return w;
}
