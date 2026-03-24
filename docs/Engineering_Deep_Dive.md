# 🔬 Engineering Deep Dive — 월간 계획 캘린더

> 기술적 설계 결정, 구현 상세, 데이터 구조, 개발 로그를 다룹니다.
> 빠른 프로젝트 파악은 [README.md](./README.md)를 참고하세요.

---

## 🔍 핵심 기술 점검 (Self-Checklist)

단순히 기능을 구현하는 것을 넘어, 발생 가능한 문제와 사용자 경험 사이의 균형을 고민한 기록입니다.

### 1. 데이터 정합성 (Data Validation)
- [x] **타임존 오차(Off-by-one) 해결** ✅
  - `toISOString()`의 UTC 변환 이슈를 방지하고, 로컬 시간 기반 날짜 직렬화를 직접 구현
  - YYYY-MM-DD 식별자 생성 시 시스템 로케일에 의존하지 않도록 `getFullYear`, `padStart` 조합으로 형식을 엄격히 제어

### 2. 상태 관리 및 동기화 (State Sync Strategy)
- [x] **렌더링 관심사 분리** ✅
  - 상세 패널(`detail.js`)의 CRUD 로직과 메인 캘린더 렌더링 루프를 분리하여 입력·편집 성능 최적화
  - **Trade-off**: 전체 렌더링(`renderAll`)을 지연시켜 메인 화면 실시간 갱신보다 **'상세 패널 내 작업의 반응성'**을 우선순위로 두는 설계 채택

### 3. 성능 최적화 (DOM Manipulation)
- [x] **규모에 맞는 렌더링 전략** ✅
  - 복잡한 아키텍처 대신 현재 데이터 규모에 최적화된 배치 렌더링 및 DOM 접근 최소화 전략 채택
  - 수천 건 미만 노드 환경에서 **DocumentFragment**와 **이벤트 위임**만으로 충분한 퍼포먼스 확보

### 4. UX 인터랙션 설계 (Drag & Drop)
- [x] **커스텀 MIME 타입 활용** ✅
  - `application/x-cal-item` 타입을 정의하여 브라우저 기본 텍스트 드래그와 앱 내 일정 이동 인터랙션 간의 충돌 원천 차단
  - DataTransfer 객체 제어로 드롭 타겟의 정확도를 높이고 의도치 않은 텍스트 복사 방지
  - **Note**: 일정 위에 일정 드롭(세부일정화), 메모 드래그앤드롭은 UX 복잡도로 인해 제거. 날짜 간 이동만 유지.

---

## 🛠 기술적 차별점 (Technical Deep Dive)

### 1. 데이터 정규화: planId 기반 플랫 구조

- **AS-IS**: `plans["2026-03-04"] = [{text, sub:[...], ...}]` — 날짜키 + 배열 중첩 구조
- **TO-BE**: `plans["plan_ID"] = { date, text, ... }` / `subTasks["sub_ID"] = { parentPlanId, ... }` — planId 기반 플랫 객체

```
plans:    { "plan_ID":  { date, text, color, category, type, done, startDate, endDate, projectId, memo } }
subTasks: { "sub_ID":   { parentPlanId, text, done, dueDate, completedAt, order } }
projects: [ { id, name, color, category, startDate, endDate, done, doneDate } ]
memos:    { "memoId":   { text, done } }
```

- 최초 로드 시 구형 날짜키 배열 포맷 자동 감지(`/^\d{4}-\d{2}-\d{2}$/`) 후 `migrateOldPlans()` 자동 변환
- `hydratePlan(planId)`: planId → plan + sub[] 조립 헬퍼로 렌더링 코드 호환성 유지
- `getPlansByDate(dateKey)`: plans 객체에서 날짜 기반 O(N) 필터

### 2. 효율적인 데이터 조회: 인메모리 역인덱싱 (In-memory Indexing)

- **Challenge**: 세부일정은 부모 일정의 날짜 아래 종속되어 있어, '완료 날짜' 기준의 달력 렌더링을 위해 매번 전체 데이터를 전수조사해야 하는 O(N) 병목 발생.
- **Solution**: 앱 로드 시 `plans`를 1회 순회하여 완료일 기준의 **역인덱스 맵(completedSubMap)**을 구축.
- **Benefit**: NoSQL의 조인 불가 한계를 메모리 기반 인덱싱으로 해결 → 각 날짜 셀 렌더링 시 O(1)로 완료 항목 즉시 참조.

### 3. 고아(Orphaned) 세부일정 처리

- **Problem**: 단일 날짜 일정(3/10)의 세부일정이 다른 날(3/15)에 완료되면, 부모 일정 없이 세부일정만 단독으로 표시되는 버그.
- **Solution**: `buildPendingSubMap()`으로 부모가 없는 세부일정을 planId 기준으로 그룹핑 후, `proj-cell-group`(좌측 색상 바)과 함께 부모 아이템 + 세부일정 순서로 렌더링. 월간/주간 공통 적용.

```js
// orphaned pending 처리 흐름
buildPendingSubMap()  →  pgroups: Map<planId, {item, subs[]}>
  → projId 있는 그룹: proj-cell-group(borderLeft = proj.color)에 삽입
  → projId 없는 그룹: 일반 idiv에 삽입
```

### 4. 정밀한 UX: 그랩 포인트(Grab Point) 기준 오프셋 연산

- **Challenge**: 기간 일정 드래그 시 시작일 기준으로만 계산하면, 일정의 뒷부분을 잡고 이동할 때 마우스 포인터와 일정 바 사이에 시각적 괴리 발생.
- **Solution**: 드래그 시작 시 **데이터 실제 위치(StorageKey)**와 **사용자가 클릭한 위치(DisplayKey)**를 분리하여 오프셋 계산.
- **Benefit**: 일정의 어느 지점을 잡더라도 마우스 포인터 위치에 맞춰 전체 기간이 자연스럽게 Shift되는 직관적인 드래그앤드롭 경험.

### 5. 선언적 테마 제어: dataset 기반 상태-스타일 분리

- **관심사 분리**: 카테고리 전환 시 JS로 모든 DOM 스타일을 직접 수정하는 대신, 최상위 컨테이너의 `data-cat` 속성만 변경.
- **최적화**: CSS Selector 로직에 테마별 색상과 레이아웃을 위임 → JS 렌더링 부하 감소, 코드 유지보수성 극대화.

### 6. 공휴일 자동 로드: Stale-While-Revalidate 캐싱 전략

- **Challenge**: 공휴일 하드코딩 시 연도 변경마다 소스 수정 필요, 매 로드마다 API 호출 시 네트워크 비용 발생.
- **Solution**: SWR 패턴 적용. 연도별 공휴일을 `calHol_{YYYY}` 키로 localStorage에 30일 캐싱. 로드 시 캐시 즉시 반영 → 만료분만 백그라운드 갱신.
- **캐시 키 분리**: 자동 fetch 데이터(`calHol_YYYY`)와 사용자 수동 추가(`calHolidays`)를 독립 저장하여 상호 오염 방지.

```
페이지 로드
  └─ [즉시] 내장 폴백 + localStorage 캐시로 holidays 초기화 → 렌더
  └─ [백그라운드] 캐시 없거나 30일 경과한 연도만 Nager.Date API 병렬 fetch
       └─ 성공 → localStorage 갱신 + _safeRenderAll()
       └─ 실패 → 캐시/폴백 유지, 오류 없음
```

### 7. 드래그 안전 렌더링: Dirty Flag + 이벤트 기반 지연(Deferred Update)

- **Challenge**: 백그라운드 fetch 완료 시점은 예측 불가. 드래그 중 `renderAll()` 호출 시 DOM 재구성으로 드래그 대상 요소가 사라짐.
- **Solution**: `document` 레벨의 `dragstart`/`dragend`로 전역 드래그 상태(`_isDragging`) 추적. fetch 완료 후 `_safeRenderAll()`을 거쳐 드래그 중이면 `_holDirty = true`만 표시, 실제 렌더는 `dragend` 시점으로 연기.

```
dragstart → _isDragging = true

fetch 완료 → _safeRenderAll()
               ├─ _isDragging = true  → _holDirty = true (렌더 연기)
               └─ _isDragging = false → renderAll() 즉시 호출

dragend   → _isDragging = false
             _holDirty = true → renderAll() 실행 후 플래그 초기화
```

### 8. 타임존 안정성: Deterministic Date Keys

- **Issue**: `Date.toISOString()` 사용 시 KST(UTC+9) 자정(00:00)이 전날(15:00 UTC)로 저장되는 off-by-one 오류 발생.
- **Decision**: Native Date API를 활용한 명시적 날짜 직렬화 채택.

```javascript
// ❌ AS-IS (Timezone Error)
const key = date.toISOString().slice(0, 10); // KST 00:00 -> 하루 밀림

// ✅ TO-BE (Local Time Safe)
const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
```

### 9. 일정 검색 오버랩(Overlap) 방식

- **AS-IS**: 일정의 `startDate`가 검색 기간 안에 있는 경우만 조회
- **TO-BE**: 일정 기간과 검색 기간이 **겹치기만 해도** 조회 (오버랩 방식)

```js
// 조건: plan.endDate >= searchFrom AND plan.startDate <= searchTo
const overlaps = plan.endDate >= from && plan.startDate <= to;
```

예: 검색 2026-03-01 ~ 2026-03-31 → 2026-02-01~2026-05-31 기간 일정도 표시됨

### 10. 약속(event) 과거/미래 시각 구분

완료 여부와 무관하게 **날짜 기준**으로 약속 아이템의 밝기를 인라인 스타일로 직접 적용 (CSS 명시도 충돌 방지).

```js
const isPast = it.type === 'event' && it.endDate && it.endDate < localDateStr();
if (isPast) {
  el.style.opacity = '0.35';
  el.style.filter  = 'saturate(0.25)';
} else {
  el.style.opacity = '';
  el.style.filter  = '';
}
```

| 상태 | 적용 |
|------|------|
| `endDate < 오늘` (지난 약속) | `opacity: 0.35` + `filter: saturate(0.25)` |
| `endDate >= 오늘` (예정 약속) | 기본 스타일 (선명) |

적용 범위: 월간 캘린더(`.item`), 주간 캘린더(`.item`), 기간 스팬 바(`.span-bar`), 일정 관리 탭(`.sch-card`)

---

## 🛠 사용 기술

| 기술 | 용도 |
|------|------|
| Vanilla JS (ES6+) | 프레임워크·번들러 없이 전역 스코프 모듈 분리 |
| Firebase Realtime DB v9 (compat) | plans·subTasks·memos·projects 실시간 저장·동기화 |
| HTML5 Drag & Drop API (`DataTransfer`) | 캘린더 일정 날짜 간 이동 (기간 일정 offset shift 포함) |
| iCal / JSON 파싱 (직접 구현) | 공휴일 URL·`.ics` 파일 파싱 |
| localStorage | 공휴일 캐시 (SWR 30일 TTL), Firebase config 저장 |
| CSS `data-*` attribute | 카테고리 모드별 헤더 테마 일괄 적용 |

---

## 💾 데이터 구조 (상세)

### Firebase Realtime DB 경로

```
calendar/
├── plans/
│   └── "plan_ID"   ← planId 기반 플랫 객체
│         └── { Plan }
├── subTasks/
│   └── "sub_ID"    ← subId 기반 플랫 객체
│         └── { SubTask }
├── memos/
│   └── "memoId"    ← memoId 기반 객체
│         └── { Memo }
└── projects/
    └── [ Project ] ← 배열 (Firebase 저장 시 객체로 변환됨)
```

### Plan

| 필드 | 타입 | 설명 |
|------|------|------|
| `date` | string | 대표 날짜 (`"YYYY-MM-DD"`) |
| `text` | string | 일정 제목 |
| `color` | string | 색상 hex |
| `category` | `"work"` \| `"personal"` | 카테고리 |
| `type` | `"task"` \| `"event"` | 할일 / 약속 |
| `startDate` | string | 기간 시작일 |
| `endDate` | string | 기간 종료일 |
| `done` | boolean | 완료 여부 |
| `projectId` | number \| null | 연결된 프로젝트 ID |
| `memo` | string | 일정 메모 (선택적) |

### SubTask

| 필드 | 타입 | 설명 |
|------|------|------|
| `parentPlanId` | string | 부모 Plan의 planId |
| `text` | string | 세부일정 텍스트 |
| `done` | boolean | 완료 여부 |
| `dueDate` | string | 예정일 (생성 시 오늘 기본값) |
| `completedAt` | string | 완료 날짜 (`""` = 미완료) |
| `order` | number | 정렬 순서 |

### Project

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | number | `Date.now()` 기반 고유 ID |
| `name` | string | 프로젝트 이름 |
| `color` | string | 색상 hex |
| `category` | `"work"` \| `"personal"` | 카테고리 |
| `startDate` | string | 시작일 |
| `endDate` | string | 종료일 |
| `done` | boolean | 완료 여부 |
| `doneDate` | string \| null | 완료 처리일 |

### Memo

| 필드 | 타입 | 설명 |
|------|------|------|
| `text` | string | 메모 내용 |
| `done` | boolean | 완료 여부 |

### localStorage

| 키 | 구조 | 설명 |
|----|------|------|
| `fbConfig` | `{ apiKey, ... }` | Firebase 설정 객체 |
| `calHolidays` | `{ "YYYY-MM-DD": "공휴일명" }` | 사용자 수동 추가 공휴일 |
| `calHol_{YYYY}` | `{ data: {...}, ts: number }` | 연도별 자동 fetch 공휴일 캐시 (30일 TTL) |

---

## ⚠️ 알려진 성능 한계 및 개선 과제 (TODO)

### 장기 데이터 누적 시 성능 저하

현재 구조는 **모든 데이터를 한 번에 로드**하는 방식이라, 데이터가 수년치 쌓이면 두 가지 병목이 발생한다.

#### 병목 1 — Firebase 전체 다운로드

```js
// firebase.js
dbRef.on('value', snap => { plans = snap.val() || {}; })
subTaskRef.on('value', snap => { subTasks = snap.val() || {}; })
```

데이터 1건이라도 변경되면 `plans`·`subTasks` 전체를 매번 다시 수신.
5년치 데이터(~9,000건+)면 네트워크 트래픽·파싱 비용이 눈에 띄게 늘어남.

#### 병목 2 — 렌더링마다 전체 풀스캔

```js
// calendar.js, week.js — renderAll() 호출 시마다 실행
buildSpanMap()         // plans 전체 순회
buildPendingSubMap()   // subTasks 전체 순회
buildCompletedSubMap() // subTasks 전체 순회
```

화면에는 ~35일(월간) 또는 7일(주간)만 표시되지만, 내부적으로는 전체 데이터를 스캔.

#### 예상 한계

| 기간 | 예상 plans 수 | 체감 |
|------|------------|------|
| 1년  | ~1,800건 | 문제 없음 |
| 3년  | ~5,400건 | 약간 느림 |
| 5년  | ~9,000건+ | 버벅임 가능 |

#### 해결 방향 (우선순위 순)

1. **[ ] Firebase 쿼리 범위 제한** — 가장 효과적
   - `dbRef.orderByChild('date').startAt(...).endAt(...)` 로 현재 월 ±1개월만 구독
   - 월 이동 시 구독 범위 갱신 → 네트워크 트래픽 90% 이상 절감
   - 단, 쿼리 범위 밖 데이터는 메모리에 없으므로 전체 검색 기능 별도 처리 필요

2. **[ ] 빌드 맵 캐싱**
   - 데이터 변경 시에만 맵 재빌드, `renderAll()`에서는 캐시된 맵 재사용
   - 구현 난이도 낮음, 렌더 성능 즉시 개선

3. **[ ] 완료된 오래된 데이터 아카이빙**
   - 완료 후 1년 이상 지난 plans를 `calendar/archive` 경로로 이동
   - 활성 데이터 규모를 일정하게 유지

---

## 📜 개발 로그 요약

자세한 내용은 [devlog.md](./devlog.md) 참고.

| 날짜 | 주요 변경 |
|------|-----------|
| 2026-03-23 | 일정 상세 패널 메모 입력, 프로젝트 패널 연결 일정 메모 조회, 검색 오버랩, 약속 과거/미래 시각 구분, docs 재작성 |
| 2026-03-20 | 사이드바 메모 패널 통합, 드래그앤드롭 정리, 나의 할 일 날짜 편집, 일정 관리 탭 신규 일정 폼, 세부일정 기본날짜 today |
| 2026-03-16 | 데이터 정규화(planId 플랫 구조), 캘린더 뷰포트 채우기, 고아 세부일정 버그 수정, 시각적 밀도 개선, 색상 대비 자동 반전 |
| 2026-03-14 | 메모 Firebase 연동, 프로젝트 관리·캘린더 배너·카테고리 분리·일정 연결 |
| 2026-03-04 | 공휴일 SWR 캐싱, 드래그앤드롭(날짜 이동), 업무/개인 카테고리 분리 |
| 2026-03-03 | 메모 패널, 공휴일 UX 개선 |