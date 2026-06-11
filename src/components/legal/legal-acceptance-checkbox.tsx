import Link from "next/link";

import { cn } from "@/lib/utils";

type Props = {
  id: string;
  name: string;
  required?: boolean;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
  children: React.ReactNode;
};

export function LegalAcceptanceCheckbox({
  id,
  name,
  required = true,
  checked,
  onCheckedChange,
  className,
  children,
}: Props) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 text-left text-[13px] leading-relaxed text-slate-600 shadow-sm",
        className,
      )}
    >
      <input
        id={id}
        name={name}
        type="checkbox"
        required={required}
        checked={checked}
        onChange={
          onCheckedChange
            ? (event) => onCheckedChange(event.target.checked)
            : undefined
        }
        className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-[#0b1220] focus:ring-[#0b1220]/20"
      />
      <span>{children}</span>
    </label>
  );
}

export function LegalDocLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-[#0b1220] underline underline-offset-2"
    >
      {children}
    </Link>
  );
}
