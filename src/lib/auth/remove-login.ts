/**
 * Login hatana -- is tarah ke aadha kaam kabhi na ho.
 *
 * PURANI TARTEEB (ghalat): pehle profiles.delete(), phir
 * auth.admin.deleteUser(...).catch(() => {}). Live par auth.users ko
 * 112 FK chhoote hain, 98 bina cascade (farmers.user_id, customers.user_id,
 * created_by...). Banda kisi record se juRa ho to auth delete FAIL hota
 * hai -- supabase-js ghalti LAUTATA hai, phenkta nahi, is liye `.catch`
 * kabhi chalta hi nahi tha. Natija: profile ghaib, login baqi -- "Account
 * setup adhoora hai" (17 Oct, malik ka kisan login; 3 aur purane login).
 *
 * NAYI TARTEEB: pehle auth user. Wo hata to profile (profiles_id_fkey on
 * delete cascade) aur staff_details (profile_id cascade) khud saath jate
 * hain -- ek hi transaction mein. Na hata to KUCH nahi mitta, aur bulane
 * wala suspend kar deta hai.
 */

export type RemoveLoginResult = { removed: true } | { removed: false; error: string };

type AdminClient = {
  auth: { admin: { deleteUser(id: string): PromiseLike<{ error: { message: string } | null }> } };
};

export async function removeLoginSafely(service: unknown, userId: string): Promise<RemoveLoginResult> {
  if (!userId) return { removed: false, error: "Missing user id." };
  try {
    const { error } = await (service as AdminClient).auth.admin.deleteUser(userId);
    if (error) return { removed: false, error: error.message || "Login nahi hat saka." };
    return { removed: true };
  } catch (e) {
    return { removed: false, error: e instanceof Error ? e.message : "Login nahi hat saka." };
  }
}
