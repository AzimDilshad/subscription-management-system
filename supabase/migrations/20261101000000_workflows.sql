-- Workflow additions after 20261031000000_admin_features.sql.
begin;

alter table public.quotations add column if not exists plan_id uuid references public.plans(id) on delete set null;
alter table public.quotations add column if not exists payment_terms_days integer not null default 15;
alter table public.quotations add column if not exists start_date date not null default current_date;
alter table public.quotations add column if not exists subscription_id uuid references public.subscriptions(id) on delete set null;
alter table public.quotation_items add column if not exists tax_id uuid references public.taxes(id) on delete set null;
alter table public.quotation_items add column if not exists variant_id uuid references public.product_variants(id) on delete set null;
-- Older installations may already store settings as text, while the admin migration
-- creates this column as jsonb. Convert only when it is not already text.
do $$
begin
 if (select data_type from information_schema.columns
     where table_schema='public' and table_name='system_settings' and column_name='value') <> 'text' then
  execute $sql$alter table public.system_settings alter column value type text using
    case when jsonb_typeof(value)='string' then value #>> '{}' else value::text end$sql$;
 end if;
end $$;
alter table public.system_settings alter column value set default '';
create unique index if not exists quotations_subscription_unique on public.quotations(subscription_id) where subscription_id is not null;

create or replace function public.create_quotation(p_quote jsonb, p_items jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare qid uuid; item record; v_sub numeric(12,2):=0; v_tax numeric(12,2):=0;
begin
 if not public.is_staff() then raise exception 'Not allowed'; end if;
 if jsonb_typeof(p_items) <> 'array' then raise exception 'Quotation lines must be an array'; end if;
 insert into public.quotations(customer_id,template_id,plan_id,status,valid_until,start_date,payment_terms_days,notes,created_by)
 values((p_quote->>'customer_id')::uuid,nullif(p_quote->>'template_id','')::uuid,
        nullif(p_quote->>'plan_id','')::uuid,'draft',nullif(p_quote->>'valid_until','')::date,
        coalesce(nullif(p_quote->>'start_date','')::date,current_date),
        coalesce(nullif(p_quote->>'payment_terms_days','')::integer,15),nullif(p_quote->>'notes',''),auth.uid())
 returning id into qid;
 for item in select * from jsonb_to_recordset(p_items) as x(product_id uuid,variant_id uuid,description text,quantity numeric,unit_price numeric,tax_id uuid) loop
  if item.quantity <= 0 or item.unit_price < 0 then raise exception 'Quotation quantity and price are invalid'; end if;
  insert into public.quotation_items(quotation_id,product_id,variant_id,description,quantity,unit_price,tax_id,tax_rate)
  select qid,item.product_id,item.variant_id,coalesce(item.description,p.name,'Item'),item.quantity,item.unit_price,item.tax_id,coalesce(t.rate_percent,0)
  from (select 1) seed left join public.products p on p.id=item.product_id left join public.taxes t on t.id=item.tax_id;
  v_sub:=v_sub+(item.quantity*item.unit_price);
  v_tax:=v_tax+(item.quantity*item.unit_price*coalesce((select rate_percent from public.taxes where id=item.tax_id),0)/100);
 end loop;
 if coalesce(nullif(p_quote->>'discount_total','')::numeric,0) < 0 or coalesce(nullif(p_quote->>'discount_total','')::numeric,0) > v_sub then raise exception 'Discount must be between zero and the subtotal'; end if;
 update public.quotations set subtotal=v_sub,discount_total=coalesce(nullif(p_quote->>'discount_total','')::numeric,0),tax_total=round(v_tax*case when v_sub>0 then (v_sub-coalesce(nullif(p_quote->>'discount_total','')::numeric,0))/v_sub else 1 end,2),total=round(v_sub-coalesce(nullif(p_quote->>'discount_total','')::numeric,0)+v_tax*case when v_sub>0 then (v_sub-coalesce(nullif(p_quote->>'discount_total','')::numeric,0))/v_sub else 1 end,2) where id=qid;
 return qid;
end $$;

create or replace function public.accept_my_quotation(p_quote uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 update public.quotations set status='accepted'
 where id=p_quote and customer_id=auth.uid() and status='sent'
 and (valid_until is null or valid_until>=current_date);
 if not found then raise exception 'This quotation is not available for acceptance'; end if;
end $$;

create or replace function public.create_manual_invoice(p_invoice jsonb,p_lines jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare iid uuid; item record; sub_total numeric(12,2):=0; tax_total numeric(12,2):=0; rate numeric;
begin
 if not public.is_staff() then raise exception 'Not allowed'; end if;
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'Add at least one invoice line'; end if;
 for item in select * from jsonb_to_recordset(p_lines) as x(description text,quantity numeric,unit_price numeric,tax_id uuid) loop
  if item.quantity<=0 or item.unit_price<0 then raise exception 'Invoice quantities and prices are invalid'; end if;
  sub_total:=sub_total+item.quantity*item.unit_price;
  select coalesce(rate_percent,0) into rate from public.taxes where id=item.tax_id;
  tax_total:=tax_total+item.quantity*item.unit_price*coalesce(rate,0)/100;
 end loop;
 insert into public.invoices(customer_id,status,issue_date,due_date,subtotal,tax_total,total)
 values((p_invoice->>'customer_id')::uuid,'draft',coalesce(nullif(p_invoice->>'issue_date','')::date,current_date),
        coalesce(nullif(p_invoice->>'due_date','')::date,current_date+15),round(sub_total,2),round(tax_total,2),round(sub_total+tax_total,2)) returning id into iid;
 for item in select * from jsonb_to_recordset(p_lines) as x(description text,quantity numeric,unit_price numeric,tax_id uuid) loop
  select coalesce(rate_percent,0) into rate from public.taxes where id=item.tax_id;
  insert into public.invoice_lines(invoice_id,description,quantity,unit_price,tax_rate,amount)
  values(iid,coalesce(item.description,'Item'),item.quantity,item.unit_price,coalesce(rate,0),item.quantity*item.unit_price);
 end loop;
 return iid;
end $$;

alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists company_name text;
alter table public.profiles add column if not exists customer_status text not null default 'active' check(customer_status in ('active','inactive'));
alter table public.profiles add column if not exists internal_notes text;
alter table public.profiles add column if not exists gstin text;
create table if not exists public.customer_addresses (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.profiles(id) on delete cascade,
 address_type text not null default 'billing' check(address_type in ('billing','shipping')),
 line1 text not null, line2 text, city text, state text, postal_code text, country text not null default 'India',
 is_default boolean not null default false, created_at timestamptz not null default now()
);
create index if not exists customer_addresses_owner on public.customer_addresses(customer_id);

create table if not exists public.discount_usages (
 id uuid primary key default gen_random_uuid(), discount_id uuid not null references public.discounts(id) on delete restrict,
 customer_id uuid references public.profiles(id) on delete set null, invoice_id uuid references public.invoices(id) on delete set null,
 amount numeric(12,2) not null default 0, used_at timestamptz not null default now()
);
create index if not exists discount_usages_discount_idx on public.discount_usages(discount_id,used_at desc);
create table if not exists public.payment_allocations (
 id uuid primary key default gen_random_uuid(), payment_id uuid not null references public.payments(id) on delete restrict,
 invoice_id uuid not null references public.invoices(id) on delete restrict, amount numeric(12,2) not null check(amount>0),
 created_at timestamptz not null default now(), unique(payment_id,invoice_id)
);
create table if not exists public.staff_permissions (
 id uuid primary key default gen_random_uuid(), staff_id uuid not null references public.profiles(id) on delete cascade,
 permission_key text not null, allowed boolean not null default false, granted_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(), unique(staff_id,permission_key)
);
create table if not exists public.integrations (
 id uuid primary key default gen_random_uuid(), name text not null, provider text not null,
 enabled boolean not null default false, public_config jsonb not null default '{}'::jsonb,
 secret_configured boolean not null default false, updated_by uuid references public.profiles(id) on delete set null,
 updated_at timestamptz not null default now()
);
create table if not exists public.automation_runs (
 id uuid primary key default gen_random_uuid(), rule_id uuid references public.automation_rules(id) on delete set null,
 status text not null default 'queued' check(status in ('queued','running','completed','failed')),
 input jsonb not null default '{}'::jsonb, output jsonb, error text,
 started_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists automation_runs_recent on public.automation_runs(created_at desc);

create or replace function public.convert_quotation(p_quote uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare q public.quotations%rowtype; sub_id uuid; item record; p public.plans%rowtype; net_ratio numeric;
begin
 if not public.is_staff() then raise exception 'Not allowed'; end if;
 select * into q from public.quotations where id=p_quote for update;
 if not found then raise exception 'Quotation not found'; end if;
 if q.subscription_id is not null then return q.subscription_id; end if;
 if q.valid_until is not null and q.valid_until < current_date then raise exception 'Quotation has expired'; end if;
 if q.plan_id is null then raise exception 'Select a subscription plan before converting this quotation'; end if;
 net_ratio:=case when q.subtotal>0 then (q.subtotal-q.discount_total)/q.subtotal else 1 end;
 select * into p from public.plans where id=q.plan_id and active;
 if not found then raise exception 'The selected plan is no longer available'; end if;
 insert into public.subscriptions(customer_id,plan_id,status,start_date,payment_terms_days,created_by)
 values(q.customer_id,q.plan_id,'confirmed',q.start_date,q.payment_terms_days,auth.uid()) returning id into sub_id;
 for item in select * from public.quotation_items where quotation_id=q.id loop
  if item.product_id is not null then
   insert into public.subscription_lines(subscription_id,product_id,variant_id,quantity,unit_price,tax_id)
   values(sub_id,item.product_id,item.variant_id,item.quantity,round(item.unit_price*net_ratio,2),item.tax_id);
  end if;
 end loop;
 if not exists(select 1 from public.subscription_lines where subscription_id=sub_id) and p.product_id is not null then
   insert into public.subscription_lines(subscription_id,product_id,quantity,unit_price)
   values(sub_id,p.product_id,p.min_quantity,p.price);
 end if;
 update public.quotations set status='accepted',subscription_id=sub_id where id=q.id;
 return sub_id;
end $$;

create or replace function public.close_my_subscription(p_sub uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 update public.subscriptions s set status='closed'
 where s.id=p_sub and s.customer_id=auth.uid() and s.status in ('confirmed','active')
 and exists(select 1 from public.plans p where p.id=s.plan_id and p.can_close);
 if not found then raise exception 'This subscription cannot be closed'; end if;
end $$;

-- Global search is scoped to records visible to the current user through RLS.
create or replace function public.global_search(p_query text, p_limit integer default 8) returns jsonb
language plpgsql stable security invoker set search_path=public as $$
declare q text := '%' || replace(coalesce(trim(p_query),''),'%','\\%') || '%'; out jsonb;
begin
 if length(trim(coalesce(p_query,''))) < 2 then return '[]'::jsonb; end if;
 select coalesce(jsonb_agg(result),'[]'::jsonb) into out from (
  select * from (
   select 'customer'::text kind, id::text id, coalesce(full_name,email) label, email detail, '/users' path from public.profiles where role='customer' and (full_name ilike q or email ilike q) limit p_limit
  ) a union all select * from (
   select 'product',id::text,name,coalesce(sku,type),'/products' from public.products where name ilike q or coalesce(sku,'') ilike q limit p_limit
  ) b union all select * from (
   select 'plan',id::text,name,price::text||' / '||billing_period::text,'/plans' from public.plans where name ilike q limit p_limit
  ) c union all select * from (
   select 'quotation',id::text,number,status,'/quotes' from public.quotations where number ilike q limit p_limit
  ) d union all select * from (
   select 'subscription',id::text,number,status::text,'/subscriptions' from public.subscriptions where number ilike q limit p_limit
  ) e union all select * from (
   select 'invoice',id::text,number,status::text,'/invoices' from public.invoices where number ilike q limit p_limit
  ) f
 ) result limit (p_limit*6);
 return out;
end $$;

alter table public.customer_addresses enable row level security;
alter table public.discount_usages enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.staff_permissions enable row level security;
alter table public.integrations enable row level security;
alter table public.automation_runs enable row level security;
create policy "addresses own or staff read" on public.customer_addresses for select to authenticated using(customer_id=auth.uid() or public.is_staff());
create policy "addresses own manage" on public.customer_addresses for all to authenticated using(customer_id=auth.uid() or public.is_admin()) with check(customer_id=auth.uid() or public.is_admin());
create policy "discount usage staff read" on public.discount_usages for select to authenticated using(public.is_staff());
create policy "discount usage admin manage" on public.discount_usages for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "payment allocations staff read" on public.payment_allocations for select to authenticated using(public.is_staff());
create policy "payment allocations admin manage" on public.payment_allocations for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "staff permissions admin manage" on public.staff_permissions for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "integrations admin manage" on public.integrations for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "automation runs admin read" on public.automation_runs for select to authenticated using(public.is_admin());
revoke insert,update,delete on public.automation_runs from anon,authenticated;
revoke all on function public.create_quotation(jsonb,jsonb) from public,anon;
grant execute on function public.create_quotation(jsonb,jsonb) to authenticated;
revoke all on function public.accept_my_quotation(uuid) from public,anon;
grant execute on function public.accept_my_quotation(uuid) to authenticated;
revoke all on function public.create_manual_invoice(jsonb,jsonb) from public,anon;
grant execute on function public.create_manual_invoice(jsonb,jsonb) to authenticated;
revoke all on function public.convert_quotation(uuid) from public,anon;
grant execute on function public.convert_quotation(uuid) to authenticated;
revoke all on function public.global_search(text,integer) from public,anon;
grant execute on function public.global_search(text,integer) to authenticated;

commit;
