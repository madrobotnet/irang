# UI primitives and shell

Everything here is token-driven: colors, radii, shadows and spacing come from the
`@theme` block in `src/app/globals.css` (`bg-canvas`, `bg-desk`, `bg-card`, `text-ink`,
`text-mute`, `border-line`, `bg-accent`, `text-ok|warn|danger`, `rounded-ctl|card|pill`,
`shadow-card|pop`, `rail-*`). Do not hardcode hex values or pixel sizes in feature code;
add a token instead. Copy lives in per-area `copy.ts` catalogs (Korean source, English
translation) read with `useCopy`; the product name comes from `brandName(locale)` in `@/lib/brand`.

## `@/components/ui`

| Export | Signature | Notes |
| --- | --- | --- |
| `cn` | `(...inputs: ClassValue[]) => string` | clsx class-name joiner; does not merge conflicting Tailwind utilities. |
| `BrandMark` | `({ className? })` | Irang "Interlock" mark in `currentColor`: 20px accent by default (`.brand-mark`), and any `size-*` / `text-*` class wins. Decorative (`aria-hidden`), so name the enclosing link or show the brand name beside it. |
| `Button` | `forwardRef<HTMLButtonElement, ButtonProps>` — `variant?: "primary" \| "secondary" \| "ghost" \| "danger" \| "rail"`, `size?: "sm" \| "md" \| "lg"`, `iconOnly?`, `loading?`, `leading?`, `trailing?` + native button props | `loading` sets `aria-busy` and disables; `iconOnly` needs `aria-label`. |
| `buttonClassName` | `(opts?: { variant?; size?; iconOnly? }) => string` | For `<Link>`/`<a>` styled as buttons. |
| `Input` / `Textarea` | `forwardRef` — `label?`, `hint?`, `error?`, `wrapperClassName?`, (`Input` only) `leading?`, `trailing?` + native props | `error` sets `aria-invalid` and `aria-describedby`. |
| `inputClassName` | `string` | Bare control class for custom fields. |
| `Dialog` | `({ open, onOpenChange, title?, description?, children?, footer?, initialFocusRef?, hideTitle?, size?: "sm" \| "md" \| "lg", className?, bodyClassName? })` | Native `<dialog showModal>`: focus trap, Escape, backdrop click, focus restore to the opener, scroll lock. |
| `Sheet` | same as `Dialog` minus `size` | Bottom sheet on mobile, centered card from `sm:`. |
| `useModalDialog` | `(open, onOpenChange, initialFocusRef?) => { ref, onClose, onBackdropClick }` | Build custom modals (used by the command palette). |
| `EmptyState` | `({ icon?, title, description?, action?, variant?: "panel" \| "plain", className? })` | One-sentence description that says what to do next. |
| `Badge` / `TagBadge` | `({ tone?: "neutral" \| "accent" \| "ok" \| "warn" \| "danger" \| "rail", count?, ... })` / `({ tag })` | `count` renders a numeric pill (99+ cap). |
| `ToastProvider` / `useToast` / `toastText` | `useToast(): { toast(message: LocalizedText, { tone?, action?: { label: LocalizedText, onClick }, durationMs? }): number; dismiss(id): void }` | Live region; `durationMs: 0` keeps the toast until closed. Messages and action labels carry `{ ko, en }` and render in the current locale. Use `textInEveryLocale` from `@/lib/i18n/copy` to retain both catalog or API-error translations; passing a preselected string is a type error. |
| `Kbd` / `Shortcut` | `Kbd(props)` / `Shortcut({ keys: readonly string[] })` | Keycaps for hints. |
| `Skeleton` / `SkeletonLines` | `Skeleton(divProps)` / `SkeletonLines({ lines? })` | Loading placeholders. |
| `UI_COPY` | copy catalog | Accessible names of the primitives' close and dismiss buttons. |

## `@/components/shell`

| Export | Signature | Notes |
| --- | --- | --- |
| `AppShell` | `({ children })` | Rail (desktop), top bar + bottom nav (mobile), `main#main`, palette, capture launcher, toasts. Rendered by `src/app/(app)/layout.tsx` after the server session check. |
| `ShellProvider` / `useShell` | `useShell(): { openCapture(): void; closeCapture(); captureOpen; openPalette(mode?: "all" \| "notes"); closePalette(); paletteOpen; inboxCount: number \| null; refreshInbox(); railExpanded; setRailExpanded(bool); logout(): Promise<void>; theme; resolvedTheme; setTheme(theme); cycleTheme() }` | `openCapture` renders the inbox lane's `<CaptureDialog open onOpenChange />`. Global keys: `Ctrl/⌘+K` palette, `Ctrl/⌘+P` note switcher, `c` capture, `/` search, `g` + `h i n s g c` go-to; single keys are ignored inside inputs, textareas, contenteditable and the CodeMirror editor. |
| `ThemeProvider` / `useTheme` | `useTheme(): { theme: "system" \| "light" \| "dark"; resolvedTheme: "light" \| "dark"; setTheme; cycleTheme }` | `useSyncExternalStore` over localStorage + `prefers-color-scheme`; the inline `THEME_INIT_SCRIPT` in the root layout applies `.dark` before hydration, so no hydration mismatch. |
| `CommandPalette` | `({ open, mode, onOpenChange, onModeChange, onCapture? })` | cmdk over `/api/notes/titles`; actions (capture, new note, today), navigation, theme, and "New note: <query>" when the query matches no title. Search matches labels in both languages. |
| `NAV_ITEMS`, `navItem`, `isNavActive`, `activeNavId`, `MOBILE_PRIMARY`, `MOBILE_MORE`, `isMoreActive`, `goToHref` | see `nav.ts` | Single source of routes, icons and chord keys; labels are `SHELL_COPY[locale].nav[id]`. |
| `resolveShortcut`, `isEditableTarget`, `modKey`, `IDLE_CHORD`, `CHORD_TIMEOUT_MS` | see `shortcuts.ts` | Pure keymap; unit-tested. |
| `THEME_INIT_SCRIPT`, `RAIL_INIT_SCRIPT`, `*_STORAGE_KEY` | strings | Inlined by `src/app/layout.tsx`. |
| `SHELL_COPY`, `BOUNDARY_COPY`, `everyLocale`, `keywordsInEveryLocale` | see `copy.ts` | Shell and error-page copy. `everyLocale(pick)` returns a `LocalizedText` for toasts that stay open; `keywordsInEveryLocale(...picks)` feeds palette search in both languages. |
| `StatusScreen` | `({ kind: "notFound" } \| { kind: "error", onRetry, digest? })` | Brand card for the root not-found, error and global-error boundaries; shows the error digest, never the raw message, and sets the tab title. |
| `Mark` | alias of `BrandMark` | Deprecated; import `BrandMark` from `@/components/ui`. |

## `@/features/auth`

| Export | Signature | Notes |
| --- | --- | --- |
| `LoginForm` | `({ next: string })` | Posts `/api/auth/login`; shows 401 copy, lockout countdown from `retryAfterSeconds`, then `window.location.assign(next)`. |
| `sanitizeNextUrl` | `(raw) => string` | Same-origin relative path or `/`. |
| `LOGIN_COPY`, `formatRemaining` | | Korean copy and minutes/seconds formatting. |
