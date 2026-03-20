// ── 디버그 로그 ──
const dbgEl = document.getElementById('debugLog');
function dbg(label, val) {
  const msg = `${label}: ${typeof val === 'string' ? val : JSON.stringify(val, null, 2)}`;
  console.log(msg);
  dbgEl.style.display = 'block';
  dbgEl.textContent += msg + '\n';
}
function dbgErr(label, e) {
  const msg = `❌ ${label}: ${e.message}`;
  console.error(msg, e);
  dbgEl.style.display = 'block';
  dbgEl.textContent += msg + '\n';
}

// ── 마이그레이션 함수 ──
function migrateOldPlans(oldPlans) {
  const newPlans = {}, newSubTasks = {};
  let changed = false;
  Object.entries(oldPlans).forEach(([key, items]) => {
    if (!Array.isArray(items)) return; // already new format, skip
    changed = true;
    items.forEach(item => {
      if (!item) return;
      const planId = newPlanId();
      (item.sub || []).forEach((sub, i) => {
        const subId = newSubId();
        newSubTasks[subId] = {
          parentPlanId: planId, text: sub.text, done: sub.done||false,
          dueDate: sub.completedAt || item.startDate || key,
          completedAt: sub.completedAt || '', order: i
        };
      });
      newPlans[planId] = {
        date: item.startDate || key, text: item.text||'',
        color: item.color||'#4f86f7', category: item.category||'work',
        done: item.done||false, startDate: item.startDate||key,
        endDate: item.endDate||item.startDate||key,
        projectId: item.projectId||null
      };
    });
  });
  return { newPlans, newSubTasks, changed };
}

// ── Firebase 초기화 ──
function initFirebase(config) {
  try {
    dbg('[initFirebase] config', config);
    if (!firebase.apps.length) firebase.initializeApp(config);
    dbg('[initFirebase] 앱 초기화 완료', firebase.app().name);

    const db = firebase.database();
    dbRef = db.ref('calendar/plans');
    dbg('[initFirebase] dbRef 생성 완료', 'calendar/plans');

    // ── 메모 Firebase 연동 ──
    memoRef = db.ref('calendar/memos');
    memoRef.on('value', snap => {
      const val = snap.val();
      if (!val) { memos = {}; renderMemos?.(); return; }
      // 구형 배열 포맷 → 객체로 1회 마이그레이션
      if (Array.isArray(val)) {
        memos = {};
        val.filter(Boolean).forEach(m => { memos[m.id || Date.now()] = { text: m.text, done: m.done || false }; });
        memoRef.set(memos);
      } else {
        memos = val;
      }
      renderMemos?.();
    });

    // ── 프로젝트 Firebase 연동 ──
    projectRef = db.ref('calendar/projects');
    projectRef.on('value', snap => {
      const val = snap.val();
      if (!val) { projects = []; renderAll(); return; }
      // 구형 배열 포맷 → 객체로 1회 마이그레이션
      if (Array.isArray(val)) {
        const obj = {};
        val.filter(Boolean).forEach(p => { if (p.id) obj[p.id] = {...p}; });
        projectRef.set(obj);
        projects = Object.entries(obj).map(([id, p]) => ({...p, id: Number(p.id || id)}));
      } else {
        projects = Object.entries(val).map(([id, p]) => ({...p, id: Number(p.id || id)}));
      }
      renderAll();
      if (typeof currentSection !== 'undefined' && currentSection === 'projects') renderProjectList?.();
      if (document.getElementById('projDetailPanel')?.classList.contains('open')) renderProjectDetail?.();
    });

    // ── 서브태스크 Firebase 연동 ──
    subTaskRef = db.ref('calendar/subTasks');
    subTaskRef.on('value', snap => {
      subTasks = snap.val() || {};
      renderAll();
    });

    db.ref('.info/connected').on('value', snap => {
      const el = document.getElementById('syncStatus');
      if (snap.val()) {
        el.className = 'connected';
        el.innerHTML = '<span class="dot"></span> 실시간 연결됨';
        dbg('[연결상태]', '연결됨');
      } else {
        el.className = 'disconnected';
        el.innerHTML = '<span class="dot"></span> 연결 끊김';
        dbg('[연결상태]', '끊김');
      }
    });

    dbRef.on('value', snap => {
      plans = snap.val() || {};
      // projectId 타입 정규화: 문자열로 저장된 경우 Number로 변환
      Object.values(plans).forEach(p => {
        if (p && p.projectId != null && p.projectId !== '') p.projectId = Number(p.projectId);
      });
      dbg('[데이터 수신]', `${Object.keys(plans).length}개 항목`);
      // ── 마이그레이션: 구형 날짜키 배열 형식 → 신형 planId 객체 형식 ──
      const firstKey = Object.keys(plans)[0];
      if (firstKey && /^\d{4}-\d{2}-\d{2}$/.test(firstKey)) {
        const { newPlans, newSubTasks, changed } = migrateOldPlans(plans);
        if (changed) {
          plans = newPlans;
          subTasks = {...subTasks, ...newSubTasks};
          dbRef.set(plans);
          if (subTaskRef) subTaskRef.set(subTasks);
        }
      }
      renderAll();
      if (document.getElementById('projDetailPanel')?.classList.contains('open')) {
        renderProjectDetail?.();
      }
    });

    document.getElementById('configPanel').style.display = 'none';
    document.getElementById('appShell').style.display = 'flex';
  } catch(e) {
    dbgErr('[initFirebase 오류]', e);
    alert('Firebase 초기화 오류: ' + e.message);
  }
}

// ── DB 저장 ──
function save() { savePlans(); }
function savePlans() {
  if (!dbRef) return;
  const st = document.getElementById('syncStatus');
  st.className = 'syncing';
  st.innerHTML = '<span class="dot"></span> 저장 중...';
  dbRef.set(plans)
    .then(() => { st.className = 'connected'; st.innerHTML = '<span class="dot"></span> 실시간 연결됨'; })
    .catch(e => { st.className = 'disconnected'; st.innerHTML = '<span class="dot"></span> 저장 실패'; alert('저장 실패: ' + e.message); });
}
function saveSubTasks() {
  if (!subTaskRef) return;
  subTaskRef.set(subTasks);
}

// ── 설정값 파싱 ──
document.getElementById('btnApplyConfig').onclick = () => {
  dbgEl.textContent = '';
  dbgEl.style.display = 'block';
  const raw = document.getElementById('configInput').value;
  dbg('[1] raw 길이', raw.length);

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) { alert('{ } 블록을 찾을 수 없습니다.'); return; }
  dbg('[2] { } 추출 성공, 길이', match[0].length);

  try {
    let s = match[0];
    s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    dbg('[3] 제어문자 제거 후 길이', s.length);
    s = s.replace(/\u200B|\u200C|\u200D|\uFEFF/g, '');
    dbg('[4] 유니코드 제거 후 길이', s.length);
    s = s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    dbg('[5] 주석 제거 후 길이', s.length);
    s = s.replace(/,(\s*[\}\]])/g, '$1');
    dbg('[6] trailing comma 제거 후 길이', s.length);
    s = s.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    dbg('[7] 키 따옴표 추가 후', s);

    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c < 0x20 && c !== 0x09 && c !== 0x0A && c !== 0x0D) {
        dbg(`[!] 제어문자 position ${i}`, `charCode=${c} 주변="${s.substring(Math.max(0,i-10), i+10)}"`);
      }
    }

    const cfg = JSON.parse(s);
    dbg('[8] 파싱 성공!', Object.keys(cfg));
    if (!cfg.databaseURL) { alert('databaseURL이 없습니다!'); return; }
    localStorage.setItem('fbConfig', JSON.stringify(cfg));
    initFirebase(cfg);  
  } catch(e) {
    dbgErr('[파싱 오류]', e); 
    alert('파싱 오류: ' + e.message + '\n\n화면 하단 노란 박스의 빨간 로그를 캡처해서 알려주세요!');
  }
};

document.getElementById('btnResetConfig').onclick = () => {
  document.getElementById('configPanel').style.display = 'block';
  document.getElementById('appShell').style.display = 'none';
};

// ── 저장된 설정 자동 로드 ──
const saved = localStorage.getItem('fbConfig');
if (saved) {
  try { initFirebase(JSON.parse(saved)); } catch(e) { console.error(e); }
}
