import { redirect } from "next/navigation";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const q = await searchParams;
  const next = new URLSearchParams();
  if (q.error) next.set("error", q.error);
  if (q.message) next.set("message", q.message);
  const suffix = next.size ? `?${next.toString()}` : "";
  redirect(`/authenticate${suffix}`);
}
