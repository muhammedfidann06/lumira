# Lumira 1.10.1 — kısa kurulum

Bu paket, GitHub'daki 1.10.0 üzerine yalnızca değişen ve yeni dosyaları içerir. ZIP'i açın; dosyaları klasör yollarını koruyarak aynı deponun köküne yükleyin. ZIP dosyasının kendisini veya `node_modules` klasörünü yüklemeyin.

## 1. Netlify'da yayınlama

GitHub Pages yalnızca arayüzü sunar. Hikaye, kullanım hakkı, yazma kontrolü, bulut çeviri ve satın alma doğrulaması `lumira-tr.com` üzerindeki Netlify işlevlerinde çalışır. Kontrolde hikaye işlevi 404, mevcut özellik işlevinin GitHub bağlantı isteği 405 dönüyordu; yeni sunucu dosyaları henüz yayınlanmamıştı.

- Netlify → projeniz → **Project configuration → Environment variables**.
- Mevcut Firebase, Azure ve diğer sağlayıcı ayarlarınızı koruyun.
- Aşağıdaki Paddle test ayarlarını ekleyin veya mevcut değerleri kontrol edin.
- Dosyalar ve ayarlar tamamlandıktan sonra **Deploys → Trigger deploy → Deploy project** ile son `main` commit'ini **bir kez** dağıtın. Ayar adları panel sürümüne göre küçük farklılık gösterebilir.
- Publish directory: `.`. Build command boş kalabilir. Mevcut `netlify.toml` Node 22 ve `netlify/functions` klasörünü tanımlar; `package.json` ve `package-lock.json` depoda bulunmalıdır.
- Dağıtım kredi nedeniyle duraklatılmışsa hesapta bu engel kaldırılmadan yeni sunucu kodu çalışmaz.
- Uygulamada **Güncellemeyi denetle → Şimdi yükle** sonrasında sürüm **1.10.1** olmalıdır. Sözlük ve cihaz motoru indirmelerini silmeyin; korunurlar.

Bu paket için yeni Firebase kuralı gerekmiyor; daha önceki güvenli kuralların yayınlanmış olması gerekir.

## 2. Ekran görüntünüzdeki Paddle ürünleri

Gösterdiğiniz `sandbox-vendors.paddle.com` ekranı **test ortamıdır**. Buradaki ürünler gerçek ödeme almaz; canlı ortamın ürün ve anahtarları ayrıdır. Altı ürünü Netlify'a tek tek yazmanız gerekmez.

| Netlify değişkeni | Değer |
| --- | --- |
| `PADDLE_ENV` | `sandbox` |
| `PADDLE_API_KEY` | Mevcut Paddle **test API anahtarınızın tamamı**, `pdl_sdbx_` ile başlar. Ürün/fiyat kimliği veya `test_` ile başlayan tarayıcı belirteci değildir. |

API anahtarı için **Contains secret values** açık olsun. Kapsam seçebiliyorsanız **Functions** dahil olsun. Kapsam seçeneği yoksa varsayılan kapsamı kullanın. Normal Netlify `Production` dağıtım bağlamında da bu test değişkenlerinin bulunması gerekir; dağıtım bağlamı ile Paddle'ın sandbox ortamı farklı kavramlardır. Gizli değerleri GitHub'a, HTML'e veya sohbete koymayın.

Mevcut Paddle anahtarının bu bağlantı için ihtiyaç duyduğu izinler:

- Products: Read; Prices: Read.
- Transactions: Read ve Write; Subscriptions: Read ve Write.
- Notification settings: Read ve Write.
- Client-side tokens: Read ve Write.
- Customer portal sessions: Write.

Dağıtımdan sonra uygulamada **Admin Panel → Paddle bağlantısı** seçin. Kod altı ürünü adlarından eşleştirir, gerçek fiyat/süre kayıtlarını okur ve bildirim bağlantısı ile ödeme belirtecini hazırlar. İzin veya fiyat eşleşmesi eksikse yanlış ürün satmak yerine hata gösterir. API anahtarınızın yetkileri yoksa mevcut anahtarın izinlerini Paddle'da düzenleyebilirsiniz; yeni bir konuşma servisi veya AI anahtarı gerekmiyor.

Test ödemeleri doğrulandıktan ve canlı Paddle hesabı/alan adı onayı tamamlandıktan sonra gerçek satışa geçilir. Canlı ürünleri ayrıca hazırlayıp canlı anahtarı ve `PADDLE_ENV=production` değerini kullanmak gerekir. Sadece `production` yazmak test ürünlerini canlı ürüne dönüştürmez. Bu çalışma sırasında canlı hesabınızda işlem veya gerçek ödeme yapılmadı.

## 3. Google Play: ilk beş rozet aylık, Kral tek seferlik

Eski tek seferlik ürün kimlikleri yeni abonelikte tekrar kullanılamaz. Yeni abonelikleri şu kimliklerle oluşturun:

| Rozet | Ürün kimliği | Tür |
| --- | --- | --- |
| 👍 Teşekkür | `lumira_support_1_monthly` | Aylık abonelik |
| ☕ Kahve | `lumira_support_5_monthly` | Aylık abonelik |
| ❤️ Destekçi | `lumira_support_10_monthly` | Aylık abonelik |
| 💛 Dost | `lumira_support_25_monthly` | Aylık abonelik |
| ⭐ Yıldız | `lumira_support_50_monthly` | Aylık abonelik |
| 👑 Kral | `lumira_support_100` | Mevcut tek seferlik ürün |

Her yeni abonelikte:

1. Temel plan kimliği: **`monthly`**.
2. Tür: **Otomatik yenilenen**. Faturalandırma dönemi: **1 ay**.
3. Fiyatı ve satış yapılacak ülkeleri belirleyip temel planı **etkinleştirin**.
4. Mevcut TWA/Digital Goods satın alma arayüzü için aylık planın **geriye uyumlu** temel plan olduğundan emin olun. İlk sürümde ek teklif, deneme veya taksit planı kullanmayın; kod aylık temel planı doğrular.

Eski ürünleri yeni satışa kapatabilirsiniz; eski satın alma kayıtlarını ve kullanıcı haklarını silmeyin. Kod eski `lumira_support_1/5/10/25/50/100` makbuzlarını geri yüklemek için tanımaya devam eder. Önceki tek seferlik satın alımlar ve ilk 300 üyeye verilen süresiz hediye aylık aboneliğe çevrilmez.

Uygulama ürün fiyatını Google Play'den okur. Google'ın doğruladığı bitiş tarihi profil ve kullanım haklarına uygulanır. **Yenilemeyi durdur** ödenmiş dönem sonuna kadar erişimi korur; **Rozeti şimdi kaldır** yenilemeyi durdurduktan sonra rozet erişimini kapatır. İptal onaylanmadan başarı gösterilmez. Google Play'in abonelik yönetim sayfasına da Profilim'den gidilebilir.

Mevcut Google Play/Firebase servis hesabı kullanılır; yeni bir API anahtarı eklenmedi. Bu hesabın Play Console'da uygulamanın satın alımlarını okuyup aboneliklerini yönetme yetkisi olmalıdır. Native uygulamanızın mevcut Digital Goods/Play Billing desteği korunur; gerçek Android mağaza testi için Play Console lisans test kullanıcısıyla bir satın alma yapın. Android projesi/APK kaynakları bu depoda bulunmadığından native paket üzerinde değişiklik veya fiziksel cihaz testi yapılmadı.

Yenilemeler, aktif kullanım sırasında sunucuda en fazla beş dakikalık aralıkla ve dönem bitişinde tekrar doğrulanır. Ek Pub/Sub kurulumu yapılmadı. Doğrulama servisi yanıt vermezse süresi bitmiş rozet devam etmez; doğrulanmış yeni dönem geldiğinde tekrar açılır.

## 4. Ders için canlı çeviri

Üstteki **Konuşulan dil** alanında **Almanca**, alttaki hedef dilde **Türkçe** seçin. Azure, Groq, Cloudflare ve cihaz motoruna Almanca kaynak dil ayarı iletilir; otomatik sınıflandırıcının İngilizce/İspanyolca tahminine göre motor değiştirilmez. Dinleme sırasında kaynak dili değiştirirseniz eski oturum kapatılıp yeni ayarla açılır.

**Otomatik tespit**, uygulamanın desteklediği diller arasında otomatik geçiş yapar. Azure'da geçici tanıma sonuçları dil etiketini değiştirmez; tamamlanan sonuç esas alınır. Gemini Live çeviri API'sinde sabit kaynak dil ayarı bulunmadığından sabit dil modunda bu motor atlanır; otomatik modda mevcut sıradaki yerini korur. Yeni bir model veya servis eklenmedi, mevcut indirmeler korunur.

Bu ayar yanlış kaynak dil seçimini azaltmak içindir. Mikrofon kalitesi, uzaklık, gürültü veya birden fazla kişinin konuşması tanıma doğruluğunu etkileyebilir; başka dildeki her sesi kusursuz ayırma garantisi verilmez.

## 5. Hikaye ekranı ve testler

Hikaye ekranı açıkken bilgisayarda geniş alan kullanılır; çıkınca uygulamanın eski genişliği geri gelir. Seçenekler içerik alanına göre bir, iki veya üç sütuna yerleşir. Uzun kelimeler harf harf bölünmez. Önizleme boş bir uzun sütuna dönüşmez; Arapça sağdan sola çalışır.

Test sonuçları `tests/test-results-1.10.1.json` içindedir. Gerçek Chromium'da yedi dil, telefon/tablet/bilgisayar genişlikleri, dar masaüstü paneli, hikaye okuma, kaynak dil seçimi ve Play satın alma/iptal arayüzü sınandı. Firebase kuralları gerçek yerel emülatör ve gerçek SDK ile kontrol edildi. Ödeme ve ses sağlayıcılarının yanıtları test verileriyle oluşturuldu. Canlı mağaza ödemesi, öğretmeninizin gerçek sesiyle servis performansı ve fiziksel iOS/Android cihaz testi yapıldığı iddia edilmez.

Resmi kurulum kaynakları: [Netlify ortam değişkenleri](https://docs.netlify.com/build/functions/environment-variables/), [Paddle sandbox](https://developer.paddle.com/sdks/sandbox/), [Play abonelik yaşam döngüsü](https://developer.android.com/google/play/billing/lifecycle/subscriptions), [Play geriye uyumlu temel planlar](https://support.google.com/googleplay/android-developer/answer/12124625).
