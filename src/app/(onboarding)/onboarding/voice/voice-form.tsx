"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  startTransition,
  type FormEvent,
} from "react";
import { ArrowRight, Loader2, Lock, Pause, Play } from "lucide-react";

import { OnboardingEnter } from "@/components/onboarding/onboarding-enter";
import {
  OnboardingFieldBox,
  OnboardingFormCard,
} from "@/components/onboarding/onboarding-form-card";
import { OnboardingPrimaryButton } from "@/components/onboarding/onboarding-primary-button";
import { OnboardingVoiceSuggestionDialog } from "@/components/onboarding/onboarding-voice-suggestion-dialog";
import {
  ONBOARDING_FIELD_ERROR,
  ONBOARDING_FIELD_HINT,
  ONBOARDING_FIELD_INPUT,
  ONBOARDING_FIELD_LABEL,
  ONBOARDING_PROFILE_FIELD_BOX_LOCKED,
  ONBOARDING_PROFILE_FIELD_BOX_PREVIEW,
} from "@/components/onboarding/onboarding-ui";
import {
  DEFAULT_GREETING_CLOSING,
  defaultVoiceGreetingIntro,
  parseGreetingParts,
  resolveVoiceGreetingPreview,
  VOICE_ASSISTANT_DEFAULT_NAME,
  voiceLegalDisclosure,
  VOICE_LEGAL_NOTICE_HINT,
} from "@/lib/voice-greeting";
import { cn } from "@/lib/utils";

import { speakVoicePreview } from "@/components/onboarding/onboarding-voice-preview";
import {
  reviewVoiceGreetingStep,
  saveVoiceStep,
  validateVoiceGreetingPreviewStep,
  type ReviewVoiceGreetingResult,
  type SaveVoicePayload,
  type SaveVoiceResult,
} from "../actions";

const INITIAL: SaveVoiceResult = { ok: false, message: "" };

type FieldKey = "greetingIntro" | "greetingClosing";
type FieldErrors = Partial<Record<FieldKey, string>>;

type Props = {
  businessName: string;
  defaultGreeting: string;
};

let activeAudio: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;

function stopVoicePreview() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio = null;
  }
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
}

function validateVoicePayload(payload: SaveVoicePayload): FieldErrors {
  const errors: FieldErrors = {};
  const intro = payload.greetingIntro.trim();
  const closing = payload.greetingClosing.trim();

  if (!intro) {
    errors.greetingIntro = "Add an opening line";
  } else if (intro.length > 200) {
    errors.greetingIntro = "Keep the opening line under 200 characters";
  }

  if (closing.length > 200) {
    errors.greetingClosing = "Keep the closing line under 200 characters";
  }

  return errors;
}

export function VoiceForm({ businessName, defaultGreeting }: Props) {
  const assistantDisplayName = VOICE_ASSISTANT_DEFAULT_NAME;
  const defaultIntro = defaultVoiceGreetingIntro(businessName);
  const parsed = parseGreetingParts(
    defaultGreeting,
    assistantDisplayName,
    defaultIntro,
  );
  const legal = voiceLegalDisclosure(assistantDisplayName);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [greetingIntro, setGreetingIntro] = useState(parsed.intro);
  const [greetingClosing, setGreetingClosing] = useState(parsed.closing);
  const [playing, setPlaying] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [suggestion, setSuggestion] = useState<Extract<
    ReviewVoiceGreetingResult,
    { status: "suggestions" }
  > | null>(null);
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const pendingPayloadRef = useRef<SaveVoicePayload | null>(null);
  const playRequestRef = useRef(0);
  const [state, formAction, pending] = useActionState(saveVoiceStep, INITIAL);
  const lastStateRef = useRef(state);

  const previewLine = resolveVoiceGreetingPreview(
    greetingIntro,
    assistantDisplayName,
    greetingClosing,
  );

  const formLevelError =
    submitError ||
    (!state.ok &&
    state.message &&
    !fieldErrors.greetingIntro &&
    !fieldErrors.greetingClosing
      ? state.message
      : null);

  const continuePending = reviewing || pending;

  useEffect(() => {
    return () => stopVoicePreview();
  }, []);

  useEffect(() => {
    if (lastStateRef.current === state) return;
    lastStateRef.current = state;

    if (!state.ok && state.message) {
      const message = state.message.toLowerCase();
      // Surface the server-action error against the field it belongs to.
      if (message.includes("opening") || message.includes("intro")) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFieldErrors((current) => ({
          ...current,
          greetingIntro: state.message!,
        }));
      } else if (message.includes("greeting") || message.includes("closing")) {
        setFieldErrors((current) => ({
          ...current,
          greetingClosing: state.message!,
        }));
      }
    }
  }, [state]);

  function clearGreetingErrors() {
    playRequestRef.current += 1;
    stopVoicePreview();
    setPlaying(false);
    setPreviewLoading(false);
    setFieldErrors({});
    setPreviewError(null);
    setSubmitError(null);
  }

  function savePayload(payload: SaveVoicePayload) {
    startTransition(() => {
      formAction(payload);
    });
  }

  async function handlePlayToggle() {
    if (playing || previewLoading) {
      stopVoicePreview();
      setPlaying(false);
      setPreviewLoading(false);
      return;
    }

    const payload: SaveVoicePayload = {
      greetingIntro: greetingIntro.trim(),
      greetingClosing: greetingClosing.trim(),
    };

    const formatErrors = validateVoicePayload(payload);
    if (Object.keys(formatErrors).length > 0) {
      setFieldErrors(formatErrors);
      return;
    }

    const requestId = ++playRequestRef.current;
    setPreviewError(null);
    setPreviewLoading(true);

    const check = await validateVoiceGreetingPreviewStep(payload);
    if (requestId !== playRequestRef.current) return;

    if (!check.ok) {
      setPreviewLoading(false);
      setPreviewError(check.message);
      setFieldErrors((current) => ({
        ...current,
        ...(check.introIssue ? { greetingIntro: check.message } : {}),
        ...(check.closingIssue ? { greetingClosing: check.message } : {}),
      }));
      return;
    }

    const result = await speakVoicePreview(previewLine, payload);
    if (requestId !== playRequestRef.current) return;

    setPreviewLoading(false);

    if (!result.ok) {
      setPreviewError(result.message);
      if (
        result.message.includes("offensive") ||
        result.message.includes("inappropriate") ||
        result.message.includes("legal notice is added") ||
        result.message.includes("just the greeting")
      ) {
        setFieldErrors((current) => ({
          ...current,
          ...(result.introIssue ? { greetingIntro: result.message } : {}),
          ...(result.closingIssue ? { greetingClosing: result.message } : {}),
          ...(!result.introIssue && !result.closingIssue
            ? { greetingClosing: result.message }
            : {}),
        }));
      }
      return;
    }

    setPlaying(true);
    const audio = activeAudio;
    if (!audio) return;

    audio.onended = () => setPlaying(false);
    audio.onerror = () => {
      setPlaying(false);
      setPreviewError("Voice preview failed.");
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: SaveVoicePayload = {
      greetingIntro: greetingIntro.trim(),
      greetingClosing: greetingClosing.trim(),
    };

    const errors = validateVoicePayload(payload);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmitError(null);
    setPreviewError(null);
    setReviewing(true);

    const review = await reviewVoiceGreetingStep(payload);
    setReviewing(false);

    if (!review.ok) {
      setFieldErrors({
        ...(review.introIssue ? { greetingIntro: review.message } : {}),
        ...(review.closingIssue ? { greetingClosing: review.message } : {}),
      });
      if (!review.introIssue && !review.closingIssue) {
        setSubmitError(review.message);
      }
      return;
    }

    if (review.status === "suggestions") {
      pendingPayloadRef.current = payload;
      setSuggestion(review);
      setSuggestionOpen(true);
      return;
    }

    savePayload(payload);
  }

  function handleKeepOriginal() {
    const payload = pendingPayloadRef.current;
    setSuggestionOpen(false);
    setSuggestion(null);
    if (payload) {
      savePayload(payload);
    }
  }

  function handleAcceptSuggestion() {
    if (!suggestion) return;

    const nextIntro = suggestion.greetingIntro ?? greetingIntro.trim();
    const nextClosing = suggestion.greetingClosing ?? greetingClosing.trim();
    const payload: SaveVoicePayload = {
      greetingIntro: nextIntro,
      greetingClosing: nextClosing,
    };

    setGreetingIntro(nextIntro);
    setGreetingClosing(nextClosing);
    setSuggestionOpen(false);
    setSuggestion(null);
    savePayload(payload);
  }

  return (
    <>
      <OnboardingFormCard
        fieldSurface="profile"
        noValidate
        onSubmit={handleSubmit}
        error={formLevelError}
        footer={
          <OnboardingPrimaryButton
            type="submit"
            pending={continuePending}
            className="min-w-[200px]"
          >
            {pending ? "Saving…" : reviewing ? "Checking…" : "Continue"}
            {!continuePending ? (
              <ArrowRight className="size-4" aria-hidden />
            ) : (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            )}
          </OnboardingPrimaryButton>
        }
      >
        <OnboardingFieldBox
          label="Opening line"
          htmlFor="greetingIntro"
          error={fieldErrors.greetingIntro}
        >
          <p className={ONBOARDING_FIELD_HINT}>You can edit this</p>
          <input
            id="greetingIntro"
            name="greetingIntro"
            type="text"
            value={greetingIntro}
            placeholder={defaultIntro}
            aria-invalid={Boolean(fieldErrors.greetingIntro)}
            className={ONBOARDING_FIELD_INPUT}
          onChange={(event) => {
            setGreetingIntro(event.target.value);
            clearGreetingErrors();
          }}
          />
        </OnboardingFieldBox>

        <OnboardingEnter tone="profile">
          <div className={ONBOARDING_PROFILE_FIELD_BOX_LOCKED}>
            <div className="flex items-center gap-1.5">
              <Lock className="size-3 text-slate-400" aria-hidden />
              <p className={ONBOARDING_FIELD_LABEL}>Required notice</p>
            </div>
            <p className={ONBOARDING_FIELD_HINT}>{VOICE_LEGAL_NOTICE_HINT}</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">
              {legal}
            </p>
          </div>
        </OnboardingEnter>

        <OnboardingFieldBox
          label="Closing line"
          htmlFor="greetingClosing"
          error={fieldErrors.greetingClosing}
        >
          <p className={ONBOARDING_FIELD_HINT}>You can edit this</p>
          <input
            id="greetingClosing"
            name="greetingClosing"
            type="text"
            value={greetingClosing}
            placeholder={DEFAULT_GREETING_CLOSING}
            aria-invalid={Boolean(fieldErrors.greetingClosing)}
            className={ONBOARDING_FIELD_INPUT}
          onChange={(event) => {
            setGreetingClosing(event.target.value);
            clearGreetingErrors();
          }}
          />
        </OnboardingFieldBox>

        <OnboardingEnter tone="profile">
          <div className={ONBOARDING_PROFILE_FIELD_BOX_PREVIEW}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <p className={ONBOARDING_FIELD_LABEL}>Listen to Cara</p>
                <p className="text-[15px] leading-relaxed text-[#0b1220]">
                  {greetingIntro.trim() || defaultIntro}
                </p>
                <p className="border-l-2 border-slate-300/80 pl-2.5 text-[14px] leading-relaxed text-slate-500">
                  {legal}
                </p>
                <p className="text-[15px] leading-relaxed text-[#0b1220]">
                  {greetingClosing.trim() || DEFAULT_GREETING_CLOSING}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handlePlayToggle()}
                disabled={previewLoading}
                className={cn(
                  "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full",
                  "bg-[#0b1220] text-white shadow-[0_4px_16px_rgba(11,18,32,0.2)] transition-colors",
                  "hover:bg-[#05070b] disabled:cursor-not-allowed disabled:opacity-60",
                )}
                aria-label={playing ? "Stop voice preview" : "Play voice preview"}
              >
                {previewLoading ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : playing ? (
                  <Pause className="size-4" aria-hidden />
                ) : (
                  <Play className="ml-0.5 size-4" aria-hidden />
                )}
              </button>
            </div>
            {previewError ? (
              <p className={cn(ONBOARDING_FIELD_ERROR, "mt-2")} role="alert">
                {previewError}
              </p>
            ) : null}
          </div>
        </OnboardingEnter>
      </OnboardingFormCard>

      {suggestion ? (
        <OnboardingVoiceSuggestionDialog
          open={suggestionOpen}
          summary={suggestion.summary}
          introCurrent={greetingIntro.trim()}
          introSuggested={suggestion.greetingIntro}
          closingCurrent={greetingClosing.trim()}
          closingSuggested={suggestion.greetingClosing}
          pending={pending}
          onAccept={handleAcceptSuggestion}
          onKeep={handleKeepOriginal}
        />
      ) : null}
    </>
  );
}
