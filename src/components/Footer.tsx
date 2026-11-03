import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Phone } from "lucide-react";
import logo from "@/assets/medilife-logo.jpg";
import { Button } from '@/components/ui/button';
import { useOfflineMode } from '@/components/OfflineMode';

export function Footer() {
  const { t, i18n } = useTranslation();
  const cyrl = i18n.language === 'uz_cyrl';
  const navigate = useNavigate();
  const { offline } = useOfflineMode();

  const openAdmin = () => {
    navigate({ to: "/admin" });
  };



  return (
    <footer className="border-t bg-card mt-16">
      <div className="container mx-auto px-4 py-10 grid gap-8 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <img src={logo} alt="MediLife" className="h-10 w-10 rounded-md object-cover" />
            <span className="font-bold text-xl text-primary">MediLife</span>
          </div>
          <p className="text-sm text-muted-foreground">{t("footer.tagline")}</p>
        </div>
        <div>
          <h3 className="font-semibold mb-3">{t("footer.call_center")}</h3>
          <ul className="space-y-2 text-sm">
            {offline ? (
            <li><Button asChild className="w-full h-auto min-h-16 whitespace-normal text-left justify-start gap-3 px-4 py-3"><a href="tel:+998957461111"><Phone className="h-6 w-6 shrink-0" /><span><span className="block">{cyrl ? 'Ёрдам Марказига Телефон қилиш' : 'Yordam Markaziga Telefon qilish'}</span><span className="block text-lg font-semibold">+998 95 746 11 11</span></span></a></Button></li>
            ) : (
              <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> <a href="tel:+998957461111" className="hover:underline">+998 95 746 11 11</a></li>
            )}
          </ul>
        </div>
        <div>
          <h3 className="font-semibold mb-3">{t("footer.manager")}</h3>
          <p className="text-sm text-muted-foreground">{t("footer.manager_name")}</p>
          <button
            type="button"
            onClick={openAdmin}
            className="text-sm text-muted-foreground mt-4 hover:text-foreground transition-colors cursor-default select-none"
            title=""
          >
            {t("footer.rights")}
          </button>
        </div>
      </div>

    </footer>
  );
}
