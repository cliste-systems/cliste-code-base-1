import { redirect } from "next/navigation";

/** `/` is not a public marketing chooser — send visitors to sign-in. */
export default function Home() {
  redirect("/authenticate");
}
