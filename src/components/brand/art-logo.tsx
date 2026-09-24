import { useId } from "react";

/**
 * ART ka nishan -- ek hi jagah.
 *
 * Ye pehle sirf website ke header ke andar likha hua tha. Us ki wajah
 * se kisan ki parchi par koi nishan tha hi nahi, aur agar wahan naqal
 * kar ke lagaya jata to kal logo badalne par ek jagah purana reh jata.
 * Ab dono ek hi jagah se aate hain.
 *
 * `useId` se rang ka naam har dafa alag banta hai. Ye zaroori hai:
 * pehle naam `navGoldGrad` likha hua tha, aur ek hi safhe par nishan do
 * dafa aane par dono ka rang aapas mein takra jata -- browser pehla
 * wala hi dono ko de deta.
 */
export function ArtLogo({ className = "", width = 38 }: { className?: string; width?: number }) {
  const gradId = useId();
  const height = Math.round((width * 260) / 220);
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 220 260"
      className={`shrink-0 ${className}`}
      role="img"
      aria-label="Al Rana Traders"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F3D98B" />
          <stop offset="50%" stopColor="#C9A227" />
          <stop offset="100%" stopColor="#E8C767" />
        </linearGradient>
      </defs>
      <polygon points="110,10 190,55 190,145 110,190 30,145 30,55" fill="none" stroke={`url(#${gradId})`} strokeWidth="4" />
      <polygon points="110,22 178,60 178,140 110,178 42,140 42,60" fill="#0D2818" stroke={`url(#${gradId})`} strokeWidth="1.5" />
      <g transform="translate(110,60)">
        <path d="M0 90 L0 20" stroke={`url(#${gradId})`} strokeWidth="4" strokeLinecap="round" />
        <g fill={`url(#${gradId})`}>
          <ellipse cx="-9" cy="65" rx="9" ry="15" transform="rotate(-32 -9 65)" />
          <ellipse cx="9" cy="65" rx="9" ry="15" transform="rotate(32 9 65)" />
          <ellipse cx="-10" cy="46" rx="8.4" ry="14.1" transform="rotate(-30 -10 46)" />
          <ellipse cx="10" cy="46" rx="8.4" ry="14.1" transform="rotate(30 10 46)" />
          <ellipse cx="-9" cy="28" rx="7.5" ry="12.9" transform="rotate(-28 -9 28)" />
          <ellipse cx="9" cy="28" rx="7.5" ry="12.9" transform="rotate(28 9 28)" />
        </g>
        <ellipse cx="0" cy="10" rx="6.9" ry="12.9" fill={`url(#${gradId})`} />
        <path d="M0 90 Q-24 84 -28 66 Q-10 66 0 78 Z" fill="#4A7856" />
        <path d="M0 90 Q24 84 28 66 Q10 66 0 78 Z" fill="#4A7856" />
      </g>
    </svg>
  );
}
