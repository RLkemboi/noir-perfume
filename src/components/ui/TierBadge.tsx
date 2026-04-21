import { motion } from "framer-motion";
import { Crown, Sparkles, Diamond, Shield, Award, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserProfile } from "../../../server/types";

export type UserTier = UserProfile["tier"];

interface TierBadgeProps {
  tier: UserTier;
  className?: string;
  showIcon?: boolean;
}

const TIER_CONFIG: Record<UserTier, { color: string; icon: any; label: string; bg: string }> = {
  Junior: {
    color: "text-stone-400",
    bg: "bg-stone-400/10 border-stone-400/20",
    icon: Zap,
    label: "Junior Member",
  },
  Bronze: {
    color: "text-amber-700",
    bg: "bg-amber-700/10 border-amber-700/20",
    icon: Zap,
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
    color: "text-cyan-400",
    bg: "bg-cyan-400/10 border-cyan-400/20",
    icon: Sparkles,
    label: "Platinum Member",
  },
  Diamond: {
    color: "text-blue-400",
    bg: "bg-blue-400/10 border-blue-400/20",
    icon: Diamond,
    label: "Diamond Elite",
  },
  "The Alchemist Circle": {
    color: "text-primary",
    bg: "bg-primary/10 border-primary/20 luxury-glow",
    icon: Shield,
    label: "The Alchemist Circle",
  },
};

export function TierBadge({ tier, className, showIcon = true }: TierBadgeProps) {
  const config = TIER_CONFIG[tier] || TIER_CONFIG.Bronze;
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
