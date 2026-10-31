-- 733: Guzri hui tareekh ke kharche ki wajah.
-- company_expense_requests par column nahi tha. Kitab pehle se
-- journal_entries.backdate_reason maangti hai; yahan wahi wajah rehti hai
-- taake tasdeeq-shuda kharcha baad mein usi wajah se post ho sake.
-- Koi purani qatar, koi raqam, koi journal nahi badalta.
-- Pehle Testing. Live par tab jab backup verify ho.
-- Rollback: 733_expense_backdate_reason.rollback.sql

alter table public.company_expense_requests
  add column if not exists backdate_reason text;

comment on column public.company_expense_requests.backdate_reason is
  'Purani tareekh ki manzoori par wajah. Kitab (journal_entries.backdate_reason) isi se bharti hai.';

update public.feature_help
set mistakes = coalesce(mistakes, '{}'::text[]) || array[
    'Guzri hui tareekh ka kharcha: manzoori se pehle wajah (kam az kam 10 harf). Bina wajah kitab nahi banti aur halat verified rehti hai.'
  ],
  updated_at = now()
where feature_key = 'pending-approvals'
  and lang = 'rm'
  and not (
    coalesce(mistakes, '{}'::text[]) @> array[
      'Guzri hui tareekh ka kharcha: manzoori se pehle wajah (kam az kam 10 harf). Bina wajah kitab nahi banti aur halat verified rehti hai.'
    ]
  );

update public.feature_help
set mistakes = coalesce(mistakes, '{}'::text[]) || array[
    'A backdated expense needs a reason (at least 10 letters) before approval. Without it the ledger does not post and the expense stays verified.'
  ],
  updated_at = now()
where feature_key = 'pending-approvals'
  and lang = 'en'
  and not (
    coalesce(mistakes, '{}'::text[]) @> array[
      'A backdated expense needs a reason (at least 10 letters) before approval. Without it the ledger does not post and the expense stays verified.'
    ]
  );

update public.feature_help
set mistakes = coalesce(mistakes, '{}'::text[]) || array[
    'پرانی تاریخ کے خرچے کی منظوری سے پہلے وجہ (کم از کم ۱۰ حروف)۔ وجہ کے بغیر کتاب نہیں بنتی اور تصدیق برقرار رہتی ہے۔'
  ],
  updated_at = now()
where feature_key = 'pending-approvals'
  and lang = 'ur'
  and not (
    coalesce(mistakes, '{}'::text[]) @> array[
      'پرانی تاریخ کے خرچے کی منظوری سے پہلے وجہ (کم از کم ۱۰ حروف)۔ وجہ کے بغیر کتاب نہیں بنتی اور تصدیق برقرار رہتی ہے۔'
    ]
  );

update public.feature_help
set mistakes = coalesce(mistakes, '{}'::text[]) || array[
    'Guzri hui tareekh ka kharcha: manzoori se pehle wajah (kam az kam 10 harf). Bina wajah kitab nahi banti aur halat verified rehti hai.'
  ],
  updated_at = now()
where feature_key = 'kharche'
  and lang = 'rm'
  and not (
    coalesce(mistakes, '{}'::text[]) @> array[
      'Guzri hui tareekh ka kharcha: manzoori se pehle wajah (kam az kam 10 harf). Bina wajah kitab nahi banti aur halat verified rehti hai.'
    ]
  );
