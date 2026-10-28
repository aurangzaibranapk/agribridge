-- 624: Call Center Agent — sirf naya role.
--
-- Postgres naya enum value usi transaction mein istemal nahi hone deta.
-- Is liye yahan SIRF value hai. Tables, RLS aur functions 625 mein hain.
-- Live par tab tak mat chalayein jab tak backup verify na ho.
-- Owner khud pehle Testing, phir Live. Koi remote project yahan se nahi chalta.

alter type public.user_role add value if not exists 'call_center_agent';
