import { redirect } from "next/navigation";

export default function ReportsIndex() {
  redirect("/admin/reports/stock-on-hand");
}
