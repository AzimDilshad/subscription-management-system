-- Additional tax and payment metadata for real customer and finance records.
begin;
alter table public.taxes add column if not exists tax_code text;
alter table public.taxes add column if not exists tax_type text not null default 'GST' check(tax_type in ('GST','CGST','SGST','IGST','VAT','other'));
alter table public.taxes add column if not exists hsn_sac text;
alter table public.taxes add column if not exists inclusive boolean not null default false;
alter table public.taxes add column if not exists effective_from date;
alter table public.taxes add column if not exists effective_until date;
create table if not exists public.tax_rules (
 id uuid primary key default gen_random_uuid(), name text not null, tax_id uuid not null references public.taxes(id) on delete restrict,
 product_id uuid references public.products(id) on delete cascade, customer_id uuid references public.profiles(id) on delete cascade,
 country text, state text, priority integer not null default 0, active boolean not null default true,
 effective_from date, effective_until date, created_at timestamptz not null default now()
);
create index if not exists tax_rules_match_idx on public.tax_rules(active,priority desc,effective_from,effective_until);
alter table public.discounts add column if not exists code text;
alter table public.discounts add column if not exists per_customer_limit integer;
alter table public.discounts add column if not exists first_billing_only boolean not null default false;
alter table public.discounts add column if not exists archived_at timestamptz;
create unique index if not exists discounts_code_unique on public.discounts(lower(code)) where code is not null;
alter table public.payments add column if not exists transaction_id text;
alter table public.payments add column if not exists status text not null default 'successful' check(status in ('pending','successful','failed','refunded','partially_refunded'));
create unique index if not exists payments_transaction_id_unique on public.payments(transaction_id) where transaction_id is not null;
alter table public.profiles add column if not exists notification_preferences jsonb not null default '{}'::jsonb;

create or replace function public.apply_payment() returns trigger
language plpgsql security definer set search_path=public as $$
declare inv public.invoices%rowtype; paid numeric(12,2);
begin
 select * into inv from public.invoices where id=new.invoice_id for update;
 if not found then raise exception 'Invoice not found'; end if;
 if inv.status='cancelled' then raise exception 'Cannot pay a cancelled invoice'; end if;
 if inv.status='draft' then raise exception 'Confirm the invoice before recording payment'; end if;
 select coalesce(sum(amount),0) into paid from public.payments where invoice_id=new.invoice_id;
 if paid>inv.total then raise exception 'Payment exceeds the invoice balance'; end if;
 update public.invoices set amount_paid=paid,status=case when paid>=total then 'paid'::public.inv_status else 'confirmed'::public.inv_status end where id=new.invoice_id;
 return new;
end $$;

alter table public.tax_rules enable row level security;
create policy "tax rules staff read" on public.tax_rules for select to authenticated using(public.is_staff());
create policy "tax rules admin manage" on public.tax_rules for all to authenticated using(public.is_admin()) with check(public.is_admin());
commit;
