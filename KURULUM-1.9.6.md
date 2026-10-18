# Lumira 1.9.6 — tek paketle güncelleme

Bu ZIP, 1.9.5 paketinin tamamını ve yeni örnek cümle düzeltmelerini içerir. Eski paketleri sırayla yüklemeniz gerekmez. Mevcut GitHub projenizdeki görselleri ve diğer dosyaları silmeyin.

## Yapmanız gerekenler

1. ZIP'i çıkarın. GitHub → `muhammedfidann06/lumira` → **Add file → Upload files** üzerinden, çıkan klasörün **içindeki dosyaları ve alt klasörleri** proje köküne yükleyin. ZIP'i veya dosyaları saran ek bir klasörü yüklemeyin. Aynı adlı dosyaların üzerine yazın; `netlify/functions`, `vendor`, `privacy` ve `tests` alt klasörleri korunsun. **Hepsini tek commit ile kaydedin.**
2. **1.9.5 Firebase kuralını daha önce yayınladıysanız bu adımı atlayın.** Yayınlamadıysanız Firebase → `mhamzac-ca73d` → Realtime Database → Rules bölümüne paketteki `firebase-security-rules.json` dosyasının tamamını yapıştırıp Publish seçin. Bu dosyayı GitHub'a yüklemek kuralları kendiliğinden yayınlamaz. 1.9.6 için ayrıca yeni bir kural gerekmez.
3. Netlify'ın son commit'i **bir kez** dağıtması yeterlidir. Publish directory `.`; build command boş kalabilir. `netlify.toml`, Node 22'yi ve Functions klasörünü tanımlar. `package.json` / `package-lock.json` mutlaka yüklensin; `node_modules` yüklenmesin. Dağıtımlar kredi nedeniyle duraklatılmışsa bu engelin kalkması gerekir; kod güncellemesi Netlify kredi hakkını artırmaz.

Dağıtımın ardından mevcut **Güncellemeyi denetle / Şimdi yükle** yolunu kullanabilirsiniz. Önceki sözlük ve cihaz motoru indirmeleri korunur. Önbelleği topluca silmek gerekmez.

## Yeni örnek cümle akışı

- Bildirilen hata giderildi: `Du bist sehr nett.` → **أنت لطيف جداً.** Alakasız `هل أنت بخير؟` cümlesi bu karta bağlanmaz.
- 30 yeni paralel cümle grubu eklendi; toplam **74 grup / yedi dilde 518 metin** dosyalarla gelir ve internet gerektirmez.
- Diğer çapraz dil kartlarında örnek çevirisi eksikse, tam kaynak cümle **Gemini → Groq → Cloudflare** sırasıyla mevcut bağlantılarda çevrilir. Bu, ses motoru sırasından ayrı bir metin çevirisi yoludur; Azure Speech anahtarı metin çevirisi için kullanılamaz.
- Yeni bir hesap veya API anahtarı istenmez. Önceden eklediğiniz `FIREBASE_SERVICE_ACCOUNT_JSON` ve çalışan `GEMINI_API_KEY`, `GROQ_API_KEY`, `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` bağlantılarından en az biri gerekir. Eksik olan sağlayıcı atlanır. Değişkenler **Functions / Production** kapsamında erişilebilir olmalıdır. Anahtarları GitHub'a yazmayın.
- İlk kez çevrilecek örnek için giriş ve internet gerekir. Üretilmiş sonuç ortak sunucu önbelleğine, gösterilen sonuç da cihazdaki sınırlı önbelleğe kaydedilir. Kayıtlı örnek aynı cihazda çevrimdışı gösterilebilir; bütün eksik örnekler ZIP içinde önceden çevrilmiş değildir.
- Otomatik sonuçlar kullanıcının dilinde **Otomatik örnek çevirisi** etiketiyle gösterilir. Hizmetler çalışmıyorsa yanlış veya alakasız örnek koyulmaz; tekrar deneme seçeneği sunulur. Otomatik çeviri yine de dilsel hata yapabilir.
- Bu işlem **ses, yazma pratiği veya PDF hakkından düşmez**. Kişisel defterdeki özel cümleler bu akışa gönderilmez. Mevcut doğrulanmış cümleler için API isteği yapılmaz.
- Ortak kredileri korumak için kişi başına dakikada en fazla 20 önbellekte bulunmayan istek, bütün proje için UTC gününde en fazla 1.000 yeni cümle üretim denemesi yapılır. Bunlar ayrı teknik istek sınırlarıdır; rozet kullanım haklarını değiştirmez. Önbellek yanıtları bu üretim sınırlarından düşmez. Cihaz önbelleği en fazla 1.200 kayıt ve yaklaşık 1 MB metinle sınırlanır; en eski örnekler çıkarılır.

Sağlayıcı hesaplarınızın ücretsiz/ücretli planları değiştirilmedi. Yeni akış mevcut sağlayıcı kotalarını kullanır; hesapta ücretli faturalama açıksa ücretsiz kullanım garantisi vermez.

## Önceki onayladığınız özellikler pakette

Ses sırası: **Azure → Gemini → Groq → Cloudflare → cihaz motoru**. Hata/kota yanıtı veya zaman aşımı sıradaki sağlayıcıya geçişi başlatır; sıfır gecikme veya donanımdan bağımsız kesintisizlik garantisi yoktur. Cihaz yedeği ayrı uygulama gerektirmez; ilk kullanımda yaklaşık 225–235 MB model ve çalışma dosyası tarayıcıya indirilir. İlk indirme tamamlanmadan hazır olmaz.

| Rozet | Ses / kayan son 24 saat | Yazma / kayan son 24 saat | PDF | Çevrimdışı paket |
| --- | --- | --- | --- | --- |
| Yok | 20 dakika | 10 | Kapalı | Kapalı |
| 👍 Teşekkür | 60 dakika | 25 | Ömür boyu toplam 5 | Açık |
| ☕ Kahve | 90 dakika | 50 | Sınırsız | Açık |
| ❤️ Destekçi | 120 dakika | 100 | Sınırsız | Açık |
| 💛 Dost | 240 dakika | 150 | Sınırsız | Açık |
| ⭐ Yıldız | 480 dakika | 300 | Sınırsız | Açık |
| 👑 Kral | Sınırsız | Sınırsız | Sınırsız | Açık |

Rozetler tek seferliktir, süreleri dolmaz. En yüksek rozet geçerlidir; haklar toplanmaz. Günlük hak bitince onayladığınız ekran açılır. Çarpı ve **Şimdilik istemiyorum** önceki yere döndürür. PDF/çevrimdışı pakete rozetsiz erişimde katkıları anlatan ekran açılır.

Satın alma, mevcut Google Play TWA ödeme yolunu ve sunucu doğrulamasını kullanır. Web/iOS'ta hesaba bağlı doğrulanmış haklar kullanılabilir; bu paket yeni web/iOS ödeme altyapısı eklemez. Play yetkileri, geri yükleme ve PDF hakkının sayılma ayrıntıları `KURULUM-1.9.5.md` içinde korunmuştur.

Testler ve sınırları: `TEST-SONUCLARI-1.9.6.md`. Sözlük incelemesi: `SOZLUK-DENETIMI-1.9.6.md`.
