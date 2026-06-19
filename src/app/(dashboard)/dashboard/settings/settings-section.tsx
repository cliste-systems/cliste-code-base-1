import type { ReactNode } from "react";

export function SettingsSection({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id}>
      <div className="px-5 py-2.5">
        <h2 className="text-[15px] font-semibold tracking-tight text-[#0b1220]">
          {title}
        </h2>
      </div>
      <div className="space-y-3 px-5 pb-4">{children}</div>
    </section>
  );
}
