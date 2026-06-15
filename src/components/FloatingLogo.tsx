import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

const FloatingLogo = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleClick = () => {
    if (location.pathname === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate("/");
    }
  };

  return (
    <motion.button
      onClick={handleClick}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.5, duration: 0.3 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      aria-label="Return to home"
      className="fixed bottom-6 right-6 z-[200] w-16 h-16 rounded-full bg-background border-2 border-primary/40 hover:border-primary shadow-xl hover:shadow-primary/20 transition-shadow flex items-center justify-center overflow-hidden"
    >
      <img
        src="/assets/noir-logo-1.svg"
        alt="NOIR"
        className="w-full h-full object-contain p-1"
      />
    </motion.button>
  );
};

export default FloatingLogo;
