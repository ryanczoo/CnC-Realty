# Smarter Property Search + Apply-Button Filters — Design

Date: 2026-10-15 · Status: draft for Ryan's review

## Goal

Make the property search bars understand what people type the way Zillow does, and make the filter dropdowns work like
Zillow's (a precise Price slider, an Apply button in every dropdown).

**Rule set by Ryan:** Zillow is the standard. If something works on Zillow we do it; if it doesn't, we don't. Every item
below was checked against Zillow on 2026-10-15 (its suggestion list, plus Ryan's and Claude's typed-then-Enter tests).

## Where it applies

| Search bar | Page | Affected |
|---|---|---|
| Hero search | Homepage, desktop + phone | Yes — typed search |
| "Search Here" | Buy page, desktop + phone | Yes — typed search |
| Results-page bar + filter row | `/properties`, desktop + phone | Yes — typed search + filter dropdowns |
| Home-value address bar | Sell page / `/home-value` | **No.** It has its own Mapbox dropdown and address matcher (`AddressAutocomplete`, `lib/home-value-estimate.ts`) and imports none of the files below. A home-value lookup is re-tested before/after anyway. |

## Part 1 — Typed search

### What gets understood

| Typed | Result | Zillow check |
|---|---|---|
| Neighborhood: "Silver Lake", "Koreatown", "Echo Park" | Listings whose MLS neighborhood (area) matches, plus any city match | Suggestion list |
| County: "Orange County", "Los Angeles County, CA" | All listings in that county | Suggestion list |
| "Bay Area" | Listings in the Bay Area counties (list below) | Suggestion list |
| Filler words: "Pasadena homes for sale", "homes near Pasadena" | Same as "Pasadena" | Ryan's test |
| Property type: "condos in…", "townhomes in…" | Location + Type filter | Ryan's tests |
| Price: "under 800k", "Pasadena under 1M" | Location + max price | Ryan's tests |
| Baths: "2 bath homes in Pasadena" | Location + baths filter | Ryan's test |
| Beds shorthand: "3br", "3 bd", "3 bedroom" | Location + beds filter ("3 bed" already works) | Claude's tests |
| Address spellings: "328 North Lincoln Ave", "328 Lincoln Ave", "328 N. Lincoln Ave.", "111 Marguerita Unit 100" | That home | Suggestion list |
| Street + city: "Atlantic Blvd Monterey Park" | Listings on that street in that city | Suggestion list |

**Out of scope (Zillow doesn't, or Ryan declined):** nicknames (LA/SF/OC), DTLA, Inland Empire, San Gabriel Valley, MLS
number, typo correction (visitor's own mistake), "exact city only" (Ryan prefers the broader match — "Pasadena" keeps
including South Pasadena).

### How it works

Two pure, tested functions in `apps/web/src/lib/`, extending the ones that exist today — no new search path:

1. **`buildPropertySearchParams(text)`** (`lib/property-search.ts`, already used by all three bars). Pulls the filter
   words out of the text and turns them into the filter values the page already understands (`minBeds`, `minBaths`,
   `maxPrice`, `propertyType`), strips filler words, and leaves the location as `query`. Because the results come back
   as normal filter values, the matching filter buttons light up gold exactly as if the visitor had picked them.
2. **`buildLocationWhere(query)`** (`lib/property-search-query.ts`, used by the search page and `/api/properties`).
   Turns the location into a database filter, in this order:
   - ZIP code → zip (unchanged).
   - Starts with a house number → **address match**: the house number at the start, the street name anywhere, and the
     unit if given (`Unit/Apt/Ste/#` all mean `#`). Direction words (North→N…) and periods are normalized, and the
     St/Ave/Blvd part is ignored, because stored addresses are written inconsistently ("438 Garfield Avenue",
     "607 Sefton", "221 New #A"). If a city follows after a comma, the city must match too.
   - Ends in "County" → county match. "Bay Area" → county in the Bay Area list.
   - Contains a street-type word (Blvd, St, Ave, Rd, Dr…) with words after it → street + city match.
   - Otherwise → city **or** neighborhood contains the text.

Today's behavior for plain cities, ZIPs, and "City, CA" stays exactly the same (existing tests keep passing).

### Data change (small)

- New column `Property.area` (text, nullable) = the MLS neighborhood label (`MLSAreaMajor`), today buried inside the
  `details` JSON where it can't be searched quickly. Filled once for existing listings from `details`, and by the IDX
  sync for every listing from then on (`lib/idx/field-map.ts`).
- Two new lookup indexes: a text index on `area` (the same kind `city` and `address` already have) and a plain index on
  `county`. `county` already exists and is filled on every listing.
- One migration. Adding a nullable column is instant; the one-time fill runs in batches so the live site is never
  locked.

### Speed and cost

- Parsing the text costs microseconds. Neighborhood and county lookups use indexes, like city does today.
- Neon: about 8.9 GB stored today (~$3.11/month at $0.35/GB-month). The new column (~90 MB) plus the two indexes cover
  all 4.1M rows (Prisma can't declare an index limited to active listings, so a smaller partial index isn't used) →
  roughly 300–450 MB → **~10–15 cents a month**. The one-time fill is a few minutes of compute → a few cents once. Day-to-day search load is unchanged.
- Verified before release: old vs new timings for the search API and the home/Buy/search pages, desktop and phone.

## Part 2 — Filter dropdowns

### Price dropdown (replaces the 5 fixed choices)

- A **two-handle slider** from $0 to $10M+ and **Min / Max boxes** where any amount can be typed (commas added while
  typing — reuses `sanitizeCurrencyInput` / `formatCurrencyDisplay` from `lib/form-validation.ts`).
- Slider steps: **$25K to $1M**, then $100K to $2M, $250K to $5M, $1M to $10M+ (≈67 stops; Zillow uses 57 with the
  same small-then-larger pattern). The step list is one tested function.
- Slider and boxes stay in sync; Min can't exceed Max.
- Built from two standard browser range sliders layered together — no add-on library. Works with touch on phones.
- The Price button keeps its current look: lit gold when a price is set, label stays "Price" (Ryan's call).

### Apply button in every dropdown

Price, Beds, Baths, Type, and For Sale / For Rent each get an **Apply** button at the bottom of the dropdown (bottom of
the slide-up panel on phones), like Zillow:

- Choices inside a dropdown don't change the results until Apply. The current pick shows as selected while choosing.
- Closing without Apply (tap outside, Escape) discards the unsaved choice.
- Apply closes the dropdown and runs one search.
- Typed searches on the results page keep the filters already on and only change what was typed (as today — matches
  Zillow).

**Reuse:** the five dropdowns are copies of the same panel markup today. They become one shared `FilterPanel` (frame,
selected state, Apply button, discard-on-close), so the Apply behavior lives in one place. The existing phone
slide-up styling and `useClickOutside` are reused. This is a deliberate desktop change (approved by Ryan): the dropdown
panels gain an Apply button and the Price panel is new; nothing else on desktop changes.

## Testing

- Unit tests (test-first) for every row in the Part 1 table, the price step list, and the price/box syncing rules.
- Live-data check: each Part 1 example returns the expected listings from the real database.
- Desktop: pixel comparison old vs new on the homepage, Buy page, and search page with dropdowns closed (must be
  identical); dropdowns opened are the approved change and are screenshot-reviewed.
- Phone (320–430px, a tablet, sideways): every dropdown fits, Apply reachable, slider usable by touch, no sideways
  scroll.
- Speed A/B desktop + phone; home-value lookup before/after.

## Build order

1. Typed search + the `area` column (one release).
2. Filter dropdowns: shared panel + Apply, then the Price slider (second release).

Each release is a separate push, with Ryan's go-ahead.

## Open questions for Ryan

1. **Bay Area counties.** Proposed: the standard 9 — Alameda, Contra Costa, Marin, Napa, San Francisco, San Mateo,
   Santa Clara, Solano, Sonoma.
2. **Apply button look.** Proposed: the site's dark pill button, full width at the bottom of each dropdown.
3. **Phrases not yet checked on Zillow** — included only if Zillow handles them: "over 1M", "between 500k and 800k",
   "Pasadena homes for rent" (would switch to For Rent).
