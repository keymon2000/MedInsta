# Medicine Continuity
### A Retention Recovery Layer for Digital Pharmacy — Product Case Study

**Product:** MedInsta (fictional host pharmacy app) · **Layer:** Medicine Continuity
**Agent:** MediBuddy · **Demo persona:** Tushar
**Prototype:** `app.html` (customer experience) · `ops.html` (internal Operations Console)

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Discover — Research & Root Cause Analysis](#2-discover--research--root-cause-analysis)
3. [Design — Solution & Architecture](#3-design--solution--architecture)
4. [Develop — What We Built](#4-develop--what-we-built)
5. [Success Metrics & Review](#5-success-metrics--review)
6. [Experiment Design](#6-experiment-design)
7. [How We'll Know If This Was a Good Design](#7-how-well-know-if-this-was-a-good-design)
8. [Prototype Guide](#8-prototype-guide)
9. [Appendix — Out of Scope / Future Roadmap](#9-appendix--out-of-scope--future-roadmap)

---

## 1. Problem Statement

Customer retention for an online pharmacy has declined to **20%**.

For this case, retention is operationally defined as the **30-day repeat purchase rate among eligible medicine customers** — i.e., customers who have a recurring medicine need and have purchased at least once before.

The brief does not specify *why* retention has declined. Rather than assuming it is a UI problem or a missing-reminder problem, this case study treats that as a hypothesis to be tested, not a given — and investigates the full repeat-purchase journey: availability, prescription handling, fulfilment, delivery, pricing, and trust.

**Objective:** identify the most likely, highest-leverage causes of churn, and design a product intervention that improves repeat-purchase behaviour without compromising safety, cost, or operational reliability.

### Who this affects

| Audience | Description | Where they show up in this case study |
|---|---|---|
| **Primary: repeat medicine customers** | Adults with recurring medicine needs — some routine (vitamins, OTC), some chronic and prescription-bound (diabetes care, pain management). Demo persona: **Tushar**, who reorders 4 medicines monthly, two of which hit friction every cycle. | Customer app (`app.html`) |
| **Secondary: pharmacy operations / support staff** | The team that has to resolve whatever the automated flow can't — stock exceptions, prescription disputes, delivery escalations. | Operations Console (`ops.html`) |

---

## 2. Discover — Research & Root Cause Analysis

### 2.1 Directional signal, not statistical proof

Early research into public sentiment for digital pharmacies (Trustpilot, Reddit-style review patterns) surfaced recurring themes: delivery delays and vague status communication, repeated support contact without resolution, stock-outs that dead-end the order, and anecdotal pricing/product-condition complaints. These are treated as **directional signal that something in the repeat-purchase journey breaks trust**, not as verified, representative statistics about any specific company.

### 2.2 Hypothesis tree

The 20% figure was decomposed into a hypothesis tree and prioritized by **Impact × Frequency × Confidence × Solvability**, rather than jumping straight to a solution. Every hypothesis below is scoped to something this case study actually addresses with a shipped feature — nothing here is a problem invented to justify unrelated scope.

| # | Hypothesis | Why it plausibly causes churn | Addressed by |
|---|---|---|---|
| **H1** | **Fulfilment & delivery uncertainty erodes trust.** Vague statuses ("your order is delayed") give customers no reason to believe the next order will go better. | Customers don't return when they can't predict or understand what's happening to their order. | Order Trust Timeline, Express Delivery, Operations Console |
| **H2** | **Poor exception recovery is worse than the original failure.** The moment something goes wrong (stock-out, prescription mismatch) is also the moment most reorder flows simply stop and hand the problem to the customer. | A failed step with no recovery path converts a fixable hiccup into an abandoned order. | Smart Reorder exception flow, Smart Prescription Matching, MediBuddy proactive refill check, Operations Console |
| **H3** | **Availability friction restarts the whole journey.** A stock-out on a repeat order forces the customer back to square one — re-search, re-compare, re-decide. | Recurring customers shouldn't have to re-shop from scratch for a medicine they already buy every month. | Smart Reorder, Search & Brand Alternatives, MediBuddy Restock Notify |
| **H4** | **Pricing opacity and switching hesitation reduce confidence.** A customer who doesn't understand *why* a price changed, or isn't sure a cheaper brand is trustworthy, either pays reluctantly or abandons. | Trust in price and trust in an unfamiliar brand are the same underlying problem: "do I understand what I'm being asked to buy." | Transparent Cart, Manufacturer Trust Ratings, Subscribe & Save |
| **H5** | **Passive, pull-only engagement undercuts habit formation.** A reminder that just says "time to reorder" still makes the customer do all the work of discovering what's wrong with the order. | Retention improves when the system does the checking *before* asking the customer to act, not after. | MediBuddy proactive refill check, MediBuddy cart reminder |
| **H6** | **Clinical hesitation at decision moments causes silent drop-off.** A customer unsure whether a substitute brand is equivalent, or whether a symptom needs professional input, doesn't ask — they just abandon. | There is no safety-approved way to resolve clinical uncertainty inline, so the order is simply left incomplete. | Consult a Doctor (contextual placements) |

**Prioritization note:** H2 and H3 scored highest on Impact × Frequency × Solvability and anchor the core experience (Smart Reorder + exception recovery). H1, H4, H5, and H6 are addressed as supporting layers once the core recovery loop was solid.

---

## 3. Design — Solution & Architecture

### 3.1 Product thesis

> Retention in digital pharmacy is not only about getting customers to reorder. It is about making every subsequent order feel **predictable, recoverable, and trustworthy** — and, where possible, resolving problems *before* the customer has to notice them.

### 3.2 Core customer journey

```
Previous order → Smart Reorder → Availability check → Prescription check
   → Exception recovery (if needed) → Transparent price → Checkout
   → Proactive fulfilment updates → Successful repeat purchase
```

The deliberate design choice is that **the recovery layer is the product**, not a side case. A customer hitting a stock-out or a prescription mismatch is shown options and a path forward *before* checkout, instead of discovering the problem after paying or being bounced back to a generic error screen.

### 3.3 FDE-oriented architecture

The prototype is a standalone, self-contained demo (all data in `js/data.js`), but the architecture is intentionally modeled on an enterprise orchestration pattern — connecting existing systems of record via shared workflows and agents, rather than replacing them:

```
Existing Pharmacy Application (MedInsta)
        │
        ▼
Medicine Continuity Layer
        │
        ▼
Continuity Orchestrator (workflow / agent layer)
        │
  ┌─────┼──────────┬──────────────┬──────────────┐
  ▼     ▼          ▼              ▼              ▼
Order  Inventory  Prescription  Fulfilment     Delivery
Service Service    Status        Service        Service
  │     │          │              │              │
  └─────┴──────────┴──────────────┴──────────────┘
                     │
                     ▼
              Audit & Event Layer
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
Customer Experience         Operations Console
  (app.html)                   (ops.html)
                                    │
                                    ▼
                          Human escalation
```

In production, Order / Inventory / Prescription / Fulfilment / Delivery would be real connected systems; for the prototype they're mocked in one data file so the orchestration *pattern* is visible without needing real integrations.

### 3.4 MediBuddy — agent scope & boundaries

Deterministic workflows handle deterministic things. MediBuddy (a floating, proactive assistant — not a chat-everything bot) is used only where there's a genuine "go check this in the background" task:

| MediBuddy does | MediBuddy never does |
|---|---|
| Retrieve previous order, inventory, prescription, fulfilment, delivery status | Diagnose a medical condition |
| Explain current state in plain language ("2 ready, 1 out of stock, 1 needs verification") | Change a dosage or strength, or recommend a different medicine |
| Identify brands with the identical constituent and strength, so the customer isn't blocked by a brand-specific prescription record | Switch brands without the customer explicitly choosing to |
| Proactively flag a restocked item or an abandoned cart | Approve or clear a prescription |
| Initiate approved recovery actions (notify-me, brand switch, add-to-cart) on one tap | Make a clinical decision of any kind |

This boundary is also why **Consult a Doctor is deliberately not a MediBuddy capability** — clinical reassurance is kept as a separate, human-routed panel rather than something an automated agent offers, so the product never blurs "operational assistant" with "medical advice."

---

## 4. Develop — What We Built

Every feature below is live in `app.html` (and, for the Operations Console, `ops.html`). Each is tagged with the hypothesis it addresses.

### 4.1 Smart Reorder & Exception Recovery — *H2, H3*
Reviewing a previous order checks availability and prescription status for every item **before** checkout, instead of letting the customer discover a problem after paying. Two exception types are handled inline:
- **Unavailable item:** customer chooses notify-me / remove / contact pharmacist.
- **Prescription verification:** see Smart Prescription Matching below.

### 4.2 Smart Prescription Matching — *H2*
The highest-friction dead-end in typical reorder flows is a prescription written for one exact brand, blocking any refill until re-verified — even when a pharmacologically identical brand (same constituent, same strength) is available immediately. This feature:
- Surfaces brand alternatives with the **identical constituent and strength**, each independently verified, with manufacturer trust rating and price shown.
- Lets the customer pick a brand with one tap ("Select & Verify") — resolved instantly, no re-upload.
- Keeps upload-prescription / request-pharmacist-help as a fallback for customers who want to keep the exact original brand.
- **Safety boundary:** the system identifies the match automatically; the customer always makes the explicit choice to switch. Dosage, strength, and medicine identity are never altered.

**Where the Rx gate applies, and why it's two different mechanisms, not one inconsistent one:**
- **Refilling a previous order** (Review & Reorder, MediBuddy): there's a known prior prescription on file for a specific constituent. Picking any brand with that same constituent resolves the exception instantly — that's the "no separate verification" shortcut, and it's safe because a valid prescription for that constituent already exists.
- **Browsing the catalog and adding to cart** (Search → Substitutes → Add to Cart): there is *no* prior prescription on file to match against — this is a fresh purchase, not a refill. So Rx-required items (original brand or substitute) are added to the cart freely — matching how most pharmacy apps behave; browsing isn't gated — but the **Bag checkout step** now carries the same Prescription Processing banner as the Transparent Cart, and blocks "Checkout" until every Rx item in the bag is either uploaded (pending pharmacist review) or flagged for pharmacist help. The constituent-match shortcut doesn't apply here, because there's nothing on file yet to match against — that's the correct behavior, not a missing feature.

### 4.3 Transparent Cart — *H4*
Before payment, the cart shows: a running subtotal, which items are included vs. excluded (with the reason), an explicit delta note ("this order is lower because N medicines moved to exception handling"), and a dedicated Prescription Processing banner confirming which items were verified via constituent match vs. still pending pharmacist review.

### 4.4 Order Trust Timeline — *H1*
Replaces a vague "your order is delayed" with a step-by-step status (placed → prescription verified → fulfilment assigned → packed → dispatched → out for delivery) and an expandable, specific delay explanation with an updated ETA — demonstrating *why* something happened, not just *that* it happened.

### 4.5 Express Delivery — *H1*
A Standard (free) vs. Express (+₹49, ~3 hours) choice at checkout, carried through to the order confirmation and order history. A direct monetizable lever for customers who value speed over cost on a given order.

### 4.6 Search, Brand Alternatives & Manufacturer Trust — *H3, H4*
- **Search:** category browsing, a mock recent-search history, and a "trending" row, instead of dumping the full catalog on an empty query.
- **Brand alternatives:** every medicine's product page shows substitute brands sorted by price, with a "Best Price" badge on the cheapest option below the selected brand's price.
- **Manufacturer trust:** every brand — original or substitute — carries a visible star rating and a "Verified Manufacturer" badge, so a cheaper option doesn't read as a riskier option.

### 4.7 Subscribe & Save — *H4*
A One-time vs. Subscribe & Save (extra 10% off, recurring every 30 days) toggle on any medicine or substitute, making the lower-cost repeat-purchase path explicit and easy to opt into at the exact moment of choosing a brand.

### 4.8 MediBuddy — proactive floating agent — *H2, H3, H5*
A persistent bubble (hidden only during an active checkout/resolution flow, so it's never redundant) with three capabilities:
1. **Proactive refill check:** pre-runs the full availability + prescription check in the background and surfaces it as "2 ready, 2 need your input" with one-tap fixes, instead of making the customer open Review & Reorder to find out.
2. **Restock notify:** tapping "Notify me" on an out-of-stock catalog item puts it on a watchlist; when it's back in stock (simulated on a short demo timer), MediBuddy raises a flag with one-tap add-to-cart.
3. **Cart reminder:** if items sit in the cart without checkout for a while (simulated via a short demo timer standing in for "a few hours"), MediBuddy surfaces a personalized nudge to finish the order.

Each nudge type is color-coded (violet = AI brand/constituent recommendations, green = restock alerts, amber = cart reminder) so they're visually distinct rather than blurring together into one undifferentiated panel.

### 4.9 Consult a Doctor — *H6*
Deliberately **not** a MediBuddy capability — a separate, human-routed panel shown at three specific hesitation points rather than as a generic standalone feature:
- **Home screen** — general awareness.
- **Prescription Verification screen** — as a third path alongside "switch brand" / "keep original brand," exactly when the customer is deciding.
- **Substitutes screen, Rx-required medicines only** — right under the alternatives list, where "is this substitute really equivalent" hesitation lives.

The differentiating claim is not "we have teleconsultation" (common in the category) — it's that the prompt appears **at the moment of actual hesitation inside the reorder flow**, not in a disconnected tab.

### 4.10 Operations Console — *H1, H2*
A human-in-the-loop view for the exceptions that need a person: a workflow queue (customer, order, issue, status), an agent-activity / audit trail per order, and resolution actions (Approve / Request info / Escalate) — demonstrating that the automated layer has a governed escalation path, not just a happy path.

---

## 5. Success Metrics & Review

### 5.1 North Star

**Successful Repeat Order Rate** = customers who complete another eligible medicine purchase ÷ customers eligible to reorder.

### 5.2 Supporting metrics

| Metric | Definition | Primarily driven by |
|---|---|---|
| Reorder Conversion Rate | Completed reorders ÷ users entering the reorder flow | Smart Reorder, Exception Recovery |
| Time to Reorder | Time from entering the refill journey to completing it | Smart Reorder, MediBuddy proactive check |
| Availability Recovery Rate | Orders recovered ÷ orders entering a stock-out exception | Search & Brand Alternatives, MediBuddy Restock Notify |
| Prescription Resolution Rate | % of prescription exceptions resolved via constituent match vs. upload vs. help vs. abandoned | Smart Prescription Matching |
| Post-Exception Retention | Do customers who hit a failure still come back next cycle? | All exception-recovery features, Consult a Doctor |
| Cart Recovery Rate | % of MediBuddy cart-reminder nudges that convert to checkout | MediBuddy cart reminder |
| Restock Conversion Rate | % of restock-notify alerts that convert to a completed purchase | MediBuddy restock notify |
| Consult Attachment Rate | % of hesitation moments (prescription screen, Rx substitutes) where Consult is used, and its effect on completion at that step | Consult a Doctor |
| Express Delivery Attach Rate | % of orders choosing Express; incremental revenue/margin impact | Express Delivery |
| Subscribe & Save Adoption | % of eligible purchases converted to subscription; impact on next-cycle repeat rate | Subscribe & Save |

### 5.3 Guardrails — never optimize retention at their expense

Incorrect-order rate · Prescription compliance · Refund rate · Customer complaints · Support cost per order · Discount / margin impact · Workflow / agent failure rate · Delivery SLA adherence.

---

## 6. Experiment Design

| | Control | Treatment |
|---|---|---|
| **Experience** | Existing reorder experience | Existing experience + Medicine Continuity (Smart Reorder, exception recovery, Smart Prescription Matching, Trust Timeline, MediBuddy, Consult a Doctor) |

**Primary metric:** 30-day repeat purchase rate.
**Secondary metrics:** reorder conversion, time-to-reorder, exception recovery rate, cart recovery rate, post-exception retention.
**Guardrails:** order accuracy, refunds, complaints, prescription compliance, contribution margin.

This prototype does not claim to have already increased retention. It presents a testable hypothesis — that reducing friction and resolving exceptions proactively improves repeat-purchase behaviour — to be validated through controlled experimentation, not assumed from the design alone.

---

## 7. How We'll Know If This Was a Good Design

Per feature, a concrete bar for "this is working" — and the inverse, a reason to reconsider it:

| Feature | Success looks like | Reconsider if |
|---|---|---|
| Smart Prescription Matching | Constituent-match becomes the majority resolution path for prescription exceptions, with no rise in prescription-related complaints | Upload/help remains dominant, or compliance complaints increase |
| MediBuddy (all 3 capabilities) | Measurable lift in Reorder Conversion and Cart Recovery vs. control, with low agent-failure rate | Workflow failure rate is high, or customers dismiss/ignore the bubble at a high rate |
| Consult a Doctor | Non-trivial attachment rate at the two in-flow placements (not just the Home panel), correlated with higher completion at that step | Usage only happens on Home (i.e., the "contextual" thesis is wrong) |
| Transparent Cart / Manufacturer Trust | Checkout abandonment at the cart step decreases, especially for orders containing substitutes | No measurable change in abandonment — would suggest trust wasn't the actual blocker |
| Trust Timeline / Express Delivery | Post-exception retention improves; Express attach rate justifies its margin cost | Express is rarely chosen, or support contacts about delivery don't decrease |

The overarching review question for this case study: **did narrowing the problem to "predictable, recoverable, trustworthy" (rather than "add a reminder") produce features that map cleanly to measurable outcomes?** Section 5–7 above are the test of that — every feature has a named metric and a named failure condition, not just a feature description.

---

## 8. Prototype Guide

No build step — open directly in a browser.

```
Medicine-Continuity/
├── app.html          Customer mobile experience (the only HTML/CSS/JS deliverable
│                     meant to represent the actual product)
├── ops.html          Internal Operations Console (human-in-the-loop demo)
├── css/
│   ├── styles.css     Shared design tokens + ops.html top nav
│   ├── app.css        Mobile app / phone-frame styling
│   └── ops.css        Console styling
├── js/
│   ├── data.js        All mock data (orders, catalog, manufacturers, workflows)
│   ├── app.js         Customer app state machine + rendering
│   └── ops.js         Console rendering + mock resolution actions
└── README.md          This document
```

**Suggested walkthrough order:**
1. Home screen — note the "What's New" card and the MediBuddy bubble (watch for its red dot).
2. Review & Reorder → Resolve & Continue — walk through the unavailable-item exception, then the Smart Prescription Matching screen (note the Consult a Doctor option there).
3. Transparent Cart — Prescription Processing banner, delivery speed toggle, Confirm & Pay.
4. Trust Timeline — expand "why is my order delayed."
5. Search tab → open a prescription-required medicine (e.g. Flexonorm or Glucofit) → note Manufacturer Trust + Best Price badge + the Consult a Doctor prompt under Rx substitutes → Add to Cart.
6. Cart tab → note the Prescription Processing banner and the disabled Checkout button → resolve it via Upload or Request help → Checkout re-enables. This is the *fresh-purchase* path, deliberately separate from the refill path in step 2 (see §4.2).
7. Tap the MediBuddy bubble directly to see the proactive refill check panel.
8. `ops.html` — the Operations Console, for the human-in-the-loop story.

All medicine names, prices, and customers are fictional demo data.

---

## 9. Appendix — Out of Scope / Future Roadmap

Ideas discussed as logical extensions of this architecture but **not built** in this prototype — listed to show the roadmap, not claimed as shipped:

- **Price/Trust Watchdog Agent** — proactively explain a price change *before* checkout rather than leaving the customer to notice it at the cart (extends H4).
- **Delivery Exception Recovery Agent** — make the Trust Timeline actively self-healing (auto-reassign fulfilment and notify) rather than a passive status display (extends H1).
- **Post-Exception Win-back Agent** — a scheduled follow-up a few days after any resolved exception to confirm it didn't recur, closing the loop on the Post-Exception Retention metric rather than only measuring it reactively.
- **Prescription Renewal Agent** — track prescription validity windows and proactively initiate renewal before it lapses into a verification exception at all (shifts Smart Prescription Matching from reactive to preventive).
- **Household / Multi-Profile Management** — consolidate reorders across family members into optimized, fewer deliveries.
