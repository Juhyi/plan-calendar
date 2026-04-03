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
}

// ── 날짜 범위 헬퍼 ──
function _dateInRange(dk, fromEl, toEl) {
  const from = document.getElementById(fromEl)?.value;
  const to   = document.getElementById(toEl)?.value;
  if (from && dk < from) return false;
  if (to   && dk > to)   return false;
  return true;
}

// ── 탭 내 인라인 플랜 상세/수정 패널 ──
let _tabSelectedPlanId = null;

// ── 캘린더/프로젝트/일정관리 인라인 플로팅 상세 패널 ──
let _inlineDetailPlanId = null;
let _inlineDetailEl = null;
let _inlineBackdropEl = null;

function _ensureInlinePanel() {
  if (_inlineDetailEl) return _inlineDetailEl;

  _inlineBackdropEl = document.createElement('div');
  _inlineBackdropEl.className = 'inline-det-backdrop';
  _inlineBackdropEl.onclick = closeInlineDetail;
  document.body.appendChild(_inlineBackdropEl);

  const el = document.createElement('div');
  el.id = 'inlineDetailPanel';
  el.className = 'inline-detail-float';
  document.body.appendChild(el);
  _inlineDetailEl = el;
  return el;
}

function openInlineDetail(planId, openOpt) {
  const panel = _ensureInlinePanel();
  if (_inlineDetailPlanId === planId && panel.classList.contains('open')) {
    closeInlineDetail(); return;
  }
  _inlineDetailPlanId = planId;
  panel.innerHTML = '';

  const hdr = document.createElement('div'); hdr.className = 'inline-det-hdr';
  const closeBtn = document.createElement('button'); closeBtn.className = 'inline-det-close'; closeBtn.textContent = '✕';
  closeBtn.onclick = closeInlineDetail;
  hdr.appendChild(closeBtn);
  panel.appendChild(hdr);

  const body = document.createElement('div'); body.className = 'inline-det-body';
  panel.appendChild(body);
  renderTabPlanDetail(body, planId, openOpt);

  // 삭제 후 패널도 닫기
  const delBtn = body.querySelector('.tab-det-del');
  if (delBtn) { const prev = delBtn.onclick; delBtn.onclick = (...a) => { closeInlineDetail(); prev?.(...a); }; }

  panel.classList.add('open');
  _inlineBackdropEl.classList.add('open');
}

function closeInlineDetail() {
  _inlineDetailPlanId = null;
  if (_inlineDetailEl) _inlineDetailEl.classList.remove('open');
  if (_inlineBackdropEl) _inlineBackdropEl.classList.remove('open');
}

function renderTabPlanDetail(pane, planId, openOpt) {
  _tabSelectedPlanId = planId;
  const it = hydratePlan(planId);
  if (!it) { pane.innerHTML = '<div class="tab-det-placeholder">항목을 찾을 수 없습니다</div>'; return; }
  const subs = it.sub || [];
  pane.innerHTML = '';

  // 로컬 상태 (category가 'all'이거나 없을 경우 'work'로 기본값)
  let _detCat = (it.category && it.category !== 'all') ? it.category : 'work';
  const initPalette = _detCat === 'personal' ? COLORS_PERSONAL : COLORS_WORK;
  let _detColorIdx = initPalette.indexOf(it.color) >= 0 ? initPalette.indexOf(it.color) : 0;

  // 제목
  const titleInp = document.createElement('input');
  titleInp.className = 'tab-det-title'; titleInp.value = it.text;
  pane.appendChild(titleInp);

  // 카테고리·타입 뱃지
  const badgeRow = document.createElement('div'); badgeRow.className = 'tab-det-badge-row';
  const _cat = it.category || 'work';
  const _type = it.type || 'task';
  const catBadge = document.createElement('span');
  catBadge.className = 'sch-title-badge sch-badge-cat-' + _cat;
  catBadge.textContent = _cat === 'personal' ? '🏠 개인' : '💼 업무';
  const typeBadge = document.createElement('span');
  typeBadge.className = 'sch-title-badge sch-badge-' + _type;
  typeBadge.textContent = _type === 'event' ? '📅 약속' : _type === 'expense' ? '💰 지출' : '✅ 할일';
  badgeRow.appendChild(catBadge);
  badgeRow.appendChild(typeBadge);
  pane.appendChild(badgeRow);

  // 옵션 접기/펴기
  const optToggle = document.createElement('button'); optToggle.className = 'tab-det-opt-toggle';
  const optWrap = document.createElement('div'); optWrap.className = 'tab-det-opt-wrap';
  let _optOpen = false;
  function _setOptOpen(v) {
    _optOpen = v; optWrap.classList.toggle('collapsed', !v);
    optToggle.innerHTML = `✏️ 일정 수정 <span class="tab-det-opt-arrow">${v ? '▲' : '▼'}</span>`;
  }
  optToggle.onclick = () => _setOptOpen(!_optOpen);
  _setOptOpen(!!openOpt);
  pane.appendChild(optToggle);
  pane.appendChild(optWrap);

  // 타입 버튼 행
  const typeRow = document.createElement('div'); typeRow.className = 'tab-det-type-row';
  [['task','✅ 할일'], ['event','📅 약속'], ['expense','💰 지출']].forEach(([t, lbl]) => {
    const btn = document.createElement('button');
    btn.className = 'tab-det-type-btn' + ((it.type || 'task') === t ? ' active' : '');
    btn.dataset.type = t; btn.textContent = lbl;
    btn.onclick = () => { typeRow.querySelectorAll('.tab-det-type-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); };
    typeRow.appendChild(btn);
  });
  optWrap.appendChild(typeRow);

  // 카테고리 버튼 행
  const catRow = document.createElement('div'); catRow.className = 'tab-det-type-row';
  [['work','💼 업무'], ['personal','🏠 개인']].forEach(([c, lbl]) => {
    const btn = document.createElement('button');
    btn.className = 'tab-det-type-btn tab-det-cat-btn tab-det-cat-btn-' + c + (_detCat === c ? ' active' : '');
    btn.dataset.cat = c; btn.textContent = lbl;
    btn.onclick = () => {
      _detCat = c;
      _detColorIdx = 0;
      catRow.querySelectorAll('.tab-det-cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderColorRow();
    };
    catRow.appendChild(btn);
  });
  optWrap.appendChild(catRow);

  // 날짜
  const datesRow = document.createElement('div'); datesRow.className = 'tab-det-dates';
  const fromInp = document.createElement('input'); fromInp.type = 'date'; fromInp.className = 'tab-det-date-inp'; fromInp.value = it.startDate || '';
  const sep = document.createElement('span'); sep.className = 'tab-det-date-sep'; sep.textContent = '~';
  const toInp = document.createElement('input'); toInp.type = 'date'; toInp.className = 'tab-det-date-inp'; toInp.value = it.endDate || '';
  datesRow.appendChild(fromInp); datesRow.appendChild(sep); datesRow.appendChild(toInp);
  optWrap.appendChild(datesRow);

  // 프로젝트 선택
  const projSel = document.createElement('select'); projSel.className = 'tab-det-proj-sel';
  const noneOpt = document.createElement('option'); noneOpt.value = ''; noneOpt.textContent = '📌 프로젝트 없음';
  projSel.appendChild(noneOpt);
  (projects || []).forEach(p => {
    const opt = document.createElement('option'); opt.value = p.id; opt.textContent = '📁 ' + p.name;
    if (Number(it.projectId) === Number(p.id)) opt.selected = true;
    projSel.appendChild(opt);
  });
  optWrap.appendChild(projSel);

  // 색상 팔레트
  const colorRow = document.createElement('div'); colorRow.className = 'tab-det-color-row';
  optWrap.appendChild(colorRow);
  function renderColorRow() {
    colorRow.innerHTML = '';
    const palette = _detCat === 'personal' ? COLORS_PERSONAL : COLORS_WORK;
    palette.forEach((c, i) => {
      const dot = document.createElement('div');
      dot.className = 'color-dot' + (i === _detColorIdx ? ' selected' : '');
      dot.style.background = c;
      dot.onclick = () => { _detColorIdx = i; renderColorRow(); };
      colorRow.appendChild(dot);
    });
  }
  renderColorRow();

  // 메모
  const memoArea = document.createElement('textarea');
  memoArea.className = 'tab-det-memo'; memoArea.placeholder = '메모...'; memoArea.value = it.memo || '';
  pane.appendChild(memoArea);

  // 세부일정 섹션 (항상 표시)
  const subSection = document.createElement('div'); subSection.className = 'tab-det-sub-section';
  const subLbl = document.createElement('div'); subLbl.className = 'tab-det-sub-label';
  subLbl.textContent = `세부일정 ${subs.length ? '(' + subs.filter(s=>s.done).length + '/' + subs.length + ')' : ''}`;
  subSection.appendChild(subLbl);

  if (subs.length) {
    const subList = document.createElement('div'); subList.className = 'tab-det-subs';
    subs.forEach(sub => {
      const isExpense = it.type === 'expense';
      const row = document.createElement('div'); row.className = 'tab-det-sub-row' + (sub.done ? ' done' : '');
      const txt = document.createElement('span'); txt.className = 'tab-det-sub-txt'; txt.textContent = sub.text;

      // 날짜 영역
      const dateArea = document.createElement('div'); dateArea.className = 'tab-det-sub-dates';

      if (isExpense) {
        const dueLbl = document.createElement('label'); dueLbl.className = 'tab-det-sub-date-lbl'; dueLbl.textContent = '지출일자';
        const dueInp = document.createElement('input'); dueInp.type = 'date'; dueInp.className = 'tab-det-sub-date-inp'; dueInp.value = sub.dueDate || '';
        dueInp.onchange = () => {
          const subId = sub.subId;
          if (subTasks[subId]) { subTasks[subId].dueDate = dueInp.value; saveSubTasks?.(); renderAll?.(); }
        };
        dateArea.appendChild(dueLbl); dateArea.appendChild(dueInp);
      } else {
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = sub.done;
        cb.onchange = () => {
          const subId = sub.subId;
          if (subTasks[subId]) {
            subTasks[subId].done = !subTasks[subId].done;
            if (subTasks[subId].done) subTasks[subId].completedAt = localDateStr();
            else delete subTasks[subId].completedAt;
            saveSubTasks?.();
            renderAll?.();
          }
        };
        row.insertBefore(cb, row.firstChild);

        const dueLbl = document.createElement('label'); dueLbl.className = 'tab-det-sub-date-lbl'; dueLbl.textContent = '예정';
        const dueInp = document.createElement('input'); dueInp.type = 'date'; dueInp.className = 'tab-det-sub-date-inp'; dueInp.value = sub.dueDate || '';
        dueInp.onchange = () => {
          const subId = sub.subId;
          if (subTasks[subId]) { subTasks[subId].dueDate = dueInp.value; saveSubTasks?.(); renderAll?.(); }
        };
        dateArea.appendChild(dueLbl); dateArea.appendChild(dueInp);

        if (sub.done) {
          const doneLbl = document.createElement('label'); doneLbl.className = 'tab-det-sub-date-lbl done'; doneLbl.textContent = '완료';
          const doneInp = document.createElement('input'); doneInp.type = 'date'; doneInp.className = 'tab-det-sub-date-inp done'; doneInp.value = sub.completedAt || '';
          doneInp.onchange = () => {
            const subId = sub.subId;
            if (subTasks[subId]) { subTasks[subId].completedAt = doneInp.value; saveSubTasks?.(); renderAll?.(); }
          };
          dateArea.appendChild(doneLbl); dateArea.appendChild(doneInp);
        }
      }

      const delBtn = document.createElement('button'); delBtn.className = 'tab-det-sub-del'; delBtn.textContent = '✕';
      delBtn.onclick = () => {
        const subId = sub.subId;
        if (subTasks[subId] && confirm(`"${sub.text}" 세부일정을 삭제하시겠습니까?`)) {
          delete subTasks[subId];
          showToast('삭제되었습니다');
          saveSubTasks?.();
          renderAll?.();
        }
      };
      row.appendChild(txt); row.appendChild(dateArea); row.appendChild(delBtn);
      subList.appendChild(row);
    });
    subSection.appendChild(subList);
  }

  // 세부일정 추가 입력
  const addSubRow = document.createElement('div'); addSubRow.className = 'tab-det-sub-add';
  const addSubInp = document.createElement('input');
  addSubInp.className = 'tab-det-sub-inp'; addSubInp.type = 'text'; addSubInp.placeholder = '세부일정 입력...';
  const addSubBtn = document.createElement('button'); addSubBtn.className = 'tab-det-sub-add-btn'; addSubBtn.textContent = '+ 추가';
  const doAddSub = () => {
    const text = addSubInp.value.trim(); if (!text || !plans[planId]) return;
    const subId = newSubId();
    const order = Object.values(subTasks).filter(s => s.parentPlanId === planId).length;
    subTasks[subId] = { parentPlanId: planId, text, done: false, dueDate: localDateStr(), completedAt: '', order };
    showToast('세부일정이 추가되었습니다');
    saveSubTasks?.();
    renderAll?.();
  };
  addSubBtn.onclick = doAddSub;
  addSubInp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); doAddSub(); } };
  addSubRow.appendChild(addSubInp); addSubRow.appendChild(addSubBtn);
  subSection.appendChild(addSubRow);
  pane.appendChild(subSection);

  // 버튼
  const btns = document.createElement('div'); btns.className = 'tab-det-btns';
  const saveBtn = document.createElement('button'); saveBtn.className = 'tab-det-save'; saveBtn.textContent = '저장';
  saveBtn.onclick = () => {
    const activeTBtn = typeRow.querySelector('.tab-det-type-btn.active');
    if (!plans[planId]) return;
    const newText = titleInp.value.trim();
    if (newText) plans[planId].text = newText;
    if (activeTBtn) plans[planId].type = activeTBtn.dataset.type;
    if (fromInp.value) { plans[planId].startDate = fromInp.value; plans[planId].date = fromInp.value; }
    if (toInp.value) plans[planId].endDate = toInp.value;
    plans[planId].category = _detCat;
    const palette = _detCat === 'personal' ? COLORS_PERSONAL : COLORS_WORK;
    plans[planId].color = palette[_detColorIdx];
    const projVal = projSel.value;
    plans[planId].projectId = projVal ? Number(projVal) : null;
    plans[planId].memo = memoArea.value.trim() || '';
    showToast('수정되었습니다');
    savePlans?.();
    renderAll?.();
  };
  const delBtn = document.createElement('button'); delBtn.className = 'tab-det-del'; delBtn.textContent = '삭제';
  delBtn.onclick = () => {
    if (!confirm('삭제하시겠습니까?')) return;
    _tabSelectedPlanId = null;
    showToast('삭제되었습니다');
    deletePlan?.(planId);  // 내부에서 renderAll 호출 → 탭+캘린더 갱신
  };
  btns.appendChild(saveBtn); btns.appendChild(delBtn);
  pane.appendChild(btns);
}

// ── master-detail 레이아웃 헬퍼 ──
function _buildMasterDetail(body, selectedId, renderListInto) {
  const cat = (typeof currentCategory !== 'undefined' ? currentCategory : 'all');
  const wrapper = document.createElement('div'); wrapper.className = 'tab-master-detail';

  const listPane = document.createElement('div'); listPane.className = 'tab-list-pane';
  // 카테고리 헤더
  const catHdr = document.createElement('div');
  catHdr.className = 'tab-cat-hdr tab-cat-hdr-' + cat;
  catHdr.innerHTML = cat === 'work' ? '<span class="tab-cat-icon">💼</span> 업무 일정' : '<span class="tab-cat-icon">🏠</span> 개인 일정';
  listPane.appendChild(catHdr);

  const detPane = document.createElement('div'); detPane.className = 'tab-detail-pane';
  if (!selectedId) detPane.innerHTML = '<div class="tab-det-placeholder">← 항목을 선택하면<br>여기서 수정할 수 있어요</div>';
  wrapper.appendChild(listPane); wrapper.appendChild(detPane);
  body.appendChild(wrapper);
  wrapper.style.height = _calcSplitHeight(body);
  renderListInto(listPane, detPane);
  return { listPane, detPane };
}

// 분할/마스터-디테일 컨테이너 높이를 topbar 기준으로 동적 계산
function _calcSplitHeight(bodyEl) {
  const topbar = bodyEl.closest('.app-section')?.querySelector('.section-topbar');
  const topbarH = topbar ? topbar.getBoundingClientRect().height : 60;
  const appMain = document.querySelector('.app-main');
  const mainPadV = appMain ? (parseInt(getComputedStyle(appMain).paddingTop) + parseInt(getComputedStyle(appMain).paddingBottom)) : 40;
  return `calc(100vh - ${topbarH + mainPadV + 24}px)`;
}

// ── 일정 목록 렌더 ──
function renderScheduleList() {
  const body = document.getElementById('scheduleListBody');
  if (!body) return;
  const searchVal = (document.getElementById('scheduleSearchInput')?.value || '').toLowerCase();
  const sortVal = document.getElementById('scheduleSortSelect')?.value || 'date-asc';
  const activeCat = (typeof currentCategory !== 'undefined' ? currentCategory : 'all');

  let items = [];
  Object.entries(plans || {}).forEach(([planId, plan]) => {
    if (!plan) return;
    const dk = plan.date || plan.startDate;
    if (!dk) return;
    const it = hydratePlan(planId);
    if (it) items.push({ dk, planId, it });
  });

  if (searchVal) items = items.filter(({ it }) => it.text?.toLowerCase().includes(searchVal));
  items = items.filter(({ it }) => {
    const from = document.getElementById('scheduleDateFrom')?.value;
    const to   = document.getElementById('scheduleDateTo')?.value;
    const sd = it.startDate || it.date || '';
    const ed = it.endDate   || it.date || sd;
    if (from && ed < from) return false;
    if (to   && sd > to)   return false;
    return true;
  });
  if (activeCat !== 'all') items = items.filter(({ it }) => (it.category || 'work') === activeCat);
  items.sort((a, b) => sortVal === 'date-asc' ? (a.dk < b.dk ? -1 : 1) : (a.dk > b.dk ? -1 : 1));

  body.innerHTML = '';

  const mkCard = ({ dk, planId, it }) => {
    const subs = it.sub || [];
    const done = subs.filter(s => s.done).length;
    const isDone = subs.length ? done === subs.length : !!it.done;
    const color = it.color || '#4f86f7';
    const proj = it.projectId ? (projects || []).find(p => Number(p.id) === Number(it.projectId)) : null;
    const borderColor = proj ? (proj.color || color) : color;

    const card = document.createElement('div');
    const isPastEvent = it.type === 'event' && (it.endDate || it.date || dk) < localDateStr();
    card.className = 'sch-card' + (isDone ? ' done' : '');
    card.style.borderLeftColor = borderColor;
    if (it.type === 'event') {
      card.style.opacity = isPastEvent ? '0.35' : '1';
      card.style.filter  = isPastEvent ? 'saturate(0.25)' : 'none';
    }

    const dot = document.createElement('span');
    dot.className = 'sch-dot';
    dot.style.background = color;

    const info = document.createElement('div');
    info.className = 'sch-info';

    const title = document.createElement('div');
    title.className = 'sch-title';
    const titleText = document.createElement('span');
    titleText.className = 'sch-title-text';
    titleText.textContent = (isDone ? '✅ ' : '') + it.text;
    const _cat = it.category || 'work';
    const _type = it.type || 'task';
    const catBadge = document.createElement('span');
    catBadge.className = 'sch-title-badge sch-badge-cat-' + _cat;
    catBadge.textContent = _cat === 'personal' ? '개인' : '업무';
    const typeBadge = document.createElement('span');
    typeBadge.className = 'sch-title-badge sch-badge-' + _type;
    typeBadge.textContent = _type === 'event' ? '약속' : _type === 'expense' ? '지출' : '할일';
    title.appendChild(titleText);
    title.appendChild(catBadge);
    title.appendChild(typeBadge);

    const isMultiDay = it.startDate && it.endDate && it.startDate !== it.endDate;
    const range = it.startDate ? `${it.startDate}${isMultiDay ? ' ~ ' + it.endDate : ''}` : dk;
    const meta = document.createElement('div');
    meta.className = 'sch-meta';
    meta.textContent = `📅 ${range}`;

    // 배지 행 (기간 + 세부일정)
    const chips = document.createElement('div'); chips.className = 'sch-chips';
    const dChip = document.createElement('span');
    dChip.className = 'sch-chip sch-chip-dur ' + (isMultiDay ? 'sch-chip-range' : 'sch-chip-single');
    dChip.textContent = isMultiDay ? '기간' : '단일';
    chips.appendChild(dChip);
    if (subs.length && it.type !== 'expense') {
      const sChip = document.createElement('span');
      sChip.className = 'sch-chip sch-chip-sub ' + (done === subs.length ? 'sch-chip-sub-done' : done > 0 ? 'sch-chip-sub-part' : 'sch-chip-sub-none');
      sChip.textContent = `세부 ${done}/${subs.length}`;
      chips.appendChild(sChip);
    }
    if (it.type === 'expense' && subs.length) {
      const total = subs.reduce((s, sub) => s + parseExpenseAmount(sub.text), 0);
      const totalChip = document.createElement('span');
      totalChip.className = 'sch-chip sch-chip-expense-total';
      totalChip.textContent = `₩ ${total.toLocaleString('ko-KR')}`;
      chips.appendChild(totalChip);
    }

    info.appendChild(title);
    info.appendChild(meta);
    info.appendChild(chips);

    if (it.type === 'expense' && subs.length) {
      // 날짜별 지출 내역
      const byDate = {};
      subs.forEach(sub => {
        const d = sub.dueDate || '날짜없음';
        if (!byDate[d]) byDate[d] = [];
        byDate[d].push(sub);
      });
      const expWrap = document.createElement('div'); expWrap.className = 'sch-expense-wrap';
      Object.keys(byDate).sort().forEach(date => {
        const dateTotal = byDate[date].reduce((s, sub) => s + parseExpenseAmount(sub.text), 0);

        const dHdr = document.createElement('div'); dHdr.className = 'sch-expense-date-hdr';
        const dHdrText = document.createElement('span');
        dHdrText.textContent = (date === '날짜없음' ? '날짜 미정' : date) + `  ₩ ${dateTotal.toLocaleString('ko-KR')}`;
        const dToggle = document.createElement('span'); dToggle.className = 'sch-expense-toggle'; dToggle.textContent = '▶';
        dHdr.appendChild(dHdrText); dHdr.appendChild(dToggle);

        const dRows = document.createElement('div'); dRows.className = 'sch-expense-rows'; dRows.style.display = 'none';
        byDate[date].forEach(sub => {
          const row = document.createElement('div'); row.className = 'sch-expense-row';
          row.textContent = sub.text;
          dRows.appendChild(row);
        });

        dHdr.onclick = e => {
          e.stopPropagation();
          const open = dRows.style.display !== 'none';
          dRows.style.display = open ? 'none' : '';
          dToggle.textContent = open ? '▶' : '▼';
        };

        expWrap.appendChild(dHdr);
        expWrap.appendChild(dRows);
      });
      info.appendChild(expWrap);
    } else if (subs.length) {
      const prog = document.createElement('div');
      prog.className = 'sch-progress';
      prog.innerHTML = `<div class="sch-prog-bar"><div class="sch-prog-fill" style="width:${Math.round(done/subs.length*100)}%;background:${color}"></div></div><span class="sch-prog-count">${done}/${subs.length}</span>`;
      info.appendChild(prog);
    }

    card.appendChild(dot);
    card.appendChild(info);
    card.onclick = e => { e.stopPropagation(); openInlineDetail(planId, true); };
    return card;
  };

  // ── 프로젝트별 그룹핑 헬퍼 ──
  const appendGrouped = (itemList, container, detPane) => {
    const tasks = itemList.filter(r => (r.it.type || 'task') !== 'event');
    const events = itemList.filter(r => (r.it.type || 'task') === 'event');

    const projGroups = new Map();
    const noProj = [];
    tasks.forEach(row => {
      const projId = row.it.projectId ? Number(row.it.projectId) : null;
      const proj = projId ? (projects || []).find(p => Number(p.id) === projId) : null;
      if (proj) {
        if (!projGroups.has(projId)) projGroups.set(projId, { proj, rows: [] });
        projGroups.get(projId).rows.push(row);
      } else {
        noProj.push(row);
      }
    });

    const attachCard = (card, row) => {
      if (row.planId === _tabSelectedPlanId) card.classList.add('tab-selected');
      if (detPane) {
        card.onclick = () => {
          container.querySelectorAll('.sch-card').forEach(c => c.classList.remove('tab-selected'));
          card.classList.add('tab-selected');
          _tabSelectedPlanId = row.planId;
          renderTabPlanDetail(detPane, row.planId, renderScheduleList);
        };
      }
    };

    const mkProjGroup = (proj) => {
      const grp = document.createElement('div');
      grp.className = 'sch-proj-group';
      grp.style.borderColor = proj.color || '#4f86f7';
      const ghdr = document.createElement('div');
      ghdr.className = 'sch-proj-group-hdr';
      ghdr.style.color = proj.color || '#4f86f7';
      ghdr.style.borderBottomColor = (proj.color || '#4f86f7') + '33';
      ghdr.textContent = '📁 ' + proj.name;
      grp.appendChild(ghdr);
      return grp;
    };

    // 1. 프로젝트 그룹 (할일)
    projGroups.forEach(({ proj, rows }) => {
      const grp = mkProjGroup(proj);
      rows.forEach(row => { const card = mkCard(row); attachCard(card, row); grp.appendChild(card); });
      container.appendChild(grp);
    });

    // 2. 독립 할일
    noProj.forEach(row => { const card = mkCard(row); attachCard(card, row); container.appendChild(card); });

    // 3. 약속 그룹 (하단)
    if (events.length) {
      const evGrp = document.createElement('div');
      evGrp.className = 'sch-proj-group sch-event-group';
      const evHdr = document.createElement('div');
      evHdr.className = 'sch-proj-group-hdr';
      evHdr.textContent = '📅 약속';
      evGrp.appendChild(evHdr);
      events.forEach(row => { const card = mkCard(row); attachCard(card, row); evGrp.appendChild(card); });
      container.appendChild(evGrp);
    }
  };

  if (activeCat === 'all') {
    // 전체: 업무/개인 분할
    const workItems = items.filter(({ it }) => (it.category || 'work') === 'work');
    const persItems = items.filter(({ it }) => (it.category || 'work') === 'personal');
    if (!workItems.length && !persItems.length) { body.innerHTML = '<div class="section-empty">일정이 없습니다</div>'; return; }
    const splitEl = document.createElement('div'); splitEl.className = 'sch-split';
    const workCol = document.createElement('div'); workCol.className = 'sch-col sch-col-work';
    const workHdr = document.createElement('div'); workHdr.className = 'sch-col-hdr'; workHdr.textContent = '💼 업무';
    workCol.appendChild(workHdr);
    if (workItems.length) appendGrouped(workItems, workCol, null);
    else { const e = document.createElement('div'); e.className = 'sch-col-empty'; e.textContent = '없음'; workCol.appendChild(e); }
    const persCol = document.createElement('div'); persCol.className = 'sch-col sch-col-personal';
    const persHdr = document.createElement('div'); persHdr.className = 'sch-col-hdr'; persHdr.textContent = '🏠 개인';
    persCol.appendChild(persHdr);
    if (persItems.length) appendGrouped(persItems, persCol, null);
    else { const e = document.createElement('div'); e.className = 'sch-col-empty'; e.textContent = '없음'; persCol.appendChild(e); }
    splitEl.appendChild(workCol); splitEl.appendChild(persCol);
    body.appendChild(splitEl);
    body.style.padding = '0'; body.style.overflow = 'hidden';
    splitEl.style.height = _calcSplitHeight(body);
  } else {
    body.style.padding = '0'; body.style.overflow = 'hidden';
    // 업무/개인 단일: master-detail
    _buildMasterDetail(body, _tabSelectedPlanId, (listPane, detPane) => {
      if (_tabSelectedPlanId && items.find(r => r.planId === _tabSelectedPlanId)) {
        renderTabPlanDetail(detPane, _tabSelectedPlanId, renderScheduleList);
      }
      const addBtn = document.createElement('button'); addBtn.className = 'tab-list-add-btn'; addBtn.textContent = '+ 일정 추가';
      addBtn.onclick = () => {
        const cat = (typeof currentCategory !== 'undefined' && currentCategory !== 'all') ? currentCategory : 'work';
        _tabSelectedPlanId = null;
        _renderNewPlanForm(detPane, cat);
      };
      listPane.appendChild(addBtn);
      if (!items.length) { const e = document.createElement('div'); e.className = 'section-empty'; e.style.padding = '16px'; e.textContent = '일정이 없습니다'; listPane.appendChild(e); }
      appendGrouped(items, listPane, detPane);
    });
  }
}

// ── 새 일정 폼 (일정관리 탭) ──
function _renderNewPlanForm(pane, defaultCat) {
  pane.innerHTML = '';
  let _detCat = defaultCat || 'work';
  let _detColorIdx = 0;
  let _detType = 'task';

  const titleInp = document.createElement('input');
  titleInp.className = 'tab-det-title'; titleInp.placeholder = '일정 제목을 입력하세요';
  pane.appendChild(titleInp);

  // 옵션 접기/펴기
  const optToggle = document.createElement('button'); optToggle.className = 'tab-det-opt-toggle';
  const optWrap = document.createElement('div'); optWrap.className = 'tab-det-opt-wrap';
  let _optOpen = false;
  function _setOptOpen(v) {
    _optOpen = v; optWrap.classList.toggle('collapsed', !v);
    optToggle.innerHTML = `✏️ 일정 등록 <span class="tab-det-opt-arrow">${v ? '▲' : '▼'}</span>`;
  }
  optToggle.onclick = () => _setOptOpen(!_optOpen);
  _setOptOpen(false);
  pane.appendChild(optToggle);
  pane.appendChild(optWrap);

  const typeRow = document.createElement('div'); typeRow.className = 'tab-det-type-row';
  [['task','✅ 할일'], ['event','📅 약속'], ['expense','💰 지출']].forEach(([t, lbl]) => {
    const btn = document.createElement('button');
    btn.className = 'tab-det-type-btn' + (t === _detType ? ' active' : '');
    btn.dataset.type = t; btn.textContent = lbl;
    btn.onclick = () => { _detType = t; typeRow.querySelectorAll('.tab-det-type-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); };
    typeRow.appendChild(btn);
  });
  optWrap.appendChild(typeRow);

  const catRow = document.createElement('div'); catRow.className = 'tab-det-type-row';
  [['work','💼 업무'], ['personal','🏠 개인']].forEach(([c, lbl]) => {
    const btn = document.createElement('button');
    btn.className = 'tab-det-type-btn tab-det-cat-btn tab-det-cat-btn-' + c + (_detCat === c ? ' active' : '');
    btn.dataset.cat = c; btn.textContent = lbl;
    btn.onclick = () => {
      _detCat = c; _detColorIdx = 0;
      catRow.querySelectorAll('.tab-det-cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderColorRow();
    };
    catRow.appendChild(btn);
  });
  optWrap.appendChild(catRow);

  const dateStr = localDateStr();
  const datesRow = document.createElement('div'); datesRow.className = 'tab-det-dates';
  const fromInp = document.createElement('input'); fromInp.type = 'date'; fromInp.className = 'tab-det-date-inp'; fromInp.value = dateStr;
  const sep = document.createElement('span'); sep.className = 'tab-det-date-sep'; sep.textContent = '~';
  const toInp = document.createElement('input'); toInp.type = 'date'; toInp.className = 'tab-det-date-inp'; toInp.value = dateStr;
  datesRow.appendChild(fromInp); datesRow.appendChild(sep); datesRow.appendChild(toInp);
  optWrap.appendChild(datesRow);

  const projSel = document.createElement('select'); projSel.className = 'tab-det-proj-sel';
  const noneOpt = document.createElement('option'); noneOpt.value = ''; noneOpt.textContent = '📌 프로젝트 없음';
  projSel.appendChild(noneOpt);
  (projects || []).forEach(p => {
    const opt = document.createElement('option'); opt.value = p.id; opt.textContent = '📁 ' + p.name;
    projSel.appendChild(opt);
  });
  optWrap.appendChild(projSel);

  const colorRow = document.createElement('div'); colorRow.className = 'tab-det-color-row';
  optWrap.appendChild(colorRow);
  function renderColorRow() {
    colorRow.innerHTML = '';
    const palette = _detCat === 'personal' ? COLORS_PERSONAL : COLORS_WORK;
    palette.forEach((c, i) => {
      const dot = document.createElement('div');
      dot.className = 'color-dot' + (i === _detColorIdx ? ' selected' : '');
      dot.style.background = c;
      dot.onclick = () => { _detColorIdx = i; renderColorRow(); };
      colorRow.appendChild(dot);
    });
  }
  renderColorRow();

  const saveBtn = document.createElement('button');
  saveBtn.className = 'tab-det-save'; saveBtn.textContent = '저장';
  saveBtn.onclick = () => {
    const txt = titleInp.value.trim();
    if (!txt) { titleInp.focus(); return; }
    const palette = _detCat === 'personal' ? COLORS_PERSONAL : COLORS_WORK;
    const color = palette[_detColorIdx] || '#4f86f7';
    const sd = fromInp.value || dateStr;
    const ed = toInp.value || dateStr;
    const planId = newPlanId();
    plans[planId] = { text: txt, color, category: _detCat, done: false, projectId: projSel.value || null, date: sd, startDate: sd, endDate: ed, type: _detType };
    showToast('등록되었습니다');
    savePlans?.();
    _tabSelectedPlanId = planId;
    renderAll?.();
  };
  pane.appendChild(saveBtn);

  setTimeout(() => titleInp.focus(), 50);
}

// ── 프로젝트 필터 셀렉트 옵션 채우기 ──
function _fillProjectFilter() {
  const sel = document.getElementById('subtaskProjectFilter');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">전체 프로젝트</option>';
  (projects || []).forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id; opt.textContent = p.name;
    sel.appendChild(opt);
  });
  if (prev) sel.value = prev;
}

// ── 나의 할 일 대시보드 렌더 ──
function renderSubtaskList() {
  const body = document.getElementById('subtaskListBody');
  if (!body) return;
  _fillProjectFilter();
  const showDone = document.getElementById('subtaskShowDone')?.checked || false;
  const projFilter = document.getElementById('subtaskProjectFilter')?.value || '';
  const catFilter = typeof currentCategory !== 'undefined' ? currentCategory : 'all';

  // 날짜 기준
  const todayD = new Date(); todayD.setHours(0,0,0,0);
  const todayStr = localDateStr(todayD);
  const weekEndD = new Date(todayD); weekEndD.setDate(todayD.getDate() + (7 - todayD.getDay())); // 이번주 일요일
  const weekEndStr = localDateStr(weekEndD);

  // 모든 세부일정 수집
  const allSubs = [], expenseSubs = [];
  Object.entries(subTasks || {}).forEach(([subId, sub]) => {
    if (!sub) return;
    const plan = (plans || {})[sub.parentPlanId];
    if (!plan) return;
    const cat = plan.category || 'work';
    if (catFilter !== 'all' && cat !== catFilter) return;
    if (projFilter && String(plan.projectId) !== String(projFilter)) return;
    if (plan.type === 'expense') expenseSubs.push({ subId, sub, plan, planId: sub.parentPlanId, cat });
    else allSubs.push({ subId, sub, plan, planId: sub.parentPlanId, cat });
  });

  // 시간 그룹 분류 (지출 제외)
  const groups = { overdue: [], today: [], week: [], later: [], done: [] };
  allSubs.forEach(item => {
    if (item.sub.done) { groups.done.push(item); return; }
    const due = item.sub.dueDate || '';
    if (!due || due < todayStr)       groups.overdue.push(item);
    else if (due === todayStr)        groups.today.push(item);
    else if (due <= weekEndStr)       groups.week.push(item);
    else                              groups.later.push(item);
  });
  const sortDue = arr => arr.sort((a,b) => (a.sub.dueDate||'') < (b.sub.dueDate||'') ? -1 : 1);
  sortDue(groups.overdue); sortDue(groups.today); sortDue(groups.week); sortDue(groups.later);
  groups.done.sort((a,b) => (b.sub.completedAt||'') < (a.sub.completedAt||'') ? -1 : 1);
  const priOrd = p => p === 'high' ? 0 : p === 'medium' ? 1 : p === 'low' ? 2 : 3;
  groups.today.sort((a, b) => priOrd(a.sub.priority) - priOrd(b.sub.priority));

  body.innerHTML = '';

  // ── 요약 바 ──
  const summary = document.createElement('div');
  summary.className = 'mytask-summary';
  [
    { label: '지연됨',     count: groups.overdue.length, cls: 'overdue' },
    { label: '오늘',       count: groups.today.length,   cls: 'today'   },
    { label: '이번 주',    count: groups.week.length,    cls: 'week'    },
    { label: '이후 예정',  count: groups.later.length,   cls: 'later'   },
  ].forEach(({ label, count, cls }) => {
    const chip = document.createElement('div');
    chip.className = `mytask-summary-chip mytask-summary-${cls}`;
    chip.innerHTML = `<span class="mytask-summary-count">${count}</span><span class="mytask-summary-label">${label}</span>`;
    summary.appendChild(chip);
  });
  body.appendChild(summary);

  // ── 세부일정 행 생성 ──
  const mkSubRow = ({ subId, sub, plan, planId, cat }, groupCls) => {
    const row = document.createElement('div');
    row.className = 'mytask-row' + (sub.done ? ' done' : '');

    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.className = 'mytask-cb'; cb.checked = sub.done;
    cb.onchange = () => {
      subTasks[subId].done = !subTasks[subId].done;
      if (subTasks[subId].done) subTasks[subId].completedAt = localDateStr();
      else delete subTasks[subId].completedAt;
      saveSubTasks?.();
      renderAll?.();
    };

    const info = document.createElement('div');
    info.className = 'mytask-info';

    const txt = document.createElement('div');
    txt.className = 'mytask-txt' + (sub.done ? ' done' : '');
    txt.textContent = sub.text;

    const meta = document.createElement('div');
    meta.className = 'mytask-meta';

    const planChip = document.createElement('span');
    planChip.className = 'mytask-plan-chip';
    planChip.style.cssText = `background:${(plan.color||'#4f86f7')}18;color:${plan.color||'#4f86f7'};border-color:${(plan.color||'#4f86f7')}55`;
    planChip.textContent = plan.text || '일정';
    planChip.title = '클릭하여 일정 열기';
    planChip.onclick = () => openDetail?.(planId, planChip);

    const catChip = document.createElement('span');
    catChip.className = `mytask-cat-chip mytask-cat-${cat}`;
    catChip.textContent = cat === 'work' ? '💼' : '🏠';

    const dueInp = document.createElement('input');
    dueInp.type = 'date';
    dueInp.className = 'mytask-due-inp' + (groupCls === 'overdue' ? ' overdue' : '');
    dueInp.value = sub.dueDate || '';
    dueInp.title = '예정일';
    dueInp.onchange = () => {
      if (subTasks[subId]) { subTasks[subId].dueDate = dueInp.value; saveSubTasks?.(); renderAll?.(); }
    };
    dueInp.onclick = e => e.stopPropagation();

    // 우선순위 선택
    const priSel = document.createElement('select');
    priSel.className = 'mytask-pri-sel' + (sub.priority ? ' pri-' + sub.priority : '');
    priSel.title = '우선순위';
    [
      { value: '',       label: '— 우선순위' },
      { value: 'high',   label: '🔴 높음' },
      { value: 'medium', label: '🟡 중간' },
      { value: 'low',    label: '🔵 낮음' },
    ].forEach(({ value, label }) => {
      const opt = document.createElement('option');
      opt.value = value; opt.textContent = label;
      if ((sub.priority || '') === value) opt.selected = true;
      priSel.appendChild(opt);
    });
    priSel.onchange = e => {
      e.stopPropagation();
      if (subTasks[subId]) {
        if (priSel.value) subTasks[subId].priority = priSel.value;
        else delete subTasks[subId].priority;
        priSel.className = 'mytask-pri-sel' + (priSel.value ? ' pri-' + priSel.value : '');
        saveSubTasks?.();
        renderSubtaskList();
      }
    };
    priSel.onclick = e => e.stopPropagation();

    meta.appendChild(planChip); meta.appendChild(catChip); meta.appendChild(priSel); meta.appendChild(dueInp);

    if (sub.done && sub.completedAt !== undefined) {
      const doneInp = document.createElement('input');
      doneInp.type = 'date';
      doneInp.className = 'mytask-due-inp mytask-done-inp';
      doneInp.value = sub.completedAt || '';
      doneInp.title = '완료일';
      doneInp.onchange = () => {
        if (subTasks[subId]) { subTasks[subId].completedAt = doneInp.value; saveSubTasks?.(); renderAll?.(); }
      };
      doneInp.onclick = e => e.stopPropagation();
      meta.appendChild(doneInp);
    }
    info.appendChild(txt); info.appendChild(meta);

    row.appendChild(cb); row.appendChild(info);
    return row;
  };

  // ── 그룹 섹션 렌더 ──
  const renderGroup = (icon, title, items, cls, collapsed = false) => {
    if (!items.length && cls !== 'today') return;
    const section = document.createElement('div');
    section.className = `mytask-section mytask-section-${cls}`;

    const hdr = document.createElement('div');
    hdr.className = 'mytask-section-hdr';
    const toggle = document.createElement('span'); toggle.className = 'mytask-toggle'; toggle.textContent = collapsed ? '▶' : '▼';
    hdr.innerHTML = `<span class="mytask-section-icon">${icon}</span><span class="mytask-section-title">${title}</span>`;
    const badge = document.createElement('span'); badge.className = `mytask-badge mytask-badge-${cls}`; badge.textContent = items.length;
    hdr.appendChild(badge); hdr.appendChild(toggle);

    const list = document.createElement('div');
    list.className = 'mytask-list';
    if (collapsed) list.style.display = 'none';

    hdr.onclick = () => {
      const isOpen = list.style.display !== 'none';
      list.style.display = isOpen ? 'none' : '';
      toggle.textContent = isOpen ? '▶' : '▼';
    };

    if (!items.length) {
      const empty = document.createElement('div'); empty.className = 'mytask-empty'; empty.textContent = '없음';
      list.appendChild(empty);
    } else {
      items.forEach(item => list.appendChild(mkSubRow(item, cls)));
    }
    section.appendChild(hdr); section.appendChild(list);
    body.appendChild(section);
  };

  const totalActive = groups.overdue.length + groups.today.length + groups.week.length + groups.later.length;
  if (!totalActive && !showDone) {
    body.appendChild(summary); // already appended above, need to keep
    const empty = document.createElement('div'); empty.className = 'section-empty'; empty.style.marginTop = '24px';
    empty.textContent = '할 일이 없습니다 🎉';
    body.appendChild(empty);
    return;
  }

  renderGroup('🔴', '지연됨',     groups.overdue, 'overdue');
  renderGroup('🎯', '오늘 할 일', groups.today,   'today');
  renderGroup('📅', '이번 주',    groups.week,    'week');
  renderGroup('🔮', '이후 예정',  groups.later,   'later');
  if (showDone) renderGroup('✅', '완료됨', groups.done, 'done', true);

  // ── 지출 내역: 날짜별 그룹 ──
  if (expenseSubs.length) {
    const expSection = document.createElement('div');
    expSection.className = 'mytask-section mytask-section-expense';

    const expHdr = document.createElement('div');
    expHdr.className = 'mytask-section-hdr';
    expHdr.innerHTML = `<span class="mytask-section-icon">💰</span><span class="mytask-section-title">지출 내역</span>`;
    const expBadge = document.createElement('span');
    expBadge.className = 'mytask-badge mytask-badge-later';
    expBadge.textContent = expenseSubs.length;
    const expToggle = document.createElement('span');
    expToggle.className = 'mytask-toggle'; expToggle.textContent = '▼';
    expHdr.appendChild(expBadge); expHdr.appendChild(expToggle);

    const expList = document.createElement('div');
    expList.className = 'mytask-list';

    expHdr.onclick = () => {
      const isOpen = expList.style.display !== 'none';
      expList.style.display = isOpen ? 'none' : '';
      expToggle.textContent = isOpen ? '▶' : '▼';
    };

    // 날짜별 그룹
    const byDate = {};
    expenseSubs.forEach(item => {
      const d = item.sub.dueDate || '날짜없음';
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(item);
    });
    Object.keys(byDate).sort().forEach(date => {
      const total = byDate[date].reduce((s, i) => s + parseExpenseAmount(i.sub.text), 0);

      const dateHdr = document.createElement('div');
      dateHdr.className = 'mytask-expense-date-hdr';
      const dateHdrText = document.createElement('span');
      dateHdrText.textContent = (date === '날짜없음' ? '날짜 미정' : date) + `  ₩ ${total.toLocaleString('ko-KR')}`;
      const dateToggle = document.createElement('span'); dateToggle.className = 'sch-expense-toggle'; dateToggle.textContent = '▶';
      dateHdr.appendChild(dateHdrText); dateHdr.appendChild(dateToggle);

      const dateRows = document.createElement('div'); dateRows.className = 'mytask-expense-rows'; dateRows.style.display = 'none';

      byDate[date].forEach(({ subId, sub, plan, planId }) => {
        const row = document.createElement('div');
        row.className = 'mytask-row mytask-expense-row';

        const txt = document.createElement('div');
        txt.className = 'mytask-txt';
        txt.textContent = sub.text;

        const planChip = document.createElement('span');
        planChip.className = 'mytask-plan-chip';
        planChip.style.cssText = `background:${(plan.color||'#4f86f7')}18;color:${plan.color||'#4f86f7'};border-color:${(plan.color||'#4f86f7')}55`;
        planChip.textContent = plan.text || '일정';
        planChip.onclick = () => openDetail?.(planId, planChip);

        const dueInp = document.createElement('input');
        dueInp.type = 'date'; dueInp.className = 'mytask-due-inp';
        dueInp.value = sub.dueDate || '';
        dueInp.title = '지출일자';
        dueInp.onchange = () => {
          if (subTasks[subId]) { subTasks[subId].dueDate = dueInp.value; saveSubTasks?.(); renderSubtaskList?.(); }
        };
        dueInp.onclick = e => e.stopPropagation();

        const delBtn = document.createElement('button');
        delBtn.className = 'tab-det-sub-del'; delBtn.textContent = '✕';
        delBtn.onclick = () => {
          if (subTasks[subId] && confirm(`"${sub.text}" 항목을 삭제하시겠습니까?`)) {
            delete subTasks[subId]; showToast?.('삭제되었습니다'); saveSubTasks?.(); renderSubtaskList?.();
          }
        };

        const meta = document.createElement('div'); meta.className = 'mytask-meta';
        meta.appendChild(planChip); meta.appendChild(dueInp);
        const info = document.createElement('div'); info.className = 'mytask-info';
        info.appendChild(txt); info.appendChild(meta);
        row.appendChild(info); row.appendChild(delBtn);
        dateRows.appendChild(row);
      });

      dateHdr.onclick = () => {
        const open = dateRows.style.display !== 'none';
        dateRows.style.display = open ? 'none' : '';
        dateToggle.textContent = open ? '▶' : '▼';
      };

      expList.appendChild(dateHdr);
      expList.appendChild(dateRows);
    });

    expSection.appendChild(expHdr); expSection.appendChild(expList);
    body.appendChild(expSection);
  }
}

function closeTaskSlide() {}

// ── 공통 카테고리 선택 (모든 섹션 공유) ──
function setGlobalCategory(cat) {
  currentCategory = cat;
  _tabSelectedPlanId = null; // 카테고리 변경 시 선택 초기화
  if (typeof _tabSelectedProjIdx !== 'undefined') _tabSelectedProjIdx = null;
  closeTaskSlide?.();
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
document.getElementById('subtaskShowDone')?.addEventListener('change', renderSubtaskList);
document.getElementById('subtaskProjectFilter')?.addEventListener('change', renderSubtaskList);
document.getElementById('projectDateFrom')?.addEventListener('change', () => renderProjectList?.());
document.getElementById('projectDateTo')?.addEventListener('change', () => renderProjectList?.());

// 날짜 초기화 버튼
document.getElementById('btnScheduleDateClear')?.addEventListener('click', () => {
  document.getElementById('scheduleDateFrom').value = '';
  document.getElementById('scheduleDateTo').value = '';
  renderScheduleList();
});

document.getElementById('btnProjectDateClear')?.addEventListener('click', () => {
  document.getElementById('projectDateFrom').value = '';
  document.getElementById('projectDateTo').value = '';
  renderProjectList?.();
});

// ── 모바일 초기 설정 ──
// 모바일에서는 나의 할 일을 첫 화면으로, 캘린더는 주간 뷰로 고정
if (window.innerWidth <= 720) {
  switchSection('subtasks');
  // 캘린더 탭을 주간 뷰로 전환 (사용자가 캘린더 탭을 눌렀을 때)
  document.getElementById('calViewMonth').style.display = 'none';
  document.getElementById('calViewWeek').style.display  = '';
  document.getElementById('monthNav').style.display     = 'none';
  document.getElementById('weekNav').style.display      = '';
  document.querySelector('.cal-view-btn[data-view="month"]')?.classList.remove('active');
  document.querySelector('.cal-view-btn[data-view="week"]')?.classList.add('active');
}

// ── 날짜 필터 기본값: 이번 달 첫일 ~ 말일 ──
(function() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const pad = n => String(n).padStart(2, '0');
  const first = `${y}-${pad(m + 1)}-01`;
  const last  = `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`;
  [
    ['scheduleDateFrom', 'scheduleDateTo'],

    ['projectDateFrom',  'projectDateTo'],
  ].forEach(([fromId, toId]) => {
    const f = document.getElementById(fromId), t = document.getElementById(toId);
    if (f && !f.value) f.value = first;
    if (t && !t.value) t.value = last;
  });
})();
