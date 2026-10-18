# Lumira 1.9.6 — doğrulama sonuçları

Tarih: 18 Ekim 2026. Bu sürümde **626 otomatik senaryo geçti, başarısız senaryo kalmadı.** Bu sayı önceki 1.9.5 raporundaki 706 sayısına eklenerek üretilmedi; aşağıdaki son çalıştırmaların toplamıdır. Aynı testi yüz kez çalıştırmak yerine farklı hata, dil, kota ve eşzamanlılık durumları denendi.

## Sayım

| Çalıştırma | Geçen senaryo | Kapsam |
| --- | ---: | --- |
| Node 22 otomatik testleri | 507 | Mevcut ses/yazma/PDF/rozet kuralları; sözlük; yeni örnek sunucusu ve istemcisi |
| Ayrı gerçek Firebase Database emülatörü çalıştırması | 1 | Gerçek Admin SDK bağlantıları, işlem yarışları, güvenlik kuralları |
| Üretim HTML'i + Chromium + gerçek yerel HTTP uç noktası | 96 | 42 dil yönü, yedi dilde dört genişlikte başlıklar, eksik kart, Arapça, hesap/dil değişimi, çevrimdışı saklama |
| Gerçek Service Worker + Chromium | 15 | Yeni kabuğa geçiş, önbellek koruma, çevrimdışı dosyalar, başarısız indirme |
| İzole Netlify paketleri / Node 22 | 7 | Dört işlevin import edilmesi; yeni kaynak listesinin pakete girmesi; yöntem/kimlik/kaynak reddi |
| Toplam | **626** | |

Normal Node çalıştırması 508 test listeler: 507 geçti, emülatör JAR'ı belirtilmediği için 1 emülatör testi atlandı. Aynı test, JAR verilerek ayrıca çalıştırıldı ve geçti. Atlanan test başarı sayılmadı; ayrı çalıştırmanın başarısı sayıldı.

## Yeni cümle akışının kontrolleri

Yeni sunucu testleri 209, istemci testleri 27 senaryo içerir; bunlar yukarıdaki Node toplamının içindedir.

- Üç metin sağlayıcısı × 42 dil yönü: istek dilinin, tam kaynak cümlenin ve yanıt kimliğinin doğru bağlanması. Bu testlerde sağlayıcı yanıtları kontrollü cümle örnekleridir.
- 401/403/429/500/503, bozuk JSON, eksik/karışmış kimlik, yanlış alfabe, sayı/işaret değişikliği, bazı açık olumsuzlukların kaybı; sonraki sağlayıcıya geçiş.
- Eksik anahtarlar güvenli hata döndürür. Başka bir sağlayıcıdan geçerli gelen sonuç, sonraki yanıtla yanlışlıkla değiştirilmez.
- Yalnızca hazır sözlükteki bilinen kaynak cümleler kabul edilir. Kaynak listesi bütün güncel sözlüklerle karşılaştırıldı; dışarıdan rastgele cümle eklenemez.
- Önbellek isabetinde yeniden model çağrısı yapılmaz. Eşzamanlı istekte tek üretim kilidi, süresi dolan kilit, hata sonrası kilit temizliği ve teknik üretim sınırları kontrol edildi.
- Ses/yazma/PDF kullanım defterinin örnek çevirisi tarafından değiştirilmediği doğrulandı.
- İstemcide tam cümle/dil anahtarı; bozuk veya izin verilmeyen localStorage; sayıya ve boyuta göre önbellek sınırı; çevrimdışı okuma; giriş yokluğu; toplu istekler; yinelenen istekler; hesap değişiminde iptal; eski hesabın geç yanıtı; token alma zaman aşımı ve tekrar deneme sınırı kontrol edildi.
- Tarayıcıda gerçek eksik `das Alter` kartı beş hedef dilde 320/390/768/1366 piksel genişlikte dolduruldu. Cümlenin gelişi kartı çevirmedi, kart sırasını sıfırlamadı, sağdan sola yönü bozmadı.
- `du` → Arapça örnek doğrudan **أنت لطيف جداً.** oldu; alakasız cümle gelmedi ve bu incelenmiş kayıt için yeni model isteği yapılmadı.
- Kişisel defterdeki özel örnek, otomatik sözlük çevirisi isteğine dönüşmedi. Boş desteye geçince önceki örnek/etiket temizlendi.

## Gerçek emülatör ve paket kontrolü

Firebase emülatöründe 720 soğuk Admin SDK bağlantısıyla bir saatlik yenilemeler, yazma hakkı sınırları ve mevcut kurallar yeniden denendi. Yeni akışta altı eşzamanlı ayrı SDK istemcisi aynı cümle için tek kontrollü üretim gerçekleştirdi; daha sonraki istek aynı önbelleği okudu. Normal kullanıcı ortak sunucu önbelleğini okuyamadı ve üretim bütçesini sıfırlayamadı. Gerçek üretim hesabına veri yazılmadı.

Netlify'ın `zip-it-and-ship-it` aracıyla `examples`, `features`, `live-audio`, `tts` işlevleri paketlendi. JSON kaynak listesi yeni işlevin içine alındı; Firebase Admin bağımlılıkları korundu. ZIP'ler ayrı klasörlere çıkarılarak Node 22'de import edildi. Sunucu anahtarları olmadan yöntem reddi, kaynak listesi kontrolü ve kimlik doğrulama reddi denendi. Netlify'a dağıtım yapılmadı.

Gerçek Service Worker testinde 1.9.5 kabuğu yerine 1.9.6 geldi; düzeltilmiş sözlük önbelleği ve daha önce indirilmiş cihaz modelleri korundu. Yeni örnek istemcisi ve genişletilmiş paralel dosya, ilk sürüm parametreli istek çevrimdışı yapılsa bile kabuktan açıldı. API yanıtı önbellekten verilmedi. Eksik çevrimdışı paket indirimi başarı diye gösterilmedi; çevrimiçi tekrar tamamlandı.

Ayrıca üretim gezinme kodu ve gerçek Azure Speech SDK'sıyla yerel tarayıcı düzeneği tekrar çalıştırıldı: **Kartlar – Quiz – Canlı Çeviri – Kişisel – Notlarım** sırası, dar ekranda sekme sığması, açık dinlemede aynı sekmeye tekrar basınca oturumun korunması, başka sekmeye geçince mikrofonun kapanması geçti. Mikrofon ve sağlayıcı yanıtları bu düzende kontrollüdür; bu ek kontroller 626 toplamına eklenmedi.

## Doğrulamanın sınırı

Gerçek Azure/Gemini/Groq/Cloudflare anahtarlarına erişilmedi; gerçek hesap kotası, maliyeti, yanıt gecikmesi veya sağlayıcıların ürettiği bütün çevirilerin dilsel doğruluğu ölçülmedi. Kontrollü yanıtlarla geçen sağlayıcı testleri, canlı hizmet kalite testi değildir.

Bu sürümün yeni arayüzü Chromium'da test edildi. 1.9.5'in arşiv raporunda Chromium/Firefox/WebKit sonuçları bulunur; yeni kod için aynı üç motorun tamamı yeniden çalıştırılmış gibi sayılmadı. Fiziksel iPhone, Android, tablet, arka planda üç saat mikrofon veya gerçek Play ödemesi denenmedi. Önceki gerçek cihaz motoru ses örnekleri raporu korunmuştur; bu sürümde yeni yerel model kalite ölçümü yapılmadı.

626 başarılı senaryo %100 hatasızlık garantisi değildir. Bütün 36.726 kaydın bağımsız uzman çevirisi yapılmadı. Yeni otomatik cümleler anlam hatası yapabilir; sayı/alfabe/olumsuzluk kontrolleri bunu tamamen ortadan kaldırmaz.

## Yeniden çalıştırma

Node 22 ile proje kökünde `npm ci` ve `npm test`. Emülatör testi için ayrıca `LUMIRA_EMULATOR_JAR` ortam değişkeni gerekir; normal çalıştırmada o test atlanır. Sözlük örneklerini ileride değiştirirken `npm run build:examples`, sunucunun hazır cümle listesini günceller; bu teslimde liste zaten günceldir ve bu komutu çalıştırmanız gerekmez.

Ayrıntılı test adları ve son durumlar: `tests/test-results-1.9.6.json`. Veri sayımları: `tests/vocab-audit-1.9.6.json`. Önceki sürüm raporları tarihsel kayıt olarak pakettedir.
