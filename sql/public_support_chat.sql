-- I M SHOP public customer-support chat API
-- Run once in the Supabase SQL Editor for project ubkultowuzonvkdqqihd.
-- Customer access is token-based; raw chat tables remain admin-only.

alter table public.support_conversations
  add column if not exists customer_token_hash text;

create or replace function public.create_public_support_chat(
  p_name text, p_phone text, p_subject text, p_body text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_token text;
begin
  if length(trim(coalesce(p_name, ''))) not between 2 and 100 then
    raise exception 'নাম ২ থেকে ১০০ অক্ষরের হতে হবে';
  end if;
  if length(trim(coalesce(p_phone, ''))) > 30 then
    raise exception 'মোবাইল নম্বর সর্বোচ্চ ৩০ অক্ষরের হতে পারে';
  end if;
  if length(trim(coalesce(p_body, ''))) not between 1 and 3000 then
    raise exception 'মেসেজ ১ থেকে ৩০০০ অক্ষরের হতে হবে';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.support_conversations
    (customer_name, customer_phone, subject, status, customer_token_hash)
  values
    (trim(p_name), nullif(trim(coalesce(p_phone, '')), ''),
     nullif(trim(coalesce(p_subject, '')), ''), 'open',
     encode(extensions.digest(v_token, 'sha256'), 'hex'))
  returning id into v_id;

  insert into public.support_messages (conversation_id, sender_type, body)
  values (v_id, 'customer', trim(p_body));

  return jsonb_build_object('conversation_id', v_id, 'token', v_token);
end;
$$;

create or replace function public.public_support_send(
  p_conversation_id uuid, p_token text, p_body text
) returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_status text;
begin
  if length(coalesce(p_token, '')) <> 64
     or length(trim(coalesce(p_body, ''))) not between 1 and 3000 then
    raise exception 'অবৈধ টোকেন বা মেসেজ';
  end if;

  select status into v_status
  from public.support_conversations
  where id = p_conversation_id
    and customer_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  if not found then raise exception 'চ্যাট পাওয়া যায়নি'; end if;
  if v_status <> 'open' then raise exception 'এই চ্যাটটি বন্ধ'; end if;

  insert into public.support_messages (conversation_id, sender_type, body)
  values (p_conversation_id, 'customer', trim(p_body));

  update public.support_conversations set updated_at = now()
  where id = p_conversation_id;

  return true;
end;
$$;

create or replace function public.public_support_messages(
  p_conversation_id uuid, p_token text
) returns table(id uuid, sender_type text, body text, created_at timestamptz, status text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if length(coalesce(p_token, '')) <> 64 or not exists (
    select 1 from public.support_conversations c
    where c.id = p_conversation_id
      and c.customer_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  ) then
    raise exception 'চ্যাট পাওয়া যায়নি';
  end if;

  return query
    select m.id, m.sender_type, m.body, m.created_at, c.status
    from public.support_messages m
    join public.support_conversations c on c.id = m.conversation_id
    where c.id = p_conversation_id
    order by m.created_at;
end;
$$;

revoke all on function public.create_public_support_chat(text,text,text,text) from public, authenticated;
revoke all on function public.public_support_send(uuid,text,text) from public, authenticated;
revoke all on function public.public_support_messages(uuid,text) from public, authenticated;
grant execute on function public.create_public_support_chat(text,text,text,text) to anon, authenticated;
grant execute on function public.public_support_send(uuid,text,text) to anon, authenticated;
grant execute on function public.public_support_messages(uuid,text) to anon, authenticated;

-- Keep direct customer table access disabled; existing active-admin RLS policies remain in force.
