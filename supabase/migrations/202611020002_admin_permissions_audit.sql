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
