# LIFE OS — liquid glass system

## Architecture and hierarchy

The app uses plain CSS and the installed `motion/react` package. No Tailwind migration or second animation runtime is required. `src/liquid-system.css` is loaded after legacy CSS; it is the authoritative material layer. Theme state is exposed as `.dark`, `data-mode`, and `data-palette` on the app shell. Login retains its separate wallpaper treatment.

1. Canvas: static base plus three radial-gradient orbs, tinted by the selected palette. Pastel opacity in light mode; richer glow in dark mode. Orbs animate transform only, with staggered 24–33 second cycles. They never intercept pointer events.
2. Primary material: floating navigation, desktop navigation, monthly summary, Assistant container. Use at most one principal glass surface per content group.
3. Ordinary sections and repeated items: flat, borderless 4.5% fills, 7.5% on hover, no blur and no shadow. Do not nest glass cards inside glass cards.
4. Controls: solid themed input surfaces, clear focus outline, at least 44px interactive targets. Primary actions use deeper palette colors with white labels, avoiding white text on pale peach.

```jsx
<Card t={t} variant="glass">Main summary or Assistant</Card>
<Card t={t}>Ordinary section or task row</Card>
```

`Card` defaults to flat. Existing task checkboxes, edit/delete controls, forms, persistence and navigation handlers stay connected. Never copy demo tasks or a separate local active-tab state into production.

## Equivalent Tailwind classes

These are porting recipes, not dependencies required by the current CSS implementation. Configure the `dark:` selector to follow the app shell's `.dark` class in the Tailwind version used by the target project.

Primary glass:
```txt
relative rounded-3xl border border-white/80 bg-white/70
backdrop-blur-xl backdrop-saturate-150 text-slate-900
shadow-[inset_0_1px_1px_rgba(255,255,255,0.94),inset_0_-1px_1px_rgba(100,140,200,0.12),0_12px_36px_rgba(15,23,42,0.08)]
dark:border-white/20 dark:bg-slate-950/80 dark:text-slate-50
dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.22),inset_0_-1px_1px_rgba(100,140,200,0.15),0_12px_36px_rgba(0,0,0,0.32)]
```

Flat repetitive rows:
```txt
rounded-2xl border-0 bg-slate-900/5 shadow-none backdrop-blur-none
hover:bg-slate-900/10 text-slate-900
dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-50
transition-colors duration-200 motion-reduce:transition-none
```

Secondary text: `text-slate-600 dark:text-slate-300`. Avoid applying opacity to entire text groups except intentionally completed tasks. Theme-aware production text uses `t.text` and `t.muted`; selected navigation labels use the stronger ink color, with the indicator providing the accent.

## Material tokens

| Token | Light | Dark |
| --- | --- | --- |
| Face | white at 68% | selected deep surface at 78% |
| Rim | white at 94% | white at 22% |
| Drop shadow | slate at 8% | black at 32% |
| Main blur | 24px / saturation 150% | same |
| Mobile content blur | 18px / saturation 140% | same |
| Row fill | slate at 4.5% | white at 4.5% |
| Main text | selected deep charcoal | selected near-white |

`--mesh-primary`, `--mesh-secondary`, and `--mesh-deep` map to the selected Blue, Brown, or Peach palette's `a1`, `a2`, and `a3`. This avoids a permanently blue indicator in other palettes. Radial gradients create soft edges without animating expensive blur filters.

## Animation logic

`GlassSelection` renders one shared `layoutId` per navigation group. Desktop and mobile use different IDs to prevent hidden navigation from attracting the visible indicator. The existing `tab` state determines both the rendered page and selected control.

```jsx
const reduced = useReducedMotion();
<motion.span
  aria-hidden="true"
  className="glass-selection"
  layoutId={reduced ? undefined : `glass-selection-${group}`}
  transition={reduced ? {duration: 0} : {
    type: 'spring', stiffness: 390, damping: 34, mass: .75
  }}
/>
```

The mobile indicator alone morphs asymmetric border radii over eight seconds. Labels, controls and content never morph. Do not animate backdrop-filter or page width/height.

```jsx
<motion.div
  key={tab}
  className="glass-page"
  initial={reduced ? false : {opacity: 0, y: 14}}
  animate={{opacity: 1, y: 0}}
  transition={reduced ? {duration: 0} : {
    duration: .32, ease: [.22, 1, .36, 1]
  }}
>{page}</motion.div>
```

The page stays in normal flow at full width/minimum full height. Only opacity and transform animate; the shell and fixed navigation do not resize. Entrance-only motion avoids duplicate outgoing controls or focus lingering in an exiting page. Lazy loading keeps the existing status fallback. Natural height differences between screens remain; no artificial height animation is added.

## Accessibility and performance

Respect reduced motion in both Motion and CSS. Reduced transparency removes ambient orbs and uses opaque surfaces. Unsupported backdrop-filter falls back to opaque cards/navigation. Keyboard focus remains visible and active navigation exposes `aria-current="page"`. Mobile uses two ambient orbs and a lower content blur. Keep blur static and limit morphing to one small indicator; 120fps is device-dependent, not guaranteed.

Validation: production build and UI regression suite. Physical-device frame-rate and authenticated visual checks across all six themes remain release QA tasks.
