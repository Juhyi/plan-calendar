// ════════════════════════════════════════════════════════════
//  calendar.js
//  역할: 월간 캘린더 렌더링, 일정 CRUD 모달, 드래그앤드롭 이동,
//        날짜 팝오버, 각종 데이터 인덱스 맵 빌드를 담당
// ════════════════════════════════════════════════════════════


// ════════════════════════════════════════════════════════════
//  인덱스 맵 빌드 함수들
//  renderMonth/renderWeek 시작 시 1회 호출해 메모리에 올려두고
//  각 셀 렌더링에서 O(1)로 조회함 (전체 순회는 여기서만)
// ════════════════════════════════════════════════════════════

// ── 완료된 세부일정 맵: { "완료날짜": [{ sub, item, planId }] } ──
// 세부일정이 완료된 날짜에 해당 항목이 표시되도록 인덱싱
// 예: 3/10 일정의 세부일정이 3/15에 완료 → completedSubMap["2026-03-15"]에 추가
function buildCompletedSubMap() {
  const map = {};
  Object.entries(subTasks).forEach(([subId, sub]) => {
    if (!sub.done || !sub.completedAt) return; // 미완료 또는 완료날짜 없으면 건너뜀
    const plan = plans[sub.parentPlanId];
    if (!plan) return; // 고아 세부일정 (부모 일정이 삭제된 경우) 무시
    const dk = sub.completedAt;
    if (!map[dk]) map[dk] = [];
    // hydratePlan: planId → plan + sub[] 조립 (utils.js)
    map[dk].push({ sub: { ...sub, subId }, item: hydratePlan(sub.parentPlanId), planId: sub.parentPlanId, dateKey: plan.date });
  });
  return map;
}

// ── 기간 스팬맵: { "날짜": [{ item, planId, pos }] } ──
// startDate ~ endDate가 다른 기간 일정을 날짜별로 인덱싱
// pos: 'start'(시작일) | 'mid'(중간) | 'end'(종료일) | 'single'(하루짜리)
//      → CSS에서 span-bar 모서리 모양을 다르게 표현
function buildSpanMap() {
  const map = {};
  Object.entries(plans).forEach(([planId, plan]) => {
    const it = hydratePlan(planId);
    if (!it) return;
    // startDate === endDate이거나 날짜가 없으면 기간 일정이 아님
    if (!it.startDate || !it.endDate || it.startDate >= it.endDate) return;
    const subs = it.sub || [];

    if (subs.length > 0) {
      // 세부일정이 있는 기간 일정:
      // 완료된 세부일정이 있으면 → 그 완료 날짜에만 표시 (진행 상황 추적 목적)
      // 완료된 세부일정이 없으면 → 마감일(endDate)에만 표시 (아직 진행 중)
      const completedDates = new Set(
        subs.filter(s => s.done && s.completedAt).map(s => s.completedAt)
      );
      if (completedDates.size > 0) {
        completedDates.forEach(dk => {
          if (!map[dk]) map[dk] = [];
          map[dk].push({ item: it, dateKey: plan.date, planId, pos: 'single' });
        });
      } else {
        const dueKey = it.endDate;
        if (!map[dueKey]) map[dueKey] = [];
        map[dueKey].push({ item: it, dateKey: plan.date, planId, pos: 'single' });
      }
      return;
    }

    // 세부일정 없는 기간 일정: 시작일~종료일 전체에 스팬 바 표시
    const s = new Date(it.startDate + 'T00:00:00');
    const e = new Date(it.endDate   + 'T00:00:00');
    for (let c = new Date(s); c <= e; c.setDate(c.getDate() + 1)) {
      const dk = `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}-${String(c.getDate()).padStart(2, '0')}`;
      if (!map[dk]) map[dk] = [];
      const isSt = dk === it.startDate, isEn = dk === it.endDate;
      // 시작/중간/끝 위치를 pos로 기록해 스팬 바 모양 결정
      map[dk].push({ item: it, dateKey: plan.date, planId, pos: isSt && isEn ? 'single' : isSt ? 'start' : isEn ? 'end' : 'mid' });
    }
  });
  return map;
}

// ── 미완료 세부일정 맵: { "예정일": [{ sub, item, planId }] } ──
// 세부일정의 dueDate(예정일)가 부모 일정의 날짜와 다를 때만 인덱싱
// 예: 부모 일정이 3/10, 세부일정 예정일이 3/20 → pendingSubMap["2026-03-20"]에 추가
// (부모와 같은 날이면 부모 아이템 아래에 자연스럽게 렌더되므로 중복 방지)
function buildPendingSubMap() {
  const map = {};
  Object.entries(subTasks).forEach(([subId, sub]) => {
    if (sub.done || !sub.dueDate) return; // 완료됐거나 예정일 없으면 건너뜀
    const plan = plans[sub.parentPlanId];
    if (!plan) return;
    // 부모 날짜와 예정일이 같으면 이미 부모 아이템으로 표현됨 → 건너뜀
    if (sub.dueDate === (plan.startDate || plan.date)) return;
    const dk = sub.dueDate;
    if (!map[dk]) map[dk] = [];
    map[dk].push({ sub: { ...sub, subId }, item: hydratePlan(sub.parentPlanId), planId: sub.parentPlanId });
  });
  return map;
}


// ════════════════════════════════════════════════════════════
//  월간 캘린더 렌더
// ════════════════════════════════════════════════════════════

function renderMonth() {
  // 1. 제목 바꾸기 (예: 2026년 3월)
  document.getElementById('title').textContent = `${year}년 ${month + 1}월`;
  // 2. 기존 달력 싹 지우기 (중요! 안 지우면 지난달 달력 밑에 이번 달이 또 붙음)
  const body = document.getElementById('calBody');
  body.innerHTML = ''; // 기존 DOM 초기화

  // 3. 이번 달 첫 날의 요일(0=일 ~ 6=토), 마지막 날짜
  const firstDay = new Date(year, month, 1).getDay();      // 0(일)~6(토)
  const dim      = new Date(year, month + 1, 0).getDate(); // month+1의 0일 = 이번달 마지막 날

  // 4. cells 배열: 달력 그리드용 (앞 빈칸 null + 날짜 + 뒷 빈칸 null)
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);    // 1일 전까지 빈칸(null) 채우기
  for (let d = 1; d <= dim; d++) cells.push(d);           // 1일부터 31일까지 채우기
  while (cells.length % 7 !== 0) cells.push(null);        // 마지막 줄 남은 칸 빈칸 채우기

  // 렌더 시작 전 3개 인덱스 맵 미리 빌드 (셀마다 재계산하지 않기 위해)
  const spanMap         = buildSpanMap();   // 여러 날짜에 걸친 일정 장부
  const pendingSubMap   = buildPendingSubMap();   // 아직 안 끝난 할 일 장부
  const completedSubMap = buildCompletedSubMap(); // 다 끝난 할 일 장부

  // 7개씩 잘라 주(row) 단위로 렌더
  for (let w = 0; w < cells.length / 7; w++) {  // 주(week) 단위로 반복
    const row = document.createElement('div');  // <div> 태그를 메모리에 새로 만듦
    row.className = 'week-row';                 // 클래스 이름 붙여줌 (CSS용)

    for (let di = 0; di < 7; di++) {            // 일(day) 단위로 반복
      const d    = cells[w * 7 + di];           // 날짜 한 칸 <div> 생성
      const cell = document.createElement('div');
      cell.className = 'cell' + (!d ? ' empty' : isToday(d, month, year) ? ' today' : '');

      if (d) {
        const key = dateKey(year, month, d); // "2026-03-24" 형식
        cell.dataset.key = key;

        // ── 날짜 헤더 (날짜 숫자 + '+' 버튼) ──────────────
        const hdr = document.createElement('div'); hdr.className = 'cell-header';
        const num = document.createElement('span');
        const isHol = !!holidays[key];
        // 오늘·공휴일·일요일·토요일 순으로 클래스 결정
        num.className = 'date-num' +
          (isToday(d, month, year)  ? ' today-num'   :
           isHol && di !== 0        ? ' holiday-num' :
           di === 0                 ? ' sun-num'     :
           di === 6                 ? ' sat-num'     : '');
        num.textContent = d;

        // '+' 버튼: 날짜 팝오버 오픈 (일정 추가 진입점)
        const ab = document.createElement('button'); ab.className = 'add-btn'; ab.textContent = '+';
        ab.onclick = e => { e.stopPropagation(); openDayPopover(key, e.currentTarget); }; // '이벤트 전파 방지' (stopPropagation)
        hdr.appendChild(num); hdr.appendChild(ab);
        cell.appendChild(hdr);
 

        // ── 드래그앤드롭: 날짜 셀이 드롭 대상 ──────────────
        cell.addEventListener('dragover', e => {    // (감시: "누가 내 위로 지나가나?")
          const hasCal = e.dataTransfer.types.includes('application/x-cal-item'); //데이터 검사
          // const hasSub = e.dataTransfer.types.includes('application/x-sub-item'); // [dead] 세부일정 드래그 미동작
          if (!hasCal) return;
          e.preventDefault(); e.dataTransfer.dropEffect = 'move';   // e.preventDefault() : 드롭 받을 준비
          cell.classList.add('drag-over');  // 시각 효과
        });
        cell.addEventListener('dragleave', e => {   // (취소: "그냥 지나갔네?")
          if (!cell.contains(e.relatedTarget)) cell.classList.remove('drag-over');  // 시각효과 제거
        });
        cell.addEventListener('drop', e => {  // (실행: "이제 놓았구나! 데이터 바꿔줄게")
          e.preventDefault(); cell.classList.remove('drag-over'); 
          // 일정 이동
          if (e.dataTransfer.types.includes('application/x-cal-item')) {
            try {
              const d = JSON.parse(e.dataTransfer.getData('application/x-cal-item')); // 데이터 복구
              moveCalItem(d.planId, d.fromDisplayKey, key); // DB 업데이트
            } catch (err) {}
            return;
          }
          // [dead] 세부일정 → 독립 일정 분리: 디테일 패널이 달력을 가려 드롭 대상에 이벤트가 전달되지 않아 미동작
          // if (e.dataTransfer.types.includes('application/x-sub-item')) {
          //   try {
          //     const d = JSON.parse(e.dataTransfer.getData('application/x-sub-item'));
          //     extractSubToItem(d.planId, d.subId, key);
          //   } catch (err) {}
          // }
        });

        // ── 공휴일 표시 ──────────────────────────────────
        if (isHol) {
          const holDiv = document.createElement('div'); holDiv.className = 'cell-holiday';
          holDiv.textContent = holidays[key]; cell.appendChild(holDiv);
        }


        // ── 헬퍼: 일반 일정 아이템 DOM 생성 ──────────────
        const mkItemEl = (it, planId) => {
          const item = document.createElement('div');
          const subs = it.sub || [];
          const hasPendingSubs  = subs.some(s => !s.done);
          const isVisuallyDone  = subs.length > 0 ? subs.every(s => s.done) : it.done;
          const proj = it.projectId ? projects.find(p => Number(p.id) === Number(it.projectId)) : null;
          // 약속 타입이고 종료일이 오늘보다 이전이면 흐리게 표시
          const isPastEvent = it.type === 'event' && (it.endDate || it.date || key) < localDateStr();

          item.className = 'item cat-' + (it.category || 'work') +
            (it.type === 'event'                         ? ' item-event'      : '') +
            (isVisuallyDone && it.type !== 'event'       ? ' item-done'       : '') +
            (hasPendingSubs                              ? ' item-inprogress' : '');

          // 인라인 스타일로 opacity 제어 (CSS 명시도 충돌 방지)
          if (it.type === 'event') {
            item.style.opacity = isPastEvent ? '0.35' : '1';
            item.style.filter  = isPastEvent ? 'saturate(0.25)' : 'none'; // 색감 죽이기
          }

          if (proj) item.dataset.tooltip = '📁 ' + proj.name;

          // 좌측 색상 바: 프로젝트 색 > 진행률 보간 색 순서로 우선
          const itemDisplayColor = getItemDisplayColor(it); // utils.js
          item.style.borderLeftColor = proj ? (proj.color || itemDisplayColor) : itemDisplayColor;

          const dot     = document.createElement('span'); dot.className = 'item-dot'; dot.style.background = itemDisplayColor;
          const content = document.createElement('div');  content.className = 'item-content';
          const txt     = document.createElement('span'); txt.className = 'item-text'; txt.textContent = it.text;
          content.appendChild(txt);
          const del = document.createElement('span'); del.className = 'del'; del.textContent = '✕';
          del.onclick = e => { e.stopPropagation(); deletePlan(planId); };
          item.onclick  = e => { e.stopPropagation(); openDetail(planId, e.currentTarget); };

          item.draggable = true;
          item.addEventListener('dragstart', e => {   // 드래그 시작
            e.stopPropagation();
            e.dataTransfer.effectAllowed = 'move';
            // fromDisplayKey: 어느 셀에서 드래그했는지 기록 (기간 일정 offset 계산에 사용)
            e.dataTransfer.setData('application/x-cal-item', JSON.stringify({ planId, fromDisplayKey: key }));
            setTimeout(() => item.classList.add('dragging'), 0); 
          });
          item.addEventListener('dragend', () => item.classList.remove('dragging'));  // 조립 끝
          item.appendChild(dot); item.appendChild(content); item.appendChild(del);  
          return item;
        };


        // ── 헬퍼: 기간 스팬 바 DOM 생성 ──────────────────
        const mkSpanEl = (sp) => {
          const bar = document.createElement('div');
          const spSubs        = sp.item.sub || [];
          const spHasPending  = spSubs.some(s => !s.done);
          const spVisuallyDone = spSubs.length > 0 ? spSubs.every(s => s.done) : sp.item.done;
          const spIsPastEvent  = sp.item.type === 'event' && (sp.item.endDate || sp.item.date || key) < localDateStr();

          bar.className = 'span-bar span-' + sp.pos + // [dead] ' cat-' + (sp.item.category || 'work') : borderLeftColor 인라인 스타일에 묻혀 실질적으로 무시됨
            (spVisuallyDone  ? ' span-bar-done'       : '') +
            (spHasPending    ? ' span-bar-inprogress' : '');

          if (sp.item.type === 'event') {
            bar.style.opacity = spIsPastEvent ? '0.35' : '1';
            bar.style.filter  = spIsPastEvent ? 'saturate(0.25)' : 'none';
          }

          const spColor = getItemDisplayColor(sp.item);
          const spProj  = sp.item.projectId ? projects.find(p => Number(p.id) === Number(sp.item.projectId)) : null;
          bar.style.borderLeftColor = spProj ? (spProj.color || spColor) : spColor;

          const sdot = document.createElement('span'); sdot.className = 'item-dot'; sdot.style.background = spColor;
          const stxt = document.createElement('span'); stxt.className = 'item-text';
          stxt.textContent = sp.item.text + getProgressText(sp.item); // "제목 (완료/전체)"
          const sdel = document.createElement('span'); sdel.className = 'del'; sdel.textContent = '✕';
          sdel.onclick = e => { e.stopPropagation(); deletePlan(sp.planId); };
          bar.appendChild(sdot); bar.appendChild(stxt); bar.appendChild(sdel);
          bar.onclick = e => { e.stopPropagation(); openDetail(sp.planId, bar); };

          bar.draggable = true;
          bar.addEventListener('dragstart', e => {
            e.stopPropagation(); e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('application/x-cal-item', JSON.stringify({ planId: sp.planId, fromDisplayKey: key }));
            setTimeout(() => bar.classList.add('dragging'), 0);
          });
          bar.addEventListener('dragend', () => bar.classList.remove('dragging'));
          return bar;
        };


        // ── 이 날짜에 표시할 데이터 ──────────────────────
        const spans           = spanMap[key]   || [];       // 기간 일정 스팬 바
        const dayItems        = getPlansByDate(key);        // 단일 일정 (startDate === endDate)
        const visibleDayItems = hideDoneItems
          ? dayItems.filter(it => !it.done) : dayItems;    // 완료 숨기기 적용
        const allPendingHere   = pendingSubMap[key]   || []; // 예정일이 오늘인 미완료 세부일정
        const allCompletedHere = hideDoneItems ? [] : (completedSubMap[key] || []); // 오늘 완료된 세부일정


        // ── 헬퍼: 미완료/완료 세부일정 아이템 ───────────
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


        // ── 셀 내용 렌더 헬퍼 ─────────────────────────��──
        // catFilter: 이 컬럼에 그릴 카테고리 ('work' | 'personal')
        // colRpk: 이미 렌더된 planId 집합 — 중복 방지 (Set은 has/add가 O(1))
        //
        // 렌더 순서:
        //  1. 약속(event) → 상단 별도 영역
        //  2. 프로젝트 그룹 (색상 좌측 바 박스)
        //  3. 독립 기간 스팬 바 (프로젝트 미연결)
        //  4. 독립 단일 일정
        //  5. 고아 완료 세부일정 (부모가 다른 날에 있는데 오늘 완료됨)
        //  6. 고아 미완료 세부일정 (예정일이 오늘인데 부모가 다른 날)
        const renderColContent = (container, catFilter) => {
          const colRpk = new Set();
          const pendingHere   = allPendingHere.filter(ps => (ps.item?.category || 'work') === catFilter);
          const completedHere = allCompletedHere.filter(cs => (cs.item?.category || 'work') === catFilter);

          // 1. 약속 최상단 표시
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

          // 2. 프로젝트 그룹 수집
          // getProjectsForDate: 이 날짜에 배너가 있는 프로젝트 (projects.js)
          // 이 날 아이템이 참조하는 프로젝트도 catFilter 기준으로 추가
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

            // 프로젝트에 속한 스팬 바
            spans.forEach(sp => {
              if (colRpk.has(sp.planId)) return;
              if (Number(sp.item.projectId) !== Number(p.id)) return;
              if ((sp.item.category || 'work') !== catFilter) return;
              group.appendChild(mkSpanEl(sp));
              const pk = sp.planId; colRpk.add(pk);
              pendingHere.filter(ps => ps.planId === pk).forEach(ps => group.appendChild(mkPendingSubEl(ps)));
              completedHere.filter(cs => cs.planId === pk).forEach(cs => group.appendChild(mkDoneSubEl(cs)));
            });

            // 프로젝트에 속한 단일 일정
            visibleDayItems.forEach(it => {
              if (colRpk.has(it.planId)) return;
              if (it.startDate !== it.endDate) return; // 기간 일정은 스팬에서 처리
              if (Number(it.projectId) !== Number(p.id)) return;
              if ((it.category || 'work') !== catFilter) return;
              group.appendChild(mkItemEl(it, it.planId));
              const pk = it.planId; colRpk.add(pk);
              pendingHere.filter(ps => ps.planId === pk).forEach(ps => group.appendChild(mkPendingSubEl(ps)));
              completedHere.filter(cs => cs.planId === pk).forEach(cs => group.appendChild(mkDoneSubEl(cs)));
            });

            if (!group.hasChildNodes()) return; // 내용 없는 그룹은 추가 안 함
            container.appendChild(group);
          });

          // 3. 독립 기간 스팬 바 (프로젝트 미연결)
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

          // 4. 독립 단일 일정 수집
          const colStandaloneItems = [];
          visibleDayItems.forEach(it => {
            if (colRpk.has(it.planId)) return;
            if (it.startDate !== it.endDate) return;
            if ((it.category || 'work') !== catFilter) return;
            if (it.projectId && colProjSet.has(Number(it.projectId))) return; // 프로젝트 그룹에서 처리
            colStandaloneItems.push(it);
          });
          const idiv = document.createElement('div'); idiv.className = 'items';
          colStandaloneItems.forEach(it => {
            idiv.appendChild(mkItemEl(it, it.planId));
            const pk = it.planId; colRpk.add(pk);
            pendingHere.filter(ps => ps.planId === pk).forEach(ps => idiv.appendChild(mkPendingSubEl(ps)));
            completedHere.filter(cs => cs.planId === pk).forEach(cs => idiv.appendChild(mkDoneSubEl(cs)));
          });

          // 5. 고아 완료 세부일정: 부모 일정이 오늘 렌더되지 않았을 때
          completedHere.filter(cs => !colRpk.has(cs.planId)).forEach(cs => {
            if (!colRpk.has(cs.planId)) {
              idiv.appendChild(mkItemEl(cs.item, cs.planId)); // 부모 일정도 같이 표시
              colRpk.add(cs.planId);
            }
            idiv.appendChild(mkDoneSubEl(cs));
          });

          // 6. 고아 미완료 세부일정: 예정일은 오늘인데 부모가 다른 날짜에 있는 경우
          // planId 기준으로 그룹핑해서 "부모 일정 + 그 아래 세부일정들" 형태로 표시
          const colOrphanedPending = pendingHere.filter(ps => !colRpk.has(ps.planId));
          if (colOrphanedPending.length > 0) {
            const pgroups = new Map();
            colOrphanedPending.forEach(ps => {
              if (!pgroups.has(ps.planId)) pgroups.set(ps.planId, { item: ps.item, subs: [] });
              pgroups.get(ps.planId).subs.push(ps.sub);
            });

            // 프로젝트 연결된 고아라면 proj-cell-group으로 색상 표시
            const orphanProjGroups = new Map();
            pgroups.forEach(({ item, subs }, pid) => {
              const projId = item.projectId ? Number(item.projectId) : null;
              const proj   = projId ? projects.find(p2 => Number(p2.id) === projId) : null;
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


        // ── 업무/개인 분할 또는 단일 렌더 ───────────────
        // currentCategory === 'all': 셀을 업무/개인 두 컬럼으로 나눔
        if (currentCategory === 'all') {
          const splitDiv = document.createElement('div'); splitDiv.className = 'cell-split';
          const workCol  = document.createElement('div'); workCol.className  = 'cell-col cell-col-work';
          const persCol  = document.createElement('div'); persCol.className  = 'cell-col cell-col-personal';
          const workLbl  = document.createElement('div'); workLbl.className  = 'cell-col-label'; workLbl.textContent = '업무';
          const persLbl  = document.createElement('div'); persLbl.className  = 'cell-col-label'; persLbl.textContent = '개인';
          workCol.appendChild(workLbl); persCol.appendChild(persLbl);
          renderColContent(workCol, 'work');
          renderColContent(persCol, 'personal');
          splitDiv.appendChild(workCol); splitDiv.appendChild(persCol);
          cell.appendChild(splitDiv);
        } else {
          renderColContent(cell, currentCategory);
        }

        // ── 빈 셀 처리 ──────────────────────────────────
        // 일정이 없으면 'cell-no-items' 추가 → CSS hover 시 "+" 안내 문구 표시
        const hasAny = dayItems.length > 0 || spans.length > 0 || allPendingHere.length > 0;
        if (!hasAny) cell.classList.add('cell-no-items');
      }
      row.appendChild(cell);
    }
    body.appendChild(row);
  }

  // 셀 높이 초과 아이템 숨기고 "+N개" 버튼 표시
  clipOverflowCells();
}


// ════════════════════════════════════════════════════════════
//  셀 오버플로우 처리: 높이 초과 아이템 숨기고 "+N개" 버튼 표시
// ════════════════════════════════════════════════════════════

function clipOverflowCells() {
  document.querySelectorAll('#calBody .cell:not(.empty)').forEach(cell => {
    const key = cell.dataset.key;
    if (!key) return;

    const hdr    = cell.querySelector('.cell-header');
    const holDiv = cell.querySelector('.cell-holiday');
    // 날짜 헤더 + 공휴일 영역을 제외한 실제 사용 가능한 높이 계산
    const usedByFixed = (hdr ? hdr.offsetHeight : 0) + (holDiv ? holDiv.offsetHeight : 0);
    const availH = cell.clientHeight - usedByFixed - 4;
    if (availH <= 0) return;

    const BTN_H = 18; // "+N개" 버튼 높이 (이 공간을 확보하고 아이템을 자름)
    let totalHidden = 0;

    // colEl: 업무/개인 분리 시 각 컬럼, 단일 카테고리 시 셀 전체
    const clipColumn = (colEl) => {
      // 헤더·버튼·레이블 등 제외하고 실제 일정 컨테이너만 추출
      const containers = [...colEl.children].filter(el =>
        !el.classList.contains('cell-col-label') &&
        !el.classList.contains('cell-more-btn') &&
        !el.classList.contains('cell-header') &&
        !el.classList.contains('cell-holiday') &&
        !el.classList.contains('cell-split')
      );
      if (!containers.length) return;

      // 모든 아이템 행을 순서대로 수집
      const allRows = [];
      containers.forEach(con => {
        [...con.children].forEach(child => {
          if (child.classList.contains('item') || child.classList.contains('span-bar')) {
            allRows.push({ el: child, isPlan: !child.classList.contains('item-sub') });
          }
        });
      });
      if (!allRows.length) return;

      // 전체가 들어가는지 확인
      let totalH = 0, allFit = true;
      for (let i = 0; i < allRows.length; i++) {
        const h = allRows[i].el.offsetHeight;
        if (!h) continue;
        totalH += h + 2;
        if (totalH > availH) { allFit = false; break; }
      }
      if (allFit) return; // 다 들어가면 자를 필요 없음

      // 자를 인덱스 찾기: "+N개" 버튼 공간(BTN_H)을 고려해 잘라낼 지점 결정
      let usedH = 0, cutRowIdx = -1;
      for (let i = 0; i < allRows.length; i++) {
        const h = allRows[i].el.offsetHeight;
        if (!h) continue;
        if (usedH + h > availH - BTN_H) { cutRowIdx = i; break; }
        usedH += h + 2;
      }
      if (cutRowIdx === -1) cutRowIdx = allRows.length - 1;

      // cutRowIdx 이후 아이템 숨기기
      let hiddenPlans = 0;
      for (let i = cutRowIdx; i < allRows.length; i++) {
        allRows[i].el.style.display = 'none';
        if (allRows[i].isPlan) hiddenPlans++; // 일정 수만 카운트 (세부일정 제외)
      }
      if (hiddenPlans <= 0) return;

      // 내용이 전부 숨겨진 컨테이너(그룹 박스 등)도 숨김
      containers.forEach(con => {
        const hasVisible = [...con.children].some(ch => ch.style.display !== 'none');
        if (!hasVisible) con.style.display = 'none';
      });
      totalHidden += hiddenPlans;
    };

    // 업무/개인 분할 셀이면 각 컬럼별로 처리, 아니면 셀 전체 처리
    const splitDiv = cell.querySelector('.cell-split');
    if (splitDiv) {
      [...splitDiv.children].forEach(col => clipColumn(col));
    } else {
      clipColumn(cell);
    }

    // 숨긴 일정이 있으면 "+N개" 버튼 추가 → 클릭 시 날짜 팝오버로 전체 조회
    if (totalHidden > 0) {
      const btn = document.createElement('div');
      btn.className = 'cell-more-btn';
      btn.textContent = '+' + totalHidden + '개';
      btn.onclick = e => { e.stopPropagation(); openDayPopover(key, cell); };
      cell.appendChild(btn);
    }
  });
}


// ════════════════════════════════════════════════════════════
//  일정 추가/수정 모달
// ════════════════════════════════════════════════════════════

// 타입 버튼(할일/약속) 활성 상태 갱신
function renderTypeBtns() {
  document.querySelectorAll('#modalTypeRow .modal-type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === modal.type);
  });
}

// 카테고리 버튼(업무/개인) 활성 상태 갱신
function renderCategoryBtns() {
  document.querySelectorAll('#modalCatRow .modal-cat-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === modal.category);
  });
}

// 모달 열기
// key: 날짜 문자열, editPlanId: 수정 시 planId (신규면 null)
function openModal(key, editPlanId) {
  modal.dateKey = key; modal.editPlanId = editPlanId; modal.colorIdx = 0;
  const inp = document.getElementById('modalInput');

  if (editPlanId !== null && editPlanId !== undefined) {
    // 수정 모드: 기존 값을 폼에 채움
    const it = hydratePlan(editPlanId); inp.value = it.text;
    modal.category = it.category || 'work';
    modal.type     = it.type     || 'task';
    const palette  = modal.category === 'personal' ? COLORS_PERSONAL : COLORS_WORK;
    modal.colorIdx = palette.indexOf(it.color) >= 0 ? palette.indexOf(it.color) : 0;
    document.getElementById('modalStartDate').value = it.startDate || '';
    document.getElementById('modalEndDate').value   = it.endDate   || '';
    document.getElementById('modalTitle').textContent = `✏️ 수정 — ${key}`;
    document.getElementById('btnSave').textContent = '수정';
  } else {
    // 신규 모드: 기본값으로 초기화
    inp.value      = '';
    modal.category = currentCategory !== 'all' ? currentCategory : 'work';
    modal.type     = 'task';
    modal.colorIdx = 0;
    document.getElementById('modalStartDate').value = '';
    document.getElementById('modalEndDate').value   = '';
    document.getElementById('modalTitle').textContent = `📝 추가 — ${key}`;
    document.getElementById('btnSave').textContent = '추가';
  }

  renderTypeBtns(); renderCategoryBtns(); renderColorRow();

  // 프로젝트 드롭다운 채우기
  const projSel = document.getElementById('modalProjectSelect');
  projSel.innerHTML = '<option value="">📌 프로젝트 없음</option>';
  projects.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id; opt.textContent = '📁 ' + p.name;
    projSel.appendChild(opt);
  });
  projSel.value = (editPlanId ? (hydratePlan(editPlanId).projectId || '') : '');

  const m = document.getElementById('modal');
  m.style.display = 'block';
  document.getElementById('overlay').classList.add('show');
  setTimeout(() => inp.focus(), 30); // 모달 애니메이션 후 포커스
}

// 색상 팔레트 렌더 (카테고리에 따라 팔레트 색상이 달라짐)
function renderColorRow() {
  const row = document.getElementById('colorRow'); row.innerHTML = '';
  const palette = modal.category === 'personal' ? COLORS_PERSONAL : COLORS_WORK;
  palette.forEach((c, i) => {
    const dot = document.createElement('div');
    dot.className = 'color-dot' + (i === modal.colorIdx ? ' selected' : '');
    dot.style.background = c;
    dot.onclick = () => { modal.colorIdx = i; renderColorRow(); }; // 선택 시 재렌더
    row.appendChild(dot);
  });
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
  document.getElementById('overlay').classList.remove('show');
}

// 모달 저장: 신규 추가 또는 기존 수정
function saveItem() {
  const txt = document.getElementById('modalInput').value.trim(); if (!txt) return;
  const key       = modal.dateKey;
  const startDate = document.getElementById('modalStartDate').value || key;
  const endDate   = document.getElementById('modalEndDate').value   || startDate;
  const palette   = modal.category === 'personal' ? COLORS_PERSONAL : COLORS_WORK;
  const selVal    = document.getElementById('modalProjectSelect').value;
  const projectId = selVal ? Number(selVal) : null;
  const planType  = modal.type || 'task';

  if (modal.editPlanId) {
    // 수정: 기존 객체에 변경 필드만 덮어씀 (...spread로 나머지 필드 유지)
    plans[modal.editPlanId] = {
      ...plans[modal.editPlanId],
      text: txt, color: palette[modal.colorIdx],
      startDate, endDate, category: modal.category,
      date: startDate, projectId, type: planType
    };
    showToast('수정되었습니다');
  } else {
    // 신규: 새 planId 발급 후 plans에 추가
    const planId = newPlanId();
    plans[planId] = { date: key, text: txt, color: palette[modal.colorIdx], startDate, endDate, category: modal.category, done: false, projectId, type: planType };
    showToast('등록되었습니다');
  }
  savePlans(); closeModal(); renderAll();
}


// ════════════════════════════════════════════════════════════
//  일정 이동/분리/삭제
// ════════════════════════════════════════════════════════════

// 일정을 다른 날짜로 이동 (드래그앤드롭)
// fromDisplayKey: 드래그 시작 셀, toKey: 드롭한 셀
function moveCalItem(planId, fromDisplayKey, toKey) {
  if (fromDisplayKey === toKey) return; // 같은 셀이면 무시
  const plan = plans[planId]; if (!plan) return;

  // 날짜 차이(일수) 계산
  const diffDays = Math.round(
    (new Date(toKey + 'T00:00:00') - new Date(fromDisplayKey + 'T00:00:00')) / 86400000
  );

  // 날짜 문자열을 diffDays만큼 shift하는 헬퍼
  // toISOString() 대신 getFullYear/Month/Date 사용 → 타임존 off-by-one 방지
  const shiftDate = ds => {
    const d = new Date(ds + 'T00:00:00');
    d.setDate(d.getDate() + diffDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // 기간 일정이면 startDate/endDate 모두 shift → 기간 유지하면서 이동
  plan.date      = shiftDate(plan.startDate);
  plan.startDate = shiftDate(plan.startDate);
  plan.endDate   = shiftDate(plan.endDate);
  showToast('이동되었습니다');
  closeDetail(); savePlans(); renderAll();
}

// 세부일정을 부모에서 분리해 독립 일정으로 만들기 (드래그앤드롭)
// targetKey: 드롭한 날짜 셀
function extractSubToItem(planId, subId, targetKey) {
  const sub        = subTasks[subId]; if (!sub) return;
  const parentPlan = plans[planId];   if (!parentPlan) return;

  const newId = newPlanId();
  // 세부일정 텍스트·색상·카테고리를 그대로 이어받아 새 일정 생성
  plans[newId] = {
    text: sub.text, color: parentPlan.color,
    category: parentPlan.category || 'work', done: sub.done || false,
    date: targetKey, startDate: targetKey, endDate: targetKey, projectId: null
  };
  delete subTasks[subId]; // 원래 세부일정은 삭제

  showToast('일정으로 분리되었습니다');
  // 상세 패널이 부모 일정을 보고 있었다면 패널도 갱신
  if (typeof detailState !== 'undefined' && detailState.planId === planId) {
    savePlans(); saveSubTasks(); renderAll(); renderDetailPanel();
  } else {
    savePlans(); saveSubTasks(); renderAll();
  }
}

// 일정을 다른 일정의 세부일정으로 병합
// (현재는 projects.js 드롭존에서만 사용, 아이템→아이템 드롭은 제거됨)
function addCalItemAsSub(srcPlanId, tgtPlanId, keepPanel) {
  const srcPlan = plans[srcPlanId]; if (!srcPlan) return;
  const tgtPlan = plans[tgtPlanId]; if (!tgtPlan) return;
  const subId = newSubId();
  const existingOrder = Object.values(subTasks).filter(s => s.parentPlanId === tgtPlanId).length;
  subTasks[subId] = {
    parentPlanId: tgtPlanId, text: srcPlan.text, done: srcPlan.done || false,
    dueDate: srcPlan.startDate, completedAt: srcPlan.done ? srcPlan.date : '', order: existingOrder
  };
  // 소스 일정과 그 세부일정 모두 삭제
  Object.keys(subTasks).forEach(sid => { if (subTasks[sid].parentPlanId === srcPlanId) delete subTasks[sid]; });
  delete plans[srcPlanId];
  showToast('세부일정으로 추가되었습니다');
  if (!keepPanel) closeDetail();
  savePlans(); saveSubTasks(); renderAll();
  if (keepPanel && typeof renderDetailPanel === 'function') renderDetailPanel();
}

// 일정 삭제: 연결된 세부일정도 함께 삭제
function deletePlan(planId) {
  Object.keys(subTasks).forEach(subId => {
    if (subTasks[subId].parentPlanId === planId) delete subTasks[subId];
  });
  delete plans[planId];
  showToast('삭제되었습니다');
  savePlans(); saveSubTasks(); renderAll();
}

// 하위 호환 별칭 (구형 코드에서 deleteItem으로 호출하는 경우 대비)
function deleteItem(planId) { deletePlan(planId); }


// ════════════════════════════════════════════════════════════
//  CSV 내보내기
// ════════════════════════════════════════════════════════════

function exportCSV() {
  const dim  = new Date(year, month + 1, 0).getDate();
  const rows = [['"날짜"', '"요일"', '"일정"']];
  for (let d = 1; d <= dim; d++) {
    const key  = dateKey(year, month, d);
    const dow  = DAYS_KR[new Date(year, month, d).getDay()];
    const items = getPlansByDate(key);
    if (!items.length) rows.push([`"${key}"`, `"${dow}"`, '""']);
    else items.forEach(it => rows.push([`"${key}"`, `"${dow}"`, `"${it.text.replace(/"/g, '""')}"`]));
  }
  // \uFEFF: BOM 문자 — 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM 추가
  const blob = new Blob(['\uFEFF' + rows.map(r => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `${year}년_${month + 1}월_계획.csv`; a.click();
}


// ════════════════════════════════════════════════════════════
//  이벤트 바인딩
// ════════════════════════════════════════════════════════════

// 월 이동 버튼
document.getElementById('btnPrev').onclick  = () => { if (month === 0) { year--; month = 11; } else month--; renderAll(); };
document.getElementById('btnNext').onclick  = () => { if (month === 11) { year++; month = 0; } else month++; renderAll(); };
document.getElementById('btnToday').onclick = () => { year = today.getFullYear(); month = today.getMonth(); renderAll(); };

document.getElementById('btnCsv').onclick    = exportCSV;
document.getElementById('btnSave').onclick   = saveItem;
document.getElementById('btnCancel').onclick = closeModal;

// 오버레이 클릭: 모달이 열려있으면 모달 닫기, 아니면 상세 패널 닫기
document.getElementById('overlay').onclick = () => {
  if (document.getElementById('modal').style.display !== 'none') closeModal();
  else closeDetail();
};

document.getElementById('modalInput').onkeydown = e => { if (e.key === 'Enter') saveItem(); };

// 카테고리 필터 버튼 (전체/업무/개인)
document.querySelectorAll('.cat-btn').forEach(btn => {
  btn.onclick = () => {
    currentCategory = btn.dataset.cat;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderAll();
  };
});

// 모달 내 타입 버튼 (할일/약속)
document.querySelectorAll('#modalTypeRow .modal-type-btn').forEach(btn => {
  btn.onclick = () => { modal.type = btn.dataset.type; renderTypeBtns(); };
});

// 모달 내 카테고리 버튼 (업무/개인) — 변경 시 색상 팔레트도 갱신
document.querySelectorAll('#modalCatRow .modal-cat-btn').forEach(btn => {
  btn.onclick = () => {
    modal.category = btn.dataset.cat;
    modal.colorIdx = 0; // 카테고리 바뀌면 색상 선택 초기화
    renderCategoryBtns(); renderColorRow();
  };
});

// 완료 항목 숨기기 토글
document.getElementById('btnToggleDone').onclick = () => {
  hideDoneItems = !hideDoneItems;
  document.getElementById('btnToggleDone').classList.toggle('active', hideDoneItems);
  renderAll();
};


// ════════════════════════════════════════════════════════════
//  도움말 다이얼로그
// ════════════════════════════════════════════════════════════

function openHelp() {
  document.getElementById('helpOverlay').classList.add('open');
  document.getElementById('helpDialog').classList.add('open');
}
function closeHelp() {
  document.getElementById('helpOverlay').classList.remove('open');
  document.getElementById('helpDialog').classList.remove('open');
}
document.getElementById('btnHelpOpen').onclick  = openHelp;
document.getElementById('btnHelpClose').onclick = closeHelp;
document.getElementById('helpOverlay').onclick  = closeHelp;


// ════════════════════════════════════════════════════════════
//  날짜별 전체 일정 팝오버
//  '+' 버튼 또는 '+N개' 버튼 클릭 시 해당 날짜의 모든 일정을 플로팅 목록으로 표시
// ════════════════════════════════════════════════════════════

function openDayPopover(key, anchor) {
  const popover = document.getElementById('dayPopover');
  const [y, m, d] = key.split('-').map(Number);
  const dn = new Date(y, m - 1, d).getDay();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  document.getElementById('dayPopoverTitle').textContent = `${m}월 ${d}일 (${dayNames[dn]})`;

  const list = document.getElementById('dayPopoverList');
  list.innerHTML = '';

  // 팝오버에서도 동일한 인덱스 맵 사용 (함수 내 지역 변수로 재빌드)
  const sm              = buildSpanMap();
  const pendingSubMap   = buildPendingSubMap();
  const completedSubMap = buildCompletedSubMap();
  const allProjects     = (getProjectsForDate?.(key) || [])
    .filter(p => currentCategory === 'all' || (p.category || 'work') === currentCategory);

  const addedPlanIds = new Set(); // 중복 방지

  // 일반 행 추가 헬퍼 (색상 dot + 이름 + 배지)
  const addRow = (color, name, badge, onClick) => {
    const row = document.createElement('div'); row.className = 'dpop-row';
    const dot = document.createElement('span'); dot.className = 'dpop-dot'; dot.style.background = color;
    const nm  = document.createElement('span'); nm.className = 'dpop-name'; nm.textContent = name;
    if (badge) { const b = document.createElement('span'); b.className = 'dpop-badge'; b.textContent = badge; nm.appendChild(b); }
    row.appendChild(dot); row.appendChild(nm);
    row.onclick = onClick;
    list.appendChild(row);
  };

  // 세부일정 행 추가 헬퍼 (들여쓰기 스타일)
  const addSubRow = (text, done, onClick) => {
    const row = document.createElement('div');
    row.className = 'dpop-row dpop-sub-row' + (done ? ' done' : '');
    const nm = document.createElement('span'); nm.className = 'dpop-name';
    nm.textContent = (done ? '✓ ' : '☐ ') + text;
    row.appendChild(nm); row.onclick = onClick;
    list.appendChild(row);
  };

  // 일정 + 해당 날짜의 세부일정 행 함께 추가
  const addPlanWithSubs = (planId, item, color) => {
    if (addedPlanIds.has(planId)) return; // 이미 추가됐으면 스킵
    addedPlanIds.add(planId);
    addRow(color, item.text, null, () => { closeDayPopover(); openDetail(planId); });
    // 이 날짜가 예정일인 세부일정
    (pendingSubMap[key] || []).filter(ps => ps.planId === planId)
      .forEach(ps => addSubRow(ps.sub.text, false, () => { closeDayPopover(); openDetail(planId); }));
    // 이 날짜에 완료된 세부일정
    if (!hideDoneItems) {
      (completedSubMap[key] || []).filter(cs => cs.planId === planId)
        .forEach(cs => addSubRow(cs.sub.text, true, () => { closeDayPopover(); openDetail(planId); }));
    }
  };

  // 프로젝트 → 프로젝트에 속한 일정 순서로 표시
  allProjects.forEach(p => {
    addRow(p.color, p.name, '프로젝트', () => { closeDayPopover(); openProjectDetail?.(projects.indexOf(p)); });
    (sm[key] || []).filter(sp => Number(sp.item.projectId) === Number(p.id)).forEach(sp => {
      if (currentCategory !== 'all' && (sp.item.category || 'work') !== currentCategory) return;
      addPlanWithSubs(sp.planId, sp.item, sp.item.color || '#4f86f7');
    });
    getPlansByDate(key).forEach(it => {
      if (Number(it.projectId) !== Number(p.id)) return;
      if (currentCategory !== 'all' && (it.category || 'work') !== currentCategory) return;
      addPlanWithSubs(it.planId, it, it.color || '#4f86f7');
    });
  });

  // 독립 기간 스팬 (프로젝트 미연결)
  (sm[key] || []).filter(sp => {
    if (currentCategory !== 'all' && (sp.item.category || 'work') !== currentCategory) return false;
    if (hideDoneItems && sp.item.done) return false;
    return !sp.item.projectId || !projects.find(p => Number(p.id) === Number(sp.item.projectId));
  }).forEach(sp => addPlanWithSubs(sp.planId, sp.item, sp.item.color || '#4f86f7'));

  // 독립 단일 일정
  getPlansByDate(key).forEach(it => {
    if (!it) return;
    if (currentCategory !== 'all' && (it.category || 'work') !== currentCategory) return;
    if (it.projectId && projects.find(p => Number(p.id) === Number(it.projectId))) return;
    addPlanWithSubs(it.planId, it, it.color || '#4f86f7');
  });

  // 세부일정 직접 추가 폼: 이 날짜를 기간에 포함하는 일정만 select에 표시
  const sel = document.getElementById('dpopParentSelect');
  sel.innerHTML = '';
  const rangedPlans = Object.entries(plans)
    .filter(([, p]) => {
      const s = p.startDate || p.date || '';
      const e = p.endDate   || s;
      return s <= key && key <= e; // 이 날짜가 일정 기간 안에 포함되는지
    })
    .map(([pid, p]) => ({ planId: pid, text: p.text || '(제목 없음)' }));
  rangedPlans.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.planId; opt.textContent = p.text;
    sel.appendChild(opt);
  });
  const btnAddSub = document.getElementById('btnDayPopoverAddSub');
  btnAddSub.disabled = rangedPlans.length === 0; // 연결할 일정이 없으면 비활성화

  const subForm = document.getElementById('dayPopoverSubForm');
  subForm.style.display = 'none';
  document.getElementById('dpopSubInput').value = '';

  // 팝오버 위치 계산: 화면 밖으로 나가지 않도록 보정
  const pw = 260, ph = 380;
  const rect = anchor.getBoundingClientRect();
  let left = rect.left;
  if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
  if (left < 8) left = 8;
  let top = rect.bottom + 4;
  if (top + ph > window.innerHeight) top = Math.max(8, rect.top - ph); // 화면 하단 초과 시 위로
  popover.style.left = left + 'px';
  popover.style.top  = top  + 'px';
  popover.classList.add('open');
  document.getElementById('dayPopoverBg').classList.add('open');

  // "+ 추가" 버튼: 일정 추가 모달 오픈
  document.getElementById('btnDayPopoverAdd').onclick = () => { closeDayPopover(); openModal(key, null, popover); };

  // "세부일정 추가" 버튼: 폼 토글
  btnAddSub.onclick = () => {
    const show = subForm.style.display === 'none';
    subForm.style.display = show ? 'block' : 'none';
    if (show) setTimeout(() => document.getElementById('dpopSubInput').focus(), 30);
  };

  // 세부일정 저장
  const doAddSub = () => {
    const text         = document.getElementById('dpopSubInput').value.trim();
    const parentPlanId = sel.value;
    if (!text || !parentPlanId) return;
    const subId = newSubId();
    const order = Object.values(subTasks).filter(s => s.parentPlanId === parentPlanId).length;
    subTasks[subId] = { parentPlanId, text, done: false, dueDate: key, completedAt: '', order };
    showToast('세부일정이 추가되었습니다');
    saveSubTasks(); renderAll();
    closeDayPopover();
  };
  document.getElementById('dpopSubSubmit').onclick      = doAddSub;
  document.getElementById('dpopSubInput').onkeydown = e => {
    if (e.key === 'Enter')  doAddSub();
    if (e.key === 'Escape') subForm.style.display = 'none';
  };
}

function closeDayPopover() {
  document.getElementById('dayPopover').classList.remove('open');
  document.getElementById('dayPopoverBg').classList.remove('open');
}

document.getElementById('btnDayPopoverClose').onclick = closeDayPopover;
document.getElementById('dayPopoverBg').onclick       = closeDayPopover;


// ── 월간/주간 탭 전환 ────────────────────────────────────────
// 두 뷰는 같은 데이터를 공유하며 표시 방식만 다름
document.querySelectorAll('.cal-view-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.cal-view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const isMonth = btn.dataset.view === 'month';
    document.getElementById('calViewMonth').style.display = isMonth ? '' : 'none';
    document.getElementById('calViewWeek').style.display  = isMonth ? 'none' : '';
    document.getElementById('monthNav').style.display     = isMonth ? '' : 'none';
    document.getElementById('weekNav').style.display      = isMonth ? 'none' : '';
    if (!isMonth) renderWeek(); // 주간 탭으로 전환 시 렌더
  };
});
