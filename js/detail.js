// ── 세부일정 패널 상태 ──
let detailState = { planId:null, anchor:null };
let detailEditState = { type:'task', category:'work', colorIdx:0 };

function openDetail(planId, anchor) {
  if (typeof closeProjectDetail === 'function') closeProjectDetail();
  detailState = { planId, anchor };
  renderDetailPanel();
  document.getElementById('detailPanel').classList.add('open');
  document.body.classList.add('panel-open');
  document.getElementById('overlay').classList.add('show');
  setTimeout(() => document.getElementById('detailInput').focus(), 300);
}

function renderDetailPanel() {
  const { planId } = detailState;
  const it = hydratePlan(planId);
  if (!it) return;
  const subs = it.sub || [];
  const done = subs.filter(s => s.done).length;
  const allDone = subs.length > 0 && done === subs.length;
  const ratio = subs.length ? done / subs.length : 0;
  const displayColor = getItemDisplayColor(it);

  document.getElementById('detailColorBar').style.background = displayColor;
  const titleEl = document.getElementById('detailPanelTitle');
  titleEl.textContent = allDone ? '✅ ' + it.text : it.text;
  titleEl.style.background = displayColor;

  // ── 메타 칩 (타입 + 세부일정 요약) ──
  const chipsEl = document.getElementById('detailMetaChips');
  chipsEl.innerHTML = '';
  const mkChip = (text, cls) => {
    const c = document.createElement('span'); c.className = 'detail-chip ' + cls; c.textContent = text; return c;
  };
  chipsEl.appendChild(mkChip(it.type === 'event' ? '📅 약속' : '✅ 할일', it.type === 'event' ? 'chip-event' : 'chip-task'));
  if (subs.length === 0) {
    chipsEl.appendChild(mkChip('세부일정 없음', 'chip-nosub'));
  } else {
    const remaining = subs.length - done;
    const label = allDone ? `세부일정 ${subs.length}개 · 모두완료` : `세부일정 ${subs.length}개 · 완료 ${done} / 남은 ${remaining}`;
    chipsEl.appendChild(mkChip(label, allDone ? 'chip-sub-done' : 'chip-sub'));
  }

  document.getElementById('detailPanelDate').textContent = '📅 ' + (it.date || planId);

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
  if (it.type === 'event') {
    doneBtn.style.display = 'none';
  } else if (!subs.length) {
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
      const subId = sub.subId;
      const row = document.createElement('div'); row.className = 'sub-item';
      row.draggable = true;
      row.title = '드래그하여 독립 일정으로 분리';
      row.addEventListener('dragstart', e => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/x-sub-item', JSON.stringify({
          planId: detailState.planId, subId, text: sub.text
        }));
        setTimeout(() => row.classList.add('dragging'), 0);
      });
      row.addEventListener('dragend', () => row.classList.remove('dragging'));
      const num = document.createElement('span'); num.className = 'sub-num'; num.textContent = (si+1) + '.';
      const cb  = document.createElement('input'); cb.type = 'checkbox'; cb.checked = sub.done;
      cb.onchange = () => toggleSub(subId);

      const txtWrap = document.createElement('div'); txtWrap.className = 'sub-text-wrap';
      const txt = document.createElement('span'); txt.className = 'sub-text' + (sub.done ? ' done' : ''); txt.textContent = sub.text;
      txtWrap.appendChild(txt);
      if (sub.done && sub.completedAt) {
        const doneDate = document.createElement('div'); doneDate.className = 'sub-done-date';
        doneDate.textContent = '완료: ' + sub.completedAt;
        doneDate.title = '클릭하여 날짜 수정';
        doneDate.onclick = () => startEditCompletedDate(subId, doneDate);
        txtWrap.appendChild(doneDate);
      }
      if (!sub.done && sub.dueDate) {
        const tk = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
        const isOverdue = sub.dueDate < tk;
        const dueDateEl = document.createElement('div');
        dueDateEl.className = 'sub-due-date' + (isOverdue ? ' overdue' : '');
        dueDateEl.textContent = (isOverdue ? '⚠️ ' : '📅 ') + sub.dueDate;
        dueDateEl.title = '클릭하여 날짜 수정';
        dueDateEl.onclick = () => startEditSubDueDate(subId, dueDateEl);
        txtWrap.appendChild(dueDateEl);
      }

      const orderBtns = document.createElement('div'); orderBtns.className = 'sub-order-btns';
      const upBtn = document.createElement('button'); upBtn.className = 'sub-order-btn'; upBtn.textContent = '▲';
      upBtn.disabled = (si === 0); upBtn.onclick = () => moveSub(subId, -1);
      const dnBtn = document.createElement('button'); dnBtn.className = 'sub-order-btn'; dnBtn.textContent = '▼';
      dnBtn.disabled = (si === subs.length-1); dnBtn.onclick = () => moveSub(subId, 1);
      orderBtns.appendChild(upBtn); orderBtns.appendChild(dnBtn);

      const editBtn = document.createElement('button'); editBtn.className = 'sub-edit-btn'; editBtn.textContent = '✏️';
      editBtn.onclick = () => startEditSub(subId, row, txt, editBtn);
      const del = document.createElement('button'); del.className = 'sub-del-btn'; del.textContent = '✕';
      del.onclick = () => deleteSub(subId);

      row.appendChild(num); row.appendChild(cb); row.appendChild(txtWrap);
      row.appendChild(orderBtns); row.appendChild(editBtn); row.appendChild(del);
      list.appendChild(row);
    });
  }
}

// ── 세부일정 CRUD ──
function addSub() {
  const txt = document.getElementById('detailInput').value.trim(); if (!txt) return;
  const { planId } = detailState;
  const plan = plans[planId]; if (!plan) return;
  const order = Object.values(subTasks).filter(s=>s.parentPlanId===planId).length;
  const subId = newSubId();
  subTasks[subId] = { parentPlanId:planId, text:txt, done:false, dueDate:localDateStr(), completedAt:'', order };
  document.getElementById('detailInput').value = '';
  showToast('세부일정이 추가되었습니다');
  saveSubTasks(); renderDetailPanel();
}
function toggleSub(subId) {
  subTasks[subId].done = !subTasks[subId].done;
  if (subTasks[subId].done) subTasks[subId].completedAt = localDateStr();
  else delete subTasks[subId].completedAt;
  // 부모 일정 done 자동 동기화
  const parentId = subTasks[subId].parentPlanId;
  if (parentId && plans[parentId]) {
    const planSubs = Object.values(subTasks).filter(s => s.parentPlanId === parentId);
    plans[parentId].done = planSubs.length > 0 && planSubs.every(s => s.done);
    savePlans();
  }
  saveSubTasks(); renderDetailPanel(); renderAll();
}
function deleteSub(subId) {
  delete subTasks[subId];
  showToast('삭제되었습니다');
  saveSubTasks(); renderDetailPanel();
}
function startEditSub(subId, row, txtEl, editBtn) {
  const sub = subTasks[subId];
  const inp = document.createElement('input'); inp.type = 'text'; inp.className = 'sub-edit-input'; inp.value = sub.text;
  txtEl.replaceWith(inp);
  editBtn.textContent = '✓'; editBtn.style.color = '#4f86f7';
  editBtn.onclick = () => saveSub(subId, inp);
  inp.onkeydown = e => { if (e.key==='Enter') saveSub(subId,inp); if (e.key==='Escape') renderDetailPanel(); };
  inp.focus(); inp.select();
}
function saveSub(subId, inp) {
  const val = inp.value.trim(); if (!val) return;
  subTasks[subId].text = val;
  showToast('수정되었습니다');
  saveSubTasks(); renderDetailPanel();
}
function moveSub(subId, dir) {
  const { planId } = detailState;
  const planSubs = Object.entries(subTasks)
    .filter(([,s])=>s.parentPlanId===planId)
    .sort(([,a],[,b])=>(a.order||0)-(b.order||0));
  const idx = planSubs.findIndex(([id])=>id===subId);
  const ti = idx+dir;
  if (ti<0||ti>=planSubs.length) return;
  const [otherId] = planSubs[ti];
  const tmpOrder = subTasks[subId].order||0;
  subTasks[subId].order = subTasks[otherId].order||0;
  subTasks[otherId].order = tmpOrder;
  saveSubTasks(); renderDetailPanel();
}
function startEditCompletedDate(subId, el) {
  const sub = subTasks[subId];
  const inp = document.createElement('input'); inp.type = 'date'; inp.className = 'sub-done-date-inp';
  inp.value = sub.completedAt || '';
  el.replaceWith(inp); inp.focus();
  const commit = () => {
    if (inp.value) subTasks[subId].completedAt = inp.value; else delete subTasks[subId].completedAt;
    saveSubTasks(); renderDetailPanel();
  };
  inp.onchange = commit; inp.onblur = commit;
  inp.onkeydown = e => { if (e.key==='Escape') renderDetailPanel(); if (e.key==='Enter') inp.blur(); };
}

function startEditSubDueDate(subId, el) {
  const sub = subTasks[subId];
  const inp = document.createElement('input'); inp.type = 'date'; inp.className = 'sub-done-date-inp';
  inp.value = sub.dueDate || '';
  el.replaceWith(inp); inp.focus();
  const commit = () => {
    if (inp.value) subTasks[subId].dueDate = inp.value;
    saveSubTasks(); renderDetailPanel();
  };
  inp.onchange = commit; inp.onblur = commit;
  inp.onkeydown = e => { if (e.key === 'Escape') renderDetailPanel(); if (e.key === 'Enter') inp.blur(); };
}

// ── 항목 완료 토글 (세부일정 없는 경우) ──
function toggleItemDone() {
  plans[detailState.planId].done = !plans[detailState.planId].done;
  savePlans(); renderDetailPanel(); renderAll();
}

// ── 인라인 수정 폼 ──
function openInlineEdit() {
  const { planId } = detailState;
  const it = hydratePlan(planId); if (!it) return;
  detailEditState.type     = it.type     || 'task';
  detailEditState.category = it.category || 'work';
  const palette = detailEditState.category === 'personal' ? COLORS_PERSONAL : COLORS_WORK;
  detailEditState.colorIdx = palette.indexOf(it.color) >= 0 ? palette.indexOf(it.color) : 0;

  document.getElementById('detailEditTitle').value = it.text || '';
  document.getElementById('detailEditStart').value = it.startDate || '';
  document.getElementById('detailEditEnd').value   = it.endDate   || '';

  const projSel = document.getElementById('detailEditProject');
  projSel.innerHTML = '<option value="">📌 프로젝트 없음</option>';
  projects.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id; opt.textContent = '📁 ' + p.name;
    projSel.appendChild(opt);
  });
  projSel.value = it.projectId || '';

  renderInlineEditTypeBtns();
  renderInlineEditCatBtns();
  renderInlineEditColors();

  document.getElementById('detailViewHeader').style.display = 'none';
  document.getElementById('detailEditForm').style.display = 'block';
  setTimeout(() => document.getElementById('detailEditTitle').focus(), 30);
}

function closeInlineEdit() {
  document.getElementById('detailEditForm').style.display = 'none';
  document.getElementById('detailViewHeader').style.display = '';
}

function renderInlineEditTypeBtns() {
  document.querySelectorAll('.detail-edit-type-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.type === detailEditState.type));
}
function renderInlineEditCatBtns() {
  document.querySelectorAll('.detail-edit-cat-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.cat === detailEditState.category));
}
function renderInlineEditColors() {
  const row = document.getElementById('detailEditColors'); row.innerHTML = '';
  const palette = detailEditState.category === 'personal' ? COLORS_PERSONAL : COLORS_WORK;
  palette.forEach((c, i) => {
    const dot = document.createElement('div');
    dot.className = 'color-dot' + (i === detailEditState.colorIdx ? ' selected' : '');
    dot.style.background = c;
    dot.onclick = () => { detailEditState.colorIdx = i; renderInlineEditColors(); };
    row.appendChild(dot);
  });
}

function saveInlineEdit() {
  const { planId } = detailState;
  const txt = document.getElementById('detailEditTitle').value.trim(); if (!txt) return;
  const startDate = document.getElementById('detailEditStart').value || plans[planId]?.startDate || plans[planId]?.date || '';
  const endDate   = document.getElementById('detailEditEnd').value   || startDate;
  const selVal    = document.getElementById('detailEditProject').value;
  const projectId = selVal ? Number(selVal) : null;
  const palette   = detailEditState.category === 'personal' ? COLORS_PERSONAL : COLORS_WORK;
  plans[planId]   = { ...plans[planId], text:txt, category:detailEditState.category, type:detailEditState.type,
    color:palette[detailEditState.colorIdx], startDate, endDate, date:startDate, projectId };
  showToast('수정되었습니다');
  savePlans(); closeInlineEdit(); renderDetailPanel(); renderAll();
}

// ── 패널 닫기 ──
function closeDetail() {
  closeCopyDialog();
  document.getElementById('detailPanel').classList.remove('open');
  document.body.classList.remove('panel-open');
  if (document.getElementById('modal').style.display === 'none')
    document.getElementById('overlay').classList.remove('show');
}

// ── 복사 다이얼로그 ──
function openCopyDialog() {
  document.getElementById('copyTargetDate').value = plans[detailState.planId]?.date || detailState.planId;
  document.getElementById('copyDialog').classList.add('open');
  setTimeout(() => document.getElementById('copyTargetDate').focus(), 50);
}
function closeCopyDialog() {
  document.getElementById('copyDialog').classList.remove('open');
}
function doCopy() {
  const targetDate = document.getElementById('copyTargetDate').value;
  if (!targetDate) { alert('날짜를 선택하세요.'); return; }
  const { planId } = detailState;
  const it = hydratePlan(planId); if (!it) return;
  const newId = newPlanId();
  plans[newId] = {...plans[planId], date:targetDate, startDate: (plans[planId].startDate===plans[planId].endDate)?targetDate:plans[planId].startDate, endDate: (plans[planId].startDate===plans[planId].endDate)?targetDate:plans[planId].endDate};
  // Copy subs
  (it.sub||[]).forEach((sub,i) => {
    const newSid = newSubId();
    subTasks[newSid] = { parentPlanId:newId, text:sub.text, done:false, dueDate:targetDate, completedAt:'', order:i };
  });
  savePlans(); saveSubTasks(); renderAll();
  closeCopyDialog();
  showToast(`"${it.text}" 복사되었습니다`);
}

// ── 이벤트 ──
document.getElementById('btnDetailAdd').onclick        = addSub;
document.getElementById('btnDetailClose').onclick      = closeDetail;
document.getElementById('btnDetailEdit').onclick       = openInlineEdit;
document.getElementById('btnDetailCopy').onclick       = openCopyDialog;
document.getElementById('btnDetailDone').onclick       = toggleItemDone;
document.getElementById('btnDetailSave').onclick       = saveInlineEdit;
document.getElementById('btnDetailCancelEdit').onclick = closeInlineEdit;
document.getElementById('btnCopyConfirm').onclick      = doCopy;
document.getElementById('btnCopyCancel').onclick       = closeCopyDialog;
document.getElementById('detailInput').onkeydown       = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addSub(); } };
document.getElementById('copyTargetDate').onkeydown    = e => { if (e.key === 'Enter') doCopy(); };
document.getElementById('detailEditTitle').onkeydown   = e => { if (e.key === 'Enter') saveInlineEdit(); if (e.key === 'Escape') closeInlineEdit(); };
document.querySelectorAll('.detail-edit-type-btn').forEach(btn =>
  btn.addEventListener('click', () => { detailEditState.type = btn.dataset.type; renderInlineEditTypeBtns(); }));
document.querySelectorAll('.detail-edit-cat-btn').forEach(btn =>
  btn.addEventListener('click', () => { detailEditState.category = btn.dataset.cat; detailEditState.colorIdx = 0; renderInlineEditCatBtns(); renderInlineEditColors(); }));

// ── 세부일정 패널: 캘린더 아이템 드롭 → 세부일정으로 추가 ──
(function() {
  const panel = document.getElementById('detailPanel');

  panel.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.includes('application/x-cal-item')) return;
    if (!detailState.planId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    panel.classList.add('sub-drop-over');
  });

  panel.addEventListener('dragleave', e => {
    if (!panel.contains(e.relatedTarget)) panel.classList.remove('sub-drop-over');
  });

  panel.addEventListener('drop', e => {
    panel.classList.remove('sub-drop-over');
    if (!e.dataTransfer.types.includes('application/x-cal-item')) return;
    if (!detailState.planId) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      const d = JSON.parse(e.dataTransfer.getData('application/x-cal-item'));
      const { planId } = detailState;
      if (d.planId === planId) return;
      if (typeof addCalItemAsSub === 'function') {
        addCalItemAsSub(d.planId, planId, true);
      }
    } catch(err) {}
  });
})();

// 모바일: 드래그 핸들 스와이프 → 패널 닫기
(function() {
  const handle = document.getElementById('detailDragHandle');
  if (!handle) return;
  let sy = 0;
  handle.addEventListener('touchstart', e => { sy = e.touches[0].clientY; }, { passive:true });
  handle.addEventListener('touchend',   e => { if (e.changedTouches[0].clientY - sy > 60) closeDetail(); }, { passive:true });
})();
