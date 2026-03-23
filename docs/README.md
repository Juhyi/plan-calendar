# 📅 월간 계획 캘린더 (Personal Task Manager)
> **Status:** 🚧 개발 중 (Developing Since 2026-02-27)
>
> **Firebase(BaaS) 기반의 Serverless 아키텍처**로 구현된 개인 플래너.
> 별도 백엔드 없이 `index.html`만으로 동작하며, 실시간 데이터 동기화와 타임존 세이프(Timezone-safe) 날짜 연산을 제공합니다.

---

## ✨ 주요 기능

| 기능 | 설명 |
|------|------|
| 📅 월간 캘린더 | 월별 날짜 표시, 오늘·공휴일·일/토 색상 구분, 날짜 클릭 → 팝오버 → 일정 추가 |
| 📋 주간 캘린더 | 7일 컬럼 레이아웃, 이전/다음/이번 주 이동, 월간과 데이터 공유 |
| 🏷️ 카테고리 분리 | 업무(쿨톤) / 개인(웜톤) 팔레트 분리, 헤더 토글 필터 |
| 📁 프로젝트 그룹핑 | 캘린더·일정관리 탭에서 프로젝트별 묶음 표시 (색상 테두리) |
| ✅ 세부일정(SubTask) | 상세 패널에서 서브태스크 CRUD·순서변경, 완료 날짜 자동 기록 |
| 📊 진행률 색상 보간 | 세부일정 완료 비율에 따라 색상 선형 보간 (원색 → 보라), `(완료/전체)` 텍스트 |
| 🗒️ 사이드바 메모 | 사이드바 하단 고정 패널에 메모 입력·목록, `+` 버튼으로 세부일정 변환 |
| 🖱️ 날짜 간 드래그 이동 | 캘린더 일정 날짜 이동, 기간 일정은 전체 기간 shift |
| 🗓️ 공휴일 자동화 | Nager.Date API SWR 캐싱(30일 TTL) + iCal 파싱, 수동 추가 지원 |
| 📝 일정 메모 | 일정 상세 패널(우측 클릭 시 열리는 창)에서 일정별 메모 입력·저장, `plans[planId].memo` 에 기록 |
| 🗂️ 프로젝트 메모 조회 | 프로젝트 상세 패널 일정 탭 하단에 연결 일정의 메모 카드 목록 표시, 클릭 시 해당 일정으로 이동 |
| 🔍 날짜 범위 검색 | 일정 관리 탭에서 검색 기간과 겹치는 모든 일정 조회 (오버랩 방식) |
| 📅 약속 시각 구분 | 지난 약속은 흐리게(opacity 0.35 + desaturate), 예정 약속은 선명하게 |
| ✏️ 나의 할 일 날짜 편집 | 세부일정 목록에서 인라인 date input으로 예정일 직접 수정 |

---

## 🏗️ 파일 구조

```
my_calendar/
├── index.html          # HTML 구조 (탭 레이아웃, 사이드바 메모 패널, 상세 패널, 모달)
├── style.css           # 전체 스타일
├── docs/
│   ├── README.md       # 이 문서 (기능·구조·데이터 구조)
│   ├── Engineering_Deep_Dive.md  # 기술 설계 결정 상세
│   └── devlog.md       # 날짜별 개발 로그
└── js/
    ├── utils.js        # 전역 상수·상태, 날짜·색상 유틸, ID 생성기, hydratePlan
    ├── firebase.js     # Firebase 초기화, save 함수, 마이그레이션, config UI
    ├── holidays.js     # 공휴일 로드·파싱(JSON+iCal), SWR 캐싱, 드래그 안전 렌더
    ├── calendar.js     # 월간 렌더, 일정 CRUD 모달, 프로젝트 그룹핑, 날짜 간 드래그
    ├── week.js         # 주간 렌더 (calendar.js와 동일 패턴)
    ├── detail.js       # 우측 상세 패널, 세부일정 CRUD, 메모 필드, 복사·완료 토글
    ├── nav.js          # 사이드바 탭 전환, 나의 할 일·일정 관리 탭 렌더, 신규 일정 폼
    ├── memo.js         # 사이드바 메모 패널, 팝오버 세부일정 변환, Firebase 동기화
    └── projects.js     # 프로젝트 CRUD, 일정 연결/해제, 카테고리·진행률 관리
```

**로딩 순서:** `utils` → `firebase` → `holidays` → `calendar` → `week` → `detail` → `nav` → `memo` → `projects`

---

## 🗂️ 사이드바 탭 구성

| 순서 | 탭 이름 | 설명 |
|------|---------|------|
| 1 | 캘린더 | 월간·주간 캘린더 뷰 |
| 2 | 나의 할 일 | 전체 세부일정 목록, 기간 필터, 인라인 날짜 편집 |
| 3 | 일정 관리 | 전체 일정 목록, 프로젝트·약속 그룹핑, 신규 일정 폼 |
| 4 | 프로젝트 | 프로젝트 CRUD, 연결 일정·진행률 관리 |

> 사이드바 하단 고정: 📝 메모 패널 (탭과 무관하게 항상 표시)

---

## 💾 데이터 구조

### Firebase Realtime DB 경로

```
calendar/
├── plans/
│   └── "plan_ID"   ← planId 기반 플랫 객체 (plan_{timestamp}_{rand})
│         └── { Plan }
├── subTasks/
│   └── "sub_ID"    ← subId 기반 플랫 객체 (sub_{timestamp}_{rand})
│         └── { SubTask }
├── memos/
│   └── "memoId"    ← memoId 기반 객체
│         └── { Memo }
└── projects/
    └── "projId"    ← projId 기반 객체
          └── { Project }
```

### Plan

| 필드 | 타입 | 설명 |
|------|------|------|
| `date` | string | 대표 날짜 (`"YYYY-MM-DD"`, 단일 일정은 startDate와 동일) |
| `text` | string | 일정 제목 |
| `color` | string | 색상 hex (`#4f86f7`) |
| `category` | `"work"` \| `"personal"` | 카테고리 (미설정 시 `"work"` 처리) |
| `startDate` | string | 기간 시작일 (`"YYYY-MM-DD"`) |
| `endDate` | string | 기간 종료일 (단일 일정은 startDate와 동일) |
| `done` | boolean | 완료 여부 (세부일정 없는 항목만 유효) |
| `type` | `"task"` \| `"event"` | 할일 / 약속 구분 (미설정 시 `"task"`) |
| `projectId` | number \| null | 연결된 프로젝트 ID (선택적) |
| `memo` | string | 일정 메모 (선택적, 빈 문자열 가능) |

### SubTask

| 필드 | 타입 | 설명 |
|------|------|------|
| `parentPlanId` | string | 부모 Plan의 planId |
| `text` | string | 세부일정 텍스트 |
| `done` | boolean | 완료 여부 |
| `dueDate` | string | 예정일 (`"YYYY-MM-DD"`, 생성 시 오늘 날짜 기본값) |
| `completedAt` | string | 완료 날짜 (`"YYYY-MM-DD"`, 미완료 시 `""`) |
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

### 예시 JSON

```json
{
  "plans": {
    "plan_1741872000000_ab12": {
      "date": "2026-03-03",
      "text": "기획 회의",
      "color": "#4f86f7",
      "category": "work",
      "type": "task",
      "startDate": "2026-03-03",
      "endDate": "2026-03-07",
      "done": false,
      "projectId": 1741872000000,
      "memo": "사전에 기획서 검토할 것"
    }
  },
  "subTasks": {
    "sub_1741872000001_cd34": {
      "parentPlanId": "plan_1741872000000_ab12",
      "text": "기획서 작성",
      "done": true,
      "dueDate": "2026-03-04",
      "completedAt": "2026-03-04",
      "order": 0
    },
    "sub_1741872000002_ef56": {
      "parentPlanId": "plan_1741872000000_ab12",
      "text": "디자인 검토",
      "done": false,
      "dueDate": "2026-03-07",
      "completedAt": "",
      "order": 1
    }
  },
  "memos": {
    "1741872000003": { "text": "참고 자료 찾기", "done": false }
  },
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

## 🔥 Firebase 연동

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트 생성
2. **Realtime Database** 활성화 (테스트 모드)
3. 앱 시작 화면에서 `firebaseConfig` 객체 전체를 붙여넣고 **저장 및 연결** 클릭
4. 이후에는 자동으로 연결 (설정은 `localStorage`에 저장됨)

---

## 📈 향후 로드맵 (Roadmap)

- [ ] **Multi-User Sync**: Firebase Auth 연동 및 권한 보안 규칙(Rules) 설정
- [ ] **Data Visualization**: 월별 일정 완료 통계 대시보드 (Chart.js)
- [ ] **PWA 전환**: 서비스 워커(Service Worker)로 오프라인 지원
