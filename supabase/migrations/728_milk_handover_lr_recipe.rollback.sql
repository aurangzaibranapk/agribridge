-- 728 rollback. Recipe ka khana hat ta hai. Litre aur raseed nahi mitti.
-- Madad 726 wale alfaaz par wapas.

alter table public.milk_dispatches drop constraint if exists milk_dispatches_lr_baseline;
alter table public.milk_dispatches drop column if exists lr_baseline;

update public.feature_help set
  how_steps = array[
    'Milk Handover Certificate kholen. Branch, tareekh, shift (subah/shaam) aur MCC naam.',
    'Har chiller ki qatar: number, milk type, gross litre, FAT, LR, SNF. TS khud (SNF+FAT). Adjusted volume khud likhein — khali chhorna theek hai.',
    'Min spec se neeche ho to peela nishan. Save rukta nahi. Company phir bhi qubool kar sakti hai.',
    'Accepted YES ya NO. NO par wajah lazmi. Licensee aur collector ka naam dastakhat ke taur par.',
    'Print se kaghaz jaisa safha. Company ki raseed (kitne litre mane) Rawangi wale safhe par, jab aa jaye.'
  ],
  mistakes = array[
    'Khali chiller ki miqdar 0 likh dena jab doodh gaya hi nahi — kam az kam ek asal miqdar chahiye.',
    'Adjusted volume khali chhor kar ye samajhna ke system ne bana diya. Andaza tabhi likha jata hai jab aap Likhein dabayein.',
    'Min spec se neeche ko rok samajhna. Wo nishan hai, mana nahi.',
    'Do shift ko ek certificate mein mila dena. Subah aur shaam alag hain.',
    'Raseed (company ne kitna mana) ko certificate ke Adjusted Volume se khud barabar samajhna. Dono alag hain.'
  ],
  next_step = 'Raseed aa jaye to Doodh ki Rawangi par company ka litre likhein. Us ke baad certificate ki miqdar nahi badalti; faisla aur dastakhat ab bhi.'
where feature_key = 'milk-collection.handover' and lang = 'rm';
