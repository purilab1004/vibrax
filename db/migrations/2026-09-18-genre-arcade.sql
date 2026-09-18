-- 게임 장르에 arcade 추가 (action / adventure / strategy / sports / arcade)
-- genre 컬럼이 enum 이면 값 추가, text + check 제약이면 제약을 새로 만든다.
do $$
declare
  t text;
  c record;
begin
  select udt_name into t
    from information_schema.columns
   where table_schema = 'public' and table_name = 'games' and column_name = 'genre';

  if t is not null and t not in ('text', 'varchar', 'bpchar') then
    execute format('alter type public.%I add value if not exists %L', t, 'arcade');
  else
    for c in
      select conname
        from pg_constraint
       where conrelid = 'public.games'::regclass
         and contype = 'c'
         and pg_get_constraintdef(oid) ilike '%genre%'
    loop
      execute format('alter table public.games drop constraint %I', c.conname);
    end loop;
    alter table public.games
      add constraint games_genre_check
      check (genre::text in ('action', 'adventure', 'strategy', 'sports', 'arcade'));
  end if;
end $$;
