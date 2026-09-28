create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  muscle_group text not null,
  created_at timestamptz not null default now(),
  constraint exercises_name_not_blank check (length(trim(name)) > 0)
);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint workout_sessions_finished_at_matches_status check (
    (status = 'active' and finished_at is null) or
    (status <> 'active' and finished_at is not null)
  )
);

create unique index workout_sessions_one_active_per_user
  on public.workout_sessions (user_id) where status = 'active';

create index workout_sessions_history
  on public.workout_sessions (user_id, started_at desc) where status = 'completed';

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  unique (workout_session_id, exercise_id),
  unique (workout_session_id, position)
);

create index workout_exercises_previous_record
  on public.workout_exercises (exercise_id, created_at desc);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  position integer not null check (position > 0),
  weight_kg numeric(7, 2) not null check (weight_kg >= 0),
  reps integer not null check (reps > 0),
  recorded_at timestamptz not null default now(),
  unique (workout_exercise_id, position)
);

create function public.enforce_workout_session_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'active' then
    raise exception 'Finished workouts cannot be changed';
  end if;

  if new.id <> old.id or new.user_id <> old.user_id or new.started_at <> old.started_at then
    raise exception 'Workout identity and start time cannot be changed';
  end if;

  if new.status = 'active' then
    new.finished_at := null;
  else
    if new.status = 'completed' and not exists (
      select 1
      from public.workout_exercises as workout_exercise
      join public.workout_sets as workout_set
        on workout_set.workout_exercise_id = workout_exercise.id
      where workout_exercise.workout_session_id = old.id
    ) then
      raise exception 'Complete at least one set before finishing';
    end if;
    new.finished_at := now();
  end if;

  return new;
end;
$$;

create trigger workout_session_transition
before update on public.workout_sessions
for each row execute function public.enforce_workout_session_transition();

alter table public.exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;

revoke all on table public.exercises, public.workout_sessions,
  public.workout_exercises, public.workout_sets from anon, authenticated;

grant select on public.exercises to authenticated;
grant select, insert, update on public.workout_sessions to authenticated;
grant select, insert on public.workout_exercises to authenticated;
grant select, insert, update, delete on public.workout_sets to authenticated;

create policy "Authenticated users can read exercise catalog"
on public.exercises for select to authenticated using (true);

create policy "Users can read their workouts"
on public.workout_sessions for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can start their workouts"
on public.workout_sessions for insert to authenticated
with check ((select auth.uid()) = user_id and status = 'active' and finished_at is null);

create policy "Users can finish or cancel active workouts"
on public.workout_sessions for update to authenticated
using ((select auth.uid()) = user_id and status = 'active')
with check ((select auth.uid()) = user_id);

create policy "Users can read exercises in their workouts"
on public.workout_exercises for select to authenticated
using (exists (
  select 1 from public.workout_sessions as workout
  where workout.id = workout_session_id and workout.user_id = (select auth.uid())
));

create policy "Users can add exercises to active workouts"
on public.workout_exercises for insert to authenticated
with check (exists (
  select 1 from public.workout_sessions as workout
  where workout.id = workout_session_id
    and workout.user_id = (select auth.uid()) and workout.status = 'active'
));

create policy "Users can read their sets"
on public.workout_sets for select to authenticated
using (exists (
  select 1
  from public.workout_exercises as workout_exercise
  join public.workout_sessions as workout on workout.id = workout_exercise.workout_session_id
  where workout_exercise.id = workout_exercise_id and workout.user_id = (select auth.uid())
));

create policy "Users can add sets to active workouts"
on public.workout_sets for insert to authenticated
with check (exists (
  select 1
  from public.workout_exercises as workout_exercise
  join public.workout_sessions as workout on workout.id = workout_exercise.workout_session_id
  where workout_exercise.id = workout_exercise_id
    and workout.user_id = (select auth.uid()) and workout.status = 'active'
));

create policy "Users can update sets in active workouts"
on public.workout_sets for update to authenticated
using (exists (
  select 1
  from public.workout_exercises as workout_exercise
  join public.workout_sessions as workout on workout.id = workout_exercise.workout_session_id
  where workout_exercise.id = workout_exercise_id
    and workout.user_id = (select auth.uid()) and workout.status = 'active'
))
with check (exists (
  select 1
  from public.workout_exercises as workout_exercise
  join public.workout_sessions as workout on workout.id = workout_exercise.workout_session_id
  where workout_exercise.id = workout_exercise_id
    and workout.user_id = (select auth.uid()) and workout.status = 'active'
));

create policy "Users can delete sets in active workouts"
on public.workout_sets for delete to authenticated
using (exists (
  select 1
  from public.workout_exercises as workout_exercise
  join public.workout_sessions as workout on workout.id = workout_exercise.workout_session_id
  where workout_exercise.id = workout_exercise_id
    and workout.user_id = (select auth.uid()) and workout.status = 'active'
));

insert into public.exercises (name, muscle_group) values
  ('ベンチプレス', '胸'),
  ('インクラインダンベルプレス', '胸'),
  ('チェストプレス', '胸'),
  ('ダンベルフライ', '胸'),
  ('スクワット', '脚'),
  ('レッグプレス', '脚'),
  ('レッグエクステンション', '脚'),
  ('レッグカール', '脚'),
  ('デッドリフト', '背中'),
  ('ラットプルダウン', '背中'),
  ('シーテッドロー', '背中'),
  ('懸垂', '背中'),
  ('ショルダープレス', '肩'),
  ('サイドレイズ', '肩'),
  ('リアレイズ', '肩'),
  ('ダンベルカール', '腕'),
  ('バーベルカール', '腕'),
  ('トライセプスプッシュダウン', '腕'),
  ('ディップス', '腕'),
  ('クランチ', '腹筋')
on conflict (name) do nothing;
