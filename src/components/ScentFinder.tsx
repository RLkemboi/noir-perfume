import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Wind, Sparkles, Crown, Moon, Briefcase, Heart } from "lucide-react";
import { products } from "@/data";

interface QuizOption {
  label: string;
  value: string;
  icon: React.ReactNode;
  description: string;
}

const steps: { question: string; subtitle: string; options: QuizOption[] }[] = [
  {
    question: "What drives you?",
    subtitle: "Your ambition reveals your scent DNA.",
    options: [
      { label: "Power", value: "power", icon: <Crown className="w-6 h-6" />, description: "You command rooms before you speak." },
      { label: "Mystery", value: "mystery", icon: <Moon className="w-6 h-6" />, description: "You reveal only what you choose." },
      { label: "Precision", value: "precision", icon: <Briefcase className="w-6 h-6" />, description: "Every detail is deliberate." },
      { label: "Passion", value: "passion", icon: <Heart className="w-6 h-6" />, description: "You live with unapologetic intensity." },
    ],
  },
  {
    question: "Your element?",
    subtitle: "The raw material that mirrors your essence.",
    options: [
      { label: "Fire & Smoke", value: "oud", icon: <Flame className="w-6 h-6" />, description: "Oud, leather, burnt incense." },
      { label: "Earth & Amber", value: "amber", icon: <Sparkles className="w-6 h-6" />, description: "Warm resins, vanilla, sandalwood." },
      { label: "Air & Ocean", value: "fresh", icon: <Wind className="w-6 h-6" />, description: "Crisp citrus, sea salt, vetiver." },
      { label: "Night & Bloom", value: "floral", icon: <Moon className="w-6 h-6" />, description: "Jasmine, tuberose, dark rose." },
    ],
  },
  {
    question: "When do you make your mark?",
    subtitle: "The occasion defines the lasting impression.",
    options: [
      { label: "The Boardroom", value: "boardroom", icon: <Briefcase className="w-6 h-6" />, description: "Clean authority that lingers." },
      { label: "After Hours", value: "evening", icon: <Moon className="w-6 h-6" />, description: "Magnetic and unforgettable." },
      { label: "The Close", value: "intimate", icon: <Heart className="w-6 h-6" />, description: "Skin-close, addictive warmth." },
      { label: "Every Day", value: "signature", icon: <Crown className="w-6 h-6" />, description: "Your constant, unmistakable identity." },
    ],
  },
];

const ScentFinder = () => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [complete, setComplete] = useState(false);

  const matchedProduct = useMemo(() => {
    if (!complete || answers.length < 3) return null;
    
    const [drive, element, occasion] = answers;
    
    // Scoring system
    const scores = products.map(product => {
      let score = 0;
      if (product.tags.drive === drive) score += 3;
      if (product.tags.element === element) score += 5; // Element is weighted higher
      if (product.tags.occasion === occasion) score += 2;
      return { product, score };
    });

    return scores.sort((a, b) => b.score - a.score)[0].product;
  }, [complete, answers]);

  const handleSelect = (value: string) => {
    const newAnswers = [...answers, value];
    setAnswers(newAnswers);

    if (step < steps.length - 1) {
      setTimeout(() => setStep((s) => s + 1), 300);
    } else {
      setTimeout(() => setComplete(true), 300);
    }
  };

  const reset = () => {
    setStep(0);
    setAnswers([]);
    setComplete(false);
  };

  return (
    <section id="scent-finder" className="py-32 bg-background relative">
      {/* Background accent */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-primary/3 blur-[200px]" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-primary/80 text-xs tracking-[0.4em] uppercase mb-4 font-sans font-medium">AI Scent Profiler</p>
          <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold mb-4">
            Find Your <span className="gold-text italic">Signature</span>
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto font-sans">
            Three questions. Sixty seconds. Your perfect scent—matched to who you really are.
          </p>
        </motion.div>

        {/* Progress bar */}
        {!complete && (
          <div className="max-w-2xl mx-auto mb-12">
            <div className="flex gap-2">
              {steps.map((_, i) => (
                <div key={i} className="flex-1 h-0.5 rounded-full overflow-hidden bg-secondary">
                  <motion.div
                    className="h-full bg-primary"
                    initial={{ width: "0%" }}
                    animate={{ width: i <= step ? "100%" : "0%" }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              ))}
            </div>
            <p className="text-muted-foreground text-xs mt-3 font-sans text-center">
              Step {step + 1} of {steps.length}
            </p>
          </div>
        )}

        {/* Quiz content */}
        <div className="max-w-3xl mx-auto">
          <AnimatePresence mode="wait">
            {!complete ? (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.4 }}
              >
                <h3 className="font-serif text-3xl sm:text-4xl text-center mb-2">{steps[step].question}</h3>
                <p className="text-muted-foreground text-center mb-10 font-sans text-sm">{steps[step].subtitle}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {steps[step].options.map((opt) => (
                    <motion.button
                      key={opt.value}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelect(opt.value)}
                      className="glass-panel p-6 text-left group hover:border-primary/40 transition-all duration-300 cursor-pointer"
                    >
                      <div className="flex items-start gap-4">
                        <div className="text-primary/60 group-hover:text-primary transition-colors mt-1">
                          {opt.icon}
                        </div>
                        <div>
                          <h4 className="font-serif text-lg mb-1 group-hover:text-primary transition-colors">{opt.label}</h4>
                          <p className="text-muted-foreground text-sm font-sans">{opt.description}</p>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                className="text-center"
              >
                {matchedProduct && (
                  <div className="glass-panel p-12 max-w-lg mx-auto gold-glow">
                    <Sparkles className="w-10 h-10 text-primary mx-auto mb-6" />
                    <h3 className="font-serif text-3xl mb-3">Your Scent is Ready</h3>
                    <p className="text-muted-foreground font-sans mb-6">
                      Based on your profile, we've matched you with a fragrance that embodies your drive, 
                      your element, and your moment.
                    </p>
                    <div className="mb-8">
                      <h4 className="font-serif text-2xl gold-text italic mb-1">{matchedProduct.brand} {matchedProduct.name}</h4>
                      <p className="text-primary/80 text-xs tracking-[0.2em] uppercase font-sans mb-3">{matchedProduct.subtitle}</p>
                      <p className="text-muted-foreground text-sm font-sans italic">
                        {[...matchedProduct.topNotes, ...matchedProduct.heartNotes].slice(0, 4).join(" · ")}
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <a href={`#product-${matchedProduct.id}`} className="px-8 py-3 bg-primary text-primary-foreground font-sans text-sm tracking-[0.15em] uppercase font-semibold hover:bg-gold-light transition-colors">
                        View Fragrance
                      </a>
                      <button onClick={reset} className="px-8 py-3 gold-border text-primary font-sans text-sm tracking-[0.15em] uppercase font-semibold hover:bg-primary/10 transition-colors">
                        Retake Quiz
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};

export default ScentFinder;
