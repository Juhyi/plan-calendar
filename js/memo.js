// ── 메모 ──
let memos = {};

function loadMemos() {
  try {
    const saved = localStorage.getItem('calMemos');
    const parsed = saved ? JSON.parse(saved) : null;
    if (Array.isArray(parsed)) {
      memos = {};
      parsed.filter(Boolean).forEach(m => { memos[m.id || Date.now()] = { text: m.text, done: m.done || false }; });
    } else {
      memos = parsed || {};
    }
  } catch(e) { memos = {}; }
}

function saveMemos() {
  if (memoRef) { memoRef.set(memos); }
  else { localStorage.setItem('calMemos', JSON.stringify(memos)); }
}

function getSortedMemos() {
  return Object.entries(memos)
    .map(([id, m]) => ({ id, ...m }))
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return Number(b.id) - Number(a.id);
    });
}

// ── 렌더 (사이드바) ──
function renderMemos() {
  const list = document.getElementById('sidebarMemoList');
  if (!list) return;
  list.innerHTML = '';
  const sorted = getSortedMemos();
  const remaining = sorted.filter(m => !m.done).length;
  const countEl = document.getElementById('sidebarMemoCount');
  if (countEl) countEl.textContent = sorted.length ? `${remaining}/${sorted.length}` : '';

  if (!sorted.length) {
    const empty = document.createElement('div');
    empty.className = 'sidebar-memo-empty';
    empty.textContent = '메모가 없습니다';
    list.appendChild(empty);
    return;
  }

  sorted.forEach(m => {
    const row = document.createElement('div');
    row.className = 'sidebar-memo-item' + (m.done ? ' done' : '');

    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = m.done;
    cb.onchange = () => toggleMemo(m.id);

    const txt = document.createElement('span');
    txt.className = 'sidebar-memo-text';
    txt.textContent = m.text;
    txt.ondblclick = () => startEditMemo(m.id, txt);

    const actions = document.createElement('div');
    actions.className = 'sidebar-memo-actions';

    if (!m.done) {
      const addBtn = document.createElement('button');
      addBtn.className = 'sidebar-memo-add-btn';
      addBtn.title = '일정/세부일정에 추가';
      addBtn.textContent = '+';
      addBtn.onclick = (e) => { e.stopPropagation(); openMemoAddPopover(m.id, m.text, addBtn); };
      actions.appendChild(addBtn);
    }

    const del = document.createElement('button');
    del.className = 'sidebar-memo-del'; del.textContent = '✕';
    del.onclick = () => deleteMemo(m.id);
    actions.appendChild(del);

    row.appendChild(cb); row.appendChild(txt); row.appendChild(actions);
    list.appendChild(row);
  });
}

// ── 메모 → 일정/세부일정 추가 팝오버 ──
let _memoPopoverMemoId = null;
let _memoPopoverText = null;

function openMemoAddPopover(memoId, text, anchorEl) {
  closeMemoAddPopover();
  _memoPopoverMemoId = memoId;
  _memoPopoverText = text;

  const pop = document.createElement('div');
  pop.id = 'memoAddPopover';
  pop.className = 'memo-add-popover';

  const title = document.createElement('div');
  title.className = 'memo-add-popover-title';
  title.textContent = '어느 일정에 추가할까요?';
  pop.appendChild(title);

  // 검색
  const searchInp = document.createElement('input');
  searchInp.type = 'text';
  searchInp.className = 'memo-add-popover-search';
  searchInp.placeholder = '일정 검색...';
  pop.appendChild(searchInp);

  // 일정 목록
  const listEl = document.createElement('div');
  listEl.className = 'memo-add-popover-list';
  pop.appendChild(listEl);

  const renderList = (filter) => {
    listEl.innerHTML = '';
    const entries = Object.entries(plans || {})
      .map(([pid, p]) => ({ pid, p }))
      .filter(({ p }) => p && p.text)
      .filter(({ p }) => !filter || p.text.toLowerCase().includes(filter.toLowerCase()))
      .sort((a, b) => (a.p.startDate || a.p.date || '') < (b.p.startDate || b.p.date || '') ? 1 : -1);

    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'memo-add-popover-empty';
      empty.textContent = '일정이 없습니다';
      listEl.appendChild(empty);
      return;
    }

    entries.forEach(({ pid, p }) => {
      const item = document.createElement('div');
      item.className = 'memo-add-popover-item';
      const dot = document.createElement('span');
      dot.className = 'memo-add-popover-dot';
      dot.style.background = p.color || '#4f86f7';
      const name = document.createElement('span');
      name.className = 'memo-add-popover-name';
      name.textContent = p.text;
      const date = document.createElement('span');
      date.className = 'memo-add-popover-date';
      date.textContent = p.startDate || p.date || '';
      item.appendChild(dot); item.appendChild(name); item.appendChild(date);
      item.onclick = () => addMemoToSubTask(pid);
      listEl.appendChild(item);
    });
  };

  searchInp.oninput = () => renderList(searchInp.value);
  renderList('');

  document.body.appendChild(pop);

  // 위치: 앵커 기준
  const rect = anchorEl.getBoundingClientRect();
  const popW = 260, popH = 320;
  let left = rect.right + 6;
  let top = rect.top;
  if (left + popW > window.innerWidth) left = rect.left - popW - 6;
  if (top + popH > window.innerHeight) top = window.innerHeight - popH - 8;
  pop.style.left = left + 'px';
  pop.style.top = Math.max(8, top) + 'px';

  setTimeout(() => document.addEventListener('click', _closeMemoPopoverOutside), 0);
}

function _closeMemoPopoverOutside(e) {
  const pop = document.getElementById('memoAddPopover');
  if (pop && !pop.contains(e.target)) closeMemoAddPopover();
}

function closeMemoAddPopover() {
  document.getElementById('memoAddPopover')?.remove();
  document.removeEventListener('click', _closeMemoPopoverOutside);
  _memoPopoverMemoId = null;
  _memoPopoverText = null;
}

function addMemoToSubTask(planId) {
  const text = _memoPopoverText;
  const memoId = _memoPopoverMemoId;
  closeMemoAddPopover();
  if (!text || !plans[planId]) return;
  const subId = newSubId();
  const order = Object.values(subTasks).filter(s => s.parentPlanId === planId).length;
  subTasks[subId] = { parentPlanId: planId, text, done: false, dueDate: localDateStr(), completedAt: '', order };
  showToast('세부일정으로 추가되었습니다');
  saveSubTasks?.();
  deleteMemo(memoId);
  renderAll?.();
}

// ── CRUD ──
function addMemo() {
  const inp = document.getElementById('sidebarMemoInput');
  const txt = inp.value.trim(); if (!txt) return;
  memos[Date.now()] = { text: txt, done: false };
  inp.value = '';
  showToast('메모가 추가되었습니다');
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

function startEditMemo(memoId, txtEl) {
  const inp = document.createElement('input');
  inp.type = 'text'; inp.className = 'sidebar-memo-edit-inp'; inp.value = memos[memoId]?.text || '';
  txtEl.replaceWith(inp); inp.focus(); inp.select();
  const commit = () => {
    const val = inp.value.trim();
    if (val && memos[memoId]) { memos[memoId].text = val; showToast('수정되었습니다'); }
    saveMemos(); renderMemos();
  };
  inp.onblur = commit;
  inp.onkeydown = e => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') renderMemos(); };
}

function clearDoneMemos() {
  Object.keys(memos).forEach(id => { if (memos[id].done) delete memos[id]; });
  showToast('완료 메모가 삭제되었습니다');
  saveMemos(); renderMemos();
}

// ── 초기화 ──
loadMemos();

document.getElementById('btnSidebarMemoAdd').onclick = addMemo;
document.getElementById('btnSidebarMemoClear').onclick = clearDoneMemos;
document.getElementById('sidebarMemoInput').onkeydown = e => {
  if (e.key === 'Enter') { e.preventDefault(); addMemo(); }
};
