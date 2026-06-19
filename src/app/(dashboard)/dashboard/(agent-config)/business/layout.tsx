import { BusinessSetupShell } from "../../cara-setup/business-setup-shell";

export default function BusinessConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <BusinessSetupShell>{children}</BusinessSetupShell>;
}
