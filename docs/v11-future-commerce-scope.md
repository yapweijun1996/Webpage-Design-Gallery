# V11 future commerce boundary

Decision date: 2026-11-15. Reviewed baseline: application 1.1.41, commit
`32287f1fe116ad810337bd79ac25c1ac4b0511bc`. This document completes the scope-definition
task. It does not authorize or implement a merchant integration.

## Current decision

Keep V11 a discovery demo. Preserve the quantity-only Demo bag, physical pickup,
pushable 3D cart, product information and external official eShop links. Defer any
real-commerce implementation to a separate owner-approved brief and delivery task.
There is no current requirement to invent a checkout, login, Rewards or stock UI.

| Existing feature | Meaning and boundary |
| --- | --- |
| Demo bag | Four allowed local product IDs, integer quantities 0–9; session storage with memory fallback. No price, order or payment. |
| Physical pickup | A temporary reservation of one rendered can in the scene; unrelated to merchant inventory or the Demo bag quantity. |
| Pushable cart | An optional movement simulation using the same Demo bag. Its model download is an asset read, not a commerce request. |
| Shelf Add | Changes the Demo bag quantity only; creates no stock reservation or order. |
| Official eShop link | A normal external link. The current demo does not transmit its selection, identity or payment details as a checkout. |
| Product artwork | Verified record/packshot provenance and disclosed conceptual GLBs. AI label candidates and estimated wraps are not packaging masters or merchant catalogue authority. |

Current source owners: [Demo bag](../demos/corporate/gjh/v11/assets/demo-bag.js),
[physical products](../demos/corporate/gjh/v11/assets/products.js),
[pushable cart](../demos/corporate/gjh/v11/assets/push-cart.js),
[UI handoffs](../demos/corporate/gjh/v11/assets/ui.js) and
[external links and records](../demos/corporate/gjh/v11/index.html).
Historical wording reconciliation remains in
[the redesign report](gjh-v11-mobile-redesign-gap-report.md#commerce-wording-reconciliation--2026-11-14).

## Separate future proposal

A future proposal must choose one explicit outcome before engineering starts:

1. Continue external browsing with the present links. This is the current default
   and needs no additional commerce infrastructure.
2. Propose an official merchant handoff for selected products. First obtain the
   merchant's supported interface, permission and local-to-merchant SKU mapping.
   Do not assume a link format, shared session or accepted quantities. The merchant
   must resolve its own current price and availability; a demo quantity is advisory.
3. Propose a real catalogue/order service. This is a separate product and backend
   scope with a named merchant owner, operating environment, cost boundary and
   explicit authorization. Do not extend browser storage into an order database.

No option above is silently selected for implementation by completing task.md.
No present merchant API contract or merchant account access has been supplied.

The new brief must settle supported products and regions, catalogue authority,
price/currency and availability ownership, fulfilment and customer-support owner,
identity/payment handoff, required customer data, retention/access rules, operating
costs, rollback and who may publish the change. These are unresolved inputs, not
facts to estimate from this demo. Secrets belong in an approved server-side
secret mechanism; customer/payment data must not enter public Git or reusable
agent memory.

## Engineering boundary and future acceptance

Keep presentation/gameplay separate from commerce state. The current modes
controller continues to own input suspension; simulation geometry, pickup and
Cart state must never confirm a purchase. Local IDs identify demo records only;
an approved mapping is required before treating them as merchant IDs.

For any future transactional integration, an authoritative server/merchant must
validate product IDs, allowed quantities, prices, inventory and order transitions.
Define duplicate-request handling, expired offers, network/retry behavior and
reconciliation before enabling order submission. Browser-supplied totals and a
successful animation cannot be an order receipt. Retain a clear boundary between
external navigation, pending submission and merchant-confirmed success.

Acceptance for that separate change must include the merchant's sandbox contract,
success/failure/cancellation/duplicate flows, identity and data boundaries, keyboard
and touch journeys, safe recovery, monitoring and a reversible release. Production
accounts, charges, customer collection, stock writes and actual orders require
explicit authorization for that later scope. This documentation adds none of them.

## Verification of this decision

Compared the table with the current source owners and the existing Shelf/Bag/Cart
contracts. Only scope documentation and its task checkbox change. Runtime files,
application version/build, product records and external links remain unchanged.
Generation consistency, relative document links, focused diff/credential review
and independent read-only scope review form the documentation completion gate.
Physical-device and complete packaging acceptance remain separate open tasks.
