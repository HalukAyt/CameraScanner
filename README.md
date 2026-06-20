# CameraScanner

Expo tabanli belge tarama uygulamasi. Uygulama cok sayfali tarama, dosya ice aktarma, imza ekleme, belge yonetimi, OCR metni, temel goruntu duzenleme ve PDF/JPG/Word uyumlu paylasim akislarini hedefler.

## Mevcut Ozellikler

- Kamera ile belge tarama ve galeriden gorsel ekleme
- Belge, form, slayt, beyaz tahta, kimlik ve kitap icin yakalama modu secimi
- PDF, DOCX ve gorsel dosyalarini belgeye donusturme/birlestirme
- Cok sayfali belge editoru: sayfa ekleme, silme, siralama ve geri alma
- Gorsel araclari: sayfa dondurme, gri ton, siyah-beyaz ve netlestirme filtresi
- Sayfa bazli OCR metni: otomatik okuma, dil secimi ve elle duzenleme
- Baslik, etiket, favori, tarama modu, filigran ve OCR icerigine gore belge arama
- Kayitli imza tarama, saklama, belge uzerine yerlestirme, olcekleme ve dondurme
- PDF/Word ciktilarina filigran ekleme
- JPG, PDF, sikistirilmis PDF ve Word uyumlu dosya olarak paylasma
- Sistem yazdirma ekranina belge gonderme
- Turkce ve Ingilizce arayuz
- Google Mobile Ads ve iOS App Tracking Transparency akisi

## Urun Kriterleri

- Belgeler uygulama dizinine kopyalanir, boylece gecici dosyalar silinse bile kayitli belgeler korunur.
- Android manifestinde scanner icin gereksiz ses kaydi ve harici yazma izinleri tutulmaz.
- OCR ve dosya cozumleme icin WebView tabanli isleme kullanilir; PDF/DOCX/OCR CDN bagimliligi oldugu icin offline modda bu kisimlar sinirli calisabilir.
- Etiket ve OCR verileri belgeyle beraber saklanir, arama yalnizca baslikla sinirli kalmaz.
- Sikistirilmis PDF cikisi, sayfalari daha dusuk cozunurluk ve JPEG kalitesiyle yeniden isleyerek uretilir.
- Filigran metni belgeyle saklanir ve PDF/Word ciktilarina sayfa uzerinde basilir.

## Sonraki Asama

- Cihazlar arasi senkronizasyon ve yedekleme icin bulut backend
- Link ile paylasim icin dosya yukleme ve yetki kontrolu
- Fax gonderimi icin ulke bazli ucuncu parti fax servisi
- PDF parola korumasi ve sifreleme icin native/PDF kutuphanesi
- Excel/PPT donusturme ve PDF to Word/Excel/PPT icin sunucu tarafi converter
- Kitap tarama icin sayfa egimi giderme ve iki sayfayi otomatik bolme
- ID photo maker ve akilli ceviri icin ayri AI servisleri

## Calistirma

```bash
npm install
npm run lint
npx expo start
```

Native belge tarayici ve reklam modulleri icin Expo development build gerekir.
