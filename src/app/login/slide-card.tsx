"use client";

import type { ReactNode } from "react";

/**
 * Login/Signup sliding card (malik ki manzoori, 20 Oct 2026 -- mockups/login/slide).
 * Desktop: aik card, hara panel 0.7s mein doosri taraf sarakta hai, kone
 * badalte hain, ibaarat cross-fade. Mobile: oopar hari patti, form neeche
 * se slide-up/fade. prefers-reduced-motion par koi harkat nahi.
 */
export type SlideMode = "login" | "signup";

export function toggleMode(m: SlideMode): SlideMode { return m === "login" ? "signup" : "login"; }
export function slideBoxClass(m: SlideMode): string { return m === "signup" ? "ab-slide up" : "ab-slide"; }

export const SLIDE_CSS = `
.ab-slide{position:relative;width:100%;max-width:920px;height:min(640px,calc(100vh - 128px));height:min(640px,calc(100dvh - 128px));min-height:0;background:#fff;border-radius:26px;box-shadow:0 30px 70px -30px rgba(15,61,42,.4);overflow:hidden}
.ab-slide .ab-form{position:absolute;top:0;left:0;width:50%;height:100%;padding:22px 36px;display:flex;flex-direction:column;justify-content:safe center;overflow:hidden;transition:transform .7s ease-in-out,opacity .5s}
.ab-slide .ab-in{z-index:2}.ab-slide .ab-up{opacity:0;z-index:1}
.ab-slide.up .ab-in{transform:translateX(100%);opacity:0}.ab-slide.up .ab-up{transform:translateX(100%);opacity:1;z-index:5}
.ab-ovw{position:absolute;top:0;left:50%;width:50%;height:100%;overflow:hidden;z-index:10;border-radius:150px 0 0 110px;transition:transform .7s ease-in-out,border-radius .7s ease-in-out}
.ab-slide.up .ab-ovw{transform:translateX(-100%);border-radius:0 150px 110px 0}
.ab-ov{position:relative;left:-100%;width:200%;height:100%;background:radial-gradient(circle at 30% 0,#1f7a4d,transparent 60%),linear-gradient(160deg,#0f4a33,#0c2f2a);color:#fff;transition:transform .7s ease-in-out}
.ab-slide.up .ab-ov{transform:translateX(50%)}
.ab-pn{position:absolute;top:0;width:50%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 48px;transition:transform .7s ease-in-out,opacity .7s}
.ab-pl{left:0;transform:translateX(-20%);opacity:0}.ab-pr{right:0}.ab-slide.up .ab-pl{transform:none;opacity:1}.ab-slide.up .ab-pr{transform:translateX(20%);opacity:0}
.ab-pill{border:2px solid #fff;border-radius:26px;padding:12px 46px;font-weight:700;font-size:15px;letter-spacing:.5px;color:#fff;background:transparent;cursor:pointer}
.ab-mbn{display:none}
@media (min-width:768px){
 .ab-slide .ab-form[data-panel="signup"]{padding:10px 22px 8px}
 .ab-slide .ab-form[data-panel="signup"] h1{font-size:20px;line-height:1.2;margin-bottom:0}
 .ab-slide .ab-form[data-panel="signup"] h1+p{margin-bottom:4px;font-size:12.5px;line-height:1.35}
 .ab-slide .ab-form[data-panel="signup"] label{margin-top:6px;margin-bottom:2px;font-size:12px;line-height:1.2}
 .ab-slide .ab-form[data-panel="signup"] .ab-box{height:36px}
 .ab-slide .ab-form[data-panel="signup"] .ab-ch{gap:6px}
 .ab-slide .ab-form[data-panel="signup"] .ab-ch button{padding:5px 8px;border-radius:10px}
 .ab-slide .ab-form[data-panel="signup"] .ab-ch b{font-size:13px;line-height:1.2}
 .ab-slide .ab-form[data-panel="signup"] .ab-ch span{font-size:11px;line-height:1.2}
 .ab-slide .ab-form[data-panel="signup"] .ab-go{margin-top:8px;height:40px;font-size:15px}
 .ab-slide .ab-form[data-panel="signup"] .ab-note,.ab-slide .ab-form[data-panel="signup"] .ab-rule{margin-top:2px;font-size:11px;line-height:1.3}
 .ab-slide .ab-form[data-panel="signup"] .ab-social{margin-top:8px;margin-bottom:4px}
 .ab-slide .ab-form[data-panel="signup"] .ab-social+div button{height:36px;width:36px}
}
@media (max-width:767px){
 .ab-slide{height:auto;min-height:0;background:none;box-shadow:none;overflow:visible}
 .ab-ovw{display:none}
 .ab-slide .ab-form{position:relative;width:100%;height:auto;overflow:visible;padding:22px 20px;background:#fff;border-radius:24px;box-shadow:0 30px 70px -30px rgba(15,61,42,.4);transform:none!important;opacity:1}
 .ab-slide .ab-up{display:none}.ab-slide.up .ab-up{display:flex;animation:ab-sl .6s ease-out}.ab-slide.up .ab-in{display:none}.ab-slide:not(.up) .ab-in{animation:ab-sl .6s ease-out}
 .ab-mbn{display:flex;align-items:center;gap:10px;background:linear-gradient(160deg,#0f4a33,#0c2f2a);color:#fff;border-radius:16px;padding:12px 14px;margin-bottom:12px;font-size:13px}
 .ab-mbn b{display:block;font-size:15px}.ab-mbn .ab-pill{padding:6px 14px;font-size:12px;margin-inline-start:auto;border-width:1.5px}
}
@keyframes ab-sl{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.ab-slide *,.ab-slide{transition:none!important;animation:none!important}}
`;

type Tr = (k: string) => string;

export function SlideCard({ mode, onMode, tr, login, signup, logo }: { mode: SlideMode; onMode: (m: SlideMode) => void; tr: Tr; login: ReactNode; signup: ReactNode; logo: ReactNode }) {
  const up = mode === "signup";
  return (
    <div className={slideBoxClass(mode)} data-mode={mode} dir="ltr">
      {/* " quote style ke text-child mein SSR par &quot; ban kar hydration tod deta hai. */}
      <style dangerouslySetInnerHTML={{ __html: SLIDE_CSS }} />
      <section className="ab-form ab-in" aria-hidden={up} {...(up ? { inert: "" } : {}) as object} data-panel="login">
        <MobileStrip title={tr("slide_hi_title")} sub={tr("m_new")} pill={tr("pill_signup")} onClick={() => onMode("signup")} />
        {login}
      </section>
      <section className="ab-form ab-up" aria-hidden={!up} {...(!up ? { inert: "" } : {}) as object} data-panel="signup">
        <MobileStrip title={tr("slide_back_title")} sub={tr("m_have")} pill={tr("pill_login")} onClick={() => onMode("login")} />
        {signup}
      </section>
      <div className="ab-ovw">
        <div className="ab-ov">
          <Panel cls="ab-pl" logo={logo} title={tr("slide_back_title")} p={tr("slide_back_p")} pill={tr("pill_login")} onClick={() => onMode("login")} active={up} />
          <Panel cls="ab-pr" logo={logo} title={tr("slide_hi_title")} p={tr("slide_hi_p")} pill={tr("pill_signup")} onClick={() => onMode("signup")} active={!up} />
        </div>
      </div>
    </div>
  );
}
function Panel({ cls, logo, title, p, pill, onClick, active }: { cls: string; logo: ReactNode; title: string; p: string; pill: string; onClick: () => void; active: boolean }) {
  return (
    <div className={`ab-pn ${cls}`}>
      <div className="mb-[18px] rounded-[18px] border border-white/20">{logo}</div>
      <h2 className="text-[32px] font-bold">{title}</h2>
      <p className="mb-[26px] mt-3 whitespace-pre-line text-[15px] leading-[1.55] opacity-80">{p}</p>
      <button type="button" className="ab-pill" onClick={onClick} tabIndex={active ? 0 : -1} aria-hidden={!active}>{pill}</button>
    </div>
  );
}
function MobileStrip({ title, sub, pill, onClick }: { title: string; sub: string; pill: string; onClick: () => void }) {
  return <div className="ab-mbn"><div><b>{title}</b>{sub}</div><button type="button" className="ab-pill" onClick={onClick}>{pill}</button></div>;
}
