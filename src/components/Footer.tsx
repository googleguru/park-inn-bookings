import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="relative overflow-hidden bg-secondary text-secondary-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
      <div className="container mx-auto px-4 py-16">
        <div className="flex flex-col items-center text-center space-y-5">
          <h3 className="text-3xl md:text-4xl font-semibold">
            Dhanlakshmi <span className="italic text-gold">Park Inn</span>
          </h3>
          <Link className="text-sm underline" to="/admin">Staff sign in</Link>
          <div className="h-px w-24 bg-secondary-foreground/15" />
          <p className="text-xs text-secondary-foreground/50">
            © {new Date().getFullYear()} Dhanlakshmi Park Inn. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
