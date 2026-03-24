# JS 공부 포인트 — holidays.js

holidays.js를 읽으면서 공부하면 좋은 JS 개념 정리.

← 전체 로드맵: [JS_Study_Points.md](JS_Study_Points.md)

> 아직 작성 전. holidays.js 공부 후 채워넣기.

---

## 예상 공부 포인트

- **async / await**: `async function fetchHolidays() { const res = await fetch(...) }` — Promise를 동기처럼 읽기 쉽게 쓰는 문법
- **fetch API**: 브라우저 내장 HTTP 요청 함수. 외부 공휴일 API를 호출하는 데 사용
- **localStorage 캐싱**: 한 번 받아온 데이터를 브라우저에 저장해두고 30일간 재사용 — 불필요한 API 호출을 줄이는 전략
- **TTL (Time To Live)**: 캐시가 유효한 시간. `Date.now()`로 저장 시각을 기록하고, 30일이 지나면 다시 요청
- **JSON.parse / JSON.stringify**: `localStorage`는 문자열만 저장 가능 → 객체를 저장/불러올 때 변환 필요