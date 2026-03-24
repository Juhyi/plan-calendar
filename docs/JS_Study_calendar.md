# JS 공부 포인트 — calendar.js

calendar.js를 읽으면서 공부하면 좋은 JS 개념 정리.

← 전체 로드맵: [JS_Study_Points.md](JS_Study_Points.md)

---

## 1. DOM 직접 조작

**위치**: `renderMonth` 전체, `mkItemEl`, `mkSpanEl` (102~280줄)

```js
const item = document.createElement('div'); // 메모리에 새 태그 생성
item.className = 'item cat-work';           // 클래스 지정
item.textContent = '내용';                  // 텍스트
item.style.color = 'red';                   // 인라인 스타일
parent.appendChild(item);                   // 실제 화면에 붙이기
```

React, Vue 같은 프레임워크가 내부적으로 하는 일을 직접 손으로 하는 것. 프레임워크 없이 DOM을 이해하는 데 최고의 예제.

| 메서드 | 설명 |
|---|---|
| `createElement('div')` | 빈 태그를 메모리에 생성. 아직 화면에 안 보임 |
| `className = 'item'` | CSS 클래스 지정 |
| `textContent = '출장'` | 태그 안에 텍스트 삽입 |
| `appendChild(item)` | 부모 태그에 붙임. 여기서 비로소 화면에 보임 |
| `innerHTML = ''` | 내부를 통째로 비움. 편하지만 이벤트 리스너가 날아가고 XSS에 취약할 수 있음 |

**공부 키워드**: `createElement`, `appendChild`, `innerHTML`, DOM API

---

## 2. 이벤트 버블링 & stopPropagation

**위치**: `mkItemEl` 내부 (226~227줄)

```js
del.onclick  = e => { e.stopPropagation(); deletePlan(planId); };
item.onclick = e => { e.stopPropagation(); openDetail(planId, ...); };
```

클릭 이벤트는 자식 → 부모 순서로 전파(버블링)됨. `✕` 버튼을 클릭하면 `del.onclick` 실행 후 부모인 `item.onclick`도 연달아 실행됨. `e.stopPropagation()`으로 전파를 막지 않으면 삭제 버튼을 눌렀는데 상세 패널까지 열리는 버그가 생김.

| 개념 | 설명 |
|---|---|
| 이벤트 버블링 | 자식에서 발생한 이벤트가 부모, 조상까지 순서대로 전파되는 현상 |
| `stopPropagation` | 이벤트 전파를 자식 선에서 차단 |
| 이벤트 위임 | 반대로 버블링을 활용해 부모 하나가 자식들의 이벤트를 모아 처리하는 패턴 |

**공부 키워드**: 이벤트 버블링, `stopPropagation`, 이벤트 위임

---

## 3. 클로저 (Closure)

**위치**: `mkItemEl`, `mkSpanEl` (195~280줄)

```js
for (let di = 0; di < 7; di++) {
  const key = dateKey(year, month, d); // 루프마다 새로운 key

  const mkItemEl = (it, planId) => {
    item.onclick = e => { openDetail(planId, ...); }; // 선언 시점의 key를 기억
  };
}
```

함수가 선언된 시점의 바깥 변수(`key`, `cell`)를 기억하는 것이 클로저. 루프 안에서 함수를 만들 때 `var`를 쓰면 모든 함수가 마지막 `key` 값을 공유하는 버그가 생김 → `const/let`을 써야 반복마다 독립적인 값을 가짐.

| 개념 | 설명 |
|---|---|
| 렉시컬 스코프 | 함수를 어디서 **호출**했느냐가 아니라, 어디서 **선언**했느냐에 따라 환경이 결정됨 |
| 메모리 누수 | 클로저가 변수를 계속 붙잡고 있으면 메모리가 해제되지 않음. 안 쓰는 클로저는 정리 필요 |

**공부 키워드**: 클로저, 렉시컬 스코프, `var` vs `let/const`

---

## 4. 해시맵 패턴 (인덱싱으로 성능 최적화)

**위치**: `buildSpanMap`, `buildCompletedSubMap`, `buildPendingSubMap` (17~95줄)

```js
const map = {};
Object.entries(plans).forEach(([planId, plan]) => {
  const dk = plan.date;
  if (!map[dk]) map[dk] = [];
  map[dk].push({ ... });
});
```

전체 데이터를 한 번 순회해서 `{ "날짜": [데이터, ...] }` 구조로 변환해 두면, 이후 셀 렌더링에서 `map["2026-03-24"]`처럼 O(1)로 바로 꺼낼 수 있음. 매 셀마다 전체를 뒤지는 O(N²) 대신 O(N)으로 끝냄.

**공부 키워드**: `Object.entries()`, 해시맵, 시간복잡도 O(N) vs O(N²)

---

## 5. Set / Map — 자료구조 선택 기준

**위치**: `renderColContent` (319줄~, 340줄, 437줄)

```js
// Set: "이미 렌더했는지 체크"
const colRpk = new Set();
if (colRpk.has(planId)) return;
colRpk.add(planId);

// Map: "ID로 데이터를 바로 찾기"
const colProjSet = new Map();
colProjSet.set(Number(p.id), p);
colProjSet.has(id);
```

일반 객체 `{}`는 key가 항상 문자열로 변환되므로 `1`과 `"1"`이 같아짐. `Map`은 key 타입을 그대로 유지하고 삽입 순서도 보장함.

| 상황 | 추천 | 이유 |
|---|---|---|
| 이미 처리했는지 체크만 하면 됨 | `Set` | 중복 방지 + `has()`가 O(1) |
| ID로 데이터를 바로 찾아야 함 | `Map` | key→value 조회에 최적화 |
| 순서대로 화면에 뿌려야 함 | `Array` | 인덱스 순서 보장, 다루기 편함 |

**공부 키워드**: `Set`, `Map`, `Array` 차이, 자료구조 선택 기준

---

## 6. 삼항 연산자 중첩

**위치**: 날짜 숫자 클래스 결정 (143~147줄)

```js
num.className = 'date-num' +
  (isToday(d, month, year) ? ' today-num'   :
   isHol && di !== 0       ? ' holiday-num' :
   di === 0                ? ' sun-num'     :
   di === 6                ? ' sat-num'     : '');
```

if-else 체인을 한 줄 표현식으로 표현하는 패턴. 실무 코드에 자주 등장하지만 조건이 많아지면 가독성이 떨어지므로 3개 이하일 때만 권장.

**공부 키워드**: 삼항 연산자, 조건 표현식

---

## 7. 드래그앤드롭 이벤트

**위치**: 셀 드롭 핸들러 (158~185줄)

```js
cell.addEventListener('dragover', e => {
  e.preventDefault();                      // 필수! 이걸 해야 drop 이벤트가 발생함
  cell.classList.add('drag-over');
});
cell.addEventListener('dragleave', e => {
  if (!cell.contains(e.relatedTarget))     // 자식 요소로 이동한 건 무시 (깜빡임 방지)
    cell.classList.remove('drag-over');
});
cell.addEventListener('drop', e => {
  e.preventDefault();
  const d = JSON.parse(e.dataTransfer.getData('application/x-cal-item'));
});
```

| 포인트 | 설명 |
|---|---|
| `dragover`의 `e.preventDefault()` | 브라우저 기본 동작이 "드롭 거부"이므로 이걸 막아야 `drop` 이벤트가 발생함 |
| `dataTransfer` | 드래그 시작 시점에 데이터를 저장. 객체는 바로 못 넣으므로 `JSON.stringify()` 필수 |
| `contains(relatedTarget)` | 자식 요소로 마우스가 이동할 때도 `dragleave`가 발생해서 스타일이 깜빡이는 문제를 방어 |

**공부 키워드**: HTML5 Drag and Drop API, `dataTransfer`, `e.preventDefault()`
