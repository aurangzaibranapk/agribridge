-- =====================================================================
-- AgriBridge — Migration 282: Rozana ke 14 safhon ka help
-- =====================================================================
-- Malik: "har feature AI assistant ko maloom hona chahiye."
--
-- Ginti se pata chala: 183 features mein se sirf 39 ka help likha hua
-- tha. Yani AI ko baqi 144 ka NAAM aur RAASTA to maloom tha, magar "ye
-- safha kis liye hai, kaun chalata hai, kya qadam hain" nahi.
--
-- Yahan wo 14 safhe likhe gaye hain jo ROZ chalte hain aur jin ka amal
-- code se yaqeen ke sath maloom hai: manzoori ki qatar, cash book, cash
-- handover, roz ka milaan, bank milaan, khata, staff khata, shop order,
-- kisan, doodh jama, doodh ki tasdeeq, audit trail, hazri ka record,
-- meri hazri.
--
-- Baqi 130 jaan boojh kar KHALI chhoRe gaye hain. Un ka amal andaze se
-- likhna sab se bura raasta hota: ghalat qadam banda ko ghalat kaam par
-- le jate hain, aur wo ghalti us ke naam par likhi jati hai. Un ke liye
-- do cheezein ki gayin:
--   1. AI ko hidayat (work-coach.ts): jis feature par "MALOOMAT NAHI
--      LIKHI" ka nishan ho, us ke qadam KHUD NA BANAYE -- saaf kahe ke
--      maloomat abhi likhi nahi gayi.
--   2. Likhne ki jagah pehle se maujood hai: /admin/platform/help --
--      wahan har feature ke saamne likha hai ke us ka help hai ya nahi.
--
-- Har qatar mein "ghaltiyan" ka khana khaas tor par ahem hai: wahi wo
-- baatein hain jo asal mein ghalat hoti hain (SoD ki rok, balance haath
-- se likhna, ek kisan do dafa banana, doosre ke phone se hazri).
-- =====================================================================

insert into feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes) values
('submissions','rm',
 'Manzoori ki qatar: jo kaam kisi aur ke haan kehne ka muntazir hai.',
 'Owner, Admin aur Manager.',
 'Roz ek dafa -- aur jab koi kahe ke "mera kaam ruka hua hai".',
 array['Qatar kholein aur sab se purani cheez pehle dekhein.','Har cheez par: manzoor, wapas bhejein, ya radd.','Wapas bhejte ya radd karte waqt wajah likhna zaroori hai -- warna banda dobara wohi ghalti karta hai.'],
 'Manzoori ke baad us kaam ka agla qadam khud khul jata hai.',
 array['Bina parhe manzoor na karein -- manzoori aap ke naam par likhi jati hai.','Jis ne cheez banayi wo khud manzoor nahi kar sakta (database ki rok).']),

('finance','rm',
 'Cash book: har aane jaane wale paise ka ek hi record.',
 'Finance ka staff; Owner/Admin sab dekh sakte hain.',
 'Jab bhi cash aaye ya jaye -- usi waqt, baad mein nahi.',
 array['Qisam chunein (aamdani ya kharcha), raqam aur wajah likhein.','Mehfooz karein -- balance khud banta hai.','Ghalat entry ko mitayein NAHI; us ka ulta (reversal) darj karein.'],
 'Din ke aakhir mein Raat ki Cash Ginti se milaan karein.',
 array['Balance haath se na likhein -- wo entries se khud banta hai.','Entry mitana audit torh deta hai; ulta karna hi durust tareeqa hai.']),

('cash-handover','rm',
 'Cash ek haath se doosre haath: dene wala darj kare, lene wala tasdeeq kare.',
 'Shop staff, manager, finance.',
 'Jab counter ka cash kisi aur ke hawale ho.',
 array['Dene wala raqam aur lene wale ka naam likhe.','Lene wala apne login se receive kare.','Dono taraf ka waqt aur naam khud mehfooz ho jata hai.'],
 'Receive hone ke baad cash book mein khud aa jata hai.',
 array['Dene wala hi receive nahi kar sakta -- ye database ki rok hai (SoD).','Zubani hawala na karein: jo darj nahi hua wo hua hi nahi.']),

('reconciliation','rm',
 'Roz ka milaan: system ka hisaab aur haath ka cash -- dono barabar hain ya nahi.',
 'Finance aur manager.',
 'Har din ke aakhir mein.',
 array['Din chunein.','System ka hisaab aur asal ginti saamne aayegi.','Farq ho to us ki wajah likhein -- farq chhupayein nahi.'],
 'Farq bada ho to Owner ko batayein aur us ki entry theek karein.',
 array['Sifar farq dikhane ke liye adad na badlein -- pakRa jata hai aur bharosa khatam hota hai.','"Milaan nahi hua" aur "farq sifar hai" do alag baatein hain.']),

('bank-reconcile','rm',
 'Bank ki statement aur apne khate ka milaan.',
 'Finance ka staff.',
 'Jab bank statement aaye -- aam tor par hafte ya mahine mein.',
 array['Bank account chunein aur arsa (tareekhein) daalein.','Jo entry dono taraf hai usay mila dein.','Jo sirf ek taraf hai us ki wajah dhoondein.'],
 'Milaan ke baad baqi rehne wali qatarein finance ko dikhayein.',
 array['Bina samjhe milaan na karein -- ek dafa ghalat mila do to farq hamesha ke liye chhup jata hai.']),

('khata','rm',
 'Gahak ka udhaar: kis ne kitna lena/dena hai.',
 'Shop staff aur finance.',
 'Jab udhaar par sauda ho ya wusooli aaye.',
 array['Gahak dhoondein.','Us ka khata kholein: kya liya, kya diya, kitna baqi.','Wusooli darj karein -- baqi khud kam ho jata hai.'],
 'Purana udhaar ho to gahak ko yaad dilayein.',
 array['Baqi raqam haath se na likhein -- wo lein-dein se khud banti hai.','Bina raseed ke wusooli darj na karein.']),

('staff-khata','rm',
 'Staff ka khata: advance, katauti aur baqi.',
 'HR aur finance.',
 'Jab kisi mulazim ko advance diya jaye ya tankhwah se katauti ho.',
 array['Mulazim chunein.','Advance ya katauti darj karein.','Baqi raqam khud banti rehti hai.'],
 'Tankhwah banate waqt yahi baqi kaam aati hai.',
 array['Zubani advance na dein -- jo darj nahi hua, wo tankhwah ke waqt jhagRa banta hai.']),

('agri-orders','rm',
 'Dukan ka order: manzoori ka silsila aur maal ka bhejna.',
 'Sales, Finance aur Manager (manzoori); godam (bhejna).',
 'Jab koi dukan HQ se maal mangwaye.',
 array['Order kholein aur us ka darja dekhein.','Sales tasdeeq kare, phir Finance, phir Manager manzoor kare.','Godam maal bheje; dukan pahunchne par receive kare.'],
 'Dukan ke receive karne par hi us ka stock barhta hai.',
 array['Jis ne order maanga wo khud manzoor nahi kar sakta (database ki rok).','Bheja hua aur pahuncha hua maal ek nahi.']),

('farmers','rm',
 'Kisan ka record: ek mobile number = ek kisan.',
 'Milk, anaj aur machinery ka staff.',
 'Naya kisan aaye ya purane ki maloomat badle.',
 array['Number se pehle dhoondein -- aksar wo pehle se maujood hota hai.','Na mile to naya banayein.','Naam, gaon aur number theek likhein -- WhatsApp isi par jata hai.'],
 'Kisan ka poora khata us ke safhe par khulta hai.',
 array['Ek hi kisan do dafa na banayein -- us ka hisaab do jagah bat jata hai.','Number ghalat hua to paighaam kisi aur ko chala jata hai.']),

('milk-collection.collect','rm',
 'Roz ka doodh: kis kisan se kitna aur kis FAT par.',
 'Doodh collection ka staff.',
 'Har subah aur shaam, collection ke waqt.',
 array['Kisan chunein.','Litre aur FAT likhein.','Mehfooz karein -- signal na ho to bhi chalta hai, baad mein khud chala jata hai.'],
 'Entry ke baad tasdeeq (verify) ka qadam aata hai.',
 array['FAT andaze se na likhein -- paisa usi par banta hai.','Signal na hone par kaam na rokein; entry local mehfooz rehti hai.']),

('milk-collection.verify','rm',
 'Doodh ki entry ki tasdeeq: jo likha gaya wo waqai wahi tha.',
 'Milk manager.',
 'Collection ke baad, adaigi se pehle.',
 array['Din ki entries kholein.','Litre aur FAT jaanchein.','Tasdeeq karein ya theek karwayein.'],
 'Tasdeeq ke baad hi kisan ka hisaab pakka hota hai.',
 array['Jis ne entry ki wo khud tasdeeq nahi kar sakta -- database ki rok hai.','Sab ko ek sath aankh band kar ke tasdeeq na karein.']),

('audit-trail','rm',
 'Kis ne kya kiya: har ahem tabdeeli ka record, aur ghalat entry ka ulta karna.',
 'Owner aur Admin.',
 'Jab kuch ghalat mile aur jaanna ho ke kaise hua.',
 array['Tareekh ya banda chunein.','Qatarein parhein: kya badla, kis ne, kab.','Ghalat maali entry ho to "Reverse" se us ka ulta darj karein.'],
 'Reversal ke baad cash book aur khata dono theek ho jate hain.',
 array['Record mitaya nahi ja sakta -- yehi is ka faida hai.','Reversal ka haq har kisi ke paas nahi; darkhwast se milta hai.']),

('hr.attendance-log','rm',
 'Hazri ka record: kaun kab aaya, aur shaakh se kitne faasle par tha.',
 'HR aur manager.',
 'Roz subah, aur tankhwah banate waqt.',
 array['Din ya mulazim chunein.','Waqt aur faasla dekhein.','Faasla zyada ho to mulazim se poochein -- ye ghalti bhi ho sakti hai.'],
 'Mahine ke aakhir mein yahi record tankhwah ka bunyaad banta hai.',
 array['Hazri roki nahi jati, sirf faasla likh diya jata hai -- faisla insaan ka hai.','Doosre ke phone se hazri lagwana chori hai; record us ko pakaR leta hai.']),

('my-attendance','rm',
 'Meri apni hazri: kab aaya, kab gaya, kitne din.',
 'Har mulazim apni.',
 'Kabhi bhi -- khaas kar mahine ke aakhir mein.',
 array['Mahina chunein.','Apne din aur waqt dekhein.','Koi din ghalat lage to manager ko batayein.'],
 'Ghalti ho to manager theek karwa sakta hai; aap khud nahi badal sakte.',
 array['Apni hazri khud badalna mumkin nahi -- ye jaan boojh kar hai.'])

on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes,
  updated_at = now();
