import Button from "./ui/Button";

interface DialogModalProps {
  title: string;
  message: string;
  onClose: () => void;
}

export default function DialogModal({ title, message, onClose }: DialogModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[1200] flex items-center justify-center animate-modal-overlay"
      onClick={onClose}
    >
      <div
        className="relative w-[380px] flex flex-col animate-modal-in rounded-xl overflow-hidden border border-white/[0.08] bg-[rgba(32,33,36,0.95)] p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h1 className="text-[16px] font-semibold text-fp-text mb-3">{title}</h1>
        <p className="text-[13px] text-white/50 leading-relaxed whitespace-pre-line mb-5">{message}</p>
        <Button variant="glassy" size="md" onClick={onClose} className="w-full">OK</Button>
      </div>
    </div>
  );
}
