# 발표 예상 질문

현재 프로젝트 구현 기준으로 자주 받을 수 있는 질문과 답변을 정리한 문서입니다.
발표 중 바로 말하기 쉽게, 답변은 짧게 유지하고 필요한 보충 포인트만 함께 붙였습니다.

## 1. 실시간 차트 움직임은 `useState`로 상태를 바꾸고 전체 렌더를 다시 하나요, 아니면 DOM 스타일을 직접 바꾸나요?

**답변**

우리 쪽은 `useState`로 상태를 바꾸고, 상태 변경 시 커스텀 렌더러가 이전 Virtual DOM과 새 Virtual DOM을 비교한 뒤 변경된 부분만 `patch()`해서 실제 DOM/SVG를 갱신합니다. 직접 DOM 스타일을 손으로 조작하는 방식은 아닙니다.

**보충 포인트**

- 차트는 `chartState.candles` 또는 `market.candles`가 바뀌면 다시 계산됩니다.
- 화면 반영은 `patch()`가 담당합니다.

## 2. 상태가 자주 바뀌는 실시간 화면에서 DOM 직접 조작보다 state 중심 관리가 더 좋은 이유는?

**답변**

상태를 중심으로 관리하면 화면 로직이 일관되고 예측 가능해집니다. 데이터 변화가 곧 화면 변화로 이어지므로, 복잡한 DOM 조작 코드 대신 상태 흐름만 보면 됩니다.

**핵심 한 줄**

> 상태가 자주 바뀌는 실시간 화면일수록, DOM 직접 조작보다 state 중심으로 UI를 일관되게 관리할 수 있다는 점이 가장 큰 장점입니다.

## 3. 이게 React가 주는 장점인가요?

**답변**

네. 상태 중심으로 UI를 일관되게 관리하는 것 자체가 React의 핵심 장점 중 하나입니다. 특히 실시간 업데이트가 많은 화면에서는 유지보수성과 안정성 측면에서 유리합니다.

## 4. `useEffect`로 WebSocket을 관리할 때 cleanup을 빼먹으면 무슨 문제가 생기나요?

**답변**

이전 연결이 계속 남아 있어서 메모리 누수, 중복 이벤트 수신, mock 전환 불안정 등이 생깁니다. 그래서 deps 변경이나 언마운트 시 socket disconnect와 timer clear가 필요합니다.

**보충 포인트**

- live와 mock이 동시에 상태를 바꾸는 충돌이 날 수 있습니다.
- reconnect 로직이 중복으로 살아남을 수도 있습니다.

## 5. `useMemo`에 deps를 빠뜨리면 차트 계산에 어떤 문제가 생기나요?

**답변**

최신 데이터가 와도 재계산이 안 돼서 차트가 과거 값으로 유지될 수 있습니다. 반대로 deps를 잘못 지정하면 매번 다시 계산해서 성능이 떨어질 수 있습니다.

**현재 프로젝트 기준**

- `useMemo`는 `buildChartMeta()` 계산 결과를 캐싱하는 데 사용합니다.
- range, 좌표, 이동평균선 같은 파생 데이터가 여기에 포함됩니다.

## 6. 루트 `App`에서만 상태를 관리하는 설계가 실시간 데이터 앱에 적절한 이유는?

**답변**

상태 분산이 적어지면 동기화가 쉬워지고, 여러 컴포넌트가 같은 데이터를 다루는 동안 충돌을 줄일 수 있습니다. 다만 앱이 커지면 루트가 무거워질 수 있으니 확장 시 구조를 다시 고민해야 합니다.

**현재 프로젝트 기준**

- `market`
- `chartState`
- `selectedInterval`
- `movingAverageInputs`
- `appliedMovingAveragePeriods`

이 상태들이 모두 루트 `App`에 있습니다.

## 7. SVG 차트에서 `key`를 제대로 주지 않으면 어떤 문제가 생기나요?

**답변**

반복 요소가 인덱스 기준으로 비교돼서 요소가 불필요하게 교체될 수 있습니다. 결과적으로 렌더 효율이 떨어지고, 좌표 이동이 더 부자연스럽게 보일 수 있습니다.

**주의**

현재 구현은 전체 candle 배열 기준으로 차트 메타를 다시 계산하기 때문에, `key` 안정성은 여전히 중요한 포인트입니다.

## 8. 라이브 피드 실패 시 mock 데이터 전환을 안전하게 처리하려면 무엇을 확인해야 하나요?

**답변**

기존 WebSocket이 완전히 닫혔는지, 이전 타이머가 정리됐는지를 확인해야 합니다. 그렇지 않으면 live와 mock이 동시에 상태를 바꾸는 충돌이 발생할 수 있습니다.

## 9. `market` 상태와 `chartState`를 분리할 때 동기화 문제를 어떻게 예방해야 하나요?

**답변**

각 상태의 책임을 명확히 하고, `1s` 차트는 `market.candles`를 그대로 반영하며, 다른 interval은 별도 feed로 처리하는 식으로 분리합니다. 필요한 경우 한 상태를 다른 상태의 파생 결과로 관리해야 합니다.

**현재 프로젝트 기준**

- `1s`는 `market.candles`를 차트에 반영합니다.
- `1m`, `5m`는 별도 kline feed를 사용합니다.

## 10. 업데이트가 잦을 때 batching 없이 `setState`를 여러 번 호출하면 어떤 성능 문제가 생기나요?

**답변**

같은 이벤트 루프 안에서 여러 렌더가 중복 발생해 불필요한 리렌더링과 DOM 패치를 일으킬 수 있습니다. 배치 처리를 하면 여러 상태 변경을 하나로 모아서 렌더 횟수를 줄일 수 있습니다.

**현재 프로젝트 기준**

- `setState`는 queue에 먼저 저장됩니다.
- `scheduleUpdate()`가 다음 마이크로태스크에 렌더를 한 번만 예약합니다.

## 11. 지금 queue를 쓰긴 하지만 microtask라 거의 바로 실행되는데, 왜 굳이 queue를 사용하나요?

**답변**

queue를 쓰는 이유는 상태를 오래 쌓아두기 위해서가 아니라, 상태 변경 요청을 잠깐 모아두고 다음 렌더에서 순서대로 확정하기 위해서입니다. 즉 `setState`를 호출하는 순간 바로 state를 바꾸는 대신, 한 번의 렌더 흐름 안에서 여러 update를 일관되게 처리하려는 목적입니다.

**현재 프로젝트 기준**

- `setState`는 즉시 state를 바꾸지 않고 `hook.queue`에 update를 저장합니다.
- `scheduleUpdate()`가 다음 마이크로태스크에 렌더를 한 번만 예약합니다.
- 그래서 같은 턴 안에 여러 `setState`가 들어와도 한 번의 update 흐름으로 묶을 수 있습니다.
- 함수형 업데이트 `prev => next`도 queue 순서대로 처리되기 때문에 최종 state를 더 안전하게 계산할 수 있습니다.

**queue가 없을 때 생길 수 있는 엣지 케이스**

예를 들어 같은 턴 안에서 아래 코드가 실행된다고 가정하면,

```js
setCount((prev) => prev + 1);
setCount((prev) => prev + 1);
```

queue 없이 즉시 반영하는 구조에서는 두 번째 호출이 첫 번째 결과를 안정적으로 이어받지 못해, 최종 값이 기대한 `+2`가 아니라 `+1`처럼 어긋날 수 있습니다.  
지금 구조는 두 update를 queue에 쌓아두고 순서대로 적용하기 때문에 이런 문제를 줄일 수 있습니다.

## 12. `useState()`는 지금 어떻게 구현했나요?

**답변**

우리 프로젝트의 `useState()`는 현재 컴포넌트 인스턴스의 `hooks` 배열에서 현재 `hookIndex` 위치의 state hook을 가져오거나 새로 만들고, queue에 쌓인 update를 반영해 최신 state를 확정한 뒤 `[state, setState]`를 반환하는 방식으로 구현했습니다.

**현재 프로젝트 기준**

- hook은 이름이 아니라 호출 순서로 관리됩니다.
- 각 state hook은 보통 아래 구조를 가집니다.

```js
{
  type: "state",
  state: initialState,
  queue: []
}
```

- `useState()`가 다시 호출되면 해당 hook의 `queue`를 순서대로 처리해 최신 state를 계산합니다.
- 그 다음 현재 state와 `setState`를 반환합니다.
- 마지막에는 `hookIndex`를 증가시켜 다음 hook 호출 위치를 맞춥니다.

**핵심 포인트**

- `useState()`는 단순히 state를 읽는 함수가 아니라, 렌더 시점에 queue를 반영해 최신 state를 확정하는 역할도 합니다.
- `setState`는 값을 즉시 바꾸지 않고 queue에 저장한 뒤 다음 렌더를 예약합니다.

## 13. `useEffect()`는 지금 어떻게 구현했나요?

**답변**

우리 프로젝트의 `useEffect()`는 effect 함수와 deps를 hook 배열에 저장하고, deps가 바뀌었을 때만 실행 대상으로 표시합니다. 실제 실행은 렌더가 끝난 뒤 `commitEffects()` 단계에서 이뤄지며, 이전 cleanup이 있으면 먼저 정리한 뒤 새 effect를 실행합니다.

**현재 프로젝트 기준**

- `useEffect()`도 `useState()`처럼 `hooks` 배열과 `hookIndex`를 기준으로 관리합니다.
- 각 effect hook은 보통 아래 구조를 가집니다.

```js
{
  type: "effect",
  effect,
  deps,
  cleanup,
  shouldRun
}
```

- 처음 렌더이거나 deps가 바뀌면 `shouldRun = true`
- deps가 그대로면 `shouldRun = false`
- 실제 실행은 렌더 중이 아니라, 렌더 후 `commitEffects()`에서 처리합니다.

## 14. effect 함수가 무엇인가요?

**답변**

effect 함수는 `useEffect()` 안에 넘기는 함수입니다. 즉, 렌더가 끝난 뒤 실행할 부수효과 로직을 담은 함수입니다.

**예시**

```js
useEffect(() => {
  const disconnect = connectBinanceFeed(...);

  return () => {
    disconnect();
  };
}, []);
```

위 코드에서:

- `() => { const disconnect = ... }` 이 부분이 effect 함수입니다.
- `return () => { disconnect(); }` 이 부분이 cleanup 함수입니다.

**현재 프로젝트 기준**

- WebSocket 연결
- timer 시작
- interval 변경 시 feed 재연결
- cleanup에서 socket disconnect / timer clear

같은 작업이 effect 함수 안에 들어갑니다.

## 15. `useEffect()` 함수 구조를 어떻게 설명하면 좋나요?

**답변**

`useEffect()`는 크게 세 단계로 설명하면 됩니다.

1. 렌더 중에 effect 함수와 deps를 hook에 저장한다.
2. 이전 deps와 현재 deps를 비교해 실행 여부를 결정한다.
3. 렌더가 끝난 뒤 `commitEffects()`에서 실제 effect와 cleanup을 실행한다.

**짧은 구조 예시**

```js
useEffect(() => {
  // effect 함수
  const cleanupTarget = startSomething();

  return () => {
    // cleanup 함수
    cleanupTarget.stop();
  };
}, [deps]);
```

**핵심 포인트**

- 렌더 중에는 실행하지 않고 등록만 합니다.
- deps가 바뀌어야 다시 실행됩니다.
- cleanup은 다음 effect 실행 전이나 언마운트 시점에 먼저 실행됩니다.

---

## 차트 구현 설명 시 주의할 점

아래 표현은 너무 강하게 말하면 현재 구현보다 더 최적화된 것처럼 들릴 수 있으니 조심하는 것이 좋습니다.

### 피해야 하는 표현

- 이전 값은 그대로 두고 마지막 캔들만 추가한다
- 기존 SVG 요소를 항상 그대로 재사용한다
- 좌표만 조금 바꿔서 완전히 증분 업데이트한다

### 현재 구현에 맞는 표현

우리 차트는 상태가 바뀌면 최신 candle 배열을 기준으로 `buildChartMeta()`가 x, y, range, 이동평균선 좌표를 다시 계산합니다.  
그 다음 런타임이 이전 Virtual DOM과 새 Virtual DOM을 비교하고, 실제 SVG DOM에서는 변경이 필요한 부분을 `patch()`합니다.

즉, **전체 SVG를 통째로 지우고 다시 만드는 구조는 아니지만, 차트 메타 계산은 현재 candle 배열 전체를 기준으로 다시 수행한다**고 설명하는 것이 가장 정확합니다.

### 발표용 짧은 버전

우리 차트는 실시간 데이터가 들어오면 최신 candle 배열을 기준으로 차트 좌표를 다시 계산하고, 실제 SVG DOM에서는 변경이 필요한 부분만 patch하는 방식입니다.
