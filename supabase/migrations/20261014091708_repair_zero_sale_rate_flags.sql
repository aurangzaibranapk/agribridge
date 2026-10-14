-- Kisan Dukan ki 10 October intake mein sale rate khali tha, is liye
-- selling_price Rs 0 gaya. Purane intake raaste ne saath wala
-- sale_rate_pending nishan nahi lagaya, jis se POS ne unhein rate-complete
-- samjha. Purchase/trade rate ko sale rate banana ghalat hai; asal sale
-- rate user Rate Baqi par bharega.
update public.products
set sale_rate_pending = true,
    updated_at = now()
where coalesce(selling_price, 0) <= 0
  and sale_rate_pending = false;

-- Aage koi bhi import/intake Rs 0 ko "rate complete" nahi keh sakta.
-- Positive rate ke sath pending=true ab bhi allowed hai: review workflow
-- purana/stale rate chhupa sakta hai jab tak naya rate tasdeeq na ho.
alter table public.products
  add constraint products_zero_sale_rate_must_be_pending
  check (coalesce(selling_price, 0) > 0 or sale_rate_pending);
