# React 핵심 기능 구현 문서

React의 핵심 기능을 처음부터 구현하는 프로젝트입니다.

## 목차

| 순서 | 기능 | 문서 |
|---|---|---|
| 1 | Virtual DOM | [01-virtual-dom.md](./01-virtual-dom.md) |
| 2 | Diff Algorithm | [02-diff-algorithm.md](./02-diff-algorithm.md) |
| 3 | Component + 라이프사이클 | [03-component.md](./03-component.md) |
| 4 | State | [04-state.md](./04-state.md) |
| 5 | Hooks | [05-hooks.md](./05-hooks.md) |
| 6 | 렌더 단계 & 커밋 단계 | [06-render-commit-phase.md](./06-render-commit-phase.md) |

## 구현 순서

```
1. createElement + render     ← Virtual DOM 생성 및 렌더링
2. patch                      ← Diff Algorithm으로 최소 DOM 업데이트
3. 함수형 컴포넌트            ← Component 지원
4. useState                   ← State 관리 + 리렌더링
5. useEffect, useRef 등       ← Hooks 확장
```

## 문서 구조

각 문서는 다음 구조를 따릅니다.

- **개념 정리**: 해당 기능이 무엇인지
- **핵심 동작 원리**: 내부적으로 어떻게 동작하는지
- **구현 시 고려할 점**: 직접 구현할 때 주의할 사항
- **참고**: 참고 자료

## 프롬프트 문서

AI 에이전트에게 작업을 요청할 때 바로 재사용할 수 있는 프롬프트 문서입니다.

| 용도 | 문서 |
|---|---|
| 통합 구현 요청 | [implementation-prompt.md](./implementation-prompt.md) |
| 실행용 구현 요청 | [run-implementation-prompt.md](./run-implementation-prompt.md) |
| 코어 런타임 구현 | [core-implementation-prompt.md](./core-implementation-prompt.md) |
| 비트코인 UI 구현 | [bitcoin-ui-prompt.md](./bitcoin-ui-prompt.md) |
| 실시간 데이터 연결 | [realtime-data-connection-prompt.md](./realtime-data-connection-prompt.md) |

---

## AI 에이전트(Claude)와 함께 개발할 때 — 좋은 결과물을 얻는 방법

> 이 섹션은 AI 에이전트에게 개발을 요청할 때 **어떤 문서를 함께 제공하면 좋은지** 설명합니다.
> 문서 작성이 처음이라면 이 가이드를 꼭 읽어보세요.

---

### 왜 문서를 제공해야 하나요?

AI 에이전트는 범용적으로 학습되어 있어서, 아무 맥락 없이 요청하면 **일반적인 React 구현**을 가져오거나 우리 프로젝트 방식과 다른 코드를 생성합니다.

우리가 정의한 VNode 구조, Fiber 설계 방식, hook 인덱스 관리 방법 등을 에이전트가 모르면 전혀 다른 방향의 코드를 만들 수 있습니다.

특히 이 프로젝트는 **기존 React 패키지(`react`, `react-dom`)를 사용하는 프로젝트가 아니라, 우리가 직접 만든 모듈(패키지/라이브러리)만으로 화면을 구현하는 프로젝트**라는 점을 반드시 명시해야 합니다.

**문서 = 에이전트에게 주는 맥락(Context)** 입니다. 맥락이 정확할수록 결과물의 품질이 높아집니다.

---

### 어떤 문서를 어떤 순서로 제공하면 좋은가?

#### 1단계: 항상 제공해야 하는 기본 문서

어떤 기능을 개발하든 아래 두 가지는 **반드시** 같이 제공하세요.

| 문서 | 이유 |
|---|---|
| `docs/README.md` | 전체 프로젝트 구조와 구현 순서를 알려줌 |
| 개발하려는 기능의 `.md` | 해당 기능의 설계 방향과 제약 조건을 알려줌 |

예시: `useState`를 구현하고 싶다면 → `README.md` + `04-state.md` 제공

---

#### 2단계: 의존하는 기능의 문서도 함께 제공

각 기능은 앞 단계 기능에 의존합니다. 예를 들어 `useState`는 Fiber 구조를 알아야 합니다.
아래 의존 관계를 참고해서 관련 문서를 함께 제공하세요.

```
useState 구현 요청 시
  → README.md + 03-component.md(Fiber 구조) + 04-state.md

useEffect 구현 요청 시
  → README.md + 03-component.md + 04-state.md + 05-hooks.md

Diff Algorithm 구현 요청 시
  → README.md + 01-virtual-dom.md + 02-diff-algorithm.md
```

---

#### 3단계: 이미 작성된 코드도 제공

코드가 어느 정도 작성됐다면 **기존 코드 파일도 같이 제공**하세요.
그래야 에이전트가 기존 코드 스타일과 구조에 맞는 코드를 추가해 줍니다.

---

### 프롬프트 작성 요령

좋은 프롬프트는 다음 네 가지를 포함합니다.

```
1. 우리가 뭘 만들고 있는지 (프로젝트 배경)
2. 지금 무엇을 구현하려는지 (현재 태스크)
3. 어떤 제약 조건이 있는지 (설계 방향, 사용할 구조)
4. 어디까지 만들어졌는지 (현재 상태)
```

**나쁜 프롬프트 예시**
```
useState 구현해줘
```

**좋은 프롬프트 예시**
```
우리는 React 핵심 기능을 처음부터 구현하는 프로젝트를 진행 중입니다.

[docs/README.md 내용 붙여넣기]
[docs/03-component.md 내용 붙여넣기]
[docs/04-state.md 내용 붙여넣기]

위 설계 문서를 바탕으로 useState를 구현해 주세요.
- Fiber 노드의 hooks 배열에 상태를 저장하는 방식으로 구현
- hookIndex를 이용한 순서 기반 식별
- setState 호출 시 리렌더 스케줄링 포함
- 함수형 업데이트(prev => next) 지원
- 기존 react/react-dom 패키지는 사용하지 말고, 우리가 직접 만든 런타임만 사용할 것
```

---

### 체크리스트: 개발 요청 전 확인사항

- [ ] `docs/README.md`를 프롬프트에 포함했나요?
- [ ] 구현할 기능의 `.md` 파일을 포함했나요?
- [ ] 의존하는 이전 단계 기능의 `.md` 파일도 포함했나요?
- [ ] 이미 작성된 관련 코드 파일도 포함했나요?
- [ ] 구현 방식의 제약 조건(어떤 구조를 사용해야 하는지)을 명시했나요?
- [ ] 기존 `react`, `react-dom`이 아니라 우리가 만든 모듈만 써야 한다는 점을 명시했나요?

---

### 주의사항

- 문서와 실제 코드가 달라지면 에이전트가 혼란스러워 합니다. **코드를 수정하면 문서도 함께 업데이트**하세요.
- 에이전트가 생성한 코드가 문서의 설계 방향과 다르면, 문서를 다시 제공하며 수정을 요청하세요.
- 한 번에 너무 많은 기능을 요청하면 품질이 떨어집니다. **기능 단위로 나눠서 요청**하세요.
