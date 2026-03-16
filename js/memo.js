// ── 메모 (날짜 무관 할일 목록) ──
let memos = {}; // { memoId: { text, done } }

function loadMemos() {
  try {
    const saved = localStorage.getItem('calMemos');
    const parsed = saved ? JSON.parse(saved) : null;
    // 구형 배열 포맷 처리
    if (Array.isArray(parsed)) {
      memos = {};
      parsed.filter(Boolean).forEach(m => { memos[m.id || Date.now()] = { text: m.text, done: m.done || false }; });
    } else {
      memos = parsed || {};
    }
  } catch(e) { memos = {}; }
}

function saveMemos() {
  if (memoRef) {
    memoRef.set(memos);
  } else {
    localStorage.setItem('calMemos', JSON.stringify(memos));
  }
}

// ── 정렬: 미완료 최신순 → 완료 최신순 ──
function getSortedMemos() {
  return Object.entries(memos)
    .map(([id, m]) => ({ id, ...m }))
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return Number(b.id) - Number(a.id);
    });
}

// ── 렌더 ──
function renderMemos() {
  const list = document.getElementById('memoList');
  list.innerHTML = '';
  const sorted = getSortedMemos();
  const remaining = sorted.filter(m => !m.done).length;
  document.getElementById('memoCount').textContent =
    sorted.length ? `${remaining}개 남음 / 전체 ${sorted.length}개` : '';

  if (!sorted.length) {
    const empty = document.createElement('div');
    empty.className = 'memo-empty';
    empty.textContent = '할일을 추가해보세요';
    list.appendChild(empty);
    return;
  }

  sorted.forEach(m => {
    const row = document.createElement('div');
    row.className = 'memo-item' + (m.done ? ' done' : '');

    if (!m.done) {
      row.draggable = true;
      row.addEventListener('dragstart', e => {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('application/x-memo', JSON.stringify({ memoId: m.id, text: m.text }));
        setTimeout(() => row.classList.add('dragging'), 0);
      });
      row.addEventListener('dragend', () => row.classList.remove('dragging'));
    }

    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = m.done;
    cb.onchange = () => toggleMemo(m.id);

    const txt = document.createElement('span');
    txt.className = 'memo-text';
    txt.textContent = m.text;
    txt.ondblclick = () => startEditMemo(m.id, row, txt);

    const del = document.createElement('button');
    del.className = 'memo-del-btn'; del.textContent = '✕';
    del.onclick = () => deleteMemo(m.id);

    row.appendChild(cb); row.appendChild(txt); row.appendChild(del);
    list.appendChild(row);
  });
}

// ── CRUD ──
function addMemo() {
  const inp = document.getElementById('memoInput');
  const txt = inp.value.trim(); if (!txt) return;
  memos[Date.now()] = { text: txt, done: false };
  inp.value = '';
  saveMemos(); renderMemos();
}

function toggleMemo(memoId) {
  if (!memos[memoId]) return;
  memos[memoId].done = !memos[memoId].done;
  saveMemos(); renderMemos();
}

function deleteMemo(memoId) {
  delete memos[memoId];
  saveMemos(); renderMemos();
}

function startEditMemo(memoId, row, txtEl) {
  const inp = document.createElement('input');
  inp.type = 'text'; inp.className = 'memo-edit-input'; inp.value = memos[memoId]?.text || '';
  txtEl.replaceWith(inp); inp.focus(); inp.select();
  const commit = () => {
    const val = inp.value.trim();
    if (val && memos[memoId]) memos[memoId].text = val;
    saveMemos(); renderMemos();
  };
  inp.onblur = commit;
  inp.onkeydown = e => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') renderMemos(); };
}

function clearDoneMemos() {
  Object.keys(memos).forEach(id => { if (memos[id].done) delete memos[id]; });
  saveMemos(); renderMemos();
}

// ── 초기 로드 + 이벤트 ──
loadMemos();

const _btnMemoOpen = document.getElementById('btnMemoOpen');
if (_btnMemoOpen) _btnMemoOpen.onclick = openMemo;
const _btnMemoClose = document.getElementById('btnMemoClose');
if (_btnMemoClose) _btnMemoClose.onclick = closeMemo;
document.getElementById('btnMemoAdd').onclick   = addMemo;
document.getElementById('btnMemoClear').onclick = clearDoneMemos;
document.getElementById('memoInput').onkeydown  = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addMemo(); } };

function addMemoMain() {
  const inp = document.getElementById('memoInputMain');
  const txt = inp.value.trim(); if (!txt) return;
  memos[Date.now()] = { text: txt, done: false };
  inp.value = '';
  saveMemos(); renderMemos();
}
document.getElementById('btnMemoAddMain').onclick = addMemoMain;
document.getElementById('memoInputMain').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addMemoMain(); } };
