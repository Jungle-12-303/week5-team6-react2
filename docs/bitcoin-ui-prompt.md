# 비트코인 UI 구현용 프롬프트

## 목적

문서에 정의된 코어 구조를 유지하면서, 비트코인 실시간 화면 UI를 단계적으로 구현할 때 사용하는 프롬프트입니다.

## 먼저 읽을 문서

- `docs/README.md`
- `docs/requirements.md`
- `docs/03-component.md`
- `docs/04-state.md`
- `docs/05-hooks.md`
- 필요 시 `docs/01-virtual-dom.md`, `docs/02-diff-algorithm.md`, `docs/06-render-commit-phase.md`

참고 예시:

- `docs/assets/binance-btc-realtime-example.png`

## UI 구현 원칙

- 루트 컴포넌트가 모든 화면 상태를 관리한다.
- 자식 컴포넌트는 props만 받아 UI를 렌더링한다.
- 한 번에 전체 거래소 화면을 다 만들지 말고, 가격 카드, 미니 차트, 체결 리스트, 호가창처럼 작은 단위로 나눠 구현한다.
- 문서에 없는 새로운 상태 관리 패턴이나 일반 React 관용구를 임의로 도입하지 않는다.
- 현재 코어 런타임이 지원하는 범위 안에서 가장 작은 유효 UI부터 만든다.

## 프롬프트

```text
우리는 React 핵심 기능을 직접 구현하는 프로젝트를 진행 중이며, 최종 목표는 비트코인 실시간 데이터를 1초 단위로 보여주는 화면을 만드는 것입니다.

먼저 아래 문서를 읽고 현재 설계 의도와 제약을 반영해 주세요.
- docs/README.md
- docs/requirements.md
- docs/03-component.md
- docs/04-state.md
- docs/05-hooks.md
- 필요 시 docs/01-virtual-dom.md, docs/02-diff-algorithm.md, docs/06-render-commit-phase.md

참고 UI는 다음 파일을 기준으로 해 주세요.
- docs/assets/binance-btc-realtime-example.png

이번 작업의 목표:
- 비트코인 실시간 화면에 필요한 UI를 현재 코드 구조에 맞게 한 단계 구현해 주세요.
- 한 번에 전체 화면을 다 만들지 말고, 현재 구조에서 가장 작은 단위의 유효한 UI만 구현해 주세요.

반드시 지켜야 할 조건:
- 함수형 컴포넌트 기반
- 루트 컴포넌트에서만 상태 관리
- 자식 컴포넌트는 props만 받는 stateless 순수 함수
- FunctionComponent 클래스 중심 구조 유지
- hooks 배열과 hook index 기반 상태 관리
- Diff/Patch를 통한 최소 DOM 업데이트 구조 존중
- 기존 `react`, `react-dom` 패키지나 React 런타임 사용 금지
- 반드시 우리가 직접 만든 모듈(패키지/라이브러리)만 사용

작업 방식:
1. 현재 코드베이스를 읽고 지금 어떤 UI와 런타임이 이미 구현됐는지 파악
2. 비트코인 화면을 구성하는 가장 작은 단위의 UI를 하나 선택
3. 그 단위만 구현
4. mock 데이터 또는 현재 가능한 데이터 구조를 props로 연결
5. 가능하면 실행 검증
6. 변경 파일, 검증 결과, 다음에 붙일 UI 단계를 짧게 정리

구현 우선순위 예시:
- 현재가/등락률 카드
- 고가/저가/거래량 정보 바
- 체결 리스트
- 호가창
- 간단한 가격 추세 차트

응답 형식:
- 먼저 현재 상태를 아주 짧게 요약
- 그 다음 바로 구현
- 마지막에 변경 파일, 검증 결과, 다음 단계만 간단히 정리
```
