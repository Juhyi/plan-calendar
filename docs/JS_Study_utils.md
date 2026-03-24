# JS 공부 포인트 — utils.js

utils.js를 읽으면서 공부하면 좋은 JS 개념 정리.

← 전체 로드맵: [JS_Study_Points.md](JS_Study_Points.md)

> 아직 작성 전. utils.js 공부 후 채워넣기.

---

## 예상 공부 포인트

- **순수 함수 (Pure Function)**: 입력이 같으면 항상 같은 출력을 내고, 외부 상태를 바꾸지 않는 함수
- **함수 분리의 이유**: `hydratePlan`, `getItemDisplayColor` 같은 헬퍼가 왜 별도 파일로 분리되어 있는지
- **옵셔널 체이닝 (`?.`)**: `plan?.date` — null/undefined일 때 에러 없이 undefined를 반환
- **기본값 할당 (`||`, `??`)**: `it.category || 'work'` — falsy일 때 기본값을 쓰는 패턴