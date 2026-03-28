/**
 * Full-screen gradient background using pure CSS.
 * No canvas - works reliably in Tauri/WebKitGTK.
 */
export default function DotGrid() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-0"
      style={{
        background: `
          radial-gradient(ellipse 80% 60% at 0% 0%, rgba(16,185,129,0.08) 0%, transparent 60%),
          radial-gradient(ellipse 60% 80% at 100% 100%, rgba(20,184,166,0.06) 0%, transparent 50%),
          radial-gradient(ellipse 50% 50% at 60% 30%, rgba(167,139,250,0.03) 0%, transparent 50%),
          #09090b
        `,
      }}
    />
  );
}
