/**
 * Maintenance ke faisle ki hadd.
 *
 * Ye yahan hain, action wali file mein nahi: "use server" file se sirf
 * async function bahar ja sakte hain.
 */

/** Comment ki hadd -- DB ka khana varchar(255) hai, dono ek jaise rahen. */
export const MAINT_COMMENT_MIN = 5;
export const MAINT_COMMENT_MAX = 255;

export const MAINTENANCE_TYPES = [
  { value: "oil_change", label: "Oil Change" },
  { value: "service", label: "Service" },
  { value: "repair", label: "Marammat" },
  { value: "tyre", label: "Tyre" },
  { value: "battery", label: "Battery" },
  { value: "other", label: "Deegar" },
] as const;

/**
 * Wo kaam jin se oil ka hisaab dobara shuru hota hai.
 *
 * Tyre badalne ya battery lagane se oil ka waqt aage nahi sarakta --
 * warna reminder us kaam par band ho jata jis ka oil se koi taluq hi
 * nahi.
 */
export const RESETS_OIL_COUNTER = ["oil_change", "service"];
