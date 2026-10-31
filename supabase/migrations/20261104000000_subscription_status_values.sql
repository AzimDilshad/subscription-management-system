-- This enum value must be committed before functions begin using it.
alter type public.sub_status add value if not exists 'paused';
