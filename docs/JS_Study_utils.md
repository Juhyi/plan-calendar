# JS 공부 포인트 — utils.js

utils.js를 읽으면서 공부하면 좋은 JS 개념 정리.

← 전체 로드맵: [JS_Study_Points.md](JS_Study_Points.md)

---
## 1. 문자열 패딩 — `padStart`

**위치**: `dateKey`, `localDateStr` (24~31줄)

```js
function dateKey(y, m, d) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
// 결과: dateKey(2026, 2, 5) → "2026-03-05"
//                               ↑ m+1을 해야 실제 월 (Date의 month는 0부터 시작)
```

`padStart(자릿수, 채울문자)` — 문자열이 지정한 자릿수보다 짧으면 앞쪽을 채운다.
날짜를 `"2026-3-5"` 대신 `"2026-03-05"`로 맞춰야 문자열 정렬(사전순)과 날짜 정렬이 일치해서 비교가 정확해짐.

| 호출 | 결과 |
|---|---|
| `String(5).padStart(2, '0')` | `"05"` |
| `String(12).padStart(2, '0')` | `"12"` (이미 2자리라 그대로) |
| `'hi'.padStart(5, '*')` | `"***hi"` |

---

### `padEnd`

`padStart`의 반대. 문자열이 짧으면 **뒤쪽**을 채운다.

```js
'hi'.padEnd(5, '.')       // → "hi..."
String(5).padEnd(3, '0')  // → "500"
'hello'.padEnd(3, 'x')    // → "hello"  (이미 길면 그대로)
```

텍스트를 표 형태로 정렬할 때 유용하다.

```js
'이름'.padEnd(10, ' ')  // → "이름        "
'나이'.padEnd(10, ' ')  // → "나이        "
```

---

### 템플릿 리터럴

백틱(`` ` ``)으로 감싸는 문자열. 두 가지가 핵심이다.

**1. 문자열 안에 변수/표현식 삽입 — `${}`**

```js
const name = '민지';
const age = 20;

// 기존 방식
'안녕 ' + name + '! 나이는 ' + age + '살이야';

// 템플릿 리터럴
`안녕 ${name}! 나이는 ${age}살이야`;

// ${} 안에는 표현식도 가능
`내년엔 ${age + 1}살이네`;
`${1 === 1 ? '맞아' : '틀려'}`;  // → "맞아"
```

**2. 줄바꿈을 그대로 표현**

```js
// 기존 방식
'1줄\n2줄\n3줄';

// 템플릿 리터럴 — 실제 줄바꿈 그대로 써도 됨
`1줄
2줄
3줄`;
```

---

**공부 키워드**: `padStart`, `padEnd`, 템플릿 리터럴, `Date`의 0-based month

---

## 2. UTC vs 로컬 시간 — `toISOString()` 함정

**위치**: `localDateStr` (28~31줄)

```js
// ❌ 이렇게 하면 KST에서 날짜가 하루 밀릴 수 있음
const wrong = new Date().toISOString().slice(0, 10); // UTC 기준

// ✅ utils.js의 방식: 로컬 시간 기준으로 직접 조립
function localDateStr(date) {
  const d = date || new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
```

`toISOString()`은 항상 UTC 기준으로 반환한다. 한국(UTC+9)에서 2026-03-25 00:30에 실행하면 UTC는 아직 2026-03-24이므로 날짜가 하루 빠지는 버그가 생김.
`getFullYear()`, `getMonth()`, `getDate()`는 로컬 타임존 기준이라 안전.

| 메서드 | 기준 |
|---|---|
| `toISOString()` | UTC |
| `getFullYear()` / `getMonth()` / `getDate()` | 로컬 타임존 |
| `toLocaleDateString()` | 로컬 타임존 (출력 형식은 브라우저마다 다름) |

---

### UTC란?

전 세계가 공통으로 쓰는 기준 시간(협정 세계시).

```
UTC+9  → 한국(KST)  UTC보다 9시간 빠름
UTC+0  → 영국
UTC-5  → 뉴욕

한국 2026-03-25 01:00
UTC  2026-03-24 16:00  ← 9시간 뒤처짐
```

---

### `toISOString()`이 뭔데?

`Date` 객체를 **ISO 8601 형식**의 문자열로 변환해주는 메서드.

```js
new Date().toISOString()
// → "2026-03-25T15:30:00.000Z"
//            ↑         ↑     ↑
//           날짜      시간   Z = UTC라는 표시
```

`Date` 객체는 내부적으로 항상 UTC 기준 밀리초로 저장되고, `toISOString()`은 그 값을 그대로 문자열로 뽑아줘서 항상 UTC 기준이다.

---

### 타임존 버그

```js
// 한국 시간 자정 직후(00:30)에 실행하면
new Date().toISOString().slice(0, 10)
// → "2026-03-24"  ❌ 한국은 이미 25일인데 UTC는 아직 24일!
```

---

### Date 메서드 전체 비교

| 메서드 | 기준 | 예시 결과 |
|---|---|---|
| `getFullYear()` | 로컬 | `2026` |
| `getMonth()` | 로컬 | `2` (3월인데 0-based!) |
| `getDate()` | 로컬 | `25` |
| `getHours()` | 로컬 | `0` |
| `getUTCFullYear()` | UTC | `2026` |
| `getUTCDate()` | UTC | `24` ← 다를 수 있음! |
| `toISOString()` | UTC | `"2026-03-24T15:30:00.000Z"` |

`get날짜()` 는 로컬 기준, `getUTC날짜()` 는 UTC 기준이다.

---

### `date || new Date()` 패턴

```js
const d = date || new Date();
//  date가 undefined (아무것도 안 넘겼을 때) → falsy → new Date() 사용
//  date가 실제 Date 객체 → truthy → date 그대로 사용
```

`||` 는 비교 연산자가 아니라 **"왼쪽이 falsy면 오른쪽을 써"** 라는 뜻이다.
매개변수가 있으면 그걸 쓰고, 없으면 기본값을 쓰는 패턴.

falsy 값: `false`, `0`, `""`, `null`, `undefined`, `NaN`

---

**공부 키워드**: UTC, `toISOString`, 타임존 버그, `Date` 메서드, `||` 단락 평가

---

## 3. 고유 ID 생성 패턴 — `Date.now()` + `Math.random()`

**위치**: `newPlanId`, `newSubId` (37~38줄)

```js
function newPlanId() {
  return 'plan_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}
// 결과 예시: "plan_1742860012345_k3f9"
```

`Date.now()` — 밀리초 단위 유닉스 타임스탬프. 같은 밀리초에 두 번 호출하면 겹침.

`Math.random().toString(36).slice(2,6)` — 0~1 사이 난수를 36진수(0-9a-z)로 바꿔서 앞 두 자리(`"0."`) 제거, 4자리 랜덤 문자열로 사용. 조합하면 충돌 확률이 매우 낮아짐.

| 표현식 | 설명 |
|---|---|
| `Date.now()` | 현재 시각 (ms). `new Date().getTime()`과 동일 |
| `Math.random()` | 0 이상 1 미만 난수 |
| `.toString(36)` | 36진수 문자열로 변환 (0~9, a~z) |
| `.slice(2, 6)` | `"0.k3f9..."` 에서 `"0."` 제거 후 4자만 사용 |

---

### UUID 대안이란?

UUID는 `"550e8400-e29b-41d4-a716-446655440000"` 같은 **표준 고유 ID 형식**이야.
완벽한 고유성을 보장하지만 길고 무거워서, 소규모 프로젝트에선 이 패턴처럼 직접 만드는 게 더 가볍고 실용적이야.

| | UUID | `Date.now() + random()` |
|---|---|---|
| 길이 | 36자 | ~20자 |
| 고유성 | 표준 보장 | 실용적 수준 |
| 외부 라이브러리 | 필요할 수 있음 | 불필요 |

---

**공부 키워드**: `Date.now()`, `Math.random()`, `toString(36)`, UUID 대안

---

## 4. `void 0` 트릭 — CSS 애니메이션 강제 리셋

**위치**: `showToast` (51~52줄)

```js
if (circle) {
  circle.style.animation = 'none';  // 1. 하던 애니메이션 초기화 (0%로 되감기)
  void circle.offsetWidth;           // 2. 리플로우해! + 반환값은 필요없어!
  circle.style.animation = '';       // 3. 인라인 제거 → CSS로 돌아가 → 처음부터 재생!
}
```

---

### 왜 이렇게 복잡하게 해야 하냐면

브라우저는 JS 변경사항을 **한꺼번에 모아서** 화면에 반영해.

```js
circle.style.animation = 'none';
circle.style.animation = '';
// 브라우저: "어차피 둘 다 바꾸네? 중간 상태 건너뛰고 최종만 적용!"
// → 애니메이션이 리셋 안 됨 ❌
```

`void circle.offsetWidth` 로 리플로우를 강제해서 `none` 상태를 확정시켜야 함.

---

### 각 줄의 역할

| 코드 | 역할 |
|---|---|
| `circle.style.animation = 'none'` | 하던 애니메이션 초기화 (0%로 되감기) |
| `offsetWidth` | 리플로우 강제 → none 상태 지금 당장 확정 |
| `void` | 반환값은 필요없어 (의도를 명확히 하는 표시) |
| `circle.style.animation = ''` | 인라인 스타일 제거 → CSS 원래 애니메이션 복구 |

---

### 인라인 스타일이란?

CSS를 적용하는 방법 3가지:

```css
/* 1. CSS 파일 */
.circle { animation: spin 1s infinite; }
```
```html
<!-- 2. style 태그 -->
<style>.circle { animation: spin 1s infinite; }</style>

<!-- 3. 인라인 — 태그에 직접 or JS로 element.style 건드리는 것 -->
<div style="animation: spin 1s infinite;">
```

우선순위: **인라인 > style 태그 > CSS 파일**

인라인이 가장 강해서 CSS 파일을 덮어씀. `animation = ''` 로 인라인을 지우면 CSS 파일 스타일이 다시 살아남.

---

### 리플로우란?

브라우저가 **모든 요소의 크기와 위치를 다시 계산**하는 작업.

```
요소 하나 바뀜
    ↓
부모, 자식, 형제 요소들까지 전부 다시 계산
    ↓
화면 전체 다시 그림
```

연쇄적으로 전체가 영향받아서 비싼 연산. 의도적으로 쓸 때만 써야 함.

---

**공부 키워드**: `void`, 리플로우, CSS 애니메이션 리셋, `offsetWidth`, 인라인 스타일
---

## 5. 스프레드 연산자와 불변 객체 복사

**위치**: `hydratePlan` (58~66줄)

```js
function hydratePlan(planId) {
  const plan = plans[planId];
  if (!plan) return null;

  const subs = Object.entries(subTasks)
    .filter(([, s]) => s.parentPlanId === planId)   // 구조분해: [key, value] → key 무시
    .sort(([, a], [, b]) => (a.order || 0) - (b.order || 0))
    .map(([subId, s]) => ({ ...s, subId }));         // 원본 s에 subId 필드 추가

  return { ...plan, planId, sub: subs };              // 원본 plan + 추가 필드
}
```

---

### 스프레드 연산자 `...`

객체를 펼쳐서 복사. 원본은 건드리지 않아 → **불변성** 유지.

```js
const plan = { title: '운동', color: '#ff0000' };

{ ...plan }                     // → { title: '운동', color: '#ff0000' }
{ ...plan, planId: 'plan_1' }  // → { title: '운동', color: '#ff0000', planId: 'plan_1' }
```

같은 키가 겹치면 **나중에 오는 게 덮어써**.

```js
const a = { x: 1, y: 2 };
{ ...a, y: 99 }  // → { x: 1, y: 99 }  a의 y:2가 y:99로 덮어써짐
{ y: 99, ...a }  // → { x: 1, y: 2 }   a의 y:2가 y:99를 덮어써짐
```

순서가 중요!

---

### 얕은 복사 (shallow copy)

1단계만 복사하고, 안에 있는 배열/객체는 **주소를 공유**.

```js
const a = { name: '민지', scores: [100, 90] };
const b = { ...a };

b.name = '지수';     // a.name은 그대로 '민지' ✅
b.scores.push(80);  // a.scores도 [100, 90, 80] 으로 바뀜 ❌
//  scores는 주소를 공유해서 둘이 같은 배열을 가리킴
```

---

### 배열 구조분해 — `[, s]`

```js
const arr = ['hello', 'world'];
const [, b] = arr;  // 첫 번째 무시, b → 'world'
```

`Object.entries(subTasks)` 는 `[key, value]` 배열을 반환하는데, key가 필요없을 때:

```js
.filter(([, s]) => s.parentPlanId === planId)
//        ↑  ↑
//    key무시  value만 사용
```

---

### 화살표 함수 `=>`

함수를 짧게 쓰는 방법.

```js
// 기존 함수
function add(a, b) { return a + b; }

// 화살표 함수
const add = (a, b) => a + b;
```

| 패턴 | 의미 |
|---|---|
| `{ ...obj }` | 얕은 복사 |
| `{ ...obj, key: val }` | 복사하면서 필드 추가/덮어쓰기 |
| `[, s]` 구조분해 | 첫 번째 요소 무시하고 두 번째만 사용 |

--- 

**공부 키워드**: 스프레드 연산자, 얕은 복사, 구조분해 할당, 불변성, 화살표 함수
---

## 6. `filter → sort → map` 체이닝

**위치**: `hydratePlan` (61~64줄), `getPlansByDate` (69~73줄)

```js
// hydratePlan 안에서
const subs = Object.entries(subTasks)
  .filter(([, s]) => s.parentPlanId === planId)           // 필터링
  .sort(([, a], [, b]) => (a.order || 0) - (b.order || 0)) // 정렬
  .map(([subId, s]) => ({ ...s, subId }));                // 변환

// getPlansByDate
return Object.keys(plans)
  .filter(pid => plans[pid].date === dateKey && ...)      // 날짜 필터
  .map(pid => hydratePlan(pid))                           // 각 ID를 객체로 변환
  .filter(Boolean);                                       // null 제거
```

각 배열 메서드는 새 배열을 반환하므로 `.`으로 이어서 체이닝할 수 있음.
`.filter(Boolean)` 은 falsy 값(`null`, `undefined`, `0`, `""`)을 한 번에 제거하는 관용구.

| 메서드 | 역할 | 반환 |
|---|---|---|
| `filter(fn)` | 조건에 맞는 요소만 추림 | 새 배열 |
| `sort(fn)` | `fn(a,b)` 반환값이 음수면 a를 앞으로 | 원본 배열 (주의: 원본 변경!) |
| `map(fn)` | 모든 요소를 변환 | 새 배열 |
| `filter(Boolean)` | null/undefined/0/"" 제거 | 새 배열 |

**공부 키워드**: 배열 메서드 체이닝, `filter`, `sort`, `map`, `filter(Boolean)`

---

## 7. 16진수 색상 연산 — `parseInt(hex, 16)` & `reduce`

**위치**: `hexToRgb`, `getLuminance` (76~91줄)

```js
function hexToRgb(hex) {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  //  "#f76b6b" → slice(1,3)="f7" → parseInt("f7",16) = 247
  //              slice(3,5)="6b" → parseInt("6b",16) = 107
  //              slice(5,7)="6b" → parseInt("6b",16) = 107
  //  결과: [247, 107, 107]
}

function getLuminance(hex) {
  return hexToRgb(hex).reduce((sum, v, i) => {
    const c = v / 255;   // 0~1 범위로 정규화
    const linear = c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); // 감마 보정
    return sum + linear * [0.2126, 0.7152, 0.0722][i]; // R·0.2126 + G·0.7152 + B·0.0722
  }, 0);
}
```

`parseInt(문자열, 진수)` — 2번째 인자로 진수를 지정. `16`이면 16진수 파싱.
`reduce(콜백, 초기값)` — 배열을 하나의 값으로 누산. `sum`에 계속 더해 최종 밝기값 1개를 만듦.
`getLuminance`는 WCAG(웹 접근성) 표준에서 정의한 상대 휘도 공식으로, 사람의 눈이 G(초록)에 가장 민감한 것을 반영해 가중치가 다름.

| 표현식 | 설명 |
|---|---|
| `parseInt("ff", 16)` | `255` — 16진수 ff를 10진수로 변환 |
| `v.toString(16)` | `255` → `"ff"` — 반대 방향 |
| `reduce((acc, cur) => ..., 초기값)` | 배열을 단일 값으로 누산 |
| `[0.2126, 0.7152, 0.0722][i]` | 인덱스로 가중치를 즉시 꺼내는 패턴 |

**공부 키워드**: `parseInt(hex, 16)`, `reduce`, 감마 보정, WCAG 휘도

---

## 8. 진행률 기반 색상 블렌딩 — 선형 보간

**위치**: `blendColor`, `getItemDisplayColor` (82~101줄)

```js
function blendColor(hex1, hex2, t) {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
  //  t=0 이면 hex1, t=1 이면 hex2, t=0.5 이면 정확히 중간색
}

function getItemDisplayColor(it) {
  const doneColor = (it.category === 'personal') ? '#a29bfe' : '#9b59b6';
  const subs = it.sub || [];
  if (!subs.length) return it.done ? doneColor : it.color;
  const ratio = subs.filter(s => s.done).length / subs.length; // 0.0 ~ 1.0
  return ratio === 0 ? it.color : blendColor(it.color, doneColor, ratio);
}
```

`r1 + (r2 - r1) * t` 는 선형 보간(Lerp) 공식. t가 0→1로 커질수록 r1에서 r2로 자연스럽게 전환.
하위 작업 완료 비율(`ratio`)을 t로 넘겨서, 50% 완료면 원래 색과 완료색의 중간색을 표시함.

| t 값 | 결과 색상 |
|---|---|
| `0.0` | 원래 색 (it.color) |
| `0.5` | 원래 색과 완료 색의 중간 |
| `1.0` | 완료 색 (doneColor) |

**공부 키워드**: 선형 보간(Lerp), `r1 + (r2 - r1) * t`, 배열 구조분해, 색상 수학
