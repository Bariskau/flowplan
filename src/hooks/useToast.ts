import { useState, useCallback, useEffect, useRef } from "react";
import useEscapeClose from "./useEscapeClose";

export interface Toast {
  text: string;
  file: string;
  error?: boolean;
}

export interface Dialog {
  title: string;
  message: string;
}

export function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEscapeClose(() => setDialog(null), !!dialog);

  const showToast = useCallback((text: string, file: string, error = false) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setToast({ text, file, error });
    timeoutRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const showCollabDialog = useCallback((title: string, message: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setToast(null);
    setDialog({ title, message });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);
  const dismissDialog = useCallback(() => setDialog(null), []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.title || detail?.message) setDialog(detail);
    };
    window.addEventListener("fp-dialog", handler);
    return () => window.removeEventListener("fp-dialog", handler);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { toast, dialog, showToast, showCollabDialog, dismissToast, dismissDialog };
}
