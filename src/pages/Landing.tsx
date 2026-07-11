import { Link } from "react-router-dom";
import { GraduationCap, CheckCircle2 } from "lucide-react";
import { useEffect } from "react"
export function Landing() {

  const user = localStorage.getItem("mams-user")

  useEffect(() => {
    if (user) {
      window.location.href = "/app/mark-entry"
    }
  },[ user])

  return (
    <div className="min-h-screen bg-white font-sans text-[#121212]">
      <nav className="flex items-center justify-between px-6 md:px-8 py-6 max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-10 bg-brand rounded-lg flex items-center justify-center">
            <GraduationCap className="size-5 text-white" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight uppercase">MAMS</span>
        </Link>
        <Link to="/login" className="bg-brand text-white px-5 py-2.5 rounded-full font-semibold hover:bg-brand/90 transition-colors">Sign In</Link>
      </nav>

      <header className="pt-12 pb-24 px-6 md:px-8 max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand/10 text-brand rounded-full text-xs font-bold uppercase tracking-wider mb-6">
            <span className="size-2 bg-brand rounded-full animate-pulse" />
            MANFESS Evening School · ERP
          </div>
          <h1 className="font-display text-5xl lg:text-7xl font-extrabold leading-[1.05] mb-6 tracking-tight">
            Smart Management for <span className="text-brand">Cameroonian</span> Schools.
          </h1>
          <p className="text-lg text-black/60 mb-10 max-w-lg leading-relaxed">
            From automated MINESEC-standard report cards to seamless fee collection,
            mark entry and auto-promotion. Built for the Cameroonian secondary system.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link to="/login" className="bg-[#121212] text-white px-8 py-4 rounded-xl font-bold text-lg hover:shadow-xl transition-all">
              Open Dashboard
            </Link>
            <Link to="/login" className="border-2 border-black/10 px-8 py-4 rounded-xl font-bold text-lg hover:bg-black/5 transition-all">
              Try Demo
            </Link>
          </div>
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-lg">
            {["MINESEC report cards", "Excel-like marks entry", "Auto-promotion", "PDF printing", "Role-based access", "Fees tracking"].map((f) => (
              <div key={f} className="flex items-center gap-2 text-xs font-semibold text-black/70">
                <CheckCircle2 className="size-4 text-brand" /> {f}
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[#121212] rounded-3xl p-6 lg:p-8 text-white">
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Sequence 2 · Form 5 Science A</div>
            <div className="font-display text-3xl font-extrabold mt-2">Pass Rate <span className="text-brand">89.5%</span></div>
            <div className="mt-6 space-y-3">
              {[{ n: "Tanyi Emmanuel", a: "17.4" }, { n: "Ndip Beatrice", a: "16.8" }, { n: "Kamga Franklin", a: "15.9" }].map((s, i) => (
                <div key={s.n} className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center gap-3">
                    <div className={`size-7 rounded-full grid place-items-center text-xs font-bold ${i === 0 ? "bg-brand" : "bg-white/10"}`}>{i + 1}</div>
                    <div className="text-sm font-semibold">{s.n}</div>
                  </div>
                  <div className="font-display font-extrabold text-brand">{s.a}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <footer className="bg-[#121212] text-white/40 py-10">
        <div className="max-w-7xl mx-auto px-8 flex justify-between items-center">
          <span className="text-white font-display font-bold tracking-tight uppercase">MAMS</span>
          <p className="text-sm">© 2026 MANFESS Evening School</p>
        </div>
      </footer>
    </div>
  );
}