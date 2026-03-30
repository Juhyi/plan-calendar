// ════════════════════════════════════════════════════════════
//  firebase.js
//  역할: Firebase(구글의 무료 데이터베이스 서비스)에 연결하고,
//        일정·세부일정·메모·프로젝트 데이터를 저장/불러오는 파일
// ════════════════════════════════════════════════════════════


// ── 디버그 로그 ──────────────────────────────────────────────
// 앱 하단의 노란 디버그 박스에 메시지를 출력하는 함수들
// 개발 중 문제가 생겼을 때 무슨 일이 일어나는지 추적하기 위해 사용

const dbgEl = document.getElementById('debugLog'); // 화면 하단 디버그 출력 영역

// 일반 로그: label(제목)과 val(내용)을 받아 화면+콘솔에 함께 출력
function dbg(label, val) {
  const msg = `${label}: ${typeof val === 'string' ? val : JSON.stringify(val, null, 2)}`;
  console.log(msg);
  dbgEl.style.display = 'block';
  dbgEl.textContent += msg + '\n';
}

// 에러 로그: ❌ 표시와 함께 오류 메시지 출력
function dbgErr(label, e) {
  const msg = `❌ ${label}: ${e.message}`;
  console.error(msg, e);
  dbgEl.style.display = 'block';
  dbgEl.textContent += msg + '\n';
}


// ── 마이그레이션 함수 ─────────────────────────────────────────
// 이전 버전의 데이터 구조를 현재 구조로 자동 변환하는 함수
//
// 구형 구조: plans["2026-03-04"] = [{ text, sub:[...], ... }]
//   → 날짜를 키로 사용하고, 그 아래에 일정 배열이 들어있는 방식
//
// 신형 구조: plans["plan_ID"] = { date, text, ... }
//            subTasks["sub_ID"] = { parentPlanId, text, ... }
//   → 각 일정과 세부일정에 고유 ID를 부여하고 별도로 관리하는 방식
//   → ID 기반이라 검색·수정·삭제가 훨씬 빠르고 안전함 

function migrateOldPlans(oldPlans) {
  const newPlans = {}, newSubTasks = {};
  let changed = false; // 실제로 변환이 일어났는지 추적

  Object.entries(oldPlans).forEach(([key, items]) => {
    // 이미 신형 구조라면 건너뜀 (배열이 아니면 신형)
    if (!Array.isArray(items)) return;

    changed = true;

    items.forEach(item => {
      if (!item) return;

      // 이 일정의 새 고유 ID 생성 (예: "plan_1741872000000_ab12")
      const planId = newPlanId();

      // 세부일정(sub) 배열도 각각 독립 ID를 부여해 subTasks 컬렉션으로 분리
      (item.sub || []).forEach((sub, i) => {
        const subId = newSubId();
        newSubTasks[subId] = {
          parentPlanId: planId,   // 어떤 일정에 속하는지
          text: sub.text,
          done: sub.done || false,
          dueDate: sub.completedAt || item.startDate || key,
          completedAt: sub.completedAt || '',
          order: i                // 순서 번호
        };
      });

      // 일정 본체를 새 구조로 저장
      newPlans[planId] = {
        date: item.startDate || key,
        text: item.text || '',
        color: item.color || '#4f86f7',
        category: item.category || 'work',
        done: item.done || false,
        startDate: item.startDate || key,
        endDate: item.endDate || item.startDate || key,
        projectId: item.projectId || null
      };
    });
  });

  return { newPlans, newSubTasks, changed };
}


// ── Firebase 초기화 ───────────────────────────────────────────
// Firebase 서버에 연결하고, 데이터 경로(ref)를 설정한 뒤
// 각 데이터가 변경될 때마다 앱을 자동으로 업데이트하는 리스너를 등록

function initFirebase(config) {
  try {
    dbg('[initFirebase] config', config);

    // Firebase 앱이 아직 초기화되지 않은 경우에만 초기화
    // (중복 초기화 방지: 이미 연결됐는데 또 연결하면 에러 발생)
    if (!firebase.apps.length) firebase.initializeApp(config);
    dbg('[initFirebase] 앱 초기화 완료', firebase.app().name);

    const db = firebase.database(); // Firebase 데이터베이스 객체

    // dbRef: 일정 데이터가 저장되는 경로 (calendar/plans)
    dbRef = db.ref('calendar/plans');
    dbg('[initFirebase] dbRef 생성 완료', 'calendar/plans');


    // ── 메모 실시간 연동 ──────────────────────────────────────
    // Firebase의 calendar/memos 경로를 구독(watch)
    // 데이터가 바뀌면 .on('value', ...) 콜백이 자동으로 호출됨

    memoRef = db.ref('calendar/memos');
    memoRef.on('value', snap => {
      const val = snap.val(); // 서버에서 받은 값 (null이면 데이터 없음)

      if (!val) {
        memos = {};       // 데이터 없으면 빈 객체로 초기화
        renderMemos?.();  // ?. (옵셔널 체이닝): 함수가 존재할 때만 호출
        return;
      }

      // 구형 배열 포맷이면 객체로 변환 후 저장 (1회만 실행됨)
      if (Array.isArray(val)) {
        memos = {};
        val.filter(Boolean).forEach(m => {
          memos[m.id || Date.now()] = { text: m.text, done: m.done || false };
        });
        memoRef.set(memos); // 변환된 데이터를 서버에 덮어씀
      } else {
        memos = val; // 이미 신형이면 그대로 사용
      }

      renderMemos?.(); // 메모 목록 화면 다시 그리기
    });


    // ── 프로젝트 실시간 연동 ──────────────────────────────────
    projectRef = db.ref('calendar/projects');
    projectRef.on('value', snap => {
      const val = snap.val();

      if (!val) {
        projects = [];
        renderAll();
        return;
      }

      // 구형 배열 포맷 → 객체로 1회 마이그레이션
      if (Array.isArray(val)) {
        const obj = {};
        val.filter(Boolean).forEach(p => { if (p.id) obj[p.id] = { ...p }; });
        projectRef.set(obj);
        projects = Object.entries(obj).map(([id, p]) => ({ ...p, id: Number(p.id || id) }));
      } else {
        // Object.entries: 객체를 [키, 값] 쌍의 배열로 변환
        // map으로 각 항목을 가공하여 배열로 만듦
        projects = Object.entries(val).map(([id, p]) => ({ ...p, id: Number(p.id || id) }));
      }

      renderAll();
      // 현재 프로젝트 탭이 열려있으면 목록도 갱신
      if (typeof currentSection !== 'undefined' && currentSection === 'projects') renderProjectList?.();
      // 프로젝트 상세 패널이 열려있으면 내용도 갱신
      if (document.getElementById('projDetailPanel')?.classList.contains('open')) renderProjectDetail?.();
    });


    // ── 세부일정 실시간 연동 ──────────────────────────────────
    subTaskRef = db.ref('calendar/subTasks');
    subTaskRef.on('value', snap => {
      // snap.val()이 null이면 빈 객체 {} 사용 (|| 연산자)
      subTasks = snap.val() || {};
      renderAll();
    });


    // ── 연결 상태 표시 ────────────────────────────────────────
    // Firebase의 특수 경로 .info/connected: 서버 연결 여부를 자동으로 알려줌
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


    // ── 일정(plans) 실시간 연동 ──────────────────────────────
    dbRef.on('value', snap => {
      plans = snap.val() || {};

      // projectId 타입 정규화: Firebase는 숫자도 문자열로 저장할 수 있어서
      // 비교 오류 방지를 위해 Number()로 강제 변환
      Object.values(plans).forEach(p => {
        if (p && p.projectId != null && p.projectId !== '') p.projectId = Number(p.projectId);
      });

      dbg('[데이터 수신]', `${Object.keys(plans).length}개 항목`);

      // 첫 번째 키가 날짜 형식(YYYY-MM-DD)이면 구형 데이터 → 마이그레이션 실행
      const firstKey = Object.keys(plans)[0];
      if (firstKey && /^\d{4}-\d{2}-\d{2}$/.test(firstKey)) {
        const { newPlans, newSubTasks, changed } = migrateOldPlans(plans);
        if (changed) {
          plans = newPlans;
          subTasks = { ...subTasks, ...newSubTasks }; // 기존 + 새로 변환된 세부일정 합치기
          dbRef.set(plans);                           // 변환된 일정 서버에 저장
          if (subTaskRef) subTaskRef.set(subTasks);  // 변환된 세부일정 서버에 저장
        }
      }

      renderAll();

      // 프로젝트 상세 패널이 열려있으면 연결 일정 목록도 최신으로 갱신
      if (document.getElementById('projDetailPanel')?.classList.contains('open')) {
        renderProjectDetail?.();
      }
    });

    // 모든 연동 완료 → 설정 화면 숨기고 앱 화면 표시
    document.getElementById('configPanel').style.display = 'none';
    document.getElementById('appShell').style.display = 'flex';

  } catch (e) {
    dbgErr('[initFirebase 오류]', e);
    alert('Firebase 초기화 오류: ' + e.message);
  }
}


// ── DB 저장 함수들 ────────────────────────────────────────────
// Firebase에 데이터를 쓰는 함수들
// .set(data): 해당 경로의 데이터를 통째로 덮어씀

function save() { savePlans(); } // 하위 호환용 별칭

function savePlans() {
  if (!dbRef) return; // Firebase 연결 전이면 아무 것도 안 함

  // 저장 중 표시
  const st = document.getElementById('syncStatus');
  st.className = 'syncing';
  st.innerHTML = '<span class="dot"></span> 저장 중...';

  // .then(): 저장 성공 시 실행 / .catch(): 실패 시 실행
  dbRef.set(plans)
    .then(() => {
      st.className = 'connected';
      st.innerHTML = '<span class="dot"></span> 실시간 연결됨';
    })
    .catch(e => {
      st.className = 'disconnected';
      st.innerHTML = '<span class="dot"></span> 저장 실패';
      alert('저장 실패: ' + e.message);
    });
}

function saveSubTasks() {
  if (!subTaskRef) return;
  subTaskRef.set(subTasks); // 세부일정 전체를 덮어씀
}


// ── Firebase 설정값 입력 처리 ─────────────────────────────────
// 사용자가 Firebase 콘솔에서 복사한 config 텍스트를 받아
// JSON으로 파싱한 뒤 initFirebase()에 넘기는 로직

document.getElementById('btnApplyConfig').onclick = () => {
  dbgEl.textContent = ''; // 이전 로그 초기화
  dbgEl.style.display = 'block';

  const raw = document.getElementById('configInput').value;
  dbg('[1] raw 길이', raw.length);

  // 정규식으로 { ... } 블록만 추출
  // [\s\S]*: 줄바꿈 포함 모든 문자 (greedy)
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) { alert('{ } 블록을 찾을 수 없습니다.'); return; }
  dbg('[2] { } 추출 성공, 길이', match[0].length);

  try {
    let s = match[0];

    // 제어문자 제거 (복붙 시 숨은 특수문자가 섞여 JSON 파싱 오류 유발)
    s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    dbg('[3] 제어문자 제거 후 길이', s.length);

    // 유니코드 특수 공백 제거 (ZWS, BOM 등)
    s = s.replace(/\u200B|\u200C|\u200D|\uFEFF/g, '');
    dbg('[4] 유니코드 제거 후 길이', s.length);

    // JS 주석 제거 (// 한 줄 주석, /* */ 블록 주석)
    s = s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    dbg('[5] 주석 제거 후 길이', s.length);

    // trailing comma 제거 (JS는 허용하지만 JSON은 불허)
    // 예: { "a": 1, } → { "a": 1 }
    s = s.replace(/,(\s*[\}\]])/g, '$1');
    dbg('[6] trailing comma 제거 후 길이', s.length);

    // 키에 따옴표 추가 (JS 객체 키는 따옴표 없어도 되지만 JSON은 필수)
    // 예: { apiKey: "abc" } → { "apiKey": "abc" }
    s = s.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    dbg('[7] 키 따옴표 추가 후', s);

    // 남은 제어문자 위치 확인 (파싱 오류 시 디버깅용)
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c < 0x20 && c !== 0x09 && c !== 0x0A && c !== 0x0D) {
        dbg(`[!] 제어문자 position ${i}`, `charCode=${c} 주변="${s.substring(Math.max(0, i - 10), i + 10)}"`);
      }
    }

    const cfg = JSON.parse(s); // 최종 JSON 파싱
    dbg('[8] 파싱 성공!', Object.keys(cfg));

    if (!cfg.databaseURL) { alert('databaseURL이 없습니다!'); return; }

    // 파싱 성공한 설정을 localStorage에 저장 → 다음 방문 시 자동 로그인
    localStorage.setItem('fbConfig', JSON.stringify(cfg));
    initFirebase(cfg);

  } catch (e) {
    dbgErr('[파싱 오류]', e);
    alert('파싱 오류: ' + e.message + '\n\n화면 하단 노란 박스의 빨간 로그를 캡처해서 알려주세요!');
  }
};

// 설정 초기화: 다른 Firebase 계정으로 변경할 때 사용
document.getElementById('btnResetConfig').onclick = () => {
  document.getElementById('configPanel').style.display = 'block';
  document.getElementById('appShell').style.display = 'none';
};


// ── 저장된 설정 자동 로드 ────────────────────────────────────
// 페이지를 열 때 localStorage에 이전에 저장한 Firebase 설정이 있으면
// 자동으로 연결 (매번 설정 붙여넣기 불필요)

const saved = localStorage.getItem('fbConfig');
if (saved) {
  try {
    initFirebase(JSON.parse(saved)); // 저장된 JSON 문자열을 객체로 변환 후 연결
  } catch (e) {
    console.error(e); // 설정이 깨진 경우 조용히 무시
  }
}