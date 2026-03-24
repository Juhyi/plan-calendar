# JS 공부 로드맵 — my_calendar 프로젝트 기준

이 프로젝트 코드를 읽으면서 공부할 JS 개념을 파일별로 정리함.
각 파일 링크를 열면 해당 파일에서 배울 수 있는 개념과 코드 위치가 정리되어 있음.

---

## 추천 공부 순서

| 순서 | 파일 | 줄 수 | 핵심 개념 | 링크 |
|---|---|---|---|---|
| 1 | `utils.js` | 106줄 | 순수 함수, 함수 분리 | [JS_Study_utils.md](JS_Study_utils.md) |
| 2 | `firebase.js` | 352줄 | 비동기, Promise, 실시간 구독 | [JS_Study_firebase.md](JS_Study_firebase.md) |
| 3 | `calendar.js` | 848줄 | DOM 조작, 클로저, 이벤트, 자료구조 | [JS_Study_calendar.md](JS_Study_calendar.md) |
| 4 | `detail.js` | 405줄 | 상태 관리, 폼 입력 처리 | [JS_Study_detail.md](JS_Study_detail.md) |
| 5 | `holidays.js` | 279줄 | async/await, fetch, localStorage 캐싱 | [JS_Study_holidays.md](JS_Study_holidays.md) |
| - | `week.js` | - | calendar.js와 패턴 동일, 3번 이후 참고용 | — |
| - | `projects.js` | 660줄 | calendar.js와 패턴 동일, 3번 이후 참고용 | — |
| - | `nav.js` | 809줄 | 탭 전환 UI, 가장 마지막에 | — |

--- 

## 파일별 한 줄 요약

- **utils.js** — 프로젝트 전체에서 쓰이는 공용 헬퍼 함수 모음. 가장 짧고 독립적이라 시작하기 좋음.
- **firebase.js** — Firebase 연결 및 데이터 구독. 비동기 처리 개념을 실제 코드로 볼 수 있음.
- **calendar.js** — 월간 달력 렌더링 전체. DOM 직접 조작의 교과서적 예제.
- **detail.js** — 일정 클릭 시 열리는 상세 패널. 상태 객체로 UI를 제어하는 패턴.
- **holidays.js** — 공휴일 API 호출 + localStorage 캐싱. fetch와 async/await의 실전 예.