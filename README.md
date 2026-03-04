# 📅 월간 계획 캘린더 (Personal Task Manager)

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

### 1. 비즈니스 로직: 진행률 기반 동적 UI 렌더링
- 세부 일정(`sub-items`)의 완료 개수에 따라 부모 항목의 색상을 **Linear Interpolation(선형 보간)** 알고리즘으로 계산하여 시각화.
- 단순한 체크박스 수준을 넘어, 데이터 상태 변화가 UI 전체(`Monthly`, `Weekly`, `Detail`)에 실시간 전파되는 반응형 로직 구현.

### 2. UX: 드래그앤드롭 태스크 전환 시스템
- `DataTransfer` API를 활용하여 좌측 메모 패널의 텍스트를 달력의 특정 날짜로 전이.
- 드롭 타겟 인식 및 드롭 후 데이터 정합성 유지(메모 삭제 + 일정 생성)를 위한 **Atomic Operation** 로직 설계.

### 3. 모듈형 아키텍처 설계
- 프레임워크 없이 Vanilla JS 모듈만으로 복잡한 기능을 구현하기 위해 기능을 분리.
- `utils.js`를 통해 전역 상태 및 날짜 연산 함수를 집중 관리하여 코드 재사용성 및 유지보수성 극대화.

### 4. 타임존 안정성을 고려한 날짜 식별자 설계 (Deterministic Date Keys)
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
[//]: # ([상태 태그(✅ 완료, 📋 TODO, 🔧 수정) 유형 태그 (✨ New Features,🔧 Bug Fixes)])

### 2026-03-03
#### ✨ New Features
- **공휴일 UX 개선** `📋 TODO`
  - AS-IS: URL 입력창, ICS 붙여넣기 창이 대놓고 노출됨
  - TO-BE: 기본적으로 한국 공휴일 자동 내장, 설정 메뉴 구석에 **[공휴일 데이터 수동 업데이트]** 버튼을 숨겨두는 방식으로 변경
- **메모 패널 추가** `✅ 완료`
  - 날짜 무관한 할일/메모를 적어두는 좌측 슬라이드 패널 (`js/memo.js`)
  - 체크박스 완료 처리, 더블클릭 수정, 완료 항목 일괄 삭제
  - `localStorage`에 저장 (새로고침 유지)

### 2026-03-04
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

## 🏗️ 프로젝트 구조 & 🛠 사용 기술

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


| 기술 | 용도 |
|------|------|
| Vanilla JS (ES6+) | 프레임워크·번들러 없이 전역 스코프 모듈 분리 |
| Firebase Realtime DB v9 (compat) | 일정 데이터 실시간 저장·동기화 |
| HTML5 Drag & Drop API (`DataTransfer`) | 메모→캘린더 이동, 캘린더 아이템 날짜 간 이동 |
| iCal / JSON 파싱 (직접 구현) | 공휴일 URL·`.ics` 파일 파싱 |
| localStorage | 공휴일 맵, 메모 목록, Firebase config 캐시 |
| CSS `data-*` attribute | 카테고리 모드별 헤더 테마 일괄 적용 |

---

## 💾 데이터 구조 & 🔥 Firebase 연동

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


### Firebase 연동

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트 생성
2. **Realtime Database** 활성화 (테스트 모드)
3. 앱 시작 화면에서 `firebaseConfig` 객체 전체를 붙여넣고 **저장 및 연결** 클릭
4. 이후에는 자동으로 연결 (설정은 `localStorage`에 저장됨)

---








