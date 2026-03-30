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

### UTC란?

전 세계가 공통으로 쓰는 기준 시간(협정 세계시).

```
UTC+9  → 한국(KST)  UTC보다 9시간 빠름
UTC+0  → 영국
UTC-5  → 뉴욕

한국 2026-03-25 01:00
UTC  2026-03-24 16:00  ← 9시간 뒤처짐
```

### `toISOString()`이 뭔데?

`Date` 객체를 **ISO 8601 형식**의 문자열로 변환해주는 메서드.

```js
new Date().toISOString()
// → "2026-03-25T15:30:00.000Z"
//            ↑         ↑     ↑
//           날짜      시간   Z = UTC라는 표시
```

`Date` 객체는 내부적으로 항상 UTC 기준 밀리초로 저장되고, `toISOString()`은 그 값을 그대로 문자열로 뽑아줘서 항상 UTC 기준이다.

### 타임존 버그

```js
// 한국 시간 자정 직후(00:30)에 실행하면
new Date().toISOString().slice(0, 10)
// → "2026-03-24"  ❌ 한국은 이미 25일인데 UTC는 아직 24일!
```

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

### `date || new Date()` 패턴

```js
const d = date || new Date();
//  date가 undefined (아무것도 안 넘겼을 때) → falsy → new Date() 사용
//  date가 실제 Date 객체 → truthy → date 그대로 사용
```

`||` 는 비교 연산자가 아니라 **"왼쪽이 falsy면 오른쪽을 써"** 라는 뜻이다.
매개변수가 있으면 그걸 쓰고, 없으면 기본값을 쓰는 패턴.

falsy 값: `false`, `0`, `""`, `null`, `undefined`, `NaN`

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

### UUID 대안이란?

UUID는 `"550e8400-e29b-41d4-a716-446655440000"` 같은 **표준 고유 ID 형식**이야.
완벽한 고유성을 보장하지만 길고 무거워서, 소규모 프로젝트에선 이 패턴처럼 직접 만드는 게 더 가볍고 실용적이야.

| | UUID | `Date.now() + random()` |
|---|---|---|
| 길이 | 36자 | ~20자 |
| 고유성 | 표준 보장 | 실용적 수준 |
| 외부 라이브러리 | 필요할 수 있음 | 불필요 |

**공부 키워드**: `Date.now()`, `Math.random()`, `toString(36)`, UUID 대안

---

## 4. `void` 트릭 — CSS 애니메이션 강제 리셋

**위치**: `showToast` (51~52줄)

```js
if (circle) {
  circle.style.animation = 'none';  // 1. 하던 애니메이션 초기화 (0%로 되감기)
  void circle.offsetWidth;           // 2. 리플로우해! + 반환값은 필요없어!
  circle.style.animation = '';       // 3. 인라인 제거 → CSS로 돌아가 → 처음부터 재생!
}
```

### 왜 이렇게 복잡하게 해야 하냐면

브라우저는 JS 변경사항을 **한꺼번에 모아서** 화면에 반영해.

```js
circle.style.animation = 'none';
circle.style.animation = '';
// 브라우저: "어차피 둘 다 바꾸네? 중간 상태 건너뛰고 최종만 적용!"
// → 애니메이션이 리셋 안 됨 ❌
```

`void circle.offsetWidth` 로 리플로우를 강제해서 `none` 상태를 확정시켜야 함.

### 각 줄의 역할

| 코드 | 역할 |
|---|---|
| `circle.style.animation = 'none'` | 하던 애니메이션 초기화 (0%로 되감기) |
| `offsetWidth` | 리플로우 강제 → none 상태 지금 당장 확정 |
| `void` | 반환값은 필요없어 (의도를 명확히 하는 표시) |
| `circle.style.animation = ''` | 인라인 스타일 제거 → CSS 원래 애니메이션 복구 |

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

### 얕은 복사 (shallow copy)

1단계만 복사하고, 안에 있는 배열/객체는 **주소를 공유**.

```js
const a = { name: '민지', scores: [100, 90] };
const b = { ...a };

b.name = '지수';     // a.name은 그대로 '민지' ✅
b.scores.push(80);  // a.scores도 [100, 90, 80] 으로 바뀜 ❌
//  scores는 주소를 공유해서 둘이 같은 배열을 가리킴
```

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

**공부 키워드**: 스프레드 연산자, 얕은 복사, 구조분해 할당, 불변성, 화살표 함수

---

## 6. `filter → sort → map` 체이닝

**위치**: `hydratePlan` (61~64줄), `getPlansByDate` (69~73줄)

```js
const subs = Object.entries(subTasks)
  .filter(([, s]) => s.parentPlanId === planId)            // 1. 필터링
  .sort(([, a], [, b]) => (a.order || 0) - (b.order || 0)) // 2. 정렬
  .map(([subId, s]) => ({ ...s, subId }));                 // 3. 변환
```

각 배열 메서드는 새 배열을 반환하므로 `.` 으로 이어서 체이닝할 수 있음.

### 각 메서드 역할

**`filter`** — 조건에 맞는 것만 추림. 새 배열 반환.
```js
[1, 2, 3, 4].filter(n => n > 2)  // → [3, 4]
```

**`sort`** — 반환값이 음수면 a가 앞으로. **원본 배열을 직접 바꿈! (주의)**
```js
[3, 1, 2].sort((a, b) => a - b)         // → [1, 2, 3] 원본도 바뀜 ❌
[...[3, 1, 2]].sort((a, b) => a - b)    // → 복사 후 정렬 ✅
```

**`map`** — 모든 요소를 변환. 새 배열 반환.
```js
[1, 2, 3].map(n => n * 2)  // → [2, 4, 6]
```

**`.filter(Boolean)`** — falsy 값 한번에 제거.
```js
[1, null, 2, undefined, 3].filter(Boolean)  // → [1, 2, 3]
```

| 메서드 | 원본 변경 | 반환 |
|---|---|---|
| `filter(fn)` | ❌ | 새 배열 |
| `sort(fn)` | ✅ 변경됨! | 원본 배열 |
| `map(fn)` | ❌ | 새 배열 |

### `map` 에서 subId를 붙이는 이유

`Object.entries` 는 `[key, value]` 를 반환하는데, value 안에는 자기 key가 없음.

```js
['subId_1', { title: '운동', done: false }]
//  ↑ key가 value 안에 없음!
```

그래서 `...s` 로 복사하면서 `subId` 를 직접 붙여줌:
```js
.map(([subId, s]) => ({ ...s, subId }))
// → { title: '운동', done: false, subId: 'subId_1' } ✅
```

**공부 키워드**: 배열 메서드 체이닝, `filter`, `sort`, `map`, `filter(Boolean)`

---

## 7. 16진수 색상 연산 — `parseInt(hex, 16)` & `reduce`

**위치**: `hexToRgb`, `getLuminance` (76~91줄)

```js
function hexToRgb(hex) {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  // "#f76b6b" → slice(1,3)="f7" → parseInt("f7",16) = 247
  //             slice(3,5)="6b" → parseInt("6b",16) = 107
  //             slice(5,7)="6b" → parseInt("6b",16) = 107
  // 결과: [247, 107, 107]
}
```

### `hex.slice(i, i+2)` 로 색상 분리

```
"#f76b6b"
  f7  6b  6b   ← 각각 R, G, B
```

```js
[1, 3, 5].map(i => hex.slice(i, i+2))
// slice(1,3) → "f7"  (R)
// slice(3,5) → "6b"  (G)
// slice(5,7) → "6b"  (B)
```

### `parseInt(문자열, 진수)`

2번째 인자로 진수를 지정. `16` 이면 16진수로 파싱해서 10진수로 반환.

```js
parseInt("f7", 16)   // → 247
parseInt("6b", 16)   // → 107
parseInt("ff", 16)   // → 255
(255).toString(16)   // → "ff"  (반대 방향)
```

### `reduce` 로 하나의 값으로 누산

`reduce(콜백, 초기값)` — 배열을 **하나의 값**으로 만들어줌.

```js
[1, 2, 3].reduce((sum, n) => sum + n, 0)
// sum=0, n=1 → 1
// sum=1, n=2 → 3
// sum=3, n=3 → 6  ✅
```

`getLuminance` 에서는 R·0.2126 + G·0.7152 + B·0.0722 를 누산해서 밝기값 1개를 만듦.
(사람의 눈이 G(초록)에 가장 민감한 것을 반영한 WCAG 표준 공식)

### `[0.2126, 0.7152, 0.0722][i]` 패턴

변수에 담지 않고 **즉석에서 배열 만들고 바로 인덱스로 꺼내는** 패턴.

```js
[0.2126, 0.7152, 0.0722][0]  // → 0.2126  (R 가중치)
[0.2126, 0.7152, 0.0722][1]  // → 0.7152  (G 가중치)
[0.2126, 0.7152, 0.0722][2]  // → 0.0722  (B 가중치)
```

### WCAG 휘도란?

웹 접근성 표준(WCAG)에서 색상이 눈에 얼마나 밝게 보이는지를 0~1로 정의한 것.
텍스트와 배경색의 휘도 차이가 충분해야 읽기 쉬움.

```js
// 흰색 배경 + 노란 글씨 → 휘도 차이 작음 → 읽기 힘듦 ❌
// 흰색 배경 + 검정 글씨 → 휘도 차이 큼  → 읽기 쉬움 ✅
```

### 감마 보정이란?

사람 눈은 밝기를 선형(직선)으로 인식하지 않음.

```
실제 밝기:  0 -------- 128 -------- 255
사람 눈:    어두움 ---- 꽤 밝음 ---- 밝음
// 중간값(128)이 실제론 중간처럼 안 느껴짐!
```

모니터는 색상값을 저장할 때 감마 보정을 적용해서 저장함.
`getLuminance` 에서 이걸 되돌리는 계산을 함:

```js
const linear = c <= 0.03928
  ? c / 12.92                           // 어두운 값은 단순 나누기
  : Math.pow((c + 0.055) / 1.055, 2.4)  // 밝은 값은 지수 함수로 보정
```

**공부 키워드**: `parseInt(hex, 16)`, `reduce`, 감마 보정, WCAG 휘도

---

## 8. 진행률 기반 색상 블렌딩 — 선형 보간

**위치**: `blendColor`, `getItemDisplayColor` (82~101줄)

```js
function blendColor(hex1, hex2, t) {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
  // t=0 이면 hex1, t=1 이면 hex2, t=0.5 이면 정확히 중간색
}
```

### 선형 보간(Lerp) 공식

`r1 + (r2 - r1) * t` — t가 0→1로 커질수록 r1에서 r2로 자연스럽게 전환.

```js
// r1 = 0 (검정), r2 = 100 (흰색)
t=0.0 → 0 + (100 - 0) * 0.0 = 0    // 검정
t=0.5 → 0 + (100 - 0) * 0.5 = 50   // 중간 회색
t=1.0 → 0 + (100 - 0) * 1.0 = 100  // 흰색
```

| t 값 | 결과 색상 |
|---|---|
| `0.0` | 원래 색 (it.color) |
| `0.5` | 원래 색과 완료 색의 중간 |
| `1.0` | 완료 색 (doneColor) |

### 실제 사용 — `getItemDisplayColor`

```js
function getItemDisplayColor(it) {
  const doneColor = (it.category === 'personal') ? '#a29bfe' : '#9b59b6';
  const subs = it.sub || [];
  if (!subs.length) return it.done ? doneColor : it.color;
  const ratio = subs.filter(s => s.done).length / subs.length; // 0.0 ~ 1.0
  return ratio === 0 ? it.color : blendColor(it.color, doneColor, ratio);
}
```

하위 작업 완료 비율(`ratio`)을 t로 넘겨서, 50% 완료면 원래 색과 완료색의 중간색을 표시.

### 삼항 연산자

```js
조건 ? 참일 때 : 거짓일 때

it.done ? doneColor : it.color
// it.done이면 doneColor, 아니면 it.color
```

if문을 한 줄로 줄인 것.

**공부 키워드**: 선형 보간(Lerp), `r1 + (r2 - r1) * t`, 배열 구조분해, 색상 수학, 삼항 연산자
 