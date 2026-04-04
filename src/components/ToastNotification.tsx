import { X } from "@phosphor-icons/react";

interface ToastNotificationProps {
  text: string;
  file: string;
  error?: boolean;
  onDismiss: () => void;
}

export default function ToastNotification({ text, file, error, onDismiss }: ToastNotificationProps) {
  return (
    <div
      className={`animate-toast fixed bottom-4 right-4 z-[1100] max-w-[300px] rounded-2xl border backdrop-blur-[20px] py-2.5 px-3.5 flex items-center gap-2.5 ${
        error
          ? "bg-[rgba(234,67,53,0.08)] border-fp-danger/20 text-fp-danger"
          : "bg-[rgba(32,33,36,0.72)] border-white/8 text-white/80"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-medium">{text}</div>
        {file && <div className="text-[10px] text-white/30 font-mono mt-0.5 truncate">{file}</div>}
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 bg-transparent border-none text-white/25 hover:text-white/50 cursor-pointer p-0 transition-colors"
      >
        <X size={12} />
      </button>
    </div>
  );
}
