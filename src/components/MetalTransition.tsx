import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const METAL_LEFT = {
  background:
    "linear-gradient(to right, #0a0a0a 0%, #1c1c1c 20%, #3a3a3a 40%, #555 50%, #3a3a3a 60%, #1c1c1c 80%, #0a0a0a 100%)",
  boxShadow: "inset -2px 0 6px rgba(255,255,255,0.06), inset 2px 0 4px rgba(0,0,0,0.8)",
};
const METAL_RIGHT = {
  background:
    "linear-gradient(to left, #0a0a0a 0%, #1c1c1c 20%, #3a3a3a 40%, #555 50%, #3a3a3a 60%, #1c1c1c 80%, #0a0a0a 100%)",
  boxShadow: "inset 2px 0 6px rgba(255,255,255,0.06), inset -2px 0 4px rgba(0,0,0,0.8)",
};

const ease = [0.16, 1, 0.3, 1] as const;

export function MetalTransition() {
  const location = useLocation();
  const [key, setKey] = useState(location.pathname);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setKey(location.pathname);
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 700);
    return () => clearTimeout(t);
  }, [location.pathname]);

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Left panel */}
          <motion.div
            key={`left-${key}`}
            initial={{ x: 0 }}
            animate={{ x: "-100%" }}
            transition={{ duration: 0.65, ease }}
            className="fixed inset-y-0 left-0 w-1/2 z-[500] pointer-events-none"
            style={METAL_LEFT}
          >
            {/* Bright seam edge */}
            <div className="absolute right-0 top-0 h-full w-px bg-gradient-to-b from-transparent via-white/30 to-transparent" />
          </motion.div>

          {/* Right panel */}
          <motion.div
            key={`right-${key}`}
            initial={{ x: 0 }}
            animate={{ x: "100%" }}
            transition={{ duration: 0.65, ease }}
            className="fixed inset-y-0 right-0 w-1/2 z-[500] pointer-events-none"
            style={METAL_RIGHT}
          >
            {/* Bright seam edge */}
            <div className="absolute left-0 top-0 h-full w-px bg-gradient-to-b from-transparent via-white/30 to-transparent" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
