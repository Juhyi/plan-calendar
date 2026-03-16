// ── 섹션 전환 ──
let currentSection = 'calendar';

function switchSection(name) {
  document.querySelectorAll('.app-section').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('section' + name.charAt(0).toUpperCase() + name.slice(1));
  if (target) target.classList.add('active');
  document.querySelectorAll('.snav-item[data-section]').forEach(b => {
    b.classList.toggle('active', b.dataset.section === name);
  });
  currentSection = name;
  if (name === 'projects') renderProjectList?.();
  if (name === 'schedules') renderScheduleList();
  if (name === 'subtasks') renderSubtaskList();
  if (name === 'memo') { renderMemos?.(); }
}

// ── 날짜 범위 헬퍼 ──
function _dateInRange(dk, fromEl, toEl) {
  const from = document.getElementById(fromEl)?.value;
  const to   = document.getElementById(toEl)?.value;
  if (from && dk < from) return false;
  if (to   && dk > to)   return false;
  return true;
}

// ── 일정 목록 렌더 ──
function renderScheduleList() {
  const body = document.getElementById('scheduleListBody');
  if (!body) return;
  const searchVal = (document.getElementById('scheduleSearchInput')?.value || '').toLowerCase();
  const sortVal = document.getElementById('scheduleSortSelect')?.value || 'date-asc';

  let items = [];
  Object.entries(plans || {}).forEach(([planId, plan]) => {
    if (!plan) return;
    const dk = plan.date || plan.startDate;
    if (!dk) return;
    const it = hydratePlan(planId);
    if (it) items.push({ dk, planId, it });
  });

  if (searchVal) items = items.filter(({ it }) => it.text?.toLowerCase().includes(searchVal));
  items = items.filter(({ dk }) => _dateInRange(dk, 'scheduleDateFrom', 'scheduleDateTo'));
  const activeCat = (typeof currentCategory !== 'undefined' ? currentCategory : 'all');
  if (activeCat !== 'all') items = items.filter(({ it }) => (it.category || 'work') === activeCat);
  items.sort((a, b) => sortVal === 'date-asc' ? (a.dk < b.dk ? -1 : 1) : (a.dk > b.dk ? -1 : 1));

  body.innerHTML = '';
  if (!items.length) { body.innerHTML = '<div class="section-empty">일정이 없습니다</div>'; return; }

  items.forEach(({ dk, planId, it }) => {
    const subs = it.sub || [];
    const done = subs.filter(s => s.done).length;
    const isDone = subs.length ? done === subs.length : !!it.done;
    const color = it.color || '#4f86f7';

    const card = document.createElement('div');
    card.className = 'sch-card' + (isDone ? ' done' : '');
    card.style.borderLeftColor = color;

    const dot = document.createElement('span');
    dot.className = 'sch-dot';
    dot.style.background = color;

    const info = document.createElement('div');
    info.className = 'sch-info';

    const title = document.createElement('div');
    title.className = 'sch-title';
    title.textContent = (isDone ? '✅ ' : '') + it.text;

    const range = it.startDate ? `${it.startDate}${it.endDate && it.endDate !== it.startDate ? ' ~ ' + it.endDate : ''}` : dk;
    const catLabel = (it.category || 'work') === 'personal' ? '🏠 개인' : '💼 업무';
    const meta = document.createElement('div');
    meta.className = 'sch-meta';
    meta.textContent = `📅 ${range}   ${catLabel}`;

    info.appendChild(title);
    info.appendChild(meta);

    if (subs.length) {
      const prog = document.createElement('div');
      prog.className = 'sch-progress';
      prog.innerHTML = `<div class="sch-prog-bar"><div class="sch-prog-fill" style="width:${Math.round(done/subs.length*100)}%;background:${color}"></div></div><span class="sch-prog-count">${done}/${subs.length}</span>`;
      info.appendChild(prog);
    }

    card.appendChild(dot);
    card.appendChild(info);
    card.onclick = () => openDetail(planId, card);
    body.appendChild(card);
  });
}

// ── 세부일정 목록 렌더 ──
function renderSubtaskList() {
  const body = document.getElementById('subtaskListBody');
  if (!body) return;
  const onlyPending = document.getElementById('subtaskOnlyPending')?.checked || false;
  const stCat = typeof currentCategory !== 'undefined' ? currentCategory : 'all';

  let items = [];
  Object.entries(plans || {}).forEach(([planId, plan]) => {
    if (!plan) return;
    const dk = plan.date || plan.startDate;
    if (!dk) return;
    if (stCat !== 'all' && (plan.category || 'work') !== stCat) return;
    if (!_dateInRange(dk, 'subtaskDateFrom', 'subtaskDateTo')) return;
    // Check if this plan has subtasks
    const planSubEntries = Object.entries(subTasks).filter(([,s]) => s.parentPlanId === planId);
    if (!planSubEntries.length) return;
    const it = hydratePlan(planId);
    if (!it) return;
    const subs = it.sub || [];
    const done = subs.filter(s => s.done).length;
    const allDone = subs.length > 0 && done === subs.length;
    if (onlyPending && allDone) return;
    items.push({ dk, planId, it, subs, done, allDone });
  });

  items.sort((a, b) => a.dk < b.dk ? -1 : a.dk > b.dk ? 1 : 0);

  body.innerHTML = '';
  if (!items.length) { body.innerHTML = '<div class="section-empty">세부일정이 있는 항목이 없습니다</div>'; return; }

  items.forEach(({ dk, planId, it, subs, done, allDone }) => {
    const ratio = subs.length ? done / subs.length : 0;
    const color = it.color || '#4f86f7';

    const card = document.createElement('div');
    card.className = 'stask-card' + (allDone ? ' done' : '');

    const header = document.createElement('div');
    header.className = 'stask-header';
    header.style.borderLeft = `4px solid ${color}`;

    const headerLeft = document.createElement('div');
    headerLeft.className = 'stask-header-left';

    const titleEl = document.createElement('div');
    titleEl.className = 'stask-title';
    titleEl.textContent = (allDone ? '✅ ' : '') + it.text;

    const dateLbl = document.createElement('div');
    dateLbl.className = 'stask-date';
    dateLbl.textContent = '📅 ' + (it.startDate ? `${it.startDate} ~ ${it.endDate}` : dk);

    const progWrap = document.createElement('div');
    progWrap.className = 'stask-prog-wrap';
    progWrap.innerHTML = `<span class="stask-prog-label">${done}/${subs.length} (${Math.round(ratio*100)}%)</span><div class="stask-prog-bar"><div class="stask-prog-fill" style="width:${Math.round(ratio*100)}%;background:${color}"></div></div>`;

    headerLeft.appendChild(titleEl);
    headerLeft.appendChild(dateLbl);
    headerLeft.appendChild(progWrap);

    const openBtn = document.createElement('button');
    openBtn.className = 'stask-open-btn';
    openBtn.textContent = '관리 →';
    openBtn.onclick = () => { if (typeof openDetail === 'function') openDetail(planId, openBtn); };

    header.appendChild(headerLeft);
    header.appendChild(openBtn);
    card.appendChild(header);

    const subList = document.createElement('div');
    subList.className = 'stask-sub-list';

    subs.forEach((sub) => {
      const subId = sub.subId;
      const row = document.createElement('div');
      row.className = 'stask-sub-row' + (sub.done ? ' done' : '');

      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = sub.done;
      cb.onchange = () => {
        subTasks[subId].done = !subTasks[subId].done;
        if (subTasks[subId].done) subTasks[subId].completedAt = new Date().toISOString().slice(0, 10);
        else delete subTasks[subId].completedAt;
        if (typeof saveSubTasks === 'function') saveSubTasks();
        renderSubtaskList();
        if (typeof detailState !== 'undefined' && detailState.planId === planId) {
          if (typeof renderDetailPanel === 'function') renderDetailPanel();
        }
      };

      const txt = document.createElement('span');
      txt.className = 'stask-sub-text';
      txt.textContent = sub.text;

      const dateSpan = document.createElement('span');
      dateSpan.className = 'stask-sub-date';
      dateSpan.textContent = sub.done && sub.completedAt ? '✓ ' + sub.completedAt : '';

      row.appendChild(cb);
      row.appendChild(txt);
      row.appendChild(dateSpan);
      subList.appendChild(row);
    });

    card.appendChild(subList);
    body.appendChild(card);
  });
}

// ── 공통 카테고리 선택 (모든 섹션 공유) ──
function setGlobalCategory(cat) {
  currentCategory = cat;
  // 모든 cat-btn UI 동기화
  document.querySelectorAll('.cat-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.cat === cat)
  );
  // 현재 섹션 재렌더
  if (currentSection === 'calendar') renderAll?.();
  else if (currentSection === 'projects') renderProjectList?.();
  else if (currentSection === 'schedules') renderScheduleList();
  else if (currentSection === 'subtasks') renderSubtaskList();
  else renderAll?.();
}

// ── 사이드바 클릭 이벤트 ──
document.querySelectorAll('.snav-item[data-section]').forEach(btn => {
  btn.addEventListener('click', () => switchSection(btn.dataset.section));
});

// ── 모든 cat-btn을 공통 핸들러로 연결 (calendar.js 핸들러 대체) ──
document.querySelectorAll('.cat-btn').forEach(btn => {
  btn.onclick = () => setGlobalCategory(btn.dataset.cat);
});

// ── 검색/필터 변경 시 재렌더 ──
document.getElementById('scheduleSearchInput')?.addEventListener('input', renderScheduleList);
document.getElementById('scheduleSortSelect')?.addEventListener('change', renderScheduleList);
document.getElementById('scheduleDateFrom')?.addEventListener('change', renderScheduleList);
document.getElementById('scheduleDateTo')?.addEventListener('change', renderScheduleList);
document.getElementById('subtaskOnlyPending')?.addEventListener('change', renderSubtaskList);
document.getElementById('subtaskDateFrom')?.addEventListener('change', renderSubtaskList);
document.getElementById('subtaskDateTo')?.addEventListener('change', renderSubtaskList);
document.getElementById('projectDateFrom')?.addEventListener('change', () => renderProjectList?.());
document.getElementById('projectDateTo')?.addEventListener('change', () => renderProjectList?.());

// 날짜 초기화 버튼
document.getElementById('btnScheduleDateClear')?.addEventListener('click', () => {
  document.getElementById('scheduleDateFrom').value = '';
  document.getElementById('scheduleDateTo').value = '';
  renderScheduleList();
});
document.getElementById('btnSubtaskDateClear')?.addEventListener('click', () => {
  document.getElementById('subtaskDateFrom').value = '';
  document.getElementById('subtaskDateTo').value = '';
  renderSubtaskList();
});
document.getElementById('btnProjectDateClear')?.addEventListener('click', () => {
  document.getElementById('projectDateFrom').value = '';
  document.getElementById('projectDateTo').value = '';
  renderProjectList?.();
});
