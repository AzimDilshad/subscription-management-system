-- Supported in-database workflows and notification event queue.
begin;

create or replace function public.queue_business_notification() returns trigger
language plpgsql security definer set search_path=public as $$
declare recipient uuid; event_name text; title text; body_text text; channel_name text; prefs jsonb;
begin
 if tg_table_name='invoices' then
  recipient:=new.customer_id; event_name:='invoice_created'; title:='Invoice '||new.number;
  body_text:='A new invoice for INR '||new.total::text||' is available.';
 elsif tg_table_name='payments' then
  select customer_id into recipient from public.invoices where id=new.invoice_id;
  event_name:='payment_received'; title:='Payment received';
  body_text:='We recorded a payment of INR '||new.amount::text||'.';
 elsif tg_table_name='subscriptions' then
  if tg_op='UPDATE' and old.status is not distinct from new.status then return new; end if;
  recipient:=new.customer_id; event_name:='subscription_'||new.status::text;
  title:='Subscription '||new.number; body_text:='Your subscription status is now '||new.status::text||'.';
 else return new;
 end if;
 if recipient is null then return new; end if;
 select notification_preferences into prefs from public.profiles where id=recipient;
 if event_name in ('invoice_created','payment_received') and prefs->'billing_reminders'='false'::jsonb then return new; end if;
 if event_name like 'subscription_%' and prefs->'subscription_updates'='false'::jsonb then return new; end if;
 if tg_table_name='invoices' and (new.total<=0 or new.status='draft') then return new; end if;
 if tg_table_name='invoices' and exists(select 1 from public.notifications where customer_id=recipient and event_key=event_name and subject=title) then return new; end if;
 select nt.channel,nt.subject,nt.body into channel_name,title,body_text
 from public.notification_templates nt where nt.event_key=event_name and nt.enabled
 order by case nt.channel when 'in_app' then 0 else 1 end limit 1;
 if not found then
  channel_name:='in_app';
  if tg_table_name='invoices' then title:='Invoice '||new.number; body_text:='A new invoice for INR '||new.total::text||' is available.';
  elsif tg_table_name='payments' then title:='Payment received'; body_text:='We recorded a payment of INR '||new.amount::text||'.';
  else title:='Subscription '||new.number; body_text:='Your subscription status is now '||new.status::text||'.'; end if;
 end if;
 insert into public.notifications(customer_id,event_key,channel,subject,body,delivery_status)
 values(recipient,event_name,coalesce(channel_name,'in_app'),title,body_text,'queued');
 return new;
end $$;
drop trigger if exists queue_invoice_notification on public.invoices;
create trigger queue_invoice_notification after insert on public.invoices for each row execute function public.queue_business_notification();
drop trigger if exists queue_invoice_total_notification on public.invoices;
create trigger queue_invoice_total_notification after update of total on public.invoices for each row when (old.total is distinct from new.total) execute function public.queue_business_notification();
drop trigger if exists queue_invoice_status_notification on public.invoices;
create trigger queue_invoice_status_notification after update of status on public.invoices for each row when (old.status is distinct from new.status) execute function public.queue_business_notification();
drop trigger if exists queue_payment_notification on public.payments;
create trigger queue_payment_notification after insert on public.payments for each row execute function public.queue_business_notification();
drop trigger if exists queue_subscription_notification on public.subscriptions;
create trigger queue_subscription_notification after insert or update of status on public.subscriptions for each row execute function public.queue_business_notification();

-- Repeatedly generate overdue billing periods to prevent skipped cycles.
create or replace function public.run_billing() returns int
language plpgsql security definer set search_path=public as $$
declare r record; n int:=0; made uuid; before_date date; rounds int;
begin
 if auth.uid() is not null and not public.is_staff() then raise exception 'Not allowed'; end if;
 update public.subscriptions s set status='closed' from public.plans p
 where p.id=s.plan_id and p.auto_close and p.end_date<current_date and s.status='active';
 for r in select id from public.subscriptions where status='active' and next_billing_date<=current_date order by next_billing_date loop
  rounds:=0;
  loop
   select next_billing_date into before_date from public.subscriptions where id=r.id and status='active';
   exit when before_date is null or before_date>current_date or rounds>=120;
   made:=public.generate_invoice(r.id);
   if made is not null then n:=n+1; end if;
   rounds:=rounds+1;
   exit when (select next_billing_date from public.subscriptions where id=r.id)=before_date;
  end loop;
 end loop;
 return n;
end $$;

create or replace function public.run_business_automations() returns jsonb
language plpgsql security definer set search_path=public as $$
declare made int; expired_quotes int; expiry_count int; overdue_count int; run_id uuid; n int:=0;
begin
 if auth.uid() is not null and not public.is_staff() then raise exception 'Not allowed'; end if;
 insert into public.automation_runs(status,input,started_at) values('running',jsonb_build_object('requested_by',auth.uid()),now()) returning id into run_id;
 update public.quotations set status='expired' where status in ('draft','sent') and valid_until<current_date;
 get diagnostics expired_quotes=row_count;
 update public.subscriptions s set status='closed' from public.plans p
 where p.id=s.plan_id and p.auto_close and p.end_date<current_date and s.status='active';
 get diagnostics expiry_count=row_count;
 made:=public.run_billing();
 insert into public.notifications(customer_id,event_key,channel,subject,body,delivery_status)
 select i.customer_id,'overdue_invoice_reminder','in_app','Overdue invoice '||i.number,
        'Invoice '||i.number||' has an outstanding balance of INR '||(i.total-i.amount_paid)::text||'.','queued'
 from public.invoices i join public.profiles p on p.id=i.customer_id where i.status='confirmed' and i.due_date<current_date
 and p.notification_preferences->'billing_reminders' is distinct from 'false'::jsonb
 and not exists(select 1 from public.notifications n where n.customer_id=i.customer_id and n.event_key='overdue_invoice_reminder' and n.subject='Overdue invoice '||i.number and n.created_at::date=current_date);
 get diagnostics overdue_count=row_count;
 update public.automation_runs set status='completed',output=jsonb_build_object('invoices_created',made,'quotes_expired',expired_quotes,'subscriptions_closed',expiry_count,'reminders_queued',overdue_count),completed_at=now() where id=run_id;
 return jsonb_build_object('invoices_created',made,'quotes_expired',expired_quotes,'subscriptions_closed',expiry_count,'reminders_queued',overdue_count);
exception when others then
 if run_id is not null then update public.automation_runs set status='failed',error=sqlerrm,completed_at=now() where id=run_id; end if;
 raise;
end $$;

revoke all on function public.run_business_automations() from public,anon;
grant execute on function public.run_business_automations() to authenticated;

commit;
