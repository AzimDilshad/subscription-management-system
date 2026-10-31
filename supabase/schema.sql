-- =====================================================================
-- Brightloop Subscription Management — Supabase schema
-- Run this whole file once in: Supabase Dashboard → SQL Editor → New query
-- =====================================================================

-- ---------- ENUMS ----------
do $$ begin
  create type user_role      as enum ('admin','staff','customer');
  create type billing_period as enum ('daily','weekly','monthly','yearly');
  create type sub_status     as enum ('draft','quotation','confirmed','active','closed');
  create type inv_status     as enum ('draft','confirmed','paid','cancelled');
  create type discount_type  as enum ('fixed','percent');
exception when duplicate_object then null; end $$;

create sequence if not exists sub_seq start 1;
create sequence if not exists inv_seq start 1;

-- ---------- TABLES ----------
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null unique,
  full_name  text,
  role       user_role not null default 'customer',
  created_at timestamptz not null default now()
);

create table if not exists products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null default 'service',
  sales_price numeric(12,2) not null default 0,
  cost_price  numeric(12,2) not null default 0,
  notes       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- e.g. attribute 'Brand', value 'Odoo', extra_price 560
create table if not exists product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  attribute   text not null,
  value       text not null,
  extra_price numeric(12,2) not null default 0
);

create table if not exists taxes (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  rate_percent numeric(5,2) not null check (rate_percent >= 0),
  active       boolean not null default true
);

create table if not exists plans (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  product_id     uuid references products(id) on delete set null,
  price          numeric(12,2) not null default 0,
  billing_period billing_period not null default 'monthly',
  min_quantity   int not null default 1,
  start_date     date,
  end_date       date,
  auto_close     boolean not null default false,  -- closes itself when end_date passes
  can_close      boolean not null default true,   -- may be closed early
  can_pause      boolean not null default false,
  can_renew      boolean not null default true,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table if not exists discounts (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  type            discount_type not null,
  value           numeric(12,2) not null check (value > 0),
  min_purchase    numeric(12,2) not null default 0,
  min_quantity    int not null default 0,
  start_date      date,
  end_date        date,
  usage_limit     int,                      -- null = unlimited
  used_count      int not null default 0,
  applies_to      text not null default 'product' check (applies_to in ('product','subscription')),
  product_id      uuid references products(id) on delete cascade,
  subscription_id uuid,                     -- FK added after subscriptions exists
  active          boolean not null default true
);

create table if not exists quotation_templates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  plan_id       uuid references plans(id) on delete set null,
  validity_days int not null default 30,
  lines         jsonb not null default '[]'   -- [{"product_id":"...","quantity":1}]
);

create table if not exists subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  number             text unique not null default ('SUB-' || lpad(nextval('sub_seq')::text, 5, '0')),
  customer_id        uuid not null references profiles(id),
  plan_id            uuid not null references plans(id),
  status             sub_status not null default 'draft',
  start_date         date not null default current_date,
  expiry_date        date,
  payment_terms_days int not null default 15,
  next_billing_date  date,
  template_id        uuid references quotation_templates(id) on delete set null,
  created_by         uuid references profiles(id),
  created_at         timestamptz not null default now()
);
alter table discounts drop constraint if exists discounts_subscription_fk;
alter table discounts add constraint discounts_subscription_fk
  foreign key (subscription_id) references subscriptions(id) on delete cascade;

create table if not exists subscription_lines (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  product_id      uuid not null references products(id),
  variant_id      uuid references product_variants(id),
  quantity        int not null default 1 check (quantity > 0),
  unit_price      numeric(12,2) not null default 0,
  tax_id          uuid references taxes(id)
);

create table if not exists invoices (
  id              uuid primary key default gen_random_uuid(),
  number          text unique not null default ('INV-' || lpad(nextval('inv_seq')::text, 6, '0')),
  subscription_id uuid references subscriptions(id),
  customer_id     uuid not null references profiles(id),
  status          inv_status not null default 'draft',
  issue_date      date not null default current_date,
  due_date        date not null default current_date,
  period_start    date,
  period_end      date,
  subtotal        numeric(12,2) not null default 0,
  discount_total  numeric(12,2) not null default 0,
  tax_total       numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,
  amount_paid     numeric(12,2) not null default 0,
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  -- THE "never billed twice" guarantee:
  unique (subscription_id, period_start)
);

create table if not exists invoice_lines (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references invoices(id) on delete cascade,
  description text not null,
  quantity    numeric(12,2) not null default 1,
  unit_price  numeric(12,2) not null default 0,
  tax_rate    numeric(5,2) not null default 0,
  amount      numeric(12,2) not null default 0
);

create table if not exists payments (
  id         uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  method     text not null default 'bank_transfer',
  amount     numeric(12,2) not null check (amount > 0),
  paid_on    date not null default current_date,
  note       text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- INDEXES (keeps pages < 2s with thousands of rows) ----------
create index if not exists idx_sub_customer   on subscriptions(customer_id);
create index if not exists idx_sub_status     on subscriptions(status);
create index if not exists idx_sub_nextbill   on subscriptions(next_billing_date) where status = 'active';
create index if not exists idx_inv_customer   on invoices(customer_id);
create index if not exists idx_inv_status_due on invoices(status, due_date);
create index if not exists idx_inv_sub        on invoices(subscription_id);
create index if not exists idx_pay_invoice    on payments(invoice_id);
create index if not exists idx_pay_date       on payments(paid_on);
create index if not exists idx_lines_sub      on subscription_lines(subscription_id);
create index if not exists idx_invlines_inv   on invoice_lines(invoice_id);

-- ---------- ROLE HELPERS ----------
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role in ('admin','staff')) $$;

-- ---------- NEW AUTH USER → PROFILE (always starts as customer) ----------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Only an admin may change anyone's role (= "only admin can add staff")
create or replace function protect_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not is_admin() then
    raise exception 'Only an admin can change roles';
  end if;
  return new;
end $$;
drop trigger if exists trg_protect_role on profiles;
create trigger trg_protect_role before update on profiles
  for each row execute function protect_role();

-- ---------- PAYMENT → INVOICE STATUS ----------
create or replace function apply_payment() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv invoices%rowtype; paid numeric;
begin
  select * into inv from invoices where id = new.invoice_id for update;
  if inv.status = 'cancelled' then raise exception 'Cannot pay a cancelled invoice'; end if;
  if inv.status = 'draft'     then raise exception 'Confirm the invoice before recording payment'; end if;
  select coalesce(sum(amount),0) into paid from payments where invoice_id = new.invoice_id;
  update invoices
     set amount_paid = paid,
         status = case when paid >= total then 'paid'::inv_status else status end
   where id = new.invoice_id;
  return new;
end $$;
drop trigger if exists trg_apply_payment on payments;
create trigger trg_apply_payment after insert on payments
  for each row execute function apply_payment();

-- ---------- INVOICE GENERATION ----------
-- Builds ONE invoice for the subscription's current billing period.
-- Safe to call repeatedly: the unique(subscription_id, period_start) makes it idempotent.
create or replace function generate_invoice(p_sub uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  s subscriptions%rowtype; pl plans%rowtype; d discounts%rowtype;
  inv uuid; l record;
  p_start date; p_end date;
  v_sub numeric := 0; v_tax numeric := 0; v_disc numeric := 0;
  amt numeric; qty numeric; disc numeric; ratio numeric;
begin
  if auth.uid() is not null and not is_staff() then raise exception 'Not allowed'; end if;

  select * into s from subscriptions where id = p_sub for update;
  if not found or s.status <> 'active' or s.next_billing_date is null then return null; end if;
  select * into pl from plans where id = s.plan_id;

  p_start := s.next_billing_date;
  p_end := (p_start + case pl.billing_period
              when 'daily'   then interval '1 day'
              when 'weekly'  then interval '7 days'
              when 'monthly' then interval '1 month'
              else interval '1 year' end)::date;

  -- expired? close instead of billing
  if s.expiry_date is not null and p_start > s.expiry_date then
    update subscriptions set status = 'closed' where id = s.id;
    return null;
  end if;

  insert into invoices (subscription_id, customer_id, issue_date, due_date, period_start, period_end)
  values (s.id, s.customer_id, current_date, current_date + s.payment_terms_days, p_start, p_end)
  on conflict (subscription_id, period_start) do nothing
  returning id into inv;
  if inv is null then   -- already billed: just move the pointer forward
    update subscriptions set next_billing_date = p_end where id = s.id;
    return null;
  end if;

  for l in
    select sl.quantity, sl.unit_price, p.name as pname, v.value as vname,
           coalesce(t.rate_percent, 0) as rate
      from subscription_lines sl
      join products p on p.id = sl.product_id
      left join product_variants v on v.id = sl.variant_id
      left join taxes t on t.id = sl.tax_id
     where sl.subscription_id = s.id
  loop
    amt := l.quantity * l.unit_price;
    insert into invoice_lines (invoice_id, description, quantity, unit_price, tax_rate, amount)
    values (inv, l.pname || coalesce(' (' || l.vname || ')', ''), l.quantity, l.unit_price, l.rate, amt);
    v_sub := v_sub + amt;
    v_tax := v_tax + amt * l.rate / 100;
  end loop;

  -- automatic discounts (product-level and subscription-level)
  for d in
    select * from discounts
     where active
       and (start_date is null or start_date <= current_date)
       and (end_date   is null or end_date   >= current_date)
       and (usage_limit is null or used_count < usage_limit)
       and ((applies_to = 'subscription' and subscription_id = s.id) or applies_to = 'product')
     order by name
  loop
    if d.applies_to = 'product' then
      select coalesce(sum(quantity * unit_price),0), coalesce(sum(quantity),0)
        into amt, qty from subscription_lines
       where subscription_id = s.id and product_id = d.product_id;
    else
      amt := v_sub;
      select coalesce(sum(quantity),0) into qty from subscription_lines where subscription_id = s.id;
    end if;
    continue when amt <= 0 or amt < d.min_purchase or qty < d.min_quantity;

    disc := case d.type when 'fixed' then least(d.value, amt) else amt * d.value / 100 end;
    disc := least(disc, v_sub - v_disc);
    continue when disc <= 0;

    insert into invoice_lines (invoice_id, description, quantity, unit_price, tax_rate, amount)
    values (inv, 'Discount: ' || d.name, 1, -disc, 0, -disc);
    v_disc := v_disc + disc;
    update discounts set used_count = used_count + 1 where id = d.id;
  end loop;

  -- tax is calculated on the discounted amount
  ratio := case when v_sub > 0 then (v_sub - v_disc) / v_sub else 1 end;
  v_tax := round(v_tax * ratio, 2);

  update invoices
     set subtotal = v_sub, discount_total = v_disc, tax_total = v_tax,
         total = round(v_sub - v_disc + v_tax, 2)
   where id = inv;

  update subscriptions set next_billing_date = p_end where id = s.id;
  return inv;
end $$;

-- Billing day: invoice every active subscription that is due. Returns how many were created.
create or replace function run_billing() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; made uuid;
begin
  if auth.uid() is not null and not is_staff() then raise exception 'Not allowed'; end if;

  -- plans that close on their own
  update subscriptions s set status = 'closed'
    from plans p
   where p.id = s.plan_id and p.auto_close and p.end_date < current_date and s.status = 'active';

  for r in select id from subscriptions
            where status = 'active' and next_billing_date <= current_date
            order by next_billing_date
  loop
    made := generate_invoice(r.id);
    if made is not null then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- Activating a subscription sets its first billing date
create or replace function on_subscription_status() returns trigger
language plpgsql as $$
begin
  if new.status = 'active' and new.next_billing_date is null then
    new.next_billing_date := new.start_date;
  end if;
  return new;
end $$;
drop trigger if exists trg_sub_status on subscriptions;
create trigger trg_sub_status before insert or update on subscriptions
  for each row execute function on_subscription_status();

-- ---------- CUSTOMER SELF-SERVICE ----------
create or replace function close_my_subscription(p_sub uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update subscriptions s set status = 'closed'
   where s.id = p_sub and s.customer_id = auth.uid()
     and s.status in ('confirmed','active')
     and exists (select 1 from plans p where p.id = s.plan_id and p.can_close);
  if not found then raise exception 'This subscription cannot be closed'; end if;
end $$;

create or replace function subscribe_to_plan(p_plan uuid, p_qty int default 1) returns uuid
language plpgsql security definer set search_path = public as $$
declare pl plans%rowtype; sid uuid;
begin
  select * into pl from plans where id = p_plan and active;
  if not found then raise exception 'Plan not available'; end if;
  insert into subscriptions (customer_id, plan_id, status, created_by)
  values (auth.uid(), p_plan, 'quotation', auth.uid()) returning id into sid;
  insert into subscription_lines (subscription_id, product_id, quantity, unit_price)
  values (sid, pl.product_id, greatest(p_qty, pl.min_quantity), pl.price);
  return sid;
end $$;

-- ---------- DASHBOARD (one round-trip) ----------
create or replace function dashboard_stats(p_from date default null, p_to date default null) returns json
language plpgsql stable security definer set search_path = public as $$
declare f date := coalesce(p_from, date_trunc('year', current_date)::date);
        t date := coalesce(p_to, current_date);
begin
  if not is_staff() then raise exception 'Not allowed'; end if;
  return json_build_object(
    'active_subscriptions', (select count(*) from subscriptions where status = 'active'),
    'total_subscriptions',  (select count(*) from subscriptions),
    'revenue',     (select coalesce(sum(amount),0) from payments where paid_on between f and t),
    'outstanding', (select coalesce(sum(total - amount_paid),0) from invoices where status = 'confirmed'),
    'overdue_count',  (select count(*) from invoices where status = 'confirmed' and due_date < current_date),
    'overdue_amount', (select coalesce(sum(total - amount_paid),0) from invoices where status = 'confirmed' and due_date < current_date),
    'mrr', (select coalesce(round(sum(
              sl.quantity * sl.unit_price * case p.billing_period
                when 'daily' then 30 when 'weekly' then 4.345 when 'monthly' then 1 else 1.0/12 end),2),0)
            from subscriptions s join plans p on p.id = s.plan_id
            join subscription_lines sl on sl.subscription_id = s.id where s.status = 'active'),
    'monthly_revenue', (select coalesce(json_agg(x order by x.month),'[]'::json) from (
        select to_char(date_trunc('month', paid_on),'YYYY-MM') as month, sum(amount) as revenue
          from payments where paid_on between f and t group by 1) x),
    'status_counts', (select coalesce(json_agg(x),'[]'::json) from (
        select status, count(*) as count from subscriptions group by status) x),
    'invoice_counts', (select coalesce(json_agg(x),'[]'::json) from (
        select status, count(*) as count from invoices group by status) x)
  );
end $$;

-- ---------- ROW LEVEL SECURITY ----------
alter table profiles            enable row level security;
alter table products            enable row level security;
alter table product_variants    enable row level security;
alter table taxes               enable row level security;
alter table plans               enable row level security;
alter table discounts           enable row level security;
alter table quotation_templates enable row level security;
alter table subscriptions       enable row level security;
alter table subscription_lines  enable row level security;
alter table invoices            enable row level security;
alter table invoice_lines       enable row level security;
alter table payments            enable row level security;

-- profiles
create policy "profiles read"   on profiles for select using (id = auth.uid() or is_staff());
create policy "profiles update" on profiles for update using (id = auth.uid() or is_admin());

-- catalogue: everyone signed in can read, only admin writes
create policy "products read"  on products         for select to authenticated using (true);
create policy "products write" on products         for all    using (is_admin()) with check (is_admin());
create policy "variants read"  on product_variants for select to authenticated using (true);
create policy "variants write" on product_variants for all    using (is_admin()) with check (is_admin());
create policy "plans read"     on plans            for select to authenticated using (true);
create policy "plans write"    on plans            for all    using (is_admin()) with check (is_admin());
create policy "taxes read"     on taxes            for select using (is_staff());
create policy "taxes write"    on taxes            for all    using (is_admin()) with check (is_admin());
create policy "discounts read" on discounts        for select using (is_staff());
create policy "discounts write" on discounts       for all    using (is_admin()) with check (is_admin());
create policy "templates read" on quotation_templates for select using (is_staff());
create policy "templates write" on quotation_templates for all using (is_staff()) with check (is_staff());

-- subscriptions
create policy "subs read"  on subscriptions for select using (customer_id = auth.uid() or is_staff());
create policy "subs write" on subscriptions for all    using (is_staff()) with check (is_staff());
create policy "sublines read"  on subscription_lines for select using (
  is_staff() or exists (select 1 from subscriptions s where s.id = subscription_id and s.customer_id = auth.uid()));
create policy "sublines write" on subscription_lines for all using (is_staff()) with check (is_staff());

-- invoices & payments
create policy "inv read"  on invoices for select using (customer_id = auth.uid() or is_staff());
create policy "inv write" on invoices for all    using (is_staff()) with check (is_staff());
create policy "invlines read" on invoice_lines for select using (
  is_staff() or exists (select 1 from invoices i where i.id = invoice_id and i.customer_id = auth.uid()));
create policy "invlines write" on invoice_lines for all using (is_staff()) with check (is_staff());
create policy "pay read"  on payments for select using (
  is_staff() or exists (select 1 from invoices i where i.id = invoice_id and i.customer_id = auth.uid()));
create policy "pay write" on payments for insert with check (is_staff());

-- ---------- OPTIONAL: run billing automatically every day at 02:00 UTC ----------
-- Enable the pg_cron extension (Database → Extensions), then uncomment:
-- select cron.schedule('daily-billing', '0 2 * * *', $$ select run_billing(); $$);

-- ---------- MAKE YOURSELF THE FIRST ADMIN ----------
-- 1) Sign up in the app with your email, 2) then run:
-- update profiles set role = 'admin' where email = 'you@example.com';
