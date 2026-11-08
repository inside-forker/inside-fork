# Public site: page structure brief

INSID-252 · 2026-11-08

This brief covers the public pages, one page at a time. It doesn't cover auth, `/dashboard` or `/admin`. The header and footer are already done (INSID-246, INSID-247).

Build every page with the `components/ds` kit and follow `.claude/skills/insidekarachi-design`. After each migration, add the page's files to `design-lint.paths.json`.

**Rules for every page**

- A page keeps its own purpose and content. Don't add events, promos or new sections to pages that don't have them today.
- Fewer, clearer sections. Each section answers one question.
- One memorable element per page, and no two pages share the same one.
- Only content and data that exist in the repo. Hardcoded marketing numbers (12k+, 2,500+, 500K+, 95%) are not real data and are cut wherever they appear.
- White is the default band. Ink is for statement bands. Cream is used at most once per page. Pink is used for actions only, with one pink action per screen.

**Contents**

1. [Events](#1-events-highest-priority): `/events`, `/events/[slug]`, checkout, payment, confirmation, invites
2. [Home](#2-home-)
3. [Places](#3-places): `/listings`, `/listings/[slug]`, `/listing/[slug]`
4. [Search](#4-search-search)
5. [Guides](#5-guides): `/guides`, `/guides/[slug]`
6. [Leaderboard](#6-leaderboard-leaderboard)
7. [Organizer profile](#7-organizer-profile-organizerusername)
8. [For businesses](#8-for-businesses): `/get-listed`, `/membership`
9. [About](#9-about-about), [Contact](#10-contact-contact)
10. [Policies and utility pages](#11-policies-and-utility-pages)
11. [Memorable elements at a glance](#12-memorable-elements-at-a-glance)
12. [Separate issues found](#13-separate-issues-found-not-part-of-the-redesign)

---

## 1. Events (highest priority)

### Where the flow is confusing today

The path today is: event list → event detail → checkout details → payment page → PayFast → success or failed.

| # | Where | Problem |
|---|---|---|
| E1 | `/events` | **Featured events appear twice.** The page removes featured events from the grid list, but `EventsContent` immediately re-filters from `allEvents`, which includes them. So every Spotlight event is repeated in "All events", and the count includes them. |
| E2 | `/events` | **Category filters guess from words.** "Music & Arts" etc. match keywords in the event name or description (in `app/events/page.tsx` and `EventsContent.tsx`). They don't use the event's real `category_id`. A comedy night with "music" in its description lands in Music, and an event with no keyword lands nowhere. |
| E3 | `/events` | **The first screen on a phone has no events.** The hero (eyebrow, title, paragraph, "Find events", "Host an event") fills the viewport. "Find events" only scrolls down. |
| E4 | `/events` | **On phones the filters are a full-screen sheet** ("Filter Events", "Apply Filters"). The date filter is a single-day picker, with no "Today" or "This weekend". The app already moved to chips. |
| E5 | `/events` cards | **No price on the card.** Cards show date · venue · organizer. To learn the price, a visitor has to open each event. |
| E6 | detail → checkout | **Sign-in appears last.** A guest picks tickets, fills contact, holder and question fields, taps "Continue to payment", and only then gets the sign-in modal. |
| E7 | checkout → payment | **The step counts disagree.** Checkout says "Step 1 of 2" (details, then PayFast). `/checkout/payment` then shows a four-step bar: Cart, Details, Payment, Complete. |
| E8 | `/checkout/payment` | **A full page that's only seen for a moment.** It renders an order summary, trust badges and a "Card Payment" card, then auto-submits to PayFast once the form fields load. Visitors see a summary flash, then leave the site. |
| E9 | `/checkout/success` | **The confirmation doesn't say what was booked.** "All Set!" with confetti, a booking reference, a transaction ID and "Status: Paid". There's no event name, date, venue, ticket count or tickets. The next step is "View My Bookings" in the dashboard. |
| E10 | return pages | **Four different "after payment" screens:** `/checkout/success`, `/checkout/failed`, `/checkout/payment/status` and `/tickets/return` ("Payment Status", for gate passes). Each has a different layout and different next steps ("View My Bookings", "Go to Dashboard", "Back to Home"). |

### 1.1 `/events`: what's on

**Visitor wants:** something to do on a given day, and to see quickly whether it's worth it (when, where, price).

**First screen at 390px:** a short title, the date rail, the filter chips, and the top of the first two event cards. At 1440px, the same plus at least one full row of the grid.

| Order | Section | Answers | Notes |
|---|---|---|---|
| 1 | **Title row** | "Is this the events page?" | `Label` "What's on" + `Heading` "Events in Karachi". The paragraph and both hero buttons are cut (E3). "Host an event" moves to a quiet text link at the end of the page (it goes to `/contact`, as today). |
| 2 | **Date rail** (memorable) | "What's on when I'm free?" | See below. It sits under the title and stays sticky under the header while the list scrolls. |
| 3 | **Search + chips** | "Can I narrow it?" | One search field with chips under it: area (from the `location` filter) and category. No sheet or modal on any width (E4). Chips write to the existing URL params, so links keep working. Category chips must come from real categories (E2, see §13). "Clear" appears only when a filter is active. |
| 4 | **Spotlight** | "What's the big thing coming up?" | Only when there are featured events and no filter is active. One wide poster card, or a short row on desktop. Spotlight events don't repeat in the list (E1). |
| 5 | **All events** | "What else?" | A 2-up poster grid on phones and 3–4 columns on desktop, grouped under date headings ("Tonight", "Sat 15 Nov"…) that match the rail. Card: poster, name, date · venue, and a "from Rs X" price or "Sold out" (E5; prices come from the event's ticket types, the same values the detail page uses). The count comes from the deduped list. |
| 6 | **Empty state** | "Nothing matches, now what?" | One line plus "Clear filters". The emoji is cut. |
| 7 | "Hosting an event? Get in touch" | Organizers | A quiet text link to `/contact`. Not pink. |

**Memorable element: the date rail.** A horizontal strip of days starting today, each showing the weekday, the date number in `font-display` and a small event count. It's built from `start_time` of the loaded events, so days with nothing on are dimmed. Tapping a day jumps the list to that day's heading. While scrolling, the rail highlights the day you're on. It uses the existing `date` param, so `?date=` links still work. Nothing else on the site has it.

**Cut or merged:**
- the hero paragraph and buttons
- the full-screen filter sheet
- the separate "All events (N) / Everything coming up in Karachi" header (it merges into the title row)
- the stagger and fade-in delays on the whole list (0.2s and 0.5s)
- the emoji empty state

### 1.2 `/events/[slug]`: event detail

This page was rebuilt in INSID-237 and its structure is mostly right. This pass is about the design system and keeping the buy action reachable.

**Visitor wants:** to decide whether to go, then buy without hunting.

**First screen at 390px:** the poster (capped so the title shows), the title, the date/venue facts, and the sticky booking bar at the bottom. At 1440px: the title across the top, the poster on the left, and the tickets card visible on the right without scrolling.

| Order | Section | Answers | Notes |
|---|---|---|---|
| 1 | **Poster** (memorable) | "What is it?" | See below. |
| 2 | **Title + organizer + share/directions** | "Who's putting it on?" | As today. |
| 3 | **Facts** | "When and where?" | Date, time and venue. The venue line links to directions, as today. |
| 4 | **Tickets** | "How much, and can I get in?" | The tier list with quantity steppers and the Parchi note when it applies. On desktop it's the sticky right card. The one pink action is "Checkout" with the running total. |
| 5 | **About** | "What happens there?" | The description, at prose width. |
| 6 | **Lineup, Good to know** | Only when the data exists | Both hide today because there's no data yet (INSID-242). Keep them hidden. Don't fake them. |
| 7 | **Venue map** | "Where do I go inside?" | Only when `venueMapUrl` exists. |
| 8 | **More events** | "What else is on?" | It stays: this page already has it. 3–4 cards, never the current event. |
| 9 | Report issue | | A quiet link at the end. |

**Keeping buy visible:**
- **Phones:** the `EventBookingBar` is always on screen. Before a ticket is picked it reads "Get tickets · from Rs X" and scrolls to Tickets. After a pick it reads "Checkout · Rs total". It hides the bottom nav, as today.
- **Desktop:** the tickets card is sticky below the 80px header (`top-24` today; keep it clear of the header). If the tickets card is taller than the viewport, the Checkout button stays pinned at the card's bottom edge.
- **When buying isn't possible:** sold out or not on sale yet. The bar shows the reason ("Sold out", "On sale 10 Nov") as plain text, not a disabled pink button.
- **Sign-in status (fixes E6):** if the visitor isn't signed in, show a one-line note under the Checkout button: "You'll sign in before paying." That way checkout doesn't surprise anyone. Better still, ask at the start of checkout (see 1.3).

**Memorable element: the poster as the page.** A large poster with the `rounded-media` radius, with no frame, gradient or glow. On desktop it's the left column's lead image and the tickets card sits beside it. This is the only page where an image this large leads.

**Cut or merged:** nothing new. Keep the "Showcase" layout. Swap `SECTION_TITLE` and the hardcoded sizes (`text-[28px]`, `lg:mt-[72px]`) for `Heading` and the `Section` spacing.

### 1.3 `/checkout`: details

**Visitor wants:** to confirm what they're buying and get through the form quickly.

| Order | Section | Answers | Notes |
|---|---|---|---|
| 1 | **Back + "Step 1 of 2"** | "Where am I?" | Keep it. Make it match the payment screen (E7): both screens say "1 of 2 · Details" and "2 of 2 · Payment". |
| 2 | **Sign-in strip** (guests only) | "Do I need an account?" | **Moved to the top (E6).** One line: "Sign in to book. Your tickets are saved to your account," with a quiet "Sign in" button that opens the existing `AuthModal`. Signed-in visitors see their name and email here instead. |
| 3 | **Resume booking** | "Did I already start this?" | `ResumeBookingCard`, only when it applies. |
| 4 | **Your order** (memorable) | "Is this right?" | `CheckoutTicketCard`. See below. |
| 5 | **Parchi discount** | | Only for Parchi-app arrivals, as today. |
| 6 | **Payment & contact** | "Where do my tickets go?" | `CheckoutContactCard`. |
| 7 | **Who's going** | Holder names, CNIC, questions | Only when the event needs them. |
| 8 | **Sticky "Continue to payment · Rs total"** | | It stays the one pink action. The terms line and "You pay on PayFast in the next step" go directly above it. |

**Memorable element: the order as a ticket stub.** The order card looks like a ticket, as in the app's checkout. It has the event name in `font-display`, date and venue, tier rows, a perforation hairline and the total. It's built with tokens only.

**Cut:**
- the empty "ambient background" wrapper in `app/checkout/page.tsx`
- the `shadow-lg shadow-primary/25` on the pay button
- the arbitrary sizes `h-[54px]` and `text-[28px]`

### 1.4 `/checkout/payment`: handoff to PayFast

**Visitor wants:** to know they're being sent to pay, and how much.

The memory notes mark the app's PayFast screen as off-limits. Treat this page the same way for logic: **do not touch `GoPayFastForm` or the auto-submit**. Change only what renders around it.

| Order | Section | Notes |
|---|---|---|
| 1 | "2 of 2 · Payment" | It replaces the four-step `CheckoutSteps` bar (E7). |
| 2 | **Amount** (memorable) | The total in `font-display` at `display-md`, with the event name and ticket count under it. |
| 3 | "Taking you to PayFast…" | A one-line status from the form's loading state. The retry button shows only if the form fetch fails (as today). |

**Memorable element:** a single large total, the calmest screen in the flow.

**Cut (E8):**
- the order-summary card with separators
- the "Card Payment" card
- the desktop and mobile trust badges

The "already paid" branch (`payment_status === "paid"`) stays, with the same next steps as success (1.5).

### 1.5 After payment: success, pending, failed

**Visitor wants:** proof it worked, their tickets, and what happens at the door.

Make **one confirmation layout** for all three states and reuse it on `/tickets/return` (E10).

| Order | Section | Answers |
|---|---|---|
| 1 | **Status headline** | "Did it work?" Paid: "You're going." Pending: "Payment is processing." Failed: "Payment didn't go through." Shown with a `Label` of the state. |
| 2 | **What you booked** (memorable) | "For what?" The event poster thumbnail, name, date, venue and ticket count. The data comes from the booking. Today the success page receives the booking reference, so this needs a booking lookup; check `/api/checkout/*` and add a ticket if no endpoint returns it (E9). |
| 3 | **Next step** | "Now what?" Paid: one pink "View my tickets" to `/dashboard/bookings`, plus the email-sent line. Pending: "We'll email you when it's confirmed", with a quiet "View bookings". Failed: one pink "Try again" back to `/checkout` (the cart is kept), with a quiet "Contact us". |
| 4 | **Reference** | Booking reference and transaction ID in `font-mono-label`, small, at the bottom. Today they're the main content. |

**Memorable element: the ticket reveal.** The booked event appears as the same ticket stub used in checkout (1.3), now marked "Confirmed". It enters once with `Reveal`. That closes the loop: the stub you checked at checkout is the stub you leave with. It replaces the canvas confetti.

**Cut:**
- the confetti
- "All Set! … amazing experience!"
- the "Transaction Details" card as the main content
- the green badge colours (use the success token from the admin revamp if it ships, or plain text)
- the "Go to Dashboard" and "Back to Home" duplicates

### 1.6 Invites: `/i/[code]` and `/invite/[slug]`

**Visitor wants:** to know they're invited, by whom, and to accept.

1. **Invitation card** (memorable): "You're invited" in `display-md`, the event poster, name, date and venue. It's a personal note in a cream band. This is the page's one cream use, and it's the only page where cream leads.
2. **Accept**: one pink `AcceptInviteButton`.
3. After accepting, `/invite/[slug]` shows the normal event detail (1.2) with the one-ticket limit and no More events, as today.

These files are already in the design lint; this is a layout pass only.

---

## 2. Home (`/`)

Rebuilt 2026-10-01 from the UX review. Keep the order and tighten it.

**Visitor wants:** to find a place, a discount or something to do, starting with a search.

| Order | Section | Answers | Change |
|---|---|---|---|
| 1 | **Hero: headline + search + shortcuts** (memorable) | "What is this, and where do I start?" | Keep the copy "Your next plan starts Inside." and the shortcuts (Places, Bank discounts, Events, Near me, areas). Drop the pink span on "Inside"; the pink is the search action. |
| 2 | Upcoming events | "Anything on soon?" | Keep it, since home already has it. Use the event card from 1.1, so the price shows here too. |
| 3 | Explore categories | "What kinds of places?" | Keep. |
| 4 | Bank discounts | "Does my card get me anything?" | Keep. |
| 5 | Featured listings | "Where's good?" | Keep. |
| 6 | Areas | "What's near me?" | Keep. |
| 7 | ~~Make the most of Inside~~ | | **Cut.** Its three links (Places, Events, Leaderboard) repeat the hero shortcuts and the header. |
| 8 | App showcase | "Is there an app?" | Keep it, as the page's one ink band. It keeps the newsletter (card variant) and "Coming soon" copy as in the repo. |
| 9 | ~~Account shortcuts / business link~~ | | **Merge** the business link ("Get listed") into the footer, which already lists it, and cut the rest. The header already has sign-in. |

**Memorable element: the headline.** "Your next plan starts Inside." set at `display-xl` in Fraunces, with the search box directly under it as the biggest control on the site. No photo: home leads with type and the search box.

---

## 3. Places

### 3.1 `/listings` and `/listings/[slug]` (category)

**Visitor wants:** to browse places of one kind, narrow by area or deals, and compare at a glance.

| Order | Section | Answers | Change |
|---|---|---|---|
| 1 | **Title** | "What am I looking at?" | "All places", or the category's `pageTitle` and `pageDescription` (they already exist for `/listings/[slug]`). |
| 2 | **Category index** (memorable, `/listings` only) | "What kinds are there?" | See below. On `/listings/[slug]` it shrinks to a chip row of the categories. |
| 3 | Filters | "Can I narrow it?" | The existing sort, deals and area filters as chips under one search field. On phones, the same rule as events: no full-screen filter sheet. `FullScreenFilter` goes. |
| 4 | Featured | "Where's good?" | Only with no search and no filter, as today. Featured items don't repeat in the grid below (the grid already passes `excludeFeaturedFromApi`; keep that). |
| 5 | Grid | Everything else | 12 per page with page numbers, as today. |

**Memorable element: the category index.** On `/listings`, the categories (from `categoriesData`) are set as a large `RuledList`: Fraunces names, one per row, with the arrow, full-row links and the hairlines from the kit. It reads like a printed directory index rather than a row of icon chips. Only this page uses type at that size as navigation.

**Cut:** the icon-per-category map (`iconMap`) in the index view, and the gradient and blur styling in the header.

### 3.2 `/listing/[slug]`: place detail

**Visitor wants:** "Is it good, is it open, where is it, can I get a discount?"

**Today:** the hero is an auto-rotating carousel of the same photos the "Photos" gallery shows again below it. When a place has no photos, the hero shows **Unsplash stock images** chosen by category. Deals, which are the reason many people arrive, sit near the bottom, under the menu and the opening hours.

| Order | Section | Answers | Change |
|---|---|---|---|
| 1 | **Photo mosaic** (memorable) | "What's it like?" | It replaces the hero carousel **and** the separate Photos section. Stock fallback is cut; with no photos, show a plain ink panel with the name. |
| 2 | **Name, category, area, rating + share** | "What is it?" | |
| 3 | **Contact & directions** | "How do I get there or call?" | `ListingContact`. On desktop it's the sticky right column, as today. On phones it's a row of Call / Directions / WhatsApp buttons directly under the name. |
| 4 | **Deals** | "Can I save?" | **Moved up** from position 8. `DealsContainer`, only when there are deals. |
| 5 | Opening hours | "Is it open?" | Moved up next to deals. |
| 6 | Menu | Restaurants only | `MenuContainer` and `MenuImagesViewer` merge into one "Menu" section. |
| 7 | Features & amenities | | |
| 8 | Map + branches | "Which branch?" | `ListingMap`, `SiblingLocations` and `ListingBranches` share one section. |
| 9 | Reviews | "What do people say?" | |
| 10 | Similar places | | |
| 11 | Report issue | | A quiet link. |

**Memorable element: the photo mosaic.** One large photo plus up to four smaller ones in a grid that's still (no auto-rotation). Tapping any photo opens the gallery viewer. It's the place equivalent of the event poster, but a grid rather than a single image.

---

## 4. Search (`/search`)

**Visitor wants:** one box that finds a place or an event.

1. **Search field** (memorable), autofocused, with the query from the URL.
2. **Type tabs**: All / Places / Events, as today (they write `?type=`).
3. **Results** as a ruled list: thumbnail, name, type `Label`, and area or date. Events show their date and places their area, so the two read differently in one list.
4. Empty states: "No results" with the query echoed, and "Start searching" before any input. The third state ("Discover Karachi") is cut.

**Memorable element: results that update as you type.** There's no submit step: the list re-sorts live under a very large `display-md` input. The header search on desktop already uses `useSearch`, so this page should feel like that same search, at full size.

---

## 5. Guides

### 5.1 `/guides`

**Visitor wants:** something good to read about the city.

1. Title: `Label` "Guides", plus a one-line description (existing copy).
2. Category chips from `blog_categories`.
3. **Lead guide** (memorable): the newest post, full width.
4. The rest in a 2–3 column grid with page links, as today.

**Memorable element: the magazine cover.** The newest guide fills the width with its cover photo, the title in `display-lg` over a white band below the image (never text on top of the photo), and the date in `font-mono-label`.

### 5.2 `/guides/[slug]`

1. Title, author and date.
2. Cover image.
3. The article at prose width.
4. Back to guides.

**Memorable element: the reading layout.** Prose width, Fraunces headings in the body, and a drop cap on the first paragraph. It's the only page built for long reading.

---

## 6. Leaderboard (`/leaderboard`)

**Visitor wants:** "Who's top, and how do I climb?"

| Order | Section | Change |
|---|---|---|
| 1 | Title + member count | `LeaderboardHero`, using only the real stats it already queries from `leaderboard_cache`. |
| 2 | **Podium** (memorable) | The top 3 for the selected period. |
| 3 | Period tabs + table | All time / This month / This week, then rank 4 onward with page numbers. Rank badges use one neutral style; the "Reddit-style" coloured badge map goes. |
| 4 | How to earn XP | Keep it, short, as a ruled list. |
| 5 | Invite a friend | Keep it, shown only to signed-in visitors. |

**Memorable element: the podium.** Ranks 1–3 shown as big `font-display` numerals with avatar, name and XP. #1 sits tallest in the middle, in the page's one ink band. It's the only page where numbers are the hero.

---

## 7. Organizer profile (`/organizer/[username]`)

**Visitor wants:** "Who is this, and what are they putting on?"

1. **Header**: avatar, name and bio (`organizer_bio`), plus a count of upcoming events.
2. **Upcoming events**: the default and the main content.
3. Past events, behind a "Past" toggle. **Merge "Ongoing" into Upcoming** (an ongoing event is still something you can go to), so the tabs become two.
4. Empty state: one line.

**Memorable element: the poster wall.** Upcoming events shown as a tight grid of posters only. Name and date appear under each poster, not on top. It's the organizer's lineup at a glance.

---

## 8. For businesses

`/get-listed` and `/membership` share one skeleton today: hero, benefits, form, then a CTA band repeating the hero. The CTA sits after the form it points to.

### 8.1 `/get-listed`

1. Title: "Get Your Business Listed Today" (existing), plus one line.
2. **Benefits**: the six existing items (Increased Visibility … Local SEO Boost) as a compact two-column ruled list.
3. **Form** (memorable).
4. ~~Business CTA band~~: **cut**, including its fake stats (2,500+, 95%, 500K+, 24hrs).

**Memorable element: the live preview.** Beside the form on desktop (below it on phones), a listing card fills in as the business types its name, category and area. It uses the same card the listings grid uses, so they see exactly how they'll appear. This is an interactive moment built from fields the form already has.

### 8.2 `/membership`

1. Title: "Elevate Your Business in Karachi" (existing).
2. **Benefits** (memorable).
3. Form.
4. ~~Premium CTA band~~: **cut**.

**Memorable element: the numbered benefits.** The six membership benefits (Advertising Opportunities … Member Events) as 01–06 in large mono numerals, one per row, in an ink band. It reads like a member's prospectus, and it's distinct from get-listed's preview.

---

## 9. About (`/about`)

**Visitor wants:** "Who's behind this, and can I trust it?"

**Today:** two sets of three promises. The hero has "Local First / Trusted Guide / Always Authentic", and the body has "Curated Quality / Community & Trust / Local Focus". They say the same thing twice. There are also four fake stats (12k+, 2.4k+, 95%, 24hrs) and a business CTA.

1. **Mission statement** (memorable).
2. **What we stand for**: one set of three, merging the two sets into the body's wording.
3. A business line: two quiet links, "Get your business listed" and "Premium membership". These are existing links; there's no CTA band.

**Cut:** the stats grid, the hero's "Our Promise" card, and the duplicate promise set.

**Memorable element: the statement band.** The mission text from `AboutBody` set at `display-lg` on ink. The page leads with a single sentence and nothing else on the first screen.

---

## 10. Contact (`/contact`)

**Visitor wants:** the fastest way to reach someone.

**Today:** phone, email and office appear **three times**: the hero cards (Email, Call, Visit, Schedule), "Multiple Ways to Reach Us", and "Visit Our Office". Then the form.

1. Title: "Get in touch".
2. **Ways to reach us**: one ruled list with email (`info@insidekarachi.com`), phone and hours. Each row is a full-width `mailto:` or `tel:` link.
3. Form.
4. **Office map** (memorable).

**Cut:** the hero cards and `ContactInfo`. They merge into item 2.

**Memorable element: the map.** `MapCard`'s office map at full container width, with the address beside it. It's the only page whose big element is a map. (The listing detail map stays a small section, not the lead.)

---

## 11. Policies and utility pages

**Policies** (`/privacy-policy`, `/refund-policy`, `/service-policy`, `/terms-and-conditions`):
- One template: title, "Last updated", then the text at prose width.
- **Memorable element: a sticky contents list** of the section headings on desktop, and a jump menu at the top on phones. For refunds, put the ticket refund section first, because people arrive from checkout.

**Account pages:** `/delete-account`, `/account-deleted`, `/verify-email`, `/verify-otp`, `/forgot-password`:
- One centred column and one action each. No memorable element beyond a clear `display-md` headline.
- These are flows, not destinations.

**`/maintenance` and 404:**
- An ink band with a single `display-lg` line and a link home. No header or footer, as today.

---

## 12. Memorable elements at a glance

| Page | Element | Kind |
|---|---|---|
| Home | "Your next plan starts Inside." at display-xl + the search box | Headline |
| /events | Date rail with counts, sticky, synced to the list | Interactive |
| /events/[slug] | The poster as the page | Big image |
| /checkout | The order as a ticket stub | Object |
| /checkout/payment | One large total | Number |
| Confirmation | Ticket stub reveal, "Confirmed" | Moment |
| Invite | "You're invited" card in cream | Personal note |
| /listings | Category index as a big ruled list | Typography |
| /listing/[slug] | Still photo mosaic | Photo grid |
| /search | Live results under a huge input | Interactive |
| /guides | Magazine lead story | Big photo |
| /guides/[slug] | Reading layout with drop cap | Typography |
| /leaderboard | Podium numerals in ink | Numbers |
| /organizer | Poster wall | Image grid |
| /get-listed | Live listing-card preview | Interactive |
| /membership | Numbered benefits 01–06 in ink | List |
| /about | Mission statement band | Statement |
| /contact | Full-width office map | Map |
| Policies | Sticky contents list | Navigation |

**Ink bands:** footer (every page), home app showcase, leaderboard podium, membership benefits, about statement, maintenance/404. No page has more than one ink band apart from the footer.

**Cream:** only the invite page.

---

## 13. Separate issues found (not part of the redesign)

These should be their own tickets, not fixed inside a page migration:

1. **Leftover temp hack on `/events`.** `app/events/page.tsx` still has a block marked `// TEMP PREVIEW ONLY - revert before commit`. It injects `/tmp-preview-farmhouse.jpg` as the image of event 85. It was committed in `d090394` (2 Aug 2026), and that file is in `public/`.
2. **Events category filter (E2).** Switch the filter from keyword matching to the events' `category_id` and the category tables. This affects both the server query and `EventsContent`.
3. **Booking lookup for the confirmation (E9).** The success screen needs the event name, date, venue and ticket count from the booking reference.
4. **Stock images on listings.** `PremiumListingHero` falls back to Unsplash photos by category. Those pictures don't belong to the place.
