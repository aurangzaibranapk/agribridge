import { MachineryQueue } from "../queue-view";

export const dynamic = "force-dynamic";

/**
 * Kattai ka schedule.
 *
 * Assign wale safhe se ye alag hai, chahe dono mein kuch bookings ek hi
 * hon: wahan sawal ye hai ke "kis ko machine chahiye", yahan ye ke "kis
 * din kya hona hai". Is liye yahan tarteeb TAREEKH ki hai, qatar ki
 * nahi -- aur wo booking bhi shamil hai jis par machine ja chuki hai
 * magar kaam abhi jari hai.
 */
export default async function Page() {
  return <MachineryQueue queues={["machine_bhejna", "kaam_darj_karna"]} title="mq_title_schedule" byDate />;
}
