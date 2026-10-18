# Lumira 1.9.5 — doğrulama sonuçları

18 Ekim 2026. **706 otomatik test senaryosu başarılı**, son çalıştırmalarda başarısız senaryo yok. Bu sayı aynı işlemin 100 kez tekrarı değildir; farklı sınırlar, diller, taşıma biçimleri, hesap durumları ve tarayıcı motorları kontrol edildi.

| Grup | Başarılı senaryo | İçerik |
| --- | ---: | --- |
| Node 22 birim / protokol / Firebase çalışma zamanı ve emülatör testi | 272 | Kotalar, rezervasyon/iade, eşzamanlılık, süre, PDF, kimlik, model protokolleri, sözlükler |
| Chromium arayüz | 119 | 112 dil × genişlik × ekran birleşimi, 7 PDF dili |
| Firefox arayüz | 119 | Aynı 119 senaryo gerçek Firefox motorunda |
| WebKit arayüz | 119 | Aynı 119 senaryo gerçek WebKit motorunda |
| Bütün uygulamanın gerçek HTML ve modülleri | 47 | 42 dil yönü, `du` örneği, favoriler, kişisel alan, defter |
| Canlı çeviri tarayıcı akışı | 15 | Motor geçişleri, PCM/WAV, süre uzatma, Durdur ve hata durumları |
| Gerçek Service Worker | 15 | Sözlük önbelleği taşıma, çevrimdışı açılış, eksik indirme ve yeniden deneme |
| **Toplam** | **706** | |

Ana `node --test` çalıştırması 272 testten 271'ini geçirir; yalnızca isteğe bağlı emülatör testi o çalıştırmada atlanır. Aynı emülatör testi resmi Firebase Database emülatörüyle ayrıca çalıştırıldı ve geçti. Böylece toplamda 272 Node testi yürütülüp başarılı oldu.

## Kotalar ve haklar

Yedi rozet seviyesinin ses / yazma sınırları, son hakkın bitmesi, 24 saatlik sürenin dolması, gece yarısında beklenmedik sıfırlama olmaması, aynı isteğin iki kez sayılmaması, başarısız yazma kontrolünde iade ve aynı hesapla eşzamanlı mikrofon engeli kontrol edildi. Teşekkür rozeti için ömür boyu 5 PDF, başarısız hazırlık iadesi, aynı belgenin tekrar sayılmaması ve daha yüksek rozetle sınırsız kullanım kontrol edildi.

Gerçek Firebase emülatörü + gerçek Firebase Admin SDK ile 12 eşzamanlı yazma isteğinde yalnızca 10 hak kullanıldı. Her istek yeni SDK uygulaması / bağlantısıyla yapılarak bir saatlik sanal oturumda **720 yenileme** çalıştırıldı. Yeni rozet kuralları için 16 ilave izin kontrolü aynı emülatör testinin içinde geçti: normal ilerleme ve XP artışı, yönetici hediyesi, mevcut rozetle meta kaydı, rozet sahteciliği reddi, başka hesaba ve özel sunucu sayaçlarına erişim reddi.

## Canlı çeviri

Gerçek tarayıcı kodu; Azure → Gemini → Groq → Cloudflare → cihaz motoru sırasını kontrollü servis yanıtlarıyla geçti. Kullanıcının mikrofonu yeniden açılmadı, önceki metinler korundu. Hata, kota, bağlantı yanıtı gelmemesi, uzun sessizlik, normal Gemini oturum yenilemesi ve bekleyen isteğin ardından Durdur düğmesi kontrol edildi.

Tarayıcı saatiyle **üç saat ve 2.160 yenileme adımı** çalıştırıldı. Bu, üç saat boyunca gerçek sınıf sesinin kaydedilip gerçek bulutlara gönderildiği anlamına gelmez. Model çıktıları ve sağlayıcı kimlik bilgileri bu senaryolarda kontrollü test verileridir. PCM/WAV ve WebSocket taşıma kodu gerçektir.

## Arayüz / dil

Türkçe, İngilizce, Almanca, Arapça, Fransızca, İspanyolca, Rusça; 320, 360, 375, 390, 430, 768, 1.024, 1.440 piksel genişlikler. Rozet ekranlarında yatay taşma, Arapça yön, klavye odağı, Escape / çarpı / Şimdilik istemiyorum, önceki alana dönüş ve satın alma seçimi kontrol edildi. Standart emojinin bazı cihazlarda kutu görünmesini önlemek için rozet SVG'leri eklendi.

Gerçek uygulama HTML'i üzerinde bütün 42 ana/hedef dil yönünde kartlar oluşturuldu. `Du bist sehr nett.` karşılığı `أنت لطيف جداً.` olarak gösterildi. Arapça iki farklı favori birbirini ezmedi. Kartlar, Quiz, Canlı Çeviri, Kişisel, Notlarım sırası ve mobil etiketlerin sığması ayrıca kontrol edildi; dinlemeden başka sekmeye geçiş mikrofonu kapattı.

## Sözlük / çevrimdışı

36.726 kaydın alanları, geçerli seviyeleri, anahtarları ve 30 çapraz dil destesindeki örnek çeviri kaynağı kontrol edildi. Tam dilsel incelemenin sınırı **SOZLUK-DENETIMI-1.9.5.md** içinde belirtilmiştir.

Gerçek Service Worker eski indirilen dilleri güncel sözlüklere taşıdı; yerel çeviri model önbelleğini korudu. Sürüm parametreli dosyalar çevrimdışıyken doğru kabuk / sözlük önbelleğinden açıldı. Bir sözlük indirmesi başarısızken “paket hazır” mesajı gösterilmedi; yeniden denemeyle bütün altı dil tamamlandı.

## Dağıtım

Netlify'ın gerçek `@netlify/zip-it-and-ship-it` / esbuild paketleyicisi `features`, `live-audio`, `tts` işlevlerini paketledi. Oluşan paketler Node 22'nin Lambda modül kısıtlarıyla ayrı klasörlerde yüklendi; Firebase Admin gerçek bağımlılıklarıyla başlatıldı. JavaScript ve inline HTML betikleri sözdizimi kontrolünden geçti. Son ZIP için yol, CRC ve dosya bütünlüğü ayrıca doğrulandı.

## Yapılmamış kontroller

- Netlify'daki gizli API anahtarlarına erişilmedi; gerçek Azure / Gemini / Groq / Cloudflare ses çevirilerinin güncel hesabınızdaki doğruluk, gecikme ve kalan kotası ölçülmedi.
- Gerçek ücretli satın alma veya Google Play hizmet hesabının canlı yetkileri denenmedi.
- Fiziksel iPhone / iPad / Android / Play Store APK'sında uzun mikrofon testi yapılmadı. WebKit testi fiziksel iPhone testi değildir.
- Mevcut ücretsiz modelin 1.9.4'te kaydedilmiş gerçek yedi dil / 42 yön sonuçları korunmuştur. 1.9.5'te model ağırlıkları yeniden indirilip gerçek ses çıkarımı baştan yapılmadı. Önceki bulgular özellikle Arapça / Türkçe ve olumsuzluklarda kalite hataları bulunduğunu gösterir; yerel yedek için kusursuz çeviri veya bir saniyeden kısa hız sözü verilmez.
- Hiçbir üretim dağıtımı, gerçek hesap yazması veya ücretli işlem yapılmadı.

%100 hatasızlık iddiası yerine, tamamlanan testlerin kapsamı ve bu sınırlar açıkça kayda geçirilmiştir.
