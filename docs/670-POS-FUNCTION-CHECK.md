# 670 — POS function, pehle milao

needs owner approval. Ye file khud database par nahi chalti.

Live par `create_pos_sale_base_504` ki body migration 525 se alag ho sakti hai. Is liye 670 us function ko replace **nahi** karti.

Apply se pehle (backup ke baad):

```sql
select pg_get_functiondef(
  'public.create_pos_sale_base_504(jsonb,text,numeric,numeric,uuid,uuid,jsonb,numeric,text)'::regprocedure
);
```

Is natije ko `supabase/migrations/525_sales_money_guards.sql` ke `create_pos_sale_base_504` se milao.

- **Farq ho** to function mat badlo. Batch wala hissa haath se, sirf ye shart, live body ke andar lagao:

```sql
and (expiry_date is null or expiry_date >= (timezone('Asia/Karachi', now()))::date)
and (initial_quantity is null or remaining_quantity <= initial_quantity)
```

Aur agar batch kam pad jaye lekin bachi hui miqdar sirf expire ya remaining>initial batch par ho, to bikri **mat** roko — `stock_batch_shortfalls` (671) mein likho. 671 ka `fn_consume_sellable_fifo` yahi karta hai.

- **Farq na ho** tab bhi poori body tab hi lagao jab owner likh de. 670 khud replace nahi karti.
