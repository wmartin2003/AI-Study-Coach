-- Update the signup bootstrap trigger to also populate first_name/last_name
-- when the client provides them (the new sign-up form collects them
-- separately rather than a single full name field).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  meta_first_name text := new.raw_user_meta_data ->> 'first_name';
  meta_last_name text := new.raw_user_meta_data ->> 'last_name';
  meta_full_name text := new.raw_user_meta_data ->> 'full_name';
  resolved_full_name text := coalesce(
    meta_full_name,
    nullif(trim(both ' ' from concat_ws(' ', meta_first_name, meta_last_name)), ''),
    split_part(new.email, '@', 1)
  );
begin
  insert into public.profiles (id, full_name, first_name, last_name)
  values (new.id, resolved_full_name, meta_first_name, meta_last_name)
  on conflict (id) do nothing;

  insert into public.user_stats (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;
