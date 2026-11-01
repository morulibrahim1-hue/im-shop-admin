-- Allow active staff to read only their own profile and assigned role.
drop policy if exists admin_app_staff_self_read on public.staff_profiles;
create policy admin_app_staff_self_read on public.staff_profiles
for select to authenticated using (user_id=auth.uid());

drop policy if exists admin_app_role_self_read on public.admin_app_staff_roles;
create policy admin_app_role_self_read on public.admin_app_staff_roles
for select to authenticated using (user_id=auth.uid());
