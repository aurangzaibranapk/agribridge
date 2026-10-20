import { StaffComplaintForm } from "@/components/support/complaint-queue";

export const metadata = { title: "Staff complaint" };

export default function PreviewStaffForm() {
  return (
    <main className="min-h-screen bg-[#f3f6fb] p-8">
      <StaffComplaintForm example />
    </main>
  );
}
