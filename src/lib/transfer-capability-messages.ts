import type { TransferBlocker } from "@/lib/transfer-capability";

export type TransferVerdictTone = "green" | "amber" | "grey";

export type TransferVerdict = {
  tone: TransferVerdictTone;
  headline: string;
  detail: string;
  showRunTest: boolean;
};

const BLOCKER_FIX: Record<TransferBlocker, string> = {
  routing_mode_would_loop:
    "This store forwards its main line to Cara, so transferring back would loop the caller. Either publish the Cliste number as the main line, or get direct-dial numbers per department from the store's trunk provider.",
  no_transfer_method:
    "Set a transfer method (SIP REFER recommended) once the PBX and Cliste trunk are ready.",
  hardware_not_go:
    "Warm-transfer hardware must be marked go before Cara can offer live transfers.",
  no_ddi_for_department:
    "Add a direct-dial number for each department that should receive transferred calls.",
  not_verified:
    "Run a test transfer and confirm the correct handset rings before going live.",
  ddi_range_unknown:
    "Answer whether departments can be dialled directly from outside the shop.",
  no_ddi_range:
    "This site has internal extensions only — configure message-taking per department. Ask the installer about adding DDIs.",
};

export function blockerFixMessage(blocker: TransferBlocker): string {
  return BLOCKER_FIX[blocker];
}

export function buildTransferVerdict(input: {
  canTransfer: boolean;
  blockers: TransferBlocker[];
  transferVerifiedAt: string | null;
  transferVerificationPending: boolean;
}): TransferVerdict {
  const verifiedAt = input.transferVerifiedAt;
  const verifiedDate = verifiedAt
    ? new Date(verifiedAt).toLocaleDateString("en-IE", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  if (input.canTransfer && verifiedDate) {
    return {
      tone: "green",
      headline: `Cara can put callers through. Verified ${verifiedDate}.`,
      detail: "Transfers are enabled for departments with a direct-dial number.",
      showRunTest: false,
    };
  }

  const onlyNotVerified =
    input.blockers.length === 1 && input.blockers[0] === "not_verified";
  const capableExceptVerification =
    onlyNotVerified ||
    (input.blockers.length === 0 && !verifiedAt);

  if (capableExceptVerification) {
    return {
      tone: "amber",
      headline: "Cara will take messages. Transfer is possible on this setup but hasn't been tested yet.",
      detail: BLOCKER_FIX.not_verified,
      showRunTest: true,
    };
  }

  if (input.transferVerificationPending) {
    return {
      tone: "amber",
      headline: "Test transfer in progress.",
      detail: "Place a call, ask for a department, and confirm the handset rings. Verification completes automatically when the worker reports a successful connect.",
      showRunTest: false,
    };
  }

  const primary = input.blockers[0] ?? "not_verified";
  return {
    tone: "grey",
    headline: "Cara will take messages.",
    detail: BLOCKER_FIX[primary],
    showRunTest: false,
  };
}

export function buildInstallerEmailBody(input: {
  storeName: string;
  departments: { name: string; extension: string | null }[];
  installerName?: string | null;
}): string {
  const deptLines = input.departments
    .map((d) => {
      const ext = d.extension?.trim() ? ` (extension ${d.extension.trim()})` : "";
      return `- ${d.name}${ext}`;
    })
    .join("\n");

  return `Hi${input.installerName ? ` ${input.installerName.trim()}` : ""},

We are setting up phone transfers for ${input.storeName} through Cara (Cliste).

Could you confirm:
1. Does this site have a DDI range with direct-dial numbers per department, or internal extensions only?
2. If DDIs exist — please list each department and its direct-dial E.164 number.
3. If extensions only — can your trunk provider add DDIs, and at what cost?

Departments we need numbers for:
${deptLines || "(none listed yet)"}

Thank you.`;
}
