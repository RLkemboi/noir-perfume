import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ShoppingBag, User, Menu, X, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import SearchOverlay from "./SearchOverlay";
import { TierBadge } from "./ui/TierBadge";

const scentProfiles = ["Oud & Leather", "Amber & Spice", "Fresh & Aquatic", "Floral & Powdery"];
const moods = ["Boardroom", "Evening Affair", "Intimate", "Weekend Escape"];

const Header = () => {
  const [megaOpen, setMegaOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { totalItems, setIsOpen } = useCart();
  const { user, isGuest, profile } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-header">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="font-serif text-2xl tracking-[0.2em] gold-text font-bold">
          NOIR
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-8">
          <button
            onMouseEnter={() => setMegaOpen(true)}
            onMouseLeave={() => setMegaOpen(false)}
            onFocus={() => setMegaOpen(true)}
            onBlur={() => setMegaOpen(false)}
            className="flex items-center gap-1 text-sm tracking-[0.15em] uppercase text-foreground/80 hover:text-primary transition-colors"
            aria-expanded={megaOpen}
            aria-haspopup="true"
            aria-label="Collections menu"
          >
            Collections <ChevronDown className="w-3 h-3" />
          </button>
          <a href="#scent-finder" className="text-sm tracking-[0.15em] uppercase text-foreground/80 hover:text-primary transition-colors">
            Scent Finder
          </a>
          <a href="#products" className="text-sm tracking-[0.15em] uppercase text-foreground/80 hover:text-primary transition-colors">
            Bestsellers
          </a>
          <a href="#story" className="text-sm tracking-[0.15em] uppercase text-foreground/80 hover:text-primary transition-colors">
            Our Story
          </a>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-5">
          <button onClick={() => setSearchOpen(true)} className="text-foreground/70 hover:text-primary transition-colors" aria-label="Open search">
            <Search className="w-5 h-5" />
          </button>
          <Link
            to={user || isGuest ? "/dashboard" : "/login"}
            className="hidden sm:flex items-center gap-1.5 text-foreground/70 hover:text-primary transition-colors"
            aria-label={user ? "My account" : isGuest ? "Guest session" : "Sign in"}
          >
            <User className="w-5 h-5" />
            {profile && (
              <TierBadge tier={profile.tier} className="scale-75 origin-right hidden md:flex" showIcon={false} />
            )}
            {isGuest && (
              <span className="text-[10px] tracking-widest uppercase font-bold text-primary/70">Guest</span>
            )}
          </Link>
          <button
            onClick={() => setIsOpen(true)}
            className="relative text-foreground/70 hover:text-primary transition-colors"
            aria-label="Open shopping bag"
          >
            <ShoppingBag className="w-5 h-5" />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center font-semibold">
                {totalItems > 99 ? "99+" : totalItems}
              </span>
            )}
          </button>
          <button
            className="lg:hidden text-foreground/70"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mega Menu */}
      <AnimatePresence>
        {megaOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            onMouseEnter={() => setMegaOpen(true)}
            onMouseLeave={() => setMegaOpen(false)}
            className="absolute top-full left-0 right-0 glass-panel border-t-0"
          >
            <div className="container mx-auto px-6 py-10 grid grid-cols-3 gap-12">
              <div>
                <h4 className="text-primary text-xs tracking-[0.2em] uppercase mb-4 font-sans font-semibold">By Scent Profile</h4>
                <ul className="space-y-3">
                  {scentProfiles.map((s) => (
                    <li key={s}>
                      <span className="text-foreground/70 text-sm">{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-primary text-xs tracking-[0.2em] uppercase mb-4 font-sans font-semibold">By Mood</h4>
                <ul className="space-y-3">
                  {moods.map((m) => (
                    <li key={m}>
                      <span className="text-foreground/70 text-sm">{m}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-primary text-xs tracking-[0.2em] uppercase mb-4 font-sans font-semibold">Categories</h4>
                <ul className="space-y-3">
                  {["For Him", "For Her", "Unisex", "Discovery Sets", "Gift Sets"].map((c) => (
                    <li key={c}>
                      <span className="text-foreground/70 text-sm">{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden glass-panel border-t-0 overflow-hidden"
          >
            <nav className="flex flex-col px-6 py-6 gap-4">
              <a href="#products" onClick={() => setMobileOpen(false)} className="text-sm tracking-[0.15em] uppercase text-foreground/80 py-2">Collections</a>
              <a href="#scent-finder" onClick={() => setMobileOpen(false)} className="text-sm tracking-[0.15em] uppercase text-foreground/80 py-2">Scent Finder</a>
              <a href="#products" onClick={() => setMobileOpen(false)} className="text-sm tracking-[0.15em] uppercase text-foreground/80 py-2">Bestsellers</a>
              <a href="#story" onClick={() => setMobileOpen(false)} className="text-sm tracking-[0.15em] uppercase text-foreground/80 py-2">Our Story</a>
              <Link
                to={user || isGuest ? "/dashboard" : "/login"}
                onClick={() => setMobileOpen(false)}
                className="text-sm tracking-[0.15em] uppercase text-foreground/80 py-2"
              >
                {user ? "My Account" : isGuest ? "Guest Session" : "Sign In"}
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
};

export default Header;
