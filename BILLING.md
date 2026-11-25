# Monetisation (India)

| Plan | Price (placeholder, add GST as applicable) | Includes |
|---|---|---|
| Free | ₹0 | 5 documents, all analysis engines, bring-your-own AI key, 1 doctor link, 30-day diary |
| Sano Plus | ₹199 / month | 150 managed AI answers, 50 documents, 5 doctor links, 1-year diary |
| Sano Pro | ₹499 / month | 600 managed AI answers, 500 documents, 25 doctor links, unlimited diary |
| Yearly Plus / Pro | ₹1,999 / ₹4,999 | two months free |
| Premium Doctor Report | ₹99 once | trends, cross-specialty links, diary averages (included in paid plans) |
| Labs / clinics / employers | ₹5–15 per report, from ₹3,000 / month, ₹50–100 per employee | `/business` page with calculator and enquiry form |

Edit prices in `src/lib/billing.ts`; the webhook amounts (in paise) must match.

## Demo billing (works today, no payment)
Set `NEXT_PUBLIC_DEMO_BILLING=true`: the Plans page switches plans instantly, labelled "demo". For judging only.

## Direct UPI with manual approval (no gateway, no server)
1. Set `NEXT_PUBLIC_UPI_ID` and `NEXT_PUBLIC_UPI_NAME` in `.env.production`, delete the demo billing line, then deploy again. Use a UPI ID you are allowed to collect business payments on (ideally a merchant UPI ID).
2. Make your account an admin (FIREBASE.md, step 3).
3. The customer scans the QR on the Plans page, pays, and submits the transaction reference (UTR).
4. On **Admin → Payments**, find that reference **and amount in your bank or UPI statement**, then Approve or Reject. Never rely on a screenshot.

Approval gives 31 or 366 days of the plan (renewing the same plan extends it), or one report pass. A reference can be approved only once. Customers see the status on the Plans page; SanoAI does not email them about it.

## Real payments with Razorpay (UPI, cards, netbanking)
1. Create a Razorpay account (KYC is needed for live payments; use **test mode** first).
2. Create two **Payment Pages** (Plus ₹199, Pro ₹499) and put their URLs in `NEXT_PUBLIC_RAZORPAY_LINK_PLUS` / `_PRO`.
3. Deploy `billing/razorpay-webhook-worker` to Cloudflare Workers (free) with secrets `RAZORPAY_WEBHOOK_SECRET`, `GCP_SERVICE_ACCOUNT` and vars `FIREBASE_PROJECT_ID`, `PRICE_PLUS_PAISE=19900`, `PRICE_PRO_PAISE=49900`.
4. Razorpay dashboard → Webhooks → add the worker URL, event `payment.captured`.
5. Optional managed AI: deploy `billing/managed-ai-worker` (secrets `GEMINI_API_KEY`, `GCP_SERVICE_ACCOUNT`) and set `NEXT_PUBLIC_MANAGED_AI_URL`.

Payments are one-time for 31 days of access (no auto-renewal yet; use Razorpay Subscriptions for that).

> Both workers are templates and have **not been run against live Razorpay or Google**. The buyer is matched by email, which is why accounts must verify their email and cannot change the profile email.

## Other revenue ideas
Diagnostic-lab partnerships (report explanation for their patients), clinic pilots, pharmacy referrals, employer wellness packs.

## Extra revenue features
- **Payment pages:** also set `NEXT_PUBLIC_RAZORPAY_LINK_PLUS_YEAR`, `_PRO_YEAR` and `NEXT_PUBLIC_RAZORPAY_LINK_REPORT`. Add webhook vars `PRICE_PLUS_YEAR_PAISE=199900`, `PRICE_PRO_YEAR_PAISE=499900`, `PRICE_REPORT_PAISE=9900`.
- **Sponsor codes (works with no server):** create them on **Admin → Sponsor codes** and hand them out. Users redeem on the Plans page; rules allow each code once.
- **Business enquiries** appear on **Admin → Enquiries**. The form is public and has no spam protection yet (Firebase App Check is not built in, so do not switch on enforcement).

## What is enforced where
Plan, expiry and paid report credits cannot be raised by ordinary users (Firestore rules); only admins, the webhook and sponsor codes change them. Managed-AI usage is writable only by the proxy. Feature limits themselves run in the app, so a determined user could bypass them.
