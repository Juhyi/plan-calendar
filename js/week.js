// ── 주간 캘린더 렌더 ──
function getWeekStart(base) {
  const d = new Date(base); d.setDate(d.getDate() - d.getDay()); return d;
}

function renderWeek() {
  const ws = getWeekStart(weekBase), we = new Date(ws); we.setDate(we.getDate()+6);
  const fmt = d => `${d.getMonth()+1}/${d.getDate()}`;
  document.getElementById('weekLabel').textContent = `${ws.getFullYear()}년 ${fmt(ws)}(일) ~ ${fmt(we)}(토)`;
  const grid = document.getElementById('weeklyGrid'); grid.innerHTML = '';
  const spanMap = buildSpanMap();
  const completedSubMap = buildCompletedSubMap();

  for (let di = 0; di < 7; di++) {
    const cur = new Date(ws); cur.setDate(ws.getDate() + di);
    const y2 = cur.getFullYear(), m2 = cur.getMonth(), d2 = cur.getDate();
    const key = dateKey(y2, m2, d2);
    const isTd = isToday(d2, m2, y2);

    const col = document.createElement('div'); col.className = 'wday-col' + (isTd ? ' w-today' : '');
    const hdr = document.createElement('div'); hdr.className = 'wday-col-header';
    const nm  = document.createElement('div'); nm.className = 'wday-name' + (di===0?' sun':di===6?' sat':''); nm.textContent = DAYS_KR[di];
    const dt  = document.createElement('div');
    dt.className = isTd ? 'wday-date today-big' : 'wday-date' + (di===0?' sun':di===6?' sat':'');
    dt.textContent = d2;
    hdr.appendChild(nm); hdr.appendChild(dt); col.appendChild(hdr);

    const completedHereW = completedSubMap[key] || [];
    const renderedPkW = new Set();
    const mkSubElW = cs => {
      const si = document.createElement('div'); si.className = 'wday-item item-sub'; si.style.background = cs.item.color;
      const st = document.createElement('span'); st.textContent = '✓ ' + cs.sub.text;
      si.onclick = e => { e.stopPropagation(); openDetail(cs.dateKey, cs.itemIdx, si); };
      si.appendChild(st); return si;
    };

    const idiv = document.createElement('div'); idiv.className = 'wday-items';

    // 기간 스팬 아이템
    (spanMap[key] || []).forEach(sp => {
      const item = document.createElement('div'); item.className = 'wday-item'; item.style.background = getItemDisplayColor(sp.item);
      const txt = document.createElement('span'); txt.textContent = sp.item.text + getProgressText(sp.item);
      const del = document.createElement('span'); del.className = 'del'; del.textContent = '✕';
      del.onclick = e => { e.stopPropagation(); deleteItem(sp.dateKey, sp.idx); };
      item.onclick = e => { e.stopPropagation(); openDetail(sp.dateKey, sp.idx, e.currentTarget); };
      item.appendChild(txt); item.appendChild(del); idiv.appendChild(item);
      const pk = sp.dateKey + '|' + sp.idx;
      completedHereW.filter(cs => cs.dateKey === sp.dateKey && cs.itemIdx === sp.idx).forEach(cs => {
        idiv.appendChild(mkSubElW(cs)); renderedPkW.add(pk);
      });
    });

    // 일반 아이템
    (plans[key] || []).forEach((it, idx) => {
      if (it.startDate && it.endDate) return;
      const item = document.createElement('div'); item.className = 'wday-item'; item.style.background = getItemDisplayColor(it);
      const txt = document.createElement('span'); txt.textContent = it.text + getProgressText(it);
      const del = document.createElement('span'); del.className = 'del'; del.textContent = '✕';
      del.onclick = e => { e.stopPropagation(); deleteItem(key, idx); };
      item.onclick = e => { e.stopPropagation(); openDetail(key, idx, e.currentTarget); };
      item.appendChild(txt); item.appendChild(del); idiv.appendChild(item);
      const pk = key + '|' + idx; renderedPkW.add(pk);
      completedHereW.filter(cs => cs.dateKey === key && cs.itemIdx === idx).forEach(cs => {
        idiv.appendChild(mkSubElW(cs));
      });
    });

    // 아직 표시되지 않은 완료 세부일정
    completedHereW.filter(cs => !renderedPkW.has(cs.dateKey + '|' + cs.itemIdx)).forEach(cs => {
      idiv.appendChild(mkSubElW(cs));
    });

    col.appendChild(idiv);
    const ab = document.createElement('button'); ab.className = 'wday-add'; ab.textContent = '+ 일정 추가';
    ab.onclick = e => { e.stopPropagation(); openModal(key, null, e.currentTarget); };
    col.appendChild(ab); grid.appendChild(col);
  }
}

function renderAll() { renderMonth(); renderWeek(); }

// ── 이벤트 ──
document.getElementById('btnWPrev').onclick  = () => { weekBase.setDate(weekBase.getDate()-7); renderWeek(); };
document.getElementById('btnWNext').onclick  = () => { weekBase.setDate(weekBase.getDate()+7); renderWeek(); };
document.getElementById('btnWToday').onclick = () => { weekBase = new Date(today); renderWeek(); };
