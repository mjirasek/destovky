-- Destovky registration support.
-- Run this once if you want newly registered users to create their own profile.

drop policy if exists "users can create own profile" on public.profiles;
create policy "users can create own profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);
