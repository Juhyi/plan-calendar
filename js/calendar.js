// ── 완료된 세부일정 맵 빌드 ──
function buildCompletedSubMap() {
  const map = {};
  Object.entries(plans).forEach(([key, items]) => {
    (items || []).forEach((it, idx) => {
      (it.sub || []).forEach(sub => {
        if (!sub.done || !sub.completedAt) return;
        if (!map[sub.completedAt]) map[sub.completedAt] = [];
        map[sub.completedAt].push({ sub, item:it, dateKey:key, itemIdx:idx });
      });
    });  
  });  
  return map;
}

// ── 기간 스팬맵 빌드 ──
function buildSpanMap() {
  const map = {};
  Object.entries(plans).forEach(([key, items]) => {
    (items || []).forEach((it, idx) => {
      if (!it.startDate || !it.endDate || it.startDate > it.endDate) return;

      const subs = it.sub || [];
      if (subs.length > 0) {
        // 세부일정이 있는 경우: completedAt 날짜에만 표시
        const completedDates = new Set(subs.filter(s => s.done && s.completedAt).map(s => s.completedAt));
        completedDates.forEach(dk => {
          if (!map[dk]) map[dk] = [];
          map[dk].push({ item:it, dateKey:key, idx, pos:'single' });
        });
        return;
      }

      // 세부일정 없는 경우: 기간 전체에 표시 (기존 동작)
      const s = new Date(it.startDate + 'T00:00:00'), e = new Date(it.endDate + 'T00:00:00');
      for (let c = new Date(s); c <= e; c.setDate(c.getDate()+1)) {
        const dk = `${c.getFullYear()}-${String(c.getMonth()+1).padStart(2,'0')}-${String(c.getDate()).padStart(2,'0')}`;
        if (!map[dk]) map[dk] = [];
        const isSt = dk === it.startDate, isEn = dk === it.endDate;
        map[dk].push({ item:it, dateKey:key, idx, pos: isSt&&isEn?'single':isSt?'start':isEn?'end':'mid' });
      }
    });
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
        ab.onclick = e => { e.stopPropagation(); openModal(key, null, e.currentTarget); };
        hdr.appendChild(num); hdr.appendChild(ab); cell.appendChild(hdr);

        // 드래그 앤 드롭 (메모 + 캘린더 아이템)
        cell.addEventListener('dragover', e => {
          const hasMemo = e.dataTransfer.types.includes('application/x-memo');
          const hasCal  = e.dataTransfer.types.includes('application/x-cal-item');
          if (!hasMemo && !hasCal) return;
          e.preventDefault(); e.dataTransfer.dropEffect = hasCal ? 'move' : 'copy';
          cell.classList.add('drag-over');
        });
        cell.addEventListener('dragleave', e => {
          if (!cell.contains(e.relatedTarget)) cell.classList.remove('drag-over');
        });
        cell.addEventListener('drop', e => {
          e.preventDefault(); cell.classList.remove('drag-over');
          if (e.dataTransfer.types.includes('application/x-cal-item')) {
            try { const d = JSON.parse(e.dataTransfer.getData('application/x-cal-item')); moveCalItem(d.storageKey, d.idx, d.fromDisplayKey, key); } catch(err) {}
            return;
          }
          try {
            const data = JSON.parse(e.dataTransfer.getData('application/x-memo'));
            if (!data || !data.text) return;
            openModal(key, null, ab);
            document.getElementById('modalInput').value = data.text;
            deleteMemo(data.idx);
          } catch(err) {}
        });

        if (isHol) {
          const holDiv = document.createElement('div'); holDiv.className = 'cell-holiday';
          holDiv.textContent = holidays[key]; cell.appendChild(holDiv);
        }

        const completedHere = completedSubMap[key] || [];
        const renderedPk = new Set();

        const mkSubEl = (cs) => {
          const si = document.createElement('div'); si.className = 'item item-sub'; si.style.background = cs.item.color;
          const st = document.createElement('span'); st.textContent = '✓ ' + cs.sub.text;
          si.onclick = e => { e.stopPropagation(); openDetail(cs.dateKey, cs.itemIdx, si); };
          si.appendChild(st); return si;
        };

        const mkItemEl = (it, dk, idx) => {
          const item = document.createElement('div');
          item.className = 'item cat-' + (it.category || 'work');
          item.style.background = getItemDisplayColor(it);
          const txt = document.createElement('span'); txt.textContent = it.text + getProgressText(it);
          const del = document.createElement('span'); del.className = 'del'; del.textContent = '✕';
          del.onclick = e => { e.stopPropagation(); deleteItem(dk, idx); };
          item.onclick = e => { e.stopPropagation(); openDetail(dk, idx, e.currentTarget); };
          item.draggable = true;
          item.addEventListener('dragstart', e => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('application/x-cal-item', JSON.stringify({ storageKey: dk, idx, fromDisplayKey: key })); setTimeout(() => item.classList.add('dragging'), 0); });
          item.addEventListener('dragend', () => item.classList.remove('dragging'));
          item.appendChild(txt); item.appendChild(del);
          return item;
        };

        const mkSpanEl = (sp) => {
          const bar = document.createElement('div');
          bar.className = 'span-bar span-' + sp.pos + ' cat-' + (sp.item.category || 'work');
          bar.style.background = getItemDisplayColor(sp.item);
          bar.textContent = sp.item.text + getProgressText(sp.item);
          bar.onclick = e => { e.stopPropagation(); openDetail(sp.dateKey, sp.idx, bar); };
          bar.draggable = true;
          bar.addEventListener('dragstart', e => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('application/x-cal-item', JSON.stringify({ storageKey: sp.dateKey, idx: sp.idx, fromDisplayKey: key })); setTimeout(() => bar.classList.add('dragging'), 0); });
          bar.addEventListener('dragend', () => bar.classList.remove('dragging'));
          return bar;
        };

        const dayProjects = (getProjectsForDate?.(key) || [])
          .filter(p => currentCategory === 'all' || (p.category || 'work') === currentCategory);
        const spans = spanMap[key] || [];
        const dayItems = plans[key] || [];

        // ── 프로젝트 그룹 렌더 ──
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

          // 이 프로젝트에 속한 스팬 아이템
          spans.forEach(sp => {
            if (sp.item.projectId !== p.id) return;
            if (currentCategory !== 'all' && (sp.item.category || 'work') !== currentCategory) return;
            group.appendChild(mkSpanEl(sp));
            const pk = sp.dateKey + '|' + sp.idx;
            completedHere.filter(cs => cs.dateKey === sp.dateKey && cs.itemIdx === sp.idx).forEach(cs => {
              group.appendChild(mkSubEl(cs)); renderedPk.add(pk);
            });
          });

          // 이 프로젝트에 속한 일반 아이템
          dayItems.forEach((it, idx) => {
            if (it.startDate && it.endDate) return;
            if (it.projectId !== p.id) return;
            if (currentCategory !== 'all' && (it.category || 'work') !== currentCategory) return;
            group.appendChild(mkItemEl(it, key, idx));
            const pk = key + '|' + idx; renderedPk.add(pk);
            completedHere.filter(cs => cs.dateKey === key && cs.itemIdx === idx).forEach(cs => {
              group.appendChild(mkSubEl(cs));
            });
          });

          cell.appendChild(group);
        });

        // ── 독립 스팬 바 (프로젝트 미연결) ──
        const standaloneSpans = spans.filter(sp => {
          if (currentCategory !== 'all' && (sp.item.category || 'work') !== currentCategory) return false;
          return !sp.item.projectId || !projects.find(p => p.id === sp.item.projectId);
        });
        if (standaloneSpans.length) {
          const sbars = document.createElement('div'); sbars.className = 'span-bars';
          standaloneSpans.forEach(sp => {
            sbars.appendChild(mkSpanEl(sp));
            const pk = sp.dateKey + '|' + sp.idx;
            completedHere.filter(cs => cs.dateKey === sp.dateKey && cs.itemIdx === sp.idx).forEach(cs => {
              sbars.appendChild(mkSubEl(cs)); renderedPk.add(pk);
            });
          });
          cell.appendChild(sbars);
        }

        // ── 독립 일반 아이템 (프로젝트 미연결) + 미표시 완료 세부일정 ──
        const idiv = document.createElement('div'); idiv.className = 'items';
        dayItems.forEach((it, idx) => {
          if (it.startDate && it.endDate) return;
          if (currentCategory !== 'all' && (it.category || 'work') !== currentCategory) return;
          if (it.projectId && projects.find(p => p.id === it.projectId)) return;
          idiv.appendChild(mkItemEl(it, key, idx));
          const pk = key + '|' + idx; renderedPk.add(pk);
          completedHere.filter(cs => cs.dateKey === key && cs.itemIdx === idx).forEach(cs => {
            idiv.appendChild(mkSubEl(cs));
          });
        });
        completedHere.filter(cs =>
          !renderedPk.has(cs.dateKey + '|' + cs.itemIdx) &&
          (currentCategory === 'all' || (cs.item.category || 'work') === currentCategory)
        ).forEach(cs => idiv.appendChild(mkSubEl(cs)));
        cell.appendChild(idiv);
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
function openModal(key, editIdx, anchor) {
  modal.dateKey = key; modal.editIdx = editIdx; modal.colorIdx = 0;
  const inp = document.getElementById('modalInput');
  if (editIdx !== null) {
    const it = plans[key][editIdx]; inp.value = it.text;
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
  const startDate = document.getElementById('modalStartDate').value || null;
  const endDate   = document.getElementById('modalEndDate').value   || null;
  if (!plans[key]) plans[key] = [];
  const palette = modal.category === 'personal' ? COLORS_PERSONAL : COLORS_WORK;
  if (modal.editIdx !== null) {
    const existingSub = plans[key][modal.editIdx].sub || [];
    plans[key][modal.editIdx] = { text:txt, color:palette[modal.colorIdx], sub:existingSub, startDate, endDate, category:modal.category };
  } else {
    plans[key].push({ text:txt, color:palette[modal.colorIdx], sub:[], startDate, endDate, category:modal.category });
  }
  save(); closeModal(); renderAll();
}

// ── 아이템 이동 (드래그앤드롭) ──
function moveCalItem(storageKey, idx, fromDisplayKey, toKey) {
  if (fromDisplayKey === toKey) return;
  const items = plans[storageKey] || [];
  if (idx >= items.length) return;
  const item = items[idx];
  const diffDays = Math.round((new Date(toKey + 'T00:00:00') - new Date(fromDisplayKey + 'T00:00:00')) / 86400000);
  const shiftDate = ds => { const d = new Date(ds + 'T00:00:00'); d.setDate(d.getDate() + diffDays); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const moved = Object.assign({}, item, { sub: (item.sub || []).slice() });
  if (moved.startDate) moved.startDate = shiftDate(moved.startDate);
  if (moved.endDate)   moved.endDate   = shiftDate(moved.endDate);
  const newKey = moved.startDate || toKey;
  plans[storageKey].splice(idx, 1);
  if (!plans[storageKey].length) delete plans[storageKey];
  if (!plans[newKey]) plans[newKey] = [];
  plans[newKey].push(moved);
  closeDetail();
  save(); renderAll();
}

// ── 아이템 삭제 ──
function deleteItem(key, idx) {
  plans[key].splice(idx, 1);
  if (!plans[key].length) delete plans[key];
  save(); renderAll();
}

// ── CSV 내보내기 ──
function exportCSV() {
  const dim = new Date(year, month+1, 0).getDate();
  const rows = [['"날짜"', '"요일"', '"일정"']];
  for (let d = 1; d <= dim; d++) {
    const key = dateKey(year, month, d);
    const dow = DAYS_KR[new Date(year, month, d).getDay()];
    const items = plans[key] || [];
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
