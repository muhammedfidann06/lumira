# Lumira 1.9.5 — tek seferlik güncelleme

Bu paket mevcut GitHub projenize eklenecek güncellemedir. Mevcut sitenin görselleri ve diğer dosyaları projenizde kalır. Yeni hesap veya yeni API anahtarı almanız gerekmez; zaten eklediğiniz anahtarlar kullanılır.

## 1. Firebase kuralını yayınlayın

Firebase Console → `mhamzac-ca73d` → Realtime Database → Rules.
Paketteki **firebase-security-rules.json** dosyasının tamamını buraya yapıştırıp **Publish** seçin.

Paylaştığınız kurallar korunmuştur; yalnızca `progress/$uid/meta/supportGrants` içine, kullanıcıların kendilerine rozet eklemesini engelleyen doğrulama eklendi. Yönetici hediyesi, mevcut rozetleri içeren ilerleme güncellemesi, liderlik tablosu ve analiz akışları emülatörde kontrol edildi. GitHub'a JSON dosyasını yüklemek Firebase kurallarını kendiliğinden değiştirmez.

## 2. GitHub'a dosyaları ekleyin

1. ZIP'i bilgisayarınızda çıkarın.
2. GitHub → `muhammedfidann06/lumira` → Add file → Upload files.
3. Çıkardığınız klasörün **içindeki dosyaları ve alt klasörleri** proje köküne yükleyin. ZIP dosyasını veya onu saran ek bir klasörü yüklemeyin.
4. Aynı adlı dosyaların üzerine yazın. Projede başka dosyaları silmeyin. `netlify/functions`, `vendor`, `privacy` ve `tests` klasörlerinin yapısı korunsun.
5. Hepsini tek commit ile kaydedin.

## 3. Netlify'da tek dağıtım

Dağıtımlar kredi nedeniyle duraklatılmışsa önce bu engelin kalkması gerekir. Kod güncellemesi Netlify kredi hakkını artırmaz. Engel kalktıktan sonra son commit için **bir dağıtım** yeterlidir.

Publish directory: `.`. Build command boş kalabilir. Node 22, functions dizini ve Firebase Admin paket ayarları `netlify.toml` içinde hazırdır. `node_modules` yüklemeyin.

Mevcut Netlify değişkenlerini koruyun; anahtar değerlerini koda veya GitHub'a yazmayın:

| Değişken | Kullanımı |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase sunucu bağlantısı; mevcut JSON'un tam içeriği |
| `AZURE_SPEECH_KEY` | Azure Speech |
| `AZURE_SPEECH_REGION` | Aynı Azure kaynağının gerçek bölge kodu |
| `GEMINI_API_KEY` | Gemini |
| `GROQ_API_KEY` | Groq |
| `CLOUDFLARE_API_TOKEN` | Cloudflare Workers AI yetkili token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare hesabının 32 karakterlik Account ID değeri |

Bunlar **Functions / Production** için erişilebilir olmalıdır. Eksik sağlayıcı atlanır. Cloudflare Account ID, token ile aynı şey değildir. Arayüzde eklediğiniz değişken adları bu tabloyla aynı olmalıdır.

## Son davranış

Ses motoru sırası: **Azure → Gemini → Groq → Cloudflare → cihazdaki ücretsiz motor**. Hata veya kota yanıtı geldiğinde sıradakine geçilir. Yanıt vermeyen bağlantılar zaman aşımıyla bırakılır; bu geçiş sıfır süre garantisi değildir. Sağlıklı bağlantıdaki normal oturum süresi bitince geçici erişim yenilenir.

Bir mikrofon bağlantısı ve önceki çeviri metni korunur. Üç saatlik oturum yenilemeleri sanal saatle test edildi. Telefon işletim sisteminin uygulamayı arka planda askıya alması veya mikrofon iznini kaldırması kesintisiz çalışmayı engelleyebilir.

| Rozet | Ses / son 24 saat | Yazma / son 24 saat | PDF oluşturma | Çevrimdışı paketi |
| --- | --- | --- | --- | --- |
| Yok | 20 dakika | 10 | Kapalı | Kapalı |
| 👍 Teşekkür | 60 dakika | 25 | Toplam 5 | Açık |
| ☕ Kahve | 90 dakika | 50 | Sınırsız | Açık |
| ❤️ Destekçi | 120 dakika | 100 | Sınırsız | Açık |
| 💛 Dost | 240 dakika | 150 | Sınırsız | Açık |
| ⭐ Yıldız | 480 dakika | 300 | Sınırsız | Açık |
| 👑 Kral | Sınırsız | Sınırsız | Sınırsız | Açık |

Kotalar hesap bazında kayan son 24 saati kapsar; gece yarısında topluca sıfırlanmaz. Rozetler tek seferliktir, süreleri dolmaz. Birden fazla rozet varsa en yüksek hak uygulanır; haklar toplanmaz. Sağlayıcının aylık/günlük kotası bütün uygulama için ortaktır ve kullanıcı rozetinin kotasından ayrıdır. Cihaz motorunda da kullanıcı kullanım sınırı geçerlidir.

Hak bitmeden yükseltme uyarısı açılmaz. Hak bittiğinde onayladığınız ekran gösterilir. PDF / çevrimdışı paket düğmesinde rozetsiz kullanıcıya faydaları anlatan ekran açılır. Çarpı veya **Şimdilik istemiyorum** önceki konuma döndürür.

### Satın almalar

Yeni satın alma mevcut Google Play TWA ödeme yolunu kullanır. Web / iOS üzerinden yeni ödeme altyapısı eklenmedi; hesaba bağlı doğrulanmış haklar bu platformlarda da kullanılabilir. Eski Play satın alımı hesaba henüz bağlı değilse uygulamadaki **Satın alımları geri yükle** düğmesiyle eşleştirin.

Sunucu doğrulaması için mevcut hizmet hesabının Google Play Developer API'ye ve ilgili uygulamanın satın alma okuma / onaylama yetkilerine erişmesi gerekir. Bu yetki zaten verildiyse yeni anahtar gerekmez. `GOOGLE_PLAY_PACKAGE_NAME` varsayılanı `com.lumira.dilkartlari` olarak korunmuştur; Play Console paket adınız farklıysa Netlify'a doğru adı ekleyin. Ayrı yetkili hizmet hesabı kullanıyorsanız mevcut `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` desteklenir. Gerçek ödeme ve Play yetkileri bu çalışma ortamından doğrulanamadı.

PDF'deki 5 hak, **başarıyla oluşturulan belgeyi** sayar. Hazırlık başarısızsa hak iade edilir. Tarayıcı, oluşturulan belgenin yazdırma ekranından gerçekten dosya olarak kaydedilip kaydedilmediğini bildirmez; aynı açık belgeyi tekrar kaydetmek yeni oluşturma değildir. Sınırlı PDF hakkı çevrimiçi doğrulanır. Daha yüksek rozetin doğrulanmış özetiyle, indirilmiş sözlüklerden sınırsız PDF çevrimdışı da oluşturulabilir.

### Ücretsiz cihaz yedeği

Ayrı uygulama kurmak gerekmez. İlk kullanımda ses ve seçilen çeviri modelleri tarayıcıya yaklaşık **225–235 MB**, ayrıca çalışma dosyaları indirilir ve saklanır. İlk indirme bitmeden cihaz yedeği hazır olmaz. Hız ve kalite cihazın belleğine / işlemcisine bağlıdır; özellikle zayıf telefonlarda anlık hız garanti edilemez. Kullanım hakkının doğrulanması yine Firebase / Netlify internet bağlantısı gerektirir.

Kod, sağlayıcı hesabını ücretli plandan ücretsiz plana dönüştürmez. Maliyet istemiyorsanız sağlayıcılardaki ücretli kullanım / otomatik harcama kapalı olmalıdır. Kod, sağlayıcı kota veya hata verdiğinde geçiş yapar; ücretli hesabın kendi faturalama koşulları devam eder.

### Sözlük düzeltmesi

`du` → `أنت`, `Du bist sehr nett.` → `أنت لطيف جداً.` düzeltildi. Alakasız iki örneği çeviri gibi gösteren çapraz eşleştirme kaldırıldı. Kelime / cümle eşleşmeleri ayrı doğrulanır; uygun çevirisi bulunamayan örnek açıkça işaretlenir. Tüm sözlük sonuçları ve kalan dilsel inceleme sınırı **SOZLUK-DENETIMI-1.9.5.md** içinde.

Yeni ekranlar üç tarayıcı motorunda test edilmiştir. Canlı sağlayıcı anahtarları, fiziksel iPhone / Android / tablet ve gerçek ödeme ile uçtan uca test yapılmadığı için %100 hatasızlık veya sıfır gecikme iddiası yoktur. Ayrıntılar **TEST-SONUCLARI-1.9.5.md** içinde.
