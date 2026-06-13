import { redirect } from "next/navigation";
import { requireWorkspace } from "../lib/workspace";

export default async function HomePage() {
  const context = await requireWorkspace();
  redirect(context.isOwner ? "/dashboard" : "/submit");
}
