// ── 메모 (날짜 무관 할일 목록) ──
let memos = []; // [{ id, text, done }]

function loadMemos() {
  try {
    const saved = localStorage.getItem('calMemos');
    memos = saved ? JSON.parse(saved) : [];
  } catch(e) { memos = []; }
}

function saveMemos() {
  localStorage.setItem('calMemos', JSON.stringify(memos));
}

// ── 패널 열기/닫기 ──
function openMemo() {
  document.getElementById('memoPanel').classList.add('open');
  document.body.classList.add('memo-open');
  renderMemos();
  setTimeout(() => document.getElementById('memoInput').focus(), 200);
}
function closeMemo() {
  document.getElementById('memoPanel').classList.remove('open');
  document.body.classList.remove('memo-open');
}

// ── 렌더 ──
function renderMemos() {
  const list = document.getElementById('memoList');
  list.innerHTML = '';
  const remaining = memos.filter(m => !m.done).length;
  document.getElementById('memoCount').textContent =
    memos.length ? `${remaining}개 남음 / 전체 ${memos.length}개` : '';

  if (!memos.length) {
    const empty = document.createElement('div');
    empty.className = 'memo-empty';
    empty.textContent = '할일을 추가해보세요';
    list.appendChild(empty);
    return;
  }

  memos.forEach((m, i) => {
    const row = document.createElement('div');
    row.className = 'memo-item' + (m.done ? ' done' : '');

    if (!m.done) {
      row.draggable = true;
      row.addEventListener('dragstart', e => {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('application/x-memo', JSON.stringify({ idx: i, text: m.text }));
        setTimeout(() => row.classList.add('dragging'), 0);
      });
      row.addEventListener('dragend', () => row.classList.remove('dragging'));
    }

    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = m.done;
    cb.onchange = () => toggleMemo(i);

    const txt = document.createElement('span');
    txt.className = 'memo-text';
    txt.textContent = m.text;
    txt.ondblclick = () => startEditMemo(i, row, txt);

    const del = document.createElement('button');
    del.className = 'memo-del-btn'; del.textContent = '✕';
    del.onclick = () => deleteMemo(i);

    row.appendChild(cb); row.appendChild(txt); row.appendChild(del);
    list.appendChild(row);
  });
}

// ── CRUD ──
function addMemo() {
  const inp = document.getElementById('memoInput');
  const txt = inp.value.trim(); if (!txt) return;
  memos.unshift({ id: Date.now(), text: txt, done: false });
  inp.value = '';
  saveMemos(); renderMemos();
}

function toggleMemo(i) {
  memos[i].done = !memos[i].done;
  // 완료된 항목은 목록 맨 아래로
  const item = memos.splice(i, 1)[0];
  memos[item.done ? 'push' : 'unshift'](item);
  saveMemos(); renderMemos();
}

function deleteMemo(i) {
  memos.splice(i, 1);
  saveMemos(); renderMemos();
}

function startEditMemo(i, row, txtEl) {
  const inp = document.createElement('input');
  inp.type = 'text'; inp.className = 'memo-edit-input'; inp.value = memos[i].text;
  txtEl.replaceWith(inp); inp.focus(); inp.select();
  const commit = () => {
    const val = inp.value.trim();
    if (val) memos[i].text = val;
    saveMemos(); renderMemos();
  };
  inp.onblur = commit;
  inp.onkeydown = e => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') renderMemos(); };
}

function clearDoneMemos() {
  memos = memos.filter(m => !m.done);
  saveMemos(); renderMemos();
}

// ── 초기 로드 + 이벤트 ──
loadMemos();

document.getElementById('btnMemoOpen').onclick   = openMemo;
document.getElementById('btnMemoClose').onclick  = closeMemo;
document.getElementById('btnMemoAdd').onclick    = addMemo;
document.getElementById('btnMemoClear').onclick  = clearDoneMemos;
document.getElementById('memoInput').onkeydown   = e => { if (e.key === 'Enter') addMemo(); };
