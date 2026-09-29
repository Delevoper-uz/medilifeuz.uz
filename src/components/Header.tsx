import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Moon, Sun, ShoppingCart, Menu, X } from "lucide-react";
import logo from "@/assets/medilife-logo.jpg";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/hooks/use-cart";
import { useTheme } from "@/hooks/use-theme";
import i18n from "@/lib/i18n";

const NAV: { to: string; key: string; exact?: boolean }[] = [
  { to: "/", key: "nav.home", exact: true },
  { to: "/dorilar", key: "nav.medicines" },
  { to: "/yangiliklar", key: "nav.news" },
  { to: "/filiallar", key: "nav.branches" },
  { to: "/doktor-korigi", key: "nav.doctors" },
];


export function Header() {
  const { t } = useTranslation();
  const { count } = useCart();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);

  const changeLang = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("medilife-lang", lng);
  };

  const langLabel = i18n.language === "uz_cyrl" ? "RUS" : "UZ";
  const linkCls = "px-3 py-2 rounded-md text-sm font-medium hover:bg-accent transition-colors";

  return (
    <header className="sticky top-0 z-40 w-full max-w-[100vw] border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 h-16 md:flex">
        <Link to="/" className="flex min-w-0 items-center gap-2 md:mr-auto">
          <img src={logo} alt="MediLife" className="h-9 w-9 shrink-0 rounded-md object-cover" />
          <span className="truncate font-bold text-lg sm:text-xl text-primary">MediLife</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 mx-auto">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={linkCls}
              activeProps={{ className: linkCls + " text-primary" }}
              {...(n.exact ? { activeOptions: { exact: true } } : {})}
            >
              {t(n.key)}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="font-semibold px-2"
            aria-label="language"
            onClick={() => changeLang(i18n.language === "uz_cyrl" ? "uz" : "uz_cyrl")}
          >
            {langLabel}
          </Button>


          <Button variant="ghost" size="icon" onClick={toggle} aria-label="theme">
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          <Link to="/savatcha">
            <Button variant="ghost" size="icon" className="relative">
              <ShoppingCart className="h-5 w-5" />
              {count > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center">
                  {count}
                </Badge>
              )}
            </Button>
          </Link>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <nav className="md:hidden border-t bg-background px-3 py-2 flex flex-col">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              className="px-3 py-3 rounded-md text-base font-medium hover:bg-accent"
              activeProps={{ className: "px-3 py-3 rounded-md text-base font-medium text-primary bg-accent/50" }}
              {...(n.exact ? { activeOptions: { exact: true } } : {})}
            >
              {t(n.key)}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
