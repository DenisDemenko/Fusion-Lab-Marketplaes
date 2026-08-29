# Case Study: Orchestrating a Marketplace Build with Claude Code

*Written 2026-08-29, covering the Fusion Lab Marketplace build from its
2026-08-25 planning session through Phase 3. Companion to
[`ROADMAP.md`](../ROADMAP.md) and [`docs/adr/`](adr/) — those record
*what* was decided; this records *how* the work was actually run as a
human/AI-agent collaboration, for the "AI Agents orchestration" line
on the target job posting.*

## The shape of the problem

This repository is a full marketplace — catalog, cart, checkout with a
real payment provider (LiqPay), seller payouts, promo codes, a loyalty
program, a referral system, reviews, two-way chat, an AI shopping
assistant, and a bidirectional bridge to a sibling project
(`Book_Creality`) — built end-to-end by one person directing Claude Code,
across 33 commits, 4 delivery phases, and roughly a week of wall-clock
time. The interesting part isn't that an AI wrote the code; it's the
operating model that made a single person's judgment scale across a
project this size without the codebase drifting into inconsistency or
the human losing track of what was actually verified versus merely
claimed.

## Plan before building, in writing

The project didn't start with a prompt like "build me a marketplace." It
started with a planning session (`/grill-with-docs`, 2026-08-25) that
produced `ROADMAP.md` and `CONTEXT.md` *before any code existed* —
domain glossary, phase boundaries, and an explicit quality bar
("functional, test-verified execution of every download, every course
publication, every button") to hold subsequent work to. Every phase
after that opened by reading those documents, not by re-deriving scope
from scratch in conversation. That single choice is most of why 33
commits across several working sessions stayed coherent: the plan was a
file in the repo, not a memory that had to survive context compaction.

## The recurring loop: build, verify independently, record the decision

The same three-step loop repeats at every scale in this project, from a
single service method to a 27-page frontend restructuring:

1. **Build** against the plan.
2. **Verify independently** — not by asking "did that work?" but by
   re-running the actual check (test suite, typecheck, a live HTTP
   request, a browser navigation) myself, even when a subagent had
   already reported success.
3. **Record the decision** where a future reader (human or AI) can find
   it — an ADR for an architectural choice, a `ROADMAP.md` checkbox with
   a one-line justification for a scope choice.

Step 2 is the one that's easy to skip and expensive to skip. Two
concrete examples from this build:

- **The i18n conversion caught a bug precisely because verification was
  independent of the work.** Converting 27 route pages and 20+
  components to `next-intl` was mechanical enough, and the pattern
  well-established enough after the first ~14 components, to hand to a
  background subagent with a fully-specified pattern and an explicit
  instruction to run `typecheck`/`eslint`/`build` before reporting done.
  It came back green. But `typecheck`/`build` only prove the code
  compiles — they can't catch that `routing.ts` was calling
  `defineRouting()` without the `localePrefix: "as-needed"` option its
  own code comment promised, so Ukrainian (the default locale) was
  silently getting an `/uk/...` prefix instead of none. That only
  surfaced by actually loading the page in a browser and reading the
  rendered links — a check the subagent's own report hadn't run, and one
  I ran myself rather than trusting "build succeeded" as "feature
  correct." Two different failure classes; only one is visible from a
  green CI status.
- **A discovered environment constraint changed the verification
  strategy instead of being quietly ignored.** Early live-browser testing
  of authenticated flows was flaky in a way that didn't match the code.
  Root cause: the host machine's clock runs about 59 minutes fast —
  confirmed by comparing local time to `google.com`'s HTTP `Date` header
  — which makes any real Firebase ID token look expired to
  `firebase-admin`'s local verification almost immediately. Rather than
  either ignoring the flakiness or reporting untested authenticated
  flows as done, the fix was architectural: a `TokenVerifier` DI seam
  (`TOKEN_VERIFIER` token) that lets the e2e suite substitute a
  deterministic stub for Firebase verification. Authenticated-flow
  coverage stayed real and automated (72 e2e tests, all touching
  real database transactions) instead of silently degrading to "looks
  fine when I click it," and the limitation is written down in
  `ROADMAP.md` rather than hidden.

## Delegation: subagents for well-specified mechanical work, not for judgment

Background subagents did real work in this build — most visibly, the
i18n conversion — but the split of labor was deliberate:

- **Kept in the main thread:** anything requiring a judgment call with
  consequences that are expensive to undo — which locale should carry
  the URL prefix, how a referral bonus should be idempotent against
  LiqPay's retry behavior, whether a scaling axis (AWS, Elasticsearch,
  Kafka) is worth doing now versus documenting for later. These are
  exactly the decisions that ended up in ADRs.
- **Delegated to a subagent:** work where the pattern was already proven
  by hand on a representative sample, and the remaining work was
  applying that pattern at volume with low judgment variance per
  instance — converting the *next* 27 nearly-identical page files to a
  pattern already validated on the first 14 components.
- **The delegation prompt did the hard part up front.** The subagent
  wasn't told "convert these files to use i18n" — it was given the full
  established pattern with real before/after code from already-converted
  files, the exact list of files split by client/server component type,
  the specific breaking change to route around (`KIND_LABELS` and its
  siblings had just been deleted from `format.ts`), and an explicit
  closing instruction to run and fix `typecheck`/`eslint`/`build` before
  claiming completion. A vague prompt would have produced 27 files of
  inconsistent judgment calls; a fully-specified one produced 27 files
  indistinguishable in style from the ones written by hand.

## Correctness discipline that shows up in the diffs, not just the process

Orchestration isn't only about task management — it also shows up as
consistent engineering judgment applied across a large, AI-written
surface area without a human reviewing every line:

- **Idempotency via guarded `updateMany`**, not application-level
  locking, everywhere a webhook or race condition could double-apply an
  effect: promo-code redemption (`PromoCodesService.resolveForCheckout`)
  and referral-bonus award (`ReferralsService.maybeAwardBonus`) both use
  a `WHERE` clause that only succeeds once, so LiqPay retrying its
  payment callback for hours can never double-award a bonus or
  over-redeem a limited code.
- **Prisma transaction-client threading** (`tx: Prisma.TransactionClient`
  passed explicitly through service methods) for every multi-step
  operation that must be atomic — checkout's stock reservation + promo
  redemption + loyalty spend, and payment confirmation's entitlement
  grant + loyalty earn + referral bonus — so a crash mid-operation can't
  leave the order and the ledger disagreeing.
- **Money as integer minor units** throughout, never floats, closing off
  an entire class of rounding bugs before it could start.

None of this was prompted per-instance; it's the kind of default that
has to be established once and then actually held to across 33 commits,
which is again a verification problem as much as a code-generation one.

## The numbers

| | |
|---|---|
| Delivery phases | 4 (foundation → MVP → marketplace depth → i18n & scaling docs) |
| Commits | 33 |
| Architecture decisions recorded | 6 ADRs (`docs/adr/0001`–`0006`) |
| Automated tests | 72 e2e + 10 unit, all against a real Postgres instance |
| Roadmap items closed | 34 |
| Frontend i18n surface | 27 routes × 2 locales, 20+ shared components, 457 translation keys per locale |
| Known, documented, unresolved limitation | host clock skew (~59 min) breaks live Firebase-token testing — worked around via a test-only DI seam, not hidden |

## What this doesn't claim

This case study is deliberately not a claim that AI orchestration
replaces review — it's a record of *what independent verification
actually caught* when it was done, twice: once by a subagent's own
closing checks, and once again by re-running those checks from outside
the subagent's context before trusting its report. The `localePrefix`
bug is the useful data point here, not the tests that passed on the
first try: verification that only re-confirms what the builder already
believes is verification in name only. The Phase 3 scaling document
(`docs/adr/0006-showcase-scaling-path.md`) applies the same standard to
itself — it documents load-testing methodology and predicted bottlenecks
from code review, and says plainly that no load test was actually run,
rather than blurring the line between "designed" and "executed."
