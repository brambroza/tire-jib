alter table if exists public.customes
  add column if not exists line_msg_user_id text;

update public.customes
set
  line_msg_user_id = coalesce(line_msg_user_id, line_user_id)
where line_user_id is not null;

create index if not exists customes_line_msg_user_id_idx
  on public.customes (line_msg_user_id);
