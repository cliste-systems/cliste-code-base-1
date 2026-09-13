import { redirect } from "next/navigation";

/** Root must never expose dashboard/admin entry points — send everyone to sign-in. */
export default function Home() {
  redirect("/authenticate");
}
