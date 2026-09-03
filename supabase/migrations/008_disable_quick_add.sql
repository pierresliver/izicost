-- 008: informal-market quick-add is switched OFF for launch (PS, 2026-09-03): an unchecked entry
-- point would let one person poison the community averages. The function and its log table stay;
-- to re-enable later (with trust rules), run the GRANT below again.
revoke execute on function public.quick_add_price(text, numeric, text, text, text, numeric, text) from public, anon, authenticated;
-- grant execute on function public.quick_add_price(text, numeric, text, text, text, numeric, text) to authenticated;
