import Button from "./ui/Button";

interface RejoinPromptModalProps {
  roomId: string;
  planTitle: string;
  busy: boolean;
  onSyncToHost: () => void;
  onDuplicate: () => void;
  onCancel: () => void;
}

export default function RejoinPromptModal({ roomId, planTitle, busy, onSyncToHost, onDuplicate, onCancel }: RejoinPromptModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[1200] flex items-center justify-center animate-modal-overlay"
      onClick={onCancel}
    >
      <div
        className="relative w-[420px] flex flex-col animate-modal-in rounded-xl overflow-hidden border border-white/[0.08] bg-[rgba(32,33,36,0.95)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h1 className="text-[16px] font-semibold text-fp-text mb-3">Host Has The Latest Shared Version</h1>
        <p className="text-[13px] text-white/50 leading-relaxed whitespace-pre-line mb-5">
          You edited this plan after the host session ended. Rejoining will use the host&apos;s current shared state.
          {"\n\n"}
          Choose what to do with your local changes first.
        </p>
        <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.025] px-4 py-3.5 mb-5">
          <div className="text-[11px] uppercase tracking-[0.12em] text-white/28 font-mono">Room</div>
          <div className="mt-1 text-[13px] font-medium text-white/78">{roomId}</div>
          <div className="mt-2 text-[11px] text-white/34">Shared plan: {planTitle}</div>
        </div>
        <div className="flex flex-col gap-2">
          <Button variant="accent" size="md" onClick={onSyncToHost} disabled={busy} className="w-full">Sync To Host</Button>
          <Button variant="glassy" size="md" onClick={onDuplicate} disabled={busy} className="w-full">Duplicate Local Copy, Then Sync</Button>
          <Button variant="ghost" size="md" onClick={onCancel} disabled={busy} className="w-full">Cancel</Button>
        </div>
      </div>
    </div>
  );
}
