import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center space-y-6"
      >
        <Link to="/" className="font-serif text-4xl tracking-[0.2em] gold-text font-bold block mb-2">
          NOIR
        </Link>
        <h1 className="font-serif text-6xl font-bold gold-text">404</h1>
        <p className="text-muted-foreground font-serif italic text-lg">
          This page does not exist in our archive.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground text-xs tracking-widest uppercase font-bold hover:bg-gold-light transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Store
        </Link>
      </motion.div>
    </div>
  );
};

export default NotFound;
