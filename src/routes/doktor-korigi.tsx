import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Phone, Stethoscope, MapPin, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listDoctors, bookAppointment, type Doctor } from "@/lib/doctors.functions";

export const Route = createFileRoute("/doktor-korigi")({
  component: DoctorsPage,
  head: () => ({
    meta: [
      { title: "Doktor Ko'rigi — MediLife" },
      { name: "description", content: "MediLife doktorlari bilan ko'rikka yoziling — ismingiz va telefon raqamingizni qoldiring." },
      { property: "og:title", content: "Doktor Ko'rigi — MediLife" },
      { property: "og:description", content: "MediLife doktorlari bilan ko'rikka onlayn yoziling." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function DoctorsPage() {
  const { t } = useTranslation();
  const list = useServerFn(listDoctors);
  const book = useServerFn(bookAppointment);
  const { data = [], isLoading } = useQuery({ queryKey: ["doctors"], queryFn: () => list() });
  const [selected, setSelected] = useState<Doctor | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+998");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!selected) return;
    if (name.trim().length < 2) {
      toast.error("Ismingizni kiriting");
      return;
    }
    if (phone.replace(/\D/g, "").length !== 12) {
      toast.error("Telefon raqamni to'liq kiriting (+998 XX XXX XX XX)");
      return;
    }
    setBusy(true);
    try {
      await book({ data: { doctor_id: selected.id, doctor_name: selected.name, customer_name: name.trim(), customer_phone: phone } });
      toast.success("✅ Yozildingiz! Operator siz bilan bog'lanadi.");
      setSelected(null);
      setName("");
      setPhone("+998");
    } catch (e: any) {
      toast.error(e?.message || "Yuborilmadi. Qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="text-4xl font-bold mb-2">{t("nav.doctors")}</h1>
      <p className="text-muted-foreground mb-8">Doktorni tanlab, ko'rikka yoziling.</p>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-12">{t("common.loading")}</p>
      ) : data.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Hozircha doktorlar qo'shilmagan</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((d) => (
            <Card key={d.id} className="overflow-hidden reveal-up lift-hover">
              {d.image_url ? (
                <img
                  src={d.image_url}
                  alt={d.name}
                  loading="lazy"
                  className="w-full h-48 object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="w-full h-48 gradient-primary flex items-center justify-center">
                  <Stethoscope className="h-14 w-14 text-primary-foreground opacity-80" />
                </div>
              )}
              <div className="p-5 space-y-2">
                <h3 className="text-xl font-semibold">{d.name}</h3>
                {d.specialty && <p className="text-sm text-primary">{d.specialty}</p>}
                {d.branch && <p className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />{d.branch}</p>}
                {d.schedule && <p className="text-sm flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />{d.schedule}</p>}
                {d.phone && <p className="text-sm flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /><a href={`tel:${d.phone}`}>{d.phone}</a></p>}
                <Button className="w-full mt-2" onClick={() => setSelected(d)}>Doktor ko'rigiga yozilish</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{selected?.name} — ko'rikka yozilish</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Ismingiz</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ism Familiya" /></div>
            <div><Label>Telefon raqam</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" /></div>
            <Button className="w-full" disabled={busy} onClick={() => void submit()}>
              {busy ? "Yuborilmoqda..." : "Yuborish"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
