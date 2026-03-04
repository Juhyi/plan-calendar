// ── 한국 공휴일 내장 폴백 데이터 (네트워크 없을 때 사용) ──
const HOLIDAYS_KR = {
  // 2025
  "2025-01-01": "신정",
  "2025-01-28": "설날 연휴",
  "2025-01-29": "설날",
  "2025-01-30": "설날 연휴",
  "2025-03-01": "삼일절",
  "2025-03-03": "삼일절 대체공휴일",
  "2025-05-05": "어린이날·부처님오신날",
  "2025-05-06": "어린이날 대체공휴일",
  "2025-06-06": "현충일",
  "2025-08-15": "광복절",
  "2025-10-03": "개천절",
  "2025-10-05": "추석 연휴",
  "2025-10-06": "추석",
  "2025-10-07": "추석 연휴",
  "2025-10-08": "추석 대체공휴일",
  "2025-10-09": "한글날",
  "2025-12-25": "성탄절",
  // 2026
  "2026-01-01": "신정",
  "2026-02-16": "설날 연휴",
  "2026-02-17": "설날",
  "2026-02-18": "설날 연휴",
  "2026-03-01": "삼일절",
  "2026-03-02": "삼일절 대체공휴일",
  "2026-05-05": "어린이날",
  "2026-06-06": "현충일",
  "2026-06-08": "현충일 대체공휴일",
  "2026-08-15": "광복절",
  "2026-08-17": "광복절 대체공휴일",
  "2026-09-24": "추석 연휴",
  "2026-09-25": "추석",
  "2026-09-26": "추석 연휴",
  "2026-09-28": "추석 대체공휴일",
  "2026-10-03": "개천절",
  "2026-10-05": "개천절 대체공휴일",
  "2026-10-09": "한글날",
  "2026-12-25": "성탄절",
};

// ── 자동 fetch 설정 ──
const _HOL_THIS_YEAR = new Date().getFullYear();
const _HOL_TARGET_YEARS = [-1, 0, 1, 2].map(d => _HOL_THIS_YEAR + d); // 작년~내후년
const _HOL_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30일

// ── 드래그 중 renderAll 차단 (dirty flag) ──
let _holDirty = false;    // 백그라운드 fetch 완료됐지만 아직 렌더 못 한 상태
let _isDragging = false;

document.addEventListener('dragstart', () => { _isDragging = true; });
document.addEventListener('dragend',   () => {
  _isDragging = false;
  if (_holDirty) { _holDirty = false; renderAll?.(); }
});

function _safeRenderAll() {
  if (_isDragging) { _holDirty = true; }  // 드래그 중이면 dragend까지 연기
  else             { renderAll?.(); }
}

// ── 공휴일 데이터 (localStorage 저장) ──
let holidays = {}; // { "YYYY-MM-DD": "공휴일명" }

// Nager.Date API로 특정 연도 한국 공휴일 fetch
async function _fetchNagerYear(year) {
  const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/KR`);
  if (!res.ok) return null;
  const arr = await res.json();
  const result = {};
  arr.forEach(item => {
    if (item.date) result[item.date] = item.localName || item.name;
  });
  return Object.keys(result).length ? result : null;
}

async function loadHolidays() {
  // 1) 내장 폴백 + 사용자 추가분으로 즉시 초기화
  try {
    const user = JSON.parse(localStorage.getItem('calHolidays') || '{}');
    holidays = { ...HOLIDAYS_KR, ...user };
  } catch(e) { holidays = { ...HOLIDAYS_KR }; }

  // 2) localStorage 연도별 캐시 로드
  const now = Date.now();
  const yearsToFetch = [];
  for (const year of _HOL_TARGET_YEARS) {
    try {
      const raw = localStorage.getItem(`calHol_${year}`);
      if (raw) {
        const { data, ts } = JSON.parse(raw);
        holidays = { ...holidays, ...data };
        if (now - ts > _HOL_CACHE_TTL) yearsToFetch.push(year); // 만료 → 갱신 예약
      } else {
        yearsToFetch.push(year); // 캐시 없음 → fetch 예약
      }
    } catch(e) { yearsToFetch.push(year); }
  }

  // 3) 필요한 연도만 병렬 fetch (캐시 있으면 렌더는 이미 됐으므로 조용히 갱신)
  if (yearsToFetch.length === 0) return;
  const results = await Promise.allSettled(yearsToFetch.map(_fetchNagerYear));
  let updated = false;
  results.forEach((res, i) => {
    if (res.status === 'fulfilled' && res.value) {
      localStorage.setItem(`calHol_${yearsToFetch[i]}`, JSON.stringify({ data: res.value, ts: now }));
      holidays = { ...holidays, ...res.value };
      updated = true;
    }
  });
  if (updated) _safeRenderAll();
}

// 사용자 추가 공휴일만 별도 저장 (자동 fetch 데이터와 분리)
function saveHolidaysToStorage() {
  // 자동 fetch 캐시 데이터를 제외한 사용자 추가분만 추출
  const autoData = {};
  for (const year of _HOL_TARGET_YEARS) {
    try {
      const raw = localStorage.getItem(`calHol_${year}`);
      if (raw) Object.assign(autoData, JSON.parse(raw).data);
    } catch(e) {}
  }
  const userOnly = {};
  for (const [k, v] of Object.entries(holidays)) {
    if (!(k in HOLIDAYS_KR) && !(k in autoData)) userOnly[k] = v;
  }
  localStorage.setItem('calHolidays', JSON.stringify(userOnly));
}

// ── JSON 파싱 (nager.at 등 JSON API) ──
function parseJson(text) {
  try {
    const arr = JSON.parse(text);
    if (!Array.isArray(arr)) return null;
    const result = {};
    arr.forEach(item => {
      if (item.date && (item.localName || item.name))
        result[item.date] = item.localName || item.name;
    });
    return Object.keys(result).length ? result : null;
  } catch(e) { return null; }
}

// ── iCal 파싱 ──
function parseIcal(text) {
  // 줄 이어쓰기 처리 (line folding)
  const unfolded = text
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .replace(/\n[ \t]/g, '');
  const lines = unfolded.split('\n');

  const result = {};
  let inEvent = false, curDate = null, curSummary = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true; curDate = null; curSummary = null;
    } else if (trimmed === 'END:VEVENT') {
      if (curDate && curSummary) result[curDate] = curSummary;
      inEvent = false;
    } else if (inEvent) {
      if (/^DTSTART/i.test(trimmed)) {
        const m = trimmed.match(/(\d{4})(\d{2})(\d{2})/);
        if (m) curDate = `${m[1]}-${m[2]}-${m[3]}`;
      } else if (/^SUMMARY:/i.test(trimmed)) {
        curSummary = trimmed.slice(8).trim();
      }
    }
  }
  return result;
}

// ── 외부 URL 가져오기 (직접 → CORS 프록시 순서) ──
async function fetchIcal(url) {
  const proxy1 = `https://corsproxy.io/?url=${encodeURIComponent(url)}`;
  const proxy2 = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;

  // 1) 직접 fetch (CORS 허용 서버면 성공)
  try {
    const res = await fetch(url);
    if (res.ok) return await res.text();
  } catch(e) { /* 직접 접근 불가 → 프록시로 이동 */ }

  // 2) corsproxy.io
  try {
    const res = await fetch(proxy1);
    if (res.ok) return await res.text();
  } catch(e) { /* 다음 프록시로 */ }

  // 3) allorigins.win
  const res2 = await fetch(proxy2);
  if (!res2.ok) throw new Error('모든 프록시 실패');
  const data = await res2.json();
  return data.contents;
}

// ── 다이얼로그 열기/닫기 ──
function openHolidayDialog() {
  document.getElementById('holidayOverlay').classList.add('open');
  document.getElementById('holidayDialog').classList.add('open');
  const count = Object.keys(holidays).length;
  document.getElementById('holidayStatus').textContent =
    count ? `현재 ${count}개 공휴일 저장됨` : '';
}
function closeHolidayDialog() {
  document.getElementById('holidayOverlay').classList.remove('open');
  document.getElementById('holidayDialog').classList.remove('open');
}

// ── URL로 가져오기 ──
async function doFetchHoliday() {
  const url = document.getElementById('holidayUrlInput').value.trim();
  const statusEl = document.getElementById('holidayStatus');
  if (!url) { statusEl.textContent = 'URL을 입력하세요.'; return; }
  statusEl.textContent = '⏳ 가져오는 중...';
  document.getElementById('btnFetchHoliday').disabled = true;
  try {
    const text = await fetchIcal(url);
    const parsed = parseJson(text) || parseIcal(text);
    const count = Object.keys(parsed).length;
    if (!count) { statusEl.textContent = '공휴일 데이터를 찾을 수 없습니다.'; return; }
    holidays = { ...holidays, ...parsed };
    saveHolidaysToStorage();
    renderAll();
    statusEl.textContent = `✅ ${count}개 공휴일 불러오기 완료!`;
  } catch(e) {
    statusEl.innerHTML = '';
    statusEl.appendChild(document.createTextNode('❌ CORS 차단으로 자동 가져오기 실패. '));
    const a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.textContent = '브라우저에서 URL 열기';
    statusEl.appendChild(a);
    statusEl.appendChild(document.createTextNode(' → 내용 전체 복사 → 아래 직접 붙여넣기 사용'));
  } finally {
    document.getElementById('btnFetchHoliday').disabled = false;
  }
}

// ── 직접 붙여넣기 ──
function doPasteHoliday() {
  const text = document.getElementById('holidayPasteInput').value.trim();
  const statusEl = document.getElementById('holidayStatus');
  if (!text) { statusEl.textContent = '내용을 붙여넣으세요.'; return; }
  try {
    const parsed = parseIcal(text);
    const count = Object.keys(parsed).length;
    if (!count) { statusEl.textContent = '공휴일 데이터를 찾을 수 없습니다.'; return; }
    holidays = { ...holidays, ...parsed };
    saveHolidaysToStorage();
    renderAll();
    statusEl.textContent = `✅ ${count}개 공휴일 불러오기 완료!`;
    document.getElementById('holidayPasteInput').value = '';
  } catch(e) {
    statusEl.textContent = '❌ 파싱 오류: ' + e.message;
  }
}

// ── 전체 삭제 ──
function clearHolidays() {
  if (!confirm('사용자 추가 공휴일을 모두 삭제하시겠습니까?\n(내장 한국 공휴일 및 자동 로드 데이터는 유지됩니다)')) return;
  localStorage.removeItem('calHolidays');
  // 자동 fetch 캐시도 초기화 (다음 loadHolidays 시 재fetch)
  _HOL_TARGET_YEARS.forEach(y => localStorage.removeItem(`calHol_${y}`));
  loadHolidays().then(() => _safeRenderAll());
  document.getElementById('holidayStatus').textContent = '사용자 추가 공휴일이 삭제되었습니다.';
}

// ── 초기 로드 + 이벤트 ──
loadHolidays(); // async — 캐시 즉시 반영, fetch 완료 시 renderAll() 재호출

document.getElementById('btnHolidayOpen').onclick    = openHolidayDialog;
document.getElementById('btnHolidayClose').onclick   = closeHolidayDialog;
document.getElementById('holidayOverlay').onclick    = closeHolidayDialog;
document.getElementById('btnFetchHoliday').onclick   = doFetchHoliday;
document.getElementById('btnPasteHoliday').onclick   = doPasteHoliday;
document.getElementById('btnClearHolidays').onclick  = clearHolidays;
document.getElementById('holidayUrlInput').onkeydown = e => { if (e.key === 'Enter') doFetchHoliday(); };
