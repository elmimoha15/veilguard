// tests/fixtures/secure-app/src/lib/payments.ts
// Properly secured — no hardcoded keys

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function createPayment(amount: number) {
  return stripe.paymentIntents.create({ amount, currency: 'usd' });
}
