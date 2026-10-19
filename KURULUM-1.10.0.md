# Lumira 1.10.0

Bu paket, GitHub'daki `c6d078bb794f83a01fd5519ffa0e13efc55f3c8e` sürümüne göre yalnızca değişen ve yeni dosyaları içerir. Mevcut projenin üzerine, klasör yollarını koruyarak yükleyin. `node_modules` veya ZIP dosyasının kendisini GitHub'a yüklemeyin.

## Yapılacaklar

1. ZIP'i açın ve içeriğini `lumira` deposunun köküne ekleyin. Dosyaların üzerine yazılmasını kabul edin.
2. Netlify'ın bu son commit'i **bir kez** dağıtmasını sağlayın. Publish directory: `.`. Build command boş kalabilir. Depodaki mevcut `netlify.toml`, Node 22 ve Functions ayarlarını içerir. Dağıtımlar kredi nedeniyle duraklatılmışsa bu engel hesapta kaldırılmadan sunucu güncellenemez.
3. Uygulamada **Güncellemeyi denetle → Şimdi yükle** yolunu kullanın. Sürüm **1.10.0** görünmelidir. Sözlük ve cihaz çeviri motoru önbelleğini silmeyin; bu güncelleme onları korur.

Bu sürüm için yeni Firebase kuralı gerekmez. Mevcut 1.9.5/1.9.8 güvenli kuralları korunur. GitHub Pages, Netlify sunucu işlevlerini çalıştıramaz; GitHub sürümü `lumira-tr.com` üzerindeki aynı doğrulanmış sunucuya bağlanır. Yalnızca GitHub'ı güncellemek sunucu hatalarını gidermez.

## Eklenenler ve düzeltmeler

- Kullanım hakkı istekleri, süresi dolmuş oturum anahtarını bir kez yeniler. Ağ hatasında yazma işlemleri körlemesine tekrarlanmaz. Bağlantı ve sunucu hataları, yanlış bir çevrimdışı uyarısı yerine uygun mesajla gösterilir.
- Admin rozet listesi uygulamadaki adları kullanır. Normal rozet hediyesi isteğe bağlı sunucu servisine bağlanmadan verilir. Eşzamanlı hediyeler ve tekrar denemeleri XP'yi kaybetmez veya iki kez eklemez. Admin rozet kaldırma işlemi erişimi kaldırır; Paddle ödeme aboneliğini kendiliğinden iptal etmez.
- **Profilim** için seviye şartı kaldırıldı. Rozetlerin kaynağı, süresi ve abonelik tarihleri gösterilir. **Rozeti İptal Et** ile yenilemeyi durdurup ödenmiş süreyi kullanma veya rozeti hemen kaldırıp yenilemeyi durdurma seçilebilir. İptal onaylanmadan başarılı mesajı gösterilmez.
- Paddle'daki ilk beş ürün aylıktır. Kral ürününün gerçek fiyat kaydı tek seferlikse kalıcı, aylıksa aylık olarak işlenir; aylık bir ürün yanlışlıkla süresiz gösterilmez. Kalıcı hediyeler ve önceki Google Play tek seferlik satın alımları süreli aboneliğe çevrilmez.
- Abonelik süresi dolunca ücretli erişim hem sunucuda hem cihazdaki hak özetinde kapanır. Kullanıcının kendi kaldırdığı, hâlâ geçerli bir rozet geri gösterilebilir; bu işlem yenilemeyi başlatmaz. Adminin iptal ettiği rozet kullanıcı tarafından geri açılamaz.
- **Hikaye Oku**, Kişisel'de Yazma Pratiği'nin hemen altındadır. Notlarım'da da kısayolu vardır. Tür, anlatıcı karakteri, kapak görünümü ve dört zorluk seçilebilir. Öğrenilmiş ve kendi defterine eklenmiş kelimeler kullanılır. Havuz dışında kelime içeren sonuç reddedilir. Son 20 hikaye hesaba özel kaydedilir; tek tek silinebilir.
- Hikayeler mevcut Gemini/Groq/Cloudflare bağlantılarını kullanır. Yeni servis, API anahtarı veya model indirmesi eklenmedi. Mevcut servislerin kotası ya da erişimi yoksa hikaye hazırlanamaz; uygulama bu durumu açıkça bildirir. Anlatıcı, cihazda ilgili dilin sesi varsa çalışır. Kapaklar uygulamanın yerleşik çizimleridir.
- İlk **300** hesabın Teşekkür Rozeti hediyesi sunucuda doğrulanır. Karşılama ekranı **Tamam** ile veya **7 saniye** sonra kapanır. Hesap başına bir kez gösterilir. Bu kalıcı hediyenin günlük hakları 60 dakika ses / 25 yazma; toplam PDF hakkı 5'tir. Mevcut ilerleme ve XP sıfırlanmaz.
- Android tarayıcı, oturum başına bir kez mevcut Play Store sayfasını açar. Kurulu TWA/PWA/WebView, iOS ve bilgisayarda yönlendirme yapılmaz. `?web=1` ile web sürümünde kalınabilir. Ödeme ve kimlik dönüşlerinde yönlendirme döngüsü oluşturulmaz.
- Yeni ekranlar Türkçe, İngilizce, Almanca, Arapça, Fransızca, İspanyolca ve Rusçadır. Arapça yönü sağdan soladır. Fiyatlar, kullanım koşulları, iade ve ödeme sayfaları eklendi; gizlilik açıklaması güncellendi.

## Paddle bağlantısı

Entegrasyon kodu hazırdır; bu çalışma sırasında **canlı hesabınızda işlem veya gerçek ödeme yapılmadı**. Paddle paneli incelemesi otomatik onay denetiminde reddedildi. Gerekçe olarak önceki “Paddle'ı sona bırakalım” talimatı gösterildi. Canlı ürün adları, fiyatlar, hesap izinleri ve alan adı onayı bu nedenle doğrulanamadı.

Dağıtımdan sonra admin panelindeki **Paddle bağlantısı**, sunucuda zaten mevcut `PADDLE_API_KEY` varsa onu kullanarak altı ürünü/fiyatı eşleştirir, bildirim bağlantısını ve herkese açık ödeme belirtecini hazırlar. Yeni konuşma veya hikaye API anahtarı istemez. Mevcut Paddle yetkisi yoksa ya da gerekli hesap izinleri/alan adı onayı tamamlanmamışsa kod bunları kendiliğinden aşamaz; ödeme hazırmış gibi gösterilmez. Ürün eşleşmesi belirsizse yanlış ürünü satmak yerine bağlantı durdurulur. Kullanıcıların ödeme yaptığı bir hesapta bu hazırlık, yalnızca adminin düğmeye basmasıyla çalışır.

Ödeme adresi: `https://lumira-tr.com/checkout/`

Bildirim adresi: `https://lumira-tr.com/.netlify/functions/paddle-webhook`

Fiyatlar / koşullar / iade: `/pricing/`, `/terms/`, `/refund/`. Bunlar hazırlanmıştır; Paddle'ın hesap veya alan adı onayının alındığı anlamına gelmez. Paddle web satın alımlarının erişimi sunucu doğrulamasıyla verilir. Tarayıcıdaki “ödeme tamamlandı” olayı tek başına rozet vermez.

## Kontrollerin kapsamı

Sonuçlar `tests/test-results-1.10.0.json` dosyasındadır. Testler gerçek Chromium, yerel Firebase Realtime Database emülatörü ve ayrı Netlify dağıtım paketleriyle yapıldı. Firebase kuralları değiştirilmeden gerçek SDK işlemleri denendi; bir saatlik oturum 720 ardışık yenileme ile zaman hızlandırılarak sınandı.

Canlı Paddle ödemesi, gerçek sağlayıcı anahtarlarıyla ses/AI performansı ve fiziksel iPhone/Android cihaz testi yapılamadı. Tarayıcıdaki sağlayıcı yanıtları test verileriyle oluşturuldu; bu sonuçlar gerçek konuşma hızının veya tüm otomatik çevirilerin anlamsal doğruluğunun kanıtı değildir. Hiçbir yazılım için yüzde 100 hatasızlık garantisi verilmez.
