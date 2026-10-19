import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// App ki zabaan: English, Roman Urdu, ya Urdu (RTL).
enum AppLang { en, roman, ur }

final appLangProvider = StateProvider<AppLang>((_) => AppLang.roman);

/// Light (cream) ya navy-dark.
final navyDarkProvider = StateProvider<bool>((_) => false);

/// Teen zabaanon wala label. Urdu ho to RTL.
class Tr {
  const Tr(this.en, this.roman, this.ur);
  final String en;
  final String roman;
  final String ur;
  String of(AppLang l) => switch (l) { AppLang.en => en, AppLang.roman => roman, AppLang.ur => ur };
}

class LangScope extends InheritedWidget {
  const LangScope({super.key, required this.lang, required super.child});
  final AppLang lang;
  static AppLang of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<LangScope>()?.lang ?? AppLang.roman;
  @override
  bool updateShouldNotify(LangScope old) => old.lang != lang;
}

extension TrX on BuildContext {
  String tr(Tr t) => t.of(LangScope.of(this));
  bool get isNavy => Theme.of(this).brightness == Brightness.dark;
}

/// Saare labels ek jagah (EN / Roman / Urdu).
abstract final class T {
  static const tagline = Tr('From Farmer to Business', 'Kisaan Se Karobar Tak', 'کسان سے کاروبار تک');
  static const salam = Tr('Assalam-o-Alaikum,', 'Assalam-o-Alaikum,', 'السلام علیکم،');
  static const farmerDash = Tr('Farmer Dashboard', 'Kisan Dashboard', 'کسان ڈیش بورڈ');
  static const customerPortal = Tr('Customer Portal', 'Customer Portal', 'کسٹمر پورٹل');
  static const acres = Tr('Acres', 'Acre', 'ایکڑ');
  static const crops = Tr('Crops', 'Faslein', 'فصلیں');
  static const animals = Tr('Animals', 'Janwar', 'جانور');
  static const khata = Tr('Khata', 'Khata', 'کھاتہ');
  static const seasonPlan = Tr('Season Plan', 'Season Plan', 'سیزن پلان');
  static const dairy = Tr('Dairy', 'Dairy', 'ڈیری');
  static const myKhata = Tr('My Khata', 'Mera Khata', 'میرا کھاتہ');
  static const myBills = Tr('My Bills', 'Mere Bill', 'میرے بل');
  static const demand = Tr('Product Demand', 'Product Demand', 'مصنوعات کی طلب');
  static const farms = Tr('My Farms', 'Mere Kheet', 'میرے کھیت');
  static const kisanAi = Tr('Kisan AI', 'Kisan AI', 'کسان اے آئی');
  static const kisanAiSub = Tr('Advice on crops, spray and milk', 'Fasal, spray aur doodh ka mashwara', 'فصل، سپرے اور دودھ کا مشورہ');
  static const home = Tr('Home', 'Home', 'ہوم');
  static const farm = Tr('Farm', 'Kheti', 'کھیتی');
  static const profile = Tr('Profile', 'Profile', 'پروفائل');
  static const orders = Tr('Orders', 'Orders', 'آرڈرز');
  static const parties = Tr('Parties', 'Parties', 'پارٹیاں');
  static const tasks = Tr('Tasks', 'Kaam', 'کام');
  static const dairyMgmt = Tr('Dairy Management', 'Dairy Management', 'ڈیری مینجمنٹ');
  static const dairySub = Tr('Healthy animals, more milk', 'Sehatmand janwar, zyada doodh', 'صحت مند جانور، زیادہ دودھ');
  static const todayMilk = Tr("Today's milk", 'Aaj ka doodh', 'آج کا دودھ');
  static const total = Tr('Total', 'Kul', 'کل');
  static const milking = Tr('Milking', 'Doodh wale', 'دودھ والے');
  static const pregnant = Tr('Pregnant', 'Gaabhan', 'گابھن');
  static const dry = Tr('Dry', 'Khushk', 'خشک');
  static const milkRecord = Tr('Milk Record', 'Doodh Record', 'دودھ ریکارڈ');
  static const animalRecords = Tr('Animals', 'Janwar', 'جانور');
  static const feed = Tr('Feed & Wanda', 'Chara / Wanda', 'چارہ / ونڈا');
  static const vaccine = Tr('Vaccination', 'Vaccine', 'ویکسین');
  static const breeding = Tr('Breeding', 'Breeding', 'بریڈنگ');
  static const hisaab = Tr('Accounts', 'Hisaab', 'حساب');
  static const milkSale = Tr('Milk Sale', 'Doodh ki Farokht', 'دودھ کی فروخت');
  static const animalLoan = Tr('Animal Loan', 'Maweshi Loan', 'مویشی قرض');
  static const milkIncome = Tr('Milk Income', 'Doodh ki Aamdan', 'دودھ کی آمدن');
  static const wallet = Tr('Farmer Wallet', 'Mera Khata', 'میرا کھاتہ');
  static const walletSub = Tr('Easy payments, better business', 'Asaan len den, behtar karobar', 'آسان لین دین، بہتر کاروبار');
  static const due = Tr('Credit due', 'Baqaya', 'بقایا');
  static const statement = Tr('Statement', 'Statement', 'اسٹیٹمنٹ');
  static const promise = Tr('Promise', 'Wada', 'وعدہ');
  static const reportPayment = Tr('Report payment', 'Payment bataein', 'ادائیگی بتائیں');
  static const latestTx = Tr('Latest transactions', 'Haal ki len den', 'حالیہ لین دین');
  static const viewAll = Tr('View all', 'Sab dekhein', 'سب دیکھیں');
  static const noUdhaar = Tr('No credit purchase from the app. Payment claims are verified by staff.', 'App se udhaar khareedari nahi hoti. Payment claim staff check karta hai.', 'ایپ سے ادھار خریداری نہیں ہوتی۔ ادائیگی کا دعویٰ عملہ چیک کرتا ہے۔');
  static const allServices = Tr('All Services', 'Tamam Services', 'تمام سروسز');
  static const services = Tr('Services', 'Services', 'سروسز');
  static const account = Tr('Account', 'Account', 'اکاؤنٹ');
  static const farming = Tr('Farming', 'Kheti', 'کھیتی');
  static const payments = Tr('Payments', 'Payments', 'ادائیگیاں');
  static const promises = Tr('Promises', 'Wade', 'وعدے');
  static const returns = Tr('Returns', 'Wapsi', 'واپسی');
  static const support = Tr('Support', 'Madad', 'مدد');
  static const language = Tr('Language', 'Zabaan', 'زبان');
  static const theme = Tr('Navy dark', 'Navy dark', 'نیوی ڈارک');
  static const deleteAcc = Tr('Delete account', 'Account delete', 'اکاؤنٹ حذف');
  static const staffApp = Tr('AgriBridge Staff', 'AgriBridge Staff', 'ایگری برج اسٹاف');
  static const salesToday = Tr("Today's sales", 'Aaj ki sale', 'آج کی سیل');
  static const recoveryToday = Tr("Today's recovery", 'Aaj ki recovery', 'آج کی ریکوری');
  static const branchDue = Tr('Branch dues', 'Branch baqaya', 'برانچ بقایا');
  static const promisesToday = Tr('Promises due', 'Aaj ke wade', 'آج کے وعدے');
  static const search = Tr('Search farmer / customer (name, code, phone)', 'Customer / Kisan dhoondein (naam, code, phone)', 'کسٹمر / کسان تلاش کریں');
  static const pendingWork = Tr('Pending work', 'Pending kaam', 'زیر التوا کام');
  static const recoveryList = Tr('Recovery list', 'Recovery list', 'ریکوری لسٹ');
  static const newEntry = Tr('New entry', 'Nayi Entry', 'نئی اندراج');
  static const pendingNote = Tr('This entry goes as PENDING. Finance / branch manager approves it — you cannot approve your own.', 'Ye entry PENDING jayegi. Finance / branch manager approve karega — aap khud approve nahi kar sakte.', 'یہ اندراج زیر التوا جائے گا۔ فنانس / برانچ مینیجر منظور کرے گا — آپ خود منظور نہیں کر سکتے۔');
  static const save = Tr('Save · pending approval', 'Save · approval ke liye', 'محفوظ · منظوری کے لیے');
  static const waConfirm = Tr('WhatsApp opens only after you confirm. Nothing is sent automatically.', 'WhatsApp sirf aap ke confirm par khulega. Khud kuch nahi jata.', 'واٹس ایپ صرف آپ کی تصدیق پر کھلے گا۔');
  static const chooseCategory = Tr('First choose a category', 'Pehle qism chunein', 'پہلے قسم منتخب کریں');
}
