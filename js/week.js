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

    const completedHere = completedSubMap[key] || [];
    const renderedPk = new Set();

    // ── 헬퍼: 완료 세부일정 아이템 ──
    const mkSubEl = (cs) => {
      const si = document.createElement('div'); si.className = 'item item-sub';
      const st = document.createElement('span'); st.textContent = '✓ ' + cs.sub.text;
      si.onclick = e => { e.stopPropagation(); openDetail(cs.planId, si); };
      si.appendChild(st); return si;
    };

    // ── 헬퍼: 일반 아이템 ──
    const mkItemEl = (it, planId) => {
      const item = document.createElement('div');
      item.className = 'item cat-' + (it.category || 'work');
      const dot = document.createElement('span'); dot.className = 'item-dot'; dot.style.background = getItemDisplayColor(it);
      const txt = document.createElement('span'); txt.textContent = it.text + getProgressText(it);
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
      bar.className = 'span-bar span-' + sp.pos + ' cat-' + (sp.item.category || 'work');
      const spColor = getItemDisplayColor(sp.item);
      bar.style.background = spColor;
      bar.style.color = getContrastColor(spColor);
      bar.textContent = sp.item.text + getProgressText(sp.item);
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

    // ── 프로젝트 그룹 ──
    dayProjects.forEach(p => {
      const globalIdx = projects.indexOf(p);
      const { total, done: doneCount } = getProjectProgress?.(p.id) || { total: 0, done: 0 };
      const [r, g, b] = hexToRgb(p.color);

      const group = document.createElement('div');
      group.className = 'proj-cell-group';

      const pb = document.createElement('div');
      pb.className = 'project-bar cat-' + (p.category || 'work') + (p.done ? ' is-done' : '');
      pb.style.background = `rgba(${r},${g},${b},0.13)`;
      pb.style.borderLeft = `3px solid ${p.color}`;
      pb.style.color = p.color;
      pb.textContent = p.name + (total ? ` (${doneCount}/${total})` : '');
      pb.title = p.done ? `완료: ${p.doneDate}` : `${p.startDate} ~ ${p.endDate}`;
      if (!p.done) pb.onclick = e => { e.stopPropagation(); openProjectDetail?.(globalIdx); };
      group.appendChild(pb);

      spans.forEach(sp => {
        if (sp.item.projectId !== p.id) return;
        if (currentCategory !== 'all' && (sp.item.category || 'work') !== currentCategory) return;
        group.appendChild(mkSpanEl(sp));
        const pk = sp.planId;
        completedHere.filter(cs => cs.planId === sp.planId).forEach(cs => {
          group.appendChild(mkSubEl(cs)); renderedPk.add(pk);
        });
      });

      dayItems.forEach((it) => {
        if (it.startDate !== it.endDate) return;
        if (it.projectId !== p.id) return;
        if (currentCategory !== 'all' && (it.category || 'work') !== currentCategory) return;
        group.appendChild(mkItemEl(it, it.planId));
        const pk = it.planId; renderedPk.add(pk);
        completedHere.filter(cs => cs.planId === it.planId).forEach(cs => {
          group.appendChild(mkSubEl(cs));
        });
      });

      cell.appendChild(group);
    });

    // ── 독립 스팬 바 ──
    const standaloneSpans = spans.filter(sp => {
      if (currentCategory !== 'all' && (sp.item.category || 'work') !== currentCategory) return false;
      return !sp.item.projectId || !projects.find(p => p.id === sp.item.projectId);
    });
    if (standaloneSpans.length) {
      const sbars = document.createElement('div'); sbars.className = 'span-bars';
      standaloneSpans.forEach(sp => {
        sbars.appendChild(mkSpanEl(sp));
        const pk = sp.planId;
        completedHere.filter(cs => cs.planId === sp.planId).forEach(cs => {
          sbars.appendChild(mkSubEl(cs)); renderedPk.add(pk);
        });
      });
      cell.appendChild(sbars);
    }

    // ── 독립 일반 아이템 ──
    const idiv = document.createElement('div'); idiv.className = 'items';
    dayItems.forEach((it) => {
      if (it.startDate !== it.endDate) return;
      if (currentCategory !== 'all' && (it.category || 'work') !== currentCategory) return;
      if (it.projectId && projects.find(p => p.id === it.projectId)) return;
      idiv.appendChild(mkItemEl(it, it.planId));
      const pk = it.planId; renderedPk.add(pk);
      completedHere.filter(cs => cs.planId === it.planId).forEach(cs => {
        idiv.appendChild(mkSubEl(cs));
      });
    });
    // ── 고아 완료 세부일정 (부모가 이 날에 표시되지 않은 경우) ──
    const orphanedSubs = completedHere.filter(cs =>
      !renderedPk.has(cs.planId) &&
      (currentCategory === 'all' || (cs.item.category || 'work') === currentCategory)
    );
    const orphanGroups = new Map();
    orphanedSubs.forEach(cs => {
      const pk = cs.planId;
      if (!orphanGroups.has(pk)) orphanGroups.set(pk, []);
      orphanGroups.get(pk).push(cs);
    });
    orphanGroups.forEach((subs) => {
      const firstCs = subs[0];
      const parentEl = document.createElement('div');
      parentEl.className = 'item cat-' + (firstCs.item.category || 'work');
      const dot = document.createElement('span'); dot.className = 'item-dot'; dot.style.background = getItemDisplayColor(firstCs.item);
      const txt = document.createElement('span'); txt.textContent = firstCs.item.text + getProgressText(firstCs.item);
      parentEl.onclick = e => { e.stopPropagation(); openDetail(firstCs.planId, parentEl); };
      parentEl.appendChild(dot); parentEl.appendChild(txt);
      idiv.appendChild(parentEl);
      subs.forEach(cs => idiv.appendChild(mkSubEl(cs)));
    });
    cell.appendChild(idiv);

    // ── 빈 셀 클래스 ──
    const dayProjects2 = (getProjectsForDate?.(key) || []).filter(p => currentCategory === 'all' || (p.category || 'work') === currentCategory);
    const spans2 = spanMap[key] || [];
    const dayItems2 = getPlansByDate(key);
    const hasContent = dayProjects2.length || spans2.length || dayItems2.length || completedHere.length;
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
