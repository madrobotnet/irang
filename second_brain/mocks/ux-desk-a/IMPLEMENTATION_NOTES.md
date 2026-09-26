# Implementation Notes — ux-desk-a (for Kai / Lio · after unlock)

Design-only mocks. **코드 HOLD** until Tom/사용자 unlock. soft-GO 없음.

## Dual rail (separate HTML — no responsive single file)
| | PC | MO |
|--|----|----|
| Frame | `.app-d` 1440×900 | `.app-m` 390×844 |
| Nav | `.rail` charcoal 72px · 5 destinations + settings + avatar | `.dock` 5 slots · 검색 center FAB |
| Order PC | 홈 · 검색 · 수집 · 채팅 · 관계 | — |
| Order MO | — | 홈 · 수집 · **검색** · 채팅 · 관계 |

## Components
| Component | Notes |
|-----------|-------|
| `SearchBar` / command surface | Black bar · 1st-class · ⌘K / Esc · chips under |
| `LibCard` / `Result` | Type ico (노/메/웹/채) · title · meta · selected wash |
| `SynthPanel` | Adjacent chat · AI tag terracotta · me = ink bubble · composer |
| `EmptyState` | Glyph + calm copy + primary CTA |
| `KnowledgeMap` | SVG/canvas 2D · nodes + edges + HUD legend · inspector peer |
| `CaptureSheet` | Selective glass (`--glass`) over parchment — **only** focus moment |
| `Rail` / `Dock` | Shared icons · active = rail wash / dock accent |

## States shown
- Home fill · home empty (PC+MO)
- Search fill (list-detail-synth) · search zero results (PC)
- Chat with sources aside
- Inbox queue + paper
- Graph map + selection inspector
- Rail expanded (menu)
- Capture sheet (MO glass hint)

## IA proposal (open until further Tom lock)
1. **Nav:** utility rail / dock five — rail = menu (no hamburger HARD).
2. **Menu:** expand rail labels (`d-rail`) · MO needs no More if dock is complete.
3. **Graph:** 2D navigable map preferred for A tone · three/R3F optional later, not forced.
4. **Search composition:** list-detail + command-surface (StyleGallery rule) · synthesis adjacent on PC, stacked on MO.

## Tokens
See `tokens.css`. Single family — parchment · terracotta · charcoal. No lavender · no KB yellow · no Vault Night canvas.

## Out
- Product React/code until unlock
- StyleGallery CSS paste
- dir-b cool mist phone shell
- v2/v3 FAIL chrome recycle (Top3 underline · split capsule Vault Night)
- Eval chrome · arrow stickers · user ping
