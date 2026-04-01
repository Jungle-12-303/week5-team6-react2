# 실시간 데이터 연결용 프롬프트

## 목적

비트코인 화면에 들어갈 데이터를 1초 단위로 갱신되도록 연결할 때 사용하는 프롬프트입니다.

## 먼저 읽을 문서

- `docs/README.md`
- `docs/requirements.md`
- `docs/03-component.md`
- `docs/04-state.md`
- `docs/05-hooks.md`
- `docs/06-render-commit-phase.md`
- 필요 시 `docs/01-virtual-dom.md`, `docs/02-diff-algorithm.md`

## 연결 원칙

- 실시간 데이터 흐름은 루트 컴포넌트에서만 관리한다.
- 자식 컴포넌트는 이미 정리된 데이터를 props로만 받는다.
- 먼저 1초 단위 mock 갱신이 안정적으로 동작하게 만들고, 그 다음 실제 API나 WebSocket으로 교체한다.
- cleanup, interval 해제, 재구독 해제 같은 정리 로직을 문서에 맞게 처리한다.
- 현재 코어 런타임이 아직 충분하지 않다면 실제 네트워크 연결보다 `1초 단위 상태 갱신 흐름`을 먼저 완성한다.

## 프롬프트

```text
우리는 React 핵심 기능을 직접 구현하는 프로젝트를 진행 중이며, 최종 목표는 비트코인 실시간 데이터를 1초 단위로 갱신해서 보여주는 화면을 만드는 것입니다.

먼저 아래 문서를 읽고 현재 설계 의도와 제약 조건을 반영해 주세요.
- docs/README.md
- docs/requirements.md
- docs/03-component.md
- docs/04-state.md
- docs/05-hooks.md
- docs/06-render-commit-phase.md
- 필요 시 docs/01-virtual-dom.md, docs/02-diff-algorithm.md

이번 작업의 직접 목표:
- 현재 코드 상태를 기준으로, 비트코인 데이터가 1초 단위로 갱신되는 흐름을 구현해 주세요.
- 현재 구조상 실제 API/WebSocket 연결이 아직 이르다면, 먼저 mock 실시간 데이터 흐름을 안정적으로 구현해 주세요.
- 실제 API/WebSocket 연결이 가능할 정도로 기반이 준비되어 있다면, 최소 범위로 연결해 주세요.

반드시 지켜야 할 조건:
- 상태는 루트 컴포넌트에서만 관리
- 자식 컴포넌트는 props만 받아 렌더링
- hooks 배열과 hook index 기반 구조 유지
- useEffect 또는 동등한 effect 메커니즘을 문서 방향에 맞게 구현
- cleanup 타이밍과 재실행 조건을 문서에 맞게 처리
- 상태 변경 시 필요한 부분만 DOM 업데이트되도록 현재 Diff/Patch 구조를 존중
- 기존 `react`, `react-dom` 패키지나 React 런타임 사용 금지
- 반드시 우리가 직접 만든 모듈(패키지/라이브러리)만 사용

작업 방식:
1. 현재 코드베이스에서 실시간 갱신을 연결할 수 있는 상태 관리/이펙트 기반이 있는지 먼저 파악
2. 가능하면 mock 1초 갱신부터 구현
3. 여건이 되면 실제 데이터 연결을 가장 작은 범위로 추가
4. interval, subscription, cleanup이 정상 동작하는지 검증
5. 문서와 코드가 어긋나면 관련 문서도 함께 수정
6. 변경 파일, 검증 결과, 실제 연결 가능 여부, 다음 단계를 짧게 정리

구현 우선순위:
- 1초 단위 mock 데이터 갱신
- 루트 상태 갱신 후 자식 UI 반영
- cleanup 보장
- 필요 시 실제 API 또는 WebSocket 연결

응답 형식:
- 먼저 현재 상태를 아주 짧게 요약
- 그 다음 바로 구현
- 마지막에 변경 파일, 검증 결과, 다음 단계만 간단히 정리
```
