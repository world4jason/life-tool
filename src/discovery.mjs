import { createCanvas } from './canvas.mjs?v=canvas-4';
import { discoveryCounts, discoveryCreate, discoveryClassify, discoveryMove, discoveryRename } from './discovery-model.mjs?v=discovery-3';

/** Two independent sorting workspaces. All data writes use the app transaction. */
export function createDiscovery(api) {
  const { esc, icon, button: b, getState: state, render: paint, commit: save, toast } = api;
  const $d = selector => document.querySelector(selector);
  let view = fresh();
  let undo = null, redo = null, drag = null, frame = 0;
  function fresh(mode = 'binary') { return { mode, binaryId: '', inspectId: '', newWord: false, selected: new Set(), drafts: {}, renaming: '', allCards: false, message: '', surface: null, journeyMap: false, directionEditing: '' }; }
  const themes = () => state().themes;
  const groupThemes = () => themes().filter(t => t.method !== 'binary');
  function activeWord() {
    const words = themes().filter(t => t.method === 'binary');
    return words.find(t => t.id === view.binaryId) || words[0] || null;
  }
  function title(e) { return e.private && api.hidePrivate() ? '私密事件' : e.title; }
  function fact(e) { return e.private && api.hidePrivate() ? '文字已遮蔽' : e.facts; }
  const extra = (key, value) => `data-${key}="${esc(value)}"`;
  const themeName = t => t.label.trim() || '未命名群組';
  const editableDraft = (id, initial) => Object.hasOwn(view.drafts, id) ? view.drafts[id] : initial;
  function focus(selector, scroll = false) {
    const el = $d(selector);
    el?.focus({ preventScroll: true });
    if (scroll) el?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }
  function transact(fn, message, after) {
    const before = structuredClone(themes()), owner = state().id;
    let result;
    const ok = save(s => { result = fn(s); return s; });
    if (ok) {
      redo = null;
      undo = { before, after: JSON.stringify(themes()), owner, revision: state().revision };
      view.message = message;
      canvas.contentChanged();
      api.practiced?.();
      after?.(result);
      paint();
    }
    return ok;
  }
  function canUndo() { return undo && undo.owner === state().id && undo.revision === state().revision && undo.after === JSON.stringify(themes()); }
  function undoLast() {
    if (!canUndo()) return toast('資料已變更，無法復原這一步');
    const previous = undo.before, future = structuredClone(themes()), owner = state().id;
    const ok = save(s => { s.themes = structuredClone(previous); return s; });
    if (ok) { redo = { future, owner, revision: state().revision, after: JSON.stringify(themes()) }; undo = null; view.inspectId = ''; view.message = '已復原分類'; paint(); focus('#discovery-message'); }
  }
  function canRedo() { return redo && redo.owner === state().id && redo.revision === state().revision && redo.after === JSON.stringify(themes()); }
  function redoLast() {
    if (!canRedo()) return;
    const before = structuredClone(themes()), future = redo.future, owner = state().id;
    const ok = save(s => { s.themes = structuredClone(future); return s; });
    if (ok) { undo = { before, after: JSON.stringify(themes()), owner, revision: state().revision }; redo = null; view.message = '已重做分類'; paint(); }
  }
  function example() {
    return view.mode === 'binary'
      ? `<div class="discovery-example-cards"><div><span>有關「自由」</span><strong>沒有排滿的旅行</strong><p>行程由自己決定。</p></div><div><span>有關「自由」</span><strong>週末被要求加班</strong><p>不能安排自己的時間。</p></div><div><span>無關「自由」</span><strong>固定牙齒檢查</strong><p>這次沒有聯想到自由。</p></div></div><p>有關不等於正面；得到或失去自由都可能有關。這是範例，不是標準答案。</p>`
      : `<div class="discovery-example-cards"><div><span>事件</span><strong>朋友聚餐</strong><p>和朋友聊了一晚。</p></div><div><span>事件</span><strong>陪家人散步</strong><p>一起走路、聊天。</p></div><div><span>群組名稱</span><strong>陪伴</strong><p>用一個詞說出共同點。</p></div></div><p>把卡片移到同一群，輸入群組名稱。其他事件可以留在未分群區。</p>`;
  }
  function coach(instruction, phase) {
    const labels = view.mode === 'binary' ? ['選詞', '分類', '結果'] : ['選卡', '成群', '命名'];
    return `<section class="discovery-coach" aria-label="分類操作引導"><div class="discovery-steps">${labels.map((label, i) => `<span ${i + 1 === phase ? 'aria-current="step"' : ''}>${i + 1} ${label}</span>`).join('<i aria-hidden="true">→</i>')}</div><p class="discovery-instruction">${instruction}</p><details class="discovery-example"><summary>看例子</summary>${example()}</details></section>`;
  }
  function card(e, source = '', compact = false) {
    const suggested = api.training() && view.mode === 'group' && !groupThemes().length && ['demo-event-5', 'demo-event-10'].includes(e.id);
    const binary = view.mode === 'binary';
    return `<article class="discovery-card ${compact ? 'compact' : ''} ${suggested ? 'discovery-suggested' : ''}" data-discovery-card="${esc(e.id)}" data-source="${esc(source)}"><div class="discovery-card-top"><span>${e.kind === 'background' ? '日常' : `${e.month} 月`}${e.energy === null ? '' : ` · ${e.energy > 0 ? '+' : ''}${e.energy}`}</span><button type="button" class="discovery-grip" data-discovery-grip="${esc(e.id)}" aria-label="移動${esc(title(e))}" aria-describedby="discovery-drag-help">${icon('grip')}</button></div><h3>${e.private ? icon('lock') : ''}${esc(title(e))}</h3>${!compact && fact(e) ? `<p>${esc(fact(e))}</p>` : ''}
      ${compact && !binary && fact(e) ? `<details class="discovery-card-facts"><summary>事件內容</summary><p>${esc(fact(e))}</p></details>` : ''}
      ${compact ? (binary
        ? b('改判', 'd-inspect', 'text-button', extra('id', e.id))
        : `<div class="discovery-card-actions">${!source ? `<label class="discovery-select"><input type="checkbox" data-discovery-select="${esc(e.id)}" ${view.selected.has(e.id) ? 'checked' : ''}><span>選取</span></label>` : ''}${b('移動', 'd-move-menu', 'text-button', `${extra('id', e.id)} ${extra('source', source)}`)}</div>`) : ''}</article>`;
  }
  function wordForm() {
    return `<form class="discovery-word-form" data-discovery-form="word"><label for="discovery-word">詞語</label><div><input id="discovery-word" name="word" maxlength="120" required value="${esc(editableDraft('new-word', ''))}" placeholder="例如：自由、陪伴、焦慮" autocomplete="off"><button type="submit" class="button primary">開始分類</button></div></form><div class="discovery-suggestions" aria-label="詞語範例">${['自由', '陪伴', '挑戰', '焦慮', '安定', '探索'].map(word => b(esc(word), 'd-word', 'word-chip', extra('word', word))).join('')}</div>`;
  }
  function nameEditor(t) {
    const draft = editableDraft(t.id, t.label);
    return `<form class="discovery-name-form" data-discovery-form="name" data-id="${esc(t.id)}"><label for="discovery-name-${esc(t.id)}">${t.method === 'binary' ? '詞語' : '群組名稱'}</label><div><input id="discovery-name-${esc(t.id)}" name="label" maxlength="120" required value="${esc(draft)}" placeholder="共同點是什麼？"><button type="submit" class="button quiet">儲存名稱</button></div></form>`;
  }
  function outcome(t) {
    const count = t.eventIds.length;
    return `<div class="discovery-outcome"><span>${t.method === 'binary' ? `有關 ${count} / ${state().events.length} 張` : `${count} 張事件`}</span>${b(`帶「${esc(t.label)}」到下一步${icon('arrow')}`, 'd-options', 'button primary', extra('id', t.id))}</div>`;
  }
  function binaryView() {
    const words = themes().filter(t => t.method === 'binary'), t = activeWord();
    const chooser = words.length ? `<div class="discovery-words" aria-label="已分類的詞語">${words.map(w => b(`${esc(w.label)}<span>${w.eventIds.length} / ${state().events.length}</span>`, 'd-select-word', `discovery-word-tab ${t?.id === w.id ? 'selected' : ''}`, `${extra('id', w.id)} aria-pressed="${t?.id === w.id}"`)).join('')}${b(`${icon('plus')}新增詞`, 'd-new-word', 'text-button')}</div>` : '';
    if (!t || view.newWord) return `${coach('輸入一個詞，將事件分到「有關」或「無關」。', 1)}${chooser}<section class="discovery-start">${wordForm()}${t ? b('取消', 'd-cancel-word', 'text-button') : ''}</section>`;
    const counts = discoveryCounts(state(), t);
    const inspected = state().events.find(e => e.id === view.inspectId);
    const current = inspected || counts.pending[0];
    const instruction = !counts.total ? '新增事件後，就能用這個詞分類。' : counts.pending.length ? (api.training() ? `用「${esc(t.label)}」檢視事件：旅行有選擇，加班可能失去選擇，兩者都能算有關。請按下方按鈕分類。` : '點「有關」或「無關」逐張分類；也可拖曳、改判或復原。') : `已分類 ${counts.total} 張。可以改判、換詞，或把這個詞帶到下一步。`;
    function bin(kind, label, items) {
      return `<section class="discovery-bin ${kind}" data-discovery-drop="${kind}" aria-label="${label}"><header><h2>${label}</h2><span>${items.length}</span></header><div class="discovery-bin-cards">${items.map(e => card(e, kind, true)).join('') || `<p class="discovery-drop-hint">拖曳卡片到這裡</p>`}</div></section>`;
    }
    const currentAnswer = current ? t.eventIds.includes(current.id) ? 'related' : t.unrelatedEventIds.includes(current.id) ? 'unrelated' : 'pending' : '';
    if (useCanvas()) return `${coach('拖曳事件到「有關」或「無關」。選取卡片也能使用「移動」。', 2)}${chooser}<p class="micro">有關 ${counts.related.length} · 無關 ${counts.unrelated.length} · 未判斷 ${counts.pending.length}</p>${canvas.render({kind:'binary', themeId:t.id})}${counts.total ? outcome(t) : ''}`;
    return `${coach(instruction, !counts.total ? 1 : counts.pending.length ? 2 : 3)}${chooser}
      <div class="discovery-word-heading"><div>${view.renaming === t.id ? nameEditor(t) : b('改詞', 'd-rename', 'text-button', extra('id', t.id))}<p>有關 ${counts.related.length} · 無關 ${counts.unrelated.length} · 未判斷 ${counts.pending.length}</p></div>${b(icon('trash'), 'd-delete', 'icon-button danger', `${extra('id', t.id)} aria-label="刪除詞語${esc(t.label)}"`)}</div>
      <div class="discovery-binary-board">${bin('related', '有關', counts.related)}<section class="discovery-focus" data-discovery-drop="pending" aria-label="目前事件"><div class="discovery-focus-top"><span>${currentAnswer === 'pending' ? `未判斷 ${counts.pending.length} 張` : current ? `目前：${currentAnswer === 'related' ? '有關' : '無關'}` : '分類結果'}</span>${canUndo() ? b('復原', 'd-undo', 'text-button') : ''}</div>
        ${current ? `${card(current)}<p class="discovery-question">這件事與「${esc(t.label)}」有關嗎？</p><div class="discovery-answer-buttons">${b(`${icon('check')}有關`, 'd-answer', 'button primary', `${extra('id', current.id)} data-answer="related" aria-pressed="${currentAnswer === 'related'}"`)}${b('無關', 'd-answer', 'button quiet', `${extra('id', current.id)} data-answer="unrelated" aria-pressed="${currentAnswer === 'unrelated'}"`)}</div><div class="discovery-focus-bottom">${currentAnswer !== 'pending' ? b('移回未判斷', 'd-answer', 'text-button', `${extra('id', current.id)} data-answer="pending"`) : b('稍後判斷', 'd-later', 'text-button', `${extra('id', current.id)} ${counts.pending.length < 2 ? 'disabled' : ''}`)}</div>`
          : counts.total ? `<div class="discovery-complete">${icon('check')}<h2>分類完成</h2><p>「${esc(t.label)}」與 ${counts.related.length} 張事件有關。</p><p>數量是分類結果，不是目標的優先順序。</p>${b('換一個詞', 'd-new-word', 'button quiet')}</div>` : `<div class="discovery-complete"><p>還沒有事件。</p>${b('新增事件', 'go', 'button primary', 'data-step="1"')}</div>`}
        ${counts.pending.length ? `<details class="discovery-pending"><summary>未判斷的事件（${counts.pending.length}）</summary>${counts.pending.map(e => b(`${e.kind === 'background' ? '日常' : e.month + '月'} · ${esc(title(e))}`, 'd-inspect', 'discovery-pending-link', extra('id', e.id))).join('')}</details>` : ''}
      </section>${bin('unrelated', '無關', counts.unrelated)}</div>${counts.total ? outcome(t) : ''}`;
  }
  function groupView() {
    if (useCanvas()) return groupCanvas();
    const groups = groupThemes();
    const ungrouped = state().events.filter(e => !groups.some(t => t.eventIds.includes(e.id)));
    let pool = view.allCards ? state().events : ungrouped;
    if (api.training() && !groups.length) pool = pool.toSorted((a,b) => Number(['demo-event-5','demo-event-10'].includes(b.id)) - Number(['demo-event-5','demo-event-10'].includes(a.id)));
    const unnamed = groups.find(t => !t.label.trim() && t.eventIds.length);
    const named = groups.filter(t => t.label.trim());
    const instruction = !state().events.length ? '新增事件，或用示範卡練習分群。' : unnamed ? '這群事件有什麼共同點？輸入群組名稱，按「儲存名稱」。' : !groups.length ? (api.training() ? '勾選「旅行」與「把週末還給自己」，按「建立群組」。它們的共同點可以叫什麼？' : '勾選有共同點的事件，按「建立群組」命名。') : '選取有共同點的事件成群；「移動」可換群。';
    return `${coach(instruction, unnamed || groups.length ? 3 : 1)}
      <div class="discovery-group-toolbar"><span>${ungrouped.length} 張未分群 · ${groups.length} 群</span>${b(`${icon('plus')}新增群組`, 'd-new-group', 'button quiet')}</div>
      <div class="discovery-group-board"><section class="discovery-pool" data-discovery-drop="pool" aria-label="事件卡"><header><h2>${view.allCards ? '全部事件' : '未分群'}</h2>${b(view.allCards ? '顯示未分群' : '顯示全部', 'd-all-cards', 'text-button', `aria-pressed="${view.allCards}"`)}</header><div class="discovery-selection"><span>已選 ${view.selected.size} 張</span>${b('建立群組', 'd-group-selected', 'button primary small', view.selected.size ? '' : 'disabled')}</div><div class="discovery-pool-cards">${pool.map(e => card(e, '', true)).join('') || `<p class="discovery-drop-hint">${state().events.length ? '所有事件已入群；可顯示全部，讓同一事件加入另一群。' : '還沒有事件。'}</p>`}</div></section>
        ${groups.map(t => `<section class="discovery-group ${!t.label.trim() ? 'needs-name' : ''}" data-discovery-drop="${esc(t.id)}" aria-label="${esc(themeName(t))}"><header>${!t.label.trim() || view.renaming === t.id ? nameEditor(t) : `<h2>${esc(t.label)}${b('改名', 'd-rename', 'text-button', extra('id', t.id))}</h2>`}${t.label.trim() ? b('比較做法 →', 'd-options', 'text-button discovery-group-next', extra('id', t.id)) : ''}${b(icon('trash'), 'd-delete', 'icon-button danger', `${extra('id', t.id)} aria-label="刪除群組${esc(themeName(t))}"`)}</header><div class="discovery-group-cards">${t.eventIds.map(id => state().events.find(e => e.id === id)).filter(Boolean).map(e => card(e, t.id, true)).join('') || '<p class="discovery-drop-hint">將事件拖到這一群</p>'}</div>${t.label.trim() ? `<footer><span>${t.eventIds.length} 張</span></footer>` : ''}</section>`).join('')}
        <button type="button" data-action="d-new-group" class="discovery-new-group" data-discovery-drop="new">${icon('plus')}<span>拖曳卡片建立群組</span><small>也可點此新增</small></button></div>
        ${!state().events.length ? b('新增事件', 'go', 'button primary', 'data-step="1"') : ''}
        ${named.length ? '<p class="discovery-footnote">每個詞都可以帶到下一步，不需要把所有事件分完。</p>' : ''}`;
  }
  function render() {
    // A deleted event cannot remain selected after returning from another chapter.
    view.selected = new Set([...view.selected].filter(id => state().events.some(e => e.id === id)));
    return `<section id="discovery" class="discovery"><div class="page-heading"><h1 id="page-title" tabindex="-1">發現線索</h1>${!api.training() ? b('操作示範', 'd-practice', 'button quiet') : ''}</div>
      <div class="discovery-mode-row"><div class="discovery-methods" aria-label="分類方法">${b('二分類', 'd-mode', view.mode === 'binary' ? 'selected' : '', 'data-mode="binary" aria-pressed="' + (view.mode === 'binary') + '"')}${b('分群', 'd-mode', view.mode === 'group' ? 'selected' : '', 'data-mode="group" aria-pressed="' + (view.mode === 'group') + '"')}</div>${surfaceSwitch()}</div>
      <p id="discovery-drag-help" class="sort-a11y">拖曳六點圖示移動卡片，Escape 取消。鍵盤或觸控可點「移動」選擇目的地；二分類也可用有關與無關按鈕。</p>
      ${view.mode === 'binary' ? binaryView() : groupView()}
      <div class="discovery-feedback"><p id="discovery-message" role="status" tabindex="-1">${esc(view.message)}</p>${canUndo() ? b('復原上一步', 'd-undo', 'text-button') : ''}</div>
      ${api.training() ? `<div class="discovery-practice-footer">${b('上一步', 'guide-back', 'text-button')}${b('下一步', 'guide-next', 'button quiet')}${b('離開示範', 'guide-exit', 'text-button')}</div>` : ''}</section>`;
  }
  function createWord(word) {
    const existing = themes().find(t => t.method === 'binary' && t.label === word.trim());
    if (existing) { view.binaryId = existing.id; view.newWord = false; view.inspectId = ''; paint(); return; }
    transact(s => discoveryCreate(s, 'binary', word), '詞語已建立；事件尚未判斷。', t => { view.binaryId = t.id; view.newWord = false; view.inspectId = ''; delete view.drafts['new-word']; });
    focus('.discovery-answer-buttons button');
  }
  function classify(eventId, answer) {
    const t = activeWord(); if (!t) return;
    transact(s => discoveryClassify(s, t.id, eventId, answer), answer === 'pending' ? '已移回未判斷' : `已分到「${answer === 'related' ? '有關' : '無關'}」`, () => { view.inspectId = ''; });
    focus('.discovery-answer-buttons button');
  }
  function move(ids, source, target, copy = false) {
    if (source === target) return;
    transact(s => discoveryMove(s, ids, source, target, copy), target === 'new' ? '群組已建立。請為共同點命名。' : target === 'pool' ? '已移出這一群' : copy ? '已加入另一群，原群保留' : '已移動卡片', id => { view.selected.clear(); if (target === 'new') view.renaming = id; });
    if (target === 'new') focus(`[id="discovery-name-${view.renaming}"]`, true);
  }
  function moveMenu(eventId, source = '') {
    const e = state().events.find(e => e.id === eventId); if (!e) return;
    const targets = view.mode === 'binary' ? [['related', '有關'], ['unrelated', '無關'], ['pending', '未判斷']] : [...groupThemes().filter(t => t.id !== source).map(t => [t.id, themeName(t)]), ['new', '新增群組'], ...(source ? [['pool', '移出這一群']] : [])];
    api.openDialog('移動事件', esc(title(e)), `<div class="discovery-destinations">${targets.map(([id, text]) => b(esc(text), 'd-move-to', 'button quiet', `${extra('id', eventId)} ${extra('source', source)} ${extra('target', id)}`)).join('')}</div>${view.mode === 'group' && source ? '<label class="check-field"><input id="discovery-copy" type="checkbox"><span>保留原群（加入其他群，不移除）</span></label>' : ''}`);
  }
  function action(action, el) {
    const id = el.dataset.id || '';
    if (action === 'd-surface') { view.surface = el.dataset.surface; canvas.cancel(); paint(); focus(`[data-action="d-surface"][data-surface="${view.surface}"]`); }
    if (action === 'd-map') { view.journeyMap = !view.journeyMap; paint(); }
    if (action === 'd-mode') { view.mode = el.dataset.mode; view.surface = null; view.message = ''; paint(); focus(`[data-action="d-mode"][data-mode="${view.mode}"]`); }
    if (action === 'd-word') createWord(el.dataset.word);
    if (action === 'd-new-word') { view.newWord = true; paint(); focus('#discovery-word'); }
    if (action === 'd-cancel-word') { view.newWord = false; paint(); }
    if (action === 'd-select-word') { view.binaryId = id; view.inspectId = ''; view.newWord = false; view.message = ''; paint(); focus(`[data-action="d-select-word"][data-id="${id}"]`); }
    if (action === 'd-answer') classify(id, el.dataset.answer);
    if (action === 'd-inspect') { view.inspectId = id; paint(); focus('.discovery-answer-buttons button', true); }
    if (action === 'd-later') { const list = discoveryCounts(state(), activeWord()).pending; const index = list.findIndex(e => e.id === id); view.inspectId = list[(index + 1) % list.length]?.id || ''; paint(); focus('.discovery-answer-buttons button'); }
    if (action === 'd-all-cards') { view.allCards = !view.allCards; paint(); }
    if (action === 'd-new-group') { transact(s => discoveryCreate(s, 'group'), '群組已建立。將事件移入後命名。', t => { view.renaming = t.id; }); focus(`[id="discovery-name-${view.renaming}"]`, true); }
    if (action === 'd-group-selected') move([...view.selected], '', 'new');
    if (action === 'd-rename') { view.renaming = id; paint(); focus(`[id="discovery-name-${id}"]`, true); }
    if (action === 'd-delete') api.deleteTheme(id);
    if (action === 'd-undo') undoLast();
    if (action === 'd-options') goOptions(id);
    if (action === 'd-direction-edit') { view.directionEditing = id; paint(); focus('#discovery-direction-input', true); }
    if (action === 'd-practice') api.practice(view.mode);
    if (action === 'd-move-menu') moveMenu(id, el.dataset.source || '');
    if (action === 'd-move-to') { const copy = !!$d('#discovery-copy')?.checked; api.closeDialog(); if (view.mode === 'binary') classify(id, el.dataset.target); else move([id], el.dataset.source || '', el.dataset.target, copy); }
  }
  function goOptions(id) { view.journeyMap = useCanvas() && window.innerWidth >= 1100; api.options(id); }
  function useCanvas() { return view.surface ? view.surface === 'canvas' : view.mode === 'group' && window.innerWidth >= 1100; }
  function surfaceSwitch() { return `<div class="discovery-view-switch" aria-label="操作方式">${b(view.mode === 'binary' ? '逐張' : '清單', 'd-surface', '', `data-surface="task" aria-pressed="${!useCanvas()}"`)}${b('畫布', 'd-surface', '', `data-surface="canvas" aria-pressed="${useCanvas()}"`)}</div>`; }
  function groupCanvas() {
    const groups = groupThemes(), pending = state().events.filter(e => !groups.some(t => t.eventIds.includes(e.id)));
    const unnamed = groups.find(t => !t.label.trim());
    const editing = groups.find(t => t.id === view.renaming) || unnamed;
    const instruction = !state().events.length ? '新增事件，或按「操作示範」練習。' : editing ? '這群事件的共同點是什麼？輸入名稱。' : !groups.length ? (api.training() ? '選取「旅行」與「把週末還給自己」，按「成群」，為共同點命名。' : '選取有共同點的事件，按「成群」，為共同點命名。') : '拖曳卡片整理群組；點群組上的「比較做法」選擇接下來的方向。';
    return `${coach(instruction, editing || groups.length ? 3 : 1)}<div class="discovery-group-toolbar"><span>${pending.length} 張未分群 · ${groups.length} 群</span>${b('新增群組', 'd-new-group', 'text-button')}</div>${editing ? `<div class="canvas-inspector">${nameEditor(editing)}</div>` : ''}${canvas.render({kind:'group'})}${!state().events.length ? b('新增事件','go','button primary','data-step="1"') : ''}`;
  }
  function moveMany(cards, target, copying = false) {
    const refs = cards.filter(c => state().events.some(e => e.id === c.event.id));
    if (!refs.length) return;
    let made = '';
    const ok = transact(s => {
      const destination = target === 'new' ? (made = discoveryCreate(s, 'group').id) : target;
      for (const ref of refs) discoveryMove(s, [ref.event.id], copying ? '' : ref.source, destination, copying);
      return destination;
    }, target === 'new' ? '群組已建立。請命名。' : '卡片已移動。', () => { if (made) view.renaming = made; });
    if (ok && made) { focus(`[id="discovery-name-${made}"]`, true); }
  }
  function actionDirection(id) { view.directionEditing = id; paint(); focus('#discovery-direction-input', true); }
  const canvas = createCanvas({
    ...api, options: goOptions, group: cards => moveMany(cards, 'new', true), moveMany,
    classifyMany: (cards, answer) => { const word = activeWord(); if (word) transact(s => { for (const card of cards) discoveryClassify(s, word.id, card.event.id, answer); }, '分類已更新。'); },
    newGroup: () => action('d-new-group', {dataset:{}}),
    rename: id => action('d-rename', {dataset:{id}}),
    canUndo, undo: undoLast, canRedo, redo: redoLast, moveMenu,
    inspect: (e, source) => api.openDialog('事件內容', esc(title(e)), `<p>${esc(fact(e) || '沒有補充內容')}</p>${b('移動', 'd-move-menu', 'button quiet', `data-id="${esc(e.id)}" data-source="${esc(source)}"`)}`),
    openNode: (action, id) => {
      if (action === 'direction') return actionDirection(id);
      const target = document.querySelector(`[data-action="${action}"][data-id="${id}"]`);
      if (target) target.click();
    },
    help: () => api.openDialog('畫布操作', '', `<div class="canvas-guide-help"><p>選取事件後按「成群」，輸入共同點。拖曳卡片到其他群組可換群；拖曳群組標題的六點圖示只改版面。</p><p>使用「平移」移動畫面，或用滑鼠滾輪。按「總覽」找回全部卡片，「定位」回到指定群組。</p><p>鍵盤：Tab 選控制項；事件卡按空白鍵選取。+／− 縮放，0 原始大小，F 總覽。移動可使用卡片按鈕，不必拖曳。</p><p>手機可切換「清單／逐張」。画布內雙指縮放；回到清單不會改變分類。</p><p>版面保存在此瀏覽器。JSON 備份保留事件與分類，不包含版面位置；匯入後會重新排列。</p></div>`)
  });

  function options(id = '') {
    const named = themes().filter(t => t.label.trim());
    const t = themes().find(t => t.id === id);
    if (!t) return `<section class="discovery-direction"><h2>哪個詞要帶到接下來的生活？</h2><p>選擇一個詞，寫下想保留或改變的事。</p><div class="discovery-direction-choices">${named.map(t => b(`${esc(t.label)}<span class="micro">${t.method === 'binary' ? '二分類' : '分群'} · ${t.eventIds.length} 張</span>`, 'd-options', 'button quiet', extra('id', t.id))).join('') || b('回到分類', 'go', 'button quiet', 'data-step="3"')}</div></section>`;
    const map = `<div class="journey-map-switch"><span>方向 → 做法 → 行動</span>${b(view.journeyMap ? '顯示清單' : '路線圖', 'd-map', 'button quiet', `aria-pressed="${view.journeyMap}"`)}</div>${view.journeyMap ? `<div class="journey-canvas">${canvas.render({kind:'journey', themeId:id})}</div>` : ''}`;
    if (t.intention && view.directionEditing !== t.id) return `<section class="discovery-direction confirmed-direction"><div class="discovery-direction-top"><span>來自「${esc(themeName(t))}」</span>${b('換詞', 'd-options', 'text-button', 'data-id=""')}</div><h2>${esc(t.intention)}</h2><div class="inline">${b('調整方向', 'd-direction-edit', 'button quiet', extra('id', t.id))}${b('新增做法', 'add-route', 'button primary')}</div></section>${map}`;
    return `<section class="discovery-direction"><div class="discovery-direction-top"><span>來自「${esc(themeName(t))}」</span>${b('換詞', 'd-options', 'text-button', 'data-id=""')}</div><form data-discovery-form="direction" data-id="${esc(t.id)}"><label for="discovery-direction-input">接下來想保留或改變什麼？</label><textarea id="discovery-direction-input" name="intention" rows="2" maxlength="500" required placeholder="例如：減少工作打斷私人時間">${esc(editableDraft('direction-' + t.id, t.intention))}</textarea><div><button class="button primary" type="submit">確認方向</button>${t.intention ? b('新增做法', 'add-route', 'button quiet') : ''}</div></form>${state().routes.some(r => r.themeId === t.id) || state().nodes.some(n => n.themeIds.includes(t.id)) ? '<p class="micro">修改方向不會改寫既有路線或行動。</p>' : '<p class="micro">詞語描述過去；方向由你選擇，不由事件數量決定。</p>'}</section>${map}`;
  }
  document.addEventListener('submit', e => {
    const form = e.target.closest('[data-discovery-form]'); if (!form) return;
    e.preventDefault();
    const data = new FormData(form), id = form.dataset.id;
    if (form.dataset.discoveryForm === 'word') createWord(String(data.get('word') || ''));
    if (form.dataset.discoveryForm === 'name') {
      const ok = transact(s => discoveryRename(s, id, String(data.get('label') || '')), '名稱已更新；既有分類與行動保留。', () => { view.renaming = ''; delete view.drafts[id]; });
      if (ok) focus(`[data-action="d-rename"][data-id="${id}"]`);
    }
    if (form.dataset.discoveryForm === 'direction') {
      const intention = String(data.get('intention') || '').trim();
      if (!intention) return toast('請寫下接下來的方向');
      const ok = save(s => { const t = s.themes.find(t => t.id === id); if (!t) throw new Error('詞語已刪除'); t.intention = intention; return s; }, '方向已確認；比較不同做法。');
      if (ok) { delete view.drafts['direction-' + id]; view.directionEditing = ''; paint(); focus('.discovery-direction [data-action="add-route"]'); }
    }
  });
  document.addEventListener('input', e => {
    const form = e.target.closest('[data-discovery-form]'); if (!form) return;
    const key = form.dataset.discoveryForm === 'word' ? 'new-word' : form.dataset.discoveryForm === 'direction' ? 'direction-' + form.dataset.id : form.dataset.id;
    view.drafts[key] = e.target.value;
  });
  document.addEventListener('change', e => {
    if (!e.target.dataset.discoverySelect) return;
    const id = e.target.dataset.discoverySelect;
    e.target.checked ? view.selected.add(id) : view.selected.delete(id);
    paint(); focus(`[data-discovery-select="${id}"]`);
  });

  // Pointer Events support mouse, pen and touch without hijacking page scrolling.
  // Only the handle has touch-action:none; buttons are the keyboard alternative.
  function cancelDrag() {
    cancelAnimationFrame(frame); frame = 0;
    drag?.ghost?.remove(); drag = null;
    document.querySelectorAll('.discovery-dragging,.discovery-drop-active').forEach(el => el.classList.remove('discovery-dragging', 'discovery-drop-active'));
  }
  function dragFrame() {
    if (!drag?.started) return;
    if (!drag.card.isConnected || !api.isDiscovery()) return cancelDrag();
    const y = drag.y;
    if (y < 90) window.scrollBy(0, -12); else if (y > innerHeight - 90) window.scrollBy(0, 12);
    const drop = document.elementFromPoint(drag.x, drag.y)?.closest('[data-discovery-drop]');
    document.querySelectorAll('.discovery-drop-active').forEach(el => { if (el !== drop) el.classList.remove('discovery-drop-active'); });
    drop?.classList.add('discovery-drop-active'); drag.target = drop?.dataset.discoveryDrop || '';
    drag.ghost.style.transform = `translate(${drag.x + 12}px,${drag.y + 12}px)`;
    frame = requestAnimationFrame(dragFrame);
  }
  document.addEventListener('pointerdown', e => {
    const handle = e.target.closest('[data-discovery-grip]');
    if (!handle || !api.isDiscovery() || e.button !== 0 || drag || $d('#editor')?.open) return;
    const card = handle.closest('[data-discovery-card]');
    drag = { id: handle.dataset.discoveryGrip, source: card.dataset.source || '', card, handle, pointer: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, started: false, target: '', revision: state().revision, owner: state().id };
    handle.setPointerCapture?.(e.pointerId);
  });
  document.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.pointer) return;
    drag.x = e.clientX; drag.y = e.clientY;
    if (!drag.started && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) > 8) {
      drag.started = true; drag.card.classList.add('discovery-dragging');
      drag.ghost = document.createElement('div'); drag.ghost.className = 'discovery-drag-ghost';
      drag.ghost.textContent = title(state().events.find(event => event.id === drag.id));
      document.body.append(drag.ghost); dragFrame();
    }
    if (drag.started) e.preventDefault();
  }, { passive: false });
  document.addEventListener('pointerup', e => {
    if (!drag || e.pointerId !== drag.pointer) return;
    const d = drag, started = d.started;
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-discovery-drop]')?.dataset.discoveryDrop;
    cancelDrag();
    if (!started) return; // The synthesized click opens the accessible move menu.
    suppressGripClickUntil = Date.now() + 500;
    if (d.owner !== state().id || d.revision !== state().revision || !api.isDiscovery()) return toast('資料已變更，請重新移動');
    if (!target) return;
    if (view.mode === 'binary') classify(d.id, target);
    else move([d.id], d.source, target);
  });
  document.addEventListener('pointercancel', cancelDrag);
  let suppressGripClickUntil = 0;
  document.addEventListener('click', e => {
    const grip = e.target.closest('[data-discovery-grip]'); if (!grip) return;
    e.preventDefault();
    if (Date.now() < suppressGripClickUntil) return;
    moveMenu(grip.dataset.discoveryGrip, grip.closest('[data-discovery-card]').dataset.source || '');
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && drag) { suppressGripClickUntil = Date.now() + 500; cancelDrag(); } });
  window.addEventListener('blur', cancelDrag);
  return {
    render, action, options,
    reset(mode = 'binary') { cancelDrag(); view = fresh(mode); undo = null; redo = null; canvas.reset(); },
    snapshot() { return { view: structuredClone(view), undo: structuredClone(undo), redo: structuredClone(redo), canvas: canvas.snapshot() }; },
    restore(saved) { cancelDrag(); view = saved ? saved.view : fresh(); undo = saved?.undo || null; redo = saved?.redo || null; canvas.restore(saved?.canvas); },
    hasDrafts() { return Object.keys(view.drafts).length > 0; }
  };
}
