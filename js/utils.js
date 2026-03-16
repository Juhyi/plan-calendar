// ── 상수 ──
const COLORS  = ["#0a0101","#9b59b6","#4f86f7","#f76b6b","#52c97a","#f5a623","#1abc9c","#e74c3c"];
const COLORS_WORK     = ["#2c3e50","#2980b9","#4f86f7","#1abc9c","#27ae60","#00b894","#0984e3","#74b9ff"];
const COLORS_PERSONAL = ["#fd79a8","#e17055","#d63031","#f5a623","#fdcb6e","#e91e63","#6c5ce7","#a29bfe"];
const DAYS_KR = ["일","월","화","수","목","금","토"];
const today   = new Date();

// ── 공유 상태 ──
let year            = today.getFullYear();
let month           = today.getMonth();
let plans           = {};
let subTasks        = {};
let subTaskRef      = null;
let weekBase        = new Date(today);
let modal           = { dateKey:null, editPlanId:null, colorIdx:0, category:'work' };
let currentCategory = 'all'; // 'all' | 'work' | 'personal'
let dbRef           = null;
let memoRef         = null;
let projectRef      = null;
let projects        = []; // [{ id, name, color, startDate, endDate, done, doneDate }]

// ── 날짜 유틸 ──
function dateKey(y, m, d) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function isToday(d, m2, y2) {
  return y2 === today.getFullYear() && m2 === today.getMonth() && d === today.getDate();
}

// ── ID 생성기 ──
function newPlanId() { return 'plan_' + Date.now() + '_' + Math.random().toString(36).slice(2,6); }
function newSubId()  { return 'sub_'  + Date.now() + '_' + Math.random().toString(36).slice(2,6); }

// ── 하이드레이션 ──
function hydratePlan(planId) {
  const plan = plans[planId];
  if (!plan) return null;
  const subs = Object.entries(subTasks)
    .filter(([,s]) => s.parentPlanId === planId)
    .sort(([,a],[,b]) => (a.order||0)-(b.order||0))
    .map(([subId,s]) => ({...s, subId}));
  return {...plan, planId, sub: subs};
}

// ── 날짜별 일정 조회 ──
function getPlansByDate(dateKey) {
  return Object.keys(plans)
    .filter(pid => plans[pid].date === dateKey && plans[pid].startDate === plans[pid].endDate)
    .map(pid => hydratePlan(pid)).filter(Boolean);
}

// ── 색상 유틸 ──
function hexToRgb(hex) {
  return [1,3,5].map(i => parseInt(hex.slice(i, i+2), 16));
}
function rgbToHex(r, g, b) {
  return '#' + [r,g,b].map(v => Math.round(v).toString(16).padStart(2,'0')).join('');
}
function blendColor(hex1, hex2, t) {
  const [r1,g1,b1] = hexToRgb(hex1), [r2,g2,b2] = hexToRgb(hex2);
  return rgbToHex(r1+(r2-r1)*t, g1+(g2-g1)*t, b1+(b2-b1)*t);
}
function getLuminance(hex) {
  return hexToRgb(hex).reduce((sum, v, i) => {
    const c = v / 255;
    return sum + (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)) * [0.2126, 0.7152, 0.0722][i];
  }, 0);
}
function getContrastColor(hex) {
  return getLuminance(hex) > 0.179 ? '#1a2a4a' : '#ffffff';
}
function getItemDisplayColor(it) {
  const doneColor = (it.category === 'personal') ? '#a29bfe' : '#9b59b6';
  const subs = it.sub || [];
  if (!subs.length) return it.done ? doneColor : it.color;
  const ratio = subs.filter(s => s.done).length / subs.length;
  return ratio === 0 ? it.color : blendColor(it.color, doneColor, ratio);
}
function getProgressText(it) {
  const subs = it.sub || [];
  if (!subs.length) return '';
  return ` (${subs.filter(s => s.done).length}/${subs.length})`;
}
