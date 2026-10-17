# Lumira 1.9.0 — Yazma Pratiği kotaları ve Canlı Çeviri

Bu paket 1.8.10 üzerine uygulanır. İçindeki dosyaları GitHub deposunun köküne,
klasör yapısını koruyarak yükle. Önceki ses ve kart düzeltmeleri korunmuştur.
Yayın sonrasında Ayarlar → Zorla güncelle yap; sürüm 1.9.0 olmalı.

## Önce tamamlanması gereken kurulum

Canlı Çeviri için projede hazır bir konuşma servisi veya API anahtarı yoktu.
Microsoft Azure Speech bağlantısı eklendi. Aşağıdaki ayarlar olmadan mikrofonla
çeviri başlamaz. Yeni yazma kotaları da Firebase sunucu bağlantısını gerektirir.
Anahtarları GitHub'a, HTML'e veya JavaScript dosyalarına yazma.

Netlify → Site configuration → Environment variables alanına, Functions
kapsamında şu değerleri ekle, ardından yeniden deploy et:

| Değişken | Değer |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Mevcut `mhamzac-ca73d` projesinin Firebase Console → Project settings → Service accounts → Generate new private key ile alınan JSON dosyasının **tam içeriği**. |
| `AZURE_SPEECH_KEY` | Azure Speech kaynağındaki Key 1 veya Key 2. |
| `AZURE_SPEECH_REGION` | Aynı kaynağın bölge kodu, örneğin `westeurope`. |

Netlify, `package.json` ve `package-lock.json` ile Firebase Admin bağımlılığını
kurar. `netlify.toml` Node 22'yi ve functions klasörünü tanımlar.
Build command boş kalabilir; Publish directory mevcut proje kökü (`.`) olmalı.
GitHub Pages tek başına bu sunucu işlevlerini çalıştıramaz.

## Firebase kuralları

Üç yeni yol yalnızca sunucu içindir. Mevcut Realtime Database kurallarına şu
üç kardeş alanı ekle; **bütün kural dosyasını bu örnekle değiştirme**:

```json
"serverFeatureUsage": { ".read": false, ".write": false },
"serverFeatureEntitlements": { ".read": false, ".write": false },
"serverFeaturePurchases": { ".read": false, ".write": false }
```

Üst seviyede herkese yazma/okuma veren bir kural varsa çocuk seviyesindeki
`false` bunu geri alamaz. Bu üç yolun üzerinde genel izin bulunmamalı.
Admin SDK bu yollara sunucudan erişir. Mevcut uygulamanın diğer kurallarını
koru. `progress/{uid}/meta/supportGrants` yönetici hediyeleri ve ilk kayıt
hediyesi için mevcut kaynaktır; kullanıcıların kendilerine keyfi hediye
vermesini engelleyen mevcut kurallar da korunmalıdır.

## Google Play ile alınan rozetler

Yönetici hediyeleri mevcut `supportGrants` kaydından okunur. Cihazdaki yerel
rozet listesi tek başına sunucu kotasını yükseltmez. Play satın alımları
Google Play Developer API üzerinden doğrulanır ve hesaba bağlanır.

- Firebase servis hesabını Google Play Console'da bu uygulamanın satın
  alımlarını görüntüleme/onaylama yetkisiyle ilişkilendir ve ilgili Google
  Cloud projesinde Google Play Android Developer API'yi etkinleştir.
- Farklı bir servis hesabı gerekiyorsa JSON içeriğini
  `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` olarak ekle. Yoksa Firebase hesabı kullanılır.
- Paket adı varsayılan olarak kaynak projedeki `com.lumira.dilkartlari`.
  Play Console'daki ad farklıysa `GOOGLE_PLAY_PACKAGE_NAME` ile belirt.
- Eski satın alımları, Play Store uygulamasında **Destek Ol → Satın alımları
  geri yükle** ile bu hesaba bağla. Aynı satın alım iki hesaba bağlanamaz.

## Uygulanan haklar

| Rozet | Son 30 günde yazma kontrolü | Bir günde canlı çeviri |
| --- | ---: | ---: |
| Rozetsiz | 5 | 5 dakika |
| 👍🏻 Teşekkür | 100 | 100 dakika |
| ☕️ | 200 | 200 dakika |
| ❤️ | 300 | 300 dakika |
| 💛 | 500 | 500 dakika |
| ⭐️ | Sınırsız | Sınırsız |
| 👑 | Sınırsız | Sınırsız |

Birden fazla rozette en yüksek hak kullanılır. Yazma kontrolü kayan 30 günlük
penceredir; her başarılı kontrol 30 gün sonra ayrı ayrı serbest kalır.
Başarısız kontroller hak düşürmez. Aynı işlemin ağ nedeniyle tekrar gönderilmesi
iki kez sayılmaz. Haklar hesaba bağlıdır; cihaz değiştirmek sayacı sıfırlamaz.

Canlı Çeviri günü Europe/Vienna saatine göre 00.00'da yenilenir. İstenirse
`LUMIRA_TIME_ZONE` ile başka bir IANA saat dilimi seçilebilir. Dinleme açıkken,
sessizlik dahil geçen süre sayılır. Kullanılmayan ayrılmış süre Durdur ile
iade edilir. Ani kapanışta en fazla son 15 saniyelik ayrım sayılabilir.
Aynı hesapla eşzamanlı ikinci dinleme oturumu başlatılmaz.

## Canlı Çeviri davranışı ve sınırları

Notlarım'daki Yazma Pratiği düğmesinin altında aynı tasarımlı **🎙️ Canlı Çeviri**
düğmesi vardır. Ekran yalnızca hedef dili, konuşmayı, çeviriyi ve dinleme
kontrollerini gösterir. Kaynak dil Türkçe, Almanca, İngilizce, Arapça, Fransızca,
İspanyolca ve Rusça arasından algılanır; konuşma sırasında dil değişebilir.
Kaynak metin üstte, seçilen hedef dilde çeviri altta görünür.

İzin reddi, bağlantı kopması, süre dolması, sayfadan ayrılma ve hesabın değişmesi
dinlemeyi durdurur. Uygulama ses kaydı saklamaz; ses çevrimiçi Azure Speech'e
gönderilir. Mikrofon HTTPS ve cihazın iznini gerektirir.

Sıfır gecikme veya kusursuz tanıma garantisi yoktur. Kısa ifadeler, gürültü ve
aksan dil algılamayı etkileyebilir. Ekran ara sonuçları gösterir; son sonuçlar
konuşma servisi tarafından güncellenir.

Ana Azure anahtarı tarayıcıya gönderilmez. SDK kısa ömürlü sağlayıcı jetonu
kullanır. Resmî uygulama sunucu süre izinleriyle durur; değiştirilmiş bir istemci
bu jetonu sağlayıcının geçerlilik süresi boyunca kullanabilir. Kötü niyetli
istemcilere karşı kesin maliyet sınırı gerekiyorsa ses trafiğinin sunucudaki
bir WebSocket proxy üzerinden geçirilmesi gerekir. Azure tarafında harcama
izleme ayarını da kendi kullanımına göre yap.

Yazma kontrolü mevcut LanguageTool servisini kullanır. Türkçe LanguageTool
tarafından desteklenmediği için kontrol düğmesi kapalıdır. Ücretsiz servisin
ortak hız sınırına takılınırsa hak düşmeden hata gösterilir. Ücretli hesabın
varsa `LANGUAGETOOL_USERNAME` ve `LANGUAGETOOL_API_KEY` ekleyebilirsin.

## Doğrulama

`node --test tests/features.test.mjs` kota sınırlarını, eşzamanlı istekleri,
başarısız kontrol iadesini, hesap ayrımını ve yaz/kış saati değişimlerini sınar.
Testlerde taklit edilen servislerle masaüstü ve mobil Chromium arayüzü de
kontrol edildi: ekran geçişleri, hedef dil, ara/son sonuçlar, mikrofon izni
reddi, süre sınırı ve bağlantı kopması. Gerçek SDK'nın kullandığımız
yapılandırma metotları ve LanguageTool'un canlı yanıtı ayrıca doğrulandı.
Gerçek Azure anahtarı, Firebase yönetici anahtarı ve cihaz bulunmadığından bu
paketle gerçek konuşma, Play satın alımı veya iPhone mikrofon doğrulaması
yapıldığı iddia edilmez. Kurulumdan sonra telefonda kısa bir Almanca → Türkçe
denemesi yap; ardından Durdur ile mikrofon göstergesinin kapandığını kontrol et.

Başvuru: [Azure Speech dil algılama](https://learn.microsoft.com/azure/ai-services/speech-service/language-identification),
[Firebase Admin kurulumu](https://firebase.google.com/docs/admin/setup),
[Digital Goods satın alım doğrulaması](https://developer.chrome.com/docs/android/trusted-web-activity/receive-payments-play-billing).
