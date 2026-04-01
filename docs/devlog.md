# 개발 로그

---

## 2026-04-01

### 1. 나의 할 일 — 우선순위 설정 기능 추가

**배경**: "오늘 할 일" 그룹 안에 항목이 많아질수록 어떤 것을 먼저 해야 할지 구분이 어려웠음.

**구현 내용**

- 각 세부일정 행의 메타 영역(planChip · 카테고리 옆)에 **우선순위 드롭다운** 추가
- 선택지: `— 우선순위` / `🔴 높음` / `🟡 중간` / `🔵 낮음`
- 선택한 값은 `subTasks[subId].priority` 에 저장 → Firebase 실시간 동기화
- **오늘 할 일 그룹**은 우선순위 순(높음 → 중간 → 낮음 → 미설정)으로 자동 정렬
- 우선순위에 따라 드롭다운 칩 색상 변경 (🔴 빨강 / 🟡 노랑 / 🔵 파랑 / 회색)

**UX 결정**

초기에 클릭마다 순환(○ → 높음 → 중간 → 낮음 → ○)하는 버튼으로 구현했으나,
원하는 값에 도달하기까지 최대 3번 클릭해야 하고 현재 상태 파악이 어려운 문제로
**네이티브 `<select>` 드롭다운**으로 교체 → 한 번에 직접 선택 가능.

#### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `js/nav.js` | `mkSubRow()` — 메타 행에 `priSel` (`<select>`) 추가, `onchange`로 priority 저장; `renderSubtaskList()` — 오늘 그룹 priority 기준 추가 정렬 (`priOrd` 함수) |
| `style.css` | `.mytask-pri-sel` 기본 스타일; `.pri-high` / `.pri-medium` / `.pri-low` 단계별 색상 |

#### 데이터 구조 변경

```
subTasks["sub_ID"] = {
  parentPlanId, text, done, dueDate, completedAt, order,
  priority: 'high' | 'medium' | 'low'  // ← 신규 (미설정 시 필드 없음)
}
```

---

## 2026-03-23

### 1. 일정 상세 패널 — 메모 필드 추가

- 일정 클릭 시 열리는 우측 상세 패널에 **메모 textarea** 추가
- 위치: progress bar 아래, 세부일정 목록 위
- `oninput` 이벤트로 `plans[planId].memo` 실시간 저장 (`savePlans()` 호출)
- HTML: `#detailMemoTextarea` (`.tab-det-memo` 스타일 재사용)

#### 변경 파일
| 파일 | 변경 내용 |
|------|-----------|
| `index.html` | `#detailMemoTextarea` textarea 추가 (`.detail-memo-wrap`) |
| `js/detail.js` | `renderDetailPanel()`에서 메모 바인딩 + `oninput` 저장 |
| `style.css` | `.detail-memo-wrap`, `.detail-memo-label` 추가 |

---

### 2. 프로젝트 상세 패널 — 연결 일정 메모 조회 (📋 정보 탭)

- 프로젝트 상세 패널 **📋 정보 탭** 하단(`#projInfoMemoList`)에 연결 일정의 메모를 카드 형태로 표시
- 메모가 있는 연결 일정만 필터링 (`plan.memo && plan.memo.trim()`)
- 카드에 일정 제목 + 메모 내용 표시, 클릭 시 해당 일정 상세 패널로 이동
- 최초에는 📅 일정 탭에 구현했다가 📋 정보 탭으로 위치 변경

#### 변경 파일
| 파일 | 변경 내용 |
|------|-----------|
| `index.html` | 정보 탭(`projTabInfo`) 내 `#projInfoMemoList` 컨테이너 추가 |
| `js/projects.js` | 메모 렌더링을 `_renderScrollArea()` → `renderProjectDetail()` 로 이동, `#projInfoMemoList`에 출력 |
| `style.css` | `.proj-memo-card`, `.proj-memo-card-title`, `.proj-memo-card-text` 추가 |

---

## 2026-03-20

### 1. 사이드바 탭 재구성 — 메모 패널 통합

- **탭 순서 변경**: 캘린더 → 나의 할 일 → 일정 관리 → 프로젝트
- **메모 탭 제거**: 별도 탭이 아닌 좌측 사이드바 하단 고정 패널로 이동
- 메모 패널 구성: 헤더(개수 표시 + 완료 삭제 버튼) + 목록 + 입력창
- 메모 항목마다 **`+` 버튼** → 플로팅 팝오버에서 일정 검색 후 세부일정으로 변환
  - `openMemoAddPopover(memoId, text, anchorEl)`: 일정 선택 팝오버
  - `addMemoToSubTask(planId)`: 메모 텍스트로 세부일정 생성 후 메모 자동 삭제

---

### 2. 드래그앤드롭 제거

- 일정 위에 일정을 드롭해서 세부일정으로 만드는 기능 제거 (`calendar.js`, `week.js`, `detail.js`)
- 메모 드래그앤드롭 전면 제거 (`memo.js`, `calendar.js`, `week.js`)
- 날짜 간 일정 이동 드래그앤드롭은 유지

---

### 3. 나의 할 일 — 우측 슬라이드 패널 제거 및 날짜 편집 추가

- 세부일정 클릭 시 열리던 우측 슬라이드 패널(`openTaskSlide`) 제거
- 각 세부일정 행에 **예정일 date input** 직접 표시 → 인라인 편집 가능
- 완료된 항목에는 완료일 date input도 함께 표시
- `closeTaskSlide()` 스텁 유지(하위 호환)

---

### 4. 일정 관리 탭 — 일정 추가 UX 개선

**이전**: "일정 추가" 버튼 클릭 시 `새 일정` 이름으로 즉시 저장

**변경**: 클릭 시 우측 상세 패널에 **입력 폼** 표시
- 제목 입력 + 타입(할일/약속) + 카테고리 + 날짜 범위 + 프로젝트 + 색상 팔레트
- **저장** 버튼을 눌러야 실제 생성 (`_renderNewPlanForm`)
- 제목 입력란에 자동 포커스

---

### 5. 일정 상세 패널 — 메모 필드 추가

- 일정 클릭 시 열리는 상세 패널에 **메모 textarea** 추가 (색상 팔레트 아래, 세부일정 위)
- 저장 시 `plans[planId].memo` 에 함께 저장
- `.tab-det-memo` 스타일 추가 (리사이즈 가능, 포커스 시 파란 테두리)

---

### 6. 일정 관리 탭 — 날짜 범위 검색 로직 개선

**이전**: 일정의 시작일(`startDate`)이 검색 범위 안에 있어야 조회됨

**변경**: 일정의 기간(`startDate ~ endDate`)이 검색 범위와 **겹치기만 해도** 조회
- 조건: `plan.endDate >= searchFrom AND plan.startDate <= searchTo`
- 예: 검색 범위 3/1~3/31이면 2월 시작~5월 종료 일정도 표시

---

### 7. 약속(event) 과거/미래 시각 구분

완료 여부와 무관하게 **날짜 기준**으로 약속 아이템의 밝기를 자동 조절.

| 상태 | 적용 |
|------|------|
| 종료일 < 오늘 (지난 약속) | `opacity: 0.35` + `filter: saturate(0.25)` → 흐리게 |
| 종료일 ≥ 오늘 (예정 약속) | `opacity: 1` + `filter: none` → 선명하게 |

- 적용 범위: 월간 캘린더(`.item`), 주간 캘린더(`.item`), 기간 스팬 바(`.span-bar`), 일정 관리 탭(`.sch-card`)
- 인라인 스타일로 직접 적용 (CSS 명시도 충돌 방지)

---

### 8. 세부일정 생성 기본 날짜 수정

**이전**: 부모 일정의 시작일(`startDate`)을 세부일정 `dueDate` 기본값으로 사용

**변경**: **오늘 날짜**(`localDateStr()`)를 기본값으로 사용
- 적용 위치: `calendar.js`, `detail.js`, `nav.js`, `memo.js`(메모→세부일정 변환)

---

### 9. 캘린더 — 프로젝트 색상 그룹 표시 개선

- 고아 세부일정(부모 일정이 다른 날에 있는 경우)에도 `proj-cell-group` 좌측 색상 바 표시
- 월간/주간 공통 적용

---

### 10. 일정 관리 탭 — 프로젝트·약속 그룹핑

- 할일: 연결된 프로젝트별로 전체 테두리 박스(`sch-proj-group`)로 묶어 표시
- 약속: 목록 최하단에 약속 전용 그룹(`sch-event-group`)으로 분리 표시

---

### 변경 파일 요약

| 파일 | 변경 내용 |
|------|-----------|
| `js/nav.js` | `_renderNewPlanForm`, `appendGrouped`, `renderTabPlanDetail`(메모 필드·날짜 편집), 검색 오버랩 로직, 약속 인라인 스타일, 슬라이드 패널 제거 |
| `js/memo.js` | 사이드바 패널로 전면 재작성, 팝오버 추가, 드래그앤드롭 제거 |
| `js/calendar.js` | 약속 과거/미래 인라인 스타일, 고아 세부일정 프로젝트 그룹, 드롭 세부일정화 제거 |
| `js/week.js` | calendar.js와 동일 패턴 적용 |
| `js/detail.js` | 드롭 세부일정화 제거, 세부일정 기본 날짜 today |
| `index.html` | 메모 탭 제거, 사이드바 메모 패널 추가, 탭 순서 변경, 슬라이드 패널 제거 |
| `style.css` | `.tab-det-memo`, `.sidebar-memo-*`, `.memo-add-popover`, `.sch-proj-group`, `.mytask-due-inp` 등 추가 |

---

## 2026-03-16

### 1. 캘린더 셀 높이 조정
- 월간 셀: `130px → 160px`
- 주간 셀: `220px → 420px`

---

### 2. "+" 버튼 동작 변경 — 날짜 상세 팝오버
- 기존: "+" 클릭 시 일정 추가 모달 오픈
- 변경: 클릭 시 해당 날짜의 전체 일정 팝오버(`openDayPopover`) 오픈
- 팝오버 상단에 **"+ 추가" 버튼** 추가 → 클릭 시 해당 날짜로 추가 모달 연결
- 월간/주간 모두 동일하게 적용 (`calendar.js`, `week.js`)

---

### 3. 고아 완료 세부일정 표시 버그 수정
**문제**: 단일 날짜 일정(예: 3/10 저장)의 세부일정이 다른 날(3/15)에 완료되면, 부모 일정 없이 세부일정만 단독으로 표시되는 버그

**원인**: `buildCompletedSubMap`은 `completedAt` 날짜에 세부일정을 등록하지만, 부모 단일 날짜 일정은 `plans[3/15]`에 없어 렌더링 누락

**수정**: 고아 세부일정을 `planId` 기준으로 그룹핑 후 부모 아이템 → 세부일정 순서로 함께 렌더링 (`calendar.js`, `week.js`)

---

### 4. 완료 세부일정 스타일 정리
- 도트(●) 제거
- 기울임(`font-style: italic`) 제거
- 희미함(`opacity: 0.72`) 제거
- 일반 스타일 유지 + `✓ 텍스트` 형식

---

### 5. 메모 입력창 위치 개편
- 사이드바 내 탭 목록 하단에 메모 `textarea` + 추가 버튼 상시 표시
- 메모 탭: 메인 영역에 전체 목록(별도 입력창 포함)
- 다른 탭: 사이드바 입력창으로만 빠른 메모 작성 가능

---

### 6. 캘린더 뷰 Viewport 꽉채우기
- `#sectionCalendar`: `display: flex; flex-direction: column; height: calc(100vh - 40px)`
- `.calendar`, `#calBody`, `.week-row`: flex 자동 분배로 전환
- 셀 고정 높이(`px`) 제거 → flex `1fr` 기반 자동 확장
- 월간 행(5~6주), 주간 단일 행 모두 뷰포트 높이에 맞게 채워짐

---

### 7. 시각적 밀도 개선 (Information Density)
간격·패딩 미세 조정으로 숨통 확보

| 항목 | 변경 |
|------|------|
| 아이템 간격 | `gap: 2px → 3px` |
| 아이템 line-height | `1.5 → 1.6` |
| dot 크기 | `7px → 6px` |
| 스팬 바 높이 | `14px → 16px`, gap `1px → 2px` |
| 프로젝트 그룹 | 마진 `2px → 3px`, gap `1px → 2px` |
| 셀 헤더 하단 | `4px → 5px` |

---

### 8. 색상 대비 자동 반전 (WCAG Luminance)
배경색 밝기에 따라 글자색을 자동으로 결정

```js
// utils.js
function getLuminance(hex) { ... }  // WCAG 상대 휘도 계산
function getContrastColor(hex) {
  return getLuminance(hex) > 0.179 ? '#1a2a4a' : '#ffffff';
}
```

- 스팬 바(`span-bar`)에 적용: 밝은 배경 → 진한 네이비, 어두운 배경 → 흰색
- CSS `color: #fff` 고정값 제거 → JS에서 동적으로 결정

---

### 9. 빈 셀 Empty State 처리
- 일정이 없는 셀에 `cell-no-items` 클래스 부여 (`calendar.js`, `week.js`)
- 마우스 호버 시 `+ 일정 추가` 문구 연하게 표시 + 배경 살짝 밝아짐
- 일정이 있는 날에는 효과 없음

```css
.cell-no-items:hover::after { content: '+ 일정 추가'; display: block; ... }
```

---

### 10. 데이터 정규화 (Normalization) — 구조 전면 개편

#### 이전 구조
```
plans: { "2026-03-04": [{text, color, sub:[...], projectId, ...}] }
```

#### 새 구조
```
plans:    { "plan_ID":  { date, text, color, category, done, startDate, endDate, projectId } }
subTasks: { "sub_ID":   { parentPlanId, text, done, dueDate, completedAt, order } }
projects: { "projId":   { name, color, category, startDate, endDate, done, doneDate } }
memos:    { "memoId":   { text, done } }
```

#### 마이그레이션
- 최초 로드 시 구형 날짜키 배열 포맷 자동 감지(`/^\d{4}-\d{2}-\d{2}$/`) 후 변환·저장
- 기존 `sub[]` 배열 → `subTasks` 컬렉션으로 분리 (각 항목에 고유 `sub_ID` 부여)

#### 변경 파일
| 파일 | 주요 변경 |
|------|-----------|
| `utils.js` | `hydratePlan()`, `getPlansByDate()`, `newPlanId/SubId()` 추가 |
| `firebase.js` | `subTaskRef`, `migrateOldPlans()`, `savePlans/saveSubTasks()` 추가 |
| `calendar.js` | `planId` 기반 렌더링, 드래그앤드롭 데이터 포맷 변경 |
| `week.js` | 동일 패턴 적용 |
| `detail.js` | `detailState.planId`, subTasks 개별 CRUD |
| `projects.js` | `getProjectItems` planId 기반 필터 |
| `nav.js` | `renderScheduleList/SubtaskList` 객체 순회로 전환 |

---

### 11. 데이터 로딩 로직 개선 — 배열 → 객체 순회
- `memos`: 배열(`unshift`, `splice`, `[i]`) → 객체(`{ memoId: {text, done} }`) 전환
  - `toggleMemo(memoId)`, `deleteMemo(memoId)` 등 인덱스 기반 → ID 기반
  - 정렬: 미완료 최신순 → 완료 최신순 (`getSortedMemos()`)
- `projects`: `Array.isArray` 분기 제거, 구형 배열은 1회 마이그레이션 후 객체 저장
- drag-drop 메모 데이터: `{ idx }` → `{ memoId }` 변경 (`calendar.js`, `week.js`)

---

## 변경 파일 목록

### JS

| 파일 | 주요 변경 내용 |
|------|----------------|
| `js/utils.js` | `subTasks` 전역 변수, `newPlanId/newSubId()`, `hydratePlan()`, `getPlansByDate()`, `getLuminance()`, `getContrastColor()` 추가 |
| `js/firebase.js` | `migrateOldPlans()`, `subTaskRef` 리스너, `savePlans()` / `saveSubTasks()` 분리, memos/projects 배열→객체 마이그레이션 |
| `js/calendar.js` | planId 기반 렌더링 전면 개편, `buildCompletedSubMap/buildSpanMap` 객체 순회, 드래그 데이터 포맷 변경, `openDayPopover`, 빈 셀 처리 |
| `js/week.js` | calendar.js와 동일 패턴 적용 (planId, 객체순회, 빈 셀) |
| `js/detail.js` | `detailState.planId`, `openDetail(planId)`, subTask CRUD 전체 (`addSub/toggleSub/deleteSub/moveSub`) |
| `js/projects.js` | `getProjectItems()` planId 기반, `attachItemToProject/detachItemFromProject` |
| `js/nav.js` | `renderScheduleList/renderSubtaskList` 객체 순회로 전환 |
| `js/memo.js` | 배열→객체 전환, `getSortedMemos()`, ID 기반 CRUD, 드래그 `memoId` 포맷 |

### CSS / HTML

| 파일 | 주요 변경 내용 |
|------|----------------|
| `style.css` | flex 뷰포트 채우기, 셀 고정높이 제거, 시각적 밀도 조정, span-bar 대비 색상 동적화, `.item-sub` 스타일 정리, `.cell-no-items` 빈 셀 hover 효과 |
| `index.html` | `.sidebar-memo` 추가 (사이드바 내 메모 입력), `#dayPopover` 구조 변경(`btnDayPopoverAdd`), `#memoInputMain/btnMemoAddMain` 추가 |

### 문서

| 파일 | 내용 |
|------|------|
| `docs/devlog.md` | 오늘 변경사항 정리 (신규 생성) |
