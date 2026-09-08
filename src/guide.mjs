import { clone, demoState, newEvent, newNode, validateState } from './domain.mjs?v=discovery-3';

// A disposable example, never a migration or a replacement for personal data.
export const GUIDE_STEPS = [
  { text: '打開六月的旅行卡，看看事件怎麼記。文字和發生方式都可以修改。', action: '打開事件卡', form: 'event', target: 'demo-event-5', field: 'title' },
  { text: '拖曳六月卡片調整順序；點「評分」移動能量滑桿，按儲存。', action: '試著評分', form: 'event', target: 'demo-event-5', field: 'energy' },
  { text: '用「自由」將事件分成有關與無關；切換「分群」可把卡片成群命名。', action: '操作分類', form: 'discovery', target: 'demo-space', field: 'word' },
  { text: '保留空白晚上、短旅行、先觀察，都可能增加自主感。比較下方三條路，再選一條。', action: '試選空白晚上', form: 'choice', target: 'demo-route-1', field: 'reason' },
  { text: '把路線變成行動。這份範例已填好次數、驗收、備案和回顧日，試著修改一項。', action: '編輯實驗', form: 'node', target: 'guide-action', field: 'target' },
  { text: '假設已經試過一次，記下執行量、感受，以及下次要維持或調整什麼。', action: '試記一筆回顧', form: 'review', target: 'guide-action', field: 'amount' }
];

export function createGuideState() {
  const s = demoState();
  s.events = s.events.filter(e => ['demo-event-2', 'demo-event-3', 'demo-event-4', 'demo-event-5', 'demo-event-10'].includes(e.id));
  Object.assign(s.events.find(e => e.id === 'demo-event-5'), { energy: null, order: 2 });
  s.events.push({ ...newEvent(6), id: 'guide-june-work', title: '旅行前趕完工作', facts: '把交付集中在出發前一週。', energy: -4, origin: 'mixed', order: 1 });
  s.themes = s.themes.filter(t => t.id === 'demo-space');
  Object.assign(s.themes[0], { method: 'binary', label: '自由', eventIds: [], unrelatedEventIds: [] });
  s.routes.forEach(r => { r.selected = false; r.reason = ''; });
  s.nodes = []; s.reviews = [];
  s.reflection = { notice: '', surprise: '', keep: '', release: '' };
  return validateState(s);
}

// Later chapters have a complete example even when the reader skips a task.
// Preparing a chapter is not counted as a saved task. Edits are never replaced.
export function prepareGuideStep(input, step, preferredRoute = '') {
  if (step < 5 || input.nodes.some(n => n.type === 'action')) return input;
  const s = clone(input);
  const route = s.routes.find(r => r.id === preferredRoute && r.selected)
    || s.routes.find(r => r.selected) || s.routes[0];
  if (!route) return s;
  const themeIds = route.themeId ? [route.themeId] : [];
  const parent = { ...newNode('objective'), id: 'guide-objective', title: '留一點自己能決定的時間', themeIds, routeId: route.id };
  const n = { ...newNode('action', parent.id), id: 'guide-action', themeIds, routeId: route.id,
    title: route.title, acceptance: route.benefit, trigger: route.firstStep,
    minimum: '先花五分鐘準備', obstacle: route.obstacle, fallback: route.fallback || '時間不足就縮小，回顧時再調整。',
    support: '預先和一起生活的人說明', status: 'active' };
  if (route.id === 'demo-route-1') Object.assign(n, {
    title: '每週留一個空白晚上', target: 1, unit: '次', period: 'week',
    acceptance: '保留兩小時，不補工作；活動由當天的自己決定。',
    trigger: '週日看行事曆時，保留週三晚上。', minimum: '保留三十分鐘',
    obstacle: '臨時加班或邀約', fallback: '改留三十分鐘，下次調整時段，不補做。'
  });
  if (route.id === 'demo-route-2') Object.assign(n, {
    title: '每月安排一次短旅行', planType: 'experience', target: 1, unit: '次', period: 'month',
    acceptance: '完成一次當天來回的旅行，記下花費和感受。',
    trigger: '月初選一天，確認交通和預算。', minimum: '到附近沒去過的地方走一小時',
    obstacle: '天氣或預算不允許', fallback: '改成附近散步，另外記為縮小版。'
  });
  if (route.id === 'demo-route-3') Object.assign(n, {
    title: '每晚記一句觀察，先試兩週', target: 7, unit: '次', period: 'week',
    acceptance: '記一句今天能自己決定、或無法自己決定的事。',
    trigger: '睡前放下手機時記錄。', minimum: '只記一個關鍵詞',
    obstacle: '忘記或太累', fallback: '跳過當天，隔天再記，不補寫。'
  });
  if (s.nodes.some(x => x.id === parent.id)) n.parentId = parent.id;
  else s.nodes.push(parent);
  s.nodes.push(n);
  return validateState(s);
}
