"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import nodemailer from "nodemailer";

export interface ActionState {
  error?: string;
  success?: boolean;
  documentUrl?: string;
  signingLink?: string;
}

const SITE_URL = "https://alranatraders.pk";

export async function createRentAgreement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();
  const branchId = String(formData.get("branch_id") ?? "");
  const landlordName = String(formData.get("landlord_name") ?? "").trim();
  const landlordContact = (formData.get("landlord_contact") as string) || null;
  const landlordCnic = (formData.get("landlord_cnic") as string) || null;
  const monthlyRent = Number(formData.get("monthly_rent") ?? 0);
  const dueDay = Number(formData.get("due_day") ?? 5);
  const startDate = String(formData.get("agreement_start_date") ?? "");
  const endDate = (formData.get("agreement_end_date") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  const securityDeposit = Number(formData.get("security_deposit") ?? 0);
  const annualIncreasePercent = Number(formData.get("annual_increase_percent") ?? 0);
  const durationYears = Number(formData.get("duration_years") ?? 1);
  const renewalYears = Number(formData.get("renewal_years") ?? 1);
  const bankAccountTitle = (formData.get("bank_account_title") as string) || null;
  const bankName = (formData.get("bank_name") as string) || null;
  const bankAccountNumber = (formData.get("bank_account_number") as string) || null;
  const approvedUse = (formData.get("approved_use") as string) || "Office, Warehouse, Retail Outlet";
  const shopSize = (formData.get("shop_size") as string) || null;
  const shopFullAddress = (formData.get("shop_full_address") as string) || null;
  const companyRepName = (formData.get("company_rep_name") as string) || null;
  const companyRepTitle = (formData.get("company_rep_title") as string) || null;
  const witness1Name = (formData.get("witness1_name") as string) || null;
  const witness1Cnic = (formData.get("witness1_cnic") as string) || null;
  const witness2Name = (formData.get("witness2_name") as string) || null;
  const witness2Cnic = (formData.get("witness2_cnic") as string) || null;

  if (!branchId) return { error: "Shop/Branch select karein." };
  if (!landlordName) return { error: "Landlord naam zaroori hai." };
  if (!monthlyRent || monthlyRent <= 0) return { error: "Monthly rent zaroori hai." };
  if (!startDate) return { error: "Agreement start date zaroori hai." };

  let documentUrl: string | null = null;
  const doc = formData.get("agreement_document");
  if (doc instanceof File && doc.size > 0) {
    const path = `${branchId}/${Date.now()}-${doc.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await serviceClient.storage.from("rent-agreements").upload(path, doc);
    if (!uploadError) {
      const { data } = serviceClient.storage.from("rent-agreements").getPublicUrl(path);
      documentUrl = data.publicUrl;
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const signingToken = crypto.randomUUID().replace(/-/g, "");

  const { error } = await supabase.from("shop_rent_agreements").insert({
    branch_id: branchId,
    landlord_name: landlordName,
    landlord_contact: landlordContact,
    landlord_cnic: landlordCnic,
    monthly_rent: monthlyRent,
    due_day: dueDay,
    agreement_start_date: startDate,
    agreement_end_date: endDate,
    agreement_document_url: documentUrl,
    security_deposit: securityDeposit,
    annual_increase_percent: annualIncreasePercent,
    duration_years: durationYears,
    renewal_years: renewalYears,
    bank_account_title: bankAccountTitle,
    bank_name: bankName,
    bank_account_number: bankAccountNumber,
    approved_use: approvedUse,
    shop_size: shopSize,
    shop_full_address: shopFullAddress,
    company_rep_name: companyRepName,
    company_rep_title: companyRepTitle,
    witness1_name: witness1Name,
    witness1_cnic: witness1Cnic,
    witness2_name: witness2Name,
    witness2_cnic: witness2Cnic,
    signing_token: signingToken,
    notes,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/shop-rent");
  return { success: true, signingLink: `${SITE_URL}/agreement-sign/${signingToken}` };
}

export async function sendSigningLinkEmail(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const agreementId = String(formData.get("agreement_id") ?? "");
  const toEmail = String(formData.get("to_email") ?? "").trim();
  if (!agreementId) return { error: "Missing agreement id." };
  if (!toEmail) return { error: "Email zaroori hai." };

  const serviceClient = createServiceClient();
  const { data: agreement } = await serviceClient.from("shop_rent_agreements").select("signing_token, landlord_name, branches(name)").eq("id", agreementId).single();
  if (!agreement) return { error: "Agreement nahi mila." };

  const branch = Array.isArray(agreement.branches) ? agreement.branches[0] : agreement.branches;
  const link = `${SITE_URL}/agreement-sign/${agreement.signing_token}`;

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "mail.alranatraders.pk",
      port: 587,
      secure: false,
      auth: { user: process.env.JOB_SMTP_USER ?? "job@alranatraders.pk", pass: process.env.JOB_SMTP_PASS },
    });
    await transporter.sendMail({
      from: `"Al Rana Traders" <${process.env.JOB_SMTP_USER ?? "job@alranatraders.pk"}>`,
      to: toEmail,
      subject: `Rent Agreement - ${branch?.name ?? "Shop"}`,
      html: `<div dir="rtl" style="font-family: Arial, sans-serif;"><p>محترم ${agreement.landlord_name},</p><p>براہ کرم نیچے دیئے گئے لنک پر جا کر معاہدہ کرایہ داری ملاحظہ فرمائیں اور دستخط کریں۔</p><p><a href="${link}">${link}</a></p></div>`,
    });
  } catch {
    return { error: "Email bhejne mein masla hua." };
  }

  return { success: true };
}

export async function saveLandlordSignature(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const signatureData = String(formData.get("signature_data") ?? "");
  if (!token) return { error: "Invalid link." };
  if (!signatureData) return { error: "Barah-e-meherbani sign karein." };

  const serviceClient = createServiceClient();
  const { error } = await serviceClient
    .from("shop_rent_agreements")
    .update({ landlord_signature_data: signatureData, landlord_signed_at: new Date().toISOString() })
    .eq("signing_token", token);
  if (error) return { error: error.message };

  return { success: true };
}

export async function saveCompanySignature(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const agreementId = String(formData.get("agreement_id") ?? "");
  const signatureData = String(formData.get("signature_data") ?? "");
  if (!agreementId) return { error: "Missing agreement id." };
  if (!signatureData) return { error: "Barah-e-meherbani sign karein." };

  const { error } = await supabase
    .from("shop_rent_agreements")
    .update({ company_signature_data: signatureData, company_signed_at: new Date().toISOString() })
    .eq("id", agreementId);
  if (error) return { error: error.message };

  revalidatePath("/admin/shop-rent");
  return { success: true };
}

export async function uploadCompanyStamp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();
  const stamp = formData.get("stamp_image");
  if (!(stamp instanceof File) || stamp.size === 0) return { error: "Stamp image select karein." };

  const path = `stamp-${Date.now()}-${stamp.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
  const { error: uploadError } = await serviceClient.storage.from("rent-agreements").upload(path, stamp);
  if (uploadError) return { error: uploadError.message };
  const { data } = serviceClient.storage.from("rent-agreements").getPublicUrl(path);

  const { data: existing } = await supabase.from("company_billing_settings").select("id").limit(1).single();
  if (existing) {
    await supabase.from("company_billing_settings").update({ company_stamp_url: data.publicUrl }).eq("id", existing.id);
  } else {
    await supabase.from("company_billing_settings").insert({ company_stamp_url: data.publicUrl });
  }

  revalidatePath("/admin/shop-rent");
  return { success: true };
}

export async function recordRentPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const agreementId = String(formData.get("agreement_id") ?? "");
  const month = Number(formData.get("payment_month") ?? 0);
  const year = Number(formData.get("payment_year") ?? 0);
  const amountDue = Number(formData.get("amount_due") ?? 0);
  const amountPaid = Number(formData.get("amount_paid") ?? 0);
  const paymentMethod = (formData.get("payment_method") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!agreementId || !month || !year) return { error: "Agreement, month aur year zaroori hain." };
  if (!amountPaid || amountPaid <= 0) return { error: "Amount sahi likhein." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("shop_rent_payments").upsert(
    {
      agreement_id: agreementId,
      payment_month: month,
      payment_year: year,
      amount_due: amountDue,
      amount_paid: amountPaid,
      paid_date: new Date().toISOString().slice(0, 10),
      payment_method: paymentMethod,
      notes,
      created_by: user?.id ?? null,
    },
    { onConflict: "agreement_id,payment_month,payment_year" }
  );
  if (error) return { error: error.message };

  revalidatePath("/admin/shop-rent");
  return { success: true };
}

export async function createShopBill(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();
  const branchId = String(formData.get("branch_id") ?? "");
  const billType = String(formData.get("bill_type") ?? "").trim();
  const month = Number(formData.get("bill_month") ?? 0);
  const year = Number(formData.get("bill_year") ?? 0);
  const amount = Number(formData.get("amount") ?? 0);
  const dueDate = (formData.get("due_date") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!branchId) return { error: "Shop/Branch select karein." };
  if (!billType) return { error: "Bill type zaroori hai." };
  if (!amount || amount <= 0) return { error: "Amount zaroori hai." };

  let billImageUrl: string | null = null;
  const img = formData.get("bill_image");
  if (img instanceof File && img.size > 0) {
    const path = `${branchId}/${Date.now()}-${img.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await serviceClient.storage.from("shop-bills").upload(path, img);
    if (!uploadError) {
      const { data } = serviceClient.storage.from("shop-bills").getPublicUrl(path);
      billImageUrl = data.publicUrl;
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("shop_bills").insert({
    branch_id: branchId,
    bill_type: billType,
    bill_month: month,
    bill_year: year,
    amount,
    due_date: dueDate,
    bill_image_url: billImageUrl,
    notes,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/shop-rent");
  return { success: true };
}

export async function markBillPaid(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const billId = String(formData.get("bill_id") ?? "");
  if (!billId) return { error: "Missing bill id." };

  const { error } = await supabase
    .from("shop_bills")
    .update({ status: "paid", paid_date: new Date().toISOString().slice(0, 10) })
    .eq("id", billId);
  if (error) return { error: error.message };

  revalidatePath("/admin/shop-rent");
  return { success: true };
}