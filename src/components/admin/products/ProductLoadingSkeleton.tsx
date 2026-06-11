import { motion } from 'framer-motion';

export const ProductLoadingSkeleton = () => {
  return (
    <div className="w-full space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <motion.div 
          key={i}
          initial={{ opacity: 0.5 }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="h-16 w-full bg-white/5 rounded-lg"
        />
      ))}
    </div>
  );
};
