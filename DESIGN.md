# Second Brain interface contract

## 1. Purpose

A private Korean knowledge workbench: capture first, organize later, connect
ideas while writing, and retrieve the source behind an answer. Preserve the
existing desk direction rather than introduce a new marketing aesthetic.
Product research and adoption decisions live in `docs/research/ADOPTION.md`.

## 2. Color and material

`src/app/globals.css` is the executable token source. Light surfaces use canvas
`#efe8dc`, desk `#f7f2ea`, card `#fffcf7`, ink `#1c1917`, line `#e4dccf` and accent
`#c45c26`. The charcoal navigation rail is `#2a2622`. Dark mode replaces these
through `.dark`, not component-local colors.

Use `bg-canvas`, `bg-desk`, `bg-card`, `text-ink`, `text-mute`, `border-line` and
the semantic `ok`, `warn`, `danger` tokens. Card elevation is subtle; floating
dialogs use `shadow-pop`. Selection uses a tonal wash and an understandable
label or glyph. Accent is reserved for actionable emphasis and focus.

## 3. Typography

Self-hosted Pretendard Variable is the UI and reading face. Monospace is for
code, not decorative labels. Existing tokens define 12px metadata, 13px small
copy, 14px controls, 15px reading text, 17px subheads, 20px section heads and
26px page heads. Korean text wraps at word boundaries; long URLs may break
anywhere rather than widen the viewport.

## 4. Space and scroll ownership

Use the existing Tailwind spacing scale and `rounded-ctl` (8px),
`rounded-card` (10px), `rounded-pill` tokens. Desktop rail widths are 64/220px;
mobile top bar and bottom navigation have 52/60px content heights. Safe-area
insets are reserved separately; `--workspace-h` is the remaining pane height.

Home, search and settings use document scrolling. Editor, graph and chat may
own bounded panes with `min-height: 0`, explicit overflow and dynamic viewport
height. A graph canvas owns pan/zoom; its inspector remains reachable outside
the canvas. On narrow screens, list/detail panes stack or navigate explicitly.
Nothing may scroll underneath a fixed bottom action without safe-area padding.

## 5. Reusable primitives

The public component contracts are documented in `src/components/ui/README.md`.
Reuse Button, Input/Textarea, Dialog/Sheet, EmptyState, Badge/TagBadge, Toast,
Skeleton and the shared shell rather than adding parallel implementations.

Controls need resting, focus, busy, disabled and failure states. Dialogs use
native modal focus trapping and restore focus to the opener. Destructive actions
need explicit confirmation. Saving, capture and chat failures preserve input.
AI connection dialogs block Escape, backdrop and header dismissal while saving or deleting.
Actual login, capture, settings and error scenarios serve as the primitive state
harness during browser QA.

## 6. Interaction

The shell owns navigation, quick capture and the command palette. Shortcuts must
not intercept editor text or IME composition. Search state belongs in the URL.
Note persistence is serialized; new edits survive an in-flight save. References
open real notes, and missing targets require an explicit creation action.

Use the existing soft easing and meaningful opacity/transform transitions.
Respect reduced motion; a settled graph must stop spending simulation frames.

## 7. Accessibility and responsive checks

Label controls, expose errors as alerts, retain visible keyboard focus, and
provide a keyboard-accessible graph list. Aim for 44px mobile controls. Test
Korean headings, long titles/URLs, empty data, busy/error states and dark mode.
Capture actual desktop and mobile pages; include a tablet reflow check.

## 8. Evidence and boundaries

The acceptance matrix is `docs/INTERFACE-PLAN.md`; captured defects and repairs
are in `docs/REBUILD-AUDIT.md`. Screenshots are evidence, not substitute UI.
The application is private: authentication and deliberate search-engine
exclusion take precedence over a public-site SEO score. Do not claim browser
engines, performance scores, offline support or AI capabilities that were not
actually measured or implemented.

## 9. First-run setup and AI connections

The setup page is a document-scrolling form using the login page's mark,
Pretendard, canvas and card tokens. On desktop, a short installation summary
sits beside the form; on mobile it precedes a single column of controls.
Group installer authorization, the owner's password, and optional AI choices
by purpose. Do not put database URLs, filesystem paths or OAuth tokens in a
public form. An existing installation never presents a password-reset form.

Reuse the same AI connection fields in initial setup and authenticated
settings. Provider and API/Auth selections are labelled native controls.
Explain the selected provider's real login path and distinguish saved
configuration from a verified connection. Optional data sharing requires an
explicit checkbox. Credentials stay in component memory, never localStorage,
URLs or success messages; saved keys are represented only by presence.

Preserve all fields after recoverable failures, identify the failing group,
and prevent duplicate submissions while saving. A completed setup directs
the owner to the ordinary login screen. Cover unconfigured-server, invalid
installer code, validation, saving, completed/locked and configured-credential
states in browser QA, including 390px mobile and 768px tablet layouts.
