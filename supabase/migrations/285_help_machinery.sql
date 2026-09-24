-- =====================================================================
-- AgriBridge — Migration 285: Machinery ke 21 safhon ka help
-- =====================================================================
-- Machinery ki poori zanjeer: booking se le kar bill, wasooli, vendor
-- ka hisaab aur nafa nuqsan tak. Har qadam ka amal us safhe ke code se
-- jaancha gaya hai (v_machinery_control, v_machinery_pnl_booking,
-- v_machinery_vendor_settlement, v_machinery_work_claims waghaira) --
-- andaze se koi qadam nahi likha gaya.
--
-- Do baatein baar baar aati hain aur is liye "ghaltiyan" mein likhi
-- gayi hain:
--   1. Jo cheez maidan se aayi hai (kaam, advance, diesel) wo jab tak
--      koi dekh kar tasdeeq na kare, kisi bill ya cash book mein NAHI
--      ginti. Ye jaan boojh kar hai.
--   2. Machinery ke adad kisi safhe par dobara nahi ginte jate -- sab
--      view se aate hain. Adad ghalat lage to entry theek karein, adad
--      nahi.
-- =====================================================================

insert into feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes) values
('machinery-rental','rm',
 'Machine ki booking: kisan ki farmaish se le kar machine tay karne tak.',
 'Machinery ka staff aur manager.',
 'Jab kisan machine mangwaye.',
 array['Kisan chunein (number se dhoondein -- aksar wo pehle se maujood hai).','Fasal, raqba (acre) aur tareekh likhein.','Machine aur vendor chunein.','Rate tay karein -- rate card khud khana bhar deta hai, badla ja sakta hai.','Booking mehfooz karein.'],
 'Booking ke baad Machine Rawangi par us ko bhejne ka qadam aata hai.',
 array['Commission ka rate machine par nahi, ek hi jagah (platform setting) par hai -- usay yahan se badalne ki koshish na karein.','Kisan ka number ghalat likhne se raseed aur rate ki tasdeeq us tak nahi pahunchti.']),

('machinery-rental.dashboard','rm',
 'Machinery ka dashboard: bookings, vendor ka hissa aur kisan ki farmaishein ek nazar mein.',
 'Machinery ka manager aur Owner/Admin.',
 'Roz subah.',
 array['Aaj ka kaam dekhein.','"Tawajjah chahiye" wala hissa dekhein -- wahan wohi cheezein hain jo ruki hui hain.','Kisi adad par click kar ke us ki asal fehrist kholein.'],
 'Jo cheez ruki ho, us ke apne safhe par ja kar qadam poora karein.',
 array['Yahan ke adad khud nahi likhe jate -- records se bante hain. Ghalat lagein to entry theek karein.']),

('machinery-rental.list','rm',
 'Tamam bookings: har booking par "ab mera kya kaam hai" aur "is kisan se kul kitna lena hai".',
 'Machinery ka staff aur manager.',
 'Roz, aur jab kisi booking ka pata karna ho.',
 array['Fehrist kholein.','Booking dhoondein (kisan, gaon ya booking number se).','"Agla kaam" ka khana dekhein -- wahi batata hai ab kya karna hai.','Booking khol kar us ka qadam poora karein.'],
 'Agla kaam usi booking ke safhe se hota hai.',
 array['Kaam ki halat aur paise ki halat do alag cheezein hain -- kaam mukammal hone ka matlab paisa aa gaya nahi.']),

('machinery-rental.calendar','rm',
 '30 din ka capacity planner: kis din jagah hai, kis din bhar chuka -- booking lene se pehle.',
 'Machinery ka manager.',
 'Nayi booking ki tareekh dete waqt.',
 array['Calendar kholein.','Jis din par jagah ho wo din chunein.','Us din ki bookings dekh kar tareekh pakki karein.'],
 'Tareekh tay hone ke baad booking banayein.',
 array['Bhare hue din par aur booking daalna kisan ko intezar karwata hai -- aur wohi shikayat ban jati hai.']),

('machinery-rental.schedule','rm',
 'Kattai schedule: kis din kaun si machine kis khet par jani hai.',
 'Machinery ka manager.',
 'Har subah, aur naya kaam aane par.',
 array['Din chunein.','Us din ke kaam dekhein: machine bhejni hai, ya kaam darj karna hai.','Har qatar par uska qadam poora karein.'],
 'Machine bhejne ka qadam Machine Rawangi par mukammal hota hai.',
 array['Schedule dekh kar chhoR dena kaafi nahi -- qadam qatar se hi poora hota hai.']),

('machinery-rental.assign','rm',
 'Machine rawangi: kaun si machine kis booking par bheji ja rahi hai.',
 'Machinery ka staff.',
 'Kaam se pehle.',
 array['Qatar kholein: jin bookings par machine bhejni hai.','Machine aur vendor chunein.','Rawangi darj karein.'],
 'Kaam hone ke baad Kaam ki Entry par kaam darj hota hai.',
 array['Do bookings par ek hi machine ek hi din na bhejein -- calendar pehle dekh lein.']),

('machinery-rental.work','rm',
 'Kaam ki entry: kitne acre par kaam hua.',
 'Machinery ka staff (ya vendor apne login se).',
 'Kaam mukammal hone par usi din.',
 array['Booking chunein.','Kaam ka raqba (acre) aur tareekh likhein.','Mehfooz karein.'],
 'Entry ke baad bill banane ka qadam Kisan Bill par aata hai.',
 array['Baad mein yaad se acre likhna aksar ghalat hota hai -- usi din likhein.','Vendor ka darj kiya hua kaam jab tak Vendor ka Kaam par dekh na liya jaye, kisi bill mein nahi ginta.']),

('machinery-rental.work-claims','rm',
 'Vendor ka kaam: jo machine walon ne maidan se darj kiya, us ki tasdeeq.',
 'Machinery ka manager aur finance.',
 'Roz.',
 array['Fehrist kholein: kaam, diesel aur vendor ki wasooli -- teenon qismein.','Har qatar jaanchein: raqba, tareekh aur raqam.','Tasdeeq karein ya wapas bhejein.'],
 'Tasdeeq ke baad wo raqam bill aur hisaab mein ginni shuru hoti hai.',
 array['Jab tak koi yahan dekh na le, ye kisi bill mein NAHI ginta -- ye jaan boojh kar hai.','Bina maidan se poochhe tasdeeq karna vendor ko ghalat adad likhne ki adat daal deta hai.']),

('machinery-rental.billing','rm',
 'Kisan bill aur adaigiyan: bill banana aur kisan se paisa lena.',
 'Machinery ka staff aur finance.',
 'Kaam mukammal hone ke baad.',
 array['Qatar kholein: jin ka bill banana hai aur jin se paisa lena hai.','Bill banayein -- raqba aur rate se raqam khud banti hai.','Adaigi mile to darj karein: raqam, tareekh aur tareeqa.'],
 'Baqi raqam Raqam Wasooli par yaad dilane ke liye aa jati hai.',
 array['Bill ki raqam haath se na badlein -- wo raqba aur rate se banti hai.','Kisan ka diya hua paisa vendor ke paas hai to wo bhi darj hona chahiye, warna do jagah hisaab alag ho jata hai.']),

('machinery-rental.advance-claims','rm',
 'Advance tasdeeq: jo kisan kehte hain ke paisa de diya, us ki jaanch.',
 'Finance aur machinery ka manager.',
 'Roz.',
 array['Fehrist kholein.','Har dawe ki tafseel dekhein: kis ne, kab, kis ko diya.','Khata chunein aur tasdeeq karein, ya wapas bhejein.'],
 'Tasdeeq ke baad wo paisa cash book aur kisan ke bill dono mein aa jata hai.',
 array['Jab tak koi dekh na le, ye paisa kahin nahi ginta -- na cash book mein, na bill mein.','Bina saboot ke tasdeeq karna sab se aam nuqsan ki jarh hai.']),

('machinery-rental.reminders','rm',
 'Raqam wasooli: kis kisan ko yaad dilana hai, aur kis ko dilaya ja chuka.',
 'Machinery ka staff aur finance.',
 'Har hafte, aur wada khatam hone par.',
 array['Fehrist kholein -- jin ka baqi hai aur wada ki tareekh guzar chuki.','Yaad dilayein aur us ka nishan lagayein.','Nayi tareekh ka wada mile to wo likhein.'],
 'Adaigi aane par Kisan Bill par darj karein.',
 array['Yaad dilana likhna na bhoolein -- warna doosra banda phir se wahi phone karta hai.']),

('machinery-rental.vendor-cash','rm',
 'Vendor adaigiyan: kisan ne machine wale ko paisa diya aur wo hamein dena hai.',
 'Finance.',
 'Jab vendor paisa jama karwaye.',
 array['Fehrist kholein: kis vendor ke paas hamara kitna paisa khara hai (sab se purana pehle).','Wasooli darj karein: raqam, khata aur tareekh.'],
 'Wasooli ke baad Vendor Settlement par us ka hisaab barabar hota hai.',
 array['Kisan ka hisaab pehle hi barabar ho chuka hota hai -- yahan ka paisa dobara kisan ke naam na likhein, warna do dafa ginti ho jati hai.']),

('machinery-rental.vendor-settlement','rm',
 'Vendor ka hisaab: har raqam apne naam se -- jo hamare paas jama hai, jo kisan ke paas hai, aur jo ja chuki hai.',
 'Finance aur Owner/Admin.',
 'Mahine ke aakhir mein, aur vendor se hisaab karte waqt.',
 array['Vendor chunein.','Us ka hissa, hamari wasooli aur baqi dekhein.','Adaigi karni ho to us ka qadam poora karein.'],
 'Adaigi Adaigiyan ke safhe se cash book mein jati hai.',
 array['Vendor ko adaigi us ke tasdeeq shuda kaam se zyada na karein -- pehle Vendor ka Kaam dekh lein.']),

('machinery-rental.diesel','rm',
 'Diesel aur fuel: kitna, kis rate par, kis ne diya -- aur litre per acre.',
 'Machinery ka staff aur manager.',
 'Har dafa diesel daalne par.',
 array['Machine aur booking chunein.','Litre, rate aur dene wala (hum, kisan ya vendor) likhein.','Raseed lagayein.'],
 'Ye kharcha booking ke nafa nuqsan mein khud jata hai.',
 array['Kis ne diesel diya -- ye khana ghalat bharna nafa ka poora hisaab ulta kar deta hai.','Litre per acre ghair-maamooli lage to machine ya adad mein se koi ek ghalat hai; poochein.']),

('machinery-rental.machines','rm',
 'Machinein: har machine ka apna record -- kis ki hai, kahan hai, aur is season kya kiya.',
 'Machinery ka manager aur Admin.',
 'Nayi machine aane par, aur halat badalne par.',
 array['Machine jorein: code, qisam, model aur malik (hamari ya vendor ki).','Us ki halat (chal rahi / khali / marammat) darust rakhein.'],
 'Khali machine hi nayi booking par bheji ja sakti hai.',
 array['Marammat par khari machine ko "khali" chhoR dena us par booking daal deta hai -- aur us din kaam nahi hota.']),

('machinery-rental.rate-card','rm',
 'Rate card: fasal aur machine ke hisaab se default rate.',
 'Owner, Admin aur machinery ka manager.',
 'Season se pehle, aur rate badalne par.',
 array['Fasal aur machine ki qisam chunein.','Rate likhein aur mehfooz karein.'],
 'Booking banate waqt ye rate khana khud bhar deta hai.',
 array['Ye sirf khana bharta hai -- staff jab chahe badal sakta hai. Is ko taala na samjhein.','Purana rate season badalne par theek karna na bhoolein.']),

('machinery-rental.pnl','rm',
 'Machinery nafa nuqsan: har booking par kitna kamaya aur kitna kharch hua.',
 'Owner, Admin aur machinery ka manager.',
 'Hafte mein ek dafa, aur season ke aakhir mein.',
 array['Arsa chunein.','Hisaab ki bunyaad chunein: bill ki tareekh (default) ya kaam ki tareekh.','Har booking ka gross, vendor ka hissa, diesel aur munafa dekhein.'],
 'Nuqsan wali booking kholein aur us ka diesel ya rate dekhein.',
 array['Hisaab ki tareekh BILL ki tareekh hai -- kaam wali tareekh sirf machine ki kaarkardagi ke liye hai. Dono ka farq samjhe baghair adad ka moazna na karein.','Jo kaam ya diesel abhi tasdeeq nahi hua, wo yahan nahi ginta.']),

('machinery-rental.reports','rm',
 'Machinery reports: kaam, wasooli, vendor aur diesel ki reportein ek jagah.',
 'Machinery ka manager aur Owner/Admin.',
 'Hafte mein ek dafa.',
 array['Report chunein.','Wo report usi qatar ko kholti hai jo pehle se maujood hai.'],
 'Kisi qatar par kaam ho to usi safhe par qadam poora karein.',
 array['Har report wohi qatar kholti hai jo pehle se hai -- koi report apna alag hisaab nahi rakhti. Do reportein alag adad dikhayein to arsa ya bunyaad alag hai, hisaab nahi.']),

('machinery-rental.farm-map','rm',
 'Zameen ka naqsha: har khet jo kisanon ne khud pin kiya, ilaqe ke hisaab se.',
 'Machinery ka manager.',
 'Route banate waqt aur booking ki tareekh dete waqt.',
 array['Naqsha kholein.','Ilaqa chunein aur us ke khet dekhein.','Paas paas ke khet ek hi din par rakhein.'],
 'Isi se machine ka rasta banta hai.',
 array['Jin khet ka pin nahi hai wo naqshe par nahi aate -- un ka na hona "kaam nahi" ka matlab nahi.']),

('machinery-rental.lifters','rm',
 'Fasal uthane wale (arhti aur beopari): jo kisan ki fasal uthate hain.',
 'Machinery ka manager aur finance.',
 'Naya arhti aaye, ya us ka hisaab dekhna ho.',
 array['Arhti chunein ya naya banayein: naam, number aur ilaqa.','Us ka baqi dekhein.'],
 'Us ke paas khari raqam Arhti Board par nazar aati hai.',
 array['Kattai ka baqi aur kisan ka purana udhaar in ke zimme jata hai -- do alag khaton ko mila kar na likhein.']),

('machinery-rental.arhti-board','rm',
 'Arhti board: hamara paisa is waqt kis ke paas khara hai -- aur wo asal mein kis kisan se lena tha.',
 'Owner, Admin aur finance.',
 'Har hafte.',
 array['Board kholein: sab se bara baqi pehle.','Kisi naam par click kar ke us ka poora silsila dekhein.','Wasooli mile to darj karein.'],
 'Wasooli ke baad us ka baqi khud kam ho jata hai.',
 array['Arhti ke paas khari raqam ko "wasool ho gayi" na samjhein -- wo abhi hamara paisa hai jo us ke paas hai.'])

on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes,
  updated_at = now();
