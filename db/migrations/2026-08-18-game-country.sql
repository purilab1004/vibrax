-- 게임 국가 (ISO alpha-2). 비어 있으면 제작자 프로필 국가로 자동 채움. 멱등.
alter table public.games add column if not exists country text;
update public.games g set country = p.country from public.profiles p where p.id = g.user_id and g.country is null and p.country is not null;
create or replace function public.games_default_country() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.country is null then select country into new.country from profiles where id = new.user_id; end if;
  return new;
end $$;
drop trigger if exists games_default_country on public.games;
create trigger games_default_country before insert on public.games for each row execute function public.games_default_country();
