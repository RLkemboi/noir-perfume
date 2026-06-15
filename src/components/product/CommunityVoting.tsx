import { motion } from "framer-motion";
import { useFragranceVotes, type VoteAttribute } from "@/hooks/useFragranceVotes";

const VOTE_ATTRIBUTES: VoteAttribute[] = [
  "date_night", "office", "romantic", "summer", "winter",
  "long_lasting", "projection", "versatile", "party", "formal",
];

const ATTR_META: Record<VoteAttribute, { label: string; emoji: string }> = {
  date_night:   { label: "Date Night",    emoji: "🌙" },
  office:       { label: "Office",        emoji: "💼" },
  romantic:     { label: "Romantic",      emoji: "❤️" },
  summer:       { label: "Summer",        emoji: "☀️" },
  winter:       { label: "Winter",        emoji: "❄️" },
  long_lasting: { label: "Long Lasting",  emoji: "🔥" },
  projection:   { label: "Projection",    emoji: "📢" },
  versatile:    { label: "Versatile",     emoji: "🎯" },
  party:        { label: "Party",         emoji: "🎉" },
  formal:       { label: "Formal",        emoji: "🤵" },
};

// ── Radar SVG ────────────────────────────────────────────────────────────────

const CX = 150;
const CY = 150;
const R = 110;
const N = VOTE_ATTRIBUTES.length;
const ANGLE_STEP = (2 * Math.PI) / N;
const START = -Math.PI / 2; // top

function polarToXY(angleIndex: number, radius: number) {
  const angle = START + angleIndex * ANGLE_STEP;
  return {
    x: CX + radius * Math.cos(angle),
    y: CY + radius * Math.sin(angle),
  };
}

function buildPolygon(values: number[]): string {
  return values
    .map((v, i) => {
      const pt = polarToXY(i, (v / 100) * R);
      return `${pt.x},${pt.y}`;
    })
    .join(" ");
}

function buildGridPolygon(fraction: number): string {
  return Array.from({ length: N }, (_, i) => {
    const pt = polarToXY(i, R * fraction);
    return `${pt.x},${pt.y}`;
  }).join(" ");
}

interface RadarChartProps {
  values: number[]; // 0-100 per attribute, same order as VOTE_ATTRIBUTES
}

function RadarChart({ values }: RadarChartProps) {
  const gridFractions = [0.25, 0.5, 0.75, 1.0];

  return (
    <svg
      viewBox="0 0 300 300"
      className="w-full max-w-[280px] mx-auto"
      aria-label="Community fragrance profile radar chart"
    >
      {/* Grid polygons */}
      {gridFractions.map((frac) => (
        <polygon
          key={frac}
          points={buildGridPolygon(frac)}
          fill="none"
          stroke="#D4AF37"
          strokeOpacity={0.15}
          strokeWidth={1}
        />
      ))}

      {/* Axis lines */}
      {VOTE_ATTRIBUTES.map((_, i) => {
        const outer = polarToXY(i, R);
        return (
          <line
            key={i}
            x1={CX}
            y1={CY}
            x2={outer.x}
            y2={outer.y}
            stroke="#D4AF37"
            strokeOpacity={0.2}
            strokeWidth={1}
          />
        );
      })}

      {/* Data polygon */}
      <polygon
        points={buildPolygon(values)}
        fill="#D4AF37"
        fillOpacity={0.25}
        stroke="#D4AF37"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* Axis labels */}
      {VOTE_ATTRIBUTES.map((attr, i) => {
        const outer = polarToXY(i, R + 22);
        const meta = ATTR_META[attr];
        return (
          <text
            key={attr}
            x={outer.x}
            y={outer.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={8}
            fill="#D4AF37"
            opacity={0.8}
            fontFamily="sans-serif"
          >
            {meta.emoji} {meta.label}
          </text>
        );
      })}
    </svg>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function VotingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-4 w-48 bg-secondary rounded" />
      <div className="h-[280px] w-[280px] mx-auto bg-secondary rounded-full" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-10 bg-secondary rounded" />
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface CommunityVotingProps {
  productId: string;
}

export default function CommunityVoting({ productId }: CommunityVotingProps) {
  const { attributes, totalVoters, myVotes, loading, castVote } = useFragranceVotes(productId);

  const radarValues = VOTE_ATTRIBUTES.map((attr) => attributes[attr]?.percent ?? 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="glass-panel p-8 sm:p-12"
    >
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <div className="flex-1 h-px bg-border" />
        <h2 className="font-serif text-2xl font-bold whitespace-nowrap">
          Community <span className="gold-text italic">Fragrance Profile</span>
        </h2>
        <div className="flex-1 h-px bg-border" />
      </div>

      <p className="text-center text-muted-foreground text-sm font-sans mb-8">
        {totalVoters > 0
          ? `${totalVoters.toLocaleString()} community ${totalVoters === 1 ? "vote" : "votes"}`
          : "Be the first to vote!"}
      </p>

      {loading ? (
        <VotingSkeleton />
      ) : (
        <div className="space-y-10">
          {/* Radar Chart */}
          {totalVoters > 0 && (
            <div className="flex justify-center">
              <RadarChart values={radarValues} />
            </div>
          )}

          {/* Attribute Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {VOTE_ATTRIBUTES.map((attr) => {
              const meta = ATTR_META[attr];
              const stats = attributes[attr];
              const myVote = myVotes[attr];
              const isVotingYes = myVote === "yes";
              const isVotingNo = myVote === "no";

              return (
                <div
                  key={attr}
                  className="flex items-center gap-3 py-3 border-b border-border/40 last:border-0"
                >
                  {/* Label */}
                  <span className="w-32 shrink-0 text-sm font-sans text-foreground/80 flex items-center gap-1.5">
                    <span>{meta.emoji}</span>
                    <span>{meta.label}</span>
                  </span>

                  {/* Buttons */}
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => castVote(attr, "yes")}
                      disabled={loading}
                      aria-pressed={isVotingYes}
                      className={`px-2.5 py-1 text-[10px] tracking-widest uppercase font-bold border transition-colors ${
                        isVotingYes
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      YES
                    </button>
                    <button
                      onClick={() => castVote(attr, "no")}
                      disabled={loading}
                      aria-pressed={isVotingNo}
                      className={`px-2.5 py-1 text-[10px] tracking-widest uppercase font-bold border transition-colors ${
                        isVotingNo
                          ? "bg-secondary text-foreground border-foreground/40"
                          : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                      }`}
                    >
                      NO
                    </button>
                  </div>

                  {/* Bar + Percent */}
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-primary rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${stats.percent}%` }}
                        transition={{ duration: 0.6 }}
                      />
                    </div>
                    <span className="text-xs font-sans font-semibold text-primary shrink-0 w-8 text-right">
                      {stats.percent}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <p className="text-center text-muted-foreground text-xs font-sans mt-8 opacity-60">
        Vote to help the community find their perfect scent.
      </p>
    </motion.div>
  );
}
