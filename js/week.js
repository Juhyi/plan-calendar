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
      const hasCal  = e.dataTransfer.types.includes('application/x-cal-item');
      const hasSub  = e.dataTransfer.types.includes('application/x-sub-item');
      const hasMemo = e.dataTransfer.types.includes('application/x-memo');
      if (!hasCal && !hasSub && !hasMemo) return;
      e.preventDefault(); e.dataTransfer.dropEffect = hasMemo ? 'copy' : 'move';
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

    // ── 공휴일 ──
    if (isHol) {
      const holDiv = document.createElement('div'); holDiv.className = 'cell-holiday';
      holDiv.textContent = holidays[key]; cell.appendChild(holDiv);
    }

    // ── 헬퍼: 일반 아이템 ──
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
        e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move';
        item.classList.add('drop-over');
      });
      item.addEventListener('dragleave', e => { if (!item.contains(e.relatedTarget)) item.classList.remove('drop-over'); });
      item.addEventListener('drop', e => {
        e.preventDefault(); e.stopPropagation(); item.classList.remove('drop-over');
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

    // ── 헬퍼: 스팬 바 ──
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
        e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move';
        bar.classList.add('drop-over');
      });
      bar.addEventListener('dragleave', e => { if (!bar.contains(e.relatedTarget)) bar.classList.remove('drop-over'); });
      bar.addEventListener('drop', e => {
        e.preventDefault(); e.stopPropagation(); bar.classList.remove('drop-over');
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

    // ── 프로젝트 그룹 ──
    dayProjects.forEach(p => {
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
    });

    // ── 독립 스팬 바 ──
    const standaloneSpans = spans.filter(sp => {
      if (currentCategory !== 'all' && (sp.item.category || 'work') !== currentCategory) return false;
      if (hideDoneItems && sp.item.done) return false;
      return !sp.item.projectId || !projects.find(p => p.id === sp.item.projectId);
    });
    if (standaloneSpans.length) {
      const sbars = document.createElement('div'); sbars.className = 'span-bars';
      standaloneSpans.forEach(sp => {
        sbars.appendChild(mkSpanEl(sp));
        const pk = sp.planId; renderedPk.add(pk);
        pendingHere.filter(ps => ps.planId === pk).forEach(ps => sbars.appendChild(mkPendingSubEl(ps)));
        completedHere.filter(cs => cs.planId === pk).forEach(cs => sbars.appendChild(mkDoneSubEl(cs)));
      });
      cell.appendChild(sbars);
    }

    // ── 독립 일반 아이템 ──
    const idiv = document.createElement('div'); idiv.className = 'items';
    visibleDayItems.forEach((it) => {
      if (it.startDate !== it.endDate) return;
      if (currentCategory !== 'all' && (it.category || 'work') !== currentCategory) return;
      if (it.projectId && projects.find(p => p.id === it.projectId)) return;
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
    const hasContent = dayProjects.length || standaloneSpans.length || visibleDayItems.length;
    if (!hasContent) cell.classList.add('cell-no-items');

    row.appendChild(cell);
  }

  grid.appendChild(row);
}

function renderAll() {
  document.querySelector('.calendar').dataset.cat = currentCategory;
  document.getElementById('weeklyGrid').dataset.cat = currentCategory;
  renderMonth(); renderWeek();
}

// ── 이벤트 ──
document.getElementById('btnWPrev').onclick  = () => { weekBase.setDate(weekBase.getDate()-7); renderWeek(); };
document.getElementById('btnWNext').onclick  = () => { weekBase.setDate(weekBase.getDate()+7); renderWeek(); };
document.getElementById('btnWToday').onclick = () => { weekBase = new Date(today); renderWeek(); };
