// tests/fixtures/vulnerable-app/src/api/users.ts
// Intentionally vulnerable for testing

import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors({ origin: '*' }));

// SQL injection via template literal
app.get('/api/users', async (req, res) => {
  const id = req.query.id;
  const result = await db.query(`SELECT * FROM users WHERE id = ${id}`);
  res.json(result);
});

// Unprotected webhook
app.post('/api/stripe-webhook', (req, res) => {
  const event = req.body;
  // No constructEvent verification!
  handleEvent(event);
  res.sendStatus(200);
});

// Unsanitized body insert
app.post('/api/orders', async (req, res) => {
  await db.insert(req.body);
  res.sendStatus(201);
});
