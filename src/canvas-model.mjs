/** Presentation coordinates are independent of event, group and goal data. */
export const CANVAS_VERSION = 1;
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function validCanvasLayout(raw) {
  const clean = { version: 1, positions: {}, camera: null };
  if (!raw || raw.version !== 1) return clean;
  for (const [key, point] of Object.entries(raw.positions || {}).slice(0, 600)) {
    if (key.length > 240 || !/^(frame|card|theme|route|node):[\w:.-]+$/.test(key)) continue;
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    clean.positions[key] = { x: clamp(point.x, -20000, 20000), y: clamp(point.y, -20000, 20000) };
  }
  const c = raw.camera;
  if (c && [c.x, c.y, c.z].every(Number.isFinite)) clean.camera = { x: clamp(c.x, -50000, 50000), y: clamp(c.y, -50000, 50000), z: clamp(c.z, .3, 2) };
  return clean;
}
export function worldPoint(camera, point) { return { x: (point.x - camera.x) / camera.z, y: (point.y - camera.y) / camera.z }; }
export function zoomAt(camera, factor, anchor) {
  const p = worldPoint(camera, anchor), z = clamp(camera.z * factor, .3, 2);
  return { x: anchor.x - p.x * z, y: anchor.y - p.y * z, z };
}
export function overlaps(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
export function contains(rect, p) { return p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h; }
export function bounds(items) {
  if (!items.length) return { x: 0, y: 0, w: 1000, h: 500 };
  const x = Math.min(...items.map(n => n.x)), y = Math.min(...items.map(n => n.y));
  return { x, y, w: Math.max(...items.map(n => n.x + n.w)) - x, h: Math.max(...items.map(n => n.y + n.h)) - y };
}
export function fitCamera(rect, width, height, maxZoom = 1) {
  const z = clamp(Math.min((width - 48) / Math.max(rect.w, 1), (height - 48) / Math.max(rect.h, 1), maxZoom), .3, 2);
  return { x: (width - rect.w * z) / 2 - rect.x * z, y: (height - rect.h * z) / 2 - rect.y * z, z };
}
const pointAt = (layout, key, x, y) => layout.positions[key] || { x, y };
export function groupScene(state, layout = validCanvasLayout(), training = false) {
  const groups = state.themes.filter(t => t.method !== 'binary');
  const assigned = new Set(groups.flatMap(t => t.eventIds));
  let pool = state.events.filter(e => !assigned.has(e.id));
  if (training && !groups.length) pool = pool.toSorted((a,b) => Number(['demo-event-5','demo-event-10'].includes(b.id)) - Number(['demo-event-5','demo-event-10'].includes(a.id)));
  const frames = [], cards = [];
  const sections = [{ id: 'pool', label: '未分群', events: pool }, ...groups.map(t => ({ id: t.id, label: t.label || '群組名稱', theme: t, events: t.eventIds.map(id => state.events.find(e => e.id === id)).filter(Boolean) }))];
  sections.forEach((s, i) => {
    const key = `frame:${s.id}`, p = pointAt(layout, key, 24 + i * 566, 24);
    const frame = { ...p, key, id: s.id, type: 'frame', label: s.label, theme: s.theme, w: 528, h: 128 + Math.max(2, Math.ceil(s.events.length / 2)) * 176, count: s.events.length };
    frames.push(frame);
    s.events.forEach((e, j) => {
      const key = `card:${s.id}:${e.id}`, q = pointAt(layout, key, 22 + j % 2 * 254, 76 + Math.floor(j / 2) * 176);
      cards.push({ key, type: 'event', event: e, source: s.id === 'pool' ? '' : s.id, frameId: s.id, x: frame.x + clamp(q.x, 16, frame.w - 242), y: frame.y + clamp(q.y, 68, frame.h - 204), w: 232, h: 154 });
    });
  });
  const last = frames.at(-1);
  const empty = { key: 'frame:new', id: 'new', type: 'new', label: '新增群組', x: last.x + last.w + 38, y: last.y, w: 260, h: 224 };
  frames.push(empty);
  return { kind: 'group', frames, cards, edges: [], bounds: bounds([...frames, ...cards]) };
}
export function binaryScene(state, theme, layout = validCanvasLayout()) {
  const frames = [], cards = [];
  const related = new Set(theme.eventIds), unrelated = new Set(theme.unrelatedEventIds);
  [['related', '有關'], ['pending', '未判斷'], ['unrelated', '無關']].forEach(([id, label], i) => {
    const events = state.events.filter(e => (related.has(e.id) ? 'related' : unrelated.has(e.id) ? 'unrelated' : 'pending') === id);
    const frame = { key: `frame:${id}`, id, type: 'frame', label, x: 24 + i * 376, y: 24, w: 350, h: 92 + Math.max(2, events.length) * 176, count: events.length, locked: true };
    frames.push(frame);
    events.forEach((e, j) => cards.push({ key: `card:${id}:${e.id}`, type: 'event', event: e, source: id, frameId: id, x: frame.x + 22, y: frame.y + 68 + j * 176, w: 306, h: 154 }));
  });
  return { kind: 'binary', frames, cards, edges: [], bounds: bounds(frames) };
}
export function journeyScene(state, themeId, layout = validCanvasLayout()) {
  const t = state.themes.find(t => t.id === themeId);
  if (!t) return { kind: 'journey', frames: [], cards: [], edges: [], bounds: bounds([]) };
  const cards = [], edges = [];
  function node(key, type, label, detail, x, y, action, id, extra = {}) {
    cards.push({ key, type, label, detail, ...pointAt(layout, key, x, y), w: 286, h: 174, action, id, ...extra });
  }
  node(`theme:${t.id}`, 'direction', t.intention || t.label, `來自「${t.label}」`, 24, 24, 'direction', t.id);
  const routes = state.routes.filter(r => r.themeId === t.id);
  routes.forEach((r, i) => {
    node(`route:${r.id}`, 'route', r.title, r.benefit, 400, 24 + i * 226, 'edit-route', r.id, { chosen: r.selected });
    edges.push({ from: `theme:${t.id}`, to: `route:${r.id}`, label: '候選做法' });
  });
  const routeIds = new Set(routes.map(r => r.id));
  const nodes = state.nodes.filter(n => routeIds.has(n.routeId) || n.themeIds.includes(t.id));
  const nodeIds = new Set(nodes.map(n => n.id));
  function depth(n) { let d = 0, p = n.parentId, seen = new Set([n.id]); while (p && nodeIds.has(p) && !seen.has(p)) { seen.add(p); d++; p = nodes.find(x => x.id === p)?.parentId; } return d; }
  nodes.forEach((n, i) => {
    node(`node:${n.id}`, n.type, n.title, n.acceptance, 776 + depth(n) * 360, 24 + i * 216, 'edit-node', n.id);
    const parent = nodeIds.has(n.parentId) ? `node:${n.parentId}` : routeIds.has(n.routeId) ? `route:${n.routeId}` : `theme:${t.id}`;
    edges.push({ from: parent, to: `node:${n.id}`, label: n.parentId && nodeIds.has(n.parentId) ? '拆解' : '支持' });
  });
  return { kind: 'journey', frames: [], cards, edges, bounds: bounds(cards) };
}
