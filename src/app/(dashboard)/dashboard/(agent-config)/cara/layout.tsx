import { CaraSetupShell } from "../../cara-setup/cara-setup-shell";

export default function CaraConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CaraSetupShell>{children}</CaraSetupShell>;
}
