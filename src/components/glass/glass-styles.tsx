/** Glassy UI ka mushtarka CSS (light + navy-dark). Sirf presentation. */
export const GLASS_CSS = `
.gl-bg{position:relative;isolation:isolate;overflow-x:clip}
.gl-bg:before,.gl-bg:after{content:"";position:absolute;z-index:-1;border-radius:9999px;filter:blur(80px);opacity:.45;pointer-events:none}
.gl-bg:before{width:420px;height:420px;left:-120px;top:-120px;background:#7fd8a6}
.gl-bg:after{width:420px;height:420px;right:-100px;bottom:-140px;background:#9cb6ff}
.dark .gl-bg:before{background:#1f9d5c;opacity:.25}.dark .gl-bg:after{background:#2a4f9a;opacity:.3}
.gl-panel{background:rgba(255,255,255,.6);backdrop-filter:blur(22px) saturate(160%);-webkit-backdrop-filter:blur(22px) saturate(160%);border:1px solid rgba(255,255,255,.75);box-shadow:0 18px 50px rgba(15,31,58,.10),inset 0 1px 0 rgba(255,255,255,.9);border-radius:22px}
.dark .gl-panel{background:rgba(18,32,60,.62);border-color:rgba(255,255,255,.1);box-shadow:0 18px 50px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.06)}
.gl-sec{background:rgba(255,255,255,.4);border:1px solid rgba(255,255,255,.65);border-radius:16px}
.dark .gl-sec{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.08)}
.gl-card{background:linear-gradient(135deg,rgba(19,112,67,.95),rgba(20,44,90,.95));color:#fff;border:1px solid rgba(255,255,255,.25);box-shadow:0 26px 60px -20px rgba(15,31,58,.55),inset 0 1px 0 rgba(255,255,255,.3);border-radius:24px;position:relative;overflow:hidden}
.gl-card:before{content:"";position:absolute;width:70%;aspect-ratio:1;border-radius:50%;right:-25%;top:-55%;background:radial-gradient(rgba(255,255,255,.25),transparent 70%)}
.gl-card:after{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.14) 50%,transparent 60%);pointer-events:none}
.gl-chip{width:48px;height:36px;border-radius:8px;background:linear-gradient(135deg,#f3d58a,#c79a3a)}
.gl-act{background:rgba(255,255,255,.65);border:1px solid rgba(255,255,255,.85);border-radius:16px}
.dark .gl-act{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.1)}
.gl-ur{font-family:'Noto Nastaliq Urdu','Jameel Noori Nastaleeq',serif;line-height:1.9}
`;
export function GlassStyles() {
  return <style dangerouslySetInnerHTML={{ __html: GLASS_CSS }} />;
}
