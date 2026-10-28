/** Urdu text block: lang="ur", dir="rtl", Nastaliq font. */
export function Ur({ children, className = "", as: Tag = "p" }: { children: React.ReactNode; className?: string; as?: "p" | "h1" | "h2" | "h3" | "span" | "div" }) {
  return (
    <Tag
      lang="ur"
      dir="rtl"
      className={`leading-[2.1] ${className}`}
      style={{ fontFamily: '"Noto Nastaliq Urdu", "Jameel Noori Nastaleeq", "Noto Naskh Arabic", serif' }}
    >
      {children}
    </Tag>
  );
}
