"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Phone } from "lucide-react";

import { OpeningHoursEditor } from "@/components/agent-knowledge/opening-hours-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  allGoLiveStepsComplete,
  evaluateStoreSetupReadiness,
  parseAdminGreetingParts,
  type StoreSetupStepId,
} from "@/lib/admin-store-readiness";
import {
  CALL_ROUTING_MODE_META,
  CALL_ROUTING_MODES,
  parseCallRoutingMode,
  type CallRoutingMode,
} from "@/lib/call-routing";
import { landlineDivertInstructions } from "@/lib/landline-divert-instructions";
import {
  DIVERT_CARRIERS,
  RETAIL_BANNERS,
  RETAIL_FACILITIES,
  STORE_CONTACT_ROLES,
  type AdminStoreSetupData,
  type DivertCarrier,
  type RetailBanner,
  type StoreContactRole,
} from "@/lib/retail-store-types";
import { voiceLegalDisclosure, VOICE_LEGAL_NOTICE_HINT } from "@/lib/voice-greeting";
import { cn } from "@/lib/utils";

import {
  activateRetailStore,
  assignStoreClisteNumber,
  deleteStoreContact,
  markDivertVerified,
  recompileStorePrompt,
  saveStoreContact,
  saveStoreDepartment,
  saveStoreFacts,
  saveStoreGreeting,
  saveStoreIdentity,
  saveStoreNumbersDivert,
  saveStoreOpeningHours,
  seedRetailRoutePack,
  seedSupervaluDepartments,
} from "./actions";
import { parseStoreBusinessHours } from "./load-store-setup";
import { ReadinessRail } from "./readiness-rail";

type StoreSetupViewProps = {
  data: AdminStoreSetupData;
};

export function StoreSetupView({ data: initial }: StoreSetupViewProps) {
  const [data, setData] = useState(initial);
  const [activeStep, setActiveStep] = useState<StoreSetupStepId>("identity");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const readiness = useMemo(() => evaluateStoreSetupReadiness(data), [data]);
  const hoursState = useMemo(() => parseStoreBusinessHours(data), [data.businessHours]);

  const [identity, setIdentity] = useState({
    name: data.name,
    storeCode: data.storeCode,
    retailBanner: data.retailBanner || ("supervalu" as RetailBanner),
    agentLocationAddress: data.agentLocationAddress,
    agentLocationEircode: data.agentLocationEircode,
    agentLocationCounty: data.agentLocationCounty,
    timezone: data.timezone || "Europe/Dublin",
  });

  const [numbers, setNumbers] = useState({
    storePublicNumber: data.storePublicNumber,
    callRoutingMode: parseCallRoutingMode(data.callRoutingMode) as CallRoutingMode,
    transferNumber: data.fallbackNumber,
    divertCarrier: (data.divertCarrier || "eir") as DivertCarrier,
  });

  const [facts, setFacts] = useState({
    retailFacilities: data.retailFacilities,
    deliveryEnabled: data.retailDelivery.enabled === true,
    deliveryArea: data.retailDelivery.area ?? "",
    deliveryCutOff: data.retailDelivery.cut_off ?? "",
    deliveryMinSpend: data.retailDelivery.min_spend ?? "",
    clickCollectUrl: data.retailClickCollectUrl,
    loyaltyProgram: data.retailLoyaltyProgram,
    quotePricesOnCalls: data.quotePricesOnCalls,
  });

  const [hours, setHours] = useState(hoursState);
  const greetingParts = parseAdminGreetingParts(data);
  const [greetingIntro, setGreetingIntro] = useState(greetingParts.intro);
  const [greetingClosing, setGreetingClosing] = useState(greetingParts.closing);
  const [assistantName, setAssistantName] = useState(data.assistantDisplayName);

  const divertInstructions = landlineDivertInstructions(
    numbers.divertCarrier,
    data.phoneNumber,
    numbers.callRoutingMode,
  );

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setMessage(result.ok ? "Saved." : (result.message ?? "Something went wrong."));
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-6">
        {activeStep === "identity" ? (
          <section className="border-border bg-card space-y-4 rounded-xl border p-5 shadow-sm">
            <h2 className="text-lg font-semibold">1 · Store identity</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="store-name">Store name</Label>
                <Input
                  id="store-name"
                  value={identity.name}
                  onChange={(e) => setIdentity({ ...identity, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="store-code">Store code</Label>
                <Input
                  id="store-code"
                  value={identity.storeCode}
                  onChange={(e) =>
                    setIdentity({ ...identity, storeCode: e.target.value })
                  }
                  placeholder="e.g. 1234"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="retail-banner">Banner</Label>
                <select
                  id="retail-banner"
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  value={identity.retailBanner}
                  onChange={(e) =>
                    setIdentity({
                      ...identity,
                      retailBanner: e.target.value as RetailBanner,
                    })
                  }
                >
                  {RETAIL_BANNERS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="store-address">Address</Label>
                <Input
                  id="store-address"
                  value={identity.agentLocationAddress}
                  onChange={(e) =>
                    setIdentity({
                      ...identity,
                      agentLocationAddress: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="store-eircode">Eircode</Label>
                <Input
                  id="store-eircode"
                  value={identity.agentLocationEircode}
                  onChange={(e) =>
                    setIdentity({
                      ...identity,
                      agentLocationEircode: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="store-county">County</Label>
                <Input
                  id="store-county"
                  value={identity.agentLocationCounty}
                  onChange={(e) =>
                    setIdentity({
                      ...identity,
                      agentLocationCounty: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <Button
              disabled={pending}
              onClick={() =>
                run(() =>
                  saveStoreIdentity(data.organizationId, identity).then((r) => {
                    if (r.ok) setData({ ...data, ...identity });
                    return r;
                  }),
                )
              }
            >
              Save identity
            </Button>
          </section>
        ) : null}

        {activeStep === "numbers" ? (
          <section className="border-border bg-card space-y-4 rounded-xl border p-5 shadow-sm">
            <h2 className="text-lg font-semibold">2 · Numbers & divert</h2>
            <div className="border-border rounded-lg border px-3 py-2">
              <p className="text-muted-foreground text-xs uppercase">Cliste DID</p>
              <p className="font-mono text-sm font-semibold">
                {data.phoneNumber || "— not assigned —"}
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-2 gap-2"
                disabled={pending || Boolean(data.phoneNumber)}
                onClick={() =>
                  run(async () => {
                    const r = await assignStoreClisteNumber(data.organizationId);
                    if (r.ok) setData({ ...data, phoneNumber: r.e164 });
                    return r;
                  })
                }
              >
                <Phone className="size-4" aria-hidden />
                Assign Irish number
              </Button>
            </div>
            <div className="space-y-1">
              <Label htmlFor="public-number">Store public number</Label>
              <Input
                id="public-number"
                className="font-mono"
                value={numbers.storePublicNumber}
                onChange={(e) =>
                  setNumbers({ ...numbers, storePublicNumber: e.target.value })
                }
                placeholder="+353 74 123 4567"
              />
              <p className="text-muted-foreground text-xs">
                The landline on the door — not the Cliste DID.
              </p>
            </div>
            <div className="space-y-2">
              {CALL_ROUTING_MODES.map((mode) => (
                <label
                  key={mode}
                  className={cn(
                    "flex cursor-pointer gap-2 rounded-lg border px-3 py-2",
                    numbers.callRoutingMode === mode && "border-gray-900 bg-gray-50",
                  )}
                >
                  <input
                    type="radio"
                    checked={numbers.callRoutingMode === mode}
                    onChange={() => setNumbers({ ...numbers, callRoutingMode: mode })}
                  />
                  <span>
                    <span className="block text-sm font-medium">
                      {CALL_ROUTING_MODE_META[mode].title}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {CALL_ROUTING_MODE_META[mode].tagline}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {CALL_ROUTING_MODE_META[numbers.callRoutingMode].allowsTransfer ? (
              <div className="space-y-1">
                <Label htmlFor="transfer-num">Transfer number</Label>
                <Input
                  id="transfer-num"
                  className="font-mono"
                  value={numbers.transferNumber}
                  onChange={(e) =>
                    setNumbers({ ...numbers, transferNumber: e.target.value })
                  }
                />
              </div>
            ) : null}
            <div className="space-y-1">
              <Label htmlFor="divert-carrier">Divert carrier</Label>
              <select
                id="divert-carrier"
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                value={numbers.divertCarrier}
                onChange={(e) =>
                  setNumbers({
                    ...numbers,
                    divertCarrier: e.target.value as DivertCarrier,
                  })
                }
              >
                {DIVERT_CARRIERS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium">Landline divert instructions</p>
              {divertInstructions.map((block) => (
                <div key={block.title} className="rounded-lg border px-3 py-2">
                  <p className="text-sm font-medium">{block.title}</p>
                  <ol className="text-muted-foreground mt-1 list-decimal pl-4 text-xs">
                    {block.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={pending}
                onClick={() =>
                  run(() =>
                    saveStoreNumbersDivert(data.organizationId, numbers).then((r) => {
                      if (r.ok) setData({ ...data, ...numbers, fallbackNumber: numbers.transferNumber, storePublicNumber: numbers.storePublicNumber, divertCarrier: numbers.divertCarrier });
                      return r;
                    }),
                  )
                }
              >
                Save numbers
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending || Boolean(data.divertVerifiedAt)}
                onClick={() =>
                  run(async () => {
                    const r = await markDivertVerified(data.organizationId);
                    if (r.ok) {
                      setData({
                        ...data,
                        divertVerifiedAt: new Date().toISOString(),
                      });
                    }
                    return r;
                  })
                }
              >
                {data.divertVerifiedAt ? (
                  <>
                    <CheckCircle2 className="mr-1 size-4 text-emerald-600" />
                    Divert verified
                  </>
                ) : (
                  "Mark divert verified"
                )}
              </Button>
            </div>
          </section>
        ) : null}

        {activeStep === "people" ? (
          <StoreContactsStep
            data={data}
            pending={pending}
            onRefresh={(contacts) => setData({ ...data, contacts })}
            run={run}
          />
        ) : null}

        {activeStep === "departments" ? (
          <StoreDepartmentsStep
            data={data}
            pending={pending}
            onRefresh={(departments) => setData({ ...data, departments })}
            run={run}
          />
        ) : null}

        {activeStep === "facts" ? (
          <section className="border-border bg-card space-y-4 rounded-xl border p-5 shadow-sm">
            <h2 className="text-lg font-semibold">5 · Store facts</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {RETAIL_FACILITIES.map((f) => (
                <label key={f.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={facts.retailFacilities.includes(f.id)}
                    onChange={(e) => {
                      setFacts({
                        ...facts,
                        retailFacilities: e.target.checked
                          ? [...facts.retailFacilities, f.id]
                          : facts.retailFacilities.filter((x) => x !== f.id),
                      });
                    }}
                  />
                  {f.label}
                </label>
              ))}
            </div>
            <div className="space-y-1">
              <Label>Click & collect URL</Label>
              <Input
                value={facts.clickCollectUrl}
                onChange={(e) =>
                  setFacts({ ...facts, clickCollectUrl: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Loyalty program</Label>
              <Input
                value={facts.loyaltyProgram}
                onChange={(e) =>
                  setFacts({ ...facts, loyaltyProgram: e.target.value })
                }
                placeholder="Real Rewards"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={facts.deliveryEnabled}
                onChange={(e) =>
                  setFacts({ ...facts, deliveryEnabled: e.target.checked })
                }
              />
              Store offers delivery
            </label>
            {facts.deliveryEnabled ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  placeholder="Delivery area"
                  value={facts.deliveryArea}
                  onChange={(e) =>
                    setFacts({ ...facts, deliveryArea: e.target.value })
                  }
                />
                <Input
                  placeholder="Cut-off time"
                  value={facts.deliveryCutOff}
                  onChange={(e) =>
                    setFacts({ ...facts, deliveryCutOff: e.target.value })
                  }
                />
                <Input
                  placeholder="Minimum spend"
                  value={facts.deliveryMinSpend}
                  onChange={(e) =>
                    setFacts({ ...facts, deliveryMinSpend: e.target.value })
                  }
                />
              </div>
            ) : null}
            <div className="bg-muted/50 rounded-lg px-3 py-2 text-xs">
              <p className="font-medium">Hard rules (always on for retail)</p>
              <ul className="text-muted-foreground mt-1 list-disc pl-4">
                <li>Never confirm live stock</li>
                <li>Never quote prices unless enabled below</li>
                <li>Never take payment or card details</li>
              </ul>
              <label className="mt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={facts.quotePricesOnCalls}
                  onChange={(e) =>
                    setFacts({ ...facts, quotePricesOnCalls: e.target.checked })
                  }
                />
                Allow price quotes on calls
              </label>
            </div>
            <Button
              disabled={pending}
              onClick={() =>
                run(() =>
                  saveStoreFacts(data.organizationId, {
                    retailFacilities: facts.retailFacilities,
                    retailDelivery: {
                      enabled: facts.deliveryEnabled,
                      area: facts.deliveryArea,
                      cut_off: facts.deliveryCutOff,
                      min_spend: facts.deliveryMinSpend,
                    },
                    retailClickCollectUrl: facts.clickCollectUrl,
                    retailLoyaltyProgram: facts.loyaltyProgram,
                    quotePricesOnCalls: facts.quotePricesOnCalls,
                  }),
                )
              }
            >
              Save store facts
            </Button>
          </section>
        ) : null}

        {activeStep === "hours" ? (
          <section className="border-border bg-card space-y-4 rounded-xl border p-5 shadow-sm">
            <h2 className="text-lg font-semibold">6 · Opening hours</h2>
            <OpeningHoursEditor
              value={hours.schedule}
              onChange={(schedule) => setHours({ ...hours, schedule })}
              open24_7={hours.open24_7}
              onOpen24_7Change={(open24_7) => setHours({ ...hours, open24_7 })}
              bankHolidays={hours.bankHolidays}
              onBankHolidaysChange={(bankHolidays) =>
                setHours({ ...hours, bankHolidays })
              }
              hoursNeverConfigured={hours.hoursNeverConfigured}
              variant="dashboard"
              embedded
            />
            <Button
              disabled={pending}
              onClick={() =>
                run(() =>
                  saveStoreOpeningHours(data.organizationId, {
                    schedule: hours.schedule,
                    open24_7: hours.open24_7,
                    bankHolidays: hours.bankHolidays,
                  }),
                )
              }
            >
              Save opening hours
            </Button>
          </section>
        ) : null}

        {activeStep === "call_flow" ? (
          <section className="border-border bg-card space-y-4 rounded-xl border p-5 shadow-sm">
            <h2 className="text-lg font-semibold">7 · Call flow</h2>
            <p className="text-muted-foreground text-sm">
              Department transfer routes sync from step 4. Seed the retail route pack
              for hours, directions, stock enquiries, complaints, and fallback.
            </p>
            <p className="text-sm">
              Active routes:{" "}
              {Array.isArray(data.routingLinks) ? data.routingLinks.length : 0}
            </p>
            <ul className="text-muted-foreground max-h-48 overflow-y-auto text-xs">
              {data.departments
                .filter((d) => d.active)
                .map((d) => (
                  <li key={d.id}>
                    Transfer: {d.name} → {d.phone_e164 || "fallback number"}
                  </li>
                ))}
            </ul>
            <Button
              disabled={pending}
              onClick={() => run(() => seedRetailRoutePack(data.organizationId))}
            >
              Seed / refresh retail route pack
            </Button>
          </section>
        ) : null}

        {activeStep === "greeting" ? (
          <section className="border-border bg-card space-y-4 rounded-xl border p-5 shadow-sm">
            <h2 className="text-lg font-semibold">8 · Greeting & voice</h2>
            <div className="space-y-1">
              <Label>Intro</Label>
              <Input value={greetingIntro} onChange={(e) => setGreetingIntro(e.target.value)} />
            </div>
            <div className="bg-muted/50 rounded-lg px-3 py-2 text-sm">
              {voiceLegalDisclosure(assistantName)}
              <p className="text-muted-foreground mt-1 text-xs">{VOICE_LEGAL_NOTICE_HINT}</p>
            </div>
            <div className="space-y-1">
              <Label>Closing</Label>
              <Input
                value={greetingClosing}
                onChange={(e) => setGreetingClosing(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Assistant name</Label>
              <Input
                value={assistantName}
                onChange={(e) => setAssistantName(e.target.value)}
              />
            </div>
            <Button
              disabled={pending}
              onClick={() =>
                run(() =>
                  saveStoreGreeting(data.organizationId, {
                    businessName: data.name,
                    greetingIntro,
                    greetingClosing,
                    assistantDisplayName: assistantName,
                    agentVoiceId: data.agentVoiceId,
                  }),
                )
              }
            >
              Save greeting
            </Button>
          </section>
        ) : null}

        {activeStep === "prompt" ? (
          <section className="border-border bg-card space-y-4 rounded-xl border p-5 shadow-sm">
            <h2 className="text-lg font-semibold">9 · Prompt</h2>
            {data.promptCompileWarnings.length > 0 ? (
              <ul className="text-sm text-amber-700">
                {data.promptCompileWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-emerald-700">No compile warnings.</p>
            )}
            <pre className="bg-muted max-h-64 overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
              {data.customPrompt || "— not compiled yet —"}
            </pre>
            <Button
              disabled={pending}
              onClick={() => run(() => recompileStorePrompt(data.organizationId))}
            >
              Recompile prompt
            </Button>
          </section>
        ) : null}

        {activeStep === "go_live" ? (
          <section className="border-border bg-card space-y-4 rounded-xl border p-5 shadow-sm">
            <h2 className="text-lg font-semibold">10 · Go-live</h2>
            <p className="text-muted-foreground text-sm">
              All setup steps must be complete before activating the store.
            </p>
            <ul className="space-y-1 text-sm">
              {readiness
                .filter((s) => s.id !== "go_live" && s.id !== "diagnostics")
                .map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        s.complete ? "bg-emerald-600" : "bg-amber-500",
                      )}
                    />
                    {s.label}
                  </li>
                ))}
            </ul>
            <Button
              disabled={
                pending ||
                !allGoLiveStepsComplete(readiness) ||
                data.isActive
              }
              onClick={() => run(() => activateRetailStore(data.organizationId))}
            >
              {data.isActive ? "Store is live" : "Activate store"}
            </Button>
          </section>
        ) : null}

        {activeStep === "diagnostics" ? (
          <StoreDiagnosticsStep organizationId={data.organizationId} />
        ) : null}

        {message ? (
          <p
            className={cn(
              "text-sm",
              message === "Saved." ? "text-emerald-700" : "text-destructive",
            )}
          >
            {message}
          </p>
        ) : null}
      </div>

      <ReadinessRail
        steps={readiness}
        activeStep={activeStep}
        onSelect={setActiveStep}
      />
    </div>
  );
}

function StoreContactsStep({
  data,
  pending,
  onRefresh,
  run,
}: {
  data: AdminStoreSetupData;
  pending: boolean;
  onRefresh: (contacts: AdminStoreSetupData["contacts"]) => void;
  run: (action: () => Promise<{ ok: boolean; message?: string }>) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    role: "store_manager" as StoreContactRole,
    phoneE164: "",
    email: "",
    isNotificationTarget: true,
    canReceiveTransfers: false,
  });

  return (
    <section className="border-border bg-card space-y-4 rounded-xl border p-5 shadow-sm">
      <h2 className="text-lg font-semibold">3 · People</h2>
      <ul className="divide-y text-sm">
        {data.contacts.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-2">
            <span>
              {c.name} · {c.role.replace("_", " ")}
              {c.is_notification_target ? " · alerts" : ""}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const r = await deleteStoreContact(data.organizationId, c.id);
                  if (r.ok) onRefresh(data.contacts.filter((x) => x.id !== c.id));
                  return r;
                })
              }
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <select
          className="border-input h-9 rounded-md border px-2 text-sm"
          value={form.role}
          onChange={(e) =>
            setForm({ ...form, role: e.target.value as StoreContactRole })
          }
        >
          {STORE_CONTACT_ROLES.map((r) => (
            <option key={r} value={r}>
              {r.replace("_", " ")}
            </option>
          ))}
        </select>
        <Input
          placeholder="Phone E.164"
          value={form.phoneE164}
          onChange={(e) => setForm({ ...form, phoneE164: e.target.value })}
        />
        <Input
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.isNotificationTarget}
          onChange={(e) =>
            setForm({ ...form, isNotificationTarget: e.target.checked })
          }
        />
        Notification target
      </label>
      <Button
        disabled={pending || !form.name.trim()}
        onClick={() =>
          run(async () => {
            const r = await saveStoreContact(data.organizationId, {
              ...form,
              active: true,
            });
            if (r.ok) {
              onRefresh([
                ...data.contacts,
                {
                  id: crypto.randomUUID(),
                  organization_id: data.organizationId,
                  department_id: null,
                  ...form,
                  phone_e164: form.phoneE164,
                  is_notification_target: form.isNotificationTarget,
                  can_receive_transfers: form.canReceiveTransfers,
                  active: true,
                },
              ]);
              setForm({
                name: "",
                role: "duty_manager",
                phoneE164: "",
                email: "",
                isNotificationTarget: true,
                canReceiveTransfers: false,
              });
            }
            return r;
          })
        }
      >
        Add contact
      </Button>
    </section>
  );
}

function StoreDepartmentsStep({
  data,
  pending,
  onRefresh,
  run,
}: {
  data: AdminStoreSetupData;
  pending: boolean;
  onRefresh: (departments: AdminStoreSetupData["departments"]) => void;
  run: (action: () => Promise<{ ok: boolean; message?: string }>) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  return (
    <section className="border-border bg-card space-y-4 rounded-xl border p-5 shadow-sm">
      <h2 className="text-lg font-semibold">4 · Departments</h2>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => run(() => seedSupervaluDepartments(data.organizationId))}
      >
        Add common SuperValu departments
      </Button>
      <ul className="divide-y text-sm">
        {data.departments.map((d) => (
          <li key={d.id} className="py-2">
            {d.name} {d.phone_e164 ? `· ${d.phone_e164}` : ""}
            {!d.transfer_enabled ? " · transfer off" : ""}
          </li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          placeholder="Department name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="Phone / extension"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <Button
        disabled={pending || !name.trim()}
        onClick={() =>
          run(async () => {
            const r = await saveStoreDepartment(data.organizationId, {
              name,
              phoneE164: phone,
              transferEnabled: true,
              caraNote: "",
              sortOrder: data.departments.length,
              active: true,
            });
            if (r.ok) {
              onRefresh([
                ...data.departments,
                {
                  id: crypto.randomUUID(),
                  organization_id: data.organizationId,
                  name,
                  phone_e164: phone || null,
                  hours: null,
                  transfer_enabled: true,
                  cara_note: null,
                  sort_order: data.departments.length,
                  active: true,
                },
              ]);
              setName("");
              setPhone("");
            }
            return r;
          })
        }
      >
        Add department
      </Button>
    </section>
  );
}

function StoreDiagnosticsStep({ organizationId }: { organizationId: string }) {
  return (
    <section className="border-border bg-card space-y-4 rounded-xl border p-5 shadow-sm">
      <h2 className="text-lg font-semibold">11 · Diagnostics</h2>
      <p className="text-muted-foreground text-sm">
        Recent calls, pipeline incidents, and webhook health for org{" "}
        <code className="text-xs">{organizationId}</code>. Use the tenant dashboard
        Calls page for full history after go-live.
      </p>
    </section>
  );
}
