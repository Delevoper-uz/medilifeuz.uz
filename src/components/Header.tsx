import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Moon, Sun, ShoppingCart } from "lucide-react";
import logo from "@/assets/medilife-logo.jpg";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCart } from "@/hooks/use-cart";
import { useTheme } from "@/hooks/use-theme";
import i18n from "@/lib/i18n";

export function Header() {
  const { t } = useTranslation();
  const { count } = useCart();
  const { theme, toggle } = useTheme();

  const changeLang = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("medilife-lang", lng);
  };

  const linkCls = "px-3 py-2 rounded-md text-sm font-medium hover:bg-accent transition-colors";

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto flex h-16 items-center gap-2 px-4">
        <Link to="/" className="flex items-center gap-2 mr-auto">
          <img src={logo} alt="MediLife" className="h-10 w-10 rounded-md object-cover" />
          <span className="font-bold text-xl text-primary">MediLife</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 mx-auto">
          <Link to="/" className={linkCls} activeProps={{ className: linkCls + " text-primary" }} activeOptions={{ exact: true }}>{t("nav.home")}</Link>
          <Link to="/dorilar" className={linkCls} activeProps={{ className: linkCls + " text-primary" }}>{t("nav.medicines")}</Link>
          <Link to="/yangiliklar" className={linkCls} activeProps={{ className: linkCls + " text-primary" }}>{t("nav.news")}</Link>
          <Link to="/filiallar" className={linkCls} activeProps={{ className: linkCls + " text-primary" }}>{t("nav.branches")}</Link>
        </nav>

        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="font-semibold uppercase">
                {i18n.language}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => changeLang("uz_cyrl")}>Ўзбекча (Кирилл)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => changeLang("uz")}>O'zbekcha (Lotin)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="icon" onClick={toggle} aria-label="theme">
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          <Link to="/savatcha">
            <Button variant="ghost" size="icon" className="relative">
              <ShoppingCart className="h-5 w-5" />
              {count > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center" variant="default">
                  {count}
                </Badge>
              )}
            </Button>
          </Link>
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="md:hidden flex items-center justify-center gap-1 pb-2 px-2 overflow-x-auto">
        <Link to="/" className={linkCls} activeProps={{ className: linkCls + " text-primary" }} activeOptions={{ exact: true }}>{t("nav.home")}</Link>
        <Link to="/dorilar" className={linkCls} activeProps={{ className: linkCls + " text-primary" }}>{t("nav.medicines")}</Link>
        <Link to="/yangiliklar" className={linkCls} activeProps={{ className: linkCls + " text-primary" }}>{t("nav.news")}</Link>
        <Link to="/filiallar" className={linkCls} activeProps={{ className: linkCls + " text-primary" }}>{t("nav.branches")}</Link>
      </nav>
    </header>
  );
}
