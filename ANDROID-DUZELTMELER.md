# Lumira — Android ekran uyumu

Tarih: 16 Eylül 2026. Web önbellek sürümü: `v1.8.5`.

Bu paket web uygulamasını düzenler. APK/AAB veya derlenmiş Android uygulaması değildir.
Play Console'daki dört önerinin tamamının giderildiği anlamına gelmez; native
Android projesi gönderilen ZIP'te bulunmuyor.

## Yükleme

`lumira-android-degisen-dosyalar-v2.zip` içindeki şu dosyaları mevcut GitHub
projenizde aynı konumdaki dosyaların yerine birlikte yükleyin:

| Dosya | Değişiklik |
| --- | --- |
| `index.html` | Android'e özel yerleşim işareti, destekleyen Android tarayıcılarda klavyeye göre viewport küçülmesi, yeni CSS sürüm adresi. |
| `pwa.css` | Android'e özel taşma, kart yüksekliği, dar ekran, güvenli alan ve panel düzeltmeleri. |
| `manifest.json` | PWA'nın dikey yön kilidi kaldırıldı: `orientation: any`. Mevcut native uygulamanın kilidini tek başına kaldırmaz. |
| `sw.js` | Önbellek sürümü güncellendi; güncellemeden sonraki ilk çevrimdışı açılışta sürüm ekli CSS/JS dosyaları aynı sürümün çekirdek önbelleğinden de bulunabilir. |
| `progress.js` | Notlarım ve Yazma Pratiği açıkken native arayüz dili değişince ekranı anında yeniler; yazılan metin ve hata sonucu korunur. Kısa Personal metinleri de seçili dile uyar. |
| `pwa.js` | Dil ayarı değişiminde Personal ana ekranını zorla açmak yerine mevcut Notlarım/Yazma Pratiği akışını yeniler. |

Bu açıklama dosyası isteğe bağlıdır; uygulamanın çalışması için gerekli değildir.
Tam proje ZIP'i de aynı değişiklikleri içerir. İki paketi birden yüklemek gerekmez.
Dosyaları yükledikten sonra kullandığınız barındırma hizmetinin yayını tamamlanmalıdır.
Uygulama yeni sürüm bildirdiğinde güncelleyin; uygulamayı yeniden açıp kontrol edin.
Bu işlem için uygulama verilerini veya kullanıcı kayıtlarını silmeyin.

## Düzeltilen davranışlar

- Android başlığı, sekmeleri ve düğmeleri dar alanda kırpılmadan yerleşir.
- Kelime kartının 300 px alt sınırı korunur; uzun kelime veya cümlede kartın
  iki yüzü birlikte büyür. Kart çevirme ve telaffuz düğmeleri korunur.
- Giriş kutusu kısa ekrana sığar; içeriği kaydırılarak Başla düğmesine ulaşılır.
- Kategori, bilgi ve ayar panelleri görünen ekran yüksekliğini ve güvenli
  kenar boşluklarını dikkate alır. Dinamik viewport desteği yoksa `vh` yedeği kullanılır.
- Android'de masa/kahve dekoru içeriğin arkasına alınır; kelimeleri örtmez.
  Kategori ve bilgi paneli açıkken yüzen ayar düğmesi panelin önüne geçmez.
- Açılış ekranındaki sıralama tablosu üzerinden dikey kaydırma yapılabilir.
- Önbellek güncellemesi sözlük önbelleğini, yerel kayıtları veya Firebase verilerini silmez.
- Notlarım'da seçilen kelime dili, ana Kartlar dil çiftinden bağımsız tutulur;
  kart/quiz etiketi, yazı yönü, örnek cümle ve seslendirme seçilen dile göre kalır.
- Native arayüz dili Türkçe ↔ İngilizce (ve diğer desteklenen diller) arasında
  değiştirilince Notlarım ve Yazma Pratiği açık akışı kaybolmaz; yazı metni ile
  LanguageTool hata sonucu yeni arayüz diliyle yeniden çizilir.

Yerleşim düzeltmeleri `html.lumira-android` altında sınırlandı. Safari/iOS ve
masaüstündeki mevcut CSS kuralları ve viewport ayarı değiştirilmedi. Manifestteki
yön serbestliği onu destekleyen kurulu PWA'lar için geçerlidir.
Yeni kütüphane, sürekli çalışan ölçüm döngüsü veya resize/scroll dinleyicisi eklenmedi.

## Doğrulama ve sınırlar

Chromium 153 üzerinde şu Android ekran ölçüleriyle kontroller yapıldı:
320×568, 360×640, 393×851, 412×915, 600×800, 800×360, 1280×800.

- Kartta ileri/geri gitme ve çevirme; kategori seçimi; quiz yanıtı; Notlarım,
  Kişisel ve Kartlar arasında geçiş; bilgi ve ayar panelleri kontrol edildi.
- 300 px yüksekliğindeki görünür alanda giriş paneli ve Başla düğmesinin
  erişilebilirliği kontrol edildi. Bu, klavyenin bıraktığı alanın benzetimidir.
- Altı dilin yüklenmesi ve her dilde uzun kelime/örnek/çeviri içeren toplam
  24 gerçek sözlük örneğinin 320 px ekranda karta sığması kontrol edildi.
- iPhone (390×844), iPad (834×1194) benzetimleri ve masaüstünde (1440×900)
  ana bileşenlerin yerleşim ölçüleri, fontları ve boşlukları önceki sürümle aynı çıktı.
  Bu karşılaştırmalar Chromium'da yapıldı; gerçek Safari/WebKit testi değildir.
- Eski service worker'dan yeni sürüme geçiş ve ardından çevrimdışı yeniden
  açılış ayrıca denetlendi. Test kaydı ve mevcut sözlük önbelleği korundu.
- Değişen JavaScript ve JSON dosyalarının sözdizimi kontrol edildi.
- Native arayüz dili İngilizce → Türkçe → İngilizce çevrilirken Notlarım ve
  Yazma Pratiği yeniden çizildi; seçili Fransızca metin LanguageTool'a `fr`
  olarak gönderildi ve hata vurgusu/sonucu kontrol edildi.
- Global hedef Almanca iken Notlarım'dan İngilizce çalışma başlatıldığında
  kartın ön etiketi/kelimesi İngilizce, arka etiketi Türkçe kaldı.

Fiziksel Android/iPhone testi ve WebKit çalıştırması bu ortamda yapılamadı.
Firebase ve dış ses servisleri yerel testlerde engellendi; canlı kullanıcı verisi
yazılmadı. Hesap senkronizasyonu ve gerçek ses çıkışı bu testlerin kapsamı dışındadır.
Sözlük dosyaları, kimlik doğrulama, ayrı ses modülü ve imza doğrulama dosyaları dahil
orijinal 82 kaynak dosyanın 76'sı bayt düzeyinde aynen korundu; arşivdeki yeni
açıklama dosyasıyla birlikte toplam 83 dosya bulunur.

## Play Console'daki öneriler için gereken Android kaynakları

| Ekrandaki öneri | Bu paketteki durum | Native projede yapılması gereken |
| --- | --- | --- |
| Uçtan uca ekran | Web panelleri güvenli alan ve dinamik yüksekliğe uyarlanmıştır. Native pencere davranışı doğrulanmadı. | Gerçek LauncherActivity/TWA kabuğunda edge-to-edge ve sistem çubukları test edilmeli. |
| Eski durum/gezinme çubuğu API'leri | Web dosyaları bu Java API çağrılarını değiştiremez. | Ekranda adı geçen `android-browser-helper` bağımlılığı ve ilgili Activity kodu incelenmeli; uygun bağımlılık/kod değişikliği yapılmalı. |
| Yön ve yeniden boyutlandırma kısıtları | Web manifesti serbest yönlüdür. | `LauncherActivity.onCreate`, AndroidManifest ve gerçek paketleme ayarları kontrol edilerek native kilit kaldırılmalı. |
| R8/kaynak optimizasyonu | Gradle projesi gönderilmediği için uygulanmadı. | Projeyle uyumlu Gradle/AGP sürümleri belirlenmeli; release derlemesinde kod ve kaynak optimizasyonu etkinleştirilip derlenmiş paket test edilmeli. |

Tam düzeltme için PWABuilder/Bubblewrap'in oluşturduğu Android kaynak ZIP'i
veya Android Studio projesi gerekir: `app/build.gradle` ya da `.kts`, kök Gradle
dosyaları, `gradle.properties`, wrapper ayarları, `AndroidManifest.xml`,
`LauncherActivity.java`/`.kt` ve mevcut ProGuard kuralları.
İmza anahtarını, keystore dosyasını veya şifresini paylaşmanız gerekmez.

Arşivdeki `twa-manifest.json` eski alan adı yer tutucuları ve sürüm bilgileri
içeren bir şablondur; yayındaki Android paketin gerçek yapılandırması kabul
edilmedi ve otomatik değiştirilmedi. CSS ile tarayıcı adres çubuğu gizlenemez;
TWA'da gerçek adres çubuğu görünüyorsa paket/origin/Digital Asset Links doğrulaması
ayrıca incelenmelidir. Mevcut `assetlinks.json` dosyaları aynen korundu.

Native düzeltmelerden sonra yeni AAB oluşturulup Play Console'a yeni sürüm olarak
yüklenir; yalnızca web dosyalarını yayınlamak mevcut AAB'nin analizini değiştirmez.

## Teknik kaynaklar

- [Chrome: Android edge-to-edge ve güvenli alanlar](https://developer.chrome.com/docs/css-ui/edge-to-edge)
- [Chrome: Klavye açılırken viewport davranışı](https://developer.chrome.com/blog/viewport-resize-behavior)
- [Android: Edge-to-edge yerleşim](https://developer.android.com/develop/ui/views/layout/edge-to-edge)
- [Android 16: Uyarlanan pencere ve yön davranışı](https://developer.android.com/about/versions/16/behavior-changes-16)
- [Android: R8 optimizasyonunu etkinleştirme](https://developer.android.com/topic/performance/app-optimization/enable-app-optimization)
