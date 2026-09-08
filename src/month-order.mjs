/** Move within one month only. Preserve IDs, metadata and the caller's array. */
export function reorderMonthlyEvents(events, eventId, targetIndex) {
  const event = events.find(e => e.id === eventId);
  if (!event || event.kind !== 'event') throw new Error('只能排列月份內的事件卡。');
  const month = events.filter(e => e.kind === 'event' && e.month === event.month)
    .toSorted((a, b) => a.order - b.order);
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= month.length)
    throw new Error('排序位置超出這個月份。');
  const from = month.findIndex(e => e.id === eventId);
  if (from === targetIndex) return events;
  month.splice(from, 1); month.splice(targetIndex, 0, event);
  const positions = new Map(month.map((e, i) => [e.id, i + 1]));
  return events.map(e => positions.has(e.id) ? { ...e, order: positions.get(e.id) } : e);
}

/** Pointer Events cover mouse, pen and touch; arrow buttons are the non-drag path.
 * Only the grip captures touch. Card text and surrounding space scroll normally.
 * Preview never mutates state; release within the original month commits once.
 */
export function installMonthOrdering({ move, announce }) {
  let drag = null, frame = 0, suppressClickUntil = 0;
  const cardsIn = list => [...list.querySelectorAll(':scope > [data-sort-id]')];
  const restoreFocus = id => document.querySelector(`[data-reorder-handle][data-id="${id}"]`)?.focus({ preventScroll: true });
  function clearMarkers(list) {
    list.classList.remove('is-sorting');
    list.querySelectorAll('.sort-before, .sort-after').forEach(el => el.classList.remove('sort-before', 'sort-after'));
  }
  function cleanup() {
    if (!drag) return null;
    const ended = drag; drag = null;
    cancelAnimationFrame(frame); frame = 0;
    ended.ghost?.remove(); ended.card.classList.remove('is-lifted'); clearMarkers(ended.list);
    if (ended.handle.hasPointerCapture?.(ended.pointerId)) ended.handle.releasePointerCapture(ended.pointerId);
    return ended;
  }
  function cancel() {
    const ended = cleanup();
    if (ended?.active) { suppressClickUntil = performance.now() + 350; announce('已取消排序'); restoreFocus(ended.id); }
  }
  function updatePreview() {
    const d = drag; if (!d?.active) return;
    if (!d.card.isConnected || document.querySelector('#editor[open]')) { cancel(); return; }
    const rect = d.list.getBoundingClientRect();
    d.valid = d.x >= rect.left && d.x <= rect.right && d.y >= rect.top && d.y <= rect.bottom;
    d.ghost.style.transform = `translate(${d.x - d.offsetX}px, ${d.y - d.offsetY}px)`;
    d.ghost.classList.toggle('invalid-drop', !d.valid);
    clearMarkers(d.list); d.list.classList.add('is-sorting');
    if (!d.valid) return;
    const others = cardsIn(d.list).filter(el => el !== d.card);
    const horizontal = getComputedStyle(d.list).gridTemplateColumns.trim().split(/\s+/).length > 1;
    d.list.dataset.sortAxis = horizontal ? 'x' : 'y';
    d.target = others.filter(el => {
      const r = el.getBoundingClientRect();
      return horizontal ? d.x > r.left + r.width / 2 : d.y > r.top + r.height / 2;
    }).length;
    if (d.target === d.from) return;
    const next = others[d.target];
    (next || others.at(-1))?.classList.add(next ? 'sort-before' : 'sort-after');
  }
  function tick() {
    if (!drag?.active) return;
    // Edge scroll also works on long, vertically stacked phone months.
    const edge = 72;
    const speed = drag.y < edge ? -Math.ceil((edge - drag.y) / 6)
      : drag.y > innerHeight - edge ? Math.ceil((drag.y - innerHeight + edge) / 6) : 0;
    if (speed) window.scrollBy(0, Math.max(-18, Math.min(18, speed)));
    updatePreview();
    if (drag?.active) frame = requestAnimationFrame(tick);
  }
  document.addEventListener('pointerdown', event => {
    const handle = event.target.closest('[data-reorder-handle]');
    if (!handle || handle.disabled || !event.isPrimary || event.button !== 0 || drag) return;
    const card = handle.closest('[data-sort-id]'), list = card?.parentElement;
    if (!list?.matches('[data-month-sort]') || document.querySelector('#editor[open]')) return;
    const cards = cardsIn(list); if (cards.length < 2) return;
    const rect = card.getBoundingClientRect();
    drag = { id: card.dataset.sortId, month: Number(list.dataset.monthSort), card, list, handle,
      ids: cards.map(el => el.dataset.sortId), from: cards.indexOf(card), target: cards.indexOf(card),
      pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      x: event.clientX, y: event.clientY, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top,
      active: false, valid: true, ghost: null };
    handle.setPointerCapture(event.pointerId);
  });
  document.addEventListener('pointermove', event => {
    const d = drag; if (!d || event.pointerId !== d.pointerId) return;
    d.x = event.clientX; d.y = event.clientY;
    if (!d.active && Math.hypot(d.x - d.startX, d.y - d.startY) < 7) return;
    event.preventDefault();
    if (!d.active) {
      d.active = true;
      d.ghost = d.card.cloneNode(true);
      d.ghost.removeAttribute('data-sort-id'); d.ghost.setAttribute('aria-hidden', 'true'); d.ghost.inert = true;
      d.ghost.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      d.ghost.classList.add('sort-ghost');
      d.ghost.style.width = `${d.card.getBoundingClientRect().width}px`;
      document.body.append(d.ghost); d.card.classList.add('is-lifted');
      announce('拖曳中，放開以調整月內順序。');
      frame = requestAnimationFrame(tick);
    }
    updatePreview();
  }, { passive: false });
  document.addEventListener('pointerup', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.x = event.clientX; drag.y = event.clientY; updatePreview();
    const ended = cleanup(); if (!ended?.active) return;
    event.preventDefault(); suppressClickUntil = performance.now() + 350;
    if (!ended.valid) announce('只能在同一月份排序');
    else if (ended.target !== ended.from) move(ended.id, ended.target, ended.ids);
    else announce('順序未變更');
    restoreFocus(ended.id);
  });
  document.addEventListener('pointercancel', event => { if (drag?.pointerId === event.pointerId) cancel(); });
  document.addEventListener('lostpointercapture', event => { if (drag?.pointerId === event.pointerId) cancel(); });
  window.addEventListener('blur', cancel);
  window.addEventListener('resize', cancel);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
  document.addEventListener('keydown', event => {
    if (drag && event.key === 'Escape') { event.preventDefault(); cancel(); return; }
    const handle = event.target.closest('[data-reorder-handle]'); if (!handle || handle.disabled) return;
    const list = handle.closest('[data-month-sort]'), cards = cardsIn(list), id = handle.dataset.id;
    const from = cards.findIndex(el => el.dataset.sortId === id);
    const target = { ArrowLeft: from - 1, ArrowUp: from - 1, ArrowRight: from + 1, ArrowDown: from + 1,
      Home: 0, End: cards.length - 1 }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    if (target < 0 || target >= cards.length || target === from) return;
    move(id, target, cards.map(el => el.dataset.sortId)); restoreFocus(id);
  });
  document.addEventListener('click', event => {
    if (event.detail > 0 && performance.now() < suppressClickUntil) {
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    const button = event.target.closest('[data-month-move]'); if (!button || button.disabled) return;
    const list = button.closest('[data-month-sort]'), cards = cardsIn(list), id = button.dataset.id;
    const from = cards.findIndex(el => el.dataset.sortId === id);
    const target = from + Number(button.dataset.monthMove);
    if (target < 0 || target >= cards.length) return;
    event.preventDefault();
    move(id, target, cards.map(el => el.dataset.sortId)); restoreFocus(id);
  }, true);
  return { cancel };
}
