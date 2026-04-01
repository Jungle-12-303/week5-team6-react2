# 코어 구현용 프롬프트

## 목적

Virtual DOM, Diff/Patch, Component, State, Hooks 같은 코어 런타임 기능을 구현하거나 보완할 때 사용하는 프롬프트입니다.

## 먼저 읽을 문서

- `docs/README.md`
- `docs/requirements.md`
- 현재 구현 대상에 맞는 설계 문서
- 필요 시 해당 기능의 선행 단계 문서

권장 문서 조합:

| 구현 대상 | 함께 읽을 문서 |
|---|---|
| Virtual DOM | `docs/README.md`, `docs/requirements.md`, `docs/01-virtual-dom.md` |
| Diff/Patch | `docs/README.md`, `docs/requirements.md`, `docs/01-virtual-dom.md`, `docs/02-diff-algorithm.md` |
| Component | `docs/README.md`, `docs/requirements.md`, `docs/03-component.md` |
| useState | `docs/README.md`, `docs/requirements.md`, `docs/03-component.md`, `docs/04-state.md` |
| useEffect/useMemo | `docs/README.md`, `docs/requirements.md`, `docs/03-component.md`, `docs/04-state.md`, `docs/05-hooks.md`, `docs/06-render-commit-phase.md` |

## 프롬프트

```text
우리는 React 핵심 기능을 직접 구현하는 프로젝트를 진행 중이고, 현재 기준 브랜치는 develope입니다.

먼저 아래 문서를 읽고 현재 설계 의도를 정확히 반영해 주세요.
- docs/README.md
- docs/requirements.md
- [이번 작업에 해당하는 설계 문서들]

프로젝트의 핵심 목표:
- React의 핵심 기능인 Component, State, Hooks를 직접 구현한다.
- Virtual DOM + Diff + Patch도 직접 구현한다.
- 최종적으로는 비트코인 실시간 데이터를 1초 단위로 갱신해서 보여주는 화면을 만든다.

반드시 지켜야 할 제약 조건:
- 함수형 컴포넌트 기반으로 구현
- 상태는 최상위 루트 컴포넌트에서 관리
- 자식 컴포넌트는 props만 받는 stateless 순수 함수 형태 유지
- FunctionComponent 클래스 중심 구조 유지
- hooks 배열과 hook index 기반으로 상태를 관리
- 상태 변경 시 리렌더링 자동 트리거
- Diff/Patch를 통해 필요한 부분만 DOM 업데이트
- 기존 `react`, `react-dom` 패키지나 React 런타임은 사용 금지
- 반드시 우리가 직접 만든 모듈(패키지/라이브러리)만 사용할 것
- 일반적인 React 구현을 가져오지 말고, 문서에서 정의한 구조를 따라야 함

이번 작업:
- [구현할 최소 기능 1개를 여기에 명시]

작업 방식:
1. 현재 코드베이스를 읽고 이 기능이 이미 어디까지 구현됐는지 먼저 파악
2. 문서 기준으로 빠진 최소 단위만 정의
3. 해당 단위만 실제 코드로 구현
4. 가능한 테스트나 실행 검증 수행
5. 코드와 문서가 어긋나면 관련 문서도 함께 수정
6. 변경 파일, 검증 결과, 다음 단계만 짧게 정리

주의:
- 한 번에 너무 많은 기능을 구현하지 말 것
- 기존 구조를 뒤엎는 리팩터링보다 현재 문서 구조를 완성하는 방향을 우선할 것
- 구현 전에 관련 코드 파일과 문서를 먼저 조사한 뒤 바로 수정까지 진행할 것

응답 형식:
- 먼저 현재 상태를 한두 문장으로 요약
- 그 다음 바로 구현
- 마지막에 변경 파일, 검증 결과, 다음 단계만 간단히 정리
```
