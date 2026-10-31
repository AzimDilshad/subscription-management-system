-- Fix polymorphic trigger access: invoice-only fields must only be read in the
-- invoices branch, never as part of a boolean condition on subscription rows.
begin;

create or replace function public.queue_business_notification() returns trigger
language plpgsql security definer set search_path=public as $$
declare
 recipient uuid;
 event_name text;
 title text;
 body_text text;
 channel_name text;
 template_subject text;
 template_body text;
 prefs jsonb;
begin
 if tg_table_name = 'invoices' then
  if new.total <= 0 or new.status = 'draft' then return new; end if;
  recipient := new.customer_id;
  event_name := 'invoice_created';
  title := 'Invoice ' || new.number;
  body_text := 'A new invoice for INR ' || new.total::text || ' is available.';
  if exists (
   select 1 from public.notifications
   where customer_id = recipient and event_key = event_name and subject = title
  ) then return new; end if;
 elsif tg_table_name = 'payments' then
  select customer_id into recipient from public.invoices where id = new.invoice_id;
  event_name := 'payment_received';
  title := 'Payment received';
  body_text := 'We recorded a payment of INR ' || new.amount::text || '.';
 elsif tg_table_name = 'subscriptions' then
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then return new; end if;
  recipient := new.customer_id;
  event_name := 'subscription_' || new.status::text;
  title := 'Subscription ' || new.number;
  body_text := 'Your subscription status is now ' || new.status::text || '.';
 else
  return new;
 end if;

 if recipient is null then return new; end if;
 select notification_preferences into prefs from public.profiles where id = recipient;
 if event_name in ('invoice_created', 'payment_received')
    and prefs->'billing_reminders' = 'false'::jsonb then return new; end if;
 if event_name like 'subscription_%'
    and prefs->'subscription_updates' = 'false'::jsonb then return new; end if;

 select nt.channel, nt.subject, nt.body into channel_name, template_subject, template_body
 from public.notification_templates nt
 where nt.event_key = event_name and nt.enabled
 order by case nt.channel when 'in_app' then 0 else 1 end
 limit 1;
 if found then
  title := coalesce(template_subject, title);
  body_text := coalesce(template_body, body_text);
 else
  channel_name := 'in_app';
 end if;

 insert into public.notifications(customer_id, event_key, channel, subject, body, delivery_status)
 values (recipient, event_name, coalesce(channel_name, 'in_app'), title, body_text, 'queued');
 return new;
end $$;

commit;
