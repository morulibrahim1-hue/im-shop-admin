-- ===== MIGRATION 1 =====
-- I M SHOP Admin App: additive feature schema
-- Run once in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS / upserts).
create extension if not exists pgcrypto;

create table if not exists public.admin_app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
create table if not exists public.admin_app_staff_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role_key text not null default 'support' check (role_key in ('admin','manager','product_manager','order_manager','inventory_manager','marketing_manager','support')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
create table if not exists public.admin_app_permissions (
  role_key text not null,
  module_key text not null,
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  primary key(role_key,module_key)
);
create table if not exists public.admin_app_coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null default 'fixed' check(discount_type in ('fixed','percent')),
  discount_value numeric(12,2) not null check(discount_value >= 0),
  min_order numeric(12,2) not null default 0,
  max_uses integer,
  used_count integer not null default 0,
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.admin_app_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  image_url text,
  target_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.admin_app_delivery_zones (
  id uuid primary key default gen_random_uuid(),
  zone_name text not null,
  charge numeric(12,2) not null default 0 check(charge >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.admin_app_payment_methods (
  id uuid primary key default gen_random_uuid(),
  method_key text not null unique,
  display_name text not null,
  instructions text,
  is_enabled boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.admin_app_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  audience text not null default 'admin',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.admin_app_stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  quantity_before integer not null,
  quantity_after integer not null,
  change_amount integer not null,
  reason text not null default 'manual_adjustment',
  note text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.admin_app_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  module_key text not null,
  record_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.categories add column if not exists parent_id uuid references public.categories(id) on delete set null;
alter table public.categories add column if not exists sort_order integer not null default 0;

-- Permission presets. The admin role always has full access in the helper below.
insert into public.admin_app_permissions(role_key,module_key,can_view,can_create,can_edit,can_delete)
select r.role_key,m.module_key,
  (r.role_key='manager' or r.role_key='product_manager' and m.module_key in ('products','categories','inventory') or r.role_key='order_manager' and m.module_key in ('orders','customers') or r.role_key='inventory_manager' and m.module_key in ('inventory','products') or r.role_key='marketing_manager' and m.module_key in ('marketing','banners','notifications') or r.role_key='support' and m.module_key in ('orders','customers')),
  (r.role_key='manager' or r.role_key='product_manager' and m.module_key in ('products','categories') or r.role_key='order_manager' and m.module_key='orders' or r.role_key='inventory_manager' and m.module_key='inventory' or r.role_key='marketing_manager' and m.module_key in ('marketing','banners') ),
  (r.role_key='manager' or r.role_key='product_manager' and m.module_key in ('products','categories') or r.role_key='order_manager' and m.module_key='orders' or r.role_key='inventory_manager' and m.module_key='inventory' or r.role_key='marketing_manager' and m.module_key in ('marketing','banners')),
  (r.role_key='manager' or r.role_key='product_manager' and m.module_key='products' or r.role_key='marketing_manager' and m.module_key='marketing')
from (values ('manager'),('product_manager'),('order_manager'),('inventory_manager'),('marketing_manager'),('support')) r(role_key)
cross join (values ('dashboard'),('products'),('categories'),('orders'),('inventory'),('customers'),('reports'),('payments'),('delivery'),('marketing'),('banners'),('notifications'),('settings'),('staff'),('security')) m(module_key)
on conflict(role_key,module_key) do nothing;

insert into public.admin_app_delivery_zones(zone_name,charge)
select 'ঢাকার ভিতরে',70 where not exists(select 1 from public.admin_app_delivery_zones where zone_name='ঢাকার ভিতরে');
insert into public.admin_app_delivery_zones(zone_name,charge)
select 'ঢাকার বাইরে',120 where not exists(select 1 from public.admin_app_delivery_zones where zone_name='ঢাকার বাইরে');
insert into public.admin_app_payment_methods(method_key,display_name,is_enabled)
values ('cod','ক্যাশ অন ডেলিভারি',true),('bkash','বিকাশ',false),('nagad','নগদ',false),('card','কার্ড',false)
on conflict(method_key) do nothing;

create or replace function public.admin_app_is_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.staff_profiles s where s.user_id=auth.uid() and s.role='admin' and s.is_active=true); $$;

create or replace function public.admin_app_has_permission(p_module text,p_action text default 'view')
returns boolean language sql stable security definer set search_path=public
as $$
 select public.admin_app_is_admin() or exists(
   select 1 from public.admin_app_staff_roles sr
   join public.admin_app_permissions p on p.role_key=sr.role_key
   where sr.user_id=auth.uid() and
    case p_action when 'create' then p.can_create when 'edit' then p.can_edit when 'delete' then p.can_delete else p.can_view end
    and p.module_key=p_module
 );
$$;

create or replace function public.admin_app_log(p_action text,p_module text,p_record_id text default null,p_details jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path=public
as $$ declare v_id uuid; begin
 if not public.admin_app_is_admin() and not exists(select 1 from public.admin_app_staff_roles where user_id=auth.uid()) then raise exception 'Not authorized'; end if;
 insert into public.admin_app_audit_logs(actor_id,action,module_key,record_id,details)
 values(auth.uid(),p_action,p_module,p_record_id,coalesce(p_details,'{}'::jsonb)) returning id into v_id;
 return v_id;
end; $$;

do $$ declare t text; begin
 foreach t in array array['admin_app_settings','admin_app_staff_roles','admin_app_permissions','admin_app_coupons','admin_app_banners','admin_app_delivery_zones','admin_app_payment_methods','admin_app_notifications','admin_app_stock_movements','admin_app_audit_logs'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists admin_app_admin_all on public.%I',t);
  execute format('create policy admin_app_admin_all on public.%I for all to authenticated using (public.admin_app_is_admin()) with check (public.admin_app_is_admin())',t);
 end loop;
end $$;

grant execute on function public.admin_app_is_admin() to authenticated;
grant execute on function public.admin_app_has_permission(text,text) to authenticated;
grant execute on function public.admin_app_log(text,text,text,jsonb) to authenticated;


-- ===== MIGRATION 2 =====
-- I M SHOP: enforce module permissions and record stock/audit history
create or replace function public.admin_app_capture_product_change()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
 if new.stock_quantity is distinct from old.stock_quantity then
  insert into public.admin_app_stock_movements(product_id,quantity_before,quantity_after,change_amount,reason,changed_by)
  values(new.id,coalesce(old.stock_quantity,0),coalesce(new.stock_quantity,0),coalesce(new.stock_quantity,0)-coalesce(old.stock_quantity,0),'manual_adjustment',auth.uid());
 end if;
 if row(new.name,new.price,new.category_id,new.is_active,new.stock_quantity) is distinct from row(old.name,old.price,old.category_id,old.is_active,old.stock_quantity) then
  insert into public.admin_app_audit_logs(actor_id,action,module_key,record_id,details)
  values(auth.uid(),'update','products',new.id::text,jsonb_build_object('name',new.name,'price',new.price,'stock_quantity',new.stock_quantity,'is_active',new.is_active));
 end if;
 return new;
end $$;
drop trigger if exists admin_app_product_change on public.products;
create trigger admin_app_product_change after update on public.products
for each row execute function public.admin_app_capture_product_change();

create or replace function public.admin_app_capture_order_change()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
 if new.status is distinct from old.status then
  insert into public.admin_app_audit_logs(actor_id,action,module_key,record_id,details)
  values(auth.uid(),'status_change','orders',new.id::text,jsonb_build_object('from',old.status,'to',new.status));
 end if;
 return new;
end $$;
drop trigger if exists admin_app_order_change on public.orders;
create trigger admin_app_order_change after update on public.orders
for each row execute function public.admin_app_capture_order_change();

-- Fine-grained staff access for the core modules. Admin retains existing full-access policies.
drop policy if exists admin_app_products_select on public.products;
create policy admin_app_products_select on public.products for select to authenticated
using (public.admin_app_has_permission('products','view'));
drop policy if exists admin_app_products_insert on public.products;
create policy admin_app_products_insert on public.products for insert to authenticated
with check (public.admin_app_has_permission('products','create'));
drop policy if exists admin_app_products_update on public.products;
create policy admin_app_products_update on public.products for update to authenticated
using (public.admin_app_has_permission('products','edit'))
with check (public.admin_app_has_permission('products','edit'));
drop policy if exists admin_app_products_delete on public.products;
create policy admin_app_products_delete on public.products for delete to authenticated
using (public.admin_app_has_permission('products','delete'));

drop policy if exists admin_app_categories_select on public.categories;
create policy admin_app_categories_select on public.categories for select to authenticated
using (public.admin_app_has_permission('categories','view'));
drop policy if exists admin_app_categories_insert on public.categories;
create policy admin_app_categories_insert on public.categories for insert to authenticated
with check (public.admin_app_has_permission('categories','create'));
drop policy if exists admin_app_categories_update on public.categories;
create policy admin_app_categories_update on public.categories for update to authenticated
using (public.admin_app_has_permission('categories','edit'))
with check (public.admin_app_has_permission('categories','edit'));
drop policy if exists admin_app_categories_delete on public.categories;
create policy admin_app_categories_delete on public.categories for delete to authenticated
using (public.admin_app_has_permission('categories','delete'));

drop policy if exists admin_app_orders_select on public.orders;
create policy admin_app_orders_select on public.orders for select to authenticated
using (public.admin_app_has_permission('orders','view'));
drop policy if exists admin_app_orders_update on public.orders;
create policy admin_app_orders_update on public.orders for update to authenticated
using (public.admin_app_has_permission('orders','edit'))
with check (public.admin_app_has_permission('orders','edit'));

drop policy if exists admin_app_customers_select on public.customers;
create policy admin_app_customers_select on public.customers for select to authenticated
using (public.admin_app_has_permission('customers','view'));

grant execute on function public.admin_app_capture_product_change() to authenticated;
grant execute on function public.admin_app_capture_order_change() to authenticated;


-- ===== MIGRATION 3 =====
-- Allow active staff to read only their own profile and assigned role.
drop policy if exists admin_app_staff_self_read on public.staff_profiles;
create policy admin_app_staff_self_read on public.staff_profiles
for select to authenticated using (user_id=auth.uid());

drop policy if exists admin_app_role_self_read on public.admin_app_staff_roles;
create policy admin_app_role_self_read on public.admin_app_staff_roles
for select to authenticated using (user_id=auth.uid());
