# Layout patterns without cards

Read this when composing a page. Pick patterns from here instead of wrapping content in rounded boxes. Mix patterns across a page so the rhythm varies.

## Contents
1. Hero
2. Ruled list
3. Split (image and text)
4. Full-bleed image band
5. Statement band
6. Listing or event grid (where cards are allowed)
7. Feature or benefit content
8. Forms
9. Admin screens
10. Navigation and footer

## 1. Hero

One idea. A large Fraunces headline, one short supporting sentence in Instrument Sans, one primary button. Use real photography (full-bleed or a large split) rather than a decorative background. Play the single entrance animation here and not on every later section. No gradient overlays to make text readable: choose a photo with calm areas, or place text on a solid band beside the image.

## 2. Ruled list

Replaces most "grid of cards" layouts. Each row is full-width, separated by a 1px border token, with generous vertical padding.

```
-------------------------------------------------------
Title in font-display                     Meta (mono)    ->
Short description in font-ui, max ~65ch
-------------------------------------------------------
Title                                     Meta           ->
Description
-------------------------------------------------------
```

The whole row is the link. On hover, shift the title a few pixels with `transform` or change its color to pink. Do not lift or shadow the row.

Good for: categories, neighborhoods, articles, FAQs, steps, team, press.

## 3. Split

Image on one side, text on the other, 50/50 or 60/40, alternating side only if it helps reading. On mobile, the image stacks above the text with no extra decoration. Keep the image large and unframed.

## 4. Full-bleed image band

A full-width photo with generous height and no text on it, or with a short caption below on a solid band. Gives the page room to breathe between dense sections. Use at most once or twice per page.

## 5. Statement band

A band (cream or ink) holding one large Fraunces sentence and nothing else, or a sentence with one button. Use for a mission line, a pull quote or a call to action. Not for statistics dressed up as a "big number with a small label", which is a default treatment.

## 6. Listing or event grid (where cards are allowed)

A listing, event or place is a real object, so a card-like unit is fine here. Rules:

- Image first, large, with the radius token for media
- Title in `font-display`, a line or two of metadata in `font-mono-label` or `font-ui`
- No border plus shadow plus rounded corners stacked together. Pick image-led with no container, or a hairline border, never both heavy and soft.
- Hover: slight image scale via `transform` inside an overflow-hidden frame, or title color change. No lift, no glow.
- Do not wrap these in an outer card, and do not repeat the same grid for unrelated content.

## 7. Feature or benefit content

Do not use three equal icon cards. Alternatives: a two-column ruled list with a bold lead-in per row, a split section with one strong image, or a short paragraph of well-set text. If there are really only a few points, prose is fine.

## 8. Forms

Single column, clear labels above fields, solid input backgrounds with a hairline border, pink focus ring. One primary button per form. Inline error text in destructive color under the field, with plain instructions. Validate on blur or submit, and keep the submit button label specific.

## 9. Admin screens

Quieter than public pages. Use tables with hairline row dividers, a grey muted header row, and compact spacing. Status badges use the success, warning and destructive tokens as solid fills or tinted outlines, small and consistent. No hero, no decorative motion. Consistency and scanability matter most.

## 10. Navigation and footer

Header: solid background (white, or ink on dark pages), a hairline bottom border that appears after scroll if needed, no blur. Footer: ink band, text in cream, links with a clear hover state. Both are shared and appear on every page, so change them once in the shared component, never per page.
