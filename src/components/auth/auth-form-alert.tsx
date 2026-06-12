"use client";

import { AlertCircle } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { AUTH_FORM_ALERT } from "@/components/auth/auth-ui";
import { cn } from "@/lib/utils";

type Props = {
  message: string | null | undefined;
  className?: string;
};

/** Fast, branded inline alert — avoids OnboardingEnter stagger on submit errors. */
export function AuthFormAlert({ message, className }: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait">
      {message ? (
        <motion.div
          key="auth-form-alert"
          role="alert"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className={cn(AUTH_FORM_ALERT, className)}
        >
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
            aria-hidden
          />
          <p>{message}</p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
