// ── 공휴일 데이터 (localStorage 저장) ──
let holidays = {}; // { "YYYY-MM-DD": "공휴일명" }

function loadHolidays() {
  try {
    const saved = localStorage.getItem('calHolidays');
    holidays = saved ? JSON.parse(saved) : {};
  } catch(e) { holidays = {}; }
}

function saveHolidaysToStorage() {
  localStorage.setItem('calHolidays', JSON.stringify(holidays));
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
  if (!confirm('저장된 공휴일을 모두 삭제하시겠습니까?')) return;
  holidays = {};
  saveHolidaysToStorage();
  renderAll();
  document.getElementById('holidayStatus').textContent = '공휴일이 삭제되었습니다.';
}

// ── 초기 로드 + 이벤트 ──
loadHolidays();

document.getElementById('btnHolidayOpen').onclick    = openHolidayDialog;
document.getElementById('btnHolidayClose').onclick   = closeHolidayDialog;
document.getElementById('holidayOverlay').onclick    = closeHolidayDialog;
document.getElementById('btnFetchHoliday').onclick   = doFetchHoliday;
document.getElementById('btnPasteHoliday').onclick   = doPasteHoliday;
document.getElementById('btnClearHolidays').onclick  = clearHolidays;
document.getElementById('holidayUrlInput').onkeydown = e => { if (e.key === 'Enter') doFetchHoliday(); };
