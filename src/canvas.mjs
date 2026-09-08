import { validCanvasLayout, groupScene, binaryScene, journeyScene, bounds, worldPoint, zoomAt, fitCamera, contains, overlaps, clamp } from './canvas-model.mjs?v=canvas-4';

/** A small DOM/SVG canvas adapter. The controller owns meaning; this owns layout. */
export function createCanvas(api) {
  const { esc, icon } = api;
  const cache = new Map();
  let ctx = null, stage = null, layout = null, scene = null, selected = new Set();
  let expanded = false;
  let gesture = null, tool = 'select', schedule = 0, suppressClick = 0, lastOperation = '';
  const pointers = new Map();
  const $ = s => document.querySelector(s);
  const btn = (label, action, attrs = '', cls = '') => `<button type="button" class="c-button ${cls}" data-c-action="${action}" ${attrs}>${label}</button>`;
  const attr = (name, value) => `data-${name}="${esc(value)}"`;
  const shownTitle = e => e.private && api.hidePrivate() ? '私密事件' : e.title;
  const shownFacts = e => e.private && api.hidePrivate() ? '文字已遮蔽' : e.facts;
  const labelOf = n => n.event ? shownTitle(n.event) : n.label;
  function storeKey(options) { return `life-atlas.canvas.v1.${api.getState().id}.${options.kind}.${options.themeId || 'all'}`; }
  function obtain(options) {
    const key = storeKey(options);
    if (!cache.has(key)) {
      let raw = null;
      if (!api.training()) try { raw = JSON.parse(localStorage.getItem(key)); } catch { /* Layout is optional. Domain data is unaffected. */ }
      cache.set(key, { ...validCanvasLayout(raw), undo: [], redo: [] });
    }
    return { key, value: cache.get(key) };
  }
  function persist() {
    if (!ctx || api.training()) return;
    try { localStorage.setItem(ctx.key, JSON.stringify({ version: 1, positions: layout.positions, camera: layout.camera })); }
    catch { api.toast('版面未儲存；事件內容不受影響。'); }
  }
  function record(before) {
    layout.undo.push(before); if (layout.undo.length > 30) layout.undo.shift(); layout.redo = [];
    lastOperation = 'layout'; persist();
  }
  function getScene() {
    const state = api.getState();
    return ctx.kind === 'group' ? groupScene(state, layout, api.training()) : ctx.kind === 'binary' ? binaryScene(state, state.themes.find(t => t.id === ctx.themeId), layout) : journeyScene(state, ctx.themeId, layout);
  }
  function markupCard(n) {
    const checked = selected.has(n.key), title = labelOf(n);
    if (n.type !== 'event') {
      const types = { direction: '方向', route: '做法', objective: '方向 O', result: '成果 KR', action: '行動' };
      return `<article class="c-note c-node ${n.type} ${n.chosen ? 'chosen' : ''}" data-c-key="${esc(n.key)}" style="left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px"><div class="c-note-meta"><span>${types[n.type]}${n.chosen ? ' · 已選' : ''}</span>${btn(icon('grip'), 'grip', `data-c-grip="${esc(n.key)}" aria-label="移動${esc(title)}"`, 'c-grip')}</div><h3>${esc(title)}</h3><p>${esc(n.detail || '')}</p><div class="c-route-actions">${n.type === 'direction' ? btn('調整方向', 'open-node', attr('key', n.key), 'c-link') : `<button type="button" class="c-button c-link" data-action="${n.action}" data-id="${esc(n.id)}">編輯</button>`}${n.type === 'route' ? `<button type="button" class="c-button ${n.chosen ? 'c-primary' : ''}" data-action="${n.chosen ? 'route-plan' : 'select-route'}" data-id="${esc(n.id)}">${n.chosen ? '設計實驗' : '選擇'}</button>` : ''}</div></article>`;
    }
    const e = n.event;
    return `<article class="c-note c-event ${checked ? 'c-selected' : ''}" data-c-key="${esc(n.key)}" tabindex="0" aria-label="${esc(title)}${checked ? '，已選取' : ''}" style="left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px"><div class="c-note-meta"><span>${e.private ? icon('lock') : ''}${e.kind === 'background' ? '日常' : `${e.month} 月`}${e.energy === null ? '' : ` · ${e.energy > 0 ? '+' : ''}${e.energy}`}</span>${btn(icon('grip'), 'grip', `data-c-grip="${esc(n.key)}" aria-label="拖曳${esc(title)}" aria-describedby="canvas-help"`, 'c-grip')}</div><h3>${esc(title)}</h3><p>${esc(shownFacts(e))}</p><div class="c-note-actions"><label><input type="checkbox" data-c-select="${esc(n.key)}" ${checked ? 'checked' : ''}><span>選取</span></label>${btn('內容', 'inspect', attr('key', n.key), 'c-link')}${btn('移動', 'move', attr('key', n.key), 'c-link')}</div></article>`;
  }
  function frameHTML(f) {
    if (f.type === 'new') return `<section class="c-frame c-new-frame" data-c-frame="new" style="left:${f.x}px;top:${f.y}px;width:${f.w}px;height:${f.h}px">${btn(`${icon('plus')}<span>新增群組</span>`, 'new-group', '', 'c-new-button')}<p>放入卡片，或選取卡片按「成群」。</p></section>`;
    const actions = f.theme ? `<nav class="c-frame-actions" aria-label="群組操作">${btn(f.theme.label.trim() ? '改名' : '命名', 'rename', attr('id', f.id), 'c-link')}${f.theme.label.trim() ? btn('比較做法 →', 'options', attr('id', f.id), 'c-link') : ''}${btn(icon('trash'), 'delete', `${attr('id', f.id)} aria-label="刪除群組${esc(f.label)}"`, 'c-link c-danger')}</nav>` : '';
    return `<section class="c-frame ${f.id === 'pool' ? 'c-pool-frame' : ''} ${f.id === 'unrelated' ? 'c-neutral-frame' : ''}" data-c-frame="${esc(f.id)}" style="left:${f.x}px;top:${f.y}px;width:${f.w}px;height:${f.h}px"><header><div><h2 title="${esc(f.label)}">${esc(f.label)}</h2><span>${f.count} 張</span></div>${actions}${f.locked ? '' : btn(icon('grip'), 'grip', `data-c-grip="${esc(f.key)}" aria-label="移動${esc(f.label)}群組"`, 'c-grip')}</header>${!f.count ? '<p class="c-frame-empty">將卡片放到這裡</p>' : ''}</section>`;
  }
  function edgeHTML() {
    if (!scene.edges.length) return '';
    // This layer is a projection of validated relations, never a source of truth.
    return `<svg class="c-edges" aria-hidden="true" style="overflow:visible">${scene.edges.map(e => {
      const a = scene.cards.find(n => n.key === e.from), b = scene.cards.find(n => n.key === e.to); if (!a || !b) return '';
      const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2;
      return `<path d="M${x1},${y1} C${x1 + 58},${y1} ${x2 - 58},${y2} ${x2},${y2}"/><text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 8}" text-anchor="middle">${e.label}</text>`;
    }).join('')}</svg>`;
  }
  function worldHTML() { return scene.frames.map(frameHTML).join('') + edgeHTML() + scene.cards.map(markupCard).join(''); }
  function render(options) {
    const stateId = api.getState().id, data = obtain(options), changed = ctx?.key !== data.key;
    if (changed) { cancel(); expanded = false; selected.clear(); lastOperation = ''; }
    ctx = { ...options, stateId, revision: api.getState().revision, key: data.key };
    layout = data.value; scene = getScene();
    selected = new Set([...selected].filter(k => scene.cards.some(n => n.key === k)));
    cancelAnimationFrame(schedule); schedule = requestAnimationFrame(mount);
    const journey = options.kind === 'journey';
    return `<section class="canvas-shell ${expanded ? 'expanded' : ''}" aria-label="${journey ? '方向與做法畫布' : '分類畫布'}"><p class="canvas-task">${journey ? '方向、候選做法與行動；連線來自既有資料。' : options.kind === 'group' ? '選取有共同點的事件，按「成群」。' : '將事件分到有關或無關；未判斷不等於無關。'}</p><div class="canvas-toolbar"><div class="c-tools" aria-label="畫布工具">${btn('選取', 'select-tool', `aria-pressed="${tool === 'select'}"`, '')}${btn('平移', 'pan-tool', `aria-pressed="${tool === 'pan'}"`, '')}</div><div class="c-selection-tools"><span id="canvas-selection-count" role="status">已選 ${selected.size} 張</span>${!journey && options.kind === 'group' ? btn('成群', 'group', selected.size ? '' : 'disabled', 'c-primary') : ''}${btn('清除', 'clear', selected.size ? '' : 'disabled')}</div><div class="c-history">${btn('復原', 'undo', canUndo() ? '' : 'disabled')}${btn('重做', 'redo', (lastOperation === 'layout' ? layout.redo.length : api.canRedo?.()) ? '' : 'disabled')}</div></div>
      <div class="canvas-location"><label>定位<select data-c-location aria-label="定位到群組或卡片"><option value="">${journey ? '選擇節點' : '選擇區域'}</option>${(journey ? scene.cards : scene.frames.filter(f => f.id !== 'new')).map(n => `<option value="${esc(n.key)}">${esc(n.label || labelOf(n))}</option>`).join('')}</select></label><span id="canvas-help">${journey ? '拖曳整理版面；連線保留原有關係。' : '拖曳卡片移動；拖曳空白處框選。'}</span>${btn('操作說明', 'help', '', 'c-link')}${btn(expanded ? '收合' : '展開', 'expand', `aria-pressed="${expanded}"`)}</div>
      <div class="canvas-stage" data-canvas-stage tabindex="0" role="region" aria-label="可縮放畫布" aria-describedby="canvas-help"><div class="canvas-world">${worldHTML()}</div><div class="canvas-marquee" hidden></div><div class="canvas-drop-label" role="status" hidden></div></div>
      <div class="canvas-bottom"><div class="canvas-zoom">${btn('−', 'zoom-out', 'aria-label="縮小畫布"')}${btn('100%', 'actual', 'aria-label="原始大小" id="canvas-zoom-level"')}${btn('+', 'zoom-in', 'aria-label="放大畫布"')}${btn('總覽', 'fit')}${btn('整理', 'arrange')}${btn('定位選取', 'locate', selected.size ? '' : 'disabled')}</div><span class="canvas-layout-note">版面與分類分開保存</span><div class="canvas-minimap" aria-label="畫布縮圖"></div></div><p class="canvas-announcement" role="status" aria-live="polite"></p></section>`;
  }
  function mount() {
    stage = $('[data-canvas-stage]'); if (!stage || !ctx || !scene) return;
    if (!layout.camera) {
      const z = Math.max(.85, Math.min(1, (stage.clientWidth - 30) / 1128));
      layout.camera = { x: 12, y: 12, z: clamp(z, .3, 1) };
    }
    applyCamera(); syncSelection();
  }
  function minimap() {
    const host = $('.canvas-minimap'); if (!host || !stage) return;
    const r = scene.bounds, scale = Math.min(144 / Math.max(r.w, 1), 70 / Math.max(r.h, 1)), c = layout.camera;
    host.innerHTML = `<svg viewBox="0 0 160 86" role="img" aria-label="畫布全貌"><g transform="translate(8,8) scale(${scale}) translate(${-r.x},${-r.y})">${(scene.frames.length ? scene.frames : scene.cards).map(n => `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" class="c-map-node"/>`).join('')}<rect x="${-c.x / c.z}" y="${-c.y / c.z}" width="${stage.clientWidth / c.z}" height="${stage.clientHeight / c.z}" class="c-map-view" stroke-width="${1.5 / scale}"/></g></svg>`;
  }
  function applyCamera() {
    if (!stage?.isConnected || !layout.camera) return;
    const c = layout.camera;
    c.x = clamp(c.x, -50000, 50000); c.y = clamp(c.y, -50000, 50000);
    stage.querySelector('.canvas-world').style.transform = `translate(${c.x}px,${c.y}px) scale(${c.z})`;
    stage.style.backgroundSize = `${24 * c.z}px ${24 * c.z}px`;
    stage.style.backgroundPosition = `${c.x}px ${c.y}px`;
    $('#canvas-zoom-level').textContent = `${Math.round(c.z * 100)}%`;
    stage.dataset.tool = tool; minimap();
  }
  function announce(message) { const el = $('.canvas-announcement'); if (el) el.textContent = message; }
  function syncSelection() {
    if (!stage?.isConnected) return;
    stage.querySelectorAll('.c-event').forEach(el => {
      const active = selected.has(el.dataset.cKey);
      el.classList.toggle('c-selected', active); el.querySelector('[data-c-select]').checked = active;
      const n = scene.cards.find(n => n.key === el.dataset.cKey); el.setAttribute('aria-label', `${labelOf(n)}${active ? '，已選取' : ''}`);
    });
    $('#canvas-selection-count').textContent = `已選 ${selected.size} 張`;
    document.querySelectorAll('.canvas-shell [data-c-action="group"], .canvas-shell [data-c-action="clear"], .canvas-shell [data-c-action="locate"]').forEach(el => { el.disabled = !selected.size; });
  }
  function selectedCards() { return scene.cards.filter(n => selected.has(n.key) && n.type === 'event'); }
  function locate(key) {
    const targets = key ? [...scene.frames, ...scene.cards].filter(n => n.key === key) : selectedCards();
    if (!targets.length || !stage?.isConnected) return;
    layout.camera = fitCamera(bounds(targets), stage.clientWidth, stage.clientHeight, 1); applyCamera(); persist();
  }
  function canUndo() { return lastOperation === 'layout' ? layout?.undo.length : api.canUndo?.(); }
  function rerender() { api.render(); }
  function performContent(fn) { lastOperation = 'content'; layout.redo = []; selected.clear(); return fn(); }
  function action(a, el) {
    if (!ctx || !stage?.isConnected) return;
    const n = scene.cards.find(n => n.key === el?.dataset?.key);
    if (a === 'select-tool' || a === 'pan-tool') { tool = a === 'pan-tool' ? 'pan' : 'select'; $('.canvas-shell [data-c-action="select-tool"]').setAttribute('aria-pressed', String(tool === 'select')); $('.canvas-shell [data-c-action="pan-tool"]').setAttribute('aria-pressed', String(tool === 'pan')); applyCamera(); }
    if (a === 'zoom-in' || a === 'zoom-out') { layout.camera = zoomAt(layout.camera, a === 'zoom-in' ? 1.2 : 1 / 1.2, { x: stage.clientWidth / 2, y: stage.clientHeight / 2 }); applyCamera(); persist(); }
    if (a === 'actual') { layout.camera = zoomAt(layout.camera, 1 / layout.camera.z, { x: stage.clientWidth / 2, y: stage.clientHeight / 2 }); applyCamera(); persist(); }
    if (a === 'fit') { layout.camera = fitCamera(scene.bounds, stage.clientWidth, stage.clientHeight); applyCamera(); persist(); }
    if (a === 'locate') locate();
    if (a === 'arrange') { const before = structuredClone(layout.positions); layout.positions = {}; record(before); rerender(); }
    if (a === 'clear') { selected.clear(); syncSelection(); }
    if (a === 'group') { const cards = selectedCards(); if (cards.length) { expanded = false; performContent(() => api.group(cards)); } }
    if (a === 'new-group') { expanded = false; performContent(() => api.newGroup()); }
    if (a === 'rename') { expanded = false; api.rename(el.dataset.id); }
    if (a === 'delete') api.deleteTheme(el.dataset.id);
    if (a === 'options') api.options(el.dataset.id);
    if (a === 'move' && n) api.moveMenu(n.event.id, n.source);
    if (a === 'inspect' && n) api.inspect(n.event, n.source);
    if (a === 'open-node' && n) api.openNode(n.action, n.id);
    if (a === 'undo') {
      if (lastOperation !== 'layout') return api.undo();
      if (!layout.undo.length) return;
      layout.redo.push(structuredClone(layout.positions)); layout.positions = layout.undo.pop(); persist(); rerender();
    }
    if (a === 'redo' && lastOperation !== 'layout') return api.redo();
    if (a === 'redo' && lastOperation === 'layout' && layout.redo.length) { layout.undo.push(structuredClone(layout.positions)); layout.positions = layout.redo.pop(); persist(); rerender(); }
    if (a === 'help') api.help();
    if (a === 'expand') { expanded = !expanded; rerender(); }
  }
  function cancel() {
    if (gesture?.before && layout) layout.positions = gesture.before;
    if (gesture?.cameraBefore && layout) layout.camera = gesture.cameraBefore;
    gesture = null; pointers.clear();
    if (stage?.isConnected) {
      stage.querySelectorAll('.c-dragging, .c-drop-target').forEach(el => el.classList.remove('c-dragging', 'c-drop-target'));
      const marquee = stage.querySelector('.canvas-marquee'), label = stage.querySelector('.canvas-drop-label');
      if (marquee) marquee.hidden = true; if (label) label.hidden = true;
      if (scene) { stage.querySelector('.canvas-world').innerHTML = worldHTML(); applyCamera(); syncSelection(); }
    }
  }
  function relative(e) { const r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function currentNode(key) { return [...scene.cards, ...scene.frames].find(n => n.key === key); }
  document.addEventListener('pointerdown', e => {
    const region = e.target.closest('[data-canvas-stage]'); if (!region || !stage?.isConnected || $('#editor')?.open || (e.button !== 0 && e.button !== 1)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      cancelDragVisuals(); const [a, b] = [...pointers.values()], r = stage.getBoundingClientRect();
      gesture = { type: 'pinch', dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), anchor: worldPoint(layout.camera, { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top }), startZ: layout.camera.z };
      e.preventDefault(); return;
    }
    const grip = e.target.closest('[data-c-grip]');
    if (!grip && e.target.closest('button,input,label,select,textarea,a,summary')) return;
    const note = e.target.closest('[data-c-key]'), p = relative(e), key = grip?.dataset.cGrip || note?.dataset.cKey;
    const node = key ? currentNode(key) : null;
    if (grip || note && e.pointerType !== 'touch') {
      gesture = { type: 'node', key, node, start: p, before: structuredClone(layout.positions), revision: api.getState().revision, owner: api.getState().id, moved: false };
    } else {
      gesture = { type: tool === 'pan' || e.button === 1 || e.pointerType === 'touch' || e.altKey ? 'pan' : 'lasso', start: p, cameraBefore: { ...layout.camera }, previous: e.shiftKey ? new Set(selected) : new Set(), moved: false };
      stage.focus({ preventScroll: true });
    }
    stage.setPointerCapture?.(e.pointerId); e.preventDefault();
  });
  function cancelDragVisuals() {
    if (gesture?.before) layout.positions = gesture.before;
    if (stage?.isConnected) stage.querySelectorAll('.c-dragging').forEach(el => { el.classList.remove('c-dragging'); el.style.transform = ''; });
  }
  document.addEventListener('pointermove', e => {
    if (!gesture || !stage?.isConnected) return;
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = relative(e), g = gesture;
    if (g.type === 'pinch') {
      if (pointers.size < 2) return;
      const [a, b] = [...pointers.values()], r = stage.getBoundingClientRect(), z = clamp(g.startZ * Math.hypot(a.x - b.x, a.y - b.y) / g.dist, .3, 2);
      layout.camera = { x: (a.x + b.x) / 2 - r.left - g.anchor.x * z, y: (a.y + b.y) / 2 - r.top - g.anchor.y * z, z }; applyCamera(); e.preventDefault(); return;
    }
    const dx = p.x - g.start.x, dy = p.y - g.start.y;
    if (!g.moved && Math.hypot(dx, dy) < 6) return;
    g.moved = true; e.preventDefault();
    if (g.type === 'pan') { layout.camera = { ...layout.camera, x: g.cameraBefore.x + dx, y: g.cameraBefore.y + dy }; applyCamera(); }
    if (g.type === 'lasso') {
      const box = { x: Math.min(p.x, g.start.x), y: Math.min(p.y, g.start.y), w: Math.abs(dx), h: Math.abs(dy) }, marquee = stage.querySelector('.canvas-marquee');
      marquee.hidden = false; Object.assign(marquee.style, { left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px' });
      const world = { ...worldPoint(layout.camera, box), w: box.w / layout.camera.z, h: box.h / layout.camera.z };
      selected = new Set([...g.previous, ...scene.cards.filter(n => n.type === 'event' && overlaps(n, world)).map(n => n.key)]); syncSelection();
    }
    if (g.type === 'node' && g.node) {
      const wx = dx / layout.camera.z, wy = dy / layout.camera.z;
      const nodes = g.node.type === 'frame' ? [g.node, ...scene.cards.filter(n => n.frameId === g.node.id)] : [g.node];
      nodes.forEach(n => { const el = stage.querySelector(`[data-c-key="${n.key}"],[data-c-frame="${n.id || '_'}"]`); if (el) { el.classList.add('c-dragging'); el.style.transform = `translate(${wx}px,${wy}px)`; } });
      if (g.node.type === 'event') {
        const wp = worldPoint(layout.camera, p), target = [...scene.frames].reverse().find(f => contains(f, wp)); g.target = target?.id;
        stage.querySelectorAll('[data-c-frame]').forEach(el => el.classList.toggle('c-drop-target', el.dataset.cFrame === g.target));
        const label = stage.querySelector('.canvas-drop-label'); label.hidden = !target; label.textContent = target ? `放入「${target.label}」` : ''; label.style.left = clamp(p.x + 12, 4, stage.clientWidth - 180) + 'px'; label.style.top = clamp(p.y + 12, 4, stage.clientHeight - 42) + 'px';
      }
    }
  }, { passive: false });
  document.addEventListener('pointerup', e => {
    pointers.delete(e.pointerId); if (!gesture || !stage?.isConnected) return;
    const g = gesture;
    if (g.type === 'pinch') { if (!pointers.size) { gesture = null; persist(); } suppressClick = Date.now() + 450; return; }
    const p = relative(e); gesture = null; pointers.clear();
    stage.querySelector('.canvas-marquee').hidden = true; stage.querySelector('.canvas-drop-label').hidden = true;
    if (!g.moved) {
      if (g.node?.type === 'event') { e.shiftKey ? selected.has(g.key) ? selected.delete(g.key) : selected.add(g.key) : selected = new Set([g.key]); syncSelection(); }
      else if (g.type === 'lasso') { selected.clear(); syncSelection(); }
      return;
    }
    suppressClick = Date.now() + 450;
    if (g.type === 'pan') { persist(); return; }
    if (g.type === 'lasso') { announce(`已選 ${selected.size} 張；按「成群」命名。`); return; }
    if (!g.node) return;
    if (g.owner !== api.getState().id || g.revision !== api.getState().revision) { cancel(); api.toast('資料已變更，請重新移動。'); return; }
    const n = g.node, dx = (p.x - g.start.x) / layout.camera.z, dy = (p.y - g.start.y) / layout.camera.z;
    if (n.type === 'event' && g.target && g.target !== n.frameId) {
      const cards = selected.has(n.key) ? selectedCards() : [n];
      if (g.target === 'new') expanded = false;
      performContent(() => ctx.kind === 'binary' ? api.classifyMany(cards, g.target) : api.moveMany(cards, g.target)); return;
    }
    if (ctx.kind === 'binary' || n.type === 'event' && !g.target) { rerender(); announce('放到分類區或群組內；這次沒有變更。'); return; }
    if (n.type === 'event') {
      const f = scene.frames.find(f => f.id === n.frameId);
      layout.positions[n.key] = { x: clamp(n.x - f.x + dx, 16, f.w - n.w - 10), y: clamp(n.y - f.y + dy, 68, f.h - n.h - 50) };
    } else layout.positions[n.key] = { x: clamp(n.x + dx, -20000, 20000), y: clamp(n.y + dy, -20000, 20000) };
    record(g.before); rerender();
  });
  document.addEventListener('pointercancel', cancel);
  window.addEventListener('blur', cancel);
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-c-action]'); if (!el || el.disabled) return;
    if (Date.now() < suppressClick && e.detail > 0 && el.dataset.cAction === 'grip') { e.preventDefault(); return; }
    e.preventDefault(); action(el.dataset.cAction, el);
  });
  document.addEventListener('change', e => {
    if (e.target.dataset.cSelect) { const key = e.target.dataset.cSelect; e.target.checked ? selected.add(key) : selected.delete(key); syncSelection(); }
    if (e.target.matches('[data-c-location]')) locate(e.target.value);
  });
  document.addEventListener('wheel', e => {
    if (!e.target.closest('[data-canvas-stage]') || !stage?.isConnected || !layout?.camera || $('#editor')?.open) return;
    if (gesture) return;
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) layout.camera = zoomAt(layout.camera, Math.exp(-e.deltaY * .008), relative(e));
    else { layout.camera.x -= e.shiftKey ? e.deltaY : e.deltaX; layout.camera.y -= e.shiftKey ? 0 : e.deltaY; }
    applyCamera(); persist();
  }, { passive: false });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && expanded && !gesture && !$('#editor')?.open) { expanded = false; rerender(); e.preventDefault(); return; }
    if (e.key === 'Escape' && gesture) { suppressClick = Date.now() + 450; cancel(); e.preventDefault(); return; }
    if (!e.target.closest('.canvas-shell') || e.target.closest('input,textarea,select') || $('#editor')?.open) return;
    const key = e.key.toLowerCase(), node = e.target.closest('[data-c-key]');
    if ((e.ctrlKey || e.metaKey) && key === 'z') { e.preventDefault(); action(e.shiftKey ? 'redo' : 'undo', {}); return; }
    if (key === '+' || key === '=' || key === '-' || key === '0' || key === 'f') { e.preventDefault(); action(({ '+': 'zoom-in', '=': 'zoom-in', '-': 'zoom-out', '0': 'actual', f: 'fit' })[key], {}); return; }
    if (node && e.target === node && (key === ' ' || key === 'enter')) { e.preventDefault(); selected.has(node.dataset.cKey) ? selected.delete(node.dataset.cKey) : selected.add(node.dataset.cKey); syncSelection(); return; }
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key) && e.target === stage) { e.preventDefault(); layout.camera.x += key === 'arrowleft' ? 60 : key === 'arrowright' ? -60 : 0; layout.camera.y += key === 'arrowup' ? 60 : key === 'arrowdown' ? -60 : 0; applyCamera(); persist(); }
  });
  return { render, locate,
    contentChanged() { lastOperation = 'content'; },
    snapshot() { return { entries: structuredClone([...cache.entries()]), selected: [...selected], tool, lastOperation }; },
    reset() { cancel(); cache.clear(); ctx = null; selected.clear(); },
    restore(saved) { cancel(); cache.clear(); saved?.entries?.forEach(([k, v]) => cache.set(k, v)); selected = new Set(saved?.selected || []); tool = saved?.tool || 'select'; lastOperation = saved?.lastOperation || ''; ctx = null; },
    cancel
  };
}
