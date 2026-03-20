// ── 주간 캘린더 렌더 ──
function getWeekStart(base) {
  const d = new Date(base); d.setDate(d.getDate() - d.getDay()); return d;
}

function renderWeek() {
  const ws = getWeekStart(weekBase), we = new Date(ws); we.setDate(we.getDate()+6);
  const fmt = d => `${d.getMonth()+1}/${d.getDate()}`;
  document.getElementById('weekLabel').textContent =
    `${ws.getFullYear()}년 ${fmt(ws)}(일) ~ ${fmt(we)}(토)`;

  const grid = document.getElementById('weeklyGrid');
  grid.innerHTML = '';

  const spanMap = buildSpanMap();
  const pendingSubMap = buildPendingSubMap();
  const completedSubMap = buildCompletedSubMap();

  // ── 요일 헤더 ──
  const hdrRow = document.createElement('div');
  hdrRow.className = 'day-headers';
  ['일','월','화','수','목','금','토'].forEach((nm, i) => {
    const h = document.createElement('div');
    h.className = 'day-header' + (i===0?' sun':i===6?' sat':' week');
    h.textContent = nm;
    hdrRow.appendChild(h);
  });
  grid.appendChild(hdrRow);

  // ── 셀 행 ──
  const row = document.createElement('div');
  row.className = 'week-row week-row-single';

  for (let di = 0; di < 7; di++) {
    const cur = new Date(ws); cur.setDate(ws.getDate() + di);
    const y2 = cur.getFullYear(), m2 = cur.getMonth(), d2 = cur.getDate();
    const key = dateKey(y2, m2, d2);
    const isTd = isToday(d2, m2, y2);
    const isHol = !!holidays[key];

    const cell = document.createElement('div');
    cell.className = 'cell' + (isTd ? ' today' : '');

    // ── 날짜 헤더 ──
    const hdr = document.createElement('div'); hdr.className = 'cell-header';
    const num = document.createElement('span');
    num.className = 'date-num' +
      (isTd ? ' today-num' : isHol && di!==0 ? ' holiday-num' : di===0 ? ' sun-num' : di===6 ? ' sat-num' : '');
    num.textContent = d2;
    // 월 표기 (1일이거나 주의 첫 날이면 표시)
    if (d2 === 1 || di === 0) {
      const ml = document.createElement('span');
      ml.className = 'week-month-lbl';
      ml.textContent = `${m2+1}월`;
      hdr.appendChild(ml);
    }
    const ab = document.createElement('button'); ab.className = 'add-btn'; ab.textContent = '+';
    ab.onclick = e => { e.stopPropagation(); openDayPopover(key, e.currentTarget); };
    hdr.appendChild(num); hdr.appendChild(ab);
    cell.appendChild(hdr);

    // ── 드래그 앤 드롭 ──
    cell.addEventListener('dragover', e => {
      const hasCal = e.dataTransfer.types.includes('application/x-cal-item');
      const hasSub = e.dataTransfer.types.includes('application/x-sub-item');
      if (!hasCal && !hasSub) return;
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
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
      }
    });

    // ── 공휴일 ──
    if (isHol) {
      const holDiv = document.createElement('div'); holDiv.className = 'cell-holiday';
      holDiv.textContent = holidays[key]; cell.appendChild(holDiv);
    }

    // ── 헬퍼: 일반 아이템 ──
    const mkItemEl = (it, planId) => {
      const item = document.createElement('div');
      const subs = it.sub || [];
      const hasPendingSubs = subs.some(s => !s.done);
      const isVisuallyDone = subs.length > 0 ? subs.every(s => s.done) : it.done;
      const proj = it.projectId ? projects.find(p => Number(p.id) === Number(it.projectId)) : null;
      const isPastEvent = it.type === 'event' && (it.endDate || it.date || key) < localDateStr();
      item.className = 'item cat-' + (it.category || 'work') +
        (it.type === 'event' ? ' item-event' : '') +
        (isVisuallyDone && it.type !== 'event' ? ' item-done' : '') +
        (hasPendingSubs ? ' item-inprogress' : '');
      if (it.type === 'event') {
        item.style.opacity = isPastEvent ? '0.35' : '1';
        item.style.filter  = isPastEvent ? 'saturate(0.25)' : 'none';
      }
      if (proj) item.dataset.tooltip = '📁 ' + proj.name;
      const itemDisplayColor = getItemDisplayColor(it);
      item.style.borderLeftColor = proj ? (proj.color || itemDisplayColor) : itemDisplayColor;
      const dot = document.createElement('span'); dot.className = 'item-dot'; dot.style.background = itemDisplayColor;
      const content = document.createElement('div'); content.className = 'item-content';
      const txt = document.createElement('span'); txt.className = 'item-text'; txt.textContent = it.text;
      content.appendChild(txt);
      const del = document.createElement('span'); del.className = 'del'; del.textContent = '✕';
      del.onclick = e => { e.stopPropagation(); deletePlan(planId); };
      item.onclick = e => { e.stopPropagation(); openDetail(planId, e.currentTarget); };
      item.draggable = true;
      item.addEventListener('dragstart', e => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('application/x-cal-item', JSON.stringify({ planId, fromDisplayKey: key })); setTimeout(() => item.classList.add('dragging'), 0); });
      item.addEventListener('dragend', () => item.classList.remove('dragging'));
      item.appendChild(dot); item.appendChild(content); item.appendChild(del);
      return item;
    };

    // ── 헬퍼: 스팬 바 ──
    const mkSpanEl = (sp) => {
      const bar = document.createElement('div');
      const spSubs = sp.item.sub || [];
      const spHasPending = spSubs.some(s => !s.done);
      const spVisuallyDone = spSubs.length > 0 ? spSubs.every(s => s.done) : sp.item.done;
      bar.className = 'span-bar span-' + sp.pos + ' cat-' + (sp.item.category || 'work') +
        (spVisuallyDone ? ' span-bar-done' : '') +
        (spHasPending ? ' span-bar-inprogress' : '');
      const spColor = getItemDisplayColor(sp.item);
      const spProj = sp.item.projectId ? projects.find(p => Number(p.id) === Number(sp.item.projectId)) : null;
      bar.style.borderLeftColor = spProj ? (spProj.color || spColor) : spColor;
      const sdot = document.createElement('span'); sdot.className = 'item-dot'; sdot.style.background = spColor;
      const stxt = document.createElement('span'); stxt.className = 'item-text'; stxt.textContent = sp.item.text + getProgressText(sp.item);
      const sdel = document.createElement('span'); sdel.className = 'del'; sdel.textContent = '✕';
      sdel.onclick = e => { e.stopPropagation(); deletePlan(sp.planId); };
      bar.appendChild(sdot); bar.appendChild(stxt); bar.appendChild(sdel);
      bar.onclick = e => { e.stopPropagation(); openDetail(sp.planId, bar); };
      bar.draggable = true;
      bar.addEventListener('dragstart', e => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('application/x-cal-item', JSON.stringify({ planId: sp.planId, fromDisplayKey: key })); setTimeout(() => bar.classList.add('dragging'), 0); });
      bar.addEventListener('dragend', () => bar.classList.remove('dragging'));
      return bar;
    };

    const spans = spanMap[key] || [];
    const dayItems = getPlansByDate(key);
    const visibleDayItems = hideDoneItems ? dayItems.filter(it => !it.done) : dayItems;
    const allPendingHere = pendingSubMap[key] || [];
    const allCompletedHere = hideDoneItems ? [] : (completedSubMap[key] || []);

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

    const renderColContent = (container, catFilter) => {
      const colRpk = new Set();
      const pendingHere = allPendingHere.filter(ps => (ps.item?.category || 'work') === catFilter);
      const completedHere = allCompletedHere.filter(cs => (cs.item?.category || 'work') === catFilter);

      const eventItems = visibleDayItems.filter(it =>
        it.type === 'event' && it.startDate === it.endDate && (it.category || 'work') === catFilter
      );
      const eventSpans = spans.filter(sp =>
        sp.item.type === 'event' && (sp.item.category || 'work') === catFilter
      );
      if (eventItems.length || eventSpans.length) {
        const evDiv = document.createElement('div'); evDiv.className = 'events-bar';
        eventSpans.forEach(sp => { evDiv.appendChild(mkSpanEl(sp)); colRpk.add(sp.planId); });
        eventItems.forEach(it => { evDiv.appendChild(mkItemEl(it, it.planId)); colRpk.add(it.planId); });
        container.appendChild(evDiv);
      }

      const colProjSet = new Map();
      (getProjectsForDate?.(key) || []).forEach(p => colProjSet.set(Number(p.id), p));
      visibleDayItems.forEach(it => {
        if (it.projectId && (it.category || 'work') === catFilter) {
          const id = Number(it.projectId);
          if (!colProjSet.has(id)) { const p = projects.find(p2 => Number(p2.id) === id); if (p) colProjSet.set(id, p); }
        }
      });
      spans.forEach(sp => {
        if (sp.item.projectId && (sp.item.category || 'work') === catFilter) {
          const id = Number(sp.item.projectId);
          if (!colProjSet.has(id)) { const p = projects.find(p2 => Number(p2.id) === id); if (p) colProjSet.set(id, p); }
        }
      });
      const colProjects = [...colProjSet.values()];
      colProjects.forEach(p => {
        const group = document.createElement('div');
        group.className = 'proj-cell-group';
        group.style.borderLeftColor = p.color || '#4f86f7';
        group.title = p.name;
        spans.forEach(sp => {
          if (colRpk.has(sp.planId)) return;
          if (Number(sp.item.projectId) !== Number(p.id)) return;
          if ((sp.item.category || 'work') !== catFilter) return;
          group.appendChild(mkSpanEl(sp));
          const pk = sp.planId; colRpk.add(pk);
          pendingHere.filter(ps => ps.planId === pk).forEach(ps => group.appendChild(mkPendingSubEl(ps)));
          completedHere.filter(cs => cs.planId === pk).forEach(cs => group.appendChild(mkDoneSubEl(cs)));
        });
        visibleDayItems.forEach(it => {
          if (colRpk.has(it.planId)) return;
          if (it.startDate !== it.endDate) return;
          if (Number(it.projectId) !== Number(p.id)) return;
          if ((it.category || 'work') !== catFilter) return;
          group.appendChild(mkItemEl(it, it.planId));
          const pk = it.planId; colRpk.add(pk);
          pendingHere.filter(ps => ps.planId === pk).forEach(ps => group.appendChild(mkPendingSubEl(ps)));
          completedHere.filter(cs => cs.planId === pk).forEach(cs => group.appendChild(mkDoneSubEl(cs)));
        });
        if (!group.hasChildNodes()) return;
        container.appendChild(group);
      });

      const colStandaloneSpans = spans.filter(sp => {
        if (colRpk.has(sp.planId)) return false;
        if ((sp.item.category || 'work') !== catFilter) return false;
        if (hideDoneItems && sp.item.done) return false;
        return !sp.item.projectId || !colProjSet.has(Number(sp.item.projectId));
      });
      if (colStandaloneSpans.length) {
        const sbars = document.createElement('div'); sbars.className = 'span-bars';
        colStandaloneSpans.forEach(sp => {
          sbars.appendChild(mkSpanEl(sp));
          const pk = sp.planId; colRpk.add(pk);
          pendingHere.filter(ps => ps.planId === pk).forEach(ps => sbars.appendChild(mkPendingSubEl(ps)));
          completedHere.filter(cs => cs.planId === pk).forEach(cs => sbars.appendChild(mkDoneSubEl(cs)));
        });
        container.appendChild(sbars);
      }

      const idiv = document.createElement('div'); idiv.className = 'items';
      visibleDayItems.forEach(it => {
        if (colRpk.has(it.planId)) return;
        if (it.startDate !== it.endDate) return;
        if ((it.category || 'work') !== catFilter) return;
        if (it.projectId && colProjSet.has(Number(it.projectId))) return;
        idiv.appendChild(mkItemEl(it, it.planId));
        const pk = it.planId; colRpk.add(pk);
        pendingHere.filter(ps => ps.planId === pk).forEach(ps => idiv.appendChild(mkPendingSubEl(ps)));
        completedHere.filter(cs => cs.planId === pk).forEach(cs => idiv.appendChild(mkDoneSubEl(cs)));
      });

      completedHere.filter(cs => !colRpk.has(cs.planId)).forEach(cs => {
        if (!colRpk.has(cs.planId)) { idiv.appendChild(mkItemEl(cs.item, cs.planId)); colRpk.add(cs.planId); }
        idiv.appendChild(mkDoneSubEl(cs));
      });

      const colOrphanedPending = pendingHere.filter(ps => !colRpk.has(ps.planId));
      if (colOrphanedPending.length > 0) {
        const pgroups = new Map();
        colOrphanedPending.forEach(ps => {
          if (!pgroups.has(ps.planId)) pgroups.set(ps.planId, { item: ps.item, subs: [] });
          pgroups.get(ps.planId).subs.push(ps.sub);
        });
        const orphanProjGroups = new Map();
        pgroups.forEach(({ item, subs }, pid) => {
          const projId = item.projectId ? Number(item.projectId) : null;
          const proj = projId ? projects.find(p2 => Number(p2.id) === projId) : null;
          let target;
          if (proj) {
            if (!orphanProjGroups.has(projId)) {
              const g = document.createElement('div');
              g.className = 'proj-cell-group';
              g.style.borderLeftColor = proj.color || '#4f86f7';
              g.title = proj.name;
              orphanProjGroups.set(projId, g);
            }
            target = orphanProjGroups.get(projId);
          } else {
            target = idiv;
          }
          target.appendChild(mkItemEl(item, pid));
          subs.forEach(sub => {
            const subEl = document.createElement('div'); subEl.className = 'item item-sub';
            const st = document.createElement('span'); st.textContent = '☐ ' + sub.text;
            subEl.onclick = e => { e.stopPropagation(); openDetail(pid, subEl); };
            subEl.appendChild(st); target.appendChild(subEl);
          });
        });
        orphanProjGroups.forEach(g => container.appendChild(g));
      }
      container.appendChild(idiv);
    };

    // ── 업무/개인 분할 또는 단일 렌더 ──
    if (currentCategory === 'all') {
      const splitDiv = document.createElement('div'); splitDiv.className = 'cell-split';
      const workCol = document.createElement('div'); workCol.className = 'cell-col cell-col-work';
      const persCol = document.createElement('div'); persCol.className = 'cell-col cell-col-personal';
      const workLbl = document.createElement('div'); workLbl.className = 'cell-col-label'; workLbl.textContent = '업무';
      const persLbl = document.createElement('div'); persLbl.className = 'cell-col-label'; persLbl.textContent = '개인';
      workCol.appendChild(workLbl);
      persCol.appendChild(persLbl);
      renderColContent(workCol, 'work');
      renderColContent(persCol, 'personal');
      splitDiv.appendChild(workCol);
      splitDiv.appendChild(persCol);
      cell.appendChild(splitDiv);
    } else {
      renderColContent(cell, currentCategory);
    }

    // ── 빈 셀 클래스 ──
    const hasAny = dayItems.length > 0 || spans.length > 0 || allPendingHere.length > 0;
    if (!hasAny) cell.classList.add('cell-no-items');

    row.appendChild(cell);
  }

  grid.appendChild(row);
}

function renderAll() {
  document.querySelector('.calendar').dataset.cat = currentCategory;
  document.getElementById('weeklyGrid').dataset.cat = currentCategory;
  renderMonth(); renderWeek();
  // 현재 열린 탭도 함께 갱신
  if (typeof currentSection !== 'undefined') {
    if (currentSection === 'schedules') renderScheduleList?.();
    else if (currentSection === 'subtasks') renderSubtaskList?.();
    else if (currentSection === 'projects') renderProjectList?.();
  }
}

// ── 이벤트 ──
document.getElementById('btnWPrev').onclick  = () => { weekBase.setDate(weekBase.getDate()-7); renderWeek(); };
document.getElementById('btnWNext').onclick  = () => { weekBase.setDate(weekBase.getDate()+7); renderWeek(); };
document.getElementById('btnWToday').onclick = () => { weekBase = new Date(today); renderWeek(); };
