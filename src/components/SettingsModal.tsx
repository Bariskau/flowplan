import { useMemo, useState } from "react";
import { ArrowsClockwise, Check, GearSix, X } from "@phosphor-icons/react";
import type { CollabProfile } from "../types";
import {
  COLLAB_SERVER_URL_PLACEHOLDER,
  createAvatarOptionSeeds,
  createRandomProfile,
  DEFAULT_COLLAB_SERVER_URL,
  DEFAULT_ICE_SERVERS,
  loadConnectionDefaults,
  normalizeCollabServerUrl,
  normalizeIceServersInput,
  sanitizeUsername,
  saveConnectionDefaults,
  validateCollabServerUrl,
  validateIceServersInput,
} from "../lib/collab";
import useEscapeClose from "../hooks/useEscapeClose";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import Avatar from "./ui/Avatar";
import Accordion from "./ui/Accordion";

interface SettingsModalProps {
  profile: CollabProfile;
  onClose: () => void;
  onSave: (profile: CollabProfile) => void;
}

export default function SettingsModal({ profile, onClose, onSave }: SettingsModalProps) {
  const [username, setUsername] = useState(profile.username);
  const [avatarSeed, setAvatarSeed] = useState(profile.avatarSeed);
  const [avatarOptions, setAvatarOptions] = useState(() => createAvatarOptionSeeds(profile.avatarSeed));
  const [serverUrl, setServerUrl] = useState(() => loadConnectionDefaults().serverUrl || DEFAULT_COLLAB_SERVER_URL);
  const [iceServers, setIceServers] = useState(() => loadConnectionDefaults().iceServers || DEFAULT_ICE_SERVERS);
  const serverError = useMemo(() => (serverUrl.trim() ? validateCollabServerUrl(serverUrl) : null), [serverUrl]);
  const iceError = useMemo(() => validateIceServersInput(iceServers), [iceServers]);
  const canSave = !!sanitizeUsername(username) && !serverError && !iceError;

  useEscapeClose(onClose);

  const randomize = () => {
    const generated = createRandomProfile();
    setUsername(generated.username);
    setAvatarSeed(generated.avatarSeed);
    setAvatarOptions(createAvatarOptionSeeds(generated.avatarSeed));
  };

  const shuffleOptions = () => {
    setAvatarOptions(createAvatarOptionSeeds(avatarSeed));
  };

  const submit = () => {
    const nextUsername = sanitizeUsername(username);
    if (!nextUsername || serverError || iceError) return;
    saveConnectionDefaults({
      serverUrl: normalizeCollabServerUrl(serverUrl),
      iceServers: normalizeIceServersInput(iceServers),
    });
    onSave({
      ...profile,
      username: nextUsername,
      avatarSeed,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[1000] flex items-center justify-center animate-modal-overlay"
      onClick={onClose}
    >
      <div
        className="relative w-[420px] max-h-[80vh] flex flex-col animate-modal-in rounded-xl overflow-hidden border border-white/[0.08] bg-[rgba(32,33,36,0.95)]"
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
            <div className="grid w-8 h-8 min-w-8 min-h-8 shrink-0 aspect-square place-items-center rounded-full bg-white/[0.05] border border-white/[0.06] text-white/64">
              <GearSix size={16} weight="duotone" />
            </div>
            <div>
              <h1 className="text-[16px] font-semibold text-fp-text tracking-[-0.02em]">Settings</h1>
              <p className="text-[12px] text-white/36 mt-0.5">Your name and avatar used in history and collaboration presence</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex flex-col gap-5 pb-1">
            <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.025] p-4 flex items-center gap-4">
              <Avatar user={{ username: sanitizeUsername(username) || "FlowPlan", avatarSeed }} size="lg" />
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-white/84 truncate">
                  {sanitizeUsername(username) || "Unnamed user"}
                </div>
                <div className="text-[11px] text-white/36 mt-1">This identity will be shown in history and active-user presence.</div>
              </div>
            </div>

            <div>
              <label className="fp-label">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your display name"
                autoFocus
                maxLength={32}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
                className="fp-input"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="fp-label !mb-0">Avatar</label>
                <button
                  type="button"
                  onClick={shuffleOptions}
                  className="inline-flex items-center gap-1.5 text-[11px] text-white/42 hover:text-white/72 transition-colors"
                >
                  <ArrowsClockwise size={12} />
                  Shuffle set
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {avatarOptions.map((seed) => {
                  const selected = seed === avatarSeed;
                  return (
                    <button
                      key={seed}
                      type="button"
                      onClick={() => setAvatarSeed(seed)}
                      className={`rounded-[18px] border p-3.5 flex items-center justify-center transition-all ${
                        selected
                          ? "border-white/14 bg-white/[0.06]"
                          : "border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.09]"
                      }`}
                    >
                      <Avatar
                        user={{ username: sanitizeUsername(username) || "FlowPlan", avatarSeed: seed }}
                        size="lg"
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <Accordion
              title="Collaboration network"
              description="Saved once and reused for host/join sessions."
            >
              <div>
                <label className="fp-label">Server endpoint</label>
                <input
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder={COLLAB_SERVER_URL_PLACEHOLDER}
                  spellCheck={false}
                  className={`fp-input ${serverError ? "!border-fp-danger/40 focus:!border-fp-danger/60" : ""}`}
                />
                <p className={`mt-2 text-[11px] leading-relaxed ${serverError ? "text-fp-danger" : "text-white/34"}`}>
                  {serverError ?? "Leave blank for now, or use ws:// locally and wss:// for remote signaling."}
                </p>
              </div>

              <div>
                <label className="fp-label">ICE servers</label>
                <textarea
                  value={iceServers}
                  onChange={(e) => setIceServers(e.target.value)}
                  placeholder={DEFAULT_ICE_SERVERS}
                  spellCheck={false}
                  className={`fp-input min-h-[90px] resize-none leading-relaxed ${iceError ? "!border-fp-danger/40 focus:!border-fp-danger/60" : ""}`}
                />
                <p className={`mt-2 text-[11px] leading-relaxed ${iceError ? "text-fp-danger" : "text-white/34"}`}>
                  {iceError ?? "One entry per line. Use stun:host:port or turn:host:port|username|credential."}
                </p>
              </div>
            </Accordion>
          </div>
        </div>

        <div className="px-6 pt-4 pb-6 shrink-0 flex flex-col gap-2">
          <Button
            variant="glassy"
            size="md"
            icon={<Check size={13} weight="bold" />}
            onClick={submit}
            disabled={!canSave}
            className="w-full"
          >
            Save settings
          </Button>
          <Button variant="ghost" size="md" onClick={onClose} className="w-full">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
