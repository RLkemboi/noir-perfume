import { motion } from "framer-motion";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import ScentFinder from "@/components/ScentFinder";
import ProductShowcase from "@/components/ProductShowcase";
import ReviewSection from "@/components/ReviewSection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        <HeroSection />
        <ScentFinder />
        <ProductShowcase />
        <ReviewSection />
      </motion.main>
      
      <Footer />
    </div>
  );
};

export default Index;