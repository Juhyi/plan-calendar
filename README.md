# 📅 월간 계획 캘린더 (Personal Task Manager) 
> **Status:** 🚧 개발 중 (Developing Since 2026-02-27)
>
> **Firebase(BaaS) 기반의 Serverless 아키텍처**로 구현된 고성능 개인 플래너입니다.
> 별도의 백엔드 서버 구축 없이 `index.html`만으로 동작하며, 실시간 데이터 동기화와 타임존 세이프(Timezone-safe)한 날짜 연산 로직을 제공합니다.

---

## 📺 Quick Look

| | 기능 | 설명 |
|--|------|------|
| 🖱️ | **메모 드래그 앤 드롭** | 좌측 메모 패널의 항목을 월간 달력 날짜 셀로 드래그하면 해당 날짜의 일정 추가 모달이 텍스트 자동 입력된 채로 열림. 드롭 즉시 메모에서도 삭제되어 원자적(Atomic) 전환 보장 |
| 🎨 | **카테고리별 동적 테마** | 업무(쿨톤 파란 계열) / 개인(웜톤 주황 계열) 색상 팔레트 분리. 모드 전환 시 요일 헤더·주간 컬럼 헤더 배경색이 `data-cat` attribute 기반 CSS selector로 즉시 전환 |
| 📊 | **진행률 선형 보간 UI** | 세부일정 완료 개수에 따라 아이템 색상이 지정 색 → 보라색(`#9b59b6`)으로 Linear Interpolation. 완료율 0%는 원래 색, 100%는 보라색으로 수렴하며 월간·주간·상세 뷰에 실시간 반영 |

---

## 🔍 핵심 기술 점검 (Self-Checklist)
[//]: # (> 개발자로서 설계 시 고려한 기술적 포인트. 면접 대비를 위해 지속적으로 업데이트 중.)

- [X] **데이터 정합성 (Data Validation)**: 타임존 오차(off-by-one)를 해결한 로컬 시간 기반 날짜 직렬화 구현 ✅
- [ ] **상태 관리 및 동기화**: 상세 패널의 데이터 변경이 월간/주간 뷰에 전파되는 과정에서 불필요한 전체 렌더링을 방지했는가?
- [ ] **성능 최적화 (DOM Manipulation)**: 일정 데이터가 대량으로 늘어날 경우를 대비한 렌더링 최적화(Virtual List 등) 방안을 고민했는가?
- [X] **UX 인터랙션 설계**: 드래그앤드롭 시 커스텀 MIME 타입(`application/x-cal-item`)을 사용하여 일반 텍스트 드래그와 충돌을 방지했는가? ✅

---

## 🛠 기술적 차별점 (Technical Deep Dive)

### 1. 효율적인 데이터 조회: 인메모리 역인덱싱(In-memory Indexing)
- **Challenge**: 세부일정(sub-items)은 부모 일정의 날짜 아래 종속되어 있어, '완료 날짜' 기준의 달력 렌더링을 위해 매번 전체 데이터를 전수조사해야 하는 $O(N)$의 병목 발생.
- **Solution**: 앱 로드 시 plans를 1회 순회하여 완료일 기준의 **역인덱스 맵(completedSubMap)**을 구축하는 설계 채택.
- **Benefit**: NoSQL의 조인 불가 한계를 메모리 기반 인덱싱으로 해결하여, 각 날짜 셀 렌더링 시 $O(1)$의 속도로 완료 항목을 즉시 참조하도록 최적화.

### 2. 정밀한 UX 구현: 그랩 포인트(Grab Point) 기준 오프셋 연산
- **Challenge**: 기간 일정 드래그 시 항상 시작일 기준으로만 계산하면, 일정의 뒷부분을 잡고 이동할 때 마우스 포인터와 일정 바 사이에 시각적 괴리 발생.
- **Solution**: 드래그 시작 시 **데이터 실제 위치(StorageKey)**와 **사용자가 클릭한 위치(DisplayKey)**를 분리하여 오프셋을 계산하는 로직 구현.
- **Benefit**: 일정의 어느 지점을 잡더라도 마우스 포인터 위치에 맞춰 전체 기간이 자연스럽게 Shift 되는 직관적인 드래그앤드롭 경험 제공.

### 3. 선언적 테마 제어: dataset 기반의 상태-스타일 분리
- **관심사 분리**: 카테고리 전환(업무/개인) 시 JS로 모든 DOM의 스타일을 직접 수정하는 대신, 최상위 컨테이너의 data-cat 속성만 변경.
- **최적화**: CSS Selector 로직에 테마별 색상과 레이아웃(요일/주간 헤더 배경 등)을 위임하여 JS의 렌더링 부하를 줄이고 코드 유지보수성 극대화.

### 4. 공휴일 자동 로드: Stale-While-Revalidate 캐싱 전략
- **Challenge**: 공휴일 데이터를 하드코딩하면 연도가 바뀔 때마다 소스 수정이 필요하고, 매 페이지 로드마다 API를 호출하면 네트워크 비용이 발생.
- **Solution**: SWR(Stale-While-Revalidate) 패턴 적용. 연도별 공휴일 데이터를 `calHol_{YYYY}` 키로 localStorage에 30일간 캐싱. 로드 시 캐시가 있으면 즉시 반영 후 만료 여부에 따라 백그라운드에서 갱신 요청.
- **Benefit**: 첫 방문에는 API hit, 이후 30일간은 0 네트워크 비용으로 즉각 표시. 네트워크 실패 시 내장 폴백 데이터로 무중단 동작.
- **Implementation**:
```
페이지 로드
  └─ [즉시] 내장 폴백 + localStorage 캐시로 holidays 초기화 → 렌더
  └─ [백그라운드] 캐시 없거나 30일 경과한 연도만 Nager.Date API 병렬 fetch
       └─ 성공 → localStorage 갱신 + _safeRenderAll()
       └─ 실패 → 캐시/폴백 유지, 오류 없음
```
- **캐시 키 분리**: 자동 fetch 데이터(`calHol_YYYY`)와 사용자 수동 추가 데이터(`calHolidays`)를 독립 저장하여 상호 오염 방지.

### 5. 드래그 안전 렌더링: Dirty Flag + 이벤트 기반 지연(Deferred Update)
- **Challenge**: 백그라운드 fetch가 완료되는 시점은 예측 불가. 사용자가 드래그 중일 때 `renderAll()`이 호출되면 DOM이 재구성되어 드래그 대상 요소가 사라지고 조작이 중단됨.
- **Solution**: `document` 레벨의 `dragstart`/`dragend` 이벤트로 전역 드래그 상태(`_isDragging`)를 추적. fetch 완료 후 `_safeRenderAll()`을 거치게 하여, 드래그 중이면 `_holDirty = true` 표시만 하고 실제 렌더는 `dragend` 시점으로 연기.
- **Benefit**: 기존 memo.js/calendar.js 드래그 로직을 수정하지 않고 holidays.js 내에서 완결. 드래그 종료 즉시 공휴일 데이터가 자연스럽게 반영됨.
- **Implementation**:
```
dragstart → _isDragging = true

fetch 완료 → _safeRenderAll() 호출
               ├─ _isDragging = true  → _holDirty = true (렌더 연기)
               └─ _isDragging = false → renderAll() 즉시 호출

dragend   → _isDragging = false
             _holDirty = true → renderAll() 실행 후 플래그 초기화
```

### 6. 타임존 안정성을 고려한 날짜 식별자 설계 (Deterministic Date Keys)
- **Issue**: `Date.toISOString()` 사용 시 타임존이 UTC로 강제 변환되어, KST(UTC+9) 기준 자정(00:00) 데이터가 전날(15:00 UTC)로 저장되는 **off-by-one** 오류 발생.
- **Decision**: 렌더링/표시용인 `Intl.DateTimeFormat` 대신, **Native Date API**를 활용한 명시적 날짜 직렬화(Serialization) 채택.
- **Reasoning**:
  - **데이터 무결성**: `Intl`은 로케일 기반의 '표시(Display)' API로, 시스템 설정에 따라 포맷이 변할 위험이 있음. 반면 내부 저장 키(Storage Key)는 항상 고정된 `YYYY-MM-DD` 형식을 유지해야 함.
  - **직관적인 타임존 제어**: 별도 옵션 없이도 JS 엔진이 계산한 로컬 시간 컴포넌트(`getFullYear` 등)를 즉시 반환하므로 연산 비용이 낮고 로직이 명확함.
  - **의존성 최소화**: 특정 로케일(예: `sv-SE`)의 포맷팅 규칙에 의존하는 꼼수를 배제하고, Template Literal과 `padStart`를 통해 형식을 엄격하게 제어.
- **Result**: 환경에 독립적인 날짜 생성 로직을 구축하여 드래그 앤 드롭 및 일정 이동 시 100%의 데이터 정합성 확보.
- **Implementation**:
```javascript
// ❌ AS-IS (Timezone Error)
const key = date.toISOString().slice(0, 10); // KST 00:00 -> "2026-03-02" (하루 밀림)

// ✅ TO-BE (Local Time Safe)
const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
```
---

## 📈 향후 로드맵 (Roadmap)
- [ ] **Multi-User Sync**: Firebase Auth 연동 및 권한 보안 규칙(Rules) 설정을 통한 공유 가계부/플래너 확장.
- [ ] **Data Visualization**: Chart.js를 연동하여 월별 일정 완료 통계 및 시간 관리 대시보드 추가.
- [ ] **PWA 전환**: 서비스 워커(Service Worker)를 활용하여 오프라인 환경에서도 메모 및 일정 확인 가능하도록 구현.

---

## 📜 개발 로그 (Dev Log) 
[//]: #([상태 태그(✅ 완료, 📋 TODO, 🔧 수정) 유형 태그 (✨ New Features,🔧 Bug Fixes)])

### 2026-03-04
#### 🔧 수정
- **공휴일 자동 로드 — SWR 캐싱 + 드래그 안전 렌더링** `✅ 완료`
  - 기존: `HOLIDAYS_KR` 객체에 2025~2026 하드코딩 → 연도별 수동 관리 필요
  - 변경: `new Date().getFullYear()` 기준 `-1 ~ +2` 범위 자동 계산, Nager.Date API 병렬 fetch
  - Stale-While-Revalidate 패턴: 캐시(`calHol_{YYYY}`, 30일 TTL) 즉시 반영 → 만료분만 백그라운드 갱신
  - 사용자 추가 공휴일(`calHolidays`)과 자동 fetch 캐시를 분리 저장하여 충돌 방지
  - `_safeRenderAll()`: `document` 레벨 dragstart/dragend로 드래그 상태 추적 → 드래그 중이면 dirty flag만 세우고 dragend 시점에 renderAll() 실행

#### ✨ New Features
- **메모 → 캘린더 드래그앤드롭** `✅ 완료`
  - 메모 항목을 월간 달력 날짜 셀에 드래그하면 해당 날짜의 일정 추가 모달이 텍스트 자동 입력된 채로 열림
  - 드롭 대상 셀 파란 점선 하이라이트, 드래그 중 항목 반투명 처리
  - 완료된 메모 항목은 드래그 비활성화
- **드래그 후 메모 자동 삭제** `✅ 완료`
  - 캘린더에 드롭 성공 시 해당 메모 항목 자동 제거
- **업무/개인 카테고리 분리** `✅ 완료`
  - 헤더에 `전체 / 💼 업무 / 🏠 개인` 토글 필터 추가
  - 일정 추가/수정 모달에 카테고리 선택 버튼 추가
  - 업무: 쿨톤 색상 팔레트 (`COLORS_WORK`), 개인: 웜톤 색상 팔레트 (`COLORS_PERSONAL`)
  - 달력 아이템에 카테고리별 좌측 border 인디케이터 (파란색=업무, 주황색=개인)
  - 기존 데이터는 업무(`work`)로 자동 처리
- **카테고리 모드 헤더 시각화** `✅ 완료`
  - 업무 모드: 요일 헤더·주간 컬럼 헤더가 파란 배경으로 변경
  - 개인 모드: 요일 헤더·주간 컬럼 헤더가 주황 배경으로 변경
  - `data-cat` 속성을 `.calendar`·`.weekly-section`에 부여 → CSS selector로 일괄 처리
- **완료 세부일정 카테고리 필터 적용** `✅ 완료`
  - `completedSubMap`은 전체 plans를 카테고리 구분 없이 집계하므로 "아직 표시되지 않은 완료 세부일정" 렌더 블록에 별도 filter 조건 추가 필요
  - `calendar.js`·`week.js` 두 곳에 `(currentCategory === 'all' || (cs.item.category || 'work') === currentCategory)` 조건 추가
- **캘린더 일정 드래그앤드롭 이동** `✅ 완료`
  - 월간 달력의 일정(일반 아이템, 기간 스팬 바)을 다른 날짜 셀로 드래그해서 이동
  - 일반 아이템: 드롭한 날짜로 이동
  - 기간 스팬 아이템: 잡은 셀 기준으로 오프셋 계산 → 시작일·종료일 동시 이동
  - 드래그 중 해당 아이템 반투명 처리, 드롭 가능한 셀 파란 점선 하이라이트
  - `application/x-cal-item` 커스텀 MIME 타입으로 메모 드래그와 구분
  - 이동 후 상세 패널 자동 닫기 및 저장

#### 🔧 Bug Fixes
- **드래그 날짜 오프셋 계산 버그 수정** `🔧 수정`
  - **오류 현상**: 3/10 → 3/11로 드래그해도 3/10에 그대로 저장됨. 3/12로 드래그해야 3/11에 들어가는 off-by-one 오류
  - **원인**: `shiftDate` 내부에서 `Date.toISOString()`을 사용하면 UTC 기준으로 변환됨. 한국(UTC+9) 환경에서 자정(00:00 KST) = 전날 15:00 UTC이므로 `.slice(0,10)` 결과가 하루 앞 날짜로 나옴
  - **수정**: `toISOString()` 대신 로컬 시간 기준의 `getFullYear() / getMonth() / getDate()` 조합으로 날짜 문자열 생성 (`buildSpanMap()`과 동일한 패턴 적용)



### 2026-03-03
#### ✨ New Features
- **공휴일 UX 개선** `📋 TODO`
  - AS-IS: URL 입력창, ICS 붙여넣기 창이 대놓고 노출됨
  - TO-BE: 기본적으로 한국 공휴일 자동 내장, 설정 메뉴 구석에 **[공휴일 데이터 수동 업데이트]** 버튼을 숨겨두는 방식으로 변경
- **메모 패널 추가** `✅ 완료`
  - 날짜 무관한 할일/메모를 적어두는 좌측 슬라이드 패널 (`js/memo.js`)
  - 체크박스 완료 처리, 더블클릭 수정, 완료 항목 일괄 삭제
  - `localStorage`에 저장 (새로고침 유지)





---

## ✨ 주요 기능

| 기능 | 설명 |
|------|------|
| 📅 월간 캘린더 | 월별 날짜 표시, 오늘·공휴일·일/토 색상 구분, 날짜 클릭으로 일정 추가 |
| 📋 주간 캘린더 | 7일 컬럼 레이아웃, 이전/다음/이번 주 이동, 월간과 데이터 공유 |
| 📝 일정 관리 | 텍스트·색상·기간(시작~종료일) 설정, 수정·삭제·복사, CSV 내보내기 |
| ↔️ 기간 일정 | 시작~종료일 설정 시 해당 날짜 전체에 스팬 바 표시, 드래그 이동 시 기간 전체 shift |
| 🏷️ 카테고리 분리 | 업무(쿨톤) / 개인(웜톤) 팔레트 분리, 헤더 토글 필터, 아이템 좌측 border 인디케이터 |
| ✅ 세부일정 | 우측 패널에서 서브태스크 CRUD·순서변경, 완료 날짜 자동 기록·셀 표시 |
| 📊 진행률 | 세부일정 완료 비율에 따라 색상 선형 보간(원색→보라), `(완료/전체)` 텍스트 |
| 🗒️ 메모 패널 | 날짜 무관 할일 패널(좌측 슬라이드), 완료·수정·삭제, localStorage 저장 |
| 🖱️ 드래그앤드롭 | 메모 → 캘린더 드롭(일정 모달 자동 입력), 캘린더 아이템 날짜 간 이동 |
| 🗓️ 공휴일 | iCal URL / `.ics` 붙여넣기로 공휴일 등록, localStorage 저장 |

---

## 🏗️ 프로젝트 구조 (File Tree)

```
my_calendar/
├── index.html          # HTML 구조
├── style.css           # 전체 스타일
└── js/
    ├── utils.js        # 전역 상수·상태(year, month, plans, modal), 날짜·색상 유틸
    ├── firebase.js     # Firebase 초기화, save(), config UI
    ├── holidays.js     # 공휴일 로드·파싱(JSON+iCal)·표시, localStorage 저장
    ├── calendar.js     # 월간 렌더, 일정 CRUD, 드래그앤드롭 수신, moveCalItem
    ├── week.js         # 주간 렌더, renderAll()
    ├── detail.js       # 상세 패널, 세부일정 CRUD, 복사, 완료 토글
    └── memo.js         # 메모 패널(좌측 슬라이드), 할일 CRUD, 드래그 송신
```

> 로딩 순서: `utils` → `firebase` → `holidays` → `calendar` → `week` → `detail` → `memo`

---
## 🛠 사용 기술

| 기술 | 용도 |
|------|------|
| Vanilla JS (ES6+) | 프레임워크·번들러 없이 전역 스코프 모듈 분리 |
| Firebase Realtime DB v9 (compat) | 일정 데이터 실시간 저장·동기화 |
| HTML5 Drag & Drop API (`DataTransfer`) | 메모→캘린더 이동, 캘린더 아이템 날짜 간 이동 |
| iCal / JSON 파싱 (직접 구현) | 공휴일 URL·`.ics` 파일 파싱 |
| localStorage | 공휴일 맵, 메모 목록, Firebase config 캐시 |
| CSS `data-*` attribute | 카테고리 모드별 헤더 테마 일괄 적용 |

---

## 🔥 Firebase 연동

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트 생성
2. **Realtime Database** 활성화 (테스트 모드)
3. 앱 시작 화면에서 `firebaseConfig` 객체 전체를 붙여넣고 **저장 및 연결** 클릭
4. 이후에는 자동으로 연결 (설정은 `localStorage`에 저장됨)

---

## 💾 데이터 구조 

### Firebase Realtime DB — `plans`

```
plans/
└── "YYYY-MM-DD"  ← 일정의 저장 키 (기간 일정은 startDate 기준)
      └── [ Item ]
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `text` | string | 일정 텍스트 |
| `color` | string | 색상 hex (`#4f86f7`) |
| `category` | `"work"` \| `"personal"` | 카테고리 (미설정 시 `"work"` 처리) |
| `startDate` | string \| null | 기간 시작일 (`"YYYY-MM-DD"`) |
| `endDate` | string \| null | 기간 종료일 |
| `done` | boolean | 완료 여부 (세부일정 없는 항목만) |
| `sub` | SubItem[] | 세부일정 배열 |

**SubItem**

| 필드 | 타입 | 설명 |
|------|------|------|
| `text` | string | 세부일정 텍스트 |
| `done` | boolean | 완료 여부 |
| `completedAt` | string \| undefined | 완료 날짜 (`"YYYY-MM-DD"`) |

```json
{
  "plans": {
    "2026-03-03": [{
      "text": "프로젝트 A",
      "color": "#4f86f7",
      "category": "work",
      "startDate": "2026-03-03",
      "endDate": "2026-03-07",
      "done": false,
      "sub": [
        { "text": "기획서 작성", "done": true, "completedAt": "2026-03-04" },
        { "text": "디자인 검토", "done": false }
      ]
    }]
  }
}
```

### localStorage

| 키 | 구조 | 설명 |
|----|------|------|
| `calFirebaseConfig` | `{ apiKey, ... }` | Firebase 설정 객체 |
| `calHolidays` | `{ "YYYY-MM-DD": "공휴일명" }` | 공휴일 맵 |
| `calMemos` | `[{ text, done }]` | 메모 패널 할일 목록 |











