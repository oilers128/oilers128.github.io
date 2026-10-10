# Plushie Pop

Single-file, GitHub Pages pretend plushie shop. The published entry point is
`index.html`; there is no frontend build step. Product photos remain embedded.
Coins, stock, player names and collections are shared through the Plushie Pop
Supabase project `hvvtnbikdbsinwwftgdw`.

## Checks

Use Node 24.15 or newer. From this directory, run `npm ci` and `npm test`.
The jsdom regression suite mocks the API and does not create real players,
spins or purchases. It covers signup and failure handling, avatars, account
switching, admin navigation, wheel outcome alignment and cooldown, polling,
search focus, duplicate clicks, checkout, collections, and offline behavior.
It does not replace visual browser or multi-device testing.

## October 10 repair

- Removed a duplicate, obsolete app pasted after the closing HTML tag.
- Preserved all fourteen photos; shared product rows are the inventory source.
- Kept background refreshes from restarting wheel animations, stealing search
  focus, resetting the selected player's collection, or changing the active tab.
- Made the eight labeled wheel segments match the server prize, with a live
  cooldown countdown. Server-side cooldown remains authoritative.
- Added profile cancel/sign-out controls and server-confirmed saves. Failed
  saves retain the existing account. Avatar changes now persist on the server.
- Removed the inactive local product editor and local tax control. Inventory
  remains read-only, and checkout uses pretend coins without tax.
- Disabled shopping when stock cannot be refreshed, guarded repeated purchase
  clicks, and required review when the displayed checkout cart/total changes.
- Rejected null/malformed carts and fractional product prices at the database.
  See `database/repair_purchase_validation.sql`, applied through Supabase MCP
  as migration `repair_plush_purchase_validation`.

Database verification used transaction-rolled-back fixtures: zero starting
coins; avatar persistence; malformed/duplicate/unknown item rejection; valid
wheel prizes and cooldown; successful balance/stock/collection updates;
insufficient funds, overselling, and fractional-price rejection. Existing
players, balances and stock were preserved. Order sequences may have gaps
because PostgreSQL sequences are not rolled back.

## Remaining design limitations

Nickname-only profiles are intentionally retained, not secure authentication.
Anyone knowing a nickname can use that player's coins or spin allowance. The
Nora name controls navigation only; it is not an authorization boundary.
Player lists, collections, balances and pretend order history remain publicly
readable. Do not use real names, sensitive information or real payments.
Supabase advisors flag the public SECURITY DEFINER game functions for this
reason. See https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

Uploaded avatars stay on the current device. Shared avatars are the ten emoji
choices. Names are case-sensitive; changing a name chooses a different player.
Secure owner verification and an account migration require a separate design.
The checkout endpoint is atomic but has no request-id deduplication; after an
ambiguous network failure, review the balance/collection before trying again.
