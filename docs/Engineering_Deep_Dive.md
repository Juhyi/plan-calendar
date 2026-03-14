# 🔬 Engineering Deep Dive — 월간 계획 캘린더

> 기술적 설계 결정, 구현 상세, 데이터 구조, 개발 로그를 다룹니다.
> 빠른 프로젝트 파악은 [README.md](../README.md)를 참고하세요.

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

---

## 🛠 기술적 차별점 (Technical Deep Dive)

### 1. 효율적인 데이터 조회: 인메모리 역인덱싱 (In-memory Indexing)
- **Challenge**: 세부일정은 부모 일정의 날짜 아래 종속되어 있어, '완료 날짜' 기준의 달력 렌더링을 위해 매번 전체 데이터를 전수조사해야 하는 O(N) 병목 발생.
- **Solution**: 앱 로드 시 `plans`를 1회 순회하여 완료일 기준의 **역인덱스 맵(completedSubMap)**을 구축.
- **Benefit**: NoSQL의 조인 불가 한계를 메모리 기반 인덱싱으로 해결 → 각 날짜 셀 렌더링 시 O(1)로 완료 항목 즉시 참조.

### 2. 정밀한 UX: 그랩 포인트(Grab Point) 기준 오프셋 연산
- **Challenge**: 기간 일정 드래그 시 시작일 기준으로만 계산하면, 일정의 뒷부분을 잡고 이동할 때 마우스 포인터와 일정 바 사이에 시각적 괴리 발생.
- **Solution**: 드래그 시작 시 **데이터 실제 위치(StorageKey)**와 **사용자가 클릭한 위치(DisplayKey)**를 분리하여 오프셋 계산.
- **Benefit**: 일정의 어느 지점을 잡더라도 마우스 포인터 위치에 맞춰 전체 기간이 자연스럽게 Shift되는 직관적인 드래그앤드롭 경험.

### 3. 선언적 테마 제어: dataset 기반 상태-스타일 분리
- **관심사 분리**: 카테고리 전환 시 JS로 모든 DOM 스타일을 직접 수정하는 대신, 최상위 컨테이너의 `data-cat` 속성만 변경.
- **최적화**: CSS Selector 로직에 테마별 색상과 레이아웃을 위임 → JS 렌더링 부하 감소, 코드 유지보수성 극대화.

### 4. 공휴일 자동 로드: Stale-While-Revalidate 캐싱 전략
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

### 5. 드래그 안전 렌더링: Dirty Flag + 이벤트 기반 지연(Deferred Update)
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

### 6. 타임존 안정성: Deterministic Date Keys
- **Issue**: `Date.toISOString()` 사용 시 KST(UTC+9) 자정(00:00)이 전날(15:00 UTC)로 저장되는 off-by-one 오류 발생.
- **Decision**: Native Date API를 활용한 명시적 날짜 직렬화 채택.

```javascript
// ❌ AS-IS (Timezone Error)
const key = date.toISOString().slice(0, 10); // KST 00:00 -> 하루 밀림

// ✅ TO-BE (Local Time Safe)
const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
```

---

## 🛠 사용 기술

| 기술 | 용도 |
|------|------|
| Vanilla JS (ES6+) | 프레임워크·번들러 없이 전역 스코프 모듈 분리 |
| Firebase Realtime DB v9 (compat) | 일정·메모·프로젝트 실시간 저장·동기화 |
| HTML5 Drag & Drop API (`DataTransfer`) | 메모→캘린더 이동, 캘린더 아이템 이동, 일정→프로젝트 연결 |
| iCal / JSON 파싱 (직접 구현) | 공휴일 URL·`.ics` 파일 파싱 |
| localStorage | 공휴일 캐시 (SWR), Firebase config 저장 |
| CSS `data-*` attribute | 카테고리 모드별 헤더 테마 일괄 적용 |

---

## 💾 데이터 구조

### Firebase Realtime DB 경로

```
calendar/
├── plans/
│   └── "YYYY-MM-DD"  ← 일정의 저장 키 (기간 일정은 startDate 기준)
│         └── [ Item ]
├── memos/
│   └── [ Memo ]
└── projects/
    └── [ Project ]
```

### Item

| 필드 | 타입 | 설명 |
|------|------|------|
| `text` | string | 일정 텍스트 |
| `color` | string | 색상 hex |
| `category` | `"work"` \| `"personal"` | 카테고리 (미설정 시 `"work"`) |
| `startDate` | string \| null | 기간 시작일 `"YYYY-MM-DD"` |
| `endDate` | string \| null | 기간 종료일 |
| `done` | boolean | 완료 여부 (세부일정 없는 항목만) |
| `sub` | SubItem[] | 세부일정 배열 |
| `projectId` | number \| undefined | 연결된 프로젝트 `id` |

### SubItem

| 필드 | 타입 | 설명 |
|------|------|------|
| `text` | string | 세부일정 텍스트 |
| `done` | boolean | 완료 여부 |
| `completedAt` | string \| undefined | 완료 날짜 `"YYYY-MM-DD"` |

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
| `id` | number | `Date.now()` 기반 고유 ID |
| `text` | string | 메모 내용 |
| `done` | boolean | 완료 여부 |

### localStorage

| 키 | 구조 | 설명 |
|----|------|------|
| `fbConfig` | `{ apiKey, ... }` | Firebase 설정 객체 |
| `calHolidays` | `{ "YYYY-MM-DD": "공휴일명" }` | 사용자 수동 추가 공휴일 |
| `calHol_{YYYY}` | `{ data: {...}, ts: number }` | 연도별 자동 fetch 공휴일 캐시 (30일 TTL) |

### 예시 JSON

```json
{
  "plans": {
    "2026-03-03": [{
      "text": "기획 회의",
      "color": "#4f86f7",
      "category": "work",
      "startDate": "2026-03-03",
      "endDate": "2026-03-07",
      "done": false,
      "projectId": 1741872000000,
      "sub": [
        { "text": "기획서 작성", "done": true, "completedAt": "2026-03-04" },
        { "text": "디자인 검토", "done": false }
      ]
    }]
  },
  "memos": [
    { "id": 1741872000001, "text": "참고 자료 찾기", "done": false }
  ],
  "projects": [
    {
      "id": 1741872000000,
      "name": "런칭 준비",
      "color": "#4f86f7",
      "category": "work",
      "startDate": "2026-03-01",
      "endDate": "2026-03-31",
      "done": false,
      "doneDate": null
    }
  ]
}
```

---

## 📜 개발 로그 (Dev Log)

<details>
<summary>접기/펴기 (최근 2026-03-14 업데이트)</summary>

### 2026-03-14
#### ✨ New Features

- **메모 Firebase 연동** `✅ 완료`
  - AS-IS: localStorage(`calMemos`)에만 저장 → 기기·브라우저 간 동기화 불가
  - TO-BE: Firebase Realtime DB `calendar/memos` 경로로 실시간 저장·동기화
  - `saveMemos()` — `memoRef` 존재 시 Firebase, 없으면 localStorage fallback

- **프로젝트 관리** `✅ 완료`
  - `📁 프로젝트` 버튼 → 관리 다이얼로그(이름·기간·색상·카테고리 설정 후 추가/삭제)
  - 진행 중 프로젝트: 기간 내 모든 달력 셀에 컬러 배너 표시 (반투명 배경 + 좌측 색상 border)
  - 완료된 프로젝트: 완료일(`doneDate`) 셀에만 표시
  - Firebase `calendar/projects` 저장·동기화

- **프로젝트 ↔ 일정 연결** `✅ 완료`
  - 캘린더 일정을 프로젝트 상세 패널 드롭존에 드래그하거나, 패널 내 추가 폼으로 직접 생성
  - 연결 방식: `plans[dateKey][idx].projectId` 태그 부여 → Firebase `save()` 즉시 반영
  - `getProjectItems(projectId)`: `plans` 전체 순회 후 날짜 정렬 반환
  - 진행률 = 연결된 일정 중 완료 개수 (`getProjectProgress`)

- **프로젝트 카테고리 분리** `✅ 완료`
  - 추가 폼·상세 패널에 `💼 업무 / 🏠 개인` 토글 → `projects[].category` 저장·수정 가능
  - 헤더 카테고리 필터 전환 시 프로젝트 바도 함께 필터링
  - 개인 프로젝트 바는 border-left `dashed` 스타일로 시각적 구분

- **캘린더 프로젝트 그룹핑** `✅ 완료`
  - 셀 내 렌더 순서: `[프로젝트 바] → [연결 일정] → [세부일정] → [독립 일정]`
  - 연결 일정은 프로젝트 바 아래 들여쓰기로 묶음 표시

### 2026-03-04
#### ✨ New Features

- **공휴일 자동 로드 — SWR 캐싱 + 드래그 안전 렌더링** `✅ 완료`
  - 기존: `HOLIDAYS_KR` 객체에 2025~2026 하드코딩 → 연도별 수동 관리 필요
  - 변경: `new Date().getFullYear()` 기준 `-1 ~ +2` 범위 자동 계산, Nager.Date API 병렬 fetch
  - SWR 패턴: 캐시(`calHol_{YYYY}`, 30일 TTL) 즉시 반영 → 만료분만 백그라운드 갱신
  - `_safeRenderAll()`: 드래그 중이면 dirty flag만 세우고 dragend 시점에 renderAll() 실행

- **메모 → 캘린더 드래그앤드롭** `✅ 완료`
  - 메모를 달력 셀에 드래그하면 해당 날짜 일정 추가 모달이 텍스트 자동 입력된 채로 열림
  - 드롭 성공 시 메모 자동 삭제, 완료된 메모는 드래그 비활성화

- **업무/개인 카테고리 분리** `✅ 완료`
  - 헤더 `전체 / 💼 업무 / 🏠 개인` 토글 필터
  - 업무: `COLORS_WORK` (쿨톤), 개인: `COLORS_PERSONAL` (웜톤)
  - 카테고리 모드 전환 시 요일·주간 헤더 배경색 즉시 변경 (`data-cat` CSS selector)

- **캘린더 일정 드래그앤드롭 이동** `✅ 완료`
  - 일반 아이템: 드롭한 날짜로 이동
  - 기간 스팬 아이템: 잡은 셀 기준 오프셋 계산 → 시작일·종료일 동시 이동
  - `application/x-cal-item` 커스텀 MIME 타입으로 메모 드래그와 구분

#### 🔧 Bug Fixes

- **드래그 날짜 오프셋 계산 버그** `🔧 수정`
  - 원인: `shiftDate` 내부 `Date.toISOString()` 사용 시 UTC 변환으로 KST 자정이 전날로 밀림
  - 수정: `getFullYear() / getMonth() / getDate()` 조합으로 로컬 날짜 문자열 생성

### 2026-03-03
#### ✨ New Features

- **메모 패널** `✅ 완료`
  - 날짜 무관 할일을 적어두는 좌측 슬라이드 패널 (`js/memo.js`)
  - 체크박스 완료 처리, 더블클릭 수정, 완료 항목 일괄 삭제

- **공휴일 UX 개선** `✅ 완료`
  - 헤더에서 공휴일 버튼 제거, `⚙️ 설정 변경` 패널 하단 텍스트 링크로 숨김 처리

</details>
