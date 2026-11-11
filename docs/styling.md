# Styling

Tailwind, but **colors come from CSS custom properties**, not Tailwind's palette. [src/index.css](../src/index.css) defines tokens (`--bg`, `--surface`, `--accent`, …) for dark (default) and light, and [tailwind.config.js](../tailwind.config.js) maps them to semantic utility names: `bg-bg`, `text-ink`, `text-muted`, `border-line`, `bg-accent`.

**Do not introduce raw Tailwind colors** (`bg-gray-800`, `text-blue-500`) — they break theming.

## Palette

Dark (default): near-black page `--bg #1c1c1c`, lighter gray `--surface #282828` for panels/cards/sidebar so content stands out, `--raised #333333` for inputs and hover. Accent is green `#48A04C`; `--success` is a lighter green so "improved" text stays readable on the gray surfaces. Light theme uses neutral grays with the same green. Change colors **only** in the token blocks at the top of `index.css` (light tokens appear twice: `[data-theme='light']` and the `prefers-color-scheme` fallback — keep them identical). Update `theme-color` in `index.html` if `--bg` changes.

## Component classes

Declared in `@layer components` in `index.css`. Prefer these over re-deriving the same utility strings:

`.btn-primary` / `.btn-secondary` / `.btn-quiet` / `.btn-danger` (+ `.btn-sm` / `.btn-lg`), `.field`, `.num-input`, `.panel`, `.seg`, `.icon-btn`, `.section-label`.

## Theme

`useTheme()` in [src/lib/theme.ts](../src/lib/theme.ts) persists to `localStorage` key `wt:theme` and sets `document.documentElement.dataset.theme`. An inline script in [index.html](../index.html) applies it before first paint to avoid a flash. `system` means "no `data-theme` attribute" and falls through to `prefers-color-scheme`.

## Mobile-first

`Layout` renders a sidebar at `lg:` and a fixed bottom nav below it. Inputs are forced to 16px to stop iOS zoom-on-focus, and `.pb-safe` / `.mb-safe` handle the notch inset.

## Icons

From `lucide-react`.
