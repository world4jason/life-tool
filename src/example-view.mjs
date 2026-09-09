import { EXAMPLE, EXAMPLE_STEPS, exampleMetrics } from './complete-example.mjs?v=example-5';

/** Presentation only: the real application still renders and edits every chapter. */
export function createExampleView({ esc, button, icon }) {
  const go = (text, step, cls = 'button quiet') => button(text, 'go', cls, `data-step="${step}"`);
  function overview(state) {
    const m = exampleMetrics(state);
    const summaries = [
      [`${m.events} 件事`, `十二個月份，另有 ${m.background} 張日常。`],
      [`${m.scored} 張已評分`, '高點、低點與零分都已填好。'],
      [`${m.binary} 個詞 · ${m.groups} 群`, '比較二分類與分群的不同結果。'],
      [`${m.selected}／${m.routes} 條已選`, `目前合計 ${m.usage.totals.hours} 小時／週、${m.usage.totals.money.toLocaleString('zh-TW')} 元／月。`],
      [`${m.actions} 個行動`, '含成果、習慣與上限的驗收。'],
      [`${m.logs} 筆回顧`, '含完成、縮小版、未執行與零杯。']
    ];
    return `<section class="case-overview"><div class="case-intro"><span class="case-badge">完整範例 · 虛構資料</span><h1 id="page-title" tabindex="-1">${EXAMPLE.title}</h1><p>一位上班族回顧 2025 年，發現旅行與練舞是高點，加班和排滿行程是低點。2026 年 1 月，用兩週試著把時間留回生活。</p><div class="case-entry">${go('看年度曲線', 2, 'button primary')}${button('操作練習', 'start-guide', 'button quiet')}${button('回到我的回顧', 'guide-exit', 'text-button')}</div></div>
      <section class="case-story" aria-label="案例的前後關係"><div><span>經驗</span><h2>旅行 +9<br>加班 −7</h2><p>得到選擇與失去選擇，都與「自由」有關。</p></div><span class="case-connector" aria-hidden="true">→</span><div><span>選擇</span><h2>保留兩個晚上<br>每次一小時</h2><p>不是增加旅行次數，而是把選擇權放回日常。</p></div><span class="case-connector" aria-hidden="true">→</span><div><span>原案結果</span><h2>第二週完成一次<br>縮小版一次</h2><p>不把縮小版算成完整完成；調整安排，不追補次數。</p></div></section>
      <div class="case-sequence" aria-label="完整案例流程">${EXAMPLE_STEPS.map((step, i) => `<button type="button" data-action="go" data-step="${i + 1}" class="case-stage"><span class="case-number">${i + 1} · ${step.title}</span><strong>${summaries[i][0]}</strong><span>${summaries[i][1]}</span>${icon('arrow')}</button>`).join('')}</div>
      <p class="case-disclaimer">分數、預算與選擇是案例設定，不是建議目標。可試改，離開後不保留。${state.revision ? '目前已試改；下方說明保留原案。' : ''}</p>
      <div class="case-downloads">${button('下載案例 JSON', 'example-export', 'button quiet')}${button('還原範例', 'example-reset', 'text-button')}</div></section>`;
  }
  function bar(step, state) {
    if (!step) return '';
    const s = EXAMPLE_STEPS[step - 1];
    return `<aside class="case-guide" aria-label="範例導覽"><div class="case-guide-top">${go('案例總覽', 0, 'text-button')}<span>${step}／6 · ${s.title}${state.revision ? ' · 已試改' : ''}</span><div>${step > 1 ? go('上一頁', step - 1, 'button quiet small') : ''}${step < 6 ? go('下一頁', step + 1, 'button primary small') : button('回到我的回顧', 'guide-exit', 'button primary small')}</div></div><p>${esc(s.text)}</p><details><summary>為什麼這樣填？</summary><p>${esc(s.why)}</p>${state.revision ? '<p>這段解說是原案；畫面數值反映本次試改。</p>' : ''}</details>${step === 6 ? `<div class="case-review-dates"><span>案例檢視日</span>${button('第一週 · 1/11', 'example-week', 'button quiet small', `data-date="${EXAMPLE.firstReview}"`)}${button('第二週 · 1/18', 'example-week', 'button quiet small', `data-date="${EXAMPLE.review}"`)}</div>` : ''}</aside>`;
  }
  return { overview, bar };
}
