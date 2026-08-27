interface AgreementData {
  branchName: string;
  shopFullAddress: string | null;
  shopSize: string | null;
  landlordName: string;
  landlordCnic: string | null;
  monthlyRent: number;
  annualIncreasePercent: number;
  dueDay: number;
  securityDeposit: number;
  durationYears: number;
  renewalYears: number;
  agreementStartDate: string;
  bankAccountTitle: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  approvedUse: string | null;
  companyRepName: string | null;
  companyRepTitle: string | null;
  witness1Name: string | null;
  witness1Cnic: string | null;
  witness2Name: string | null;
  witness2Cnic: string | null;
  landlordSignatureData: string | null;
  landlordSignedAt: string | null;
  companySignatureData: string | null;
  companySignedAt: string | null;
  companyStampUrl: string | null;
}

export function UrduAgreementTemplate({ data }: { data: AgreementData }) {
  const startDateFormatted = new Date(data.agreementStartDate).toLocaleDateString("ur-PK-u-ca-islamic", {});
  const startDateSimple = new Date(data.agreementStartDate).toLocaleDateString();

  return (
    <div dir="rtl" lang="ur" style={{ fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif", lineHeight: 2.2 }} className="mx-auto max-w-3xl bg-white p-10 text-right text-black">
      <h1 className="mb-5 text-center text-2xl font-bold underline">معاہدہ کرایہ داری</h1>

      <p className="mb-6 text-center text-lg font-bold">
        یہ معاہدہ کرایہ داری ھذا (&quot;معاہدہ&quot;) <span>{startDateSimple}</span> کو تحریر و تکمیل ہوا۔
      </p>

      <div className="mb-5 rounded border-r-4 border-blue-700 bg-gray-50 p-4">
        <p className="mb-1 font-bold">مابین:</p>
        <p>
          <strong>Al Rana Traders</strong> ("<strong>کمپنی</strong>") اور جس کا نمائندہ <strong>{data.companyRepName ?? "-"}</strong> ({data.companyRepTitle ?? "-"}) ہے۔
        </p>
      </div>

      <p className="mb-5 text-center text-lg font-bold">اور</p>

      <div className="mb-5 rounded border-r-4 border-blue-700 bg-gray-50 p-4">
        <p>
          <strong>{data.landlordName}</strong>، حامل شناختی کارڈ نمبر: <strong>{data.landlordCnic ?? "-"}</strong> (جس کو بغرضِ مختصر <strong>&quot;مالک&quot;</strong> کے نام سے آگے تحریر کیا جائے گا)۔
        </p>
      </div>

      <p className="mb-2">کمپنی و مالک اجتماعی طور پر فریقین اور انفرادی طور پر فریق کہا جائے گا۔</p>
      <p className="mb-2">
        یہ کہ مالک دکان کی پیمائش <strong>{data.shopSize ?? "________"}</strong>، واقع <strong>{data.shopFullAddress ?? data.branchName}</strong> کا واحد مالک و قابض ہے (جس کو &quot;جگہ&quot; کے نام سے آگے تحریر کیا جائے گا)۔
      </p>
      <p className="mb-6">کمپنی بغرض کرایہ داری جگہ مذکورہ بالا کرائے پر مالک سے لینے کا خواہش مند ہے۔</p>

      <h3 className="mt-6 border-b pb-1 text-lg font-bold text-blue-700">1- دورانیہ</h3>
      <p>
        <strong>1.1-</strong> یہ معاہدہ ھذا کا دورانیہ مورخہ <strong>{startDateSimple}</strong> سے شروع ہوگا جو کہ <strong>{data.durationYears}</strong> سال کی مدت کے لیے نافذ العمل رہے گا۔
      </p>
      <p>
        <strong>1.2-</strong> مدتِ اختتام پر یہ معاہدہ مزید <strong>{data.renewalYears}</strong> سال کے لیے تجدید کیا جا سکتا ہے۔
      </p>

      <h3 className="mt-6 border-b pb-1 text-lg font-bold text-blue-700">2- کرائے کی رقم</h3>
      <p>
        <strong>2.1-</strong> کمپنی مالک کو پاکستانی روپیہ مبلغ <strong>{data.monthlyRent.toLocaleString()}/-</strong> ہر ماہ کرائے کی رقم ادا کرے گا۔ کرائے کی رقم میں ہر سال <strong>{data.annualIncreasePercent}%</strong> اضافہ ہوگا۔
      </p>
      <p className="mb-1"><strong>2.2-</strong> کرائے کی رقم درج ذیل اکاؤنٹ میں جمع کرائی جائے گی:</p>
      <ul className="mr-5 list-disc">
        <li>Account Title: {data.bankAccountTitle ?? "-"}</li>
        <li>Bank Name: {data.bankName ?? "-"}</li>
        <li>Account No.: {data.bankAccountNumber ?? "-"}</li>
      </ul>
      <p>
        <strong>2.4-</strong> کرائے کی رقم ہر ماہ کی <strong>{data.dueDay}</strong> تاریخ سے قبل ادا کی جائے۔
      </p>
      <p>
        <strong>2.5-</strong> کمپنی مبلغ <strong>{data.securityDeposit.toLocaleString()}/- روپے</strong> بطور سیکورٹی رقم ادا کرے گا جو معاہدہ کے ختم ہونے پر واپس کر دی جائے گی۔
      </p>

      <h3 className="mt-6 border-b pb-1 text-lg font-bold text-blue-700">3- جگہ کرایہ داری کا منظور شدہ استعمال</h3>
      <p>
        <strong>3.1-</strong> جگہ کرایہ داری صرف <strong>{data.approvedUse}</strong> کے لیے استعمال کیا جائے گا۔
      </p>
      <p><strong>3.2-</strong> کمپنی جگہ کرایہ داری پر کسی بھی قسم کا تعمیراتی کام مالک کی اجازت کے بغیر نہیں کرے گی۔</p>

      <h3 className="mt-6 border-b pb-1 text-lg font-bold text-blue-700">4- تجدید و ختم معاہدہ</h3>
      <p><strong>4.1-</strong> یہ معاہدہ کسی بھی فریق کی جانب سے شرائط کی خلاف ورزی پر ختم کیا جا سکتا ہے۔</p>
      <p><strong>4.2-</strong> ایگریمنٹ ختم کرنے کے لیے دوسرے فریق کو ایک ماہ قبل تحریری نوٹس ارسال کیا جائے گا۔</p>
      <p><strong>4.3-</strong> ایگریمنٹ ختم ہونے پر سیکورٹی رقم مالک سات (7) دن کے اندر واپس کرنے کا پابند ہوگا۔</p>

      <h3 className="mt-6 border-b pb-1 text-lg font-bold text-blue-700">5- متفرق</h3>
      <p>اس ایگریمنٹ کی تمام شرائط ملکِ پاکستان کے قوانین کے تحت لاگو ہوں گی۔</p>

      <p className="mt-6 font-bold">روبرو گواہان فریقین نے اپنے اپنے نمائندگان کے ذریعے معاہدہ ھذا پر دستخط کر دیے اور تاریخ لکھ دی ہے۔</p>

      <div className="mt-8 border-t-2 border-dashed border-gray-300 pt-5">
        <div className="mb-8 flex flex-wrap justify-between gap-6">
          <div className="w-[45%]">
            <p className="mb-1 font-bold">دستخطِ: Al Rana Traders (کمپنی)</p>
            <p>نام: {data.companyRepName ?? "-"}</p>
            <p>عنوان: {data.companyRepTitle ?? "-"}</p>
            <div className="relative mt-2 h-24 rounded border border-gray-300 bg-gray-50">
              {data.companySignatureData && <img src={data.companySignatureData} alt="Company Signature" className="h-full w-full object-contain" />}
              {data.companyStampUrl && <img src={data.companyStampUrl} alt="Stamp" className="absolute bottom-0 left-0 h-16 w-16 object-contain opacity-80" />}
            </div>
            {data.companySignedAt && <p className="mt-1 text-xs text-gray-500">Signed: {new Date(data.companySignedAt).toLocaleString()}</p>}
          </div>
          <div className="w-[45%]">
            <p className="mb-1 font-bold">دستخطِ: مالک (Land Lord)</p>
            <p>نام: {data.landlordName}</p>
            <p>شناختی کارڈ نمبر: {data.landlordCnic ?? "-"}</p>
            <div className="mt-2 h-24 rounded border border-gray-300 bg-gray-50">
              {data.landlordSignatureData && <img src={data.landlordSignatureData} alt="Landlord Signature" className="h-full w-full object-contain" />}
            </div>
            {data.landlordSignedAt && <p className="mt-1 text-xs text-gray-500">Signed: {new Date(data.landlordSignedAt).toLocaleString()}</p>}
          </div>
        </div>

        {(data.witness1Name || data.witness2Name) && (
          <div className="mt-6 border-t border-gray-200 pt-4">
            <h3 className="mb-2 text-lg font-bold text-blue-700">گواہان</h3>
            <div className="flex flex-wrap justify-between gap-6">
              {data.witness1Name && (
                <div className="w-[45%]">
                  <p className="font-bold">گواہ شد (1):</p>
                  <p>نام: {data.witness1Name}</p>
                  <p>شناختی کارڈ نمبر: {data.witness1Cnic ?? "-"}</p>
                </div>
              )}
              {data.witness2Name && (
                <div className="w-[45%]">
                  <p className="font-bold">گواہ شد (2):</p>
                  <p>نام: {data.witness2Name}</p>
                  <p>شناختی کارڈ نمبر: {data.witness2Cnic ?? "-"}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}