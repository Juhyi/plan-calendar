// ── 프로젝트 관리 ──
const PROJECT_COLORS = [
  '#e74c3c','#e67e22','#f39c12','#27ae60',
  '#1abc9c','#3498db','#4f86f7','#9b59b6',
  '#2c3e50','#e91e63','#00b894','#fd79a8',
];

let projectDetailState = { idx: null };
let _tabSelectedProjIdx = null;

// ── 날짜 헬퍼: 기간 전체에 프로젝트 바 표시 (calendar.js에서도 사용) ──
function getProjectsForDate(dk) {
  return projects.filter(p => {
    if (p.done) return p.doneDate === dk;
    const hasStart = p.startDate && p.startDate.length > 0;
    const hasEnd   = p.endDate   && p.endDate.length   > 0;
    if (!hasStart && !hasEnd) return true;          // 날짜 없는 프로젝트 → 항상 표시
    if (!hasStart) return dk <= p.endDate;           // 시작일 없음 → 마감일까지
    if (!hasEnd)   return p.startDate <= dk;         // 종료일 없음 → 시작일 이후 계속
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
  return Object.entries(plans)
    .filter(([,p]) => Number(p.projectId) === Number(projectId))
    .sort(([,a],[,b]) => (a.date||a.startDate) < (b.date||b.startDate) ? -1 : 1)
    .map(([planId,p]) => ({ dk: p.date||p.startDate, planId, item: hydratePlan(planId) }));
}

// 완료 여부 판단: 세부일정 있으면 전체 완료 여부, 없으면 done 플래그
function _isItemDone(item) {
  const subs = item.sub || [];
  return subs.length > 0 ? subs.every(s => s.done) : !!item.done;
}

// ── 일정 ↔ 프로젝트 연결/해제 ──
function attachItemToProject(planId, projectId) {
  if (!plans[planId]) return;
  plans[planId].projectId = projectId;
  showToast('프로젝트에 연결되었습니다');
  savePlans();
}

function detachItemFromProject(planId) {
  if (!plans[planId]) return;
  delete plans[planId].projectId;
  showToast('연결이 해제되었습니다');
  savePlans();
}

// ── 프로젝트에 새 일정 직접 추가 ──
function addItemToProject(projIdx, dateStr, text, category) {
  if (!dateStr || !text) return;
  const p = projects[projIdx];
  const colorPalette = category === 'personal' ? COLORS_PERSONAL : COLORS_WORK;
  const planId = newPlanId();
  plans[planId] = { text, color:colorPalette[2], category, done:false, projectId:p.id, date:dateStr, startDate:dateStr, endDate:dateStr };
  showToast('일정이 추가되었습니다');
  savePlans();
  renderAll();
  renderProjectDetail();
}

// ════════════════════════════════════════
//  관리 다이얼로그 (목록 + 추가)
// ════════════════════════════════════════
function openProjectPanel() {
  if (typeof switchSection === 'function') { switchSection('projects'); renderProjectList(); }
}
function closeProjectPanel() {
  if (typeof switchSection === 'function') switchSection('calendar');
}

// ── 탭 내 인라인 프로젝트 상세 패널 ──
function renderTabProjectDetail(pane, idx, reRender) {
  const p = projects[idx];
  if (!p) { pane.innerHTML = '<div class="tab-det-placeholder">프로젝트를 찾을 수 없습니다</div>'; return; }
  pane.innerHTML = '';

  // 이름
  const nameInp = document.createElement('input');
  nameInp.className = 'tab-det-title'; nameInp.value = p.name;
  pane.appendChild(nameInp);

  // 날짜
  const datesRow = document.createElement('div'); datesRow.className = 'tab-det-dates';
  const fromInp = document.createElement('input'); fromInp.type = 'date'; fromInp.className = 'tab-det-date-inp'; fromInp.value = p.startDate || '';
  const sep = document.createElement('span'); sep.className = 'tab-det-date-sep'; sep.textContent = '~';
  const toInp = document.createElement('input'); toInp.type = 'date'; toInp.className = 'tab-det-date-inp'; toInp.value = p.endDate || '';
  datesRow.appendChild(fromInp); datesRow.appendChild(sep); datesRow.appendChild(toInp);
  pane.appendChild(datesRow);

  // 진행률
  const { total, done: doneCount } = getProjectProgress(p.id);
  if (total > 0) {
    const ratio = Math.round(doneCount / total * 100);
    const progEl = document.createElement('div'); progEl.className = 'tab-det-progress';
    progEl.innerHTML = `<div class="tab-det-prog-bar"><div class="tab-det-prog-fill" style="width:${ratio}%;background:${p.color}"></div></div><span class="tab-det-prog-label">${doneCount}/${total} (${ratio}%)</span>`;
    pane.appendChild(progEl);
  }

  // 연결된 일정 목록
  const linkedItems = getProjectItems(p.id);
  if (linkedItems.length) {
    const lbl = document.createElement('div'); lbl.className = 'tab-det-proj-lbl'; lbl.textContent = '연결 일정';
    pane.appendChild(lbl);
    const itemList = document.createElement('div'); itemList.className = 'tab-det-proj-items';
    linkedItems.slice(0, 15).forEach(({ dk, planId, item }) => {
      const row = document.createElement('div');
      row.className = 'tab-det-proj-item' + (_isItemDone(item) ? ' done' : '');
      row.textContent = `${dk}  ${item.text}`;
      row.onclick = e => { e.stopPropagation(); openInlineDetail(planId); };
      itemList.appendChild(row);
    });
    pane.appendChild(itemList);
  }

  // 버튼
  const btns = document.createElement('div'); btns.className = 'tab-det-btns';
  const saveBtn = document.createElement('button'); saveBtn.className = 'tab-det-save'; saveBtn.textContent = '저장';
  saveBtn.onclick = () => {
    const newName = nameInp.value.trim();
    if (newName) projects[idx].name = newName;
    projects[idx].startDate = fromInp.value || projects[idx].startDate;
    projects[idx].endDate = toInp.value;
    showToast('수정되었습니다');
    saveProjects?.();
    renderAll?.();
  };
  const manageBtn = document.createElement('button'); manageBtn.className = 'tab-det-manage'; manageBtn.textContent = '상세 관리';
  manageBtn.onclick = () => openProjectDetail(idx);
  const delBtn = document.createElement('button'); delBtn.className = 'tab-det-del'; delBtn.textContent = '삭제';
  delBtn.onclick = () => {
    if (!confirm(`"${projects[idx].name}" 삭제하시겠습니까?`)) return;
    deleteProject(idx);
    if (typeof _tabSelectedProjIdx !== 'undefined') _tabSelectedProjIdx = null;
    pane.innerHTML = '<div class="tab-det-placeholder">항목을 선택하세요</div>';
    reRender?.();
  };
  btns.appendChild(saveBtn); btns.appendChild(manageBtn); btns.appendChild(delBtn);
  pane.appendChild(btns);
}

function renderProjectList() {
  const list = document.getElementById('projectList');
  list.innerHTML = '';
  const activeCat = (typeof currentCategory !== 'undefined' ? currentCategory : 'all');
  const _projMobileTabs = typeof _mkMobileCatTabs === 'function' ? _mkMobileCatTabs(activeCat) : null;
  if (_projMobileTabs) list.appendChild(_projMobileTabs);
  const pfrom = document.getElementById('projectDateFrom')?.value;
  const pto   = document.getElementById('projectDateTo')?.value;

  const allRows = [...projects]
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (a.p.done ? 1 : 0) - (b.p.done ? 1 : 0))
    .filter(({ p }) => {
      if (activeCat !== 'all' && (p.category || 'work') !== activeCat) return false;
      if (pfrom && p.endDate && p.endDate < pfrom) return false;
      if (pto   && p.startDate && p.startDate > pto) return false;
      return true;
    });

  const mkProjectRow = ({ p, i }) => {
    const { total, done: doneCount } = getProjectProgress(p.id);
    const row = document.createElement('div');
    row.className = 'project-item' + (p.done ? ' is-done' : '');
    row.style.cursor = 'pointer';
    row.title = '클릭하여 프로젝트 관리';
    row.onclick = (e) => { if (e.target.closest('.project-del-btn')) return; openProjectDetail(i); };

    const dot = document.createElement('span');
    dot.className = 'project-color-dot';
    dot.style.background = p.color;

    const info = document.createElement('div');
    info.className = 'project-info';
    info.innerHTML = `
      <div class="project-name">${p.name}${total ? ` <span class="project-progress">(${doneCount}/${total})</span>` : ''}</div>
      <div class="project-dates">${p.done ? `✓ 완료: ${p.doneDate}` : p.endDate ? `${p.startDate} ~ ${p.endDate}` : `${p.startDate} ~ (종료일 없음)`}</div>`;

    const actions = document.createElement('div');
    actions.className = 'project-actions';
    const delBtn = document.createElement('button');
    delBtn.className = 'project-del-btn';
    delBtn.textContent = '✕';
    delBtn.onclick = (e) => { e.stopPropagation(); deleteProject(i); };
    actions.appendChild(delBtn);

    row.appendChild(dot); row.appendChild(info); row.appendChild(actions);
    return row;
  };

  if (!allRows.length) {
    const empty = document.createElement('div');
    empty.className = 'project-empty';
    empty.textContent = '등록된 프로젝트가 없습니다';
    list.appendChild(empty);
    return;
  }

  if (activeCat === 'all') {
    const workRows = allRows.filter(({ p }) => (p.category || 'work') === 'work');
    const persRows = allRows.filter(({ p }) => (p.category || 'work') === 'personal');

    const isMobile = window.innerWidth <= 720;

    if (isMobile) {
      // ── 모바일: 업무/개인 탭 전환 + 하단 디테일 ──
      const wrap = document.createElement('div'); wrap.className = 'proj-mobile-wrap';

      // 탭 버튼
      const tabRow = document.createElement('div'); tabRow.className = 'proj-mobile-tab-row';
      const workTabBtn = document.createElement('button'); workTabBtn.className = 'proj-mobile-tab-btn active'; workTabBtn.textContent = '💼 업무';
      const persTabBtn = document.createElement('button'); persTabBtn.className = 'proj-mobile-tab-btn'; persTabBtn.textContent = '🏠 개인';
      tabRow.appendChild(workTabBtn); tabRow.appendChild(persTabBtn);

      // 목록 영역
      const listArea = document.createElement('div'); listArea.className = 'proj-mobile-list';

      // 디테일 영역
      const detPane = document.createElement('div'); detPane.className = 'proj-mobile-det';
      if (_tabSelectedProjIdx !== null && projects[_tabSelectedProjIdx]) {
        renderTabProjectDetail(detPane, _tabSelectedProjIdx, renderProjectList);
      } else {
        detPane.innerHTML = '<div class="tab-det-placeholder" style="padding:24px 16px;text-align:center;color:#bbb;font-size:13px">위 목록에서 프로젝트를 선택하세요</div>';
      }

      const mkMobileRow = ({ p, i }) => {
        const row = mkProjectRow({ p, i });
        if (i === _tabSelectedProjIdx) row.classList.add('tab-selected');
        row.onclick = (e) => {
          if (e.target.closest('.project-del-btn')) return;
          listArea.querySelectorAll('.project-item').forEach(r => r.classList.remove('tab-selected'));
          row.classList.add('tab-selected');
          _tabSelectedProjIdx = i;
          detPane.innerHTML = '';
          renderTabProjectDetail(detPane, i, renderProjectList);
          detPane.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        };
        return row;
      };

      let curCat = 'work';
      const renderList = () => {
        listArea.innerHTML = '';
        const rows = curCat === 'work' ? workRows : persRows;
        if (rows.length) rows.forEach(r => listArea.appendChild(mkMobileRow(r)));
        else { const e = document.createElement('div'); e.className = 'sch-col-empty'; e.textContent = '없음'; listArea.appendChild(e); }
      };
      workTabBtn.onclick = () => { curCat = 'work'; workTabBtn.classList.add('active'); persTabBtn.classList.remove('active'); renderList(); };
      persTabBtn.onclick = () => { curCat = 'personal'; persTabBtn.classList.add('active'); workTabBtn.classList.remove('active'); renderList(); };
      renderList();

      wrap.appendChild(tabRow); wrap.appendChild(listArea); wrap.appendChild(detPane);
      list.appendChild(wrap);
    } else {
      // ── 데스크톱: 기존 좌우 master-detail ──
      const masterDetail = document.createElement('div'); masterDetail.className = 'tab-master-detail tab-master-detail-project';
      masterDetail.style.height = typeof _calcSplitHeight === 'function' ? _calcSplitHeight(list) : 'calc(100vh - 140px)';

      const listPane = document.createElement('div'); listPane.className = 'tab-list-pane'; listPane.style.width = '52%';
      const splitEl = document.createElement('div'); splitEl.className = 'sch-split sch-split-project'; splitEl.style.height = '100%';

      const detPane = document.createElement('div'); detPane.className = 'tab-detail-pane';
      if (_tabSelectedProjIdx !== null && projects[_tabSelectedProjIdx]) {
        renderTabProjectDetail(detPane, _tabSelectedProjIdx, renderProjectList);
      } else {
        detPane.innerHTML = '<div class="tab-det-placeholder">← 항목을 선택하면<br>여기서 수정할 수 있어요</div>';
      }

      const mkAllRow = ({ p, i }) => {
        const row = mkProjectRow({ p, i });
        if (i === _tabSelectedProjIdx) row.classList.add('tab-selected');
        row.onclick = (e) => {
          if (e.target.closest('.project-del-btn')) return;
          listPane.querySelectorAll('.project-item').forEach(r => r.classList.remove('tab-selected'));
          row.classList.add('tab-selected');
          _tabSelectedProjIdx = i;
          renderTabProjectDetail(detPane, i, renderProjectList);
        };
        return row;
      };

      const workCol = document.createElement('div'); workCol.className = 'sch-col sch-col-work';
      const workHdr = document.createElement('div'); workHdr.className = 'sch-col-hdr'; workHdr.textContent = '💼 업무';
      workCol.appendChild(workHdr);
      if (workRows.length) workRows.forEach(r => workCol.appendChild(mkAllRow(r)));
      else { const e = document.createElement('div'); e.className = 'sch-col-empty'; e.textContent = '없음'; workCol.appendChild(e); }

      const persCol = document.createElement('div'); persCol.className = 'sch-col sch-col-personal';
      const persHdr = document.createElement('div'); persHdr.className = 'sch-col-hdr'; persHdr.textContent = '🏠 개인';
      persCol.appendChild(persHdr);
      if (persRows.length) persRows.forEach(r => persCol.appendChild(mkAllRow(r)));
      else { const e = document.createElement('div'); e.className = 'sch-col-empty'; e.textContent = '없음'; persCol.appendChild(e); }

      splitEl.appendChild(workCol); splitEl.appendChild(persCol);
      listPane.appendChild(splitEl);
      masterDetail.appendChild(listPane); masterDetail.appendChild(detPane);
      list.appendChild(masterDetail);
    }
  } else {
    // 업무/개인 단일: master-detail
    if (typeof _buildMasterDetail === 'function') {
      _buildMasterDetail(list, _tabSelectedProjIdx !== null ? _tabSelectedProjIdx : null, (listPane, detPane) => {
        if (_tabSelectedProjIdx !== null && projects[_tabSelectedProjIdx]) {
          renderTabProjectDetail(detPane, _tabSelectedProjIdx, renderProjectList);
        }
        allRows.forEach(({ p, i }) => {
          const row = mkProjectRow({ p, i });
          if (i === _tabSelectedProjIdx) row.classList.add('tab-selected');
          row.onclick = (e) => {
            if (e.target.closest('.project-del-btn')) return;
            listPane.querySelectorAll('.project-item').forEach(r => r.classList.remove('tab-selected'));
            row.classList.add('tab-selected');
            _tabSelectedProjIdx = i;
            renderTabProjectDetail(detPane, i, renderProjectList);
          };
          listPane.appendChild(row);
        });
      });
    } else {
      allRows.forEach(r => list.appendChild(mkProjectRow(r)));
    }
  }
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
  if (endDate && startDate > endDate) { statusEl.textContent = '시작일이 종료일보다 늦습니다.'; return; }

  projects.push({ id: Date.now(), name, color, category, startDate, endDate, done: false, doneDate: null });
  showToast('프로젝트가 등록되었습니다');
  saveProjects();

  document.getElementById('projectNameInput').value = '';
  document.getElementById('projectStartInput').value = '';
  document.getElementById('projectEndInput').value = '';
  statusEl.textContent = '';
}

function deleteProject(i) {
  if (!confirm(`"${projects[i].name}" 프로젝트를 삭제하시겠습니까?`)) return;
  if (projectDetailState.idx === i) closeProjectDetail();
  if (_tabSelectedProjIdx === i) _tabSelectedProjIdx = null;
  projects.splice(i, 1);
  showToast('삭제되었습니다');
  saveProjects();
}

function saveProjects() {
  if (!projectRef) return;
  const obj = {};
  projects.forEach(p => { obj[p.id] = {...p}; });
  projectRef.set(obj);
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
  // 일정 탭으로 초기화
  document.querySelectorAll('.proj-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === 'tasks'));
  document.querySelectorAll('.proj-tab-pane').forEach(p => p.classList.toggle('active', p.id === 'projTabTasks'));
  projectDetailState.idx = idx;
  renderProjectDetail();
  document.getElementById('projDetailPanel').classList.add('open');
  document.body.classList.add('panel-open');
  document.body.classList.add('proj-panel-open');
}

function closeProjectDetail() {
  document.getElementById('projDetailPanel').classList.remove('open');
  document.body.classList.remove('panel-open');
  document.body.classList.remove('proj-panel-open');
  projectDetailState.idx = null;
  if (typeof currentSection !== 'undefined' && currentSection === 'projects') renderProjectList();
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
      if (!startInp.value) return;
      if (endInp.value && startInp.value > endInp.value) return;
      projects[idx].startDate = startInp.value;
      projects[idx].endDate   = endInp.value || '';
      saveProjects();
      renderAll();
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
  doneBtn.className = 'proj-action-btn done-toggle' + (p.done ? ' is-done' : '');
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

  // ── 연결 일정 메모 목록 (정보 탭) ──
  const memoListEl = document.getElementById('projInfoMemoList');
  memoListEl.innerHTML = '';
  const memoItems = getProjectItems(p.id).filter(({ item }) => item.memo && item.memo.trim());
  if (memoItems.length) {
    const hdr = document.createElement('div');
    hdr.className = 'proj-list-header'; hdr.textContent = `일정 메모 ${memoItems.length}건`;
    memoListEl.appendChild(hdr);
    memoItems.forEach(({ item, planId }) => {
      const card = document.createElement('div'); card.className = 'proj-memo-card';
      card.style.borderLeftColor = item.color || '#4f86f7';
      const title = document.createElement('div'); title.className = 'proj-memo-card-title'; title.textContent = item.text;
      const text  = document.createElement('div'); text.className = 'proj-memo-card-text';  text.textContent = item.memo;
      card.appendChild(title); card.appendChild(text);
      card.onclick = () => { closeProjectDetail(); openDetail?.(planId); };
      memoListEl.appendChild(card);
    });
  }

  _renderScrollArea(idx);
}

function _renderScrollArea(idx) {
  const area = document.getElementById('projScrollArea');
  area.innerHTML = '';
  const p = projects[idx];

  // ── 일정 추가 폼 ──
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  const dateInp = document.createElement('input');
  dateInp.type = 'date'; dateInp.className = 'proj-add-date'; dateInp.value = todayStr;

  const textInp = document.createElement('input');
  textInp.type = 'text'; textInp.className = 'proj-add-text'; textInp.placeholder = '일정 제목을 입력하세요';
  textInp.maxLength = 50;

  const catSel = document.createElement('select');
  catSel.className = 'proj-add-cat';
  ['work', 'personal'].forEach(v => {
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = v === 'work' ? '💼 업무' : '🏠 개인';
    catSel.appendChild(opt);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'proj-add-btn'; addBtn.textContent = '추가';

  const doAdd = () => {
    const t = textInp.value.trim();
    if (!t) { textInp.focus(); return; }
    addItemToProject(idx, dateInp.value, t, catSel.value);
    textInp.value = '';
  };
  addBtn.onclick = doAdd;
  textInp.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doAdd(); } };

  const addForm = document.createElement('div');
  addForm.className = 'proj-add-form';

  const dateRow = document.createElement('div');
  dateRow.className = 'proj-form-row';
  const dateLbl = document.createElement('label'); dateLbl.className = 'proj-form-label'; dateLbl.textContent = '날짜';
  dateRow.appendChild(dateLbl); dateRow.appendChild(dateInp);

  const textRow = document.createElement('div');
  textRow.className = 'proj-form-row';
  const textLbl = document.createElement('label'); textLbl.className = 'proj-form-label'; textLbl.textContent = '제목';
  textRow.appendChild(textLbl); textRow.appendChild(textInp);

  const footRow = document.createElement('div');
  footRow.className = 'proj-form-foot';
  footRow.appendChild(catSel); footRow.appendChild(addBtn);

  addForm.appendChild(dateRow);
  addForm.appendChild(textRow);
  addForm.appendChild(footRow);
  area.appendChild(addForm);

  // ── 드롭존 ──
  const dropZone = document.createElement('div');
  dropZone.className = 'proj-drop-zone';
  dropZone.innerHTML = '<span class="proj-drop-hint">📎 캘린더에서 일정을 드래그하여 연결</span>';

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
      attachItemToProject(d.planId, projects[curIdx].id);
    } catch(err) {}
  });
  area.appendChild(dropZone);

  // ── 연결된 일정 목록 ──
  const connectedItems = getProjectItems(p.id);
  const listHeader = document.createElement('div');
  listHeader.className = 'proj-list-header';
  listHeader.textContent = connectedItems.length ? `연결된 일정 ${connectedItems.length}개` : '연결된 일정 없음';
  area.appendChild(listHeader);

  if (!connectedItems.length) return;

  connectedItems.forEach(({ dk, planId, item }) => {
    const isDone = _isItemDone(item);
    const subs = item.sub || [];
    const subDone = subs.filter(s => s.done).length;
    const color = item.color || '#4f86f7';

    const card = document.createElement('div');
    card.className = 'proj-item-card' + (isDone ? ' done' : '');
    card.style.borderLeftColor = color;
    card.title = '클릭하여 일정 관리';
    card.onclick = e => {
      if (e.target.closest('.proj-detach-btn')) return;
      closeProjectDetail();
      if (typeof openInlineDetail === 'function') openInlineDetail(planId);
    };

    const cardHead = document.createElement('div');
    cardHead.className = 'proj-item-card-head';

    const nameEl = document.createElement('div');
    nameEl.className = 'proj-item-card-name';
    const nameText = document.createElement('span');
    nameText.textContent = (isDone ? '✅ ' : '') + item.text;
    const _cat = item.category || 'work';
    const _type = item.type || 'task';
    const catBadge = document.createElement('span');
    catBadge.className = 'sch-title-badge sch-badge-cat-' + _cat;
    catBadge.textContent = _cat === 'personal' ? '🏠 개인' : '💼 업무';
    const typeBadge = document.createElement('span');
    typeBadge.className = 'sch-title-badge sch-badge-' + _type;
    typeBadge.textContent = _type === 'event' ? '📅 약속' : _type === 'expense' ? '💰 지출' : '✅ 할일';
    nameEl.appendChild(nameText);
    nameEl.appendChild(catBadge);
    nameEl.appendChild(typeBadge);

    const detachBtn = document.createElement('button');
    detachBtn.className = 'proj-detach-btn';
    detachBtn.title = '연결 해제';
    detachBtn.textContent = '✕';
    detachBtn.onclick = e => { e.stopPropagation(); detachItemFromProject(planId); };

    cardHead.appendChild(nameEl);
    cardHead.appendChild(detachBtn);

    const metaEl = document.createElement('div');
    metaEl.className = 'proj-item-card-meta';

    const dateChip = document.createElement('span');
    dateChip.className = 'proj-item-chip date';
    const dateLabel = item.startDate && item.startDate !== item.endDate
      ? `${item.startDate} ~ ${item.endDate}`
      : (item.startDate || dk);
    dateChip.textContent = '📅 ' + dateLabel;
    metaEl.appendChild(dateChip);

    if (subs.length) {
      const progChip = document.createElement('span');
      progChip.className = 'proj-item-chip progress';
      progChip.textContent = `${subDone}/${subs.length} 완료`;
      if (isDone) progChip.style.cssText = 'background:#e8f8ee;color:#27ae60';
      metaEl.appendChild(progChip);
    }

    card.appendChild(cardHead);
    card.appendChild(metaEl);

    if (subs.length) {
      const subList = document.createElement('div');
      subList.className = 'proj-item-subs';
      subs.forEach(s => {
        const row = document.createElement('div');
        row.className = 'proj-sub-row' + (s.done ? ' done' : '');
        row.innerHTML = `<span class="proj-sub-check">${s.done ? '✓' : '○'}</span><span class="proj-sub-text">${s.text}</span>`;
        subList.appendChild(row);
      });
      card.appendChild(subList);
    }

    area.appendChild(card);
  });
}

// ── 프로젝트 → 캘린더 일정 변환 ──
function convertProjectToItem(idx) {
  const p = projects[idx];
  if (!confirm(`"${p.name}" 프로젝트를 캘린더 일정으로 변환하시겠습니까?\n프로젝트 바가 삭제되고 기간 일정으로 등록됩니다.`)) return;

  // 기간 일정 생성
  const planId = newPlanId();
  plans[planId] = {
    text: p.name,
    color: p.color,
    category: p.category || 'work',
    done: p.done || false,
    date: p.startDate,
    startDate: p.startDate,
    endDate: p.endDate,
    projectId: null
  };

  // 연결된 일정에서 projectId 해제
  getProjectItems(p.id).forEach(({ planId: pid }) => {
    if (plans[pid]) delete plans[pid].projectId;
  });

  closeProjectDetail();
  projects.splice(idx, 1);
  saveProjects();
  savePlans();
  renderAll();
}

function toggleProjectDone(idx) {
  const p = projects[idx];
  if (p.done) {
    p.done = false; p.doneDate = null;
    showToast('완료가 취소되었습니다');
  } else {
    p.done = true;
    p.doneDate = localDateStr();
    showToast('프로젝트가 완료되었습니다');
  }
  saveProjects();
  renderProjectDetail();
  renderAll();
}

// ── 이벤트 바인딩 ──
const _btnProjectOpen = document.getElementById('btnProjectOpen');
if (_btnProjectOpen) _btnProjectOpen.onclick = openProjectPanel;
const _btnProjectClose = document.getElementById('btnProjectClose');
if (_btnProjectClose) _btnProjectClose.onclick = closeProjectPanel;
const _projOverlay = document.getElementById('projectOverlay');
if (_projOverlay) _projOverlay.onclick = closeProjectPanel;
document.getElementById('btnProjectAdd').onclick     = addProject;
document.getElementById('projectNameInput').onkeydown = e => { if (e.key === 'Enter') addProject(); };
document.getElementById('btnProjDetailClose').onclick = closeProjectDetail;
document.getElementById('btnProjConvert').onclick = () => { const idx = projectDetailState.idx; if (idx !== null) convertProjectToItem(idx); };

document.querySelectorAll('.proj-cat-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.proj-cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  };
});

initProjectColorPicker();

// ── 프로젝트 상세 탭 전환 ──
document.querySelectorAll('.proj-tab-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.proj-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.proj-tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const paneId = 'projTab' + btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1);
    document.getElementById(paneId)?.classList.add('active');
  };
});
