-- =====================================================================
-- AgriBridge — Migration 287: Website/CMS aur category safhon ka help
-- =====================================================================
-- Aakhri guchha. Is ke baad har fa'aal feature ka help likha hua hai --
-- yani AI kisi bhi safhe ke baare mein poochhe jane par "maloomat nahi
-- likhi" nahi kehta.
--
-- Do hisse:
--   1. Website/CMS ke 14 safhe: blog, aam sawalat, tasveerein, hero
--      slider, media, menu, safhe, website settings, gahakon ki raye,
--      email ke namune, sarmayakar aur un ke sawal, naukri ki jagahein
--      aur darkhwastein.
--   2. Paanch category dashboard: beej, khaad, spray, wanda, grocery --
--      paanchon ek hi safhe (CategoryDashboard) se bante hain, is liye
--      un ke qadam bhi ek jaise hain.
--
-- Category safhon par ek baat ahem hai: ye SIRF DEKHNE ke safhe hain.
-- Stock yahan se nahi badalta -- stock sirf stock_movements se badalta
-- hai (kharid, bikri, transfer, ginti). Ye baat "ghaltiyan" mein likhi
-- gayi hai, kyunke yahi sab se aam ghalat-fehmi hai.
-- =====================================================================

insert into feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes) values
('blog','rm',
 'Blog: wo mazameen jo website ke /blog safhe par nazar aate hain.',
 'Admin aur marketing.',
 'Naya mazmoon likhte waqt.',
 array['Naya mazmoon banayein: unwan, tasveer aur matan.','Tasveer pehle Media par upload kar ke us ka link yahan lagayein.','Shaya (publish) karein.'],
 'Shaya hote hi wo website par nazar aa jata hai.',
 array['Adhoora mazmoon shaya na karein -- wo foran public ho jata hai.']),

('faqs','rm',
 'Aam sawalat: wo sawal jawab jo website ke /faq safhe par qisam ke hisaab se nazar aate hain.',
 'Admin aur sales.',
 'Jab koi sawal baar baar poochha jaye.',
 array['Sawal aur us ka jawab likhein.','Qisam (category) chunein.','Mehfooz karein.'],
 'Wo foran website par nazar aa jata hai.',
 array['Aisa jawab na likhein jo badalta rehta ho (rate, tareekh) -- warna website purani baat kehti rehti hai.']),

('gallery','rm',
 'Tasveerein: wo tasveerein aur videos jo /gallery safhe par nazar aate hain.',
 'Admin aur marketing.',
 'Naya kaam ya taqreeb ke baad.',
 array['Media par file upload karein.','Yahan us ka link aur tafseel lagayein.','Mehfooz karein.'],
 'Wo foran gallery par nazar aati hai.',
 array['Kisi kisan ya mulazim ki tasveer us ki ijazat ke baghair na lagayein.']),

('hero-slides','rm',
 'Hero slider: website ke sab se upar wale hisse ki slides.',
 'Admin aur marketing.',
 'Jab website ka paighaam badalna ho.',
 array['Slide banayein: tasveer, unwan aur button.','Tarteeb tay karein.','Fa''aal karein.'],
 'Slide khali chhoRne par default hero nazar aata hai.',
 array['Bari tasveer website ko dheema kar deti hai -- chhoti file lagayein.']),

('media-library','rm',
 'Media: tasveerein aur videos ek jagah rakhein aur un ka link lein.',
 'Admin aur marketing.',
 'Kisi bhi safhe par tasveer lagane se pehle.',
 array['File upload karein.','Us ka link copy karein.','Blog, Gallery, Gahakon ki Raye ya Hero Slider ke form mein wo link lagayein.'],
 'Ek hi tasveer kai safhon par isi link se lagti hai.',
 array['Yahan se file mitane par wo har us safhe se ghayab ho jati hai jahan us ka link laga hai -- pehle dekh lein.']),

('menus','rm',
 'Menu: website ke upar aur neeche wale link.',
 'Admin.',
 'Naya safha banne par.',
 array['Link jorein: naam aur raasta.','Tarteeb tay karein.','Mehfooz karein.'],
 'Website par menu foran badal jata hai.',
 array['Aisa link na daalein jis ka safha maujood na ho -- gahak ko khali safha milta hai.']),

('static-pages','rm',
 'Safhe: Privacy Policy, Terms, Cookie Policy, Refund Policy aur Disclaimer.',
 'Admin.',
 'Kabhi kabhaar -- jab qanooni matan badalna ho.',
 array['Safha chunein.','Matan likhein ya theek karein.','Mehfooz karein.'],
 'Wo foran website par nazar aa jata hai.',
 array['Qanooni matan andaze se na badlein -- ye wo alfaz hain jo baad mein hujjat bante hain.']),

('settings','rm',
 'Website settings: wo maloomat jo poori website par istemal hoti hai.',
 'Admin.',
 'Shuru mein, aur jab raabta ki maloomat badle.',
 array['Naam, phone, pata aur social ke link likhein.','Mehfooz karein.'],
 'Ye maloomat har safhe par khud lag jati hai.',
 array['Phone ya pata ghalat rehna sab se mehnga hota hai -- gahak wahin se raabta karta hai.']),

('testimonials','rm',
 'Gahakon ki raye: wo raye jo homepage aur /testimonials par nazar aati hain.',
 'Admin aur marketing.',
 'Jab kisi gahak ki achhi raye mile.',
 array['Gahak ka naam, tasveer aur us ki raye likhein.','Fa''aal karein.'],
 'Wo foran website par nazar aati hai.',
 array['Raye us gahak ki ijazat ke baghair na lagayein.','Banayi hui raye na likhein -- pakRi jati hai aur bharosa khatam kar deti hai.']),

('email-templates','rm',
 'Email ke namune: bheje jane wale email ke alfaz, salaam aur dastkhat.',
 'Admin.',
 'Jab email ka andaz badalna ho.',
 array['Namuna chunein.','Alfaz, salaam aur dastkhat theek karein.','Mehfooz karein.'],
 'Agla email inhi alfaz mein jata hai.',
 array['Namune ke andar jo khane (jaise naam, raqam) khud bharte hain, unhen na mitayein -- warna email adhoora jata hai.']),

('investors','rm',
 'Sarmayakar: jinhon ne AgriBridge ke kaam ya saudon mein sarmaya lagaya.',
 'Owner aur Admin.',
 'Naya sarmayakar aane par.',
 array['Naam, raabta aur sarmaye ki tafseel likhein.','Mehfooz karein.'],
 'Un ke sawal Sarmayakar ke Sawal par aate hain.',
 array['Sarmaye ki tafseel har kisi ko nazar nahi aani chahiye -- ijazat dete waqt dhyan rakhein.']),

('investor-inquiries','rm',
 'Sarmayakar ke sawal: website ke /invest safhe se aane wali darkhwastein.',
 'Owner aur Admin.',
 'Roz.',
 array['Darkhwast kholein aur parhein.','Raabta karein.','Baat aage barhe to Sarmayakar par us ka record banayein.'],
 'Purane sawal band karte rahein.',
 array['Ye sirf darkhwast hai, sauda nahi -- us ko sarmaya samajh kar hisaab mein na likhein.']),

('job-vacancies','rm',
 'Naukri ki jagahein: khali asamiyan jo Careers ke safhe par nazar aati hain.',
 'HR aur Admin.',
 'Jab nayi jagah khali ho.',
 array['Asami ka naam, tafseel aur jaghah likhein.','Fa''aal karein.'],
 'Darkhwastein Naukri ki Darkhwastein par aati hain.',
 array['Bhar jane ke baad asami band karna na bhoolein -- warna darkhwastein aati rehti hain.']),

('job-applications','rm',
 'Naukri ki darkhwastein: kaghazat ki jaanch, interview, score aur offer.',
 'HR.',
 'Jab darkhwast aaye.',
 array['Darkhwast kholein aur kaghazat dekhein.','Interview ka waqt tay karein.','Score likhein.','Faisla karein: offer ya maazrat.'],
 'Offer qabool hone par us ka record HR par banta hai.',
 array['Har qadam ka faisla likhein -- warna doosra banda phir se wahi kaam karta hai.']),

('seeds','rm',
 'Beej: is qisam ka stock, us ki qeemat aur haali kharid -- ek nazar mein.',
 'Product manager, dukan ka staff aur manager.',
 'Roz, aur order dene se pehle.',
 array['Safha kholein: kitni cheezein, stock ki qeemat, kam stock aur 60 din mein miyaad khatam hone wali cheezein.','Neeche fehrist mein har cheez ka stock aur rate dekhein.','Haali kharid dekhein -- kis supplier se aakhri baar kya aaya.'],
 'Kam stock ho to Kharid ke safhe par order banayein.',
 array['Ye safha sirf DEKHNE ke liye hai -- stock yahan se nahi badalta. Stock sirf kharid, bikri, transfer aur ginti se badalta hai.','Miyaad khatam hone wali cheez ko time par nikalna hi asal bachat hai.']),

('fertilizer','rm',
 'Khaad: is qisam ka stock, us ki qeemat aur haali kharid -- ek nazar mein.',
 'Product manager, dukan ka staff aur manager.',
 'Roz, aur order dene se pehle.',
 array['Safha kholein: kitni cheezein, stock ki qeemat, kam stock aur 60 din mein miyaad khatam hone wali cheezein.','Neeche fehrist mein har cheez ka stock aur rate dekhein.','Haali kharid dekhein -- kis supplier se aakhri baar kya aaya.'],
 'Kam stock ho to Kharid ke safhe par order banayein.',
 array['Ye safha sirf DEKHNE ke liye hai -- stock yahan se nahi badalta.','Season se pehle khaad ka stock kam rehna sab se bari shikayat banta hai.']),

('pesticide','rm',
 'Spray (zehar): is qisam ka stock, us ki qeemat aur haali kharid -- ek nazar mein.',
 'Product manager, dukan ka staff aur manager.',
 'Roz, aur order dene se pehle.',
 array['Safha kholein: kitni cheezein, stock ki qeemat, kam stock aur 60 din mein miyaad khatam hone wali cheezein.','Neeche fehrist mein har cheez ka stock aur rate dekhein.','Haali kharid dekhein.'],
 'Kam stock ho to Kharid ke safhe par order banayein.',
 array['Ye safha sirf DEKHNE ke liye hai -- stock yahan se nahi badalta.','Miyaad khatam hua spray bechna qanooni aur akhlaqi dono tarah ghalat hai -- 60 din wali ginti roz dekhein.']),

('wanda','rm',
 'Wanda (janwaron ki khurak): is qisam ka stock, us ki qeemat aur haali kharid.',
 'Product manager, dukan ka staff aur manager.',
 'Roz, aur order dene se pehle.',
 array['Safha kholein: kitni cheezein, stock ki qeemat, kam stock aur miyaad wali cheezein.','Neeche fehrist mein har cheez ka stock aur rate dekhein.','Haali kharid dekhein.'],
 'Kam stock ho to Kharid ke safhe par order banayein.',
 array['Ye safha sirf DEKHNE ke liye hai -- stock yahan se nahi badalta.']),

('grocery','rm',
 'Grocery: is qisam ka stock, us ki qeemat aur haali kharid.',
 'Product manager, dukan ka staff aur manager.',
 'Roz, aur order dene se pehle.',
 array['Safha kholein: kitni cheezein, stock ki qeemat, kam stock aur miyaad wali cheezein.','Neeche fehrist mein har cheez ka stock aur rate dekhein.','Haali kharid dekhein.'],
 'Kam stock ho to Kharid ke safhe par order banayein.',
 array['Ye safha sirf DEKHNE ke liye hai -- stock yahan se nahi badalta.','Grocery mein miyaad jaldi khatam hoti hai -- 60 din wali ginti roz dekhein.'])

on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes,
  updated_at = now();
