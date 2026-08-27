"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/form";
import { cn } from "@/lib/utils/format";
interface Slide { id: string; image_url: string; mobile_image_url?: string | null; headline: string; subheadline: string | null; cta_label: string | null; cta_url: string | null }
export function HeroSlider({ slides }: { slides: Slide[] }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => setActive((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(timer);
  }, [slides.length]);
  const slide = slides[active];
  return (
    <section className="relative w-full overflow-hidden aspect-[1600/510] min-h-[16rem]">
      {slides.map((s, i) => (
        <picture key={s.id} className={cn("absolute inset-0 block h-full w-full transition-opacity duration-1000", i === active ? "opacity-100" : "opacity-0")}>
          {s.mobile_image_url && <source media="(max-width: 639px)" srcSet={s.mobile_image_url} />}
          <img
            src={s.image_url}
            alt={s.headline}
            className="h-full w-full object-contain bg-black"
          />
        </picture>
      ))}
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 px-4 pb-10 sm:pb-12">
        <div className="mx-auto max-w-2xl text-center text-white">
          <p className="font-display text-xl font-semibold sm:text-2xl">{slide.headline}</p>
          {slide.subheadline && <p className="mt-1.5 text-sm text-white/85 sm:text-base">{slide.subheadline}</p>}
          {slide.cta_label && slide.cta_url && (
            <Link href={slide.cta_url} className="mt-3 inline-block">
              <Button size="sm">{slide.cta_label}</Button>
            </Link>
          )}
        </div>
      </div>
      {slides.length > 1 && (
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={cn("h-1.5 rounded-full transition-all", i === active ? "w-6 bg-white" : "w-1.5 bg-white/50")}
            />
          ))}
        </div>
      )}
    </section>
  );
}