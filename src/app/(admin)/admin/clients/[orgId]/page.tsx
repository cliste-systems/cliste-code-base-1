import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ orgId: string }>;
};

export default async function AdminClientsOrgRedirect({ params }: PageProps) {
  const { orgId } = await params;
  redirect(`/admin/customers/${orgId}`);
}
