// ── 완료된 세부일정 맵 빌드 ──
function buildCompletedSubMap() {
  const map = {};
  Object.entries(subTasks).forEach(([subId, sub]) => {
    if (!sub.done || !sub.completedAt) return;
    const plan = plans[sub.parentPlanId];
    if (!plan) return;
    const dk = sub.completedAt;
    if (!map[dk]) map[dk] = [];
    map[dk].push({ sub:{...sub,subId}, item:hydratePlan(sub.parentPlanId), planId:sub.parentPlanId, dateKey:plan.date });
  });
  return map;
}

// ── 기간 스팬맵 빌드 ──
function buildSpanMap() {
  const map = {};
  Object.entries(plans).forEach(([planId, plan]) => {
    const it = hydratePlan(planId);
    if (!it) return;
    if (!it.startDate || !it.endDate || it.startDate >= it.endDate) return;
    const subs = it.sub || [];
    if (subs.length > 0) {
      // 세부일정이 있는 경우: completedAt 날짜에만 표시
      const completedDates = new Set(subs.filter(s=>s.done&&s.completedAt).map(s=>s.completedAt));
      completedDates.forEach(dk => {
        if (!map[dk]) map[dk] = [];
        map[dk].push({ item:it, dateKey:plan.date, planId, pos:'single' });
      });
      return;
    }
    // 세부일정 없는 경우: 기간 전체에 표시
    const s = new Date(it.startDate+'T00:00:00'), e = new Date(it.endDate+'T00:00:00');
    for (let c=new Date(s); c<=e; c.setDate(c.getDate()+1)) {
      const dk = `${c.getFullYear()}-${String(c.getMonth()+1).padStart(2,'0')}-${String(c.getDate()).padStart(2,'0')}`;
      if (!map[dk]) map[dk] = [];
      const isSt=dk===it.startDate, isEn=dk===it.endDate;
      map[dk].push({ item:it, dateKey:plan.date, planId, pos:isSt&&isEn?'single':isSt?'start':isEn?'end':'mid' });
    }
  });
  return map;
}

// ── 날짜별 미완료 세부일정 맵 빌드 (dueDate 기준, 부모 날짜와 다를 때만) ──
function buildPendingSubMap() {
  const map = {};
  Object.entries(subTasks).forEach(([subId, sub]) => {
    if (sub.done || !sub.dueDate) return;
    const plan = plans[sub.parentPlanId];
    if (!plan) return;
    if (sub.dueDate === (plan.startDate || plan.date)) return; // 부모 날짜와 같으면 이미 부모 아이템으로 표현됨
    const dk = sub.dueDate;
    if (!map[dk]) map[dk] = [];
    map[dk].push({ sub:{...sub,subId}, item:hydratePlan(sub.parentPlanId), planId:sub.parentPlanId });
  });
  return map;
}

// ── 월간 캘린더 렌더 ──
function renderMonth() {
  document.getElementById('title').textContent = `${year}년 ${month+1}월`;
  const body = document.getElementById('calBody');
  body.innerHTML = '';
  const firstDay = new Date(year, month, 1).getDay();
  const dim = new Date(year, month+1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const spanMap = buildSpanMap();
  const pendingSubMap = buildPendingSubMap();
  const completedSubMap = buildCompletedSubMap();

  for (let w = 0; w < cells.length / 7; w++) {
    const row = document.createElement('div');
    row.className = 'week-row';
    for (let di = 0; di < 7; di++) {
      const d = cells[w*7+di];
      const cell = document.createElement('div');
      cell.className = 'cell' + (!d ? ' empty' : isToday(d, month, year) ? ' today' : '');
      if (d) {
        const key = dateKey(year, month, d);

        // 날짜 헤더
        const hdr = document.createElement('div'); hdr.className = 'cell-header';
        const num = document.createElement('span');
        const isHol = !!holidays[key];
        num.className = 'date-num' + (isToday(d,month,year) ? ' today-num' : isHol && di!==0 ? ' holiday-num' : di===0 ? ' sun-num' : di===6 ? ' sat-num' : '');
        num.textContent = d;
        const ab = document.createElement('button'); ab.className = 'add-btn'; ab.textContent = '+';
        ab.onclick = e => { e.stopPropagation(); openDayPopover(key, e.currentTarget); };
        hdr.appendChild(num); hdr.appendChild(ab); cell.appendChild(hdr);

        // 드래그 앤 드롭 (메모 + 캘린더 아이템)
        cell.addEventListener('dragover', e => {
          const hasMemo = e.dataTransfer.types.includes('application/x-memo');
          const hasCal  = e.dataTransfer.types.includes('application/x-cal-item');
          const hasSub  = e.dataTransfer.types.includes('application/x-sub-item');
          if (!hasMemo && !hasCal && !hasSub) return;
          e.preventDefault(); e.dataTransfer.dropEffect = hasCal || hasSub ? 'move' : 'copy';
          cell.classList.add('drag-over');
        });
        cell.addEventListener('dragleave', e => {
          if (!cell.contains(e.relatedTarget)) cell.classList.remove('drag-over');
        });
        cell.addEventListener('drop', e => {
          e.preventDefault(); cell.classList.remove('drag-over');
          if (e.dataTransfer.types.includes('application/x-cal-item')) {
            try {
              const d = JSON.parse(e.dataTransfer.getData('application/x-cal-item'));
              moveCalItem(d.planId, d.fromDisplayKey, key);
            } catch(err) {}
            return;
          }
          if (e.dataTransfer.types.includes('application/x-sub-item')) {
            try {
              const d = JSON.parse(e.dataTransfer.getData('application/x-sub-item'));
              extractSubToItem(d.planId, d.subId, key);
            } catch(err) {}
            return;
          }
          try {
            const data = JSON.parse(e.dataTransfer.getData('application/x-memo'));
            if (!data || !data.text) return;
            openModal(key, null, ab);
            document.getElementById('modalInput').value = data.text;
            deleteMemo(data.memoId);
          } catch(err) {}
        });

        if (isHol) {
          const holDiv = document.createElement('div'); holDiv.className = 'cell-holiday';
          holDiv.textContent = holidays[key]; cell.appendChild(holDiv);
        }

        const mkItemEl = (it, planId) => {
          const item = document.createElement('div');
          const hasPendingSubs = (it.sub || []).some(s => !s.done);
          const proj = it.projectId ? projects.find(p => p.id === it.projectId) : null;
          item.className = 'item cat-' + (it.category || 'work') +
            (it.done ? ' item-done' : '') +
            (hasPendingSubs ? ' item-inprogress' : '');
          if (proj) item.dataset.tooltip = '📁 ' + proj.name;
          item.style.borderLeftColor = getItemDisplayColor(it);
          const dot = document.createElement('span'); dot.className = 'item-dot'; dot.style.background = getItemDisplayColor(it);
          const txt = document.createElement('span'); txt.className = 'item-text'; txt.textContent = it.text + getProgressText(it);
          const del = document.createElement('span'); del.className = 'del'; del.textContent = '✕';
          del.onclick = e => { e.stopPropagation(); deletePlan(planId); };
          item.onclick = e => { e.stopPropagation(); openDetail(planId, e.currentTarget); };
          item.draggable = true;
          item.addEventListener('dragstart', e => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('application/x-cal-item', JSON.stringify({ planId, fromDisplayKey: key })); setTimeout(() => item.classList.add('dragging'), 0); });
          item.addEventListener('dragend', () => item.classList.remove('dragging'));
          item.addEventListener('dragover', e => {
            if (!e.dataTransfer.types.includes('application/x-cal-item')) return;
            e.preventDefault(); e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            item.classList.add('drop-over');
          });
          item.addEventListener('dragleave', e => {
            if (!item.contains(e.relatedTarget)) item.classList.remove('drop-over');
          });
          item.addEventListener('drop', e => {
            e.preventDefault(); e.stopPropagation();
            item.classList.remove('drop-over');
            if (!e.dataTransfer.types.includes('application/x-cal-item')) return;
            try {
              const d = JSON.parse(e.dataTransfer.getData('application/x-cal-item'));
              if (d.planId === planId) return;
              addCalItemAsSub(d.planId, planId);
            } catch(err) {}
          });
          item.appendChild(dot); item.appendChild(txt); item.appendChild(del);
          return item;
        };

        const mkSpanEl = (sp) => {
          const bar = document.createElement('div');
          const spHasPending = (sp.item.sub || []).some(s => !s.done);
          bar.className = 'span-bar span-' + sp.pos + ' cat-' + (sp.item.category || 'work') +
            (sp.item.done ? ' span-bar-done' : '') +
            (spHasPending ? ' span-bar-inprogress' : '');
          const spColor = getItemDisplayColor(sp.item);
          bar.style.borderLeftColor = spColor;
          const sdot = document.createElement('span'); sdot.className = 'item-dot'; sdot.style.background = spColor;
          const stxt = document.createElement('span'); stxt.className = 'item-text'; stxt.textContent = sp.item.text + getProgressText(sp.item);
          const sdel = document.createElement('span'); sdel.className = 'del'; sdel.textContent = '✕';
          sdel.onclick = e => { e.stopPropagation(); deletePlan(sp.planId); };
          bar.appendChild(sdot); bar.appendChild(stxt); bar.appendChild(sdel);
          bar.onclick = e => { e.stopPropagation(); openDetail(sp.planId, bar); };
          bar.draggable = true;
          bar.addEventListener('dragstart', e => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('application/x-cal-item', JSON.stringify({ planId: sp.planId, fromDisplayKey: key })); setTimeout(() => bar.classList.add('dragging'), 0); });
          bar.addEventListener('dragend', () => bar.classList.remove('dragging'));
          bar.addEventListener('dragover', e => {
            if (!e.dataTransfer.types.includes('application/x-cal-item')) return;
            e.preventDefault(); e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            bar.classList.add('drop-over');
          });
          bar.addEventListener('dragleave', e => {
            if (!bar.contains(e.relatedTarget)) bar.classList.remove('drop-over');
          });
          bar.addEventListener('drop', e => {
            e.preventDefault(); e.stopPropagation();
            bar.classList.remove('drop-over');
            if (!e.dataTransfer.types.includes('application/x-cal-item')) return;
            try {
              const d = JSON.parse(e.dataTransfer.getData('application/x-cal-item'));
              if (d.planId === sp.planId) return;
              addCalItemAsSub(d.planId, sp.planId);
            } catch(err) {}
          });
          return bar;
        };

        const dayProjects = (getProjectsForDate?.(key) || [])
          .filter(p => currentCategory === 'all' || (p.category || 'work') === currentCategory);
        const spans = spanMap[key] || [];
        const dayItems = getPlansByDate(key);
        const visibleDayItems = hideDoneItems ? dayItems.filter(it => !it.done) : dayItems;
        const pendingHere = (pendingSubMap[key] || []).filter(ps =>
          currentCategory === 'all' || (ps.item?.category || 'work') === currentCategory
        );
        const completedHere = hideDoneItems ? [] : (completedSubMap[key] || []).filter(cs =>
          currentCategory === 'all' || (cs.item?.category || 'work') === currentCategory
        );
        const mkPendingSubEl = (ps) => {
          const subEl = document.createElement('div'); subEl.className = 'item item-sub';
          const st = document.createElement('span'); st.textContent = '☐ ' + ps.sub.text;
          subEl.onclick = e => { e.stopPropagation(); openDetail(ps.planId, subEl); };
          subEl.appendChild(st); return subEl;
        };
        const mkDoneSubEl = (cs) => {
          const subEl = document.createElement('div'); subEl.className = 'item item-sub item-done';
          const st = document.createElement('span'); st.textContent = '✓ ' + cs.sub.text;
          subEl.onclick = e => { e.stopPropagation(); openDetail(cs.planId, subEl); };
          subEl.appendChild(st); return subEl;
        };
        const renderedPk = new Set();

        const MAX_VISIBLE = 4;
        let slotsLeft = MAX_VISIBLE;

        // ── 프로젝트 그룹 렌더 ──
        dayProjects.forEach(p => {
          if (slotsLeft <= 0) return;
          const globalIdx = projects.indexOf(p);

          const group = document.createElement('div');
          group.className = 'proj-cell-group';
          group.style.borderLeftColor = p.color || '#4f86f7';
          group.title = p.name;

          spans.forEach(sp => {
            if (sp.item.projectId !== p.id) return;
            if (currentCategory !== 'all' && (sp.item.category || 'work') !== currentCategory) return;
            group.appendChild(mkSpanEl(sp));
            const pk = sp.planId; renderedPk.add(pk);
            pendingHere.filter(ps => ps.planId === pk).forEach(ps => group.appendChild(mkPendingSubEl(ps)));
            completedHere.filter(cs => cs.planId === pk).forEach(cs => group.appendChild(mkDoneSubEl(cs)));
          });

          visibleDayItems.forEach((it) => {
            if (it.startDate !== it.endDate) return;
            if (it.projectId !== p.id) return;
            if (currentCategory !== 'all' && (it.category || 'work') !== currentCategory) return;
            group.appendChild(mkItemEl(it, it.planId));
            const pk = it.planId; renderedPk.add(pk);
            pendingHere.filter(ps => ps.planId === pk).forEach(ps => group.appendChild(mkPendingSubEl(ps)));
            completedHere.filter(cs => cs.planId === pk).forEach(cs => group.appendChild(mkDoneSubEl(cs)));
          });

          if (!group.hasChildNodes()) return;
          cell.appendChild(group);
          slotsLeft--;
        });

        // ── 독립 스팬 바 (프로젝트 미연결) ──
        const standaloneSpans = spans.filter(sp => {
          if (currentCategory !== 'all' && (sp.item.category || 'work') !== currentCategory) return false;
          if (hideDoneItems && sp.item.done) return false;
          return !sp.item.projectId || !projects.find(p => p.id === sp.item.projectId);
        });
        const spansToShow = standaloneSpans.slice(0, slotsLeft);
        slotsLeft -= spansToShow.length;
        if (spansToShow.length) {
          const sbars = document.createElement('div'); sbars.className = 'span-bars';
          spansToShow.forEach(sp => {
            sbars.appendChild(mkSpanEl(sp));
            const pk = sp.planId; renderedPk.add(pk);
            pendingHere.filter(ps => ps.planId === pk).forEach(ps => sbars.appendChild(mkPendingSubEl(ps)));
            completedHere.filter(cs => cs.planId === pk).forEach(cs => sbars.appendChild(mkDoneSubEl(cs)));
          });
          cell.appendChild(sbars);
        }

        // ── 독립 일반 아이템 ──
        const standaloneItemsAll = [];
        visibleDayItems.forEach((it) => {
          if (it.startDate !== it.endDate) return;
          if (currentCategory !== 'all' && (it.category || 'work') !== currentCategory) return;
          if (it.projectId && projects.find(p => p.id === it.projectId)) return;
          standaloneItemsAll.push(it);
        });
        const itemsToShow = standaloneItemsAll.slice(0, slotsLeft);
        const idiv = document.createElement('div'); idiv.className = 'items';
        itemsToShow.forEach((it) => {
          idiv.appendChild(mkItemEl(it, it.planId));
          const pk = it.planId; renderedPk.add(pk);
          pendingHere.filter(ps => ps.planId === pk).forEach(ps => idiv.appendChild(mkPendingSubEl(ps)));
          completedHere.filter(cs => cs.planId === pk).forEach(cs => idiv.appendChild(mkDoneSubEl(cs)));
        });

        // ── 고아 완료 세부일정 ──
        completedHere.filter(cs => !renderedPk.has(cs.planId)).forEach(cs => {
          if (!renderedPk.has(cs.planId)) {
            const parentEl = document.createElement('div');
            parentEl.className = 'item cat-' + (cs.item?.category || 'work');
            parentEl.style.borderLeftColor = getItemDisplayColor(cs.item);
            const dot = document.createElement('span'); dot.className = 'item-dot'; dot.style.background = getItemDisplayColor(cs.item);
            const txt = document.createElement('span'); txt.className = 'item-text'; txt.textContent = cs.item?.text;
            parentEl.onclick = e => { e.stopPropagation(); openDetail(cs.planId, parentEl); };
            parentEl.appendChild(dot); parentEl.appendChild(txt);
            idiv.appendChild(parentEl); renderedPk.add(cs.planId);
          }
          idiv.appendChild(mkDoneSubEl(cs));
        });

        // ── 고아 미완료 세부일정 ──
        const orphanedPending = pendingHere.filter(ps => !renderedPk.has(ps.planId));
        if (orphanedPending.length > 0) {
          const pgroups = new Map();
          orphanedPending.forEach(ps => {
            if (!pgroups.has(ps.planId)) pgroups.set(ps.planId, { item: ps.item, subs: [] });
            pgroups.get(ps.planId).subs.push(ps.sub);
          });
          pgroups.forEach(({ item, subs }, pid) => {
            const parentEl = document.createElement('div');
            parentEl.className = 'item cat-' + (item?.category || 'work');
            parentEl.style.borderLeftColor = getItemDisplayColor(item);
            const dot = document.createElement('span'); dot.className = 'item-dot'; dot.style.background = getItemDisplayColor(item);
            const txt = document.createElement('span'); txt.className = 'item-text'; txt.textContent = item?.text;
            parentEl.onclick = e => { e.stopPropagation(); openDetail(pid, parentEl); };
            parentEl.appendChild(dot); parentEl.appendChild(txt); idiv.appendChild(parentEl);
            subs.forEach(sub => {
              const subEl = document.createElement('div'); subEl.className = 'item item-sub';
              const st = document.createElement('span'); st.textContent = '☐ ' + sub.text;
              subEl.onclick = e => { e.stopPropagation(); openDetail(pid, subEl); };
              subEl.appendChild(st); idiv.appendChild(subEl);
            });
          });
        }

        cell.appendChild(idiv);

        // ── 빈 셀 클래스 ──
        const totalSlots = dayProjects.length + standaloneSpans.length + standaloneItemsAll.length;
        if (totalSlots === 0) cell.classList.add('cell-no-items');

        // ── +N 더보기 ──
        if (totalSlots > MAX_VISIBLE) {
          const moreBtn = document.createElement('div');
          moreBtn.className = 'cell-more-btn';
          moreBtn.textContent = '+' + (totalSlots - MAX_VISIBLE) + '개';
          moreBtn.onclick = e => { e.stopPropagation(); openDayPopover(key, cell); };
          cell.appendChild(moreBtn);
        }
      }
      row.appendChild(cell);
    }
    body.appendChild(row);
  }
}

// ── 모달 (일정 추가/수정) ──
function renderCategoryBtns() {
  document.querySelectorAll('#modalCatRow .modal-cat-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === modal.category);
  });
}
function openModal(key, editPlanId, anchor) {
  modal.dateKey = key; modal.editPlanId = editPlanId; modal.colorIdx = 0;
  const inp = document.getElementById('modalInput');
  if (editPlanId !== null && editPlanId !== undefined) {
    const it = hydratePlan(editPlanId); inp.value = it.text;
    modal.category = it.category || 'work';
    const palette = modal.category === 'personal' ? COLORS_PERSONAL : COLORS_WORK;
    modal.colorIdx = palette.indexOf(it.color) >= 0 ? palette.indexOf(it.color) : 0;
    document.getElementById('modalStartDate').value = it.startDate || '';
    document.getElementById('modalEndDate').value   = it.endDate   || '';
    document.getElementById('modalTitle').textContent = `✏️ 수정 — ${key}`;
    document.getElementById('btnSave').textContent = '수정';
  } else {
    inp.value = '';
    modal.category = currentCategory !== 'all' ? currentCategory : 'work';
    modal.colorIdx = 0;
    document.getElementById('modalStartDate').value = '';
    document.getElementById('modalEndDate').value   = '';
    document.getElementById('modalTitle').textContent = `📝 추가 — ${key}`;
    document.getElementById('btnSave').textContent = '추가';
  }
  renderCategoryBtns();
  renderColorRow();
  const rect = anchor.getBoundingClientRect();
  let left = rect.left + window.scrollX, top = rect.bottom + window.scrollY + 4;
  if (left + 240 > window.innerWidth) left = window.innerWidth - 248;
  if (top + 160 > window.innerHeight + window.scrollY) top = rect.top + window.scrollY - 164;
  const m = document.getElementById('modal');
  m.style.left = left + 'px'; m.style.top = top + 'px'; m.style.display = 'block';
  document.getElementById('overlay').classList.add('show');
  setTimeout(() => inp.focus(), 30);
}
function renderColorRow() {
  const row = document.getElementById('colorRow'); row.innerHTML = '';
  const palette = modal.category === 'personal' ? COLORS_PERSONAL : COLORS_WORK;
  palette.forEach((c, i) => {
    const dot = document.createElement('div');
    dot.className = 'color-dot' + (i === modal.colorIdx ? ' selected' : '');
    dot.style.background = c;
    dot.onclick = () => { modal.colorIdx = i; renderColorRow(); };
    row.appendChild(dot);
  });
}
function closeModal() {
  document.getElementById('modal').style.display = 'none';
  document.getElementById('overlay').classList.remove('show');
}
function saveItem() {
  const txt = document.getElementById('modalInput').value.trim(); if (!txt) return;
  const key = modal.dateKey;
  const startDate = document.getElementById('modalStartDate').value || key;
  const endDate   = document.getElementById('modalEndDate').value   || startDate;
  const palette = modal.category === 'personal' ? COLORS_PERSONAL : COLORS_WORK;
  if (modal.editPlanId) {
    // Edit existing
    plans[modal.editPlanId] = {...plans[modal.editPlanId], text:txt, color:palette[modal.colorIdx], startDate, endDate, category:modal.category, date:startDate};
  } else {
    const planId = newPlanId();
    plans[planId] = {date:key, text:txt, color:palette[modal.colorIdx], startDate, endDate, category:modal.category, done:false, projectId:null};
  }
  savePlans(); closeModal(); renderAll();
}

// ── 아이템 이동 (드래그앤드롭) ──
function moveCalItem(planId, fromDisplayKey, toKey) {
  if (fromDisplayKey === toKey) return;
  const plan = plans[planId]; if (!plan) return;
  const diffDays = Math.round((new Date(toKey+'T00:00:00')-new Date(fromDisplayKey+'T00:00:00'))/86400000);
  const shiftDate = ds => { const d=new Date(ds+'T00:00:00'); d.setDate(d.getDate()+diffDays); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  plan.date = shiftDate(plan.startDate);
  plan.startDate = shiftDate(plan.startDate);
  plan.endDate = shiftDate(plan.endDate);
  closeDetail(); savePlans(); renderAll();
}

// ── 세부일정을 독립 일정으로 분리 (드래그앤드롭) ──
function extractSubToItem(planId, subId, targetKey) {
  const sub = subTasks[subId]; if (!sub) return;
  const parentPlan = plans[planId]; if (!parentPlan) return;
  const newId = newPlanId();
  plans[newId] = { text:sub.text, color:parentPlan.color, category:parentPlan.category||'work', done:sub.done||false, date:targetKey, startDate:targetKey, endDate:targetKey, projectId:null };
  delete subTasks[subId];
  if (typeof detailState !== 'undefined' && detailState.planId === planId) {
    savePlans(); saveSubTasks(); renderAll(); renderDetailPanel();
  } else {
    savePlans(); saveSubTasks(); renderAll();
  }
}

// ── 아이템을 다른 아이템의 세부일정으로 추가 (드래그앤드롭) ──
function addCalItemAsSub(srcPlanId, tgtPlanId, keepPanel) {
  const srcPlan = plans[srcPlanId]; if (!srcPlan) return;
  const tgtPlan = plans[tgtPlanId]; if (!tgtPlan) return;
  const subId = newSubId();
  // Count existing subs for order
  const existingOrder = Object.values(subTasks).filter(s=>s.parentPlanId===tgtPlanId).length;
  subTasks[subId] = { parentPlanId:tgtPlanId, text:srcPlan.text, done:srcPlan.done||false, dueDate:srcPlan.startDate, completedAt: srcPlan.done ? srcPlan.date : '', order:existingOrder };
  // Delete source subTasks too
  Object.keys(subTasks).forEach(sid => { if (subTasks[sid].parentPlanId===srcPlanId) delete subTasks[sid]; });
  delete plans[srcPlanId];
  if (!keepPanel) closeDetail();
  savePlans(); saveSubTasks(); renderAll();
  if (keepPanel && typeof renderDetailPanel==='function') renderDetailPanel();
}

// ── 아이템 삭제 ──
function deletePlan(planId) {
  // Also delete associated subTasks
  Object.keys(subTasks).forEach(subId => { if (subTasks[subId].parentPlanId === planId) delete subTasks[subId]; });
  delete plans[planId];
  savePlans(); saveSubTasks(); renderAll();
}
// Backward compat alias
function deleteItem(planId) { deletePlan(planId); }

// ── CSV 내보내기 ──
function exportCSV() {
  const dim = new Date(year, month+1, 0).getDate();
  const rows = [['"날짜"', '"요일"', '"일정"']];
  for (let d = 1; d <= dim; d++) {
    const key = dateKey(year, month, d);
    const dow = DAYS_KR[new Date(year, month, d).getDay()];
    const items = getPlansByDate(key);
    if (!items.length) rows.push([`"${key}"`, `"${dow}"`, '""']);
    else items.forEach(it => rows.push([`"${key}"`, `"${dow}"`, `"${it.text.replace(/"/g,'""')}"`]));
  }
  const blob = new Blob(['\uFEFF' + rows.map(r => r.join(',')).join('\n')], { type:'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `${year}년_${month+1}월_계획.csv`; a.click();
}

// ── 이벤트 ──
document.getElementById('btnPrev').onclick    = () => { if (month===0){year--;month=11;} else month--; renderAll(); };
document.getElementById('btnNext').onclick    = () => { if (month===11){year++;month=0;} else month++; renderAll(); };
document.getElementById('btnToday').onclick   = () => { year=today.getFullYear(); month=today.getMonth(); renderAll(); };
document.getElementById('btnCsv').onclick     = exportCSV;
document.getElementById('btnSave').onclick    = saveItem;
document.getElementById('btnCancel').onclick  = closeModal;
document.getElementById('overlay').onclick    = () => {
  if (document.getElementById('modal').style.display !== 'none') closeModal();
  else closeDetail();
};
document.getElementById('modalInput').onkeydown = e => { if (e.key === 'Enter') saveItem(); };
document.querySelectorAll('.cat-btn').forEach(btn => {
  btn.onclick = () => {
    currentCategory = btn.dataset.cat;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderAll();
  };
});
document.querySelectorAll('#modalCatRow .modal-cat-btn').forEach(btn => {
  btn.onclick = () => {
    modal.category = btn.dataset.cat;
    modal.colorIdx = 0;
    renderCategoryBtns();
    renderColorRow();
  };
});

// ── 완료 숨기기 토글 ──
document.getElementById('btnToggleDone').onclick = () => {
  hideDoneItems = !hideDoneItems;
  document.getElementById('btnToggleDone').classList.toggle('active', hideDoneItems);
  renderAll();
};

// ── 도움말 ──
function openHelp() {
  document.getElementById('helpOverlay').classList.add('open');
  document.getElementById('helpDialog').classList.add('open');
}
function closeHelp() {
  document.getElementById('helpOverlay').classList.remove('open');
  document.getElementById('helpDialog').classList.remove('open');
}
document.getElementById('btnHelpOpen').onclick  = openHelp;
document.getElementById('btnHelpClose').onclick = closeHelp;
document.getElementById('helpOverlay').onclick  = closeHelp;

// ── 날짜별 전체 일정 팝오버 ──
function openDayPopover(key, anchor) {
  const popover = document.getElementById('dayPopover');
  const [y, m, d] = key.split('-').map(Number);
  const dn = new Date(y, m-1, d).getDay();
  const dayNames = ['일','월','화','수','목','금','토'];
  document.getElementById('dayPopoverTitle').textContent = `${m}월 ${d}일 (${dayNames[dn]})`;

  const list = document.getElementById('dayPopoverList');
  list.innerHTML = '';

  const sm = buildSpanMap();
  const allProjects = (getProjectsForDate?.(key) || [])
    .filter(p => currentCategory === 'all' || (p.category || 'work') === currentCategory);
  const allSpans = (sm[key] || []).filter(sp =>
    (currentCategory === 'all' || (sp.item.category || 'work') === currentCategory) &&
    (!sp.item.projectId || !projects.find(p => p.id === sp.item.projectId))
  );

  const addRow = (color, name, badge, onClick) => {
    const row = document.createElement('div'); row.className = 'dpop-row';
    const dot = document.createElement('span'); dot.className = 'dpop-dot'; dot.style.background = color;
    const nm  = document.createElement('span'); nm.className = 'dpop-name'; nm.textContent = name;
    if (badge) { const b = document.createElement('span'); b.className = 'dpop-badge'; b.textContent = badge; nm.appendChild(b); }
    row.appendChild(dot); row.appendChild(nm);
    row.onclick = onClick;
    list.appendChild(row);
  };

  allProjects.forEach(p => {
    addRow(p.color, p.name, '프로젝트', () => { closeDayPopover(); openProjectDetail?.(projects.indexOf(p)); });
  });
  allSpans.forEach(sp => {
    addRow(sp.item.color || '#4f86f7', sp.item.text, null, () => { closeDayPopover(); openDetail(sp.planId); });
  });
  getPlansByDate(key).forEach((it) => {
    if (!it) return;
    if (currentCategory !== 'all' && (it.category || 'work') !== currentCategory) return;
    addRow(it.color || '#4f86f7', it.text, null, () => { closeDayPopover(); openDetail(it.planId); });
  });

  const pw = 240, ph = 300;
  const rect = anchor.getBoundingClientRect();
  let left = rect.left;
  if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
  if (left < 8) left = 8;
  let top = rect.bottom + 4;
  if (top + ph > window.innerHeight) top = Math.max(8, rect.top - ph);
  popover.style.left = left + 'px';
  popover.style.top  = top  + 'px';
  popover.classList.add('open');
  document.getElementById('dayPopoverBg').classList.add('open');
  document.getElementById('btnDayPopoverAdd').onclick = () => { closeDayPopover(); openModal(key, null, popover); };
}

function closeDayPopover() {
  document.getElementById('dayPopover').classList.remove('open');
  document.getElementById('dayPopoverBg').classList.remove('open');
}

document.getElementById('btnDayPopoverClose').onclick = closeDayPopover;
document.getElementById('dayPopoverBg').onclick = closeDayPopover;

// ── 월간/주간 탭 전환 ──
document.querySelectorAll('.cal-view-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.cal-view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const isMonth = btn.dataset.view === 'month';
    document.getElementById('calViewMonth').style.display = isMonth ? '' : 'none';
    document.getElementById('calViewWeek').style.display  = isMonth ? 'none' : '';
    document.getElementById('monthNav').style.display = isMonth ? '' : 'none';
    document.getElementById('weekNav').style.display  = isMonth ? 'none' : '';
    if (!isMonth) renderWeek();
  };
});
