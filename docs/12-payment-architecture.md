# 12. Payment Architecture

## 12.1 Principles

1. **The client never asserts payment state.** `subscriptions.status` and
   `payments.status` change only inside signature-verified webhook handlers or admin
   actions with an audit trail.
2. **No card data touches our servers.** Stripe holds the instruments; we store
   `provider_*` references.
3. **Prices are configuration.** `subscription_plans.prices` is
   `{"USD": {"month": 999, "year": 7999}, "EUR": {...}}` in the database and cached via
   remote config. Changing a price is a data change (§37).
4. **Money is integer minor units + ISO-4217 currency**, everywhere, always.

## 12.2 Two payment domains

| Domain | Provider path | Notes |
|---|---|---|
| **Subscriptions** | Stripe Billing on web; StoreKit / Google Play Billing in the native apps | Store rules require IAP for digital subscriptions. `subscriptions.platform` records the source, and entitlement is unified server-side by a receipt/webhook verifier per platform. |
| **Marketplace (tutoring)** | Stripe Connect (destination charges with `application_fee_amount`) | Real services delivered by a third party — outside IAP scope — so card/Apple Pay/Google Pay via Stripe. |

`entitlements()` in core resolves the effective plan from whichever source granted it, so
the rest of the app asks "can this user do X?" and never "which store did they buy from?".

## 12.3 Subscription flow (web/Stripe)

```
app → stripe-checkout (Edge) → creates Checkout Session (price from DB, customer from profile)
                              ← url
app opens checkout → Stripe → webhook: checkout.session.completed
                                       customer.subscription.updated|deleted
                                       invoice.payment_failed
   webhook (verifies signature) → upsert subscriptions + payments → entitlement refresh
```

Native IAP: the app sends the store receipt/purchase token to `iap-verify`, which
validates it with Apple/Google server-to-server and writes the same `subscriptions` row.
Renewals arrive as store server notifications.

## 12.4 Marketplace flow

```
booking-create → PaymentIntent {
    amount: price_cents,
    application_fee_amount: round(price_cents * commission_bps / 10000),
    transfer_data: { destination: teacher.stripe_account_id },
    metadata: { booking_id, learner_id, teacher_id, commission_bps }
}
webhook payment_intent.succeeded → booking.status = 'confirmed'
                                 → payments row 'succeeded'
                                 → teacher_balances.pending_cents += earnings
booking completed + hold period  → pending → available
payouts-run (scheduled)          → Stripe transfer/payout → payouts row
```

The hold period (default 24 h after lesson end, configurable) exists so a dispute can be
resolved before money leaves the platform.

Teacher onboarding uses Stripe Connect Express: `stripe-connect` creates the account link;
`account.updated` webhooks set `payout_enabled`. A teacher without payout capability can
be listed as "coming soon" but cannot be booked.

## 12.5 Currency (§67)

Supported: USD, CAD, GBP, EUR, AUD, JPY, MXN, BRL. `core/pricing/currency.ts` holds the
minor-unit exponent per currency (JPY = 0), formatting via `Intl.NumberFormat`, and a
`priceFor(plan, currency)` resolver that falls back to USD when a plan has no explicit
price in the requested currency. Teachers are paid in their account's currency; conversion
is Stripe's, and the applied rate is recorded on the payment.

## 12.6 Refunds, disputes, chargebacks

`refund-process` applies the policy outcome from core, calls Stripe
(`refund` + `reverse_transfer` where the transfer already happened), writes `refunds`, and
adjusts `teacher_balances`. Chargebacks arrive as `charge.dispute.created`, open a
`disputes` row, freeze the affected balance, and notify admin. All state transitions are
audit-logged with the actor.

## 12.7 Referrals and promotions (§40)

`referrals` links referrer → referee with a code, a state machine
(`created → signed_up → qualified → rewarded`) and fraud flags. Qualification requires
real activity (e.g. referee completes N lessons across M distinct days) before either side
gets the reward, which blocks self-referral farms. Device/IP heuristics and a per-account
reward cap live in `remote_config`. Rewards (default 7 days Premium each side) are
configuration.

## 12.8 Failure states the UI must show honestly

`payments_not_configured`, `payout_account_incomplete`, `card_declined`,
`subscription_past_due`, `refund_pending`, `dispute_open`. Each maps to a specific screen
state with a real next action — never a silent failure or a fake success.
