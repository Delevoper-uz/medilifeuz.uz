# MediLife: tez ochilish va mustaqil server

## Siz oladigan natija
- Ochilishdagi keraksiz kutish kamayadi; qora fondagi «MED I LIFE» animatsiyasi saqlanadi.
- Tanlangan til (lotin/kirill) va qorong‘i/yorug‘ rejim qayta ochilganda ham saqlanadi. Yuklanish yozuvi ham mos tilda chiqadi.
- Kompyuteringizda yoki Linux serverda ishlaydigan alohida backend va unga ulangan sayt nusxasi ZIP shaklida tayyorlanadi. Ma’lumotlar o‘zingizdagi diskda saqlanadi; Lovable bazasi yoki Lovable API kaliti talab qilinmaydi.
- Mavjud Telegram botlari va boshqa xizmatlarning sozlamalari o‘zgartirilmaydi.

## Bajariladigan ishlar
1. Ochilishda kuzatilgan til nomuvofiqligini tuzatish, sozlamalarni xavfsiz tiklash va sun’iy kutishni kamaytirish.
2. Oldingi mustaqil server arxivini asos qilib, dorilar, yangiliklar, filiallar, doktorlar, buyurtmalar, admin ishlari va rasmlar saqlanishini moslashtirish. Saytning alohida nusxasini shu serverga ulash.
3. Telefon/kod va admin kirishini o‘z serveriga moslashtirish; Telegram xabarlarining mazmuni, tugmalari va ishlash tartibini saqlash. Amaldagi bot manzillarini avtomatik almashtirmaslik.
4. Kompyuter/Linux uchun ishga tushirish, ma’lumot ko‘chirish, zaxira olish va tiklash bo‘yicha o‘zbekcha yo‘riqnoma berish. Shaxsiy kalitlarni arxivga kiritmaslik.
5. Til/rejim saqlanishini, serverda ma’lumot yozish-o‘qishni, rasm yuklashni va arxiv tarkibini tekshirish.

## Chegaralar
- «5G sifatida»ni tez va ravon ochilish deb tushunaman; internet yoki kompyuter tezligini sayt bilan kafolatlab bo‘lmaydi.
- Jonli saytni uzib qo‘ymayman, mavjud bazani o‘chirmayman. Mustaqil nusxa siz uni ishga tushirgandan keyin o‘z serveringizdan foydalanadi.
- Telegram internet talab qiladi. Uni yangi serverga o‘tkazish ko‘rsatmasi beriladi, ammo hozirgi bot sozlamalariga tegilmaydi.
- Retseptni o‘qish hozir Lovable AIga bog‘langan. Mustaqil nusxada Lovable kaliti ishlatilmaydi: kompyuterda ishlaydigan modelni ulash ko‘rsatmasi beriladi. Uni o‘rnatmaguncha rasmni o‘qish ishlamaydi; rasm avtomatik Telegramga yuborilmaydi. Tezlik va sifat qurilmaga bog‘liq.
- Mavjud shaxsiy buyurtmalar va maxfiy ma’lumotlar oddiy ZIPga qo‘shilmaydi; ularni xavfsiz ko‘chirish tartibi beriladi.

## Texnik yechim
- Sayt TanStack Start/Reactda qoladi. Kompyuter uchun server kodi jonli Worker nusxasiga qo‘shilmaydi.
- Mustaqil backend mahalliy PostgreSQL va diskdagi fayllardan foydalanadi; Docker Compose bilan kompyuter/Linuxda ishga tushiriladi.
- Ulanish Lovable API kaliti bilan emas, o‘z server manzili va foydalanuvchi/admin sessiyasi orqali bo‘ladi. Ruxsatlar server tomonida tekshiriladi.
- Til va mavzu localStorage’dan sahifa tayyor bo‘lgandan keyin tiklanadi; i18n yuklanishida brauzer yon ta’siri bo‘lmaydi.
