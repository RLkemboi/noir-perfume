import { motion } from "framer-motion";
import { Star, Clock, Sparkles } from "lucide-react";

const reviews = [
  {
    name: "Marcus T.",
    product: "Sovereign",
    title: "The executive's signature.",
    text: "I've worn Sovereign to every board meeting this year. It commands respect without saying a word. The Cambodian Oud is rich, authentic, and lasts well over 12 hours.",
    rating: 5,
    longevity: "14+ hours",
    compliments: "8 in one day",
    verified: true,
  },
  {
    name: "Adriana K.",
    product: "Obsidian Night",
    title: "A masterpiece of mystery.",
    text: "Obsidian Night is unlike anything else in my collection. It's dark, intellectual, and incredibly seductive. People stop me in the street to ask what I'm wearing.",
    rating: 5,
    longevity: "12+ hours",
    compliments: "Constant",
    verified: true,
  },
  {
    name: "James W.",
    product: "Empire",
    title: "Archive quality is unmatched.",
    text: "The Attar Royal Archive collection is pure gold. Empire feels like wearing history. The aged oud and frankincense create a scent trail that is simply regal.",
    rating: 5,
    longevity: "16+ hours",
    compliments: "Uncountable",
    verified: true,
  },
  {
    name: "Elena R.",
    product: "Veridian",
    title: "Freshness redefined.",
    text: "Most fresh scents disappear in an hour. Veridian stays with you. It smells like a luxury garden in the rain—crisp, green, and expensive.",
    rating: 5,
    longevity: "10+ hours",
    compliments: "Daily",
    verified: true,
  },
];

const ReviewSection = () => {
  return (
    <section id="story" className="py-32 bg-obsidian-light relative">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full bg-primary/3 blur-[200px]" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-primary/80 text-xs tracking-[0.4em] uppercase mb-4 font-sans font-medium">Verified Reviews</p>
          <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold mb-4">
            The <span className="gold-text italic">Verdict</span>
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto font-sans">
            Real reviews from real buyers who demand more than a pretty bottle.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {reviews.map((review, i) => (
            <motion.div
              key={review.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass-panel p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {Array.from({ length: review.rating }).map((_, j) => (
                    <Star key={j} className="w-3 h-3 text-primary fill-primary" />
                  ))}
                </div>
                <span className="text-[10px] text-primary/60 font-sans tracking-widest uppercase font-bold">{review.product}</span>
              </div>

              <h4 className="font-serif text-lg font-bold">{review.title}</h4>
              <p className="text-muted-foreground text-sm font-sans leading-relaxed">{review.text}</p>

              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center gap-1.5 text-[10px] font-sans">
                  <Clock className="w-3 h-3 text-primary" />
                  <span className="text-muted-foreground uppercase tracking-tighter">Longevity: {review.longevity}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-sans">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span className="text-muted-foreground uppercase tracking-tighter">Compliments: {review.compliments}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-foreground text-sm font-sans font-semibold">{review.name}</span>
                {review.verified && (
                  <span className="text-primary text-[10px] tracking-wider uppercase font-sans font-semibold">Verified</span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ReviewSection;
