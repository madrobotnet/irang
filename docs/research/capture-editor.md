# Capture and editor workflows: source evidence

Fetched 2026-09-27 from official documentation/product pages. Claims below are limited to retrieved text; unavailable details remain unknown.

| Claim / workflow | Exact primary source URL | Directly observed evidence | Status | Proposed application |
|---|---|---|---|---|
| Reader separates user-curated Library items from incoming Feed and models triage states | https://docs.readwise.io/reader/docs/faqs/adding-new-content | “Library is further subdivided into ... Inbox, Later, Archive, and Shortlist”; Feed “is divided into two locations: Unseen and Seen.” | Verified | Start with one Inbox and a small status set; defer tags/folders until review. Avoid duplicating separate automated-feed behavior unless needed. |
| Reader moves discovered Feed items into the Library for later/permanent keeping | https://docs.readwise.io/reader/docs/faqs/adding-new-content | “As you find documents in Feed that you want to read later and/or permanently save, you can move them to your Library.” | Verified | Make triage an explicit action on an item rather than requiring classification at capture. |
| Reader browser extension has a keyboard capture shortcut and defaults to Inbox | https://docs.readwise.io/reader/docs/faqs/adding-new-content | “keyboard shortcut alt + R”; “save a clean, readable version ... to your Reader inbox”; binding can be changed in extension options. | Verified | For desktop capture, support a configurable shortcut if practical; use sensible default destination and preserve source URL/content. |
| Reader web provides global command and shortcut discovery; mobile offers its own settings surface | https://docs.readwise.io/reader/docs/faqs/navigation | “Command Palette ( Cmd/Ctrl + K )”; “use the ? shortcut to pull up a reference guide”; auto-advance can be toggled in the web Command Palette or mobile Settings panel. | Verified | Provide a small keyboard-accessible action menu plus discoverable shortcut help. Do not assume web commands map unchanged to mobile. |
| Reader supports mobile-specific navigation customization | https://docs.readwise.io/reader/docs/faqs/navigation | Mobile app: “Account tab ... Customize swipes”; settings for auto-advance are in the mobile Settings panel. | Verified | Use touch-friendly primary actions; swipe gestures are optional and should not be the only way to triage. |
| AFFiNE invokes block insertion from a blank block with slash | https://docs.affine.pro/core-concepts/elements-of-affine/slash-command | “Activated through ‘/’ in a blank note block to select a block from all the lists.” | Verified | Offer `/` in an empty editor block to insert common structures/actions; keep an explicit clickable alternative. |
| SiYuan Markdown/block-reference portability details | https://github.com/siyuan-note/siyuan ; https://b3log.org/siyuan/en/ | Official product/repository pages were fetched, but this research did not retrieve a detailed Markdown export/import or round-trip specification. | Unknown | Store note content in portable Markdown where appropriate, but test round-trip/export before promising block-level compatibility. |
| Command-palette details or shortcut conventions in AFFiNE; SiYuan keyboard/mobile navigation specifics | https://docs.affine.pro/ ; https://github.com/toeverything/AFFiNE ; https://github.com/siyuan-note/siyuan | Retrieved official pages do not establish the requested detailed behaviors. AFFiNE slash-command page only substantiates `/` in a blank block. | Unknown | Do not infer parity from feature labels or marketing names; verify only if these workflows become requirements. |

## Practical recommendations for a Korean single-user web app

1. Capture quickly with the content/URL and minimal required metadata; default new items to Inbox.
2. Make triage actions explicit (keep for later, archive, delete) and reversible where feasible; the exact action set is an app recommendation, not asserted competitor behavior.
3. Use a compact Inbox plus status/filter views instead of mandatory folders or a collaboration/workspace model.
4. Add `Cmd/Ctrl+K` action search and visible shortcut help, but retain ordinary buttons and touch targets.
5. Let `/` insert a short list of useful editor blocks/actions only in an empty block; avoid copying AFFiNE's broader block catalog.
6. Treat mobile as a responsive capture/triage surface, not a desktop shortcut surface; Reader's mobile-specific settings support separate interaction design, but detailed competitor mobile navigation is not fully verified here.

## Retrieved sources

- https://docs.readwise.io/reader/docs/faqs/adding-new-content (HTTP 200; detailed Library/Feed and extension workflow)
- https://docs.readwise.io/reader/docs/faqs/navigation (HTTP 200; shortcut, command palette, and mobile settings)
- https://docs.readwise.io/reader/docs/faqs/filtered-views (HTTP 200; filtered-view splitting; not needed for a separate claim)
- https://docs.affine.pro/core-concepts/elements-of-affine/slash-command (HTTP 200; detailed slash-command trigger)
- https://docs.affine.pro/ (HTTP 200; landing page only)
- https://github.com/toeverything/AFFiNE (HTTP 200; repository page, no detailed behavior claim used)
- https://github.com/siyuan-note/siyuan (HTTP 200; repository page, no detailed behavior claim used)
- https://b3log.org/siyuan/en/ (HTTP 200; product page, no detailed behavior claim used)
- https://readwise.io/read (HTTP 200 on initial retrieval; response not used as detailed workflow evidence)
