"use client";
import { useFormState, useFormStatus } from "react-dom";
import { updateSubscriptionSettings, activateFarmerSubscription, type ActionState } from "@/actions/subscriptions";
import { createAnnouncement, deactivateAnnouncement } from "@/actions/announcements";
import { Lock, Unlock, Megaphone, UserPlus, X, Users, TrendingUp, UserCheck, UserX, Image as ImageIcon } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Subscription {
  id: string;
  amountPaid: number;
  paymentMethod: string | null;
  startDate: string;
  endDate: string;
  status: string;
  receiptPhotoUrl: string | null;
  createdAt: string;
  farmerName: string;
  farmerCode: string;
}
interface Farmer { id: string; full_name: string; farmer_code: string; }
interface Announcement { id: string; title: string; is_active: boolean; cta_type: string; created_at: string; }
interface Stats {
  totalRevenue: number;
  revenueThisMonth: number;
  activeSubscribersCount: number;
  nonSubscribedCount: number;
  totalFarmers: number;
}

export function SubscriptionAdminClient({
  settings,
  subscriptions,
  farmers,
  announcements,
  stats,
}: {
  settings: { is_enforced: boolean; minimum_amount: number };
  subscriptions: Subscription[];
  farmers: Farmer[];
  announcements: Announcement[];
  stats: Stats;
}) {
  return (
    <div className="space-y-6">
      <StatsGrid stats={stats} />
      <SettingsCard settings={settings} />
      <AnnouncementSection announcements={announcements} />
      <ActivateFarmerCard farmers={farmers} />
      <SubscriptionsList subscriptions={subscriptions} />
    </div>
  );
}

function StatsGrid({ stats }: { stats: Stats }) {
  const lang = useLang();
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card">
        <TrendingUp className="h-5 w-5 text-green-500" />
        <p className="mt-2 text-xl font-bold text-surface-900">Rs {stats.totalRevenue.toLocaleString()}</p>
        <p className="text-xs text-surface-500">{t("sb_total_revenue", lang)}</p>
      </div>
      <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card">
        <TrendingUp className="h-5 w-5 text-brand-500" />
        <p className="mt-2 text-xl font-bold text-surface-900">Rs {stats.revenueThisMonth.toLocaleString()}</p>
        <p className="text-xs text-surface-500">{t("sb_month_revenue", lang)}</p>
      </div>
      <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card">
        <UserCheck className="h-5 w-5 text-green-500" />
        <p className="mt-2 text-xl font-bold text-surface-900">{stats.activeSubscribersCount}</p>
        <p className="text-xs text-surface-500">{t("sb_active_subscribers", lang)}</p>
      </div>
      <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card">
        <UserX className="h-5 w-5 text-amber-500" />
        <p className="mt-2 text-xl font-bold text-surface-900">{stats.nonSubscribedCount}</p>
        <p className="text-xs text-surface-500">Baaqi (Total {stats.totalFarmers} Farmers)</p>
      </div>
    </div>
  );
}

function SettingsCard({ settings }: { settings: { is_enforced: boolean; minimum_amount: number } }) {
  const [state, formAction] = useFormState(updateSubscriptionSettings, initialState);
  const lang = useLang();
  return (
    <div className={`rounded-card border p-5 shadow-card ${settings.is_enforced ? "border-red-200 bg-red-50" : "border-surface-200 bg-white"}`}>
      <div className="mb-3 flex items-center gap-2">
        {settings.is_enforced ? <Lock className="h-5 w-5 text-red-600" /> : <Unlock className="h-5 w-5 text-green-600" />}
        <h2 className="font-display text-base font-semibold text-surface-900">
          Subscription {settings.is_enforced ? "LOCKED (Sab Ke Liye Zaroori)" : "OFF (Sab Free Hai)"}
        </h2>
      </div>
      {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <form action={formAction} className="space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_enforced" defaultChecked={settings.is_enforced} className="h-4 w-4" />{t("sb_enforce", lang)}</label>
        <div>
          <label className="text-xs font-medium text-surface-600">{t("sb_min_amount", lang)}</label>
          <input type="number" name="minimum_amount" defaultValue={settings.minimum_amount} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </div>
        <SaveButton />
      </form>
    </div>
  );
}

function AnnouncementSection({ announcements }: { announcements: Announcement[] }) {
  const [createState, createAction] = useFormState(createAnnouncement, initialState);
  const lang = useLang();
  return (
    <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card">
      <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-surface-900">
        <Megaphone className="h-5 w-5 text-brand-600" />{t("sb_announce_all", lang)}</h2>
      {createState.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{createState.error}</p>}
      {createState.success && <p className="mb-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{t("sb_announcement_sent", lang)}</p>}
      <form action={createAction} className="space-y-2">
        <input name="title" required placeholder={t("c_title", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        <textarea name="message" required rows={3} placeholder={t("sb_msg", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        <select name="cta_type" className="w-full rounded-lg border border-surface-200 p-2 text-sm">
          <option value="none">{t("sb_type_notice", lang)}</option>
          <option value="vote">{t("sb_type_vote", lang)}</option>
          <option value="link">{t("sb_type_link", lang)}</option>
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input name="cta_label" placeholder={t("sb_button_text", lang)} className="rounded-lg border border-surface-200 p-2 text-sm" />
          <input name="cta_url" placeholder={t("sb_link_url", lang)} className="rounded-lg border border-surface-200 p-2 text-sm" />
        </div>
        <SendAnnouncementButton />
      </form>

      {announcements.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-surface-100 pt-3">
          {announcements.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg bg-surface-50 px-3 py-2 text-sm">
              <span>{a.title} <span className="text-xs text-surface-400">({a.cta_type})</span></span>
              {a.is_active && <DeactivateButton id={a.id} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeactivateButton({ id }: { id: string }) {
  const [, formAction] = useFormState(deactivateAnnouncement, initialState);
  const lang = useLang();
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="flex items-center gap-1 text-xs text-red-600 hover:underline">
        <X className="h-3 w-3" />{t("c_close", lang)}</button>
    </form>
  );
}

function ActivateFarmerCard({ farmers }: { farmers: Farmer[] }) {
  const [state, formAction] = useFormState(activateFarmerSubscription, initialState);
  const lang = useLang();
  return (
    <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card">
      <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-surface-900">
        <UserPlus className="h-5 w-5 text-brand-600" />{t("sb_activate_farmer", lang)}</h2>
      {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.success && <p className="mb-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{t("sb_activated", lang)}</p>}
      <form action={formAction} encType="multipart/form-data" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select name="farmer_id" required className="rounded-lg border border-surface-200 p-2 text-sm">
          <option value="">- Farmer Select Karein -</option>
          {farmers.map((f) => (
            <option key={f.id} value={f.id}>{f.full_name} ({f.farmer_code})</option>
          ))}
        </select>
        <select name="plan_duration" required defaultValue="1_year" className="rounded-lg border border-surface-200 p-2 text-sm">
          <option value="1_month">1 Month</option>
          <option value="3_month">3 Month</option>
          <option value="1_year">1 Saal</option>
          <option value="3_year">3 Saal</option>
          <option value="lifetime">{t("sb_lifetime", lang)}</option>
        </select>
        <input type="number" name="amount_paid" required placeholder={t("c_amount_rs", lang)} className="rounded-lg border border-surface-200 p-2 text-sm" />
        <select name="payment_method" className="rounded-lg border border-surface-200 p-2 text-sm">
          <option value="cash">{t("c_cash", lang)}</option>
          <option value="bank_transfer">{t("c_bank_transfer", lang)}</option>
          <option value="jazzcash">JazzCash</option>
          <option value="easypaisa">EasyPaisa</option>
          <option value="card">{t("sb_card", lang)}</option>
        </select>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-surface-600">{t("sb_payment_proof", lang)}</label>
          <input type="file" name="receipt_photo" accept="image/*" className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </div>
        <div className="sm:col-span-2">
          <ActivateButton />
        </div>
      </form>
    </div>
  );
}

function SubscriptionsList({ subscriptions }: { subscriptions: Subscription[] }) {
  const lang = useLang();
  return (
    <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card">
      <h2 className="mb-3 font-display text-base font-semibold text-surface-900">{t("sb_payment_history", lang)}</h2>
      {subscriptions.length === 0 ? (
        <p className="text-sm text-surface-400">{t("sub_none_yet", lang)}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 text-left text-xs text-surface-500">
                <th className="pb-2">{t("c_farmer", lang)}</th>
                <th className="pb-2">{t("c_amount", lang)}</th>
                <th className="pb-2">{t("c_method", lang)}</th>
                <th className="pb-2">{t("sb_when_paid", lang)}</th>
                <th className="pb-2">{t("sb_valid_till", lang)}</th>
                <th className="pb-2">{t("sb_proof", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((s) => (
                <tr key={s.id} className="border-b border-surface-100 last:border-0">
                  <td className="py-2">{s.farmerName} <span className="text-xs text-surface-400">({s.farmerCode})</span></td>
                  <td className="py-2 font-medium text-brand-700">Rs {s.amountPaid.toLocaleString()}</td>
                  <td className="py-2 text-surface-500">{s.paymentMethod ?? "-"}</td>
                  <td className="py-2 text-surface-500">{new Date(s.createdAt).toLocaleDateString()}</td>
                  <td className="py-2 text-surface-500">{s.endDate}</td>
                  <td className="py-2">
                    {s.receiptPhotoUrl ? (
                      <a href={s.receiptPhotoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand-600 hover:underline">
                        <ImageIcon className="h-3.5 w-3.5" />{t("sb_view", lang)}</a>
                    ) : (
                      <span className="text-xs text-surface-300">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : "Save Karein"}</button>;
}
function SendAnnouncementButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : "Announcement Bhejein"}</button>;
}
function ActivateButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : "Activate Karein"}</button>;
}