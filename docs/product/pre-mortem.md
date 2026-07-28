# Pre-Mortem: Beff Pre-Launch MVP

Written before implementation, using the `before-you-build` risk framework.

The assignment asks for a landing page and onboarding flow "to support early user
acquisition". That framing contains a product hypothesis worth examining before writing
code, because the hypothesis — not the code quality — is what usually kills a pre-launch
MVP.

---

## Risk verdict

**Medium-high.** The engineering is well understood; the demand signal is not. A
pre-launch landing page plus waitlist is cheap to build and easy to get wrong, because
it validates *interest in a description* rather than *willingness to change behaviour*.
For an industrial B2B buyer with a 6–12 month procurement cycle, a waitlist signup is
very weak evidence.

---

## Riskiest assumption

**That battery process engineers will hand over production data to an external SaaS.**

Everything else in the product depends on this. Cell manufacturing data is among the
most commercially sensitive data a battery company holds — yield and scrap figures
expose process maturity, cost structure and competitive position. A plant manager who
likes the product may still be unable to authorise the data flow.

Secondary, and nearly as dangerous: **the data may not be reachable.** Line data
frequently sits in an OT network deliberately air-gapped from IT, in vendor-specific
MES or historian systems. "Connect your line" can be a six-month integration project,
not an onboarding step.

---

## Evidence to find first

Cheapest signals, in order:

1. **Five conversations with process engineers** about what they currently do when yield
   drops. If the answer is "export from the MES into Excel and email it around", the
   pain is real and the wedge is the export, not the dashboard.
2. **One question added to the waitlist form:** *"Where does your line data live today?"*
   Free-text. The distribution of answers tells you whether integration is a connector
   problem or a bespoke-services problem — which decides whether this is a software
   business or a consultancy.
3. **Whether anyone asks about on-premise or self-hosting.** If most do, the SaaS
   delivery model itself is the constraint, and that changes the architecture, not the
   copy.

---

## Do next

Ship the landing page, but make the waitlist **earn information** rather than just
collect an address. Role, plant stage (pilot vs production) and "where does your data
live" cost the user ten seconds and are the difference between a vanity list and a
qualified one.

Instrument which feature block people actually read before converting. If everyone
converts on "scrap cost" and nobody on "CO₂ reporting", that is your positioning,
discovered rather than assumed.

---

## Delay

- **Real data ingestion / connectors.** The most expensive thing to build and the most
  likely to be wrong. Mocked metrics are sufficient until at least one design partner
  has committed to a specific data source.
- **Billing and pricing.** No price survives contact with the first enterprise
  procurement conversation.
- **Multi-tenant org hierarchy** (plants → lines → teams → roles). Tempting to model
  fully now. Until a real customer describes their actual structure, it is speculative
  complexity. Single-user accounts with a `plant` and `line_count` field are enough.
- **Alerting and thresholds.** Meaningless until someone tells you what "bad" is on
  their line.

---

## How this shaped the build

This is not a document written to be filed. Three concrete decisions came out of it:

1. The waitlist captures **role and company**, not just email — qualification over
   volume.
2. The dashboard uses **mocked-but-plausible** data served from a real API, so the
   ingestion question stays deliberately open while the contract is still exercised.
3. The onboarding wizard collects **plant and line setup**, which is the cheapest way to
   learn what customer structures actually look like before committing to a data model.
