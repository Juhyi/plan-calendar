// ── 상수 ──
const COLORS  = ["#0a0101","#9b59b6","#4f86f7","#f76b6b","#52c97a","#f5a623","#1abc9c","#e74c3c"];
const COLORS_WORK     = ["#2c3e50","#2980b9","#4f86f7","#1abc9c","#27ae60","#00b894","#0984e3","#74b9ff"];
const COLORS_PERSONAL = ["#e17055","#d63031","#f5a623","#fdcb6e","#e91e63","#fd79a8","#6c5ce7","#a29bfe"];
const DAYS_KR = ["일","월","화","수","목","금","토"];
const today   = new Date();

// ── 공유 상태 ──
let year            = today.getFullYear();
let month           = today.getMonth();
let plans           = {};
let weekBase        = new Date(today);
let modal           = { dateKey:null, editIdx:null, colorIdx:0, category:'work' };
let currentCategory = 'all'; // 'all' | 'work' | 'personal'
let dbRef           = null;

// ── 날짜 유틸 ──
function dateKey(y, m, d) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function isToday(d, m2, y2) {
  return y2 === today.getFullYear() && m2 === today.getMonth() && d === today.getDate();
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
function getItemDisplayColor(it) {
  const subs = it.sub || [];
  if (!subs.length) return it.done ? '#9b59b6' : it.color;
  const ratio = subs.filter(s => s.done).length / subs.length;
  return ratio === 0 ? it.color : blendColor(it.color, '#9b59b6', ratio);
}
function getProgressText(it) {
  const subs = it.sub || [];
  if (!subs.length) return '';
  return ` (${subs.filter(s => s.done).length}/${subs.length})`;
}
