# Second Brain Home — V5 (퀄 전면 재작업)

- 2026-09-26 · Mira · Ada 「갈아엎어라」락
- **승인 트랙:** 기존 v3/v4/베리에이션/portrait 패치 **전부 폐기** (`mocks/_discarded_approval_track/`)
- 방향: Desktop **Vault Night** × Mobile **Tool Surface** · StyleGallery=cite only
- 토큰 **B freeze** (사용자 2026-09-26): `#110e16` / `#c4b5fd` · V5+B 확정 · A 폐기 · 코드 GO=Tom/사용자 미답 HOLD
- 코드: Kai/Lio GO 없음 · 풀 구현 HOLD
- CA: `bc-766114ff` Ada 런치 · Mira 중복 금지 · 맞춤

## 연구 한 줄 (인용)

캡처→Inbox 트리아지 분리(GTD/PKM). 홈은 선택지 폭주가 아니라 **미처리 정리**가 기본 착지. 모바일 제스처는 대체 버튼과 공존, 터치 ≥44px. 빈 상태는 CTA 1.

## UX 기본 (이 패스 통과 조건)

| 축 | 규칙 |
|----|------|
| 정보 위계 | 화면 제목 > 행 제목 > 메타 > 보조 링크. 동일 굵기·동일 크기 금지 |
| 시선 흐름 | Top chrome → Top3 → Hero 리스트 → Primary CTA → Secondary 1줄 |
| 타깃 | 행·버튼·하단 도구 ≥44px. 행 탭 → `/inbox` (아이템 deep link 없음) |
| 밀도 | 행 = 제목 + 출처/타입 메타 + 시각 + chevron. 제목만 나열 금지 |
| 빈 상태 | 문장 1 + `캡처` 1 (리스트 0행 렌더 금지) |
| 피드백 | Primary `정리` = Inbox로 일괄 진입. 행 hover/active 서피스 |
| 스와이프 | **portrait 전용**. 엣지 peek + page dots (문구 스티커·화살표 배너 금지) |
| 데스크 wide | stage max-width ~1040 중앙. 거대 우측 공백·좁은 칼럼 몰림 둘 다 금지 |
| 장식 | UI 안 A/B 스와치·평가 체크박스 금지 |

## 구조 락 (유지)

- 주인공 1 = InboxHero · Top3 compact · secondary ≤1 (`이어서 · {제목}` · `더 보기`)
- Recent = 히어로 리스트 자체 · Pulse+Rail+Continue 풀스택 금지
- 모바일 하단: `노트 검색` + `캡처`

## 산출

- `mocks/v5/sb-home-v5-desk.png` (1440×900)
- `mocks/v5/sb-home-v5-mob.png` (390×844 portrait)
- `mocks/v5/sb-home-v5-desk-empty.png` (여유)
- `mocks/v5/sb-home-v5-mob-empty.png` (여유)
- 소스: `mocks/v5/html/`

## 셀프체크

올리기 전: 「출시 앱 스크린샷처럼 보이는가?」 — 아니면 다시.
