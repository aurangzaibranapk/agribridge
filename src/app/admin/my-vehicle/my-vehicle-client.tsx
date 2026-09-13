"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { AlertTriangle, Camera, CheckCircle2 } from "lucide-react";
import { Button, Input, Label, Badge } from "@/components/ui/form";
import { Card } from "@/components/ui/layout-primitives";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { PaymentSlipUpload } from "@/components/ui/payment-slip-upload";
import {
  saveOpeningMeter,
  saveVehicleFuel,
  saveClosingMeter,
  type VehicleActionState,
} from "@/actions/my-vehicle";

const initialState: VehicleActionState = {};

interface LogView {
  logNumber: string;
  openingKm: number | null;
  closingKm: number | null;
  kmTravelled: number | null;
  kmPerLiter: number | null;
  costPerKm: number | null;
  expectedLiters: number | null;
  litersDifference: number | null;
  status: string;
  flags: string[];
}

interface FuelView {
  id: string;
  liters: number | null;
  ratePerLiter: number | null;
  amount: number | null;
  mismatch: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  open: "Chal raha hai",
  complete: "Manager ke intezar mein",
  posted: "Accounts mein ja chuka",
  cancelled: "Cancel",
};

export function MyVehicleClient({
  vehicleName,
  registrationNo,
  expectedKmPerLiter,
  log,
  fuel,
}: {
  vehicleName: string;
  registrationNo: string | null;
  expectedKmPerLiter: number;
  log: LogView | null;
  fuel: FuelView[];
}) {
  const openingDone = log?.openingKm != null;
  const lang = useLang();
  const closingDone = log?.closingKm != null;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-display text-lg font-semibold text-surface-900 dark:text-white">{vehicleName}</p>
            <p className="text-xs text-surface-500">
              {registrationNo ?? "—"} · mamooli mileage {expectedKmPerLiter} km/litre
            </p>
          </div>
          {log && <Badge tone={log.status === "posted" ? "green" : log.status === "complete" ? "blue" : "amber"}>
            {STATUS_LABEL[log.status] ?? log.status}
          </Badge>}
        </div>
      </Card>

      {/* Aaj ka hisaab -- jaise jaise banta hai. Ye adad koi hath se nahi
          likhta: shaam ka meter aate hi khud ban jate hain. */}
      {log && (
        <Card>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fact label={t("mv_morning_meter", lang)} value={log.openingKm !== null ? `${log.openingKm.toLocaleString()} km` : "—"} />
            <Fact label={t("mv_evening_meter", lang)} value={log.closingKm !== null ? `${log.closingKm.toLocaleString()} km` : "—"} />
            <Fact label={t("mv_today_run", lang)} value={log.kmTravelled !== null ? `${log.kmTravelled.toLocaleString()} km` : "—"} />
            <Fact label={t("c_mileage", lang)} value={log.kmPerLiter !== null ? `${log.kmPerLiter} km/l` : "—"} />
          </div>
          {log.costPerKm !== null && (
            <p className="mt-2 text-xs text-surface-500">
              Per km kharcha Rs {log.costPerKm.toLocaleString()}
              {log.expectedLiters !== null && ` · lagna chahiye tha ${log.expectedLiters} litre`}
              {log.litersDifference !== null && ` · farq ${log.litersDifference > 0 ? "+" : ""}${log.litersDifference} litre`}
            </p>
          )}
          {log.flags.length > 0 && (
            <div className="mt-3 space-y-1">
              {log.flags.map((f, i) => (
                <p key={i} className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {f}
                </p>
              ))}
              {/* Nishan rok nahi hai -- record ban chuka hai. Ye sirf
                  manager ko dekhne ki cheez hai. */}
              <p className="text-xs text-surface-400">{t("at_only_marks", lang)}</p>
            </div>
          )}
        </Card>
      )}

      {!openingDone && (
        <MeterForm
          title={t("mv_step1_morning", lang)}
          hint="Kaam shuru karne se pehle meter ki tasveer lein."
          action={saveOpeningMeter}
          label={t("mv_step1_enter", lang)}
        />
      )}

      {openingDone && !closingDone && (
        <>
          <FuelForm />
          <MeterForm
            title={t("mv_step3_evening", lang)}
            hint="Kaam khatam hone par. Yahin poore din ka hisaab ban jayega."
            action={saveClosingMeter}
            label={t("mv_step3_enter", lang)}
          />
        </>
      )}

      {closingDone && (
        <Card>
          <p className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />{t("at_day_closed", lang)}</p>
        </Card>
      )}

      {fuel.length > 0 && (
        <Card>
          <p className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">{t("mv_todays_bills", lang)}</p>
          <div className="space-y-1">
            {fuel.map((f) => (
              <div key={f.id} className="flex justify-between text-sm">
                <span className="text-surface-600 dark:text-surface-400">
                  {f.liters ?? "—"} litre {f.ratePerLiter ? `× Rs ${f.ratePerLiter}` : ""}
                  {f.mismatch && <span className="ml-1 text-xs text-amber-600">(hisaab nahi milta)</span>}
                </span>
                <span className="font-medium text-surface-900 dark:text-white">
                  Rs {(f.amount ?? 0).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-surface-500">{label}</p>
      <p className="mt-0.5 font-display text-base font-semibold text-surface-900 dark:text-white">{value}</p>
    </div>
  );
}

function MeterForm({
  title,
  hint,
  action,
  label,
}: {
  title: string;
  hint: string;
  action: (prev: VehicleActionState, fd: FormData) => Promise<VehicleActionState>;
  label: string;
}) {
  const [state, formAction] = useFormState(action, initialState);
  const lang = useLang();
  const [photo, setPhoto] = useState("");

  return (
    <Card>
      <form action={formAction} className="space-y-3">
        <div>
          <p className="font-display text-base font-semibold text-surface-900 dark:text-white">{title}</p>
          <p className="text-xs text-surface-500">{hint}</p>
        </div>
        <Msg state={state} />
        <input type="hidden" name="photo_path" value={photo} />
        <div>
          <Label>{t("mv_meter_reading", lang)}</Label>
          <Input type="number" name="km" step="1" inputMode="numeric" placeholder="0" />
        </div>
        {/* Tasveer laazmi hai -- yahan bhi aur database par bhi. Meter ka
            adad bina tasveer ke sirf kisi ka dawa hai. */}
        <PaymentSlipUpload onUploaded={setPhoto} />
        <p className="flex items-center gap-1.5 text-xs text-surface-500">
          <Camera className="h-3.5 w-3.5" />{t("at_meter_photo_required", lang)}</p>
        <Submit label={label} disabled={!photo} />
      </form>
    </Card>
  );
}

function FuelForm() {
  const [state, formAction] = useFormState(saveVehicleFuel, initialState);
  const lang = useLang();
  const [photo, setPhoto] = useState("");
  const [liters, setLiters] = useState("");
  const [rate, setRate] = useState("");
  const [amount, setAmount] = useState("");

  // Bill ka apna hisaab saamne rakha jata hai. Farq ho to indraj phir
  // bhi hota hai -- sirf nishan lag jata hai, jaise WhatsApp wale
  // raaste par hota hai.
  const computed = Number(liters) && Number(rate) ? Math.round(Number(liters) * Number(rate)) : null;
  const mismatch =
    computed !== null && Number(amount) > 0 && Math.abs(computed - Number(amount)) > Math.max(5, Number(amount) * 0.01);

  return (
    <Card>
      <form action={formAction} className="space-y-3">
        <div>
          <p className="font-display text-base font-semibold text-surface-900 dark:text-white">2 — Petrol ka bill</p>
          <p className="text-xs text-surface-500">{t("mv_as_many_times", lang)}</p>
        </div>
        <Msg state={state} />
        <input type="hidden" name="photo_path" value={photo} />
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label>{t("mv_litre", lang)}</Label>
            <Input type="number" name="liters" step="0.01" value={liters} onChange={(e) => setLiters(e.target.value)} />
          </div>
          <div>
            <Label>{t("c_rate", lang)}</Label>
            <Input type="number" name="rate_per_liter" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
          <div>
            <Label>{t("sb_amount", lang)}</Label>
            <Input type="number" name="amount" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
        {computed !== null && (
          <p className={mismatch ? "text-xs text-amber-700 dark:text-amber-400" : "text-xs text-surface-500"}>
            {liters} × {rate} = Rs {computed.toLocaleString()}
            {mismatch && " — bill par likhi raqam se mel nahi khata (nishan lag jayega)"}
          </p>
        )}
        <PaymentSlipUpload onUploaded={setPhoto} />
        <p className="flex items-center gap-1.5 text-xs text-surface-500">
          <Camera className="h-3.5 w-3.5" />{t("at_bill_photo_required", lang)}</p>
        <Submit label={t("mv_enter_bill", lang)} disabled={!photo} />
      </form>
    </Card>
  );
}

function Msg({ state }: { state: VehicleActionState }) {
  if (state.error) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <div className="space-y-1">
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-300">
          {state.notice}
        </p>
        {(state.flags ?? []).map((f, i) => (
          <p key={i} className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
            {f}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

function Submit({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? "..." : label}
    </Button>
  );
}
