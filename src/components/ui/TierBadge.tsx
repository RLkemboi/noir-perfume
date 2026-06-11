import { motion } from "framer-motion";
import { Crown, Shield, Award, Sparkles, Gem, Medal, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserProfile } from "../../../server/types";

export type UserTier = UserProfile["tier"];

interface TierBadgeProps {
  tier: UserTier;
  className?: string;
  showIcon?: boolean;
}

const TIER_CONFIG: Record<UserTier, { color: string; icon: LucideIcon; label: string; bg: string }> = {
  Junior: {
    color: "text-stone-400",
    bg: "bg-stone-400/10 border-stone-400/20",
    icon: Shield,
    label: "Junior Member",
  },
  Bronze: {
    color: "text-amber-500",
    bg: "bg-amber-500/10 border-amber-500/20",
    icon: Medal,
    label: "Bronze Member",
  },
  Silver: {
    color: "text-slate-400",
    bg: "bg-slate-400/10 border-slate-400/20",
    icon: Award,
    label: "Silver Member",
  },
  Gold: {
    color: "text-yellow-500",
    bg: "bg-yellow-500/10 border-yellow-500/20",
    icon: Crown,
    label: "Gold Member",
  },
  Platinum: {
    color: "text-primary",
    bg: "bg-primary/10 border-primary/20 luxury-glow",
    icon: Gem,
    label: "Platinum Member",
  },
  Black: {
    color: "text-zinc-100",
    bg: "bg-zinc-950/70 border-zinc-700",
    icon: Sparkles,
    label: "Black Member",
  },
};

export function TierBadge({ tier, className, showIcon = true }: TierBadgeProps) {
  const config = TIER_CONFIG[tier] || TIER_CONFIG.Junior;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold tracking-widest uppercase transition-all duration-300",
        config.bg,
        config.color,
        className
      )}
    >
      {showIcon && <Icon className="w-3 h-3" />}
      <span>{config.label}</span>
    </motion.div>
  );
}
