-- Subscription pause/resume actions and lifecycle history.
begin;
alter table public.subscriptions add column if not exists paused_at timestamptz;
alter table public.subscriptions add column if not exists paused_next_billing_date date;

create or replace function public.pause_my_subscription(p_sub uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 update public.subscriptions s set status='paused',paused_at=now(),paused_next_billing_date=s.next_billing_date
 where s.id=p_sub and s.customer_id=auth.uid() and s.status='active'
 and exists(select 1 from public.plans p where p.id=s.plan_id and p.can_pause);
 if not found then raise exception 'This subscription cannot be paused'; end if;
end $$;

create or replace function public.resume_my_subscription(p_sub uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 update public.subscriptions s set status='active',
  next_billing_date=case when s.paused_next_billing_date is null then current_date
       else s.paused_next_billing_date + greatest(current_date-coalesce(s.paused_at::date,current_date),0) end,
  paused_at=null,paused_next_billing_date=null
 where s.id=p_sub and s.customer_id=auth.uid() and s.status='paused';
 if not found then raise exception 'This subscription cannot be resumed'; end if;
end $$;

create or replace function public.record_subscription_history() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' then
  insert into public.subscription_history(subscription_id,actor_id,action,new_values) values(new.id,auth.uid(),'created',to_jsonb(new));
 elsif old.status is distinct from new.status then
  insert into public.subscription_history(subscription_id,actor_id,action,old_values,new_values)
  values(new.id,auth.uid(),'status_changed',jsonb_build_object('status',old.status),jsonb_build_object('status',new.status));
 end if;
 return new;
end $$;
drop trigger if exists subscription_history_trigger on public.subscriptions;
create trigger subscription_history_trigger after insert or update of status on public.subscriptions for each row execute function public.record_subscription_history();

revoke all on function public.pause_my_subscription(uuid) from public,anon;
grant execute on function public.pause_my_subscription(uuid) to authenticated;
revoke all on function public.resume_my_subscription(uuid) from public,anon;
grant execute on function public.resume_my_subscription(uuid) to authenticated;
commit;
