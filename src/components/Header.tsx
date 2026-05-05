import { useState } from "react";
import { Menu, X, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useClientAuth } from "@/contexts/ClientAuthContext";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { clientUser, signIn, signOut, loading } = useClientAuth();

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: "smooth" });
    setIsMenuOpen(false);
  };

  const AuthButton = ({ mobile = false }: { mobile?: boolean }) => {
    if (loading) return null;
    if (clientUser) {
      return (
        <div className={`flex items-center gap-2 ${mobile ? "py-2" : ""}`}>
          <Link to="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            {clientUser.avatarUrl && (
              <img src={clientUser.avatarUrl} alt="" className="h-7 w-7 rounded-full border border-border" />
            )}
            <span className="text-xs text-muted-foreground hidden lg:block max-w-[120px] truncate">
              {clientUser.name}
            </span>
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5 text-xs">
            <LogOut size={13} /> Sign out
          </Button>
        </div>
      );
    }
    return (
      <Button variant="outline" size="sm" onClick={signIn} className="gap-1.5 text-xs">
        <LogIn size={13} /> Sign in with Google
      </Button>
    );
  };

  return (
    <header className="fixed top-0 w-full z-50 bg-background/95 backdrop-blur-sm border-b border-border shadow-soft">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-2xl md:text-3xl font-bold text-primary">
              Dhanlakshmi Park Inn
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground italic">
              Where every moment becomes a beautiful memory
            </p>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <button
              onClick={() => scrollToSection("home")}
              className="text-foreground hover:text-primary transition-colors font-medium"
            >
              Home
            </button>
            <button
              onClick={() => scrollToSection("about")}
              className="text-foreground hover:text-primary transition-colors font-medium"
            >
              About
            </button>
            <button
              onClick={() => scrollToSection("calendar")}
              className="text-foreground hover:text-primary transition-colors font-medium"
            >
              Booking Calendar
            </button>
            <button
              onClick={() => scrollToSection("contact")}
              className="text-foreground hover:text-primary transition-colors font-medium"
            >
              Contact
            </button>
            <Link
              to="/admin"
              className="text-foreground hover:text-primary transition-colors font-medium"
            >
              Admin
            </Link>
            <AuthButton />
          </nav>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X /> : <Menu />}
          </Button>
        </div>

        {isMenuOpen && (
          <nav className="md:hidden mt-4 pb-4 flex flex-col gap-3 animate-in slide-in-from-top">
            <button
              onClick={() => scrollToSection("home")}
              className="text-foreground hover:text-primary transition-colors font-medium text-left py-2"
            >
              Home
            </button>
            <button
              onClick={() => scrollToSection("about")}
              className="text-foreground hover:text-primary transition-colors font-medium text-left py-2"
            >
              About
            </button>
            <button
              onClick={() => scrollToSection("calendar")}
              className="text-foreground hover:text-primary transition-colors font-medium text-left py-2"
            >
              Booking Calendar
            </button>
            <button
              onClick={() => scrollToSection("contact")}
              className="text-foreground hover:text-primary transition-colors font-medium text-left py-2"
            >
              Contact
            </button>
            <Link
              to="/admin"
              className="text-foreground hover:text-primary transition-colors font-medium text-left py-2"
            >
              Admin
            </Link>
            <AuthButton mobile />
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
