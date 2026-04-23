import { motion } from "framer-motion";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import ScentFinder from "@/components/ScentFinder";
import ProductShowcase from "@/components/ProductShowcase";
import ReviewSection from "@/components/ReviewSection";
import Footer from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";

const Index = () => {
  useSEO({
    title: "NOIR Perfume — Luxury Fragrances | Oud, Amber & Rare Scents",
    description:
      "Shop NOIR's curated collection of ultra-premium fragrances — house scents and iconic brands like Tom Ford, Creed, Dior, Chanel & more. Free global shipping on orders over $300.",
    url: "/",
  });

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