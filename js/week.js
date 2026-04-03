// ════════════════════════════════════════════════════════════
//  week.js
//  역할: 주간 캘린더 렌더링 + 앱 전체 화면 갱신(renderAll)을 담당
//        calendar.js와 동일한 데이터(plans, subTasks, projects)를
//        7일 컬럼 레이아웃으로 그려줌
// ════════════════════════════════════════════════════════════


// ── 주의 시작(일요일) 날짜 계산 ──────────────────────────────
// weekBase(기준 날짜)에서 해당 주 일요일을 구함
// d.getDay(): 0=일, 1=월, ..., 6=토
// setDate(현재날짜 - 요일번호) → 일요일로 이동
function getWeekStart(base) {
  const d = new Date(base);
  d.setDate(d.getDate() - d.getDay()); // 현재 요일만큼 빼면 항상 일요일
  return d;
}


// ── 주간 캘린더 렌더 ─────────────────────────────────────────
// 7개 셀(일~토)을 생성하고 각 셀에 일정·세부일정·스팬 바를 채워 넣음
function renderWeek() {
  if (window.innerWidth <= 720) { renderMobileAgenda(); return; }
  const ws = getWeekStart(weekBase);         // 이번 주 일요일
  const we = new Date(ws);
  we.setDate(we.getDate() + 6);             // 이번 주 토요일 (일요일 + 6일)

  // 헤더 날짜 레이블 포맷터: "3/24" 형식
  const fmt = d => `${d.getMonth() + 1}/${d.getDate()}`;
  document.getElementById('weekLabel').textContent =
    `${ws.getFullYear()}년 ${fmt(ws)}(일) ~ ${fmt(we)}(토)`;

  const grid = document.getElementById('weeklyGrid');
  grid.innerHTML = ''; // 기존 내용 초기화 후 새로 그림

  // ── 3가지 인덱스 맵 사전 빌드 ────────────────────────────
  // calendar.js에서 정의된 함수들. 매번 전체 순회하는 대신 미리 인덱스를 만들어 O(1) 조회
  const spanMap        = buildSpanMap();        // 기간 일정: 날짜 → 스팬 바 목록
  const pendingSubMap  = buildPendingSubMap();  // 미완료 세부일정: 날짜 → 세부일정 목록
  const completedSubMap = buildCompletedSubMap(); // 완료된 세부일정: 완료날짜 → 세부일정 목록


  // ── 요일 헤더 행 (일/월/화/수/목/금/토) ─────────────────
  const hdrRow = document.createElement('div');
  hdrRow.className = 'day-headers';
  ['일', '월', '화', '수', '목', '금', '토'].forEach((nm, i) => {
    const h = document.createElement('div');
    // 일요일(0)은 sun, 토요일(6)은 sat, 나머지는 week 클래스
    h.className = 'day-header' + (i === 0 ? ' sun' : i === 6 ? ' sat' : ' week');
    h.textContent = nm;
    hdrRow.appendChild(h);
  });
  grid.appendChild(hdrRow);


  // ── 셀 행 (7일치 셀을 담는 컨테이너) ────────────────────
  const row = document.createElement('div');
  row.className = 'week-row week-row-single';

  // di = 0(일요일) ~ 6(토요일)
  for (let di = 0; di < 7; di++) {
    const cur = new Date(ws);
    cur.setDate(ws.getDate() + di); // 일요일 기준으로 di일 후

    const y2 = cur.getFullYear(), m2 = cur.getMonth(), d2 = cur.getDate();
    const key = dateKey(y2, m2, d2); // "2026-03-24" 형식 날짜 문자열
    const isTd  = isToday(d2, m2, y2); // 오늘 여부
    const isHol = !!holidays[key];      // 공휴일 여부 (!! = boolean으로 변환)

    const cell = document.createElement('div');
    cell.className = 'cell' + (isTd ? ' today' : '');


    // ── 셀 상단 날짜 헤더 ──────────────────────────────────
    const hdr = document.createElement('div'); hdr.className = 'cell-header';
    const num = document.createElement('span');
    // 오늘·공휴일·일·토 등 상황에 따라 날짜 숫자 색상 클래스 결정
    num.className = 'date-num' +
      (isTd                    ? ' today-num'   :
       isHol && di !== 0       ? ' holiday-num' :
       di === 0                ? ' sun-num'     :
       di === 6                ? ' sat-num'     : '');
    num.textContent = d2;

    // 1일이거나 주의 첫 셀(일요일)이면 "3월" 같이 월 표기 추가
    if (d2 === 1 || di === 0) {
      const ml = document.createElement('span');
      ml.className = 'week-month-lbl';
      ml.textContent = `${m2 + 1}월`;
      hdr.appendChild(ml);
    }

    // '+' 버튼: 클릭 시 날짜 상세 팝오버 오픈
    // e.stopPropagation(): 이벤트가 부모 셀로 전파되는 것을 막음
    const ab = document.createElement('button'); ab.className = 'add-btn'; ab.textContent = '+';
    ab.onclick = e => { e.stopPropagation(); openDayPopover(key, e.currentTarget); };
    hdr.appendChild(num); hdr.appendChild(ab);
    cell.appendChild(hdr);


    // ── 드래그앤드롭: 날짜 셀이 드롭 대상 ───────────────────
    // dragover: 드래그한 아이템이 셀 위에 있을 때 매 프레임 호출
    cell.addEventListener('dragover', e => {
      const hasCal = e.dataTransfer.types.includes('application/x-cal-item');  // 일정 드래그
      // const hasSub = e.dataTransfer.types.includes('application/x-sub-item'); // [dead] 세부일정 드래그 미동작
      if (!hasCal) return; // 앱 외부 드래그(파일 등)는 무시
      e.preventDefault(); // 기본 동작 막아야 drop 이벤트가 발생함
      e.dataTransfer.dropEffect = 'move';
      cell.classList.add('drag-over'); // 강조 스타일
    });

    // dragleave: 셀 밖으로 나갈 때 강조 제거
    // contains(relatedTarget): 자식 요소로 이동한 경우는 제거 안 함 (flickering 방지)
    cell.addEventListener('dragleave', e => {
      if (!cell.contains(e.relatedTarget)) cell.classList.remove('drag-over');
    });

    // drop: 실제 드롭 처리
    cell.addEventListener('drop', e => {
      e.preventDefault(); cell.classList.remove('drag-over');

      // 일정 이동: 드래그한 planId를 이 날짜(key)로 이동
      if (e.dataTransfer.types.includes('application/x-cal-item')) {
        try {
          const d = JSON.parse(e.dataTransfer.getData('application/x-cal-item'));
          moveCalItem(d.planId, d.fromDisplayKey, key); // calendar.js에서 정의
        } catch (err) {}
        return;
      }

      // [dead] 세부일정 → 독립 일정 분리: 디테일 패널이 달력을 가려 드롭 대상에 이벤트가 전달되지 않아 미동작
      // if (e.dataTransfer.types.includes('application/x-sub-item')) {
      //   try {
      //     const d = JSON.parse(e.dataTransfer.getData('application/x-sub-item'));
      //     extractSubToItem(d.planId, d.subId, key); // calendar.js에서 정의
      //   } catch (err) {}
      // }
    });


    // ── 공휴일 표시 ────────────────────────────────────────
    if (isHol) {
      const holDiv = document.createElement('div'); holDiv.className = 'cell-holiday';
      holDiv.textContent = holidays[key]; cell.appendChild(holDiv);
    }


    // ── 헬퍼: 일반 일정 아이템 DOM 생성 ─────────────────────
    // planId: 이 일정의 고유 ID
    // it: hydratePlan()으로 조립된 plan + sub[] 객체
    const mkItemEl = (it, planId) => {
      const item = document.createElement('div');
      const subs = it.sub || [];
      const hasPendingSubs  = subs.some(s => !s.done);          // 미완료 세부일정 존재 여부
      const isVisuallyDone  = subs.length > 0                   // 시각적 완료 여부
        ? subs.every(s => s.done)                               // 세부일정이 있으면 전부 완료돼야 완료
        : it.done;                                              // 세부일정 없으면 done 플래그 사용
      const proj = it.projectId
        ? projects.find(p => Number(p.id) === Number(it.projectId)) : null;
      // 약속(event)이고 이 날짜가 과거이면서 체크 안됐으면 흐리게 표시
      const isPastEvent = it.type === 'event' && key < todayKey && !(it.dailyDone?.[key]);

      item.className = 'item cat-' + (it.category || 'work') +
        (it.type === 'event'   ? ' item-event'   : '') +
        (it.type === 'expense' ? ' item-expense' : '') +
        (isVisuallyDone && it.type !== 'event' && it.type !== 'expense' ? ' item-done' : '') +
        (hasPendingSubs ? ' item-inprogress' : '');

      // 지난 약속: 흐리게, 예정 약속: 선명하게 (CSS 명시도 충돌 방지를 위해 인라인 스타일 사용)
      if (it.type === 'event') {
        item.style.opacity = isPastEvent ? '0.35' : '1';
        item.style.filter  = isPastEvent ? 'saturate(0.25)' : 'none';
      }

      if (proj) item.dataset.tooltip = '📁 ' + proj.name; // 프로젝트 이름 툴팁

      // 좌측 색상 바: 프로젝트 색 > 일정 진행률 색 순으로 우선
      const itemDisplayColor = getItemDisplayColor(it);
      item.style.borderLeftColor = proj ? (proj.color || itemDisplayColor) : itemDisplayColor;

      const dot     = document.createElement('span'); dot.className = 'item-dot'; dot.style.background = itemDisplayColor;
      const content = document.createElement('div');  content.className = 'item-content';
      const txt     = document.createElement('span'); txt.className = 'item-text'; txt.textContent = it.text;
      content.appendChild(txt);

      const del = document.createElement('span'); del.className = 'del'; del.textContent = '✕';
      del.onclick = e => { e.stopPropagation(); deletePlan(planId); }; // 삭제

      item.onclick = e => { e.stopPropagation(); openInlineDetail(planId); };

      // 드래그 시작: 어떤 일정인지 데이터에 담아 전달
      item.draggable = true;
      item.addEventListener('dragstart', e => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/x-cal-item', JSON.stringify({ planId, fromDisplayKey: key }));
        setTimeout(() => item.classList.add('dragging'), 0); // 드래그 중 스타일
      });
      item.addEventListener('dragend', () => item.classList.remove('dragging'));

      item.appendChild(dot); item.appendChild(content); item.appendChild(del);
      return item;
    };


    // ── 헬퍼: 기간 스팬 바 DOM 생성 ─────────────────────────
    // 시작일~종료일이 다른 기간 일정을 가로 막대 형태로 표시
    const mkSpanEl = (sp) => {
      const bar = document.createElement('div');
      const spSubs        = sp.item.sub || [];
      const spHasPending  = spSubs.some(s => !s.done);
      const spVisuallyDone = spSubs.length > 0 ? spSubs.every(s => s.done) : sp.item.done;

      // sp.pos: 'start' | 'mid' | 'end' — 기간 내 위치에 따라 모양 결정
      bar.className = 'span-bar span-' + sp.pos + // [dead] ' cat-' + (sp.item.category || 'work') : borderLeftColor 인라인 스타일에 묻혀 실질적으로 무시됨
        (spVisuallyDone ? ' span-bar-done' : '') +
        (spHasPending ? ' span-bar-inprogress' : '');

      const spColor = getItemDisplayColor(sp.item);
      const spProj  = sp.item.projectId ? projects.find(p => Number(p.id) === Number(sp.item.projectId)) : null;
      bar.style.borderLeftColor = spProj ? (spProj.color || spColor) : spColor;

      const sdot = document.createElement('span'); sdot.className = 'item-dot'; sdot.style.background = spColor;
      const stxt = document.createElement('span'); stxt.className = 'item-text';
      if (sp.item.type === 'expense' || sp.item.type === 'event') {
        stxt.textContent = sp.item.text;
      } else {
        stxt.textContent = sp.item.text + getProgressText(sp.item);
      }
      const sdel = document.createElement('span'); sdel.className = 'del'; sdel.textContent = '✕';
      sdel.onclick = e => { e.stopPropagation(); deletePlan(sp.planId); };

      bar.appendChild(sdot); bar.appendChild(stxt);
      if (sp.item.type === 'event') {
        const dailyDoneMap = sp.item.dailyDone || {};
        const doneDates = Object.keys(dailyDoneMap).filter(d => dailyDoneMap[d]).sort();
        const doneDays  = doneDates.length;
        const isDayDone = !!dailyDoneMap[key];
        const seqNum    = isDayDone ? doneDates.indexOf(key) + 1 : null;
        // 과거 미체크: 흐리게 (숨기지 않고 재체크 가능하도록)
        if (key < todayKey && !isDayDone) {
          bar.style.opacity = '0.35';
          bar.style.filter  = 'saturate(0.25)';
        }
        const dBtn = document.createElement('button');
        dBtn.className = 'event-day-done-btn' + (isDayDone ? ' is-done' : '');
        dBtn.textContent = isDayDone ? '✓' : '';
        if (isDayDone) dBtn.style.color = spColor;
        dBtn.title = isDayDone ? '안했음으로 변경' : '했음으로 변경';
        dBtn.onclick = e => { e.stopPropagation(); toggleEventDailyDone(sp.planId, key); };
        bar.appendChild(dBtn);
        if (isDayDone) {
          const cntEl = document.createElement('span');
          cntEl.className = 'event-done-count-text';
          cntEl.textContent = seqNum;
          bar.appendChild(cntEl);
        }
      }
      bar.appendChild(sdel);
      bar.onclick = e => { e.stopPropagation(); openInlineDetail(sp.planId); };

      bar.draggable = true;
      bar.addEventListener('dragstart', e => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/x-cal-item', JSON.stringify({ planId: sp.planId, fromDisplayKey: key }));
        setTimeout(() => bar.classList.add('dragging'), 0);
      });
      bar.addEventListener('dragend', () => bar.classList.remove('dragging'));
      return bar;
    };


    // ── 이 날짜에 표시할 데이터 준비 ─────────────────────────
    const todayKey        = localDateStr();
    const spans           = spanMap[key] || [];           // 이 날짜에 걸친 기간 일정들
    const dayItems        = getPlansByDate(key);          // 이 날짜의 단일 일정들
    const visibleDayItems = hideDoneItems
      ? dayItems.filter(it => !it.done) : dayItems;      // 완료 숨기기 적용
    const allPendingHere   = pendingSubMap[key]  || [];  // 이 날짜가 예정일인 미완료 세부일정
    const allCompletedHere = hideDoneItems ? [] : (completedSubMap[key] || []); // 이 날짜에 완료된 세부일정


    // ── 헬퍼: 미완료/완료 세부일정 아이템 DOM ────────────────
    // 세부일정은 부모 일정 아래에 들여쓰기로 표시
    const mkPendingSubEl = (ps) => {
      const subEl = document.createElement('div'); subEl.className = 'item item-sub';
      const t = plans[ps.planId]?.type;
      const prefix = t === 'event' ? '— ' : t === 'expense' ? '💰 ' : '☐ ';
      const st = document.createElement('span'); st.textContent = prefix + ps.sub.text;
      subEl.onclick = e => { e.stopPropagation(); openInlineDetail(ps.planId); };
      subEl.appendChild(st); return subEl;
    };
    const mkDoneSubEl = (cs) => {
      const subEl = document.createElement('div'); subEl.className = 'item item-sub item-done';
      const t = plans[cs.planId]?.type;
      const prefix = t === 'event' ? '— ' : t === 'expense' ? '💰 ' : '✓ ';
      const st = document.createElement('span'); st.textContent = prefix + cs.sub.text;
      subEl.onclick = e => { e.stopPropagation(); openInlineDetail(cs.planId); };
      subEl.appendChild(st); return subEl;
    };


    // ── 셀 내용 렌더 함수 ────────────────────────────────────
    // catFilter: 'work' | 'personal' — 이 컬럼에 표시할 카테고리
    // colRpk: 이미 렌더된 planId 집합 (중복 방지용 Set)
    //
    // 렌더 순서:
    //  1. 약속(event) 바
    //  2. 프로젝트 그룹 (프로젝트 색상 좌측 바로 묶음)
    //  3. 독립 기간 스팬 바 (프로젝트 미연결)
    //  4. 단일 일정 (프로젝트 미연결)
    //  5. 완료된 세부일정 (완료날짜 기준 표시)
    //  6. 고아 세부일정 (부모가 다른 날에 있는 미완료 세부일정)
    const renderColContent = (container, catFilter) => {
      const colRpk = new Set();
      const cellDayItems = visibleDayItems;
      const cellSpans    = spans;

      const pendingHere   = allPendingHere.filter(ps => (ps.item?.category || 'work') === catFilter);
      const completedHere = allCompletedHere.filter(cs => (cs.item?.category || 'work') === catFilter);

      // 지출 일정: 해당 날짜(key) 세부일정 합계 배지만 표시 → 클릭 시 그 날 지출내역 모달
      const appendPlanSubs = (target, planId) => {
        if (plans[planId]?.type === 'expense') {
          const sum = getExpenseSumForDate(planId, key);
          if (sum > 0) {
            const badge = document.createElement('div'); badge.className = 'expense-sum-badge';
            badge.textContent = '₩ ' + sum.toLocaleString('ko-KR');
            badge.onclick = e => { e.stopPropagation(); showExpenseDayModal(key); };
            target.appendChild(badge);
          }
        } else {
          pendingHere.filter(ps => ps.planId === planId).forEach(ps => target.appendChild(mkPendingSubEl(ps)));
          completedHere.filter(cs => cs.planId === planId).forEach(cs => target.appendChild(mkDoneSubEl(cs)));
        }
      };


      // 1. 약속(event) 처리 — 상단에 별도 영역으로 표시
      const eventItems = cellDayItems.filter(it =>
        it.type === 'event' && it.startDate === it.endDate && (it.category || 'work') === catFilter
      );
      const eventSpans = cellSpans.filter(sp =>
        sp.item.type === 'event' && (sp.item.category || 'work') === catFilter
      );
      if (eventItems.length || eventSpans.length) {
        const evDiv = document.createElement('div'); evDiv.className = 'events-bar';
        eventSpans.forEach(sp => { evDiv.appendChild(mkSpanEl(sp)); colRpk.add(sp.planId); appendPlanSubs(evDiv, sp.planId); });
        eventItems.forEach(it => { evDiv.appendChild(mkItemEl(it, it.planId)); colRpk.add(it.planId); appendPlanSubs(evDiv, it.planId); });
        container.appendChild(evDiv);
      }

      // 2. 프로젝트 그룹 수집
      const colProjSet = new Map();
      (getProjectsForDate?.(key) || []).forEach(p => colProjSet.set(Number(p.id), p));
      cellDayItems.forEach(it => {
        if (it.projectId && (it.category || 'work') === catFilter) {
          const id = Number(it.projectId);
          if (!colProjSet.has(id)) { const p = projects.find(p2 => Number(p2.id) === id); if (p) colProjSet.set(id, p); }
        }
      });
      cellSpans.forEach(sp => {
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

        cellSpans.forEach(sp => {
          if (colRpk.has(sp.planId)) return;
          if (Number(sp.item.projectId) !== Number(p.id)) return;
          if ((sp.item.category || 'work') !== catFilter) return;
          group.appendChild(mkSpanEl(sp));
          const pk = sp.planId; colRpk.add(pk);
          appendPlanSubs(group, pk);
        });

        cellDayItems.forEach(it => {
          if (colRpk.has(it.planId)) return;
          if (it.startDate !== it.endDate) return;
          if (Number(it.projectId) !== Number(p.id)) return;
          if ((it.category || 'work') !== catFilter) return;
          group.appendChild(mkItemEl(it, it.planId));
          const pk = it.planId; colRpk.add(pk);
          appendPlanSubs(group, pk);
        });

        if (!group.hasChildNodes()) return;
        container.appendChild(group);
      });

      // 3. 독립 스팬 바
      const colStandaloneSpans = cellSpans.filter(sp => {
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
          appendPlanSubs(sbars, pk);
        });
        container.appendChild(sbars);
      }

      // 4. 단일 일정
      const idiv = document.createElement('div'); idiv.className = 'items';

      cellDayItems.forEach(it => {
        if (colRpk.has(it.planId)) return;
        if (it.startDate !== it.endDate) return;
        if ((it.category || 'work') !== catFilter) return;
        if (it.projectId && colProjSet.has(Number(it.projectId))) return;
        idiv.appendChild(mkItemEl(it, it.planId));
        const pk = it.planId; colRpk.add(pk);
        appendPlanSubs(idiv, pk);
      });

      // 완료된 세부일정 중 부모 일정이 아직 렌더 안 된 경우 (부모가 다른 날짜에 있는 케이스)
      completedHere.filter(cs => !colRpk.has(cs.planId)).forEach(cs => {
        if (!colRpk.has(cs.planId)) { idiv.appendChild(mkItemEl(cs.item, cs.planId)); colRpk.add(cs.planId); }
        idiv.appendChild(mkDoneSubEl(cs));
      });


      // 6. 고아 세부일정 처리
      // 세부일정의 예정일(dueDate)은 오늘인데 부모 일정은 다른 날짜에 있을 때
      // → 부모 일정을 유령(ghost)처럼 함께 표시해 맥락 제공
      const colOrphanedPending = pendingHere.filter(ps => !colRpk.has(ps.planId));
      if (colOrphanedPending.length > 0) {
        // planId 기준으로 그룹핑 (한 부모에 여러 세부일정이 있을 수 있음)
        const pgroups = new Map();
        colOrphanedPending.forEach(ps => {
          if (!pgroups.has(ps.planId)) pgroups.set(ps.planId, { item: ps.item, subs: [] });
          pgroups.get(ps.planId).subs.push(ps.sub);
        });

        // 프로젝트가 있으면 proj-cell-group으로 묶어서 색상 표시
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
            target = idiv; // 프로젝트 없으면 일반 items 영역에 추가
          }
          target.appendChild(mkItemEl(item, pid)); // 부모 일정 표시
          subs.forEach(sub => {
            const subEl = document.createElement('div'); subEl.className = 'item item-sub';
            const st = document.createElement('span'); st.textContent = '☐ ' + sub.text;
            subEl.onclick = e => { e.stopPropagation(); openInlineDetail(pid); };
            subEl.appendChild(st); target.appendChild(subEl);
          });
        });
        orphanProjGroups.forEach(g => container.appendChild(g));
      }

      container.appendChild(idiv);
    };


    // ── 업무/개인 분할 또는 단일 렌더 ───────────────────────
    // currentCategory === 'all': 셀을 업무/개인 두 컬럼으로 나눔
    // 그 외: 선택된 카테고리 하나만 렌더
    if (currentCategory === 'all') {
      const splitDiv = document.createElement('div'); splitDiv.className = 'cell-split';
      const workCol  = document.createElement('div'); workCol.className = 'cell-col cell-col-work';
      const persCol  = document.createElement('div'); persCol.className = 'cell-col cell-col-personal';
      const workLbl  = document.createElement('div'); workLbl.className = 'cell-col-label'; workLbl.textContent = '업무';
      const persLbl  = document.createElement('div'); persLbl.className = 'cell-col-label'; persLbl.textContent = '개인';
      workCol.appendChild(workLbl);
      persCol.appendChild(persLbl);
      renderColContent(workCol, 'work');
      renderColContent(persCol, 'personal');
      splitDiv.appendChild(workCol);
      splitDiv.appendChild(persCol);
      cell.appendChild(splitDiv);
    } else {
      renderColContent(cell, currentCategory);
    }


    // ── 빈 셀 처리 ──────────────────────────────────────────
    // 일정이 하나도 없으면 'cell-no-items' 클래스 추가
    // CSS에서 hover 시 "+ 일정 추가" 안내 문구를 표시
    const hasAny = dayItems.length > 0 || spans.length > 0 || allPendingHere.length > 0;
    if (!hasAny) cell.classList.add('cell-no-items');

    row.appendChild(cell);
  }

  grid.appendChild(row);
}


// ════════════════════════════════════════════════════════════
//  모바일 어젠다 뷰
//  7일치 일정을 날짜별 세로 리스트로 표시 — 7컬럼 그리드 대신 사용
// ════════════════════════════════════════════════════════════
function renderMobileAgenda() {
  const ws = getWeekStart(weekBase);
  const we = new Date(ws); we.setDate(we.getDate() + 6);
  const fmt = d => `${d.getMonth() + 1}/${d.getDate()}`;
  document.getElementById('weekLabel').textContent =
    `${ws.getFullYear()}년 ${fmt(ws)}(일) ~ ${fmt(we)}(토)`;

  const grid = document.getElementById('weeklyGrid');
  grid.innerHTML = '';
  grid.className = 'weekly-grid magenda-grid';

  const spanMap        = buildSpanMap();
  const pendingSubMap  = buildPendingSubMap();
  const completedSubMap = buildCompletedSubMap();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  for (let di = 0; di < 7; di++) {
    const cur = new Date(ws); cur.setDate(ws.getDate() + di);
    const y2 = cur.getFullYear(), m2 = cur.getMonth(), d2 = cur.getDate();
    const key  = dateKey(y2, m2, d2);
    const isTd = isToday(d2, m2, y2);
    const isHol = !!holidays[key];

    // ── 날짜 섹션 컨테이너 ──
    const dayEl = document.createElement('div');
    dayEl.className = 'magenda-day' + (isTd ? ' magenda-today' : '');

    // ── 날짜 헤더 (탭 시 일정 추가 팝오버) ──
    const hdr = document.createElement('div');
    hdr.className = 'magenda-hdr';

    const dowEl = document.createElement('span');
    dowEl.className = 'magenda-dow' + (di === 0 ? ' sun' : di === 6 ? ' sat' : '');
    dowEl.textContent = dayNames[di];

    const dateEl = document.createElement('span');
    dateEl.className = 'magenda-date' +
      (isTd             ? ' today-num'   :
       isHol && di !== 0 ? ' holiday-num' :
       di === 0          ? ' sun-num'     :
       di === 6          ? ' sat-num'     : '');
    dateEl.textContent = d2;

    hdr.appendChild(dowEl);
    hdr.appendChild(dateEl);
    if (isHol) {
      const holEl = document.createElement('span');
      holEl.className = 'magenda-holname';
      holEl.textContent = holidays[key];
      hdr.appendChild(holEl);
    }
    const addBtn = document.createElement('button');
    addBtn.className = 'magenda-add-btn';
    addBtn.textContent = '+ 추가';
    addBtn.onclick = e => { e.stopPropagation(); openDayPopover(key, hdr); };
    hdr.appendChild(addBtn);
    hdr.onclick = () => openDayPopover(key, hdr);
    dayEl.appendChild(hdr);

    // ── 일정 목록 ──
    const itemsEl = document.createElement('div');
    itemsEl.className = 'magenda-items';

    const spans       = (spanMap[key] || []).filter(sp =>
      currentCategory === 'all' || (sp.item?.category || 'work') === currentCategory);
    const dayItems    = getPlansByDate(key).filter(it =>
      currentCategory === 'all' || (it.category || 'work') === currentCategory);
    const pendingHere = (pendingSubMap[key] || []).filter(ps =>
      currentCategory === 'all' || (plans[ps.planId]?.category || 'work') === currentCategory);
    const completedHere = hideDoneItems ? [] : (completedSubMap[key] || []).filter(cs =>
      currentCategory === 'all' || (plans[cs.planId]?.category || 'work') === currentCategory);

    const renderedPids = new Set();

    const addRow = (color, text, planId, isDone) => {
      const row = document.createElement('div');
      row.className = 'magenda-item' + (isDone ? ' magenda-item-done' : '');
      row.style.borderLeftColor = color;
      const dot = document.createElement('span');
      dot.className = 'magenda-dot'; dot.style.background = color;
      const txt = document.createElement('span');
      txt.className = 'magenda-text'; txt.textContent = text;
      row.appendChild(dot); row.appendChild(txt);
      row.onclick = () => openInlineDetail(planId);
      itemsEl.appendChild(row);
      return row;
    };

    const addSubRow = (text, isDone, planId) => {
      const row = document.createElement('div');
      const isEvent = plans[planId]?.type === 'event';
      row.className = 'magenda-sub' + (isDone && !isEvent ? ' magenda-sub-done' : '');
      row.textContent = isEvent ? '— ' + text : (isDone ? '✓ ' : '☐ ') + text;
      row.onclick = () => openInlineDetail(planId);
      itemsEl.appendChild(row);
    };

    // 기간 일정 (스팬 바)
    spans.forEach(sp => {
      if (renderedPids.has(sp.planId)) return;
      renderedPids.add(sp.planId);
      const color = getItemDisplayColor(sp.item);
      const row = addRow(color, sp.item.text, sp.planId, false);
      // 약속 이벤트: 일자별 했음/안했음 버튼
      if (sp.item.type === 'event') {
        const isDayDone = !!(sp.item.dailyDone?.[key]);
        const dBtn = document.createElement('button');
        dBtn.className = 'magenda-event-done-btn' + (isDayDone ? ' is-done' : '');
        dBtn.textContent = isDayDone ? '✓ 했음' : '○ 안했음';
        dBtn.onclick = e => { e.stopPropagation(); toggleEventDailyDone(sp.planId, key); };
        row.appendChild(dBtn);
      }
      // 세부일정: 시작일에만 표시
      if ((sp.item.startDate || sp.item.date) === key) {
        Object.entries(subTasks)
          .filter(([, s]) => s.parentPlanId === sp.planId)
          .sort((a, b) => (a[1].order || 0) - (b[1].order || 0))
          .forEach(([, s]) => { if (!hideDoneItems || !s.done) addSubRow(s.text, s.done, sp.planId); });
      }
    });

    // 단일 일정
    dayItems.forEach(it => {
      if (it.startDate !== it.endDate) return;
      if (renderedPids.has(it.planId)) return;
      renderedPids.add(it.planId);
      const isDone = it.sub?.length ? it.sub.every(s => s.done) : it.done;
      if (hideDoneItems && isDone) return;
      const color = getItemDisplayColor(it);
      addRow(color, it.text, it.planId, isDone);
      // 세부일정: 시작일에만 표시
      if ((it.startDate || it.date) === key) {
        Object.entries(subTasks)
          .filter(([, s]) => s.parentPlanId === it.planId)
          .sort((a, b) => (a[1].order || 0) - (b[1].order || 0))
          .forEach(([, s]) => { if (!hideDoneItems || !s.done) addSubRow(s.text, s.done, it.planId); });
      }
    });

    // 고아 세부일정 (부모가 다른 날에 있는 미완료 세부일정)
    pendingHere.filter(ps => !renderedPids.has(ps.planId)).forEach(ps => {
      if (renderedPids.has(ps.planId)) return;
      renderedPids.add(ps.planId);
      const color = getItemDisplayColor(ps.item);
      addRow(color, ps.item.text, ps.planId, false);
      addSubRow(ps.sub.text, false, ps.planId);
    });

    if (itemsEl.children.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'magenda-empty';
      empty.textContent = '일정 없음';
      itemsEl.appendChild(empty);
    }

    dayEl.appendChild(itemsEl);
    grid.appendChild(dayEl);
  }

  // 오늘 날짜가 이 주에 있으면 자동 스크롤
  const todayEl = grid.querySelector('.magenda-today');
  if (todayEl) todayEl.scrollIntoView({ block: 'start', behavior: 'smooth' });
}


// ── 앱 전체 화면 갱신 ────────────────────────────────────────
// 월간·주간 캘린더 + 현재 열린 탭을 한 번에 다시 그림
// Firebase 데이터 변경, 일정 추가/수정/삭제 등 모든 상태 변경 후 호출됨
function renderAll() {
  // data-cat 속성 업데이트 → CSS selector로 카테고리별 테마 색상 자동 적용
  document.querySelector('.calendar').dataset.cat = currentCategory;
  document.getElementById('weeklyGrid').dataset.cat = currentCategory;
  const expBtn = document.getElementById('btnExpenseMonth');
  if (expBtn) expBtn.style.display = (currentCategory === 'personal' || currentCategory === 'all') ? '' : 'none';

  renderMonth(); // 월간 캘린더 다시 그리기 (calendar.js)
  renderWeek();  // 주간 캘린더 다시 그리기

  // 현재 활성 탭도 갱신 (탭 내용은 캘린더와 별개로 렌더됨)
  if (typeof currentSection !== 'undefined') {
    if (currentSection === 'schedules') renderScheduleList?.();  // 일정 관리 탭
    else if (currentSection === 'subtasks') renderSubtaskList?.(); // 나의 할 일 탭
    else if (currentSection === 'projects') renderProjectList?.(); // 프로젝트 탭
  }
}


// ── 주간 이동 버튼 이벤트 ────────────────────────────────────
// weekBase: 현재 주의 기준 날짜 (utils.js에서 today로 초기화)
document.getElementById('btnWPrev').onclick  = () => { weekBase.setDate(weekBase.getDate() - 7); renderWeek(); }; // 이전 주
document.getElementById('btnWNext').onclick  = () => { weekBase.setDate(weekBase.getDate() + 7); renderWeek(); }; // 다음 주
document.getElementById('btnWToday').onclick = () => { weekBase = new Date(today); renderWeek(); };               // 이번 주
