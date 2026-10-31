-- Brightloop sample catalog and admin configuration data.
-- Run this only after schema.sql and all migrations have been applied.
-- Safe to rerun: records are matched by stable names, SKUs, codes, and event keys.
-- This does not create fake Auth users, invoices, subscriptions, or payments.

begin;

insert into public.product_categories (name, description, active)
values
  ('Software', 'Business software subscriptions', true),
  ('Support', 'Customer support and onboarding services', true),
  ('Add-ons', 'Optional subscription add-ons', true)
on conflict (name) do update
set description = excluded.description, active = excluded.active;

insert into public.taxes (name, rate_percent, active, tax_code, tax_type)
select seed.name, seed.rate_percent, true, seed.tax_code, seed.tax_type
from (values
  ('Sample GST 18%', 18.00::numeric, 'GST18', 'GST'),
  ('Sample GST 5%',   5.00::numeric, 'GST05', 'GST'),
  ('Sample VAT 20%', 20.00::numeric, 'VAT20', 'VAT')
) as seed(name, rate_percent, tax_code, tax_type)
where not exists (
  select 1 from public.taxes t where t.name = seed.name
);

insert into public.products (name, type, sales_price, cost_price, notes, active, sku, description, category_id)
select seed.name, 'service', seed.sales_price, seed.cost_price, seed.notes, true, seed.sku, seed.description, c.id
from (values
  ('Brightloop Starter', 999.00::numeric, 250.00::numeric, 'SAMPLE-STARTER', 'Core subscription management for small teams.', 'Software'),
  ('Brightloop Growth', 2499.00::numeric, 600.00::numeric, 'SAMPLE-GROWTH', 'Advanced workflows and reporting for growing teams.', 'Software'),
  ('Priority Support', 499.00::numeric, 150.00::numeric, 'SAMPLE-SUPPORT', 'Priority support add-on for active subscriptions.', 'Support'),
  ('Extra Workspace', 299.00::numeric, 75.00::numeric, 'SAMPLE-WORKSPACE', 'Additional workspace add-on.', 'Add-ons')
) as seed(name, sales_price, cost_price, sku, description, category_name)
join public.product_categories c on c.name = seed.category_name
where not exists (select 1 from public.products p where p.sku = seed.sku);

insert into public.plans (name, product_id, price, billing_period, min_quantity, can_close, can_pause, can_renew, active)
select seed.plan_name, p.id, seed.price, seed.billing_period::public.billing_period, 1, true, true, true, true
from (values
  ('Sample Starter Monthly', 'SAMPLE-STARTER', 999.00::numeric, 'monthly'),
  ('Sample Starter Yearly',  'SAMPLE-STARTER', 9990.00::numeric, 'yearly'),
  ('Sample Growth Monthly',  'SAMPLE-GROWTH', 2499.00::numeric, 'monthly'),
  ('Sample Growth Yearly',   'SAMPLE-GROWTH', 24990.00::numeric, 'yearly')
) as seed(plan_name, sku, price, billing_period)
join public.products p on p.sku = seed.sku
where not exists (select 1 from public.plans existing where existing.name = seed.plan_name);

insert into public.discounts (name, type, value, min_purchase, min_quantity, start_date, end_date, usage_limit, applies_to, active, code, per_customer_limit, first_billing_only)
values
  ('Sample Welcome 10%', 'percent', 10, 0, 0, current_date, current_date + 90, 100, 'subscription', true, 'SAMPLE10', 1, true),
  ('Sample Launch INR 500', 'fixed', 500, 2000, 0, current_date, current_date + 90, 50, 'subscription', true, 'LAUNCH500', 1, false)
on conflict (lower(code)) where code is not null do update
set name = excluded.name, type = excluded.type, value = excluded.value,
    min_purchase = excluded.min_purchase, usage_limit = excluded.usage_limit,
    active = excluded.active;

insert into public.quotation_templates (name, plan_id, validity_days, lines)
select seed.template_name, p.id, 30,
       jsonb_build_array(jsonb_build_object('product_id', p.product_id, 'quantity', 1))
from (values
  ('Sample Starter Quote', 'Sample Starter Monthly'),
  ('Sample Growth Quote', 'Sample Growth Monthly')
) as seed(template_name, plan_name)
join public.plans p on p.name = seed.plan_name
where not exists (select 1 from public.quotation_templates t where t.name = seed.template_name);

insert into public.notification_templates (event_key, channel, subject, body, enabled)
values
  ('invoice_created', 'in_app', 'Invoice {{invoice_number}} is ready', 'Your invoice for {{amount}} is ready to view.', true),
  ('payment_received', 'in_app', 'Payment received', 'We received your payment of {{amount}}.', true),
  ('subscription_active', 'in_app', 'Subscription active', 'Your subscription {{subscription_number}} is active.', true),
  ('subscription_paused', 'in_app', 'Subscription paused', 'Your subscription {{subscription_number}} is paused.', true),
  ('support_ticket_created', 'in_app', 'Support request received', 'We received your support request and will follow up.', true)
on conflict (event_key, channel) do update
set subject = excluded.subject, body = excluded.body, enabled = excluded.enabled;

insert into public.automation_rules (name, trigger_key, conditions, actions, enabled)
select seed.name, seed.trigger_key, seed.conditions, seed.actions, true
from (values
  ('Sample: notify on invoice', 'invoice_created', '{}'::jsonb, '[{"type":"notification","channel":"in_app"}]'::jsonb),
  ('Sample: notify on subscription change', 'subscription_status_changed', '{}'::jsonb, '[{"type":"notification","channel":"in_app"}]'::jsonb),
  ('Sample: flag overdue invoices', 'daily', '{"task":"overdue_invoices"}'::jsonb, '[{"type":"create_billing_job","job_type":"overdue_invoice_check"}]'::jsonb)
) as seed(name, trigger_key, conditions, actions)
where not exists (select 1 from public.automation_rules r where r.name = seed.name);

insert into public.integrations (name, provider, enabled, public_config, secret_configured)
select seed.name, seed.provider, false, seed.public_config, false
from (values
  ('Sample email provider', 'email', '{"mode":"sample","note":"Configure a real provider before enabling delivery."}'::jsonb),
  ('Sample payment gateway', 'payment_gateway', '{"mode":"sample","note":"Configure real gateway credentials before accepting online payments."}'::jsonb)
) as seed(name, provider, public_config)
where not exists (select 1 from public.integrations i where i.name = seed.name);

commit;
