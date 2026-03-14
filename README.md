# 📅 월간 계획 캘린더 (Personal Task Manager)

> Firebase(BaaS) 기반 Serverless 아키텍처의 개인 플래너.
> `index.html` 하나로 동작하며 실시간 데이터 동기화를 지원합니다.
>
> 기술적 설계 상세는 [Engineering Deep Dive](docs/Engineering_Deep_Dive.md)를 참고하세요.

---

## ✨ 주요 기능

| 기능 | 설명 |
|------|------|
| 📅 월간 캘린더 | 월별 날짜 표시, 오늘·공휴일·일/토 색상 구분, 클릭으로 일정 추가 |
| 📋 주간 캘린더 | 7일 컬럼 레이아웃, 이전/다음/이번 주 이동, 월간과 데이터 공유 |
| 📝 일정 관리 | 텍스트·색상·기간 설정, 수정·삭제·복사, CSV 내보내기 |
| ↔️ 기간 일정 | 시작~종료일 스팬 바 표시, 드래그 이동 시 기간 전체 shift |
| ✅ 세부일정 | 서브태스크 CRUD·순서변경, 완료 날짜 자동 기록·셀 표시 |
| 📊 진행률 | 세부일정 완료 비율에 따라 색상 선형 보간, `(완료/전체)` 텍스트 |
| 🏷️ 카테고리 | 업무(쿨톤) / 개인(웜톤) 팔레트 분리, 헤더 토글 필터 |
| 🗒️ 메모 패널 | 날짜 무관 할일 패널(좌측 슬라이드), Firebase 실시간 동기화 |
| 🖱️ 드래그앤드롭 | 메모→캘린더, 캘린더 아이템 날짜 간 이동, 일정→프로젝트 연결 |
| 🗓️ 공휴일 | Nager.Date API SWR 캐싱 자동 로드 + iCal 수동 추가 지원 |
| 📁 프로젝트 | 이름·기간·색상·카테고리 설정, 달력 기간 배너, 일정 연결 관리 |
| 🗂️ 프로젝트 그룹핑 | 셀 내 `[프로젝트 바 → 연결 일정 → 세부일정]` 묶음 표시 |

---

## 🚀 시작하기 (Firebase 연동)

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트 생성
2. **Realtime Database** 활성화 (테스트 모드)
3. 앱 시작 화면에서 `firebaseConfig` 객체 전체를 붙여넣고 **저장 및 연결** 클릭
4. 이후에는 자동으로 연결 (설정은 `localStorage`에 저장됨)

---

## 🏗️ 프로젝트 구조

```
my_calendar/
├── index.html          # HTML 구조
├── style.css           # 전체 스타일
└── js/
    ├── utils.js        # 전역 상수·상태, 날짜·색상 유틸
    ├── firebase.js     # Firebase 초기화, save(), config UI
    ├── holidays.js     # 공휴일 로드·파싱, localStorage 저장
    ├── calendar.js     # 월간 렌더, 일정 CRUD, 프로젝트 그룹핑, 드래그앤드롭
    ├── week.js         # 주간 렌더, renderAll()
    ├── detail.js       # 상세 패널, 세부일정 CRUD, 복사, 완료 토글
    ├── memo.js         # 메모 패널, 할일 CRUD, 드래그 송신, Firebase 동기화
    └── projects.js     # 프로젝트 CRUD, 일정 연결/해제, 카테고리 관리
```

> 로딩 순서: `utils` → `firebase` → `holidays` → `calendar` → `week` → `detail` → `memo` → `projects`

---

## 📈 향후 로드맵

- [ ] **Multi-User Sync**: Firebase Auth 연동 및 권한 보안 규칙 설정
- [ ] **Data Visualization**: 월별 일정 완료 통계 대시보드 (Chart.js)
- [ ] **PWA 전환**: 서비스 워커를 활용한 오프라인 지원
