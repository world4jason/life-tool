/** Pure domain rules. No DOM, network, or storage access. */
export const VERSION = 1;
export const MAX_EVENTS_PER_MONTH = 3;
export const ORIGINS = { planned: '計畫內', surprise: '意外', mixed: '混合', unsure: '不確定' };
export const INFLUENCES = { direct: '我可以行動', shared: '需要協作', adapt: '調適與支持', unsure: '還不知道' };
export const PLAN_TYPES = { habit: '習慣', experience: '體驗', outcome: '成果', boundary: '界線', routine: '固定流程' };
export const PERIODS = { week: '每週', month: '每月', year: '每年', once: '本次實驗' };
export const ROUTE_KINDS = { add: '做更多', less: '做更少', different: '換一條路', keep: '維持現況', pause: '暫時不做' };
export const FEELINGS = ['開心', '平靜', '期待', '自在', '感動', '有歸屬感', '疲倦', '失落', '焦慮', '委屈', '憤怒', '矛盾'];
export const VALUES = ['自由', '連結', '探索', '創造', '安定', '精進', '表達', '照顧', '留白', '自主', '好奇', '公平'];
export const COLORS = ['teal', 'coral', 'purple', 'gold', 'blue', 'sage'];
export const uid = () => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export const clone = x => structuredClone(x);
export function dateString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function addDays(iso, count) {
  const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + count); return dateString(d);
}
export function blankState(year = new Date().getFullYear()) {
  return { version: VERSION, id: uid(), year, updatedAt: new Date().toISOString(), revision: 0,
    frame: 'then', events: [], themes: [], routes: [], nodes: [], reviews: [],
    reflection: { notice: '', surprise: '', keep: '', release: '' },
    budget: { hours: 6, money: 5000, energy: 10 },
    decision: '', optionsSkipReason: '' };
}
const fail = message => { throw new Error(message); };
const ownObject = (v, name) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail(`${name}格式不正確`);
  return v;
};
const text = (v, name, max = 2000) => {
  if (typeof v !== 'string' || v.length > max) fail(`${name}必須是 ${max} 字以內的文字`);
  return v;
};
const id = (v, name = '識別碼') => {
  text(v, name, 100); if (!/^[a-zA-Z0-9_-]+$/.test(v)) fail(`${name}格式不正確`); return v;
};
const num = (v, name, min, max, integer = false) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) fail(`${name}超出可接受的範圍`);
  return v;
};
const bool = (v, name) => { if (typeof v !== 'boolean') fail(`${name}必須是布林值`); return v; };
const pick = (v, choices, name) => { if (!choices.includes(v)) fail(`${name}選項不正確`); return v; };
const arr = (v, name, max) => { if (!Array.isArray(v) || v.length > max) fail(`${name}數量不正確`); return v; };
const uniqueIds = (items, name) => {
  if (new Set(items.map(x => x.id)).size !== items.length) fail(`${name}有重複識別碼`);
};
const ids = (v, name, max) => {
  const result = arr(v, name, max).map(x => id(x));
  if (new Set(result).size !== result.length) fail(`${name}有重複關聯`);
  return result;
};
export function validDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T12:00:00`);
  return !Number.isNaN(d.getTime()) && dateString(d) === v;
}
const date = (v, name, optional = true) => { if (optional && v === '') return v; if (!validDate(v)) fail(`${name}日期不正確`); return v; };
/** Strict, whitelisted schema. Import rejects unknown versions, dangling refs and cycles. */
export function validateState(raw) {
  ownObject(raw, '備份');
  if (raw.version !== VERSION) fail('不支援這個備份版本；原本的資料沒有被覆寫。');
  const s = { version: VERSION, id: id(raw.id), year: num(raw.year, '年份', 1900, 2200, true),
    updatedAt: text(raw.updatedAt, '更新時間', 50), revision: num(raw.revision, '修訂', 0, Number.MAX_SAFE_INTEGER, true),
    frame: pick(raw.frame, ['then', 'now'], '評分視角') };
  if (Number.isNaN(Date.parse(s.updatedAt))) fail('更新時間不正確');
  s.events = arr(raw.events, '事件', 86).map(v => {
    ownObject(v, '事件');
    return { id: id(v.id), kind: pick(v.kind, ['event', 'background'], '事件種類'),
      month: num(v.month, '月份', 1, 12, true), order: num(v.order, '月內順序', 1, 3, true),
      title: text(v.title, '事件名稱', 120), facts: text(v.facts, '事實'),
      energy: v.energy === null ? null : num(v.energy, '能量', -10, 10, true),
      feelings: arr(v.feelings, '情緒詞', 12).map(x => text(x, '情緒詞', 40)),
      origin: pick(v.origin, Object.keys(ORIGINS), '發生方式'), influence: pick(v.influence, Object.keys(INFLUENCES), '回應空間'),
      important: bool(v.important, '重要標記'), private: bool(v.private, '私密標記') };
  });
  uniqueIds(s.events, '事件');
  if (s.events.filter(e => e.kind === 'background').length > 50) fail('日常背景最多 50 張');
  for (let month = 1; month <= 12; month++) {
    const events = s.events.filter(e => e.kind === 'event' && e.month === month);
    if (events.length > MAX_EVENTS_PER_MONTH) fail(`${month} 月最多 3 張大事件卡；日常請放背景區。`);
    if (new Set(events.map(e => e.order)).size !== events.length) fail(`${month} 月的事件順序重複`);
  }
  s.themes = arr(raw.themes, '主題', 30).map(v => {
    ownObject(v, '主題');
    return { id: id(v.id), label: text(v.label, '主題名稱', 120), value: text(v.value, '價值方向', 160),
      intention: text(v.intention, '未來方向', 500), eventIds: ids(v.eventIds, '事件關聯', 86),
      counterExample: text(v.counterExample, '反例'), alternate: text(v.alternate, '另一種解讀'),
      stance: pick(v.stance, ['explore', 'keep', 'release'], '主題取向'), color: pick(v.color, COLORS, '顏色') };
  });
  uniqueIds(s.themes, '主題');
  const eventSet = new Set(s.events.map(x => x.id)), themeSet = new Set(s.themes.map(x => x.id));
  s.themes.forEach(t => t.eventIds.forEach(e => { if (!eventSet.has(e)) fail('主題連到不存在的事件'); }));
  s.routes = arr(raw.routes, '路線', 120).map(v => {
    ownObject(v, '路線');
    return { id: id(v.id), themeId: v.themeId === '' ? '' : id(v.themeId), title: text(v.title, '路線名稱', 160),
      kind: pick(v.kind, Object.keys(ROUTE_KINDS), '路線類型'), benefit: text(v.benefit, '期待改變'),
      cost: text(v.cost, '代價'), firstStep: text(v.firstStep, '第一步'), obstacle: text(v.obstacle, '障礙'),
      fallback: text(v.fallback, '備案'), reason: text(v.reason, '選擇理由'),
      hours: num(v.hours, '每週時間', 0, 168), money: num(v.money, '每月預算', 0, 100000000),
      energy: num(v.energy, '心力', 0, 100), confidence: num(v.confidence, '信心', 0, 10, true),
      selected: bool(v.selected, '選擇狀態') };
  });
  uniqueIds(s.routes, '路線');
  s.routes.forEach(r => { if (r.themeId && !themeSet.has(r.themeId)) fail('路線連到不存在的主題'); });
  const routeSet = new Set(s.routes.map(x => x.id));
  s.nodes = arr(raw.nodes, '計畫', 200).map(v => {
    ownObject(v, '計畫');
    return { id: id(v.id), parentId: v.parentId === '' ? '' : id(v.parentId),
      routeId: v.routeId === '' ? '' : id(v.routeId), themeIds: ids(v.themeIds, '價值關聯', 30),
      type: pick(v.type, ['objective', 'result', 'action'], '計畫層次'), title: text(v.title, '計畫名称', 160),
      planType: pick(v.planType, Object.keys(PLAN_TYPES), '行動種類'),
      aggregation: pick(v.aggregation, ['sum', 'latest'], '紀錄方式'),
      comparator: pick(v.comparator, ['atLeast', 'atMost', 'exactly'], '驗收方向'), target: num(v.target, '目標量', 0, 100000000),
      unit: text(v.unit, '單位', 40), period: pick(v.period, Object.keys(PERIODS), '頻率'),
      acceptance: text(v.acceptance, '完成定義'), trigger: text(v.trigger, '開始線索'), minimum: text(v.minimum, '縮小版本'),
      obstacle: text(v.obstacle, '障礙'), fallback: text(v.fallback, '備案'), support: text(v.support, '支持'),
      startDate: date(v.startDate, '開始'), reviewDate: date(v.reviewDate, '回顧'),
      status: pick(v.status, ['draft', 'active', 'paused', 'done', 'stopped'], '計畫狀態') };
  });
  uniqueIds(s.nodes, '計畫');
  const nodeMap = new Map(s.nodes.map(x => [x.id, x]));
  s.nodes.forEach(n => {
    if (n.routeId && !routeSet.has(n.routeId)) fail('計畫連到不存在的路線');
    n.themeIds.forEach(t => { if (!themeSet.has(t)) fail('計畫連到不存在的主題'); });
    if (n.startDate && n.reviewDate && n.reviewDate < n.startDate) fail('回顧日期不能早於開始日期');
    if (n.parentId) {
      const p = nodeMap.get(n.parentId);
      if (!p || p.type === 'action') fail('上層計畫不存在，或不能是行動');
      if (n.type === 'objective' && p.type !== 'objective') fail('方向只能放在另一個方向之下');
    }
    const visited = new Set([n.id]); let parent = n.parentId;
    while (parent) {
      if (visited.has(parent)) fail('計畫不能形成循環關聯');
      visited.add(parent);
      if (visited.size > 8) fail('計畫最多 8 層，請拆成幾個較小的方向');
      parent = nodeMap.get(parent)?.parentId;
    }
  });
  s.reviews = arr(raw.reviews, '回顧紀錄', 5000).map(v => {
    ownObject(v, '回顧紀錄');
    return { id: id(v.id), nodeId: id(v.nodeId), date: date(v.date, '紀錄', false),
      amount: num(v.amount, '發生量', 0, 100000000), mode: pick(v.mode, ['full', 'minimum', 'missed', 'reflection'], '執行狀態'),
      direction: pick(v.direction, ['supports', 'unsure', 'drains'], '方向感受'), note: text(v.note, '學到什麼'),
      decision: pick(v.decision, ['keep', 'adjust', 'reduce', 'pause', 'stop'], '下次決定') };
  });
  uniqueIds(s.reviews, '回顧紀錄');
  s.reviews.forEach(r => {
    const n = nodeMap.get(r.nodeId);
    if (!n || n.type === 'objective') fail('回顧只能連到存在的行動或成果');
    if ((r.mode === 'missed' || r.mode === 'reflection') && r.amount !== 0) fail('未執行／純反思不能記入完成量');
  });
  const ref = ownObject(raw.reflection, '回顧筆記');
  s.reflection = Object.fromEntries(['notice', 'surprise', 'keep', 'release'].map(k => [k, text(ref[k], '回顧筆記')]));
  const b = ownObject(raw.budget, '資源預算');
  s.budget = { hours: num(b.hours, '時間預算', 0, 168), money: num(b.money, '金錢預算', 0, 100000000), energy: num(b.energy, '心力預算', 0, 100) };
  s.decision = text(raw.decision, '暫時的決定'); s.optionsSkipReason = text(raw.optionsSkipReason, '略過說明');
  return s;
}
export function parseBackup(content) {
  if (typeof content !== 'string' || new TextEncoder().encode(content).length > 2 * 1024 * 1024) fail('備份超過 2 MB，沒有匯入。');
  let parsed; try { parsed = JSON.parse(content); } catch { fail('無法讀取 JSON；原本的資料沒有被覆寫。'); }
  return validateState(parsed);
}
export function newEvent(month = 1, existing = [], kind = 'event') {
  const used = existing.filter(e => e.kind === 'event' && e.month === month).map(e => e.order);
  return { id: uid(), kind, month, order: [1, 2, 3].find(x => !used.includes(x)) ?? 1,
    title: '', facts: '', energy: null, feelings: [], origin: 'unsure', influence: 'unsure', important: false, private: false };
}
export function newTheme(index = 0) {
  return { id: uid(), label: '', value: '', intention: '', eventIds: [], counterExample: '', alternate: '', stance: 'explore', color: COLORS[index % COLORS.length] };
}
export function newRoute(themeId = '') {
  return { id: uid(), themeId, title: '', kind: 'different', benefit: '', cost: '', firstStep: '', obstacle: '', fallback: '',
    reason: '', hours: 0, money: 0, energy: 0, confidence: 5, selected: false };
}
export function newNode(type = 'action', parentId = '') {
  const today = dateString();
  return { id: uid(), type, parentId, routeId: '', themeIds: [], title: '', planType: 'habit', aggregation: type === 'result' ? 'latest' : 'sum', comparator: 'atLeast',
    target: 1, unit: '次', period: 'week', acceptance: '', trigger: '', minimum: '', obstacle: '', fallback: '', support: '',
    startDate: today, reviewDate: addDays(today, 14), status: 'draft' };
}
export function sortedEvents(events) {
  return events.filter(e => e.kind === 'event').toSorted((a, b) => a.month - b.month || a.order - b.order);
}
export function budgetUsage(state, scale = 1) {
  const totals = state.routes.filter(r => r.selected).reduce((a, r) => ({ hours: a.hours + r.hours, money: a.money + r.money, energy: a.energy + r.energy }), { hours: 0, money: 0, energy: 0 });
  const available = { ...state.budget, hours: state.budget.hours * scale };
  return { totals, available, over: Object.keys(totals).filter(k => totals[k] > available[k]) };
}
export function descendants(nodes, nodeId) {
  const result = new Set([nodeId]); let found = true;
  while (found) { found = false; nodes.forEach(n => { if (result.has(n.parentId) && !result.has(n.id)) { result.add(n.id); found = true; } }); }
  return result;
}
export function removeEntity(state, kind, entityId) {
  const s = clone(state);
  if (kind === 'events') { s.events = s.events.filter(x => x.id !== entityId); s.themes.forEach(t => t.eventIds = t.eventIds.filter(x => x !== entityId)); }
  if (kind === 'themes') {
    s.themes = s.themes.filter(x => x.id !== entityId); s.routes.forEach(r => { if (r.themeId === entityId) r.themeId = ''; });
    s.nodes.forEach(n => n.themeIds = n.themeIds.filter(x => x !== entityId));
  }
  if (kind === 'routes') { s.routes = s.routes.filter(x => x.id !== entityId); s.nodes.forEach(n => { if (n.routeId === entityId) n.routeId = ''; }); }
  if (kind === 'nodes') {
    const removed = descendants(s.nodes, entityId); s.nodes = s.nodes.filter(x => !removed.has(x.id)); s.reviews = s.reviews.filter(x => !removed.has(x.nodeId));
  }
  if (kind === 'reviews') s.reviews = s.reviews.filter(x => x.id !== entityId);
  return validateState(s);
}
export function periodBounds(period, iso = dateString(), start = '') {
  const d = new Date(`${iso}T12:00:00`); let first = iso, last = iso;
  if (period === 'week') { first = addDays(iso, -((d.getDay() + 6) % 7)); last = addDays(first, 6); }
  if (period === 'month') { first = `${iso.slice(0, 7)}-01`; last = dateString(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12)); }
  if (period === 'year') { first = `${d.getFullYear()}-01-01`; last = `${d.getFullYear()}-12-31`; }
  if (period === 'once') { first = start || '1900-01-01'; last = '2200-12-31'; }
  return { first, last };
}
export function progressFor(node, reviews, today = dateString()) {
  const bounds = periodBounds(node.period, today, node.startDate);
  const first = node.startDate && node.startDate > bounds.first ? node.startDate : bounds.first;
  const records = reviews.filter(r => r.nodeId === node.id && r.date >= first && r.date <= bounds.last && r.date <= today);
  const actual = records.filter(r => r.mode === 'full').toSorted((a, b) => a.date.localeCompare(b.date));
  const full = node.aggregation === 'latest' ? (actual.at(-1)?.amount ?? 0) : actual.reduce((sum, r) => sum + r.amount, 0);
  const minimum = records.filter(r => r.mode === 'minimum').reduce((sum, r) => sum + r.amount, 0);
  const numeric = records.filter(r => r.mode === 'full' || r.mode === 'missed');
  const hasData = numeric.length > 0;
  const met = !hasData ? null : node.comparator === 'atMost' ? full <= node.target : node.comparator === 'exactly' ? full === node.target : full >= node.target;
  return { ...bounds, full, minimum, records, hasData, met, directionSupport: records.filter(r => r.direction === 'supports').length };
}
export function actionReadiness(node) {
  return [!node.acceptance.trim() && '完成定義', !node.trigger.trim() && '開始線索', !node.reviewDate && '回顧日期',
    !node.fallback.trim() && '障礙備案'].filter(Boolean);
}
export function demoState() {
  const s = blankState(2025);
  const sample = [
    [1, '重新開始散步', 4, 'planned', '下班後繞一段路回家。'], [2, '朋友的臨時邀約', 7, 'surprise', '久違地聊了一個晚上。'],
    [3, '專案同時湧進來', -7, 'surprise', '三個交付撞在同一週。'], [4, '第一次上陶藝課', 6, 'planned', '不熟練，但很專注。'],
    [5, '答應太多事情', -4, 'mixed', '週末沒有留下自己的時間。'], [6, '一趟沒有排滿的旅行', 9, 'planned', '留了兩天只在城市裡走走。'],
    [7, '固定的練舞時段', 7, 'planned', '開始每週和朋友一起練習。'], [8, '計畫忽然改變', -5, 'surprise', '期待的合作沒有繼續。'],
    [9, '重新談工作界線', 3, 'planned', '和同事重新分配工作。'], [10, '意外認識新朋友', 8, 'surprise', '在活動裡遇到聊得來的人。'],
    [11, '把週末還給自己', 6, 'planned', '取消了不必要的承諾。'], [12, '好好吃一頓晚餐', 8, 'planned', '和重要的人一起過了平常的一晚。']
  ];
  s.events = sample.map(([month, title, energy, origin, facts], index) => ({ ...newEvent(month), id: `demo-event-${index}`, title, energy, origin, facts,
    influence: energy < 0 ? 'shared' : 'direct', feelings: [energy < 0 ? '疲倦' : '自在'], important: [6, 9].includes(month) }));
  s.events.push({ ...newEvent(1, [], 'background'), id: 'demo-background', title: '每天通勤一小時', facts: '小事重複發生，也占了一年。', energy: -3, origin: 'planned', influence: 'shared' });
  const t1 = { ...newTheme(0), id: 'demo-space', label: '留白，讓自己有選擇', value: '自主', intention: '每週留下一點真正由我決定的時間', eventIds: ['demo-event-4', 'demo-event-5', 'demo-event-10'],
    counterExample: '陶藝課有固定安排，卻也讓我很自在。', alternate: '也許需要的不是不安排，而是自己選擇。', stance: 'keep' };
  const t2 = { ...newTheme(1), id: 'demo-connect', label: '一起做平常的小事', value: '連結', intention: '不靠大型聚會，也能維持有品質的陪伴', eventIds: ['demo-event-1', 'demo-event-6', 'demo-event-9', 'demo-event-11'], stance: 'explore' };
  s.themes = [t1, t2];
  s.routes = [
    { ...newRoute(t1.id), id: 'demo-route-1', title: '每週保留一個空白晚上', kind: 'less', benefit: '能自己決定怎麼使用時間', cost: '少參加一次不是那麼想去的聚會', firstStep: '在行事曆保留週三晚上', hours: 2, energy: 2, selected: true, reason: '先做小一點，觀察是否更自在', obstacle: '臨時的邀約', fallback: '保留其中 30 分鐘，不補課也不追進度' },
    { ...newRoute(t1.id), id: 'demo-route-2', title: '每個月一趟短旅行', kind: 'different', benefit: '用離開熟悉環境得到空間', cost: '需要交通預算與準備', hours: 4, money: 6000, energy: 5, firstStep: '先選一個可當天往返的地方' },
    { ...newRoute(t1.id), id: 'demo-route-3', title: '暫時維持，只觀察兩週', kind: 'keep', benefit: '先確認真正耗損的來源', cost: '暫時不調整安排', hours: 0.5, energy: 1, firstStep: '每晚記一句讓我有／沒選擇的時刻' }
  ];
  const o = { ...newNode('objective'), id: 'demo-objective', title: '把一點選擇權還給自己', themeIds: [t1.id], routeId: s.routes[0].id };
  const a = { ...newNode('action', o.id), id: 'demo-action', title: '一個由自己決定的晚上', themeIds: [t1.id], routeId: s.routes[0].id,
    acceptance: '留出一個晚上，不把它拿來補工作；做什麼由當天的自己決定。', trigger: '週日看行事曆時，先保留週三晚上。',
    minimum: '30 分鐘不被工作占用的時間', obstacle: '工作延後或臨時邀約', fallback: '保留 30 分鐘；下次回顧時調整時段，不補做。', support: '先讓朋友知道這個小實驗', status: 'active' };
  s.nodes = [o, a];
  s.reflection.notice = '高點常常不是完成很多事，而是有選擇、有陪伴。';
  s.reflection.surprise = '有些有安排的活動也很補充能量。';
  return validateState(s);
}
