-- I M SHOP: atomic stock adjustment with inventory audit history
-- Run once in Supabase SQL Editor before using the Stock page.
CREATE OR REPLACE FUNCTION public.admin_adjust_stock(
  p_product_id uuid,
  p_new_quantity integer,
  p_reason text DEFAULT 'manual_adjustment'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_quantity integer;
  v_delta integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Admin permission required' USING ERRCODE = '42501';
  END IF;
  IF p_new_quantity IS NULL OR p_new_quantity < 0 THEN
    RAISE EXCEPTION 'Stock quantity must be zero or greater';
  END IF;

  SELECT stock_quantity INTO v_old_quantity
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  v_delta := p_new_quantity - COALESCE(v_old_quantity, 0);
  UPDATE public.products
  SET stock_quantity = p_new_quantity
  WHERE id = p_product_id;

  IF v_delta <> 0 THEN
    INSERT INTO public.inventory_movements
      (product_id, quantity_change, reason, reference)
    VALUES
      (p_product_id, v_delta, COALESCE(NULLIF(p_reason, ''), 'manual_adjustment'),
       'Admin stock adjustment: ' || COALESCE(v_old_quantity, 0)::text || ' -> ' || p_new_quantity::text);
  END IF;

  RETURN jsonb_build_object(
    'product_id', p_product_id,
    'previous_quantity', COALESCE(v_old_quantity, 0),
    'new_quantity', p_new_quantity,
    'quantity_change', v_delta
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_adjust_stock(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_stock(uuid, integer, text) TO authenticated;
