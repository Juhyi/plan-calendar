# JS 공부 포인트 — firebase.js

firebase.js를 읽으면서 공부하면 좋은 JS 개념 정리.

← 전체 로드맵: [JS_Study_Points.md](JS_Study_Points.md)

---

## 1. 비동기 처리 & `try/catch`

**위치**: `initFirebase` (93~234줄)

```js
function initFirebase(config) {
  try {
    // Firebase 연결, 리스너 등록...
    firebase.initializeApp(config);

  } catch (e) {
    dbgErr('[initFirebase 오류]', e); // 에러 로그 출력
    alert('Firebase 초기화 오류: ' + e.message);
  }
}
```

JS는 기본적으로 한 줄씩 순서대로 실행되지만, 네트워크 요청처럼 시간이 걸리는 작업은 **비동기**로 처리된다. `initFirebase`는 Firebase 서버에 연결을 시도하므로, 설정값이 잘못됐거나 네트워크 문제가 생기면 에러가 발생할 수 있다. `try/catch`로 감싸서 에러가 나도 앱이 멈추지 않게 한다.

### `try/catch` 구조

```js
try {
  // 에러가 날 수 있는 코드
  JSON.parse('잘못된 JSON');  // ← 여기서 에러 발생

} catch (e) {
  // 에러가 나면 여기로 점프
  console.error(e.message);  // e: 에러 객체
} 

// try/catch 이후 코드는 정상 실행됨
```

에러가 `try` 블록 중간에 발생하면 그 아래 코드는 건너뛰고 즉시 `catch`로 이동.

### 에러 객체 `e`

`catch (e)`의 `e`는 에러 정보를 담은 객체.

| 속성 | 설명 | 예시 |
|---|---|---|
| `e.message` | 에러 설명 | `"Unexpected token }"` |
| `e.name` | 에러 종류 | `"SyntaxError"`, `"TypeError"` |
| `e.stack` | 어디서 발생했는지 경로 | 디버깅에 사용 |

### `JSON.stringify(val, null, 2)`

```js
function dbg(label, val) {
  const msg = `${label}: ${typeof val === 'string' ? val : JSON.stringify(val, null, 2)}`;
}
```

`JSON.stringify(값, replacer, 들여쓰기)` — 3번째 인자로 들여쓰기 칸 수 지정.

```js
JSON.stringify({ a: 1, b: 2 })        // → '{"a":1,"b":2}'  (한 줄)
JSON.stringify({ a: 1, b: 2 }, null, 2) // → 보기 좋게 2칸 들여쓰기
// {
//   "a": 1,
//   "b": 2
// }
```

**공부 키워드**: `try/catch`, 에러 객체, `JSON.stringify` 들여쓰기

---

## 2. 실시간 구독 — `.on('value', callback)`

**위치**: `initFirebase` 내부 (113~224줄)

```js
memoRef = db.ref('calendar/memos');

memoRef.on('value', snap => {
  const val = snap.val(); // 서버 현재 데이터
  memos = val || {};
  renderMemos?.();
});
```

Firebase는 **한 번 데이터를 가져오고 끝**이 아니라, 데이터가 바뀔 때마다 콜백을 자동으로 호출해줌. 이를 **실시간 구독(subscription)** 또는 **리스너(listener)** 라고 한다.

```
앱 시작 → .on() 등록 → 서버에서 첫 데이터 전송 → 콜백 실행
                                   ↓
                       누군가 데이터를 바꿈 → 콜백 자동 실행
                                   ↓
                       또 바뀜 → 콜백 자동 실행  (계속 반복)
```

### 콜백 함수란?

"나중에 특정 일이 일어나면 이 함수를 실행해줘" 하고 넘기는 함수.

```js
// 일반 함수 호출: 지금 당장 실행
add(1, 2);

// 콜백: 이벤트가 발생했을 때 Firebase가 대신 호출해줌
memoRef.on('value', snap => {
  // Firebase가 데이터 변경을 감지할 때마다 여기를 호출함
});
```

`.on('value', 콜백)` — `'value'` 이벤트(데이터 변경)가 발생할 때 콜백을 실행.

### `snap.val()`

`snap` — Firebase가 전달해주는 **스냅샷(snapshot)** 객체. 서버 데이터의 현재 상태.
`snap.val()` — 실제 데이터를 꺼내는 메서드. 데이터가 없으면 `null` 반환.

```js
snap.val() || {}
// snap.val()이 null이면 → {} (빈 객체) 사용
```

### `.info/connected` — 연결 상태 감지

```js
db.ref('.info/connected').on('value', snap => {
  if (snap.val()) {
    el.className = 'connected';
  } else {
    el.className = 'disconnected';
  }
});
```

Firebase가 내부적으로 관리하는 특수 경로. 서버 연결이 끊기면 자동으로 `false`가 됨.

**공부 키워드**: 실시간 구독, 콜백 함수, 리스너, `snap.val()`

---

## 3. `Promise` — `.then()` & `.catch()`

**위치**: `savePlans` (243~262줄)

```js
dbRef.set(plans)
  .then(() => {
    st.className = 'connected';
    st.innerHTML = '<span class="dot"></span> 실시간 연결됨';
  })
  .catch(e => {
    st.className = 'disconnected';
    st.innerHTML = '<span class="dot"></span> 저장 실패';
    alert('저장 실패: ' + e.message);
  });
```

`dbRef.set(plans)` 는 서버에 데이터를 저장하는 요청을 보내고 **Promise**를 반환한다.

### Promise란?

"나중에 완료될 작업"을 나타내는 객체. 지금 당장 결과가 없지만, 완료되면 알려줌.

```
Promise 상태:
  pending  → 아직 진행 중
  fulfilled → 성공적으로 완료  → .then() 실행
  rejected  → 실패            → .catch() 실행
```

```js
// 비유: 택배 주문
const 주문 = 택배주문('책');   // Promise 반환 (아직 안 옴)

주문
  .then(택배 => {              // 도착했을 때 실행
    console.log('받았다:', 택배);
  })
  .catch(에러 => {             // 배송 실패했을 때 실행
    console.log('실패:', 에러);
  });

console.log('다른 작업 계속...');  // 택배 기다리지 않고 바로 실행됨
```

### `.then()` 체이닝

`.then()`은 또 다른 Promise를 반환하므로 이어서 체이닝 가능.

```js
fetch('/api/data')
  .then(response => response.json())   // 응답을 JSON으로 변환
  .then(data => console.log(data))     // 변환된 데이터 사용
  .catch(e => console.error(e));       // 어느 단계에서든 에러 처리
```

### `async/await` — Promise를 동기처럼 쓰기

같은 코드를 더 읽기 쉽게 표현하는 방법.

```js
// Promise 방식
dbRef.set(plans)
  .then(() => { /* 성공 */ })
  .catch(e => { /* 실패 */ });

// async/await 방식
async function savePlans() {
  try {
    await dbRef.set(plans);  // 완료될 때까지 기다림
    // 성공 처리
  } catch (e) {
    // 실패 처리
  }
}
```

`await`는 `async` 함수 안에서만 사용 가능.

**공부 키워드**: Promise, `.then()`, `.catch()`, `async/await`

---

## 4. 옵셔널 체이닝 `?.`

**위치**: `initFirebase` (119줄, 163~165줄)

```js
renderMemos?.();          // renderMemos 함수가 있을 때만 호출
renderProjectList?.();    // renderProjectList 함수가 있을 때만 호출

document.getElementById('projDetailPanel')?.classList.contains('open')
// projDetailPanel 요소가 존재할 때만 classList 접근
```

`?.` — 왼쪽이 `null`이나 `undefined`면 에러 없이 `undefined`를 반환. 값이 있으면 이어서 접근.

### `?.` 없이 쓰면

```js
// renderMemos가 undefined인 경우
renderMemos();   // ❌ TypeError: renderMemos is not a function

// 방어 코드를 직접 써야 함
if (renderMemos) renderMemos();   // 번거로움
```

### `?.` 사용 패턴 3가지

```js
// 1. 함수 호출
fn?.()               // fn이 있으면 호출, 없으면 undefined

// 2. 속성 접근
obj?.name            // obj가 있으면 obj.name, 없으면 undefined

// 3. 배열/인덱스
arr?.[0]             // arr가 있으면 arr[0], 없으면 undefined
```

### `??` — null 병합 연산자

`?.`와 자주 함께 쓰이는 연산자. `||`와 비슷하지만 `null`/`undefined`만 체크.

```js
// || 는 falsy(0, "", false, null, undefined) 전부 걸러냄
0 || 'default'         // → 'default'  (0은 유효한 값인데 걸러짐)

// ?? 는 null/undefined만 걸러냄
0 ?? 'default'         // → 0          (0은 유효한 값으로 통과)
null ?? 'default'      // → 'default'
undefined ?? 'default' // → 'default'
```

**공부 키워드**: 옵셔널 체이닝 `?.`, `??`, null 병합 연산자

---

## 5. 정규식 (RegExp)

**위치**: `initFirebase` (208줄), `btnApplyConfig` 핸들러 (283~309줄)

```js
// 구형 데이터인지 확인: 키가 "2026-03-04" 형식인지 체크
if (/^\d{4}-\d{2}-\d{2}$/.test(firstKey)) { ... }

// 입력값에서 { } 블록 추출
const match = raw.match(/\{[\s\S]*\}/);

// trailing comma 제거: { "a": 1, } → { "a": 1 }
s = s.replace(/,(\s*[\}\]])/g, '$1');
```

정규식(Regular Expression) — 문자열의 패턴을 표현하는 문법. `/패턴/플래그` 형태로 씀.

### 자주 쓰는 메타 문자

| 패턴 | 의미 | 예시 |
|---|---|---|
| `\d` | 숫자 하나 (0~9) | `\d\d` → "12" 매칭 |
| `\s` | 공백 문자 (스페이스, 탭, 줄바꿈) | |
| `\S` | 공백이 아닌 문자 | |
| `.` | 줄바꿈 제외 아무 문자 하나 | |
| `[\s\S]` | 줄바꿈 **포함** 모든 문자 | |
| `{2}` | 앞 패턴이 정확히 2번 반복 | `\d{4}` → "2026" |
| `*` | 0번 이상 반복 | `\d*` → "", "1", "123" |
| `^` | 문자열 시작 | `^\d` → 숫자로 시작 |
| `$` | 문자열 끝 | `\d$` → 숫자로 끝 |

### `.test()` — 패턴이 있는지 확인

```js
/^\d{4}-\d{2}-\d{2}$/.test('2026-03-04')  // → true
/^\d{4}-\d{2}-\d{2}$/.test('plan_abc123') // → false
```

`^`(시작)와 `$`(끝)을 함께 쓰면 전체 문자열이 패턴과 일치해야 함.

### `.match()` — 패턴과 일치하는 부분 추출

```js
const raw = '어쩌구 { "apiKey": "abc" } 저쩌구';
const match = raw.match(/\{[\s\S]*\}/);
// match[0] → '{ "apiKey": "abc" }'
// 매칭 안 되면 null 반환
```

`\{` / `\}` — `{` `}`는 정규식에서 특수문자라 `\`로 이스케이프해야 리터럴로 인식.

### `.replace()` — 패턴과 일치하는 부분 치환

```js
// 플래그 g: 전체에서 전부 치환 (없으면 첫 번째만)
// 플래그 m: 여러 줄 모드 (^$가 각 줄의 시작/끝에 매칭)

// trailing comma 제거
s = s.replace(/,(\s*[\}\]])/g, '$1');
//                ↑           ↑
//       ( )로 캡처         $1로 참조 (캡처한 내용을 그대로 씀)

// "abc,   }" → ",   }" 부분이 매칭
// $1 = "   }"  → 콤마 없이 "   }"로 교체
```

**공부 키워드**: 정규식, `test()`, `match()`, `replace()`, 캡처 그룹 `()`

---

## 6. `localStorage` — 브라우저 저장소

**위치**: `btnApplyConfig` 핸들러 (326줄), 자동 로드 (346~353줄)

```js
// 저장
localStorage.setItem('fbConfig', JSON.stringify(cfg));

// 불러오기
const saved = localStorage.getItem('fbConfig');
if (saved) {
  initFirebase(JSON.parse(saved));
}
```

브라우저가 제공하는 **영구 저장소**. 탭을 닫거나 페이지를 새로고침해도 데이터가 유지됨.
이 코드에서는 Firebase 설정을 저장해 두고, 다음 방문 시 자동으로 연결하는 데 사용.

### 주요 메서드

| 메서드 | 설명 |
|---|---|
| `localStorage.setItem(key, value)` | 저장 (값은 반드시 **문자열**이어야 함) |
| `localStorage.getItem(key)` | 불러오기 (없으면 `null` 반환) |
| `localStorage.removeItem(key)` | 삭제 |
| `localStorage.clear()` | 전체 삭제 |

### 객체를 저장할 때는 `JSON.stringify` 필수

`localStorage`는 문자열만 저장할 수 있어서, 객체는 문자열로 변환해야 함.

```js
const cfg = { apiKey: 'abc', projectId: 'my-app' };

// 저장: 객체 → 문자열
localStorage.setItem('fbConfig', JSON.stringify(cfg));
// 실제 저장된 값: '{"apiKey":"abc","projectId":"my-app"}'

// 불러오기: 문자열 → 객체
const saved = localStorage.getItem('fbConfig');  // → 문자열
const config = JSON.parse(saved);                // → 객체
```

### `sessionStorage` 와의 차이

| | `localStorage` | `sessionStorage` |
|---|---|---|
| 유지 기간 | 영구 (직접 삭제 전까지) | 탭/창 닫으면 삭제 |
| 공유 범위 | 같은 도메인 전체 | 탭 하나 안에서만 |

**공부 키워드**: `localStorage`, `setItem`, `getItem`, `JSON.stringify/parse`

---

## 7. `JSON.parse` — JS 객체로 변환

**위치**: `btnApplyConfig` 핸들러 (287~320줄)

```js
let s = match[0]; // 추출한 { } 문자열

// JS → JSON으로 바꾸는 전처리 작업들...
s = s.replace(/[\x00-\x08...]/g, '');     // 제어문자 제거
s = s.replace(/,(\s*[\}\]])/g, '$1');     // trailing comma 제거
s = s.replace(/([{,]\s*)([a-zA-Z_]\w*)\s*:/g, '$1"$2":'); // 키에 따옴표 추가

const cfg = JSON.parse(s); // 최종 파싱
```

Firebase 설정은 JS 객체 형식으로 복사되는데, JSON과 미묘하게 다르다. 그래서 직접 파싱하기 전에 여러 전처리를 해야 한다.

### JS 객체 vs JSON 차이

```js
// JS 객체 (Firebase 콘솔에서 복사한 형식)
{
  apiKey: "abc",        // 키에 따옴표 없음
  projectId: "my-app",  // trailing comma 있음
  // 주석도 가능
}

// JSON (엄격한 형식)
{
  "apiKey": "abc",      // 키에 따옴표 필수
  "projectId": "my-app" // trailing comma 불허
                        // 주석 불허
}
```

### `JSON.parse`가 실패하는 주요 원인

| 원인 | 예시 | 해결 |
|---|---|---|
| 키에 따옴표 없음 | `{ apiKey: "abc" }` | 정규식으로 추가 |
| trailing comma | `{ "a": 1, }` | 정규식으로 제거 |
| 주석 포함 | `// 설명` | 정규식으로 제거 |
| 숨은 제어문자 | 복붙 시 섞여들어오는 특수문자 | charCode 검사 후 제거 |

### 키에 따옴표 추가하는 정규식

```js
s = s.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
```

```
{ apiKey: "abc", projectId: "xyz" }
  ↓
{ "apiKey": "abc", "projectId": "xyz" }
```

`$1` — `{` 또는 `,` (앞 문맥 보존)
`$2` — 키 이름 (따옴표 없는 식별자)

**공부 키워드**: `JSON.parse`, JSON vs JS 객체, trailing comma, 정규식 전처리

---

## 8. 데이터 마이그레이션 패턴

**위치**: `migrateOldPlans` (42~86줄), 일정 수신 리스너 (206~216줄)

```js
// 구형 구조 감지: 첫 번째 키가 날짜 형식인지 확인
const firstKey = Object.keys(plans)[0];
if (firstKey && /^\d{4}-\d{2}-\d{2}$/.test(firstKey)) {
  const { newPlans, newSubTasks, changed } = migrateOldPlans(plans);
  if (changed) {
    dbRef.set(plans);        // 변환된 데이터를 서버에 덮어씀
    subTaskRef.set(subTasks);
  }
}
```

앱이 업데이트되면서 데이터 구조가 바뀔 때, 기존 사용자의 데이터를 새 구조로 자동 변환하는 패턴.

### 구형 → 신형 구조 변환

```js
// 구형: 날짜가 키
{
  "2026-03-04": [
    { text: '운동', sub: [...] },
    { text: '회의' }
  ]
}

// 신형: 고유 ID가 키
{
  "plan_abc123": { date: "2026-03-04", text: "운동", ... },
  "plan_def456": { date: "2026-03-04", text: "회의", ... }
}
```

ID 기반 구조로 바꾸면 특정 일정 하나를 수정/삭제할 때 해당 ID만 건드리면 되므로 훨씬 안전.

### `changed` 플래그 패턴

```js
function migrateOldPlans(oldPlans) {
  let changed = false; // 실제로 변환이 일어났는지 추적

  Object.entries(oldPlans).forEach(([key, items]) => {
    if (!Array.isArray(items)) return; // 신형이면 건너뜀
    changed = true;                    // 구형 발견 → 변환 발생
    // 변환 작업...
  });

  return { newPlans, newSubTasks, changed };
}

// 호출부에서 changed로 실제 변환 여부 확인 후 서버 저장
if (changed) {
  dbRef.set(plans); // 변환된 경우에만 서버에 씀 (불필요한 쓰기 방지)
}
```

`changed` 플래그로 "실제로 바뀐 게 있을 때만 저장"하는 패턴. 불필요한 DB 쓰기를 막아줌.

### 구조분해로 여러 값 한번에 반환

```js
// 여러 값을 객체에 담아 반환
return { newPlans, newSubTasks, changed };

// 호출부에서 구조분해로 꺼내기
const { newPlans, newSubTasks, changed } = migrateOldPlans(plans);
```

JS 함수는 값을 하나만 반환할 수 있어서, 여러 값을 돌려줄 때 객체에 담아서 반환하는 패턴.

**공부 키워드**: 데이터 마이그레이션, `changed` 플래그, 객체 반환 + 구조분해
