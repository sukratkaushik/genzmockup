# Tech spec: Supabase Auth + Stripe + server-side generation

This is the corrected version of the earlier spec. Changes versus the first draft are listed at the end.

## Scope
Add accounts, subscriptions and a secure generation backend to the prototype.

## Plans
| Plan | Price | Monthly mockups |
|---|---|---|
| starter | €0 | 15 (watermark) |
| pro | €19 | 200 |
| brand | €49 | fair-use cap (e.g. 1,000) |

Map plans to limits in one server-side constant.

## Database
```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  stripe_customer_id text unique,
  plan text not null default 'starter' check (plan in ('starter','pro','brand')),
  plan_status text not null default 'active' check (plan_status in ('active','past_due','cancelled')),
  stripe_subscription_id text unique,
  created_at timestamptz not null default now()
);

create table public.usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  month text not null,                      -- 'YYYY-MM'
  mockups_generated int not null default 0,
  unique (user_id, month)
);

alter table public.profiles enable row level security;
alter table public.usage enable row level security;

-- SELECT-only. No insert/update/delete policies: writes use the service role.
create policy "own profile read" on public.profiles for select using (auth.uid() = id);
create policy "own usage read"   on public.usage    for select using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.consume_quota(p_user_id uuid, p_month text, p_count int, p_limit int)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  insert into public.usage (user_id, month, mockups_generated)
  values (p_user_id, p_month, 0) on conflict (user_id, month) do nothing;

  update public.usage
     set mockups_generated = mockups_generated + p_count
   where user_id = p_user_id and month = p_month
     and mockups_generated + p_count <= p_limit;

  return found;
end; $$;

revoke all on function public.consume_quota(uuid,text,int,int) from public, anon, authenticated;
grant execute on function public.consume_quota(uuid,text,int,int) to service_role;
```

## Edge Functions
- `generate-mockup`: verify JWT, load plan, call `consume_quota`, call Gemini with the server-held key, refund on failure, apply watermark for starter.
- `create-checkout`: `userId` and email from the JWT only. Create or reuse the Stripe customer, return the session URL.
- `create-portal`: customer ID from the user's own profile, never from the request.
- `stripe-webhook`: verify signature with `STRIPE_WEBHOOK_SECRET`, handle `checkout.session.completed`, `customer.subscription.updated|deleted`, `invoice.payment_failed`. Map **price ID to plan** server-side. Store processed event IDs for idempotency.

## Security checklist
- Gemini, service-role and Stripe secrets only in Supabase secrets.
- Client uses the anon key and RLS only.
- Rate-limit generation per user; cap upload size and validate image type.
- CORS restricted to the app origin.
- Stripe Tax enabled; EU VAT handled through Stripe.

## Cost model (to verify)
The prototype assumes $0.05 per image. Confirm real Gemini image pricing before fixing plan limits. At $0.05, a full Pro month (200 images) costs about $10 against €19 revenue, before payment fees and tax. Consider lower Pro limits, a credit model or cheaper model tiers.

## Changes from the first draft
1. Gemini calls moved server-side (the original allowed a client key).
2. RLS made SELECT-only; the original allowed users to edit their own plan or usage.
3. Plan derived from Stripe price ID, not metadata the client can influence.
4. `consume_quota` made atomic and restricted to `service_role`.
5. `userId` and `customerId` derived from the JWT, not the request body.
6. "Unlimited" Brand tier replaced by a fair-use cap.
