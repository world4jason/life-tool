import {
  MAX_EVENTS_PER_MONTH, ORIGINS, INFLUENCES, PLAN_TYPES, PERIODS, ROUTE_KINDS,
  FEELINGS, VALUES, COLORS, uid, clone, dateString, addDays, blankState, validateState,
  parseBackup, newEvent, newTheme, newRoute, newNode, sortedEvents, budgetUsage,
  descendants, removeEntity, progressFor, actionReadiness, demoState
} from './domain.mjs?v=discovery-3';
import { GUIDE_STEPS, createGuideState, prepareGuideStep } from './guide.mjs?v=discovery-3';
import { reorderMonthlyEvents, installMonthOrdering } from './month-order.mjs';
import { createDiscovery } from './discovery.mjs?v=discovery-3';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const attr = esc;
const number = value => Number(value || 0);
const fmt = value => Number(value).toLocaleString('zh-TW', { maximumFractionDigits: 1 });
const paths = {
  arrow: '<path d="m5 12 14 0m-5-5 5 5-5 5"/>', back: '<path d="M19 12H5m5-5-5 5 5 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>', edit: '<path d="m14 5 5 5M4 20l5-1L20 8a2 2 0 0 0-5-5L4 14z"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  cards: '<rect x="3" y="5" width="12" height="16" rx="2"/><path d="m9 3 9-1 3 15-4 1M6 10h6m-6 4h4"/>',
  wave: '<path d="m2 15 5-5 4 7 5-13 6 8"/>',
  dots: '<circle cx="6" cy="6" r="3"/><circle cx="18" cy="7" r="3"/><circle cx="11" cy="18" r="3"/><path d="m8 8 2 7m5-7-3 7"/>',
  routes: '<path d="M5 20V4m0 8h9a5 5 0 0 0 5-5V4m-4 0h4v4m-9 12H5l-4-4"/>',
  flag: '<path d="M5 21V3c5-5 8 5 15 0v10c-7 5-10-5-15 0"/>',
  loop: '<path d="M20 7a9 9 0 0 0-15-2L2 8m0-6v6h6m-4 9a9 9 0 0 0 15 2l3-3m0 6v-6h-6"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6z"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  star: '<path d="m12 3 3 6 6 1-4 5 1 6-6-3-6 3 1-6-4-5 6-1z"/>',
  leaf: '<path d="M4 19C-2 8 10 3 21 3c0 13-7 20-17 16Zm0 0L16 8"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>',
  spark: '<path d="m12 3 2 7 7 2-7 2-2 7-2-7-7-2 7-2z"/>',
  grip: '<circle cx="8" cy="5" r="1"/><circle cx="16" cy="5" r="1"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/><circle cx="8" cy="19" r="1"/><circle cx="16" cy="19" r="1"/>',
  screen: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/>'
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.compass}</svg>`;
const button = (label, action, cls = 'button', extra = '') => `<button type="button" class="${cls}" data-action="${action}" ${extra}>${label}</button>`;
const chip = (label, cls = '') => `<span class="chip ${cls}">${label}</span>`;
const smallHelp = text => `<p class="help">${text}</p>`;
const empty = (title, body, action = '') => `<div class="empty">${icon('leaf')}<h3>${title}</h3><p>${body}</p>${action}</div>`;
const STEPS = [
  ['compass', '開始', '留一點空間給自己', 'PROLOGUE'],
  ['cards', '拾起片刻', '先看看，發生過什麼', '01 · OBJECTIVE'],
  ['wave', '看見起伏', '感受不只一種顏色', '02 · REFLECTIVE'],
  ['dots', '發現線索', '讓意義慢慢浮現', '03 · INTERPRETIVE'],
  ['routes', '打開可能', '不急著選第一個答案', '04 · OPTIONS'],
  ['flag', '帶走實驗', '把方向放進生活裡', '05 · WAY FORWARD'],
  ['loop', '回來看看', '不是交作業，是再認識自己', '06 · REVIEW']
];
const PROMPTS = [
  '除了增加一件事，少做什麼也能支持這個方向？',
  '若只剩一半時間，有沒有另一種走法？',
  '不改變現況，先觀察兩週，也是選項嗎？',
  '同樣的需要，能透過不同的人、場合或形式被照顧嗎？',
  '哪個方法最容易撤回？哪個能先小規模試試？',
  '選了這條路，你決定不做什麼？',
  '這真的是不同路線，還是同一方法的不同次數？',
  '有哪些資源可以請人協助，而不是全部自己扛？'
];
let demo = new URLSearchParams(location.search).get('demo') === '1';
let key = `life-atlas.v1.${demo ? 'demo' : 'personal'}`;
let state, lastRaw = null, unsaved = false, conflict = false, recovery = '', storeWarning = '';
const ui = { step: 0, month: 1, view: 'graph', hidePrivate: true, themeMode: 'cards', eventSelection: new Set(), actionSelection: new Set(), routeTheme: '', stress: false, prompt: 0, reviewDate: dateString() };
let training = null;
let dialogContext = {}, previousFocus = null, pendingImport = null, confirmAction = null;

function load() {
  recovery = ''; storeWarning = ''; conflict = false; unsaved = false;
  try { lastRaw = localStorage.getItem(key); }
  catch { lastRaw = null; storeWarning = '瀏覽器不允許本機儲存；目前僅在記憶體中，離開前請下載備份。'; }
  try { state = lastRaw ? parseBackup(lastRaw) : demo ? demoState() : blankState(); }
  catch (error) { recovery = error.message; state = blankState(); }
}
load();
function commit(mutator, message = '') {
  if (recovery) { toast('原資料等待修復，請先匯出或匯入備份。', true); return false; }
  try {
    const next = typeof mutator === 'function' ? (mutator(clone(state)) ?? null) : mutator;
    if (!next) throw new Error('沒有可儲存的變更');
    next.updatedAt = new Date().toISOString(); next.revision = state.revision + 1;
    const valid = validateState(next);
    if (!training) try {
      if (conflict || localStorage.getItem(key) !== lastRaw) { conflict = true; throw new Error('另一個分頁已更新資料；本頁暫停儲存，請先下載本頁備份，再載入最新版本。'); }
      const serialized = JSON.stringify(valid);
      // Keep the untouched v1 snapshot before the first upgraded write.
      if (lastRaw && JSON.parse(lastRaw).version === 1) localStorage.setItem(`${key}.before-v2`, lastRaw);
      localStorage.setItem(key, serialized); lastRaw = serialized; unsaved = false; storeWarning = '';
    } catch (error) { unsaved = true; storeWarning = conflict ? error.message : '儲存失敗（可能空間不足或瀏覽器限制）。本頁變更仍在記憶體中，請下載備份。'; }
    state = valid; render(); if (message) toast(unsaved ? storeWarning : message, unsaved); return true;
  } catch (error) { showFormError(error.message); return false; }
}
function updateList(kind, entity) {
  return commit(s => { const i = s[kind].findIndex(x => x.id === entity.id); if (i < 0) s[kind].push(entity); else s[kind][i] = entity; return s; }, '已保存這張卡');
}
function toast(message, error = false) {
  const el = $('#toast'); el.textContent = message; el.classList.toggle('error', error); el.classList.add('visible');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('visible'), 5000);
}
function showFormError(message) {
  const el = $('#form-error'); if (el && $('#editor').open) { el.textContent = message; el.hidden = false; el.focus(); } else toast(message, true);
}
function titleOf(event) { return event.private && ui.hidePrivate ? '私密事件' : event.title; }
function eventMeta(event) { return `${event.kind === 'background' ? '日常背景' : `${event.month} 月 · ${event.order}`} / ${ORIGINS[event.origin]}`; }
function eventCard(event, editable = true, select = false, orderControls = '') {
  const hidden = event.private && ui.hidePrivate;
  const selected = ui.eventSelection.has(event.id);
  return `<article ${orderControls ? `data-sort-id="${attr(event.id)}"` : ''} class="event-card ${event.energy === null ? 'unrated' : event.energy >= 0 ? 'positive' : 'negative'} ${selected ? 'is-selected' : ''}">
    <div class="card-top"><span class="eyebrow">${eventMeta(event)}</span><span class="energy ${event.energy === null ? '' : event.energy < 0 ? 'low' : ''}">${event.energy === null ? '未評分' : `${event.energy > 0 ? '+' : ''}${event.energy}`}</span></div>
    <h3>${event.private ? icon('lock') : ''}${esc(titleOf(event))}</h3>
    <p class="event-facts">${hidden ? '文字已遮蔽' : esc(event.facts || '')}</p>
    <div class="card-bottom">${orderControls || (ui.step === 2 ? '<span></span>' : `<span class="micro">${hidden ? '私密卡' : event.feelings.map(esc).join(' · ') || (event.important ? '對我重要' : '')}</span>`)}
    ${select ? `<label class="select-card"><input type="checkbox" data-event-select="${event.id}" ${selected ? 'checked' : ''}><span>選取</span></label>` : editable ? button(`${icon('edit')}<span>${ui.step === 2 ? '評分' : '編輯'}</span>`, 'edit-event', 'text-button', `data-id="${event.id}" aria-label="編輯${attr(titleOf(event))}"`) : ''}</div>
  </article>`;
}
function statusSummary() {
  return [state.events.filter(e => e.kind === 'event').length, state.events.filter(e => e.energy !== null).length,
    state.themes.length, state.routes.filter(r => r.selected).length, state.nodes.filter(n => n.type === 'action').length, state.reviews.length];
}
function shell(content) {
  const counts = statusSummary();
  return `<aside class="sidebar">
    <a href="#" class="brand" data-action="home" aria-label="拾光，回到開始"><span class="brand-mark">${icon('wave')}</span><span><strong>拾光</strong><small>LIFE ATLAS</small></span></a>
    <nav class="steps" aria-label="探索章節">${STEPS.map(([ic, name], i) => `<button class="step ${ui.step === i ? 'active' : ''}" data-action="go" data-step="${i}" ${ui.step === i ? 'aria-current="step"' : ''}>
      <span class="step-symbol">${icon(ic)}</span><span>${name}</span>${i && counts[i - 1] ? `<span class="step-count">${counts[i - 1]}</span>` : ''}</button>`).join('')}</nav>
    <div class="local-note">${icon('lock')}<span>資料留在這台裝置</span></div>
  </aside>
  <div class="workspace">
    <header class="topbar"><div class="breadcrumb"><span>${training ? '示範' : '我的回顧'}</span><span>/</span>${training ? `<span>${state.year}</span>` : `<button class="year-button" data-action="settings">${state.year}${icon('settings')}</button>`}${demo && !training ? chip('虛構示範', 'gold') : ''}</div>
      <div class="top-actions"><span class="save-status ${unsaved ? 'warning' : ''}"><i></i>${training ? '練習不儲存' : unsaved ? '尚未儲存' : lastRaw ? '已存於本機' : '準備開始'}</span>
      ${button(icon(ui.hidePrivate ? 'lock' : 'eye'), 'privacy', 'icon-button', `aria-label="${ui.hidePrivate ? '顯示私密卡文字' : '隱藏私密卡文字'}" title="${ui.hidePrivate ? '私密卡已遮蔽' : '私密卡已顯示'}"`)}
      ${button(training ? '離開示範' : '操作引導', training ? 'guide-exit' : 'start-guide', 'button quiet small')}${!training ? button(`${icon('download')}<span>備份</span>`, 'data', 'button quiet small') : ''}</div>
    </header>
    ${training ? `<div class="demo-banner"><span>虛構資料，不影響你的紀錄。</span></div>` : demo ? `<div class="demo-banner"><span>虛構示範</span>${button('回到我的回顧', 'switch-personal', 'text-button')}</div>` : ''}
    ${storeWarning ? `<div class="warning-banner" role="alert"><span>${esc(storeWarning)}</span>${conflict ? button('載入另一分頁版本', 'reload-storage', 'button small') : ''}</div>` : ''}
    <main id="main" tabindex="-1">${recovery ? recoveryView() : guideBar() + content}</main>
    <footer class="footer"><span>拾光 Life Atlas</span>${button('資料與隱私', 'about', 'text-button')}</footer>
  </div>`;
}
function heading(kicker, title, subtitle, actions = '') {
  return `<div class="page-heading"><div><h1 tabindex="-1" id="page-title">${title}</h1>${subtitle && !training ? `<p>${subtitle}</p>` : ''}</div><div class="heading-actions">${actions}</div></div>`;
}
function chapterFooter(next, label) {
  return training ? '' : `<div class="chapter-footer">${button(`${label}${icon('arrow')}`, 'go', 'button primary', `data-step="${next}"`)}</div>`;
}
function homeView() {
  const eventCount = state.events.filter(e => e.kind === 'event').length;
  return `<section class="hero">
    <div class="hero-copy"><h1 id="page-title" tabindex="-1">回顧這一年，<br><span>決定下一步。</span></h1>
    <p>記下事件，找出在乎的事，再試一個行動。</p>
    <div class="hero-buttons">${button(`跟著示範做${icon('arrow')}`, 'start-guide', 'button primary large')}${button(training ? '離開示範' : eventCount ? '繼續我的回顧' : '開始我的回顧', training ? 'guide-exit' : 'go', 'button quiet large', 'data-step="1"')}</div>
    <div class="hero-note">${icon('lock')}不用登入，資料存在本機。</div></div>
    <div class="hero-art" aria-label="把生活片刻連成一條有高有低的年度曲線">
      <div class="art-label"><span>示範</span><span>${state.year}</span></div>
      <svg viewBox="0 0 500 320" class="hero-line" aria-hidden="true"><defs><pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#bfc9be"/></pattern></defs><rect width="500" height="320" fill="url(#dots)"/><path d="M10 195 115 122 235 225 340 68 490 126" fill="none" stroke="#6b9483" stroke-width="2" stroke-dasharray="6 5"/><g fill="#1e615b"><circle cx="115" cy="122" r="5"/><circle cx="235" cy="225" r="5"/><circle cx="340" cy="68" r="5"/></g><text x="12" y="306" class="svg-label">JAN</text><text x="446" y="306" class="svg-label">DEC</text></svg>
      <div class="paper paper-one"><small>六月 · +9</small><strong>一趟沒有<br>排滿的旅行</strong><span>計畫內</span></div>
      <div class="paper paper-two"><small>十一月 · +6</small><strong>把週末<br>還給自己</strong><span>計畫內</span></div>
      
    </div>
  </section>
  <section class="journey-intro" aria-label="回顧步驟"><div class="journey-grid">${STEPS.slice(1).map(([ic, name], i) => `<button class="journey-card" data-action="go" data-step="${i + 1}"><span class="journey-no">${i + 1}</span>${icon(ic)}<span>${name}</span></button>`).join('')}</div></section>`;
}

function factsView() {
  return `${heading(STEPS[1][3], '拾起片刻', '每月記下 0–3 件事。', button(`${icon('plus')}新增片刻`, 'add-event', 'button primary'))}
    <div class="month-grid">${Array.from({ length: 12 }, (_, i) => {
      const month = i + 1, events = sortedEvents(state.events).filter(e => e.month === month);
      return `<section class="month-cell"><div class="month-head"><h2><b>${String(month).padStart(2, '0')}</b><span>月</span></h2><span class="micro">${events.length} / 3</span></div>
        <div class="month-events">${events.map(eventCardShort).join('')}${events.length < 3 ? button(`${icon('plus')}留下一個片刻`, 'add-event', 'add-slot', `data-month="${month}" aria-label="在${month}月新增片刻"`) : '<p class="micro">這個月已放滿。日常可以放在下方。</p>'}</div></section>`;
    }).join('')}</div>
    <section class="background-zone"><div class="section-title"><div><h2>日常背景</h2><p>固定發生的事，不占每月名額。</p></div>${button(`${icon('plus')}加入日常背景`, 'add-background', 'button quiet')}</div>
    <div class="cards-grid">${state.events.filter(e => e.kind === 'background').map(e => eventCard(e)).join('') || '<p class="muted">尚無日常紀錄</p>'}</div></section>
    ${chapterFooter(2, '看看它們的起伏')}`;
}
function eventCardShort(event) {
  return `<button class="month-event ${event.private ? 'private-event' : ''}" data-action="edit-event" data-id="${event.id}"><span class="origin-dot ${event.origin}"></span><span>${esc(titleOf(event))}</span>${event.private ? icon('lock') : icon('edit')}</button>`;
}
function timelineSvg(exporting = false) {
  const w = 1200, h = 400, left = 56, top = 40, bottom = 334, dx = (w - left - 24) / 12;
  const events = sortedEvents(state.events).filter(e => e.energy !== null && !(exporting && e.private));
  const x = e => left + dx * (e.month - 0.5) + (e.order - 2) * 20;
  const y = e => top + (10 - e.energy) / 20 * (bottom - top);
  const line = events.map(e => `${x(e)},${y(e)}`).join(' ');
  return `<svg class="timeline-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="timeline-title timeline-desc">
    <title id="timeline-title">${state.year} 年事件能量圖，負十到正十</title><desc id="timeline-desc">${exporting ? '已排除標記私密的事件。' : ''}只連接已評分的大事件；空白不等於零，線段不代表事件之間的真實連續狀態。完整卡片清單在圖下方。</desc>
    <rect x="0" y="0" width="${w}" height="${h}" rx="12" fill="#fffefa"/>
    ${[-10, -5, 0, 5, 10].map(n => { const yy = top + (10 - n) / 20 * (bottom - top); return `<line x1="${left}" x2="${w - 18}" y1="${yy}" y2="${yy}" stroke="${n === 0 ? '#b6c2ba' : '#e8e9e2'}" stroke-dasharray="${n === 0 ? '0' : '3 6'}"/><text x="35" y="${yy + 5}" text-anchor="end" font-size="12" fill="#59665f">${n > 0 ? '+' : ''}${n}</text>`; }).join('')}
    ${Array.from({ length: 12 }, (_, i) => `<text x="${left + dx * (i + 0.5)}" y="370" text-anchor="middle" font-size="12" fill="#59665f">${i + 1} 月</text>`).join('')}
    ${events.length > 1 ? `<polyline points="${line}" fill="none" stroke="#58897b" stroke-width="2" stroke-dasharray="6 5"/>` : ''}
    ${events.map((e, i) => `<g ${!exporting ? `data-action="edit-event" data-id="${e.id}" role="button" tabindex="0" aria-label="${attr(titleOf(e))}，${e.month} 月，能量 ${e.energy}"` : ''}>
      <circle cx="${x(e)}" cy="${y(e)}" r="21" fill="transparent"/>
      ${e.origin === 'surprise' ? `<path d="M${x(e)},${y(e) - 7}l7 7-7 7-7-7z" fill="${e.energy < 0 ? '#b86a55' : '#25685b'}" stroke="#fffefa" stroke-width="2"/>` : `<circle cx="${x(e)}" cy="${y(e)}" r="7" fill="${e.energy < 0 ? '#b86a55' : '#25685b'}" stroke="#fffefa" stroke-width="2"/>`}
      <text x="${x(e)}" y="${y(e) + (i % 2 === 0 ? -17 : 25)}" text-anchor="middle" font-size="11" fill="#30463d">${esc((exporting ? e.title : titleOf(e)).slice(0, 7))}${(exporting ? e.title : titleOf(e)).length > 7 ? '…' : ''}</text></g>`).join('')}
    <text x="58" y="18" font-size="11" fill="#66756d">較充電 ↑</text><text x="58" y="393" font-size="10" fill="#66756d">較耗損 ↓　｜　事件間連線僅供回顧，不是連續測量</text>
  </svg>`;
}
function monthlyOrderControls(event, index, length) {
  return `<div class="order-controls">
    <button type="button" data-reorder-handle data-id="${attr(event.id)}" aria-label="拖曳排序：${attr(titleOf(event))}" aria-describedby="month-sort-help" title="拖曳排序" ${length < 2 ? 'disabled' : ''}>${icon('grip')}</button>
    <button type="button" data-month-move="-1" data-id="${attr(event.id)}" aria-label="向前移動：${attr(titleOf(event))}" title="向前移動" ${index === 0 ? 'disabled' : ''}>${icon('back')}</button>
    <button type="button" data-month-move="1" data-id="${attr(event.id)}" aria-label="向後移動：${attr(titleOf(event))}" title="向後移動" ${index === length - 1 ? 'disabled' : ''}>${icon('arrow')}</button>
  </div>`;
}
function energyMonth(month) {
  const events = sortedEvents(state.events).filter(e => e.month === month);
  return `<section class="energy-month" aria-label="${month} 月事件">
    <div class="energy-month-heading"><h2>${month} 月</h2><span class="month-count">${events.length} / 3</span>${events.length < 3 ? button(`${icon('plus')}新增`, 'add-event', 'text-button', `data-month="${month}" aria-label="在${month}月新增片刻"`) : ''}</div>
    <div class="energy-month-cards" data-month-sort="${month}">${events.map((e, index) => eventCard(e, true, false, monthlyOrderControls(e, index, events.length))).join('') || empty('沒有事件', '這個月份可以留白。')}</div>
  </section>`;
}
function energyView() {
  const months = ui.view === 'list' ? [ui.month] : [...new Set(sortedEvents(state.events).map(e => e.month))];
  const background = state.events.filter(e => e.kind === 'background');
  const unrated = state.events.filter(e => e.energy === null).length;
  return `${heading(STEPS[2][3], '看見起伏', '點「評分」設定能量：−10 耗損，＋10 充電。', button(`${icon('plus')}新增片刻`, 'add-event', 'button quiet'))}
    <section class="panel timeline-panel"><div class="panel-head"><div><h2>${ui.view === 'graph' ? '年度曲線' : '月份'}</h2><span class="micro">${state.frame === 'then' ? '回想當時的能量' : '以現在回看的能量'} · ${unrated} 張還沒評分</span></div><div class="segmented" aria-label="圖板模式">${button('年度圖', 'view-graph', ui.view === 'graph' ? 'selected' : '', `aria-pressed="${ui.view === 'graph'}"`)}${button('逐月卡片', 'view-list', ui.view === 'list' ? 'selected' : '', `aria-pressed="${ui.view === 'list'}"`)}</div></div>
    ${ui.view === 'graph' ? `<div class="timeline-scroll" tabindex="0" aria-label="年度能量圖，可左右捲動">${timelineSvg()}</div><div class="chart-legend"><span><i class="legend-dot"></i>計畫內／其他</span><span><i class="legend-diamond"></i>意外</span><span>點卡片評分</span>${button('調整評分視角', 'settings', 'text-button')}</div>` : `<div class="month-tabs" aria-label="選擇月份">${Array.from({ length: 12 }, (_, i) => button(`${i + 1}月`, 'month', ui.month === i + 1 ? 'selected' : '', `data-month="${i + 1}" aria-pressed="${ui.month === i + 1}"`)).join('')}</div>`}
    </section>
    <p class="order-instruction">拖曳卡片的六點圖示調整月內順序，也可使用箭頭。</p>
    <span id="month-sort-help" class="sort-a11y">拖曳到同月份的位置。鍵盤方向鍵可移動，Home 移到最前，End 移到最後；Escape 取消拖曳。</span>
    <div class="energy-board">${months.map(energyMonth).join('') || empty('還沒有事件卡', '新增事件後即可評分。', button('新增事件', 'add-event', 'button quiet', `data-month="${ui.month}"`))}</div>
    ${background.length ? `<section class="energy-background"><h2>日常背景</h2><div class="cards-grid">${background.map(e => eventCard(e)).join('')}</div></section>` : ''}
    ${chapterFooter(3, '發現線索')}`;
}
function themesView() { return discovery.render(); }
function resourceMeters() {
  const b = budgetUsage(state, ui.stress ? 0.5 : 1);
  return `<div class="resource-grid">${[['hours', 'clock', '每週可用時間', '小時'], ['money', 'cards', '每月可用預算', '元'], ['energy', 'leaf', '每週心力籌碼', '點']].map(([k, ic, label, unit]) => `<div class="resource ${b.over.includes(k) ? 'over' : ''}"><div>${icon(ic)}<span>${label}</span></div><strong>${fmt(b.totals[k])}<small> / ${fmt(b.available[k])} ${unit}</small></strong><div class="meter"><i style="width:${Math.min(100, b.available[k] ? b.totals[k] / b.available[k] * 100 : b.totals[k] ? 100 : 0)}%"></i></div><span class="micro">${b.over.includes(k) ? '超出預算' : ''}</span></div>`).join('')}</div>`;
}
function optionsView() {
  const routes = state.routes.filter(r => !ui.routeTheme || r.themeId === ui.routeTheme);
  const selected = state.routes.filter(r => r.selected).length;
  const kinds = new Set(routes.map(r => r.kind));
  return `${heading(STEPS[4][3], '打開可能', '比較不同做法、資源和代價，再做選擇。', button(`${icon('plus')}新增一條路`, 'add-route', 'button primary'))}
    ${discovery.options(ui.routeTheme)}
    <section class="possibility-card"><div><p>${esc(PROMPTS[ui.prompt])}</p></div>${button(`${icon('loop')}換一個提問`, 'draw-prompt', 'button quiet')}</section>
    <div class="section-title"><h2>資源預算</h2>${button('調整資源預算', 'budget', 'text-button')}</div>${resourceMeters()}
    <div class="resource-note"><p class="micro">時間以每週、金錢以每月比較；一次性支出請換算並寫在代價中。心力籌碼只是自己的容量估計，不是心理量測。</p><label class="toggle"><input type="checkbox" id="stress-toggle" ${ui.stress ? 'checked' : ''}><span>壓力測試：可用時間只剩一半</span></label></div>
    <div class="route-toolbar"><label>比較的方向<select id="route-filter"><option value="">全部方向</option>${state.themes.map(t => `<option value="${t.id}" ${ui.routeTheme === t.id ? 'selected' : ''}>${esc(t.intention || t.label)}</option>`).join('')}</select></label><span class="micro">${routes.length} 條候選 · ${kinds.size} 種走法 · 已選 ${selected} 條</span></div>
    ${routes.length > 0 && (routes.length < 2 || kinds.size < 2) ? '<div class="soft-warning">先試著提出至少兩種不同走法。這是邀請，不是關卡門檻；你也可以明確選擇暫時不比較。</div>' : ''}
    <div class="route-grid">${routes.map(r => `<article class="route-card ${r.selected ? 'chosen' : ''}"><div class="card-top">${chip(ROUTE_KINDS[r.kind], r.selected ? 'teal' : '')}${button(icon('edit'), 'edit-route', 'icon-button', `data-id="${r.id}" aria-label="編輯路線${attr(r.title)}"`)}</div>
      <p class="micro">${esc(state.themes.find(t => t.id === r.themeId)?.value || '由自己選擇的方向')}</p><h3>${esc(r.title)}</h3>
      <dl><dt>期待支持什麼</dt><dd>${esc(r.benefit || '尚未寫下')}</dd><dt>要付出的代價／放棄什麼</dt><dd>${esc(r.cost || '還需要想一想')}</dd><dt>最小的第一步</dt><dd>${esc(r.firstStep || '可以先只是觀察')}</dd></dl>
      <div class="route-cost">${chip(`${fmt(r.hours)} 小時／週`)}${chip(`${fmt(r.money)} 元／月`)}${chip(`${fmt(r.energy)} 心力`)}</div>
      <div class="route-obstacle"><span>遇到障礙時</span><p>${esc(r.obstacle || '哪一種情境最可能打亂這條路？')}</p>${r.fallback ? `<p>→ ${esc(r.fallback)}</p>` : ''}</div>
      <div class="route-confidence"><span>我目前的信心</span><span>${r.confidence} / 10</span></div>
      ${r.selected && r.reason ? `<p class="choice-reason">選擇理由：${esc(r.reason)}</p>` : ''}
      <div class="route-buttons">${button(`${icon(r.selected ? 'check' : 'plus')}${r.selected ? '已選擇 · 取消' : '暫時選這條'}`, 'select-route', r.selected ? 'button selected-button' : 'button quiet', `data-id="${r.id}" aria-pressed="${r.selected}"`)}${r.selected ? button('設計實驗', 'route-plan', 'text-button', `data-id="${r.id}"`) : ''}</div>
      </article>`).join('') || empty('在決定前，多留幾條路', '增加、減少、換個形式、維持現況，或先觀察。先為一個方向寫出不同可能。', button('寫第一條路', 'add-route', 'button primary'))}</div>
    <div class="permission-note">${icon('leaf')}<div>${state.optionsSkipReason ? `<p>${esc(state.optionsSkipReason)}</p>` : ''}${button('記錄暫不比較的理由', 'options-skip', 'text-button')}${button('加入「先觀察」候選', 'observe-route', 'text-button')}</div></div>
    ${chapterFooter(5, '帶走一個小實驗', '資源超額時可以回來縮小；這裡不會替你鎖定一個答案。')}`;
}
function nodeCard(n, depth = 0) {
  const children = state.nodes.filter(x => x.parentId === n.id);
  const readiness = actionReadiness(n);
  const label = { objective: '方向 O', result: '成果 KR', action: PLAN_TYPES[n.planType] }[n.type];
  const route = state.routes.find(r => r.id === n.routeId);
  return `<div class="node-branch depth-${Math.min(depth, 3)}"><article class="plan-card ${n.type}"><div class="card-top"><div class="inline">${chip(label, n.type === 'objective' ? 'teal' : '')}<span class="micro">${({ draft: '草稿', active: '實驗中', paused: '暫停', done: '完成', stopped: '已停止' })[n.status]}</span></div><div class="inline">${n.type === 'action' ? `<label class="select-card"><input type="checkbox" data-node-select="${n.id}" ${ui.actionSelection.has(n.id) ? 'checked' : ''}><span>聚類</span></label>` : ''}${button(icon('edit'), 'edit-node', 'icon-button', `data-id="${n.id}" aria-label="編輯計畫${attr(n.title)}"`)}</div></div>
    <h3>${esc(n.title)}</h3>${route ? `<p class="micro">路線：${esc(route.title)}${!route.selected ? '（目前未選取；這個實驗不會自動刪除）' : ''}</p>` : ''}
    <div class="linked-events">${n.themeIds.map(id => state.themes.find(t => t.id === id)).filter(Boolean).map(t => chip(esc(t.value || t.label), t.color)).join('')}</div>
    ${n.type !== 'objective' ? `<div class="metric-line">${PERIODS[n.period]} · ${({ atLeast: '至少', atMost: '最多', exactly: '恰好' })[n.comparator]} <strong>${fmt(n.target)} ${esc(n.unit)}</strong></div>
      <p class="acceptance">${esc(n.acceptance || '未填驗收方式')}</p>
      <div class="plan-details"><div><span>當……我就開始</span><p>${esc(n.trigger || '未填')}</p></div><div><span>忙碌時的縮小版</span><p>${esc(n.minimum || '未填')}</p></div><div><span>障礙與備案</span><p>${esc(n.fallback || '未填')}</p></div><div><span>回顧日</span><p>${n.reviewDate || '尚未選日期'}</p></div></div>
      ${readiness.length ? `<p class="readiness">可再補上：${readiness.join('、')}。</p>` : ''}` : `<p class="muted">${esc(n.acceptance || '')}</p>`}
    <div class="plan-actions">${n.type !== 'action' ? button(`${icon('plus')}拆成行動`, 'child-action', 'text-button', `data-id="${n.id}"`) + button('增加成果 KR', 'child-result', 'text-button', `data-id="${n.id}"`) : button('記錄與回顧', 'log-node', 'text-button', `data-id="${n.id}"`)}</div></article>
    ${children.length ? `<div class="node-children">${children.map(child => nodeCard(child, depth + 1)).join('')}</div>` : ''}</div>`;
}
function plansView() {
  const b = budgetUsage(state);
  return `${heading(STEPS[5][3], '帶走實驗', '寫下行動、驗收方式和回顧日。', `${button('新增方向 O', 'add-objective', 'button quiet')}${button(`${icon('plus')}寫一個行動`, 'add-action', 'button primary')}`)}
    ${b.over.length ? '<div class="soft-warning">已選路線超出資源預算。你仍可保留草稿；啟動前記得回「打開可能」重新取捨。</div>' : ''}
    ${!state.routes.length && !state.optionsSkipReason ? `<div class="soft-warning">還沒有比較替代路線。可以先寫行動再回頭探索，或記下暫不比較的理由。${button('回去比較路線', 'go', 'text-button', 'data-step="4"')}</div>` : ''}
    ${ui.actionSelection.size ? `<div class="selection-bar"><span>已選 ${ui.actionSelection.size} 個行動</span>${button('向上聚成一個方向', 'group-actions', 'button small primary')}</div>` : ''}
    <div class="plans-list">${state.nodes.filter(n => !n.parentId).map(n => nodeCard(n)).join('') || empty('一個小實驗，就足夠出發。', '也可以決定暫時不新增任何目標。', button('寫第一個行動', 'add-action', 'button primary'))}</div>
    <section class="permission-note">${icon('leaf')}<div>${state.decision ? `<p>${esc(state.decision)}</p>` : ''}${button('寫下我現在的決定', 'decision', 'text-button')}</div></section>
    ${chapterFooter(6, '設定回來看的方式')}`;
}
function reviewCard(n) {
  const p = progressFor(n, state.reviews, ui.reviewDate);
  const cmp = { atLeast: '至少', atMost: '最多', exactly: '恰好' }[n.comparator];
  const pending = n.reviewDate && n.reviewDate <= dateString();
  const statusText = !p.hasData ? '尚無執行紀錄，不判定達標' : n.comparator === 'atMost' ? p.met ? '截至目前在界線內；不代表整期通過' : '已超過界線，看看情境而不是責備自己' : p.met ? '本期記錄已達數量；再看看方向是否合適' : '尚未達到本期數量，可以調整';
  return `<article class="review-card"><div class="card-top">${chip(n.type === 'result' ? '成果 KR' : PLAN_TYPES[n.planType])}${pending ? chip('到了約定的回顧日', 'gold') : `<span class="micro">${n.reviewDate ? `下次 ${n.reviewDate}` : '尚未訂回顧日'}</span>`}</div><h3>${esc(n.title)}</h3>
    <div class="review-count"><strong>${p.hasData ? fmt(p.full) : '—'}</strong><span>${esc(n.unit)} / ${PERIODS[n.period]}${cmp} ${fmt(n.target)} ${esc(n.unit)}</span></div>
    <p class="micro">${n.aggregation === 'latest' ? '最近一次完整讀值' : '本期完整執行累計'} · ${n.period === 'once' ? `從 ${n.startDate || '開始'} 到檢視日` : `${p.first} — ${p.last}`}</p>
    <p class="progress-caption">${statusText}</p><div class="two-checks"><div><span>執行驗收</span><p>縮小版另記：${fmt(p.minimum)} ${esc(n.unit)}</p></div><div><span>方向驗收</span><p>${p.records.length ? `${p.records.length} 筆反思，其中 ${p.directionSupport} 筆感到支持方向` : '做完，有比較靠近在乎的生活嗎？'}</p></div></div>
    <div class="review-buttons">${button(`${icon('plus')}留下一筆紀錄`, 'log-node', 'button quiet', `data-id="${n.id}"`)}${button('調整實驗', 'edit-node', 'text-button', `data-id="${n.id}"`)}</div></article>`;
}
function reviewsView() {
  const nodes = state.nodes.filter(n => n.type !== 'objective');
  return `${heading(STEPS[6][3], '回來看看', '記下執行量與感受，決定要不要調整。', button(`${icon('download')}帶走探索地圖`, 'export-map', 'button quiet'))}
    <div class="review-intro"><label>檢視日期<input id="review-date" type="date" value="${ui.reviewDate}" max="${dateString()}"></label></div>
    <div class="review-grid">${nodes.map(reviewCard).join('') || empty('現在不需要新的任務，也沒有關係。', state.decision ? esc(state.decision) : '你可以回去設計一個實驗，或只帶走這一輪的觀察。', button('回到我的實驗', 'go', 'button quiet', 'data-step="5"'))}</div>
    <section class="panel log-panel"><div class="panel-head"><h2>回顧紀錄</h2><span class="micro">${state.reviews.length} 筆紀錄</span></div>
      ${state.reviews.toSorted((a, b) => b.date.localeCompare(a.date)).slice(0, 100).map(r => `<div class="log-row"><span class="log-date">${r.date}</span><div><strong>${esc(state.nodes.find(n => n.id === r.nodeId)?.title || '')}</strong><p>${esc(r.note || '')}</p><span class="micro">${({ full: '完整執行／讀值', minimum: '縮小版本', missed: '未執行', reflection: '只記反思' })[r.mode]} ${fmt(r.amount)} · ${({ supports: '支持原本方向', unsure: '還不確定', drains: '感到耗損／不合適' })[r.direction]} · 下次${({ keep: '維持', adjust: '調整', reduce: '減量', pause: '暫停', stop: '停止' })[r.decision]}</span></div>${button(icon('edit'), 'edit-review', 'icon-button', `data-id="${r.id}" aria-label="編輯${r.date}紀錄"`)}</div>`).join('') || '<p class="muted panel-empty">還沒有紀錄。即使沒有執行，也可以記下阻礙或新的理解。</p>'}
      ${state.reviews.length > 100 ? '<p class="micro">畫面先顯示最近 100 筆；JSON 備份保留全部紀錄。</p>' : ''}</section>
    <div class="closing-card">${state.decision ? `<p>${esc(state.decision)}</p>` : ''}<div>${button('回到線索，重新看看', 'go', 'button quiet', 'data-step="3"')}${button('寫下現在的決定', 'decision', 'text-button')}</div></div>`;
}
function recoveryView() {
  return `<section class="recovery panel"><h1>先保護原本的紀錄。</h1><p>本機資料無法通過格式檢查：${esc(recovery)}</p><p>原始內容仍保留，沒有用空白資料覆蓋。先下載原始檔，再選擇匯入可用備份或重新開始。</p><div class="inline">${button('下載原始資料', 'raw-backup', 'button primary')}${button('匯入備份', 'import', 'button quiet')}${button('重新開始', 'reset', 'button quiet')}</div></section>`;
}
function guideBar() {
  if (!training || ui.step === 3) return '';
  if (!ui.step) return '';
  const g = GUIDE_STEPS[ui.step - 1], done = training.done.has(ui.step);
  const customDirection = ui.step === 4 && ui.routeTheme && ui.routeTheme !== 'demo-space';
  return `<section class="guide-bar" aria-label="操作引導"><div class="guide-progress"><span aria-label="第 ${ui.step} 步，共 6 步">${ui.step} / 6</span><div>${GUIDE_STEPS.map((_, i) => `<button type="button" class="guide-dot ${i + 1 === ui.step ? 'current' : ''}" data-action="go" data-step="${i + 1}" aria-label="示範第 ${i + 1} 步：${STEPS[i + 1][1]}" ${i + 1 === ui.step ? 'aria-current="step"' : ''}></button>`).join('')}</div></div><p class="guide-instruction" tabindex="-1">${esc(customDirection ? '為選定的方向寫出不同做法，比較資源和代價。' : g.text)}</p><div class="guide-actions">${button(customDirection ? '新增做法' : g.action, 'guide-task', 'button primary small')}<span class="guide-result" role="status">${done ? '已練習' : '可直接看下一步'}</span><div class="spacer"></div>${ui.step > 1 ? button('上一步', 'guide-back', 'text-button') : ''}${button(ui.step === 6 ? '結束示範' : '下一步', 'guide-next', 'button quiet small')}</div></section>`;
}
function highlightGuideTarget() {
  if (!training || !ui.step) return;
  const ids = ['demo-event-5', 'demo-event-5', 'demo-space', 'demo-route-1', 'guide-action', 'guide-action'];
  const target = $(`#main article [data-id="${ids[ui.step - 1]}"]`) || $(`#main [data-id="${ids[ui.step - 1]}"]`);
  const card = target?.closest('article, .month-cell') || target;
  card?.classList.add('guide-target');
}
function startGuide() {
  if ($('#editor').open) closeDialog();
  if (training) return go(1);
  const returnTo = { state, demo, key, lastRaw, unsaved, conflict, recovery, storeWarning,
    ui: { ...ui, eventSelection: new Set(ui.eventSelection), actionSelection: new Set(ui.actionSelection) }, discovery: discovery.snapshot() };
  training = { returnTo, done: new Set(), routeId: '' };
  discovery.reset();
  state = createGuideState(); demo = true; lastRaw = null; unsaved = false; conflict = false; recovery = ''; storeWarning = '';
  ui.eventSelection.clear(); ui.actionSelection.clear(); ui.routeTheme = ''; ui.view = 'graph'; ui.month = 6; ui.stress = false;
  go(1);
}
function exitGuide(beginPersonal = false) {
  if (!training) return;
  const prior = training.returnTo;
  if ($('#editor').open) closeDialog();
  training = null;
  ({ state, demo, key, lastRaw, unsaved, conflict, recovery, storeWarning } = prior);
  Object.assign(ui, prior.ui);
  discovery.restore(prior.discovery);
  // A second tab may have changed the saved workspace while the example was open.
  try { if (localStorage.getItem(key) !== lastRaw) conflict = true; } catch { /* Preserve the original storage warning. */ }
  if (conflict) storeWarning = '另一個分頁更新了資料。本頁暫停儲存，請先下載備份，再載入最新版本。';
  try { const url = new URL(location.href); url.searchParams.delete('guide'); history.replaceState({}, '', url); } catch { /* file: context */ }
  if (beginPersonal && demo && !unsaved) { switchWorkspace(false); go(1); }
  else go(beginPersonal && !recovery ? 1 : ui.step);
}
function finishGuide() {
  openDialog('示範結束', '', `<p>回到自己的紀錄，從一件事開始。</p>${button('開始我的回顧', 'guide-finish', 'button primary')}${button('繼續試玩', 'close-dialog', 'button quiet')}`);
}
function runGuideTask() {
  if (!training || !ui.step) return;
  const g = GUIDE_STEPS[ui.step - 1];
  state = prepareGuideStep(state, ui.step, training.routeId);
  if (g.form === 'event') {
    if (!state.events.some(e => e.id === g.target)) return toast('這張範例已刪除。可用其他卡片練習，或離開後重開示範。');
    eventDialog(g.target);
  }
  if (g.form === 'discovery') return go(3);
  if (g.form === 'choice') {
    const candidates = state.routes.filter(r => !ui.routeTheme || r.themeId === ui.routeTheme);
    const r = candidates.find(r => r.id === g.target) || candidates[0];
    if (!r) return routeDialog();
    choiceDialog(r);
  }
  if (g.form === 'node' || g.form === 'review') {
    const n = state.nodes.find(n => n.id === g.target) || state.nodes.find(n => n.type === 'action');
    if (!n) return toast('先新增一個行動，再練習回顧。');
    if (g.form === 'node') nodeDialog(n.id);
    else reviewDialog(n.id);
  }
  const field = $(`#editor [name="${g.field}"]`);
  if (field) { field.focus({ preventScroll: true }); field.scrollIntoView({ block: 'nearest', behavior: 'instant' }); }
}

function render() {
  const active = document.activeElement;
  const focusSelector = active?.dataset.eventSelect ? `[data-event-select="${active.dataset.eventSelect}"]`
    : active?.dataset.nodeSelect ? `[data-node-select="${active.dataset.nodeSelect}"]` : null;
  const views = [homeView, factsView, energyView, themesView, optionsView, plansView, reviewsView];
  $('#app').innerHTML = shell(views[ui.step]());
  highlightGuideTarget();
  if (focusSelector) $(focusSelector)?.focus({ preventScroll: true });
}
function go(step) {
  ui.step = Math.max(0, Math.min(6, number(step)));
  if (training) state = prepareGuideStep(state, ui.step, training.routeId);
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
  $('#page-title')?.focus({ preventScroll: true });
  $('.step.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
}

// Native dialogs keep touch, keyboard focus and Escape behavior consistent.
function field(label, name, value = '', { type = 'text', required = false, max = 2000, help = '', min, step, placeholder = '' } = {}) {
  return `<label class="field"><span>${label}${required ? ' <span class="required-mark">*</span>' : ''}</span><input name="${name}" type="${type}" value="${attr(value)}" ${required ? 'required' : ''} maxlength="${max}" ${min !== undefined ? `min="${min}"` : ''} ${type === 'number' ? `max="${max}"` : ''} ${step ? `step="${step}"` : ''} placeholder="${attr(placeholder)}">${help ? `<small>${help}</small>` : ''}</label>`;
}
function textarea(label, name, value = '', help = '', max = 2000, required = false) {
  return `<label class="field"><span>${label}${required ? ' <span class="required-mark">*</span>' : ''}</span><textarea name="${name}" rows="3" maxlength="${max}" ${required ? 'required' : ''}>${esc(value)}</textarea>${help ? `<small>${help}</small>` : ''}</label>`;
}
function selectField(label, name, value, choices, help = '') {
  return `<label class="field"><span>${label}</span><select name="${name}">${Object.entries(choices).map(([key, text]) => `<option value="${attr(key)}" ${value === key ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select>${help ? `<small>${help}</small>` : ''}</label>`;
}
function checkField(label, name, checked = false, value = 'yes') {
  return `<label class="check-field"><input type="checkbox" name="${name}" value="${attr(value)}" ${checked ? 'checked' : ''}><span>${label}</span></label>`;
}
function openDialog(title, subtitle, content, formType = '', entityId = '', footer = '', mode = '') {
  const dlg = $('#editor'); if (dlg.open) dlg.close();
  previousFocus = document.activeElement;
  dlg.dataset.mode = mode;
  dialogContext = { type: formType, id: entityId };
  dlg.innerHTML = `<div class="dialog-heading"><div><h2 id="dialog-title">${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div>${button(icon('close'), 'close-dialog', 'icon-button', 'aria-label="關閉對話框"')}</div>
    <form id="editor-form" data-form="${formType}"><div class="dialog-body"><p id="form-error" class="form-error" role="alert" tabindex="-1" hidden></p>${content}</div>
    <div class="dialog-footer">${footer}<div class="spacer"></div>${button(formType ? '取消' : '關閉', 'close-dialog', 'button quiet')}${formType ? `<button class="button primary" type="submit">${formType === 'confirm' ? '確認' : formType === 'import-confirm' ? '確認取代並匯入' : '儲存'}${icon('check')}</button>` : ''}</div></form>`;
  dlg.showModal();
}
function closeDialog() {
  $('#editor').close();
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  else $('#page-title')?.focus({ preventScroll: true });
}
function confirmDialog(title, body, action) {
  confirmAction = action; openDialog(title, '', `<div class="confirm-body">${body}</div>`, 'confirm');
}
// Origins remain single-choice data, rendered as keyboard-accessible tags.
function originTags(value) {
  return `<fieldset class="choice-fieldset origin-fieldset"><legend>這件事怎麼發生？</legend><div class="origin-choices">${Object.entries(ORIGINS).map(([key, label]) => `<label class="origin-choice"><input type="radio" name="origin" value="${attr(key)}" ${value === key ? 'checked' : ''}><span>${icon('check')}${esc(label)}</span></label>`).join('')}</div></fieldset>`;
}
function energyValue(value) { return value === null ? '—' : value > 0 ? `+${value}` : String(value); }
function energyMeaning(value) { return value === null ? '尚未評分' : value > 0 ? '較充電' : value < 0 ? '較耗損' : '沒有明顯偏向'; }
function syncEnergyControl(markRated = false) {
  const slider = $('#editor input[name="energy"]'), unrated = $('#editor input[name="unrated"]');
  if (!slider || !unrated) return;
  if (markRated) unrated.checked = false;
  const value = unrated.checked ? null : number(slider.value);
  $('#energy-output').textContent = energyValue(value);
  $('#energy-meaning').textContent = energyMeaning(value);
  $('#editor .energy-score-panel').dataset.score = value === null ? 'unrated' : value < 0 ? 'negative' : 'rated';
  slider.setAttribute('aria-valuetext', value === null ? '尚未評分；移動滑桿或選擇記為 0 分' : `${energyValue(value)} 分，${energyMeaning(value)}`);
}
function ratingSummary(e) {
  const hidden = e.private && ui.hidePrivate;
  const facts = hidden ? '' : e.facts;
  return `<section class="rating-summary" aria-label="片刻摘要（唯讀）">
    <div class="rating-summary-top"><div class="rating-summary-copy"><div class="rating-meta"><span class="eyebrow">${e.kind === 'background' ? '日常背景' : `${e.month} 月`}</span><span class="chip origin-tag" aria-label="發生方式：${attr(ORIGINS[e.origin])}">${esc(ORIGINS[e.origin])}</span>${e.private ? chip(`${icon('lock')}私密卡`, 'privacy-tag') : ''}</div><h3 title="${attr(titleOf(e))}">${esc(titleOf(e))}</h3></div>
    </div>
    ${hidden ? '<p class="rating-private-note">文字已遮蔽；可回探索桌切換顯示。</p>' : facts ? `<details class="rating-facts"><summary><span>${esc(facts)}</span><small>查看事實</small></summary><p>${esc(facts)}</p></details>` : '<p class="rating-empty-facts"></p>'}
  </section>`;
}
function eventDialog(entityId = '', month = ui.month, kind = 'event') {
  const old = state.events.find(e => e.id === entityId);
  const e = old || newEvent(month, state.events, kind);
  // Only existing cards in the reflective chapter have read-only facts.
  // New cards still need the full editor, even when added from the energy view.
  const scoring = ui.step === 2;
  const ratingOnly = Boolean(old && scoring);
  const facts = ratingOnly ? ratingSummary(e) : `<div class="form-grid">${field('月份', 'month', e.month, { type: 'number', min: 1, max: 12, required: true, step: 1 })}${scoring ? '' : field('月內順序', 'order', e.order, { type: 'number', min: 1, max: 3, required: true, step: 1, help: '同月的時間順序。' })}</div>
    ${field('事件名稱', 'title', e.title, { required: true, max: 120, placeholder: '例如：和老朋友一起吃了一頓晚餐' })}
    ${textarea('發生了什麼？', 'facts', e.facts, '可以留白。')}
    ${originTags(e.origin)}
    ${checkField('私密卡（遮蔽文字，非加密）', 'private', e.private)}`;
  const energy = `<section class="energy-form"><div class="energy-score-panel" data-score="${e.energy === null ? 'unrated' : e.energy < 0 ? 'negative' : 'rated'}">
    <div class="energy-score-heading"><div><h3>充電，或耗損？</h3><p class="micro">${state.frame === 'then' ? '回想當時' : '現在回看'}，這件事帶給你的能量。</p></div><div class="energy-readout"><output id="energy-output" for="event-energy" aria-label="能量分數" aria-live="polite" aria-atomic="true">${energyValue(e.energy)}</output><span id="energy-meaning">${energyMeaning(e.energy)}</span></div></div>
    <div class="energy-control"><span>−10<br><small>耗損</small></span><input id="event-energy" type="range" name="energy" min="-10" max="10" step="1" value="${e.energy ?? 0}" aria-label="事件能量" aria-describedby="energy-help"><span>+10<br><small>充電</small></span></div>
    <div class="energy-choices">${checkField('暫時不評分', 'unrated', e.energy === null)}${button('記為 0 分', 'zero-energy', 'text-button')}</div>
    <p id="energy-help" class="micro">移動滑桿即可評分；0 分與未評分不同。</p></div>
    ${scoring ? '' : `<fieldset class="choice-fieldset"><legend>感受（可多選）</legend><div class="check-chips">${FEELINGS.map(f => checkField(esc(f), 'feelings', e.feelings.includes(f), f)).join('')}</div></fieldset>
    ${field('其他感受', 'customFeelings', e.feelings.filter(f => !FEELINGS.includes(f)).join('、'), { max: 400, help: '以「、」分隔；情緒詞總共最多 12 個。' })}
    ${selectField('我能怎麼回應', 'influence', e.influence, INFLUENCES, '意外不等於不可控；有計畫也不代表結果都要由自己負責。')}
    ${checkField('這件事很重要', 'important', e.important)}`}</section>`;
  openDialog(ratingOnly ? '評分' : old ? '編輯事件' : kind === 'background' ? '新增日常' : '新增事件',
    ratingOnly ? '' : e.kind === 'background' ? '日常不占每月名額，也不連入曲線。' : '每月最多三張。',
    `${facts}${ui.step === 2 ? energy : `<details class="form-details"><summary>評分與感受（選填）</summary>${energy}</details>`}`, 'event', e.id,
    old && !ratingOnly ? button(`${icon('trash')}刪除`, 'delete-event', 'text-button danger', `data-id="${e.id}"`) : '', ratingOnly ? 'rating' : '');
  dialogContext.entity = e;
  dialogContext.ratingOnly = ratingOnly;
  dialogContext.scoring = scoring;
  syncEnergyControl();
}

function routeDialog(entityId = '', preset = null) {
  const r = state.routes.find(x => x.id === entityId) || preset || newRoute(ui.routeTheme);
  openDialog('編輯路線', '',
    `${selectField('支持哪個方向？', 'themeId', r.themeId, { '': '先不指定方向', ...Object.fromEntries(state.themes.map(t => [t.id, t.intention || t.label])) })}
    <div class="form-grid">${field('路線名稱', 'title', r.title, { required: true, max: 160 })}${selectField('做法', 'kind', r.kind, ROUTE_KINDS)}</div>
    ${textarea('期待效果', 'benefit', r.benefit)}${textarea('代價', 'cost', r.cost)}
    <div class="form-grid triple">${field('時間（小時／週）', 'hours', r.hours, { type: 'number', min: 0, max: 168, step: 0.25, required: true })}${field('金錢（元／月）', 'money', r.money, { type: 'number', min: 0, max: 100000000, step: 1, required: true })}${field('心力（點／週）', 'energy', r.energy, { type: 'number', min: 0, max: 100, step: 1, required: true })}</div>
    ${smallHelp('0 代表目前不配置該資源，不代表成本已被驗證。一次性支出請換算到每月並在代價欄註明。')}
    ${textarea('最小、可撤回的第一步', 'firstStep', r.firstStep)}<div class="form-grid">${textarea('最可能遇到的障礙', 'obstacle', r.obstacle)}${textarea('遇到它時，可以怎麼做？', 'fallback', r.fallback)}</div>
    ${field('目前的信心（0–10）', 'confidence', r.confidence, { type: 'number', min: 0, max: 10, step: 1, required: true })}
    ${r.selected ? textarea('目前選擇它的理由', 'reason', r.reason) : ''}`, 'route', r.id,
    entityId ? button(`${icon('trash')}刪除路線`, 'delete-route', 'text-button danger', `data-id="${r.id}"`) : '');
  dialogContext.entity = r;
}
function choiceDialog(r) {
  const tmp = clone(state); tmp.routes.find(x => x.id === r.id).selected = true; const budget = budgetUsage(tmp);
  const alternativeCount = state.routes.filter(x => x.themeId === r.themeId && x.id !== r.id).length;
  openDialog('選擇路線', esc(r.title),
    `${alternativeCount ? `<p>同一方向還有 ${alternativeCount} 條候選路線。它們不會因為這次選擇被刪掉。</p>` : '<p class="soft-warning">目前還沒有同一方向的替代方案。可以先選，但記得這不是唯一答案。</p>'}
    ${budget.over.length ? '<p class="soft-warning">選擇後會超出資源預算。可以保留這條候選，之後減量或取消其他路線。</p>' : ''}
    ${textarea('選擇理由', 'reason', r.reason, '', 2000, true)}
    ${textarea('什麼情況下我會換路、縮小或停止？', 'fallback', r.fallback)}`, 'choice', r.id);
}
function nodeDialog(entityId = '', type = 'action', parentId = '', preset = null, grouping = []) {
  const old = state.nodes.find(x => x.id === entityId);
  const n = old || preset || newNode(type, parentId);
  if (!old && !preset && parentId) {
    const parent = state.nodes.find(x => x.id === parentId); n.themeIds = [...(parent?.themeIds || [])]; n.routeId = parent?.routeId || '';
  }
  if (!old && n.type === 'result') { n.planType = 'outcome'; n.aggregation = 'latest'; n.period = 'once'; }
  const excluded = descendants(state.nodes, n.id);
  const parents = state.nodes.filter(x => x.type !== 'action' && !excluded.has(x.id) && (n.type !== 'objective' || x.type === 'objective'));
  const source = `${selectField('上層方向／成果', 'parentId', n.parentId, { '': '獨立放置（也可以之後向上聚類）', ...Object.fromEntries(parents.map(x => [x.id, x.title])) })}
    ${selectField('來自哪一條候選路線？', 'routeId', n.routeId, { '': '先不指定', ...Object.fromEntries(state.routes.map(x => [x.id, x.title + (x.selected ? '（已選）' : '（候選）')])) })}
    <fieldset class="choice-fieldset"><legend>支持哪些價值？可以多選。</legend><div class="check-chips">${state.themes.map(t => checkField(esc(t.value || t.label), 'themeIds', n.themeIds.includes(t.id), t.id)).join('') || '<span class="micro">還沒有主題也能先寫行動。</span>'}</div></fieldset>`;
  const quantitative = `<div class="form-grid">${selectField('行動種類', 'planType', n.planType, PLAN_TYPES)}${selectField('數量怎麼驗收？', 'comparator', n.comparator, { atLeast: '至少', atMost: '最多（上限／界線）', exactly: '恰好' })}</div>
    <div class="form-grid triple">${field('目標數量', 'target', n.target, { type: 'number', min: 0, max: 100000000, step: 0.1, required: true })}${field('單位', 'unit', n.unit, { max: 40, required: true })}${selectField('週期／頻率', 'period', n.period, PERIODS)}</div>
    ${selectField('紀錄如何計算？', 'aggregation', n.aggregation, { sum: '累加每次實際發生量（習慣／次數）', latest: '以本期最近一次完整讀值（成果／金額）' }, '例如加薪金額使用最近一次讀值，不把同一筆加薪重複相加。')}
    ${textarea('完成定義／驗收證據', 'acceptance', n.acceptance, '例如：完成 20 分鐘練習並記下一個觀察；只開影片不算。')}
    <div class="form-grid">${textarea('開始線索', 'trigger', n.trigger, '')}${textarea('忙碌時的縮小版本', 'minimum', n.minimum, '縮小版會另記，不冒充原本的完成量。')}</div>
    <div class="form-grid">${textarea('障礙', 'obstacle', n.obstacle)}${textarea('備案', 'fallback', n.fallback)}</div>
    ${textarea('需要誰或什麼支持？', 'support', n.support)}
    <div class="form-grid">${field('開始日期', 'startDate', n.startDate, { type: 'date' })}${field('約定回顧日期', 'reviewDate', n.reviewDate, { type: 'date' })}</div>`;
  openDialog(grouping.length ? '合併為方向' : n.type === 'objective' ? '編輯方向' : n.type === 'result' ? '編輯成果' : '編輯實驗',
    grouping.length ? `這會把選取的 ${grouping.length} 個行動移到新方向之下；原紀錄保留。` : '',
    `${field(n.type === 'objective' ? '方向 O' : n.type === 'result' ? '成果 KR' : '行動名稱', 'title', n.title, { required: true, max: 160 })}${source}
    ${n.type === 'objective' ? textarea('選擇理由', 'acceptance', n.acceptance) : quantitative}
    ${selectField('目前狀態', 'status', n.status, { draft: '草稿', active: '實驗中', paused: '暫停', done: '完成', stopped: '停止' })}`, 'node', n.id,
    old ? button(`${icon('trash')}刪除`, 'delete-node', 'text-button danger', `data-id="${n.id}"`) : '');
  dialogContext.entity = n; dialogContext.grouping = grouping;
}
function reviewDialog(nodeId, reviewId = '') {
  const n = state.nodes.find(x => x.id === nodeId); if (!n) return;
  const r = state.reviews.find(x => x.id === reviewId) || { id: uid(), nodeId, date: dateString(), amount: 1, mode: 'full', direction: 'unsure', note: '', decision: 'keep' };
  openDialog('記錄回顧', esc(n.title),
    `<div class="form-grid">${field('紀錄日期', 'date', r.date, { type: 'date', required: true })}${selectField('這次的執行', 'mode', r.mode, { full: '完整執行／實際讀值', minimum: '只做了縮小版本', missed: '未執行', reflection: '不記數量，只記反思' })}</div>
    ${field(n.aggregation === 'latest' ? `本次讀值（${esc(n.unit)}）` : `這次實際新增的量（${esc(n.unit)}）`, 'amount', r.amount, { type: 'number', min: 0, max: 100000000, step: 0.1, required: true, help: '不要重複記錄同一次執行；誤記可以編輯或刪除。未執行／純反思一律記 0。' })}
    ${selectField('它有支持我原本在乎的方向嗎？', 'direction', r.direction, { supports: '有，比較接近我在乎的生活', unsure: '還不確定，需要再看', drains: '更耗損，或與我想要的不同' })}
    ${textarea('我注意到什麼？', 'note', r.note, '')}
    ${selectField('接下來的決定', 'decision', r.decision, { keep: '維持', adjust: '調整（之後可編輯實驗）', reduce: '減量（之後可編輯目標量）', pause: '暫停', stop: '停止' }, '選暫停或停止會同步修改實驗狀態；調整／減量不擅自替你更改數字。')}`, 'review', r.id,
    reviewId ? button(`${icon('trash')}刪除紀錄`, 'delete-review', 'text-button danger', `data-id="${r.id}"`) : '');
  dialogContext.entity = r;
  $('#editor input[name="date"]').max = dateString();
  if (n.startDate) $('#editor input[name="date"]').min = n.startDate;
  $('#editor input[name="amount"]').disabled = ['missed', 'reflection'].includes(r.mode);
}
function settingsDialog() {
  openDialog('回顧設定', '',
    field('回顧年份', 'year', state.year, { type: 'number', min: 1900, max: 2200, step: 1, required: true, help: '這只修正本輪年度標籤，不會建立另一輪。開始新年度請先下載備份。' }) +
    selectField('能量評分的視角', 'frame', state.frame, { then: '回想事情當時的感受', now: '以現在回看的感受' }, '更換視角會保留事件，但清空所有能量評分，避免同一曲線混入兩種定義。情緒文字保留，請自行檢視。'), 'settings');
}
function dataDialog() {
  openDialog('把紀錄留在自己手裡', '本機儲存不會同步到其他裝置。清除瀏覽器資料可能遺失紀錄，請定期備份。',
    `<div class="data-options"><section><h3>${icon('download')}完整 JSON 備份</h3><p>包含所有事件、私密文字、主題、路線、實驗和回顧。這是跨裝置搬移或還原用的檔案，<strong>不是加密檔</strong>。</p>${button('下載完整備份（含私密內容）', 'export-json', 'button primary')}</section>
    <section><h3>${icon('upload')}從備份接著走</h3><p>先驗證格式，再確認取代。匯入不是合併；示範與正式探索桌仍然分開。</p>${button('選擇 JSON 備份', 'import', 'button quiet')}</section>
    <section><h3>${icon('wave')}年度資訊圖</h3><p>下載可縮放的 SVG，排除標為私密的事件。主題與行動中手寫的私人文字仍需自行檢查。</p>${button('預備下載探索地圖', 'export-map', 'button quiet')}</section>
    <section><h3>${icon('loop')}重新開一輪</h3><p>同一個探索桌目前只保留一輪。先下載備份，確認後才會清空。</p>${button('重新開始本桌', 'reset', 'text-button danger')}</section></div>
    <p class="micro">沒有登入、追蹤碼、AI 上傳或雲端資料庫。私密標記是畫面遮蔽，不是存取控制。直接開啟離線 HTML 時，儲存能力仍依瀏覽器而異。</p>`);
}
function aboutDialog() {
  openDialog('資料與隱私', '', `<div class="prose"><p>資料只存在這個瀏覽器，不會自動同步。清除網站資料可能刪掉紀錄，請定期備份。</p><p>私密標籤只遮蔽畫面，並非加密；完整 JSON 備份仍含私密文字。</p><p>可以跳過、停止或不新增目標。這是回顧工具，不是心理評量或治療。</p><p>示範使用虛構資料，不影響自己的回顧；重新整理會清除練習。</p>${button('跟著示範做', 'start-guide', 'button primary')}</div>`);
}
function download(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function exportJSON() { download(JSON.stringify(state, null, 2), `life-atlas-${demo ? 'demo-' : ''}${state.year}-${dateString()}.json`, 'application/json'); toast('已產生完整備份，請妥善保存私密內容。'); }
function svgLines(value, x, y, width = 35, size = 16, fill = '#334c43', maxLines = 4) {
  const chars = [...String(value || '')], lines = [];
  for (let i = 0; i < chars.length && lines.length < maxLines; i += width) lines.push(chars.slice(i, i + width).join(''));
  if (chars.length > width * maxLines) lines[lines.length - 1] += '…';
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}">${lines.map((line, i) => `<tspan x="${x}" dy="${i ? size * 1.5 : 0}">${esc(line)}</tspan>`).join('')}</text>`;
}
function exportMap() {
  const themes = state.themes.slice(0, 6), actions = state.nodes.filter(n => n.type === 'action').slice(0, 6);
  const h = 660 + Math.ceil(themes.length / 2) * 185 + actions.length * 142;
  const themesY = 645, actionsY = themesY + Math.ceil(themes.length / 2) * 185 + 55;
  const nested = timelineSvg(true).replace('<svg ', '<svg x="40" y="172" width="1120" height="385" ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 ${h + 140}" width="1200" height="${h + 140}" font-family="system-ui, -apple-system, sans-serif"><rect width="1200" height="${h + 140}" fill="#f6f5f0"/>
    <text x="56" y="60" font-size="16" letter-spacing="3" fill="#426e5f">LIFE ATLAS / ${state.year}</text><text x="56" y="116" font-size="40" fill="#1c3d32">拾起片刻，為生活留一個可能。</text>
    <text x="56" y="150" font-size="14" fill="#64766a">${state.frame === 'then' ? '回想當時的感受' : '現在回看的感受'} · ${demo ? '虛構示範' : '我的探索'} · 已排除 ${state.events.filter(e => e.private).length} 張私密事件</text>${nested}
    <text x="56" y="594" font-size="24" fill="#1c3d32">主題</text><text x="56" y="620" font-size="13" fill="#64766a">主題是假設，不是必須完成的任務。顯示前 6 個主題與前 6 個行動，完整內容請保留 JSON 備份。</text>
    ${themes.map((t, i) => { const x = 56 + i % 2 * 560, y = themesY + Math.floor(i / 2) * 185; return `<rect x="${x}" y="${y}" width="532" height="164" rx="15" fill="#e7ece0"/>${svgLines(t.label, x + 22, y + 36, 26, 22, '#1c3d32', 1)}${svgLines(t.intention || t.value || '還在探索', x + 22, y + 75, 31, 16, '#334c43', 3)}`; }).join('')}
    <text x="56" y="${actionsY - 20}" font-size="24" fill="#1c3d32">帶走的小實驗</text>
    ${actions.map((n, i) => { const y = actionsY + i * 142; return `<rect x="56" y="${y}" width="1088" height="124" rx="15" fill="#fffefa"/>${svgLines(n.title, 78, y + 34, 58, 20, '#1c3d32', 1)}${svgLines(`${PERIODS[n.period]}${({ atLeast: '至少', atMost: '最多', exactly: '恰好' })[n.comparator]} ${n.target} ${n.unit} · 回顧 ${n.reviewDate || '未設定'} · ${n.acceptance || '完成定義待補充'}`, 78, y + 67, 66, 15, '#334c43', 3)}`; }).join('')}
    <text x="56" y="${h + 96}" font-size="13" fill="#64766a">沒有高分人生。只記錄自己的選擇。　／　產生日期 ${dateString()}</text></svg>`;
  download(svg, `life-atlas-${state.year}-map.svg`, 'image/svg+xml');
}
function openImport() {
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
  input.addEventListener('change', async () => {
    const file = input.files?.[0]; if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('檔案超過 2 MB，未匯入。');
      const imported = parseBackup(await file.text()); pendingImport = imported;
      openDialog('這份備份可以讀取', '匯入會取代目前這個探索桌，不會合併。',
        `<p><strong>${imported.year} 年</strong> · ${imported.events.length} 張片刻 · ${imported.themes.length} 個主題 · ${imported.nodes.length} 個計畫 · ${imported.reviews.length} 筆回顧</p>
        <p>確認前可以先下載現在的紀錄。匯入目標：<strong>${demo ? '示範桌' : '個人探索桌'}</strong>。</p>${button('先下載目前的完整備份', recovery ? 'raw-backup' : 'export-json', 'button quiet')}`, 'import-confirm');
    } catch (error) { toast(error.message, true); }
  });
  input.click();
}
function switchWorkspace(nextDemo) {
  const perform = () => {
    demo = nextDemo; key = `life-atlas.v1.${demo ? 'demo' : 'personal'}`;
    const url = new URL(location.href); url.searchParams.delete('guide');
    if (demo) url.searchParams.set('demo', '1'); else url.searchParams.delete('demo');
    try { history.replaceState({}, '', url); } catch { /* Local file contexts may restrict URL replacement. */ }
    ui.eventSelection.clear(); ui.actionSelection.clear(); ui.routeTheme = ''; ui.step = demo ? 2 : 0;
    discovery.reset(); load(); render(); window.scrollTo({ top: 0, behavior: 'instant' });
  };
  if (unsaved) confirmDialog('有尚未儲存的變更', `<p>切換會捨棄本頁未儲存的內容，請先下載備份。</p>${button('下載備份', 'export-json', 'button quiet')}`, perform);
  else perform();
}
function askDelete(kind, entityId) {
  const n = state[kind].find(x => x.id === entityId); if (!n) return;
  let body = '<p>這會刪除這張卡。刪除前可以先下載 JSON 備份。</p>';
  if (kind === 'events') body += '<p>主題中的這張卡片關聯會移除，主題本身保留。</p>';
  if (kind === 'themes') body += '<p>已寫好的路線與實驗保留，只解除與這個主題的連結。</p>';
  if (kind === 'routes') body += '<p>已寫好的實驗保留，只解除與這條路線的連結。</p>';
  if (kind === 'nodes') {
    const ids = descendants(state.nodes, entityId);
    body += `<p><strong>包含 ${ids.size} 個計畫（本身與所有下層），以及 ${state.reviews.filter(r => ids.has(r.nodeId)).length} 筆相關回顧，都會一起刪除。</strong>只想暫停時，請改用計畫狀態。</p>`;
  }
  if (kind === 'reviews') body += '<p>紀錄會移除；已套用的暫停／停止狀態不會自動回復，需要自行編輯實驗。</p>';
  confirmDialog('確定刪除嗎？', body, () => {
    if (commit(removeEntity(state, kind, entityId), '已刪除')) { ui.eventSelection.delete(entityId); ui.actionSelection.delete(entityId); if (kind === 'themes' && ui.routeTheme === entityId) ui.routeTheme = ''; render(); }
  });
}
function submitForm(form) {
  const data = new FormData(form), ctx = dialogContext;
  const get = name => String(data.get(name) ?? '').trim();
  const all = name => data.getAll(name).map(String);
  const has = name => data.has(name);
  let success = false;
  if (ctx.type === 'confirm') { const fn = confirmAction; closeDialog(); confirmAction = null; fn?.(); return; }
  try {
    if (ctx.type === 'event') {
      // A rating form deliberately omits fact inputs. Preserve the original
      // metadata rather than replacing absent fields with blanks/defaults.
      const facts = ctx.ratingOnly ? {} : { month: number(get('month')), title: get('title'), facts: get('facts'), origin: get('origin'), private: has('private') };
      const feelings = ctx.scoring ? {} : { influence: get('influence'), important: has('important'),
        feelings: [...new Set([...all('feelings'), ...get('customFeelings').split(/[、,，]/).map(x => x.trim()).filter(Boolean)])] };
      const e = { ...ctx.entity, ...facts, ...feelings, order: has('order') ? number(get('order')) : ctx.entity.order,
        energy: has('unrated') ? null : number(get('energy')) };
      if (!e.title) throw new Error('請為這個片刻取一個名字，也可以只用代號。');
      success = commit(s => {
        const old = s.events.find(x => x.id === e.id);
        if (e.kind === 'event') {
          const others = s.events.filter(x => x.kind === 'event' && x.month === e.month && x.id !== e.id);
          if (others.length >= MAX_EVENTS_PER_MONTH) throw new Error(`${e.month} 月已放滿三張，請選別的月份或加入日常背景。`);
          const collision = others.find(x => x.order === e.order);
          if (collision) collision.order = old?.month === e.month ? old.order : [1, 2, 3].find(x => x !== e.order && !others.some(o => o.order === x));
        }
        const index = s.events.findIndex(x => x.id === e.id); if (index < 0) s.events.push(e); else s.events[index] = e;
        return s;
      }, '片刻已保存');
    }
    if (ctx.type === 'route') {
      const r = { ...ctx.entity, themeId: get('themeId'), title: get('title'), kind: get('kind'), benefit: get('benefit'), cost: get('cost'), firstStep: get('firstStep'), obstacle: get('obstacle'), fallback: get('fallback'),
        hours: number(get('hours')), money: number(get('money')), energy: number(get('energy')), confidence: number(get('confidence')), reason: has('reason') ? get('reason') : ctx.entity.reason };
      if (!r.title) throw new Error('請為這條路取個名字。');
      success = updateList('routes', r);
    }
    if (ctx.type === 'choice') {
      if (!get('reason')) throw new Error('留一句暫時選擇的理由。');
      success = commit(s => { const r = s.routes.find(x => x.id === ctx.id); r.selected = true; r.reason = get('reason'); r.fallback = get('fallback'); return s; }, '選擇已記錄；其他路線仍然保留');
    }
    if (ctx.type === 'node') {
      const n = { ...ctx.entity, title: get('title'), parentId: get('parentId'), routeId: get('routeId'), themeIds: all('themeIds'), acceptance: get('acceptance'), status: get('status') };
      if (!n.title) throw new Error('請寫下一個方向或行動的名字。');
      if (n.type !== 'objective') Object.assign(n, { planType: get('planType'), comparator: get('comparator'), target: number(get('target')), unit: get('unit'), period: get('period'), aggregation: get('aggregation'), trigger: get('trigger'), minimum: get('minimum'), obstacle: get('obstacle'), fallback: get('fallback'), support: get('support'), startDate: get('startDate'), reviewDate: get('reviewDate') });
      success = commit(s => { const i = s.nodes.findIndex(x => x.id === n.id); if (i < 0) s.nodes.push(n); else s.nodes[i] = n;
        for (const id of ctx.grouping || []) { const item = s.nodes.find(x => x.id === id); if (item) item.parentId = n.id; } return s; }, '實驗已保存');
      if (success) ui.actionSelection.clear();
    }
    if (ctx.type === 'review') {
      const mode = get('mode'), n = state.nodes.find(x => x.id === ctx.entity.nodeId), recordDate = get('date');
      if (recordDate > dateString()) throw new Error('實際紀錄不能放在未來。');
      if (n.startDate && recordDate < n.startDate) throw new Error('紀錄日期早於實驗開始日；請先調整實驗日期。');
      const r = { ...ctx.entity, date: recordDate, mode, amount: ['missed', 'reflection'].includes(mode) ? 0 : number(get('amount')), direction: get('direction'), note: get('note'), decision: get('decision') };
      success = commit(s => { const i = s.reviews.findIndex(x => x.id === r.id); if (i < 0) s.reviews.push(r); else s.reviews[i] = r;
        if (r.decision === 'pause' || r.decision === 'stop') s.nodes.find(x => x.id === r.nodeId).status = r.decision === 'pause' ? 'paused' : 'stopped'; return s; }, '回顧已保存');
    }
    if (ctx.type === 'budget') success = commit(s => { s.budget = { hours: number(get('hours')), money: number(get('money')), energy: number(get('energy')) }; return s; }, '資源預算已更新');
    if (ctx.type === 'settings') {
      const year = number(get('year')), frame = get('frame');
      if (frame !== state.frame && state.events.some(e => e.energy !== null)) {
        closeDialog(); confirmDialog('更換視角，需要重新評分', '<p>事件與筆記會保留；所有能量分數會清空，避免混用「當時」與「現在」兩種定義。</p>', () => commit(s => { s.year = year; s.frame = frame; s.events.forEach(e => e.energy = null); return s; }, '已更換視角，請重新看看能量')); return;
      }
      success = commit(s => { s.year = year; s.frame = frame; return s; }, '探索設定已更新');
    }
    if (ctx.type === 'decision' || ctx.type === 'options-skip') success = commit(s => { s[ctx.type === 'decision' ? 'decision' : 'optionsSkipReason'] = get('note'); return s; }, '你的決定已留下');
    if (ctx.type === 'import-confirm') {
      if (!pendingImport) throw new Error('沒有待匯入的備份。');
      if (conflict) throw new Error('另一個分頁有更新。請先下載本頁備份，再載入最新資料後重試。');
      // Preserve the previous valid/raw snapshot before replacing it; no partial import.
      try { if (lastRaw) localStorage.setItem(`${key}.previous`, lastRaw); } catch { throw new Error('無法保存取代前快照。請先下載原始備份並釋放儲存空間後重試。'); }
      recovery = ''; success = commit(pendingImport, '已完整匯入備份');
      if (success) { pendingImport = null; discovery.reset(); ui.eventSelection.clear(); ui.actionSelection.clear(); ui.routeTheme = ''; }
    }
    if (success) {
      if (training && GUIDE_STEPS[ui.step - 1]?.form === ctx.type) {
        training.done.add(ui.step);
        if (ctx.type === 'choice') training.routeId = ctx.id;
      }
      closeDialog(); if (ctx.type === 'node' && ui.step === 4) go(5); else render();
      if (training) { $('.guide-instruction')?.focus({ preventScroll: true }); $('.guide-bar')?.scrollIntoView({ block: 'start', behavior: 'instant' }); } }
  } catch (error) { showFormError(error.message); }
}
function handleAction(action, el) {
  const id = el.dataset.id || '';
  if (action.startsWith('d-')) return discovery.action(action, el);
  if (action === 'start-guide' || action === 'switch-demo') return startGuide();
  if (action === 'guide-exit') return exitGuide();
  if (action === 'guide-finish') return exitGuide(true);
  if (action === 'guide-task') return runGuideTask();
  if (action === 'guide-next') return ui.step >= 6 ? finishGuide() : go(Math.max(1, ui.step + 1));
  if (action === 'guide-back') return go(Math.max(1, ui.step - 1));
  if (training && ['data', 'import', 'reset', 'reload-storage', 'settings'].includes(action)) return toast('先離開示範，再操作自己的資料。');
  if (action === 'go') return go(el.dataset.step);
  if (action === 'home') return go(0);
  if (action === 'close-dialog') return closeDialog();
  if (action === 'switch-personal') return training ? exitGuide() : switchWorkspace(false);
  if (action === 'privacy') { ui.hidePrivate = !ui.hidePrivate; render(); return toast(ui.hidePrivate ? '私密卡文字已遮蔽' : '私密卡文字已顯示，請留意旁人與投影畫面。'); }
  if (action === 'settings') return settingsDialog();
  if (action === 'data') return dataDialog();
  if (action === 'about') return aboutDialog();
  if (action === 'add-event') return eventDialog('', number(el.dataset.month || ui.month));
  if (action === 'add-background') return eventDialog('', 1, 'background');
  if (action === 'edit-event') return eventDialog(id);
  if (action === 'zero-energy') { const slider = $('#editor input[name="energy"]'); if (slider) { slider.value = '0'; syncEnergyControl(true); } return; }
  if (action === 'view-graph' || action === 'view-list') { ui.view = action === 'view-graph' ? 'graph' : 'list'; render(); return; }
  if (action === 'month') { ui.month = number(el.dataset.month); render(); return; }
  if (action === 'theme-options') { ui.routeTheme = id; return go(4); }
  if (action === 'add-route') {
    const theme = state.themes.find(t => t.id === ui.routeTheme);
    if (theme && !theme.intention.trim()) { $('#discovery-direction-input')?.focus(); return toast('寫下方向，再比較做法。'); }
    return routeDialog();
  }
  if (action === 'edit-route') return routeDialog(id);
  if (action === 'draw-prompt') { ui.prompt = (ui.prompt + 1) % PROMPTS.length; render(); return; }
  if (action === 'observe-route') return routeDialog('', { ...newRoute(ui.routeTheme), title: '先不改變，觀察兩週', kind: 'keep', firstStep: '留下一句今天的觀察', benefit: '先確認什麼真正重要，再決定是否改變' });
  if (action === 'select-route') {
    const r = state.routes.find(x => x.id === id); if (!r) return;
    if (r.selected) return commit(s => { s.routes.find(x => x.id === id).selected = false; return s; }, '已取消選擇，候選路線仍保留');
    return choiceDialog(r);
  }
  if (action === 'budget') return openDialog('為想做的事，保留真實的容量', '只計入扣除生活必要開銷後，願意分配給這輪實驗的資源。',
    field('每週可用時間（小時）', 'hours', state.budget.hours, { type: 'number', min: 0, max: 168, step: 0.25, required: true }) +
    field('每月可用金錢（元）', 'money', state.budget.money, { type: 'number', min: 0, max: 100000000, step: 1, required: true }) +
    field('每週心力籌碼（點）', 'energy', state.budget.energy, { type: 'number', min: 0, max: 100, step: 1, required: true, help: '這只是自己的粗略估計，可以隨時調整。' }), 'budget');
  if (action === 'options-skip' || action === 'decision') return openDialog(action === 'decision' ? '寫下我現在的決定' : '先不比較，也留下選擇的理由', '不新增、先觀察、停止或求助，都可以。', textarea('現在的我想說……', 'note', action === 'decision' ? state.decision : state.optionsSkipReason), action);
  if (action === 'route-plan') {
    const r = state.routes.find(x => x.id === id); if (!r) return;
    const n = { ...newNode('action'), title: r.firstStep || r.title, routeId: r.id, themeIds: r.themeId ? [r.themeId] : [], obstacle: r.obstacle, fallback: r.fallback };
    return nodeDialog('', 'action', '', n);
  }
  if (action === 'add-objective') return nodeDialog('', 'objective');
  if (action === 'add-action') return nodeDialog();
  if (action === 'edit-node') return nodeDialog(id);
  if (action === 'child-action') return nodeDialog('', 'action', id);
  if (action === 'child-result') return nodeDialog('', 'result', id);
  if (action === 'group-actions') return nodeDialog('', 'objective', '', null, [...ui.actionSelection]);
  if (action === 'log-node') return reviewDialog(id);
  if (action === 'edit-review') { const r = state.reviews.find(x => x.id === id); if (r) return reviewDialog(r.nodeId, r.id); }
  const removals = { 'delete-event': 'events', 'delete-theme': 'themes', 'delete-route': 'routes', 'delete-node': 'nodes', 'delete-review': 'reviews' };
  if (removals[action]) return askDelete(removals[action], id);
  if (action === 'export-json') return exportJSON();
  if (action === 'raw-backup') return download(lastRaw || '', `life-atlas-original-${dateString()}.json`, 'application/json');
  if (action === 'import') return openImport();
  if (action === 'export-map') return confirmDialog('下載前，檢查分享的界線', '<p>資訊圖會排除標記為私密的事件，但<strong>主題、方向與行動裡的手寫文字仍會包含</strong>。請先檢查是否能分享；最多顯示前 6 個主題、前 6 個行動。</p>', exportMap);
  if (action === 'reload-storage') return confirmDialog('載入其他分頁的最新版本', `<p>本頁尚未儲存的變更會被捨棄。請先下載備份。</p>${button('下載本頁備份', 'export-json', 'button quiet')}`, () => { load(); render(); });
  if (action === 'reset') return confirmDialog('重新開一輪探索', `<p>會清空目前${demo ? '示範桌' : '個人探索桌'}，不影響另一張桌。請先下載備份；此動作不能直接復原。</p>${button('先下載目前紀錄', recovery ? 'raw-backup' : 'export-json', 'button quiet')}`, () => {
    if (conflict) return toast('其他分頁有更新，請先載入最新版本。', true);
    try { if (lastRaw) localStorage.setItem(`${key}.previous`, lastRaw); } catch { return toast('無法保存取代前快照，請先下載備份並釋放儲存空間。', true); }
    recovery = ''; ui.eventSelection.clear(); ui.actionSelection.clear(); ui.routeTheme = ''; if (commit(blankState(), '已開始新一輪')) go(0);
  });
}
const discovery = createDiscovery({
  esc, icon, button, getState: () => state, hidePrivate: () => ui.hidePrivate,
  training: () => !!training, isDiscovery: () => ui.step === 3,
  commit, render, toast, openDialog, closeDialog,
  practiced: () => { if (training) training.done.add(3); },
  deleteTheme: id => askDelete('themes', id),
  options: id => { ui.routeTheme = id; go(4); },
  practice: mode => { startGuide(); discovery.reset(mode); go(3); }
});

installMonthOrdering({
  announce: message => toast(message),
  move(eventId, targetIndex, expectedIds) {
    if (ui.step !== 2 || $('#editor').open) return false;
    const event = state.events.find(e => e.id === eventId);
    if (!event || event.kind !== 'event') return false;
    const currentIds = sortedEvents(state.events).filter(e => e.month === event.month).map(e => e.id);
    if (currentIds.join('|') !== expectedIds.join('|')) { toast('卡片已變更，請重新排序。'); return false; }
    return commit(s => { s.events = reorderMonthlyEvents(s.events, eventId, targetIndex); return s; }, '月內順序已更新');
  }
});
document.addEventListener('click', event => {
  const el = event.target.closest('[data-action]'); if (!el || el.disabled) return;
  event.preventDefault(); handleAction(el.dataset.action, el);
});
document.addEventListener('keydown', event => {
  const el = event.target.closest('g[data-action]');
  if (el && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); handleAction(el.dataset.action, el); }
});
document.addEventListener('submit', event => { if (event.target.id === 'editor-form') { event.preventDefault(); submitForm(event.target); } });
document.addEventListener('input', event => {
  const el = event.target;
  if (el.name === 'energy' && el.type === 'range') syncEnergyControl(true);
});
document.addEventListener('change', event => {
  const el = event.target;
  if (el.dataset.eventSelect) { el.checked ? ui.eventSelection.add(el.dataset.eventSelect) : ui.eventSelection.delete(el.dataset.eventSelect); render(); }
  if (el.dataset.nodeSelect) { el.checked ? ui.actionSelection.add(el.dataset.nodeSelect) : ui.actionSelection.delete(el.dataset.nodeSelect); render(); }
  if (el.id === 'route-filter') { ui.routeTheme = el.value; render(); }
  if (el.id === 'stress-toggle') { ui.stress = el.checked; render(); }
  if (el.id === 'review-date') { if (el.value && el.value <= dateString()) { ui.reviewDate = el.value; render(); } }
  if (el.name === 'unrated') syncEnergyControl();
  if (el.name === 'mode') { const input = $('#editor input[name="amount"]'); input.disabled = ['missed', 'reflection'].includes(el.value); if (input.disabled) input.value = 0; }
  if (el.name === 'planType') {
    const cmp = $('#editor select[name="comparator"]'), agg = $('#editor select[name="aggregation"]'), period = $('#editor select[name="period"]');
    if (el.value === 'boundary') { cmp.value = 'atMost'; agg.value = 'sum'; }
    else if (el.value === 'outcome') { agg.value = 'latest'; period.value = 'once'; }
    else { cmp.value = 'atLeast'; agg.value = 'sum'; }
  }
});
window.addEventListener('storage', event => {
  if (training) {
    if (event.key === training.returnTo.key && event.newValue !== training.returnTo.lastRaw) training.returnTo.conflict = true;
    return;
  }
  if (event.key === key && event.newValue !== lastRaw) {
    conflict = true; storeWarning = '另一個分頁更新了探索桌。本頁已暫停儲存，請先下載本頁備份，再載入最新版本。'; render();
  }
});
window.addEventListener('beforeunload', event => { if (unsaved || training?.returnTo.unsaved || discovery.hasDrafts()) { event.preventDefault(); event.returnValue = ''; } });
if (new URLSearchParams(location.search).get('guide') === '1') {
  startGuide();
  const params = new URLSearchParams(location.search), step = Number(params.get('step'));
  if (step >= 1 && step <= 6) {
    discovery.reset(params.get('method') === 'group' ? 'group' : 'binary');
    go(step);
  }
} else render();
