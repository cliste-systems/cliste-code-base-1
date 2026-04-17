const STEPS = [
  { key: "profile", label: "Salon profile" },
  { key: "payments", label: "Connect Stripe" },
  { key: "plan", label: "Plan & launch" },
  { key: "phone", label: "Pick a number" },
  { key: "done", label: "Go live" },
] as const;

export function WizardStepper({ current }: { current: (typeof STEPS)[number]["key"] }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-medium text-gray-500">
      {STEPS.map((s, i) => {
        const isCurrent = i === currentIndex;
        const isDone = i < currentIndex;
        return (
          <li
            key={s.key}
            className={
              isCurrent
                ? "flex items-center gap-2 text-emerald-700"
                : isDone
                  ? "flex items-center gap-2 text-gray-700"
                  : "flex items-center gap-2 text-gray-400"
            }
          >
            <span
              className={
                "flex size-6 items-center justify-center rounded-full border " +
                (isCurrent
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                  : isDone
                    ? "border-gray-300 bg-gray-100 text-gray-700"
                    : "border-gray-200 bg-white text-gray-400")
              }
            >
              {i + 1}
            </span>
            <span className="hidden sm:inline">{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
