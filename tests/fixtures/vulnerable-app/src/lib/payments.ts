// tests/fixtures/vulnerable-app/src/lib/payments.ts
// This file intentionally contains vulnerabilities for testing

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || "");

const PAYSTACK_KEY = "";

export async function createPayment(amount: number) {
  return stripe.paymentIntents.create({ amount, currency: 'usd' });
}
