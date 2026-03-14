// ── 프로젝트 관리 ──
const PROJECT_COLORS = [
  '#e74c3c','#e67e22','#f39c12','#27ae60',
  '#1abc9c','#3498db','#4f86f7','#9b59b6',
  '#2c3e50','#e91e63','#00b894','#fd79a8',
];

let projectDetailState = { idx: null };

// ── 날짜 헬퍼: 기간 전체에 프로젝트 바 표시 (calendar.js에서도 사용) ──
function getProjectsForDate(dk) {
  return projects.filter(p => {
    if (p.done) return p.doneDate === dk;
    return p.startDate <= dk && dk <= p.endDate;
  });
}

// ── 진행률 헬퍼 (calendar.js에서도 사용) ──
function getProjectProgress(projectId) {
  const items = getProjectItems(projectId);
  const total = items.length;
  const done  = items.filter(({ item }) => _isItemDone(item)).length;
  return { total, done };
}

// ── 연결된 일정 조회 ──
function getProjectItems(projectId) {
  const result = [];
  for (const [dk, items] of Object.entries(plans)) {
    if (!Array.isArray(items)) continue;
    items.forEach((item, idx) => {
      if (item && item.projectId === projectId) {
        result.push({ dk, idx, item });
      }
    });
  }
  result.sort((a, b) => a.dk < b.dk ? -1 : a.dk > b.dk ? 1 : 0);
  return result;
}

// 완료 여부 판단: 세부일정 있으면 전체 완료 여부, 없으면 done 플래그
function _isItemDone(item) {
  const subs = item.sub || [];
  return subs.length > 0 ? subs.every(s => s.done) : !!item.done;
}

// ── 일정 ↔ 프로젝트 연결/해제 ──
function attachItemToProject(storageKey, idx, projectId) {
  if (!plans[storageKey] || !plans[storageKey][idx]) return;
  plans[storageKey][idx].projectId = projectId;
  save();
}

function detachItemFromProject(dk, idx) {
  if (!plans[dk] || !plans[dk][idx]) return;
  delete plans[dk][idx].projectId;
  save();
}

// ── 프로젝트에 새 일정 직접 추가 ──
function addItemToProject(projIdx, dateStr, text, category) {
  if (!dateStr || !text) return;
  const p = projects[projIdx];
  const colorPalette = category === 'personal' ? COLORS_PERSONAL : COLORS_WORK;
  if (!plans[dateStr]) plans[dateStr] = [];
  plans[dateStr].push({
    text,
    color: colorPalette[2],
    category,
    done: false,
    projectId: p.id,
  });
  save();
  renderAll();
  renderProjectDetail();
}

// ════════════════════════════════════════
//  관리 다이얼로그 (목록 + 추가)
// ════════════════════════════════════════
function openProjectPanel() {
  document.getElementById('projectOverlay').classList.add('open');
  document.getElementById('projectDialog').classList.add('open');
  renderProjectList();
}
function closeProjectPanel() {
  document.getElementById('projectOverlay').classList.remove('open');
  document.getElementById('projectDialog').classList.remove('open');
}

function renderProjectList() {
  const list = document.getElementById('projectList');
  list.innerHTML = '';
  if (!projects.length) {
    const empty = document.createElement('div');
    empty.className = 'project-empty';
    empty.textContent = '등록된 프로젝트가 없습니다';
    list.appendChild(empty);
    return;
  }

  [...projects]
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (a.p.done ? 1 : 0) - (b.p.done ? 1 : 0))
    .forEach(({ p, i }) => {
      const { total, done: doneCount } = getProjectProgress(p.id);

      const row = document.createElement('div');
      row.className = 'project-item' + (p.done ? ' is-done' : '');

      const dot = document.createElement('span');
      dot.className = 'project-color-dot';
      dot.style.background = p.color;

      const catLabel = (p.category || 'work') === 'personal' ? '🏠 개인' : '💼 업무';
      const info = document.createElement('div');
      info.className = 'project-info';
      info.innerHTML = `
        <div class="project-name">${p.name}${total ? ` <span class="project-progress">(${doneCount}/${total})</span>` : ''} <span class="project-cat-badge cat-${p.category || 'work'}">${catLabel}</span></div>
        <div class="project-dates">${p.done ? `✓ 완료: ${p.doneDate}` : `${p.startDate} ~ ${p.endDate}`}</div>`;

      const actions = document.createElement('div');
      actions.className = 'project-actions';

      const openBtn = document.createElement('button');
      openBtn.className = 'project-open-btn';
      openBtn.textContent = '관리';
      openBtn.onclick = () => { closeProjectPanel(); openProjectDetail(i); };
      actions.appendChild(openBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'project-del-btn';
      delBtn.textContent = '✕';
      delBtn.onclick = () => deleteProject(i);
      actions.appendChild(delBtn);

      row.appendChild(dot); row.appendChild(info); row.appendChild(actions);
      list.appendChild(row);
    });
}

function addProject() {
  const name      = document.getElementById('projectNameInput').value.trim();
  const startDate = document.getElementById('projectStartInput').value;
  const endDate   = document.getElementById('projectEndInput').value;
  const colorBtn  = document.querySelector('.proj-color-btn.selected');
  const color     = colorBtn ? colorBtn.dataset.color : PROJECT_COLORS[6];
  const catBtn    = document.querySelector('.proj-cat-btn.active');
  const category  = catBtn ? catBtn.dataset.cat : 'work';
  const statusEl  = document.getElementById('projectStatus');

  if (!name)      { statusEl.textContent = '프로젝트 이름을 입력하세요.'; return; }
  if (!startDate) { statusEl.textContent = '시작일을 입력하세요.'; return; }
  if (!endDate)   { statusEl.textContent = '종료일을 입력하세요.'; return; }
  if (startDate > endDate) { statusEl.textContent = '시작일이 종료일보다 늦습니다.'; return; }

  projects.push({ id: Date.now(), name, color, category, startDate, endDate, done: false, doneDate: null });
  saveProjects();

  document.getElementById('projectNameInput').value = '';
  document.getElementById('projectStartInput').value = '';
  document.getElementById('projectEndInput').value = '';
  statusEl.textContent = '';
}

function deleteProject(i) {
  if (!confirm(`"${projects[i].name}" 프로젝트를 삭제하시겠습니까?`)) return;
  if (projectDetailState.idx === i) closeProjectDetail();
  projects.splice(i, 1);
  saveProjects();
}

function saveProjects() {
  if (projectRef) projectRef.set(projects);
}

function initProjectColorPicker() {
  const picker = document.getElementById('projectColorPicker');
  PROJECT_COLORS.forEach((color, i) => {
    const btn = document.createElement('button');
    btn.className = 'proj-color-btn' + (i === 6 ? ' selected' : '');
    btn.dataset.color = color;
    btn.style.background = color;
    btn.title = color;
    btn.onclick = () => {
      document.querySelectorAll('.proj-color-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    };
    picker.appendChild(btn);
  });
}

// ════════════════════════════════════════
//  프로젝트 상세 패널
// ════════════════════════════════════════
function openProjectDetail(idx) {
  if (typeof closeDetail === 'function') closeDetail();

  projectDetailState.idx = idx;
  renderProjectDetail();
  document.getElementById('projDetailPanel').classList.add('open');
  document.body.classList.add('panel-open');
}

function closeProjectDetail() {
  document.getElementById('projDetailPanel').classList.remove('open');
  document.body.classList.remove('panel-open');
  projectDetailState.idx = null;
}

function renderProjectDetail() {
  const idx = projectDetailState.idx;
  if (idx === null || idx >= projects.length) return;
  const p = projects[idx];

  // 색상 바 + 제목
  document.getElementById('projDetailColorBar').style.background = p.color;
  const titleEl = document.getElementById('projDetailTitle');
  titleEl.textContent = p.name;
  titleEl.style.background = p.color;

  // 날짜
  const datesEl = document.getElementById('projDetailDates');
  datesEl.innerHTML = '';
  if (p.done) {
    datesEl.textContent = `✓ 완료: ${p.doneDate}`;
  } else {
    const startInp = document.createElement('input');
    startInp.type = 'date'; startInp.className = 'proj-date-edit'; startInp.value = p.startDate;
    const sep = document.createElement('span');
    sep.className = 'proj-date-sep'; sep.textContent = '~';
    const endInp = document.createElement('input');
    endInp.type = 'date'; endInp.className = 'proj-date-edit'; endInp.value = p.endDate;

    const validate = () => {
      if (startInp.value && endInp.value && startInp.value <= endInp.value) {
        projects[idx].startDate = startInp.value;
        projects[idx].endDate   = endInp.value;
        saveProjects();
        renderAll();
      }
    };
    startInp.onchange = validate;
    endInp.onchange   = validate;

    datesEl.appendChild(startInp);
    datesEl.appendChild(sep);
    datesEl.appendChild(endInp);
  }

  // 카테고리 토글
  const curCat = p.category || 'work';
  document.querySelectorAll('.proj-detail-cat-btn').forEach(btn => {
    const isActive = btn.dataset.cat === curCat;
    btn.classList.toggle('active', isActive);
    btn.onclick = () => {
      projects[idx].category = btn.dataset.cat;
      saveProjects();
      renderProjectDetail();
      renderAll();
    };
  });

  // 완료 버튼
  const doneBtn = document.getElementById('btnProjDetailDone');
  doneBtn.className = 'detail-panel-btn done-toggle' + (p.done ? ' is-done' : '');
  doneBtn.textContent = p.done ? '↩ 진행중으로' : '✅ 완료';
  doneBtn.onclick = () => toggleProjectDone(idx);

  // 진행률 — 연결된 일정 기준
  const { total, done: doneCount } = getProjectProgress(p.id);
  const wrap = document.getElementById('projProgressWrap');
  if (total) {
    wrap.style.display = '';
    document.getElementById('projProgressLabel').textContent = `일정 ${doneCount} / ${total}`;
    document.getElementById('projProgressFill').style.width = Math.round(doneCount / total * 100) + '%';
  } else {
    wrap.style.display = 'none';
  }

  _renderScrollArea(idx);
}

function _renderScrollArea(idx) {
  const area = document.getElementById('projScrollArea');
  area.innerHTML = '';
  const p = projects[idx];

  // ── 일정 추가 폼 ──
  const addForm = document.createElement('div');
  addForm.className = 'proj-add-form';

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  const dateInp = document.createElement('input');
  dateInp.type = 'date'; dateInp.className = 'proj-add-date'; dateInp.value = todayStr;

  const textInp = document.createElement('input');
  textInp.type = 'text'; textInp.className = 'proj-add-text'; textInp.placeholder = '일정 제목';
  textInp.maxLength = 50;

  const catSel = document.createElement('select');
  catSel.className = 'proj-add-cat';
  ['work', 'personal'].forEach(v => {
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = v === 'work' ? '💼 업무' : '🏠 개인';
    catSel.appendChild(opt);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'proj-add-btn'; addBtn.textContent = '+ 일정 추가';

  const doAdd = () => {
    const t = textInp.value.trim();
    if (!t) { textInp.focus(); return; }
    addItemToProject(idx, dateInp.value, t, catSel.value);
    textInp.value = '';
  };
  addBtn.onclick = doAdd;
  textInp.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doAdd(); } };

  addForm.appendChild(dateInp);
  addForm.appendChild(textInp);
  addForm.appendChild(catSel);
  addForm.appendChild(addBtn);
  area.appendChild(addForm);

  // ── 드롭존 ──
  const dropZone = document.createElement('div');
  dropZone.className = 'proj-drop-zone';
  dropZone.innerHTML = '<span class="proj-drop-hint">📎 기존 일정을 여기에 드래그하여 연결</span>';

  dropZone.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.includes('application/x-cal-item')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', e => {
    if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('drag-over');
  });
  dropZone.addEventListener('drop', e => {
    dropZone.classList.remove('drag-over');
    if (!e.dataTransfer.types.includes('application/x-cal-item')) return;
    e.preventDefault();
    try {
      const d = JSON.parse(e.dataTransfer.getData('application/x-cal-item'));
      const curIdx = projectDetailState.idx;
      if (curIdx === null) return;
      attachItemToProject(d.storageKey, d.idx, projects[curIdx].id);
    } catch(err) {}
  });
  area.appendChild(dropZone);

  // ── 연결된 일정 목록 ──
  const connectedItems = getProjectItems(p.id);
  if (!connectedItems.length) {
    const empty = document.createElement('div');
    empty.className = 'proj-connected-empty';
    empty.textContent = '연결된 일정이 없습니다';
    area.appendChild(empty);
    return;
  }

  connectedItems.forEach(({ dk, idx: itemIdx, item }) => {
    const isDone = _isItemDone(item);
    const group  = document.createElement('div');
    group.className = 'proj-item-group' + (isDone ? ' done' : '');

    const header = document.createElement('div');
    header.className = 'proj-item-header';
    header.style.cursor = 'pointer';
    header.title = '클릭하여 일정 편집';
    header.onclick = () => {
      closeProjectDetail();
      if (typeof openDetail === 'function') openDetail(dk, itemIdx);
    };

    const dot = document.createElement('span');
    dot.className = 'proj-item-dot';
    dot.style.background = item.color || '#4f86f7';

    const nameEl = document.createElement('span');
    nameEl.className = 'proj-item-name';
    nameEl.textContent = item.text;

    const dateLbl = document.createElement('span');
    dateLbl.className = 'proj-item-date';
    dateLbl.textContent = dk;

    const detachBtn = document.createElement('button');
    detachBtn.className = 'proj-detach-btn';
    detachBtn.title = '연결 해제';
    detachBtn.textContent = '✕';
    detachBtn.onclick = e => { e.stopPropagation(); detachItemFromProject(dk, itemIdx); };

    header.appendChild(dot);
    header.appendChild(nameEl);
    header.appendChild(dateLbl);
    header.appendChild(detachBtn);
    group.appendChild(header);

    const itemSubs = item.sub || [];
    if (itemSubs.length) {
      const subList = document.createElement('div');
      subList.className = 'proj-sub-list';
      itemSubs.forEach(s => {
        const row = document.createElement('div');
        row.className = 'proj-sub-row' + (s.done ? ' done' : '');
        row.innerHTML = `<span class="proj-sub-check">${s.done ? '✓' : '○'}</span><span class="proj-sub-text">${s.text}</span>`;
        subList.appendChild(row);
      });
      group.appendChild(subList);
    }

    area.appendChild(group);
  });
}

function toggleProjectDone(idx) {
  const p = projects[idx];
  if (p.done) {
    p.done = false; p.doneDate = null;
  } else {
    const t = new Date();
    p.done = true;
    p.doneDate = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  }
  saveProjects();
  renderProjectDetail();
  renderAll();
}

// ── 이벤트 바인딩 ──
document.getElementById('btnProjectOpen').onclick    = openProjectPanel;
document.getElementById('btnProjectClose').onclick   = closeProjectPanel;
document.getElementById('projectOverlay').onclick    = closeProjectPanel;
document.getElementById('btnProjectAdd').onclick     = addProject;
document.getElementById('projectNameInput').onkeydown = e => { if (e.key === 'Enter') addProject(); };
document.getElementById('btnProjDetailClose').onclick = closeProjectDetail;

document.querySelectorAll('.proj-cat-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.proj-cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  };
});

initProjectColorPicker();
