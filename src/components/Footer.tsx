import { Heart } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-secondary text-secondary-foreground py-8">
      <div className="container mx-auto px-4">
        <div className="text-center space-y-4">
          <h3 className="text-2xl font-bold">Dhanlakshmi Park Inn</h3>
          <p className="text-sm opacity-90">
            Where every moment becomes a beautiful memory
          </p>
          <div className="flex items-center justify-center gap-2 text-sm">
            <span>Made with</span>
            <Heart className="w-4 h-4 fill-current text-primary" />
            <span>for your special celebrations</span>
          </div>
          <p className="text-xs opacity-75">
            © {new Date().getFullYear()} Dhanlakshmi Park Inn. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
