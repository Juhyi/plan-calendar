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
        num.className = 'date-num' + (isToday(d,month,year) ? ' today-num' : di===0 ? ' sun-num' : di===6 ? ' sat-num' : '');
        num.textContent = d;
        const ab = document.createElement('button'); ab.className = 'add-btn'; ab.textContent = '+';
        ab.onclick = e => { e.stopPropagation(); openModal(key, null, e.currentTarget); };
        hdr.appendChild(num); hdr.appendChild(ab); cell.appendChild(hdr);

        const completedHere = completedSubMap[key] || [];
        const renderedPk = new Set();
        const mkSubEl = (cs, cls) => {
          const si = document.createElement('div'); si.className = cls + ' item-sub'; si.style.background = cs.item.color;
          const st = document.createElement('span'); st.textContent = '✓ ' + cs.sub.text;
          si.onclick = e => { e.stopPropagation(); openDetail(cs.dateKey, cs.itemIdx, si); };
          si.appendChild(st); return si;
        };

        // 기간 스팬 바
        const spans = spanMap[key] || [];
        if (spans.length) {
          const sbars = document.createElement('div'); sbars.className = 'span-bars';
          spans.forEach(sp => {
            const bar = document.createElement('div');
            bar.className = 'span-bar span-' + sp.pos;
            bar.style.background = getItemDisplayColor(sp.item);
            bar.textContent = sp.item.text + getProgressText(sp.item);
            bar.onclick = e => { e.stopPropagation(); openDetail(sp.dateKey, sp.idx, bar); };
            sbars.appendChild(bar);
            const pk = sp.dateKey + '|' + sp.idx;
            completedHere.filter(cs => cs.dateKey === sp.dateKey && cs.itemIdx === sp.idx).forEach(cs => {
              sbars.appendChild(mkSubEl(cs, 'item')); renderedPk.add(pk);
            });
          });
          cell.appendChild(sbars);
        }

        // 일반 아이템
        const idiv = document.createElement('div'); idiv.className = 'items';
        (plans[key] || []).forEach((it, idx) => {
          if (it.startDate && it.endDate) return;
          const item = document.createElement('div'); item.className = 'item'; item.style.background = getItemDisplayColor(it);
          const txt = document.createElement('span'); txt.textContent = it.text + getProgressText(it);
          const del = document.createElement('span'); del.className = 'del'; del.textContent = '✕';
          del.onclick = e => { e.stopPropagation(); deleteItem(key, idx); };
          item.onclick = e => { e.stopPropagation(); openDetail(key, idx, e.currentTarget); };
          item.appendChild(txt); item.appendChild(del); idiv.appendChild(item);
          const pk = key + '|' + idx; renderedPk.add(pk);
          completedHere.filter(cs => cs.dateKey === key && cs.itemIdx === idx).forEach(cs => {
            idiv.appendChild(mkSubEl(cs, 'item'));
          });
        });

        // 아직 표시되지 않은 완료 세부일정
        completedHere.filter(cs => !renderedPk.has(cs.dateKey + '|' + cs.itemIdx)).forEach(cs => {
          idiv.appendChild(mkSubEl(cs, 'item'));
        });
        cell.appendChild(idiv);
      }
      row.appendChild(cell);
    }
    body.appendChild(row);
  }
}

// ── 모달 (일정 추가/수정) ──
function openModal(key, editIdx, anchor) {
  modal.dateKey = key; modal.editIdx = editIdx; modal.colorIdx = 0;
  const inp = document.getElementById('modalInput');
  if (editIdx !== null) {
    const it = plans[key][editIdx]; inp.value = it.text;
    modal.colorIdx = COLORS.indexOf(it.color) >= 0 ? COLORS.indexOf(it.color) : 0;
    document.getElementById('modalStartDate').value = it.startDate || '';
    document.getElementById('modalEndDate').value   = it.endDate   || '';
    document.getElementById('modalTitle').textContent = `✏️ 수정 — ${key}`;
    document.getElementById('btnSave').textContent = '수정';
  } else {
    inp.value = '';
    document.getElementById('modalStartDate').value = '';
    document.getElementById('modalEndDate').value   = '';
    document.getElementById('modalTitle').textContent = `📝 추가 — ${key}`;
    document.getElementById('btnSave').textContent = '추가';
  }
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
  COLORS.forEach((c, i) => {
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
  if (modal.editIdx !== null) {
    const existingSub = plans[key][modal.editIdx].sub || [];
    plans[key][modal.editIdx] = { text:txt, color:COLORS[modal.colorIdx], sub:existingSub, startDate, endDate };
  } else {
    plans[key].push({ text:txt, color:COLORS[modal.colorIdx], sub:[], startDate, endDate });
  }
  save(); closeModal(); renderAll();
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
