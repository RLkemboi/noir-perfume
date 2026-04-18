const Footer = () => {
  return (
    <footer id="story" className="bg-background border-t border-border py-16">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          <div>
            <h3 className="font-serif text-2xl tracking-[0.2em] gold-text font-bold mb-4">NOIR</h3>
            <p className="text-muted-foreground text-sm font-sans leading-relaxed">
              Luxury fragrance for those who built themselves from the ground up. No shortcuts. No compromises.
            </p>
          </div>
          <div>
            <h4 className="text-primary text-xs tracking-[0.2em] uppercase mb-4 font-sans font-semibold">Shop</h4>
            <ul className="space-y-2">
              {["All Fragrances", "For Him", "For Her", "Discovery Sets", "Gift Sets"].map((l) => (
                <li key={l}>
                  <a href="#products" className="text-muted-foreground hover:text-primary text-sm font-sans transition-colors">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-primary text-xs tracking-[0.2em] uppercase mb-4 font-sans font-semibold">Company</h4>
            <ul className="space-y-2">
              <li><a href="#story" className="text-muted-foreground hover:text-primary text-sm font-sans transition-colors">Our Story</a></li>
              <li><span className="text-muted-foreground/50 text-sm font-sans">Ingredients</span></li>
              <li><span className="text-muted-foreground/50 text-sm font-sans">Sustainability</span></li>
              <li><span className="text-muted-foreground/50 text-sm font-sans">Press</span></li>
            </ul>
          </div>
          <div>
            <h4 className="text-primary text-xs tracking-[0.2em] uppercase mb-4 font-sans font-semibold">Support</h4>
            <ul className="space-y-2">
              <li><span className="text-muted-foreground/50 text-sm font-sans">Contact</span></li>
              <li><span className="text-muted-foreground/50 text-sm font-sans">Shipping & Returns</span></li>
              <li><span className="text-muted-foreground/50 text-sm font-sans">FAQ</span></li>
              <li><span className="text-muted-foreground/50 text-sm font-sans">Track Order</span></li>
            </ul>
          </div>
        </div>
        <div className="line-gold mb-6" />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-muted-foreground text-xs font-sans">© 2026 NOIR. All rights reserved.</p>
          <div className="flex gap-6">
            {["Privacy", "Terms", "Cookies"].map((l) => (
              <span key={l} className="text-muted-foreground/50 text-xs font-sans">{l}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
