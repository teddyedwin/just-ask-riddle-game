create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now()
);

create table if not exists public.scores (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (user_id) on delete set null,
  player_name text not null check (char_length(trim(player_name)) between 1 and 40),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  score integer not null check (score > 0),
  completed_at timestamptz not null default now()
);

alter table public.scores alter column user_id drop not null;
alter table public.scores add column if not exists player_name text;
update public.scores s
  set player_name = coalesce(p.display_name, 'Player')
  from public.profiles p
  where s.user_id = p.user_id and s.player_name is null;
update public.scores set player_name = 'Player' where player_name is null;
alter table public.scores alter column player_name set not null;

create table if not exists public.riddle_game_sessions (
  id uuid primary key,
  user_id uuid references auth.users (id) on delete set null,
  player_name text not null check (char_length(trim(player_name)) between 1 and 40),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  questions jsonb not null,
  current_index integer not null default 0 check (current_index >= 0),
  last_answered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.riddle_game_sessions alter column user_id drop not null;
alter table public.riddle_game_sessions add column if not exists player_name text;
update public.riddle_game_sessions s
  set player_name = coalesce(p.display_name, 'Player')
  from public.profiles p
  where s.user_id = p.user_id and s.player_name is null;
update public.riddle_game_sessions set player_name = 'Player' where player_name is null;
alter table public.riddle_game_sessions alter column player_name set not null;

create index if not exists scores_leaderboard_order_idx
  on public.scores (score desc, completed_at asc);

create or replace function public.create_player_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text;
begin
  requested_name := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');
  if requested_name is null then
    requested_name := split_part(coalesce(new.email, 'Player'), '@', 1);
  end if;

  insert into public.profiles (user_id, display_name)
    values (new.id, left(requested_name, 40))
    on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_player_profile_after_signup on auth.users;
create trigger create_player_profile_after_signup
  after insert on auth.users
  for each row execute function public.create_player_profile();

alter table public.profiles enable row level security;
alter table public.scores enable row level security;
alter table public.riddle_game_sessions enable row level security;

drop policy if exists "Profiles are publicly readable" on public.profiles;
create policy "Profiles are publicly readable"
  on public.profiles for select
  to anon, authenticated
  using (true);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Scores are publicly readable" on public.scores;
create policy "Scores are publicly readable"
  on public.scores for select
  to anon, authenticated
  using (true);

revoke all on public.riddle_game_sessions from anon, authenticated;
revoke insert, update, delete on public.scores from anon, authenticated;
grant select on public.profiles, public.scores to anon, authenticated;
grant insert, update on public.profiles to authenticated;
revoke all on function public.create_player_profile() from public, anon, authenticated;

drop function if exists public.submit_riddle_answer(uuid, uuid, text);
drop function if exists public.submit_riddle_answer(uuid, text);

create function public.submit_riddle_answer(
  p_game_id uuid,
  p_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  game public.riddle_game_sessions%rowtype;
  current_question jsonb;
  next_question jsonb;
  is_correct boolean;
  final_score integer;
begin
  select *
    into game
    from public.riddle_game_sessions
    where id = p_game_id
    for update;

  if not found or game.completed_at is not null
    or game.created_at < now() - interval '2 hours'
  then
    raise exception 'Game session is missing, expired, or already completed.';
  end if;

  if now() < game.last_answered_at + interval '1 second' then
    raise exception 'Please wait before submitting another answer.';
  end if;

  current_question := game.questions -> game.current_index;
  if current_question is null then
    raise exception 'Game session has invalid question data.';
  end if;

  is_correct := lower(trim(p_answer)) = lower(current_question ->> 'answer');
  update public.riddle_game_sessions
    set current_index = current_index + case when is_correct then 1 else 0 end,
        last_answered_at = now()
    where id = p_game_id;

  if not is_correct then
    return jsonb_build_object('correct', false);
  end if;

  if game.current_index + 1 = jsonb_array_length(game.questions) then
    final_score := jsonb_array_length(game.questions) *
      case game.difficulty
        when 'easy' then 10
        when 'medium' then 20
        when 'hard' then 30
      end;

    insert into public.scores (user_id, player_name, difficulty, score)
      values (null, game.player_name, game.difficulty, final_score);

    update public.riddle_game_sessions
      set completed_at = now()
      where id = p_game_id;

    return jsonb_build_object(
      'correct', true,
      'completed', true,
      'score', final_score
    );
  end if;

  next_question := game.questions -> (game.current_index + 1);
  return jsonb_build_object(
    'correct', true,
    'completed', false,
    'question', jsonb_build_object(
      'question', next_question -> 'question',
      'options', next_question -> 'options'
    )
  );
end;
$$;

revoke all on function public.submit_riddle_answer(uuid, text) from public, anon, authenticated;
grant execute on function public.submit_riddle_answer(uuid, text) to service_role;
