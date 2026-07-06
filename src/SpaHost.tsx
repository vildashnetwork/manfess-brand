import { useEffect, useState } from "react";

/**
 * Client-only host for the react-router-dom SPA.
 * TanStack Start handles SSR shell; the entire app routing happens here.
 */
export function SpaHost() {
  const [App, setApp] = useState<React.ComponentType | null>(null);
  useEffect(() => {
    let mounted = true;
    import("./App").then((m) => { if (mounted) setApp(() => m.default); });
    return () => { mounted = false; };
  }, []);
  if (!App) {
    return (
      <div className="min-h-screen grid place-items-center bg-stone-50">
        <div className="text-sm text-black/40 font-medium">Loading MAMS…</div>
      </div>
    );
  }
  return <App />;
}