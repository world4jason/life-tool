import { newTheme } from './domain.mjs?v=discovery-3';

/** Mutators receive a cloned state from the app's validated transaction boundary. */
export function discoveryCounts(state, theme) {
  const related = new Set(theme.eventIds), unrelated = new Set(theme.unrelatedEventIds);
  return {
    related: state.events.filter(e => related.has(e.id)),
    unrelated: state.events.filter(e => unrelated.has(e.id)),
    pending: state.events.filter(e => !related.has(e.id) && !unrelated.has(e.id)),
    total: state.events.length
  };
}
export function discoveryCreate(state, method, label = '', eventIds = []) {
  if (!['binary', 'group'].includes(method)) throw new Error('分類方法不正確');
  if (method === 'binary' && !label.trim()) throw new Error('請輸入詞語');
  const theme = { ...newTheme(state.themes.length), method, label: label.trim(), eventIds: [...new Set(eventIds)] };
  state.themes.push(theme);
  return theme;
}
export function discoveryClassify(state, themeId, eventId, answer) {
  const t = state.themes.find(t => t.id === themeId && t.method === 'binary');
  if (!t || !state.events.some(e => e.id === eventId)) throw new Error('詞語或事件已變更，請重新選擇');
  if (!['related', 'unrelated', 'pending'].includes(answer)) throw new Error('分類選項不正確');
  t.eventIds = t.eventIds.filter(id => id !== eventId);
  t.unrelatedEventIds = t.unrelatedEventIds.filter(id => id !== eventId);
  if (answer === 'related') t.eventIds.push(eventId);
  if (answer === 'unrelated') t.unrelatedEventIds.push(eventId);
  return state;
}
export function discoveryMove(state, eventIds, sourceId, targetId, copy = false) {
  const ids = [...new Set(eventIds)];
  if (!ids.length || ids.some(id => !state.events.some(e => e.id === id))) throw new Error('請選擇事件');
  const source = sourceId ? state.themes.find(t => t.id === sourceId && t.method !== 'binary') : null;
  if (sourceId && (!source || ids.some(id => !source.eventIds.includes(id)))) throw new Error('來源群組已變更');
  let target = null;
  if (targetId === 'new') target = discoveryCreate(state, 'group');
  else if (targetId !== 'pool') target = state.themes.find(t => t.id === targetId && t.method !== 'binary');
  if (targetId !== 'pool' && !target) throw new Error('找不到目標群組');
  if (source && source !== target && !copy) source.eventIds = source.eventIds.filter(id => !ids.includes(id));
  if (target) target.eventIds = [...new Set([...target.eventIds, ...ids])];
  return target?.id || '';
}
export function discoveryRename(state, themeId, label) {
  const t = state.themes.find(t => t.id === themeId);
  if (!t) throw new Error('找不到詞語');
  if (!label.trim()) throw new Error('請輸入詞語');
  // A renamed word is not a new objective. Do not touch intention, routes or nodes.
  t.label = label.trim();
  return state;
}
