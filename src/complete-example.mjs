import { blankState, newEvent, newTheme, newRoute, newNode, validateState, budgetUsage, progressFor } from './domain.mjs?v=discovery-3';

/** Authored fictional case. Dates are fixed so the outcome does not disappear next week. */
export const EXAMPLE = Object.freeze({ year: 2025, start: '2026-01-05', review: '2026-01-18', firstReview: '2026-01-11', title: '把時間留回生活' });
export const EXAMPLE_STEPS = [
  { title: '事件', text: '十二個月已放入事件。旅行、加班與日常都保留，不只記成功的事。', why: '六月有「出發前趕工」與「旅行」兩張卡：同一個月可以有相反的經驗。日常另放，不占每月三張名額。' },
  { title: '能量', text: '旅行 +9、臨時加班 −7、牙齒檢查 0。分數是這位角色的感受，不是標準答案。', why: '零分是已評分，不是漏填。這裡只看能量與時間順序，不要求情緒標籤。拖曳月內順序不改能量。' },
  { title: '分類', text: '「自由」已分完有關／無關；「分群」另有留白、陪伴、身體三群。', why: '旅行得到選擇，加班失去選擇，兩者都被分為與「自由」有關。這不是正負分類。群組可以重疊，也不靠張數決定優先順序。' },
  { title: '做法', text: '原案選擇空白晚上與舞蹈課：每週 5 小時、每月 1,600 元、每週 5 點心力。', why: '每週可用 6 小時、每月 3,000 元、每週 8 點心力。短旅行占用連續時間，健身房增加準備負擔，所以留作候選。時間減半時，原案會超出每週 3 小時，需要減量或換路。' },
  { title: '行動', text: '原案每週留兩晚、跳舞兩次，寫好完成定義、觸發時機、縮小版與回顧日。', why: '方向是取回選擇權，不是累積更多待辦。每次空白晚上留一小時；舞蹈課連交通每次一個半小時。手搖飲是上限示例，不另占活動時間。' },
  { title: '回顧', text: '原案第二週：空白晚上 1／2 次、縮小版 1 次；跳舞 1／2 次、未執行 1 次。', why: '兩週合計有三個完整空白晚上，達成原定階段成果；第二週習慣頻率仍未達標。舞蹈有一次完成卻感到耗損，因此下一輪要調整時段，而不是只追次數。' }
];

export function createCompleteExample() {
  const s = blankState(EXAMPLE.year);
  s.id = 'complete-example-2025'; s.updatedAt = '2026-01-18T12:00:00.000Z'; s.revision = 0;
  const entries = [
    [1, '下班繞路散步', 4, 'planned', '每週二下班繞公園走二十分鐘，沒有接著處理工作。'],
    [2, '朋友臨時約吃飯', 7, 'surprise', '很久沒見的朋友來附近，聊到餐廳打烊。'],
    [3, '週末臨時加班', -7, 'surprise', '三個交付撞在同一週，取消了原定休息。'],
    [3, '一起完成交付', 3, 'mixed', '同事分走一部分工作，週一準時交付。'],
    [4, '第一次上陶藝課', 6, 'planned', '花兩小時做了一個歪杯子，專注在手上的材料。'],
    [4, '固定牙齒檢查', 0, 'planned', '按預約完成檢查，生活安排沒有明顯改變。'],
    [5, '週末答應太多邀約', -4, 'mixed', '連續三場聚會，沒有留下想獨處的時間。'],
    [6, '出發前趕完工作', -5, 'mixed', '為了旅行，把交付集中在出發前一週。'],
    [6, '沒有排滿的旅行', 9, 'planned', '留下兩天在城市裡走走，行程由當天決定。'],
    [7, '和朋友固定練舞', 7, 'planned', '開始每週一起上課，課後也能聊天。'],
    [7, '排課超過負荷', -3, 'planned', '一週排了四堂課，回家太晚，隔天疲倦。'],
    [8, '合作臨時取消', -5, 'surprise', '期待的合作沒有繼續，一段時間不知道如何安排。'],
    [9, '重新談工作界線', 4, 'planned', '和同事約定晚上非急件隔天回覆。'],
    [9, '陪家人散步', 6, 'surprise', '臨時提議到河邊走走，邊走邊聊天。'],
    [10, '活動裡認識新朋友', 8, 'surprise', '參加小型活動，遇到喜歡相同音樂的人。'],
    [11, '取消一項固定承諾', 6, 'planned', '退出不再想參加的活動，把週末留下來。'],
    [11, '待在家的空白晚上', 5, 'planned', '沒有補工作，煮飯、聽音樂，沒有安排成果。'],
    [12, '和重要的人吃晚餐', 8, 'planned', '約好不趕時間，分享今年發生的事。']
  ];
  for (const [i, [month, title, energy, origin, facts]] of entries.entries()) {
    s.events.push({ ...newEvent(month, s.events), id: `case-event-${i + 1}`, title, facts, energy, origin });
  }
  s.events.push({ ...newEvent(1, [], 'background'), id: 'case-commute', title: '每天通勤一小時', facts: '一週五天；尖峰時段擁擠，回家需要緩一緩。', energy: -3, origin: 'planned' });
  s.events.push({ ...newEvent(1, [], 'background'), id: 'case-drink', title: '下班習慣買手搖飲', facts: '常在回家路上買一杯，短暫放鬆，但不是每次都真的想喝。', energy: 1, origin: 'mixed' });
  const ids = numbers => numbers.map(n => typeof n === 'number' ? `case-event-${n}` : n);
  function theme(id, label, method, related, value, intention, color) {
    const t = { ...newTheme(), id, label, method, eventIds: ids(related), value, intention, color, stance: 'keep',
      counterExample: '不是每張卡都需要同一種解讀。', alternate: '同一件事也可能涉及陪伴、責任或休息。' };
    if (method === 'binary') t.unrelatedEventIds = s.events.filter(e => !t.eventIds.includes(e.id)).map(e => e.id);
    s.themes.push(t);
  }
  theme('case-freedom', '自由', 'binary', [1,3,5,7,8,9,11,12,13,16,17,'case-commute'], '自主', '每週保留能自己決定的時間，不再全部被工作與邀約占滿。', 'teal');
  theme('case-connection', '連結', 'binary', [2,4,7,10,14,15,18], '陪伴', '保留有交流的相處，不靠增加聚會數量證明關係。', 'coral');
  theme('case-space-group', '留白', 'group', [3,5,7,8,9,12,13,16,17,'case-commute'], '自主', '把空間留回自己，也容許沒有安排的晚上。', 'sage');
  theme('case-company-group', '陪伴', 'group', [2,4,7,10,14,15,18], '連結', '用負擔得起的方式維持相處。', 'coral');
  theme('case-body-group', '身體', 'group', [1,6,10,11,14,'case-commute','case-drink'], '身體感與表達', '讓跳舞回到生活，同時保留睡眠與恢復。', 'purple');
  s.budget = { hours: 6, money: 3000, energy: 8 };
  function route(id, themeId, fields) { const r = { ...newRoute(themeId), id, ...fields }; s.routes.push(r); return r; }
  route('case-empty-evenings', 'case-freedom', { title: '每週保留兩個空白晚上', kind: 'less', hours: 2, money: 0, energy: 2, confidence: 8, selected: true,
    benefit: '每週有兩小時不被工作占用，活動由自己決定。', cost: '不接兩個時段的額外邀約；可能需要和同事協商。', firstStep: '週日打開行事曆，保留週三與週五各一小時。', obstacle: '臨時加班或朋友邀約。', fallback: '當晚保留三十分鐘並記為縮小版；下一輪改時段。', reason: '不增加支出、容易撤回，能回應旅行與空白晚上帶來的自主感。' });
  route('case-short-travel', 'case-freedom', { title: '每月安排兩次半日出走', kind: 'different', hours: 3, money: 2400, energy: 3, confidence: 6,
    benefit: '離開工作環境，自己決定行程。', cost: '每次約六小時含交通；每月兩次，約十二小時，以四週估算每週三小時。', firstStep: '選兩個可用週末，查交通與花費。', obstacle: '需要連續空檔，雨天可能取消。', fallback: '改成附近一小時散步。', reason: '保留候選：比空白晚上需要更多連續時間與預算。' });
  route('case-drop-commitment', 'case-freedom', { title: '停止一項固定承諾', kind: 'pause', hours: 0.5, money: 0, energy: 1, confidence: 5,
    benefit: '降低每週被動答應事情的數量。', cost: '需要拒絕他人；半小時用於協商與檢查，不把省下時間算成負成本。', firstStep: '列出一項不再想繼續的活動，和相關的人說明。', obstacle: '擔心讓別人失望。', fallback: '改為暫停兩週後討論。', reason: '保留候選：先用空白晚上確認需要的界線，再決定退出哪件事。' });
  route('case-dance', 'case-body-group', { title: '每週兩次舞蹈課', kind: 'add', hours: 3, money: 1600, energy: 3, confidence: 8, selected: true,
    benefit: '恢復身體表達，也和熟悉的朋友相處。', cost: '每次六十分鐘課程加三十分鐘交通；每週兩次，每月八次共一千六百元。', firstStep: '預約週二與週四晚上的課，和朋友確認。', obstacle: '晚下班、回家時間太晚。', fallback: '在家跟音樂動十分鐘，另記縮小版；有疼痛或不適就停。', reason: '七月練舞與朋友相處都帶來能量；兩次比四次更容易保留恢復時間。' });
  route('case-gym', 'case-body-group', { title: '每週兩次健身房', kind: 'different', hours: 3, money: 1200, energy: 4, confidence: 5,
    benefit: '安排固定活動時間。', cost: '每次含交通一個半小時，每月一千二百元；需要自己規劃內容。', firstStep: '試用附近的健身房一次。', obstacle: '不熟悉器材，容易拖延。', fallback: '改成步行與伸展，不追趕訓練量。', reason: '保留候選：花費較低，但比舞蹈課更需要準備心力。' });
  route('case-walk', 'case-body-group', { title: '每週兩次下班散步', kind: 'keep', hours: 1, money: 0, energy: 1, confidence: 9,
    benefit: '延續一月散步帶來的放鬆。', cost: '兩次各三十分鐘；無額外課程費。', firstStep: '下班後從公園入口走一圈。', obstacle: '下雨或太累。', fallback: '改在住處附近走十分鐘，或休息。', reason: '保留為忙碌週的替代方案；目前想優先找回跳舞。' });
  function node(id, type, parentId, fields) {
    const n = { ...newNode(type, parentId), id, startDate: EXAMPLE.start, reviewDate: EXAMPLE.review, status: 'active', ...fields };
    s.nodes.push(n); return n;
  }
  const common = { minimum: '保留三十分鐘，另記縮小版。', obstacle: '臨時加班或邀約。', fallback: '不補做；回顧時調整時段。', support: '和同事約定非急件隔天回覆。' };
  node('case-o-space', 'objective', '', { themeIds: ['case-freedom','case-space-group'], routeId: 'case-empty-evenings', title: '取回晚上的選擇權', acceptance: '旅行與空白晚上是高點；想要的是選擇空間，不是再多一項任務。' });
  node('case-kr-space', 'result', 'case-o-space', { ...common, themeIds: ['case-freedom'], routeId: 'case-empty-evenings', title: '兩週有三個晚上不被工作占用', planType: 'outcome', aggregation: 'latest', target: 3, unit: '晚', period: 'once', acceptance: '行事曆與回顧中，有至少三晚保留一整小時，活動由自己決定。', trigger: '回顧日檢查兩週紀錄，填入不重複的完整晚上數。' });
  node('case-a-space', 'action', 'case-kr-space', { ...common, themeIds: ['case-freedom','case-space-group'], routeId: 'case-empty-evenings', title: '每週保留兩個空白晚上', target: 2, unit: '次', period: 'week', acceptance: '一次是一個完整小時，不補工作；做什麼由當天自己決定。', trigger: '週日看行事曆時，保留週三與週五 20:00–21:00。' });
  node('case-o-body', 'objective', '', { themeIds: ['case-body-group'], title: '讓跳舞回到生活', acceptance: '保留身體表達與陪伴，不用上課次數證明努力。' });
  node('case-a-dance', 'action', 'case-o-body', { themeIds: ['case-body-group','case-company-group'], routeId: 'case-dance', title: '每週跳舞兩次', target: 2, unit: '次', period: 'week', acceptance: '參與六十分鐘課程，記下課後是否有能量；身體不適可以停止。', trigger: '週二、週四下班後，帶著預先準備的衣服去上課。', minimum: '在家跟音樂動十分鐘，另記縮小版。', obstacle: '晚下班或課後太晚回家。', fallback: '改上較早的課；無法出門時用縮小版，不加堂補做。', support: '與朋友約同一堂課。' });
  node('case-a-drink', 'action', 'case-o-body', { themeIds: ['case-body-group'], title: '每週手搖飲最多一杯', planType: 'boundary', comparator: 'atMost', target: 1, unit: '杯', period: 'week', acceptance: '記錄全週實際杯數；明確記零杯才算有資料，沒有紀錄不視為達標。', trigger: '想買飲料時，確認這週已買幾杯。', minimum: '只記錄這次是否購買，不當作完成上限。', obstacle: '聚會或下班習慣性購買。', fallback: '超過就如實記錄，不以隔週禁喝補償。', support: '保留水壺，也允許自己依需要調整這條規則。' });
  const logs = [
    ['case-a-space','2026-01-07','full',1,'supports','把工作通知關掉，煮飯和聽音樂一小時。','keep'],
    ['case-a-space','2026-01-09','full',1,'supports','看書一小時，沒有把空白填成待辦。','keep'],
    ['case-a-space','2026-01-14','full',1,'supports','下班後散步，這段時間由自己決定。','keep'],
    ['case-a-space','2026-01-16','minimum',1,'supports','加班後只留三十分鐘；另記縮小版，不當完整一小時。','adjust'],
    ['case-kr-space','2026-01-18','full',3,'supports','核對 1/7、1/9、1/14 共三個完整晚上，不重複加總。','keep'],
    ['case-a-dance','2026-01-06','full',1,'supports','完成課程，和朋友一起練習很投入。','keep'],
    ['case-a-dance','2026-01-08','full',1,'drains','上完課卻太晚回家；次數達到，不代表安排適合。','adjust'],
    ['case-a-dance','2026-01-13','full',1,'supports','換較早的時段，回家還有時間休息。','keep'],
    ['case-a-dance','2026-01-15','missed',0,'unsure','晚下班，沒有上課，也沒有補做。','adjust'],
    ['case-a-drink','2026-01-11','full',1,'unsure','第一週全週紀錄：一杯。','keep'],
    ['case-a-drink','2026-01-18','full',0,'supports','第二週全週紀錄：零杯；不是漏填。','keep']
  ];
  s.reviews = logs.map(([nodeId,date,mode,amount,direction,note,decision], i) => ({ id: `case-review-${i + 1}`, nodeId,date,mode,amount,direction,note,decision }));
  s.decision = '空白晚上保留，但調整週五時段；舞蹈課改較早的班，不追補次數。兩週後再檢查。';
  return validateState(s);
}

export function exampleMetrics(state) {
  const usage = budgetUsage(state);
  const report = id => {
    const n = state.nodes.find(n => n.id === id);
    return n ? progressFor(n, state.reviews, EXAMPLE.review) : null;
  };
  return { events: state.events.filter(e => e.kind === 'event').length, background: state.events.filter(e => e.kind === 'background').length,
    scored: state.events.filter(e => e.energy !== null).length, binary: state.themes.filter(t => t.method === 'binary').length,
    groups: state.themes.filter(t => t.method !== 'binary').length, routes: state.routes.length,
    selected: state.routes.filter(r => r.selected).length, actions: state.nodes.filter(n => n.type === 'action').length,
    logs: state.reviews.length, usage, space: report('case-a-space'), dance: report('case-a-dance') };
}
