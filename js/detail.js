// ── 세부일정 패널 상태 ──
let detailState = { dateKey:null, itemIdx:null, anchor:null };

function openDetail(key, idx, anchor) {
  detailState = { dateKey:key, itemIdx:idx, anchor:anchor };
  renderDetailPanel();
  document.getElementById('detailPanel').classList.add('open');
  document.body.classList.add('panel-open');
  if (window.innerWidth <= 640) document.getElementById('overlay').classList.add('show');
  setTimeout(() => document.getElementById('detailInput').focus(), 300);
}

function renderDetailPanel() {
  const { dateKey, itemIdx } = detailState;
  const it = plans[dateKey][itemIdx];
  const subs = it.sub || [];
  const done = subs.filter(s => s.done).length;
  const allDone = subs.length > 0 && done === subs.length;
  const ratio = subs.length ? done / subs.length : 0;
  const displayColor = getItemDisplayColor(it);

  document.getElementById('detailColorBar').style.background = displayColor;
  const titleEl = document.getElementById('detailPanelTitle');
  titleEl.textContent = allDone ? '✅ ' + it.text : it.text;
  titleEl.style.background = displayColor;
  document.getElementById('detailPanelDate').textContent = '📅 ' + dateKey;

  const rangeEl = document.getElementById('detailDateRange');
  if (it.startDate || it.endDate) {
    rangeEl.textContent = `📆 ${it.startDate||'?'} ~ ${it.endDate||'?'}`;
    rangeEl.className = 'detail-date-range has-range';
  } else {
    rangeEl.textContent = '';
    rangeEl.className = 'detail-date-range';
  }

  const wrap = document.getElementById('detailProgressWrap');
  const lbl  = document.getElementById('detailProgressLabel');
  const fill = document.getElementById('detailProgressFill');
  if (subs.length) {
    wrap.style.display = 'block';
    lbl.textContent = allDone
      ? `🎉 모두 완료! (${subs.length}/${subs.length})`
      : `완료 ${done} / ${subs.length}  (${Math.round(ratio*100)}%)`;
    fill.style.background = displayColor;
    fill.style.width = Math.round(ratio*100) + '%';
  } else {
    wrap.style.display = 'none';
  }

  const doneBtn = document.getElementById('btnDetailDone');
  if (!subs.length) {
    doneBtn.style.display = '';
    doneBtn.textContent = it.done ? '↩️ 되돌리기' : '✅ 완료';
    doneBtn.className = 'detail-panel-btn done-toggle' + (it.done ? ' is-done' : '');
  } else {
    doneBtn.style.display = 'none';
  }

  const list = document.getElementById('detailSubList'); list.innerHTML = '';
  if (!subs.length) {
    const empty = document.createElement('div'); empty.className = 'detail-empty';
    empty.textContent = '아래 입력창에서 세부일정을 추가하세요';
    list.appendChild(empty);
  } else {
    subs.forEach((sub, si) => {
      const row = document.createElement('div'); row.className = 'sub-item';
      const num = document.createElement('span'); num.className = 'sub-num'; num.textContent = (si+1) + '.';
      const cb  = document.createElement('input'); cb.type = 'checkbox'; cb.checked = sub.done;
      cb.onchange = () => toggleSub(si);

      const txtWrap = document.createElement('div'); txtWrap.className = 'sub-text-wrap';
      const txt = document.createElement('span'); txt.className = 'sub-text' + (sub.done ? ' done' : ''); txt.textContent = sub.text;
      txtWrap.appendChild(txt);
      if (sub.done && sub.completedAt) {
        const doneDate = document.createElement('div'); doneDate.className = 'sub-done-date';
        doneDate.textContent = '완료: ' + sub.completedAt;
        doneDate.title = '클릭하여 날짜 수정';
        doneDate.onclick = () => startEditCompletedDate(si, doneDate);
        txtWrap.appendChild(doneDate);
      }

      const orderBtns = document.createElement('div'); orderBtns.className = 'sub-order-btns';
      const upBtn = document.createElement('button'); upBtn.className = 'sub-order-btn'; upBtn.textContent = '▲';
      upBtn.disabled = (si === 0); upBtn.onclick = () => moveSub(si, -1);
      const dnBtn = document.createElement('button'); dnBtn.className = 'sub-order-btn'; dnBtn.textContent = '▼';
      dnBtn.disabled = (si === subs.length-1); dnBtn.onclick = () => moveSub(si, 1);
      orderBtns.appendChild(upBtn); orderBtns.appendChild(dnBtn);

      const editBtn = document.createElement('button'); editBtn.className = 'sub-edit-btn'; editBtn.textContent = '✏️';
      editBtn.onclick = () => startEditSub(si, row, txt, editBtn);
      const del = document.createElement('button'); del.className = 'sub-del-btn'; del.textContent = '✕';
      del.onclick = () => deleteSub(si);

      row.appendChild(num); row.appendChild(cb); row.appendChild(txtWrap);
      row.appendChild(orderBtns); row.appendChild(editBtn); row.appendChild(del);
      list.appendChild(row);
    });
  }
}

// ── 세부일정 CRUD ──
function addSub() {
  const txt = document.getElementById('detailInput').value.trim(); if (!txt) return;
  const { dateKey, itemIdx } = detailState;
  const it = plans[dateKey][itemIdx];
  if (!it.sub) it.sub = [];
  it.sub.push({ text:txt, done:false });
  document.getElementById('detailInput').value = '';
  save(); renderDetailPanel();
}
function toggleSub(si) {
  const { dateKey, itemIdx } = detailState;
  const it = plans[dateKey][itemIdx];
  it.sub[si].done = !it.sub[si].done;
  if (it.sub[si].done) it.sub[si].completedAt = new Date().toISOString().slice(0,10);
  else delete it.sub[si].completedAt;
  save(); renderDetailPanel();
}
function deleteSub(si) {
  const { dateKey, itemIdx } = detailState;
  plans[dateKey][itemIdx].sub.splice(si, 1);
  save(); renderDetailPanel();
}
function startEditSub(si, row, txtEl, editBtn) {
  const sub = plans[detailState.dateKey][detailState.itemIdx].sub[si];
  const inp = document.createElement('input'); inp.type = 'text'; inp.className = 'sub-edit-input'; inp.value = sub.text;
  txtEl.replaceWith(inp);
  editBtn.textContent = '✓'; editBtn.style.color = '#4f86f7';
  editBtn.onclick = () => saveSub(si, inp);
  inp.onkeydown = e => { if (e.key==='Enter') saveSub(si,inp); if (e.key==='Escape') renderDetailPanel(); };
  inp.focus(); inp.select();
}
function saveSub(si, inp) {
  const val = inp.value.trim(); if (!val) return;
  plans[detailState.dateKey][detailState.itemIdx].sub[si].text = val;
  save(); renderDetailPanel();
}
function moveSub(si, dir) {
  const { dateKey, itemIdx } = detailState;
  const subs = plans[dateKey][itemIdx].sub;
  const ti = si + dir;
  if (ti < 0 || ti >= subs.length) return;
  [subs[si], subs[ti]] = [subs[ti], subs[si]];
  save(); renderDetailPanel();
}
function startEditCompletedDate(si, el) {
  const sub = plans[detailState.dateKey][detailState.itemIdx].sub[si];
  const inp = document.createElement('input'); inp.type = 'date'; inp.className = 'sub-done-date-inp';
  inp.value = sub.completedAt || '';
  el.replaceWith(inp); inp.focus();
  const commit = () => {
    if (inp.value) sub.completedAt = inp.value; else delete sub.completedAt;
    save(); renderDetailPanel();
  };
  inp.onchange = commit; inp.onblur = commit;
  inp.onkeydown = e => { if (e.key==='Escape') renderDetailPanel(); if (e.key==='Enter') inp.blur(); };
}

// ── 항목 완료 토글 (세부일정 없는 경우) ──
function toggleItemDone() {
  const { dateKey, itemIdx } = detailState;
  const it = plans[dateKey][itemIdx];
  it.done = !it.done;
  save(); renderDetailPanel(); renderAll();
}

// ── 패널 닫기 ──
function closeDetail() {
  closeCopyDialog();
  document.getElementById('detailPanel').classList.remove('open');
  document.body.classList.remove('panel-open');
  if (document.getElementById('modal').style.display === 'none')
    document.getElementById('overlay').classList.remove('show');
}

// ── 프로젝트 복사 ──
function openCopyDialog() {
  document.getElementById('copyTargetDate').value = detailState.dateKey;
  document.getElementById('copyDialog').classList.add('open');
  setTimeout(() => document.getElementById('copyTargetDate').focus(), 50);
}
function closeCopyDialog() {
  document.getElementById('copyDialog').classList.remove('open');
}
function doCopy() {
  const targetDate = document.getElementById('copyTargetDate').value;
  if (!targetDate) { alert('날짜를 선택하세요.'); return; }
  const { dateKey, itemIdx } = detailState;
  const it = plans[dateKey][itemIdx];
  const copied = JSON.parse(JSON.stringify(it));
  copied.sub = (copied.sub || []).map(s => ({ text:s.text, done:false }));
  if (!plans[targetDate]) plans[targetDate] = [];
  plans[targetDate].push(copied);
  save(); renderAll();
  closeCopyDialog();
  alert(`"${it.text}"이(가) ${targetDate}에 복사되었습니다.`);
}

// ── 이벤트 ──
document.getElementById('btnDetailAdd').onclick   = addSub;
document.getElementById('btnDetailClose').onclick = closeDetail;
document.getElementById('btnDetailEdit').onclick  = () => { closeDetail(); openModal(detailState.dateKey, detailState.itemIdx, detailState.anchor); };
document.getElementById('btnDetailCopy').onclick  = openCopyDialog;
document.getElementById('btnDetailDone').onclick  = toggleItemDone;
document.getElementById('btnCopyConfirm').onclick = doCopy;
document.getElementById('btnCopyCancel').onclick  = closeCopyDialog;
document.getElementById('detailInput').onkeydown  = e => { if (e.key === 'Enter') addSub(); };
document.getElementById('copyTargetDate').onkeydown = e => { if (e.key === 'Enter') doCopy(); };

// 모바일: 드래그 핸들 스와이프 → 패널 닫기
(function() {
  const handle = document.getElementById('detailDragHandle');
  if (!handle) return;
  let sy = 0;
  handle.addEventListener('touchstart', e => { sy = e.touches[0].clientY; }, { passive:true });
  handle.addEventListener('touchend',   e => { if (e.changedTouches[0].clientY - sy > 60) closeDetail(); }, { passive:true });
})();
