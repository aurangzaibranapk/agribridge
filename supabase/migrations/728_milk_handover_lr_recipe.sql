-- =====================================================================
-- 728: Milk Handover — LR recipe (20 company / 22 vendor) aur madad
-- =====================================================================
-- Koi litre nahi bharta. Sirf recipe ka khana, default 20.
-- 20 = company agreement. 22 = vendor, wahi 3°C bands, ek point kam.
-- 32°C aur raw LR 24: company +4 = 28, vendor +3 = 27.
-- Pehle Testing. Live par tab jab backup verify ho.
-- Rollback: 728_milk_handover_lr_recipe.rollback.sql

alter table public.milk_dispatches
  add column if not exists lr_baseline smallint not null default 20;

alter table public.milk_dispatches drop constraint if exists milk_dispatches_lr_baseline;
alter table public.milk_dispatches
  add constraint milk_dispatches_lr_baseline check (lr_baseline in (20, 22));

comment on column public.milk_dispatches.lr_baseline is
  'LR correction recipe. 20 company agreement (default). 22 vendor, ek point sakht (728).';

update public.feature_help set
  how_steps = array[
    'Milk Handover Certificate kholen. Branch, tareekh, shift aur MCC. Chiller ki qatarein us shift ka MCC stock hain — kisan ki entry na ho tab bhi.',
    'LR recipe chunein. Default 20°C company agreement. 22°C vendor sakht hai: wahi bands, ek point kam. Misal 32°C aur raw LR 24: company 24+4=28, vendor 24+3=27.',
    'Gross, FAT, raw LR aur temperature likhein. SNF aur Adjusted Volume khud bhar jate hain. TS = SNF+FAT. Aap SNF ya Adjusted badal sakte hain. Organo Pass ya Fail.',
    'Min spec se neeche peela nishan (LR corrected par). Save rukta nahi.',
    'Accepted YES ya NO. NO par wajah. Print, WhatsApp aur Email usi recipe ka naam likhte hain jo chuni ho.',
    'Company ki raseed Rawangi par. Fehrist par kitna aaya, kitna gaya, nuqsan ya faida. Raseed na ho to farq nahi — sifar mat parhein.'
  ],
  mistakes = array[
    '20 aur 22 ko ek hi chart samajhna. 32°C par company +4 hai, vendor +3.',
    'Recipe ke baghair SNF ke liye Likhein dhundhna. Gross, FAT aur LR likhte hi khud aata hai.',
    'Raseed na hone ko nuqsan sifar parhna. Raseed abhi nahi — farq baad mein.',
    'Adjusted adhoora ho to us ka jama bana lena.',
    'Min spec ko rok samajhna.',
    'Subah aur shaam ek certificate mein.',
    'Adjusted volume ko company ki raseed samajhna. Dono alag hain.'
  ],
  next_step = 'Raseed aa jaye to Doodh ki Rawangi par company ka litre likhein. Us ke baad miqdar nahi badalti. Fehrist par aaya, gaya aur farq dikhta hai. Print, WhatsApp ya Email se slip bhej sakte hain.'
where feature_key = 'milk-collection.handover' and lang = 'rm';

update public.feature_help set
  how_steps = array[
    'Open Milk Handover Certificate. Chiller rows are that shift''s MCC stock even without farmer entries.',
    'Choose the LR recipe. Default is 20°C company agreement. 22°C vendor is the same bands, one point less. At 32°C and raw LR 24: company 24+4=28, vendor 24+3=27.',
    'Type gross, fat, raw LR and temperature. SNF and adjusted volume fill in. TS is SNF+FAT. You can still change those two.',
    'Below the minimum spec is a warning, not a block. The LR check uses the corrected reading.',
    'Accepted YES or NO. Print, WhatsApp and Email name the recipe you selected.',
    'Company litres stay on Milk Dispatch. The list shows in, out, and loss or gain. No receipt means no gap — do not read that as zero.'
  ],
  mistakes = array[
    'Treating 20°C and 22°C as the same chart. At 32°C company is +4 and vendor is +3.',
    'Looking for a separate Write button. SNF fills in as you type.',
    'Reading a missing receipt as zero loss.',
    'Adding up adjusted volume when a row is still blank.',
    'Treating a minimum-spec warning as a hard stop.',
    'Putting morning and evening on one certificate.',
    'Treating adjusted volume as the company receipt.'
  ],
  next_step = 'When the company receipt arrives, record it on Milk Dispatch. After that, litres freeze. The list shows in, out and the gap. Print, WhatsApp or Email sends the slip.'
where feature_key = 'milk-collection.handover' and lang = 'en';

update public.feature_help set
  how_steps = array[
    'سرٹیفکیٹ کھولیں۔ چلر کی قطاریں اس شفٹ کا اسٹاک ہیں۔',
    'نسخہ چنیں۔ پہلے سے ۲۰ ڈگری کمپنی۔ ۲۲ ڈگری وینڈر ایک پوائنٹ کم۔ ۳۲ ڈگری اور ایل آر ۲۴: کمپنی ۲۸، وینڈر ۲۷۔',
    'گراس، فیٹ، ایل آر اور درجہ حرارت۔ ایس این ایف اور ایڈجسٹڈ خود۔',
    'کم از کم معیار سے نیچے نشان ہے۔ محفوظ رکتا نہیں۔',
    'پرنٹ، واٹس ایپ اور ای میل وہی نسخہ لکھتے ہیں جو چنا ہو۔',
    'رسید روانگی پر۔ فہرست پر آیا، گیا، نقصان یا فائدہ۔ رسید نہ ہو تو فرق صفر نہیں۔'
  ],
  mistakes = array[
    '۲۰ اور ۲۲ کو ایک چارٹ سمجھنا۔',
    'رسید نہ ہونے کو صفر نقصان پڑھنا۔',
    'وارننگ کو پابندی سمجھنا۔'
  ],
  next_step = 'رسید آئے تو روانگی پر کمپنی کا لیٹر لکھیں۔ فہرست پر فرق دکھے گا۔'
where feature_key = 'milk-collection.handover' and lang = 'ur';
