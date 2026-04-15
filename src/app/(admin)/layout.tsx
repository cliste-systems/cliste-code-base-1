import Link from "next/link";

import { Building2 } from "lucide-react";

import { AdminNav } from "./admin-nav";

function adminSessionLabel(): string {
  const custom = process.env.CLISTE_ADMIN_DISPLAY_NAME?.trim();
  if (custom) return custom;
  return "admin";
}

export default function AdminShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const loggedInAs = adminSessionLabel();

  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-[#fafafa] antialiased text-gray-900">
      <aside className="relative z-20 hidden h-screen w-[260px] shrink-0 flex-col border-r border-gray-200/60 bg-[#fafafa] md:flex">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className="shrink-0 p-4 pt-6">
            <Link
              href="/admin"
              className="-mx-2 flex cursor-pointer items-start gap-3 rounded-lg p-2 transition-colors hover:bg-gray-100/50"
            >
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white shadow-sm">
                <Building2
                  className="size-4 text-gray-600"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="text-sm leading-tight font-medium text-gray-900">
                  Cliste Admin
                </span>
                <span className="mt-0.5 text-xs text-gray-500">
                  Internal console
                </span>
                <span className="mt-3 flex items-center gap-1 text-xs text-gray-400">
                  Logged in as{" "}
                  <span className="font-medium text-gray-700">{loggedInAs}</span>
                </span>
              </div>
            </Link>
          </div>

          <AdminNav loggedInAs={loggedInAs} />
        </div>
      </aside>

      <main className="relative z-10 h-screen min-w-0 flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </main>
    </div>
  );
}
