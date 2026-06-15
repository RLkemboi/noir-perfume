import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Search, ShoppingBag, User, Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import SearchOverlay from "./SearchOverlay";
import { TierBadge } from "./ui/TierBadge";

const NAV_LINKS = [
  { label: "The Collection", to: "/collection" },
  { label: "Scent Finder", href: "/#scent-finder" },
  { label: "Editor's Picks", href: "/#products" },
  { label: "Our Story", href: "#story" },
];

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { totalItems, setIsOpen } = useCart();
  const { user, isGuest, profile } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-header">
      <div className="container mx-auto px-6 py-4 flex items-center gap-8">
        {/* Nav links — desktop */}
        <nav className="hidden lg:flex items-center gap-8 flex-1">
          {NAV_LINKS.map(({ label, to, href }) =>
            to ? (
              <Link
                key={label}
                to={to}
                className="text-sm tracking-[0.15em] uppercase text-foreground/80 hover:text-primary transition-colors whitespace-nowrap"
              >
                {label}
              </Link>
            ) : (
              <a
                key={label}
                href={href}
                className="text-sm tracking-[0.15em] uppercase text-foreground/80 hover:text-primary transition-colors whitespace-nowrap"
              >
                {label}
              </a>
            )
          )}
        </nav>

        {/* Search bar — desktop */}
        <div
          className="hidden lg:flex items-center gap-2 flex-1 max-w-xs bg-background/60 border border-border hover:border-primary/40 transition-colors px-3 py-1.5 cursor-text"
          onClick={() => setSearchOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && setSearchOpen(true)}
          aria-label="Open search"
        >
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground font-sans select-none">
            Search fragrances…
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-5 ml-auto lg:ml-0">
          {/* Mobile search */}
          <button
            onClick={() => setSearchOpen(true)}
            className="lg:hidden text-foreground/70 hover:text-primary transition-colors"
            aria-label="Open search"
          >
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

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="lg:hidden bg-background border-t border-border">
            <nav className="flex flex-col px-6 py-6 gap-4">
              {NAV_LINKS.map(({ label, to, href }) =>
                to ? (
                  <Link
                    key={label}
                    to={to}
                    onClick={() => setMobileOpen(false)}
                    className="text-sm tracking-[0.15em] uppercase text-foreground/80 py-2"
                  >
                    {label}
                  </Link>
                ) : (
                  <a
                    key={label}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className="text-sm tracking-[0.15em] uppercase text-foreground/80 py-2"
                  >
                    {label}
                  </a>
                )
              )}
              <Link
                to={user || isGuest ? "/dashboard" : "/login"}
                onClick={() => setMobileOpen(false)}
                className="text-sm tracking-[0.15em] uppercase text-foreground/80 py-2"
              >
                {user ? "My Account" : isGuest ? "Guest Session" : "Sign In"}
              </Link>
            </nav>
          </div>
        )}
      </AnimatePresence>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
};

export default Header;
