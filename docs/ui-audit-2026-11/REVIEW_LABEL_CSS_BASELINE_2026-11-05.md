# On_HARU — Review 라벨 개선 및 CSS 안전 점검 (2026-11-05)

## 이번 변경 범위
- **Review만 수정**: 일정에 연결된 기록에 표시되는 `.review-schedule-label`의 시각적 연결 표식 `↳`, 줄바꿈/다크모드 대비를 개선.
- **독립 Personal note는 라벨만 유지**: 기존 위계·기록 종류별 카드·Check-in·Class Review·Focus 섹션 디자인을 바꾸지 않음.
- 일정 연결 상태와 저장 데이터는 기존 `reviewRow()`가 생성한 값 그대로 사용하며 JS 저장 로직을 수정하지 않음.
- PWA HTML 및 SW 릴리스 마커 동기화.

## 현행 CSS 진단 기준
`public/legacy/app.7cb1b71d4eb6.css` (읽기 전용 점검; 이번 PR에서 파일 내용 변경 없음)

| 지표 | 현재 측정 |
| --- | ---: |
| 파일 문자 수 | 562,154 |
| 줄 수 | 4,505 |
| `!important` 횟수 | 5,497 |
| 선택자 그룹 | 4,231 |
| 고유 선택자 그룹 | 2,929 |
| 2회 이상 반복된 선택자 그룹 | **675** |

동일 선택자 반복은 레거시 미디어쿼리·테마별 오버라이드·CSS 캐스케이드에 필요한 경우도 많으므로 **675개를 삭제 대상이라고 판단하지 않음**.

반복 상위 범위:
- `:root`, `.pagehead`: 각 18회
- `.brand-name`: 17회
- `#page-focus #focusDurations`: 12회
- `#page-focus #focusDurations button[data-time]`: 11회
- `#page-focus #focusTarget`: 10회

### 실제 리스크
1. 라이트/다크 스타일이 글로벌 규칙 `html[data-appearance=dark] body .app *{color:inherit!important;border-color:#44594c!important}`와 충돌할 수 있음.
2. 같은 선택자가 여러 위치에 있어 나중에 추가한 선언이 이전 수정 효과를 덮는 일이 발생할 수 있음.
3. 리뷰 등 컴포넌트별 인라인 스타일과 외부 CSS 사이 우선순위까지 고려해야 함.
4. PWA의 캐시 때문에 HTML/SW 릴리스 번호를 함께 갱신해야 함.

## 다음 CSS 정리 계획 — 아직 실행하지 않은 작업
1. Review 관련 선언만 별도 범위로 모아 **계산된 스타일·전후 캡처를 비교**.
2. 계산 결과가 동일한 *정확히 중복된 선언*만 확인 후 소규모 제거. `!important` 일괄 삭제 금지.
3. 320/390/1024px × 라이트/다크, Review의 연결 노트·독립 노트·Check-in·Class Review 화면 회귀 검증.
4. 검증에 실패하면 해당 컴포넌트 변경을 되돌리고 `main`을 유지.

## 검증 경계
현재 PR에 포함된 새 Review 라벨 시각 QA는 격리 브라우저 DOM 샘플을 사용. 실제 저장 기록과 사용자의 `localStorage`를 읽거나 변경하지 않음. 전 페이지 CSS 자동 정리나 구조/데이터 변경을 이번 배포에 포함하지 않음.
