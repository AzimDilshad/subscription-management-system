-- Additive Brightloop admin features. Apply after supabase/schema.sql.
begin;
create extension if not exists pgcrypto;

create table if not exists public.product_categories (
 id uuid primary key default gen_random_uuid(), name text not null unique,
 description text, active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.products add column if not exists category_id uuid references public.product_categories(id) on delete set null;
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists description text;
create unique index if not exists products_sku_unique on public.products(sku) where sku is not null;

create table if not exists public.quotations (
 id uuid primary key default gen_random_uuid(),
 number text not null unique default ('QUO-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
 customer_id uuid not null references public.profiles(id),
 template_id uuid references public.quotation_templates(id) on delete set null,
 status text not null default 'draft' check(status in ('draft','sent','accepted','rejected','expired')),
 valid_until date, subtotal numeric(12,2) not null default 0 check(subtotal>=0),
 discount_total numeric(12,2) not null default 0 check(discount_total>=0),
 tax_total numeric(12,2) not null default 0 check(tax_total>=0),
 total numeric(12,2) not null default 0 check(total>=0), notes text,
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.quotation_items (
 id uuid primary key default gen_random_uuid(), quotation_id uuid not null references public.quotations(id) on delete cascade,
 product_id uuid references public.products(id) on delete set null, plan_id uuid references public.plans(id) on delete set null,
 description text not null, quantity numeric(12,2) not null default 1 check(quantity>0),
 unit_price numeric(12,2) not null default 0 check(unit_price>=0), tax_rate numeric(5,2) not null default 0 check(tax_rate>=0),
 created_at timestamptz not null default now()
);
create table if not exists public.refunds (
 id uuid primary key default gen_random_uuid(), payment_id uuid not null references public.payments(id) on delete restrict,
 amount numeric(12,2) not null check(amount>0), reason text,
 status text not null default 'requested' check(status in ('requested','processing','completed','failed')),
 external_reference text, created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.payment_methods (
 id uuid primary key default gen_random_uuid(), name text not null, code text not null unique, provider text,
 enabled boolean not null default true, sort_order integer not null default 0,
 configuration jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
insert into public.payment_methods(name,code,provider,sort_order) values
 ('Bank transfer','bank_transfer','manual',1),('Card','card','manual',2),('UPI','upi','manual',3),('Cash','cash','manual',4),('Cheque','cheque','manual',5)
on conflict(code) do nothing;
create table if not exists public.notification_templates (
 id uuid primary key default gen_random_uuid(), event_key text not null,
 channel text not null default 'email' check(channel in ('email','in_app','sms','whatsapp','push')),
 subject text, body text not null, enabled boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(event_key,channel)
);
create table if not exists public.notifications (
 id uuid primary key default gen_random_uuid(), customer_id uuid references public.profiles(id) on delete cascade,
 event_key text not null, channel text not null default 'in_app', subject text, body text not null,
 delivery_status text not null default 'queued' check(delivery_status in ('queued','sent','failed','read')),
 sent_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.support_tickets (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.profiles(id) on delete cascade,
 assigned_to uuid references public.profiles(id) on delete set null, subject text not null, description text, category text,
 priority text not null default 'normal' check(priority in ('low','normal','high','urgent')),
 status text not null default 'open' check(status in ('open','in_progress','waiting_customer','resolved','closed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.support_messages (
 id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 sender_id uuid references public.profiles(id) on delete set null, message text not null, created_at timestamptz not null default now()
);
create table if not exists public.automation_rules (
 id uuid primary key default gen_random_uuid(), name text not null, trigger_key text not null,
 conditions jsonb not null default '{}'::jsonb, actions jsonb not null default '[]'::jsonb,
 enabled boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.billing_jobs (
 id uuid primary key default gen_random_uuid(), job_type text not null,
 status text not null default 'queued' check(status in ('queued','running','completed','failed')),
 attempts integer not null default 0 check(attempts>=0), payload jsonb not null default '{}'::jsonb,
 last_error text, run_after timestamptz not null default now(), started_at timestamptz,
 completed_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.system_settings (
 id uuid primary key default gen_random_uuid(), key text not null unique, value jsonb not null default 'null'::jsonb,
 description text, updated_by uuid references public.profiles(id) on delete set null, updated_at timestamptz not null default now()
);
create table if not exists public.activity_logs (
 id bigint generated always as identity primary key, actor_id uuid references public.profiles(id) on delete set null,
 action text not null, module text not null, record_id text, metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create table if not exists public.subscription_history (
 id uuid primary key default gen_random_uuid(), subscription_id uuid not null references public.subscriptions(id) on delete cascade,
 actor_id uuid references public.profiles(id) on delete set null, action text not null,
 old_values jsonb, new_values jsonb, created_at timestamptz not null default now()
);

create index if not exists quotations_customer_idx on public.quotations(customer_id,created_at desc);
create index if not exists quotations_status_idx on public.quotations(status,valid_until);
create index if not exists quote_items_quote_idx on public.quotation_items(quotation_id);
create index if not exists refunds_payment_idx on public.refunds(payment_id);
create index if not exists notifications_customer_idx on public.notifications(customer_id,created_at desc);
create index if not exists support_customer_idx on public.support_tickets(customer_id,status,updated_at desc);
create index if not exists support_assignee_idx on public.support_tickets(assigned_to,status);
create index if not exists billing_jobs_due_idx on public.billing_jobs(status,run_after);
create index if not exists activity_logs_recent_idx on public.activity_logs(created_at desc);
create index if not exists subscription_history_sub_idx on public.subscription_history(subscription_id,created_at desc);

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path=public as $$
begin new.updated_at := now(); return new; end $$;
do $$ declare t text; begin
 foreach t in array array['product_categories','quotations','refunds','payment_methods','notification_templates','support_tickets','automation_rules'] loop
  execute format('drop trigger if exists set_updated_at on public.%I',t);
  execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',t);
 end loop;
end $$;

create or replace function public.capture_activity() returns trigger language plpgsql security definer set search_path=public as $$
declare old_doc jsonb; new_doc jsonb; target_id text;
begin
 if tg_op <> 'INSERT' then old_doc := to_jsonb(old); end if;
 if tg_op <> 'DELETE' then new_doc := to_jsonb(new); end if;
 target_id := coalesce(new_doc->>'id',old_doc->>'id');
 insert into public.activity_logs(actor_id,action,module,record_id,metadata)
 values(auth.uid(),lower(tg_op),tg_table_name,target_id,jsonb_build_object('old',old_doc,'new',new_doc));
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
do $$ declare t text; begin
 foreach t in array array['products','plans','subscriptions','invoices','payments','discounts','taxes','quotations','refunds','support_tickets','profiles'] loop
  execute format('drop trigger if exists capture_activity on public.%I',t);
  execute format('create trigger capture_activity after insert or update or delete on public.%I for each row execute function public.capture_activity()',t);
 end loop;
end $$;

do $$ declare t text; begin
 foreach t in array array['product_categories','quotations','quotation_items','refunds','payment_methods','notification_templates','notifications','support_tickets','support_messages','automation_rules','billing_jobs','system_settings','activity_logs','subscription_history'] loop
  execute format('alter table public.%I enable row level security',t);
 end loop;
end $$;
create policy "categories signed-in read" on public.product_categories for select to authenticated using(active or public.is_admin());
create policy "categories admin manage" on public.product_categories for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "quotes customer or staff read" on public.quotations for select to authenticated using(customer_id=auth.uid() or public.is_staff());
create policy "quotes staff manage" on public.quotations for all to authenticated using(public.is_staff()) with check(public.is_staff());
create policy "quote items customer or staff read" on public.quotation_items for select to authenticated using(public.is_staff() or exists(select 1 from public.quotations q where q.id=quotation_id and q.customer_id=auth.uid()));
create policy "quote items staff manage" on public.quotation_items for all to authenticated using(public.is_staff()) with check(public.is_staff());
create policy "refund staff read" on public.refunds for select to authenticated using(public.is_staff());
create policy "refund admin manage" on public.refunds for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "payment methods signed-in read" on public.payment_methods for select to authenticated using(enabled or public.is_admin());
create policy "payment methods admin manage" on public.payment_methods for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "notification templates admin manage" on public.notification_templates for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "notifications own or staff read" on public.notifications for select to authenticated using(customer_id=auth.uid() or public.is_staff());
create policy "notifications staff manage" on public.notifications for all to authenticated using(public.is_staff()) with check(public.is_staff());
create policy "support own or staff read" on public.support_tickets for select to authenticated using(customer_id=auth.uid() or public.is_staff());
create policy "support customer create" on public.support_tickets for insert to authenticated with check(customer_id=auth.uid());
create policy "support staff manage" on public.support_tickets for update to authenticated using(public.is_staff()) with check(public.is_staff());
create policy "support messages own or staff read" on public.support_messages for select to authenticated using(public.is_staff() or exists(select 1 from public.support_tickets t where t.id=ticket_id and t.customer_id=auth.uid()));
create policy "support message own create" on public.support_messages for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from public.support_tickets t where t.id=ticket_id and (t.customer_id=auth.uid() or public.is_staff())));
create policy "automation admin manage" on public.automation_rules for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "billing jobs admin read" on public.billing_jobs for select to authenticated using(public.is_admin());
create policy "settings admin manage" on public.system_settings for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "audit staff read" on public.activity_logs for select to authenticated using(public.is_staff());
create policy "subscription history customer or staff read" on public.subscription_history for select to authenticated using(public.is_staff() or exists(select 1 from public.subscriptions s where s.id=subscription_id and s.customer_id=auth.uid()));
revoke insert,update,delete on public.activity_logs from anon,authenticated;
revoke insert,update,delete on public.subscription_history from anon,authenticated;
commit;
