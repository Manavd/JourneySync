# Design tokens

`tokens.json` is the single source of truth for every value the website and the
Android app have to agree on. Both platforms read generated files; neither holds
its own copy of a colour.

## Why

The two clients are written in different languages with no shared build, so
until now the palette existed twice and was kept in step by hand. It did not
stay in step. The Android launcher colour was `#EC3013`, a red that appeared
nowhere on the website, and it was corrected only once somebody noticed. That
class of drift is invisible in review, because nothing in either diff looks
wrong on its own.

## Changing a token

```bash
# edit design/tokens.json, then
npm run tokens
```

That rewrites all three generated files. Commit them alongside the change to
`tokens.json`.

`npm test` runs `npm run tokens:check`, which regenerates in memory and compares
against what is committed. Editing a generated file by hand, or updating
`tokens.json` without regenerating, fails the build with the path that drifted.

## Generated files

Do not edit these directly.

| File | Consumed by |
| --- | --- |
| `app/design-tokens.css` | `app/globals.css` imports it; exposes `:root` custom properties |
| `android/app/src/main/res/values/colors.xml` | Android theme and manifest |
| `android/.../DesignTokens.java` | `MainActivity` colour constants alias these |

## Consistent, not identical

The two platforms keep their own vocabulary. The page background is `--paper` on
the web and `SURFACE` on Android; the itinerary tab reads "Itinerary" on the web
and "Plan" on Android, where six tabs share the width. Renaming either side
would churn call sites without changing what a traveler sees.

So each token carries explicit per-platform names, and the generator emits
whatever that platform already calls it. The shared thing is the value.

`web` or `android` may be `null` when a token has no counterpart yet. Those are
real gaps, listed below, not permission to hardcode.

## Two greens, on purpose

`success` (`#1D7A48`) and `successOnDark` (`#73C994`) are the same signal, not a
duplicate. One is read against a light card, the other against the navy status
banner. Collapsing them into one value would fail contrast on whichever surface
lost. Pick by background, never by preference.

## Known gaps

Tracked here rather than silently tolerated.

- **The web carries a second, off-brand palette.** `app/page.tsx` uses Tailwind's
  default slate ramp inline (`#64748b` roughly ten times, plus `#f8fafc`,
  `#475569`, `#cbd5e1`, `#e2e8f0`, `#f1f5f9`, `#0f172a`). These cool greys sit
  against a warm cream and paper brand palette, and have no Android counterpart.
  Consolidating them is a visual change and needs a designer's eye.
- **`#0c79d8` is not in any palette.** It is the trip map's destination marker
  and the PWA `theme-color` in `app/layout.tsx`. It is neither `--blue`
  (`#89B8D8`) nor anything Android uses, and Android's map draws its route in
  coral with no blue marker at all. Choosing the right value is a design call.
- **`.green` is a third green.** `#b9d8b9` in `globals.css`, close to but not
  equal to `mint` (`#B9DDC7`).
- **Several tokens are Android-only or web-only.** `navyRaised`, `coralPressed`
  and `faint` have no counterpart; `warning`, `accent` and `danger` are now
  defined for both but only the web uses them so far.
