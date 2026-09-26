# ux-desk-a — 방향 A 「검색이 책상」 풀세트

| | |
|--|--|
| **정본** | 이 폴더 |
| **락** | Tom G3 2026-09-27 · Direction A |
| **스케치** | `../ux-blank-v0/dir-a/` |
| **B** | 참고만 · 폰 셸 이식 금지 |
| **코드** | **HOLD** |
| **핑** | 사용자/Ada/Tom 직접 핑 금지 · parent→Ada |

## IA one-liner
PC 차콜 레일 홈·검색·수집·채팅·관계 · MO 웜 독(검색 중앙) · 검색=블랙 커맨드 · 관계=2D 지도.

## HTML (`html/`)

### Desktop `d-*` · 1440×900
| File | Role |
|------|------|
| `d-home.html` | Search-hero home · library · adjacent synth |
| `d-home-empty.html` | Empty desk |
| `d-search.html` | Results \| detail \| synthesis |
| `d-search-empty.html` | Zero results |
| `d-chat.html` | Thread list · conversation · sources |
| `d-inbox.html` | 수집 queue \| paper detail |
| `d-graph.html` | 2D knowledge map + inspector |
| `d-rail.html` | Rail expanded = menu open-state |

### Mobile `m-*` · 390×844
| File | Role |
|------|------|
| `m-home.html` | Command bar · library · stats · dock |
| `m-home-empty.html` | Empty |
| `m-search.html` | Stacked results · detail · synth |
| `m-chat.html` | Conversation |
| `m-inbox.html` | Queue + detail |
| `m-graph.html` | Compact map + peek inspector |
| `m-capture.html` | Selective warm glass capture sheet |

## PNGs
Root + `out/`: `sb-desk-a-{name}.png` matching each HTML.

## Shared
- `tokens.css` · `shell.css`
- `fonts/` → Pretendard symlink
- `DIRECTION.md` · `IMPLEMENTATION_NOTES.md`

## Compare (G5)
| File | Left | Right |
|------|------|-------|
| `compare/compare-home.png` | `ux-blank-v0/dir-a/home.png` | `sb-desk-a-d-home.png` |
| `compare/compare-search.png` | `ux-blank-v0/dir-a/search.png` | `sb-desk-a-d-search.png` |

Labels: **v0-sketch** \| **desk-a**.

## Nav note
**Rail IS the menu.** `d-rail` shows expanded labels. MO dock covers all five — no More/Top3 HARD.

- **구현 UNLOCK 2026-09-27** · Kai/Lio soft-GO OK · Oak live=별도 승인 · 구 HARD 복원 금지
