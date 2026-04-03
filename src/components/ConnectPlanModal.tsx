import { useMemo, useState } from "react";
import { Check, Copy, LinkSimple, PlugsConnected, Sparkle, X } from "@phosphor-icons/react";
import type { CollabSession, ConnectPlanDraft, Plan } from "../types";
import {
  loadConnectionDefaults,
  makeJoinSecret,
  makeRoomId,
  normalizeCollabServerUrl,
  validateCollabServerUrl,
} from "../lib/collab";
import useEscapeClose from "../hooks/useEscapeClose";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import SegmentedControl from "./ui/SegmentedControl";

interface ConnectPlanModalProps {
  plan: Plan | null;
  session: CollabSession | null;
  onClose: () => void;
  onConnect: (draft: ConnectPlanDraft) => void;
  busy?: boolean;
}

function buildInitialDraft(plan: Plan | null, session: CollabSession | null): ConnectPlanDraft {
  const defaults = loadConnectionDefaults();
  const rememberedJoinRoomId = defaults.lastJoinRoomId?.trim() || "flowplan-room";
  const rememberedJoinSecret = defaults.lastJoinSecret?.trim() || "";
  if (session) {
    return {
      mode: session.status === "hosting" ? "host" : "join",
      serverUrl: normalizeCollabServerUrl(session.serverUrl),
      iceServers: session.iceServers.map((server) => {
        const urls = Array.isArray(server.urls) ? server.urls.join(",") : server.urls;
        return [urls, server.username, server.credential].filter(Boolean).join("|");
      }).join("\n") || defaults.iceServers,
      roomId: session.roomId,
      joinSecret: session.joinSecret || "",
    };
  }
  return {
    mode: plan ? "host" : "join",
    serverUrl: defaults.serverUrl,
    iceServers: defaults.iceServers,
    roomId: plan ? makeRoomId(plan.title) : rememberedJoinRoomId,
    joinSecret: plan ? makeJoinSecret() : rememberedJoinSecret,
  };
}

export default function ConnectPlanModal({
  plan,
  session,
  onClose,
  onConnect,
  busy = false,
}: ConnectPlanModalProps) {
  const [draft, setDraft] = useState<ConnectPlanDraft>(() => buildInitialDraft(plan, session));
  const [copiedField, setCopiedField] = useState<"room" | "secret" | null>(null);
  const rememberedJoinValues = useMemo(() => {
    const defaults = loadConnectionDefaults();
    return {
      roomId: defaults.lastJoinRoomId?.trim() || "flowplan-room",
      joinSecret: defaults.lastJoinSecret?.trim() || "",
    };
  }, []);
  const serverError = useMemo(() => (draft.serverUrl.trim() ? validateCollabServerUrl(draft.serverUrl) : null), [draft.serverUrl]);
  const serverConfigured = !!draft.serverUrl.trim() && !serverError;
  const missingServerHint = serverError ?? "Set the collaboration server endpoint in Settings first.";

  useEscapeClose(onClose);

  const sessionForPlan = session;
  const actionLabel =
    draft.mode === "host"
      ? plan
        ? "Start host session"
        : "Select a plan to host"
      : "Join session";
  const statusCopy = useMemo(() => {
    if (!sessionForPlan) return "No live session for this plan yet.";
    return sessionForPlan.status === "hosting"
      ? `Hosting ${sessionForPlan.roomId}`
      : `Joined ${sessionForPlan.roomId}`;
  }, [sessionForPlan]);

  const copyField = async (field: "room" | "secret", value: string) => {
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1400);
    } catch {}
  };

  const submit = () => {
    const nextDraft = {
      ...draft,
      iceServers: draft.iceServers,
      roomId: draft.roomId.trim(),
      joinSecret: draft.joinSecret.trim(),
    };
    if (!nextDraft.roomId || !nextDraft.joinSecret) return;

    onConnect(nextDraft);
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[1000] flex items-center justify-center animate-modal-overlay"
      onClick={onClose}
    >
      <div
        className="relative w-[440px] max-h-[84vh] flex flex-col animate-modal-in rounded-xl overflow-hidden border border-white/[0.08] bg-[rgba(32,33,36,0.95)]"
        onClick={(e) => e.stopPropagation()}
      >
        <IconButton
          variant="ghost"
          size="sm"
          icon={<X size={14} />}
          label="Close"
          onClick={onClose}
          className="absolute right-3 top-3 z-10"
        />

        <div className="px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/[0.05] border border-white/[0.06] flex items-center justify-center text-white/64">
              <PlugsConnected size={16} weight="duotone" />
            </div>
            <div>
              <h1 className="text-[16px] font-semibold text-fp-text tracking-[-0.02em]">Connect Plan</h1>
              <p className="text-[12px] text-white/36 mt-0.5">
                {plan ? plan.title : "Join a remote room or select a local plan to host"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex flex-col gap-5 pb-1">
            <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.025] px-4 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.12em] text-white/28 font-mono">Session status</div>
                  <div className="mt-1 text-[13px] font-medium text-white/78">{statusCopy}</div>
                </div>
                {sessionForPlan ? (
                  <div
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      sessionForPlan.status === "hosting"
                        ? "bg-fp-accent-dim text-fp-accent"
                        : "bg-fp-info-dim text-fp-info"
                    }`}
                  >
                    {sessionForPlan.status === "hosting" ? "Hosting" : "Joined"}
                  </div>
                ) : (
                  <div className="rounded-full px-2.5 py-1 text-[11px] font-medium bg-white/[0.04] text-white/42">
                    Idle
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="fp-label">Mode</label>
              <SegmentedControl
                options={[
                  { id: "host", label: "Host", disabled: !serverConfigured, title: !serverConfigured ? missingServerHint : undefined },
                  { id: "join", label: "Join", disabled: !serverConfigured, title: !serverConfigured ? missingServerHint : undefined },
                ]}
                value={draft.mode}
                onChange={(mode) =>
                  setDraft((prev) => {
                    const nextMode = mode as ConnectPlanDraft["mode"];
                    if (nextMode === prev.mode) return prev;
                    if (nextMode === "join") {
                      return {
                        ...prev,
                        mode: "join",
                        roomId: rememberedJoinValues.roomId || prev.roomId,
                        joinSecret: rememberedJoinValues.joinSecret || prev.joinSecret,
                      };
                    }
                    return {
                      ...prev,
                      mode: "host",
                      roomId: plan ? makeRoomId(plan.title) : prev.roomId,
                      joinSecret: makeJoinSecret(),
                    };
                  })
                }
              />
              {!serverConfigured && (
                <p className="mt-2 text-[11px] leading-relaxed text-white/34">
                  {missingServerHint}
                </p>
              )}
            </div>

            <div>
              <label className="fp-label">Room ID</label>
              <div className="flex items-center gap-2">
                <input
                  value={draft.roomId}
                  onChange={(e) => setDraft((prev) => ({ ...prev, roomId: e.target.value }))}
                  placeholder="flowplan-room"
                  className="fp-input"
                />
                <IconButton
                  variant="glassy"
                  size="md"
                  onClick={() => copyField("room", draft.roomId)}
                  label="Copy room id"
                  icon={copiedField === "room" ? <Check size={13} weight="bold" /> : <Copy size={13} />}
                />
              </div>
            </div>

            <div>
              <label className="fp-label">{draft.mode === "host" ? "Join secret" : "Session secret"}</label>
              <div className="flex items-center gap-2">
                <input
                  value={draft.joinSecret}
                  onChange={(e) => setDraft((prev) => ({ ...prev, joinSecret: e.target.value }))}
                  placeholder="XXXX-XXXX-XXXX"
                  className="fp-input"
                />
                <IconButton
                  variant="glassy"
                  size="md"
                  onClick={() => copyField("secret", draft.joinSecret)}
                  label="Copy session secret"
                  icon={copiedField === "secret" ? <Check size={13} weight="bold" /> : <Copy size={13} />}
                />
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-white/34">
                This is the room secret used by the signaling server before the peers establish their direct WebRTC link.
              </p>
            </div>

            {draft.mode === "host" && (
              <div className="rounded-[18px] border border-white/[0.06] bg-[rgba(16,185,129,0.06)] px-4 py-3.5">
                <div className="flex items-start gap-2.5">
                  <Sparkle size={14} className="text-fp-accent shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[12px] font-medium text-fp-accent">Host current plan</div>
                    <div className="text-[11px] leading-relaxed text-white/40 mt-1">
                      {plan
                        ? "This device becomes the authoritative peer and will sync the current plan directly to the others."
                        : "Select a plan in the sidebar first, then start hosting from here."}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {draft.mode === "join" && (
              <div className="rounded-[18px] border border-white/[0.06] bg-[rgba(66,133,244,0.06)] px-4 py-3.5">
                <div className="flex items-start gap-2.5">
                  <LinkSimple size={14} className="text-fp-info shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[12px] font-medium text-fp-info">Join remote host session</div>
                    <div className="text-[11px] leading-relaxed text-white/40 mt-1">
                      Use the room ID and secret shared by the host. After signaling, the actual state flows peer-to-peer over WebRTC.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 pt-4 pb-6 shrink-0 flex flex-col gap-2">
          <Button
            variant="glassy"
            size="md"
            icon={<PlugsConnected size={13} weight="bold" />}
            onClick={submit}
            disabled={
              !serverConfigured ||
              !draft.roomId.trim() ||
              !draft.joinSecret.trim() ||
              busy ||
              (draft.mode === "host" && !plan)
            }
            loading={busy}
            className="w-full"
          >
            {actionLabel}
          </Button>

          <Button variant="ghost" size="md" onClick={onClose} disabled={busy} className="w-full">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
