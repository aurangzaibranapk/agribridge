-- Command Center Stage 3 -- malik ki tasdeeq ka daayra.
--
-- Faisla (malik, 14 September): tajweez AI khud amal mein nahi layegi.
-- Is Claude Code session (main) ne tajweez likhi, WhatsApp par bhej di
-- (Stage 2 se) -- ab agar malik WhatsApp par "haan"/"theek hai" jaisa
-- kuch likhe, wo tajweez "confirmed" ban jati hai aur is safhe (aur agli
-- Claude Code session) ko saaf pata chal jata hai ke amal ab karna hai.
-- Amal phir bhi HAMESHA insaan (Claude Code session) khud karta hai --
-- koi khud-kaar execution nahi.

alter table public.owner_whatsapp_commands
  add column if not exists confirmed_at timestamptz;

alter table public.owner_whatsapp_commands drop constraint if exists owner_whatsapp_commands_status_check;
alter table public.owner_whatsapp_commands
  add constraint owner_whatsapp_commands_status_check
  check (status in ('received', 'acknowledged', 'responded', 'confirmed', 'dismissed', 'done'));
