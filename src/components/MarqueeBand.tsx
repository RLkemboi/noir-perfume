import { cn } from "@/lib/utils";

interface MarqueeBandProps {
  items: string[];
  activeItem: string | null;
  onSelect: (item: string | null) => void;
  reverse?: boolean;
  speed?: number;
}

export const MarqueeBand = ({
  items,
  activeItem,
  onSelect,
  reverse = false,
  speed = 30,
}: MarqueeBandProps) => {
  const duplicated = [...items, ...items];

  return (
    <div className="relative overflow-hidden border-y border-border/20 py-4">
      <div
        className={cn(
          "flex w-max whitespace-nowrap",
          reverse ? "animate-marquee-reverse" : "animate-marquee"
        )}
        style={{
          animationDuration: `${speed}s`,
        }}
      >
        {duplicated.map((item, i) => (
          <div key={`${item}-${i}`} className="flex items-center">
            <button
              onClick={() => onSelect(activeItem === item ? null : item)}
              className={cn(
                "px-8 text-sm tracking-[0.25em] uppercase font-sans font-semibold transition-colors duration-300 cursor-pointer select-none",
                activeItem === item
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item}
            </button>
            <span className="text-primary/30 text-xs">✦</span>
          </div>
        ))}
      </div>
    </div>
  );
};
