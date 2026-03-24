# JS 공부 포인트 — firebase.js

firebase.js를 읽으면서 공부하면 좋은 JS 개념 정리.

← 전체 로드맵: [JS_Study_Points.md](JS_Study_Points.md)

> 아직 작성 전. firebase.js 공부 후 채워넣기.

---

## 예상 공부 포인트

- **비동기 처리**: JS는 기본적으로 한 줄씩 실행되지만, DB 요청은 기다리는 동안 다른 코드가 계속 실행됨
- **콜백 함수**: `.on('value', callback)` — 데이터가 바뀔 때마다 호출되는 함수를 넘기는 패턴
- **Promise & `.then/.catch`**: `savePlans().then(...).catch(...)` — 비동기 작업의 성공/실패 처리
- **실시간 구독**: 한 번 요청하고 끝나는 게 아니라, 변경될 때마다 자동으로 알림을 받는 구조
- **중복 초기화 방지**: `firebase.apps.length` 체크 — 이미 초기화된 앱을 또 초기화하면 에러가 남