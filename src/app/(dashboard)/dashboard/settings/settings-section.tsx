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
    <section id={id} className="bg-[#fbfcfb]">
      <div className="border-b border-[#e8eeea] px-5 py-3">
        <h2 className="text-[14px] font-semibold tracking-tight text-[#0b1220]">
          {title}
        </h2>
      </div>
      <div className="space-y-3 px-5 py-4">{children}</div>
    </section>
  );
}
