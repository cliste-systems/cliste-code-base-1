"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import type { BusinessFileListItem } from "@/lib/business-files";

import { saveRoutingLinks } from "./actions";
import type { RoutingCaraContext } from "./routing-cara-context";
import {
  ensureAccountRoutes,
  serializeRoutes,
  validateRoutes,
  type SavedRoute,
} from "./route-models";
import type { RoutingSetupContext } from "./routing-setup-context";

type RoutingFormContextValue = {
  routes: SavedRoute[];
  setRoutes: (routes: SavedRoute[]) => void;
  sendableFiles: BusinessFileListItem[];
  caraContext: RoutingCaraContext;
  setupContext: RoutingSetupContext;
  isDirty: boolean;
  pending: boolean;
  status: { kind: "ok" | "error"; message: string } | null;
  save: () => void;
  saveAsync: () => Promise<boolean>;
  discardChanges: () => void;
  updateTransferNumber: (number: string) => void;
};

const RoutingFormContext = createContext<RoutingFormContextValue | null>(null);

function routesKey(routes: SavedRoute[]): string {
  return JSON.stringify(serializeRoutes(ensureAccountRoutes(routes)));
}

export function RoutingFormProvider({
  initialRoutes,
  sendableFiles,
  caraContext,
  setupContext,
  children,
}: {
  initialRoutes: SavedRoute[];
  sendableFiles: BusinessFileListItem[];
  caraContext: RoutingCaraContext;
  setupContext: RoutingSetupContext;
  children: ReactNode;
}) {
  const [routes, setRoutesState] = useState(() =>
    ensureAccountRoutes(initialRoutes),
  );
  const baselineRef = useRef(routesKey(initialRoutes));
  const initialRoutesRef = useRef(ensureAccountRoutes(initialRoutes));
  const [setup, setSetup] = useState(setupContext);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{
    kind: "ok" | "error";
    message: string;
  } | null>(null);

  const isDirty = useMemo(
    () => routesKey(routes) !== baselineRef.current,
    [routes],
  );

  const setRoutes = useCallback((next: SavedRoute[]) => {
    setRoutesState(ensureAccountRoutes(next));
  }, []);

  const saveAsync = useCallback(async (): Promise<boolean> => {
    const normalized = ensureAccountRoutes(routes);
    const err = validateRoutes(normalized, {
      transferNumber: setup.transferNumber,
    });
    if (err) {
      setStatus({ kind: "error", message: err });
      return false;
    }
    setStatus(null);
    const payload = serializeRoutes(normalized);
    const res = await saveRoutingLinks(payload);
    if (res.ok) {
      baselineRef.current = routesKey(normalized);
      setStatus({
        kind: "ok",
        message: "Call flow saved — Cara will use this on live calls.",
      });
      return true;
    }
    setStatus({ kind: "error", message: res.message });
    return false;
  }, [routes, setup.transferNumber]);

  const save = useCallback(() => {
    startTransition(async () => {
      await saveAsync();
    });
  }, [saveAsync]);

  const discardChanges = useCallback(() => {
    setRoutesState(initialRoutesRef.current);
    setSetup(setupContext);
    setStatus(null);
  }, [setupContext]);

  const updateTransferNumber = useCallback((number: string) => {
    setSetup((prev) => ({
      ...prev,
      transferNumber: number,
      transferAllowed: Boolean(number.trim()),
    }));
  }, []);

  const value = useMemo(
    (): RoutingFormContextValue => ({
      routes,
      setRoutes,
      sendableFiles,
      caraContext,
      setupContext: setup,
      isDirty,
      pending,
      status,
      save,
      saveAsync,
      discardChanges,
      updateTransferNumber,
    }),
    [
      routes,
      setRoutes,
      sendableFiles,
      caraContext,
      setup,
      isDirty,
      pending,
      status,
      save,
      saveAsync,
      discardChanges,
      updateTransferNumber,
    ],
  );

  return (
    <RoutingFormContext.Provider value={value}>
      {children}
    </RoutingFormContext.Provider>
  );
}

export function useRoutingForm(): RoutingFormContextValue {
  const ctx = useContext(RoutingFormContext);
  if (!ctx) {
    throw new Error("useRoutingForm must be used within RoutingFormProvider");
  }
  return ctx;
}
