-- tests/fixtures/vulnerable-app/supabase/migrations/001_create_tables.sql
-- Intentionally vulnerable for testing

CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Missing: ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  amount INTEGER,
  status TEXT DEFAULT 'pending'
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Bad RLS policy: auth.uid() IS NOT NULL (logical bypass)
CREATE POLICY "Anyone logged in sees all orders" ON public.orders
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Bad RLS policy: USING (true)
CREATE POLICY "Open insert" ON public.orders
  FOR INSERT WITH CHECK (true);
