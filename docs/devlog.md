# 개발 로그

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
