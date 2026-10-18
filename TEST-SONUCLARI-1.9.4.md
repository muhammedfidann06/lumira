# Lumira 1.9.4 — test sonuçları

## Gerçek modellerle yapılan tarayıcı testi

Üretim kodundaki LocalSession, ses işçisi, Whisper Base ve Bergamot WASM
çalıştırıldı. Ses tanıma ve çeviri sonuçları taklit edilmedi. Test ortamındaki
ağ kısıtlarını aşmak için tam sürümü sabitlenmiş model/çalışma dosyalarının
aynı baytları yerel test sunucusundan verildi. Herkese açık indirme
adreslerinin Lumira alan adına erişim izni ayrıca gerçek HTTP istekleriyle
kontrol edildi: **36/36 model dosyası geçti**.

- Yedi dilde gerçek insan sesi: doğru kaynak dil etiketi ve metin çıktısı.
- Yedi dil arasında **42 yön** için gerçek metin çevirisi.
- Metin çeviri süreleri: bu test makinesinde **0,017–0,842 saniye**; ortanca yaklaşık **0,514 saniye**. Model belleğe alma süresi bazı ölçümlere dahildir.
- Mikrofon girişine verilen konuşma kaydı; `getUserMedia → AudioWorklet → 16 kHz → Whisper → Bergamot → sonuç` yolunu geçti. Konuşmanın sonraki kısmı da ayrı sonuç olarak geldi. Durdur, mikrofon izlerini ve işçileri kapattı.
- Tekrarlanan gerçek çıkarımlar, önbellekten ikinci oturum, bozuk indirme, geçici 503, bozuk önbelleğin onarılması ve Service Worker güncellemesinde modellerin korunması geçti.
- Tarayıcı hatası veya eksik dosya: **0**. Hata senaryosunda bilerek verilen 503 ağ kaydı beklenen test girdisidir.

Aşağıdaki süreler **ses kaydı işlendikten sonraki çıkarım süresidir**.
Sesin birikmesi için beklenen 4–20 saniyelik pencere bunlara dahil değildir;
bu tablo “bir saniyede canlı ses çevirisi” iddiası anlamına gelmez.

| Kaynak dil | Ses tanıma + Türkçeye çeviri | Algılanan dil |
| --- | --- | --- |
| de | 8.71 sn | de |
| tr | 6.93 sn | tr |
| ar | 9.57 sn | ar |
| fr | 7.50 sn | fr |
| es | 7.70 sn | es |
| ru | 7.96 sn | ru |
| en | 6.63 sn | en |

Türkçe hedef ile Türkçe kaynakta metin aynen gösterilir. Testte özellikle
Arapça ve Türkçe kaynak seslerde tanıma hataları görüldü; bazı çevirilerde
anlam/olumsuzluk hataları da var. “Çalıştı” ifadesi modelin sıfır dil hatası
yaptığı anlamına gelmez. Gerçek çıktılar, saklanmadan seçilmemiş tüm 42 yönle
birlikte `tests/live-local-real-results.json` içindedir.

## Karşılaştırılan seçenekler

| Seçenek | Sonuç ve karar |
| --- | --- |
| Cevirist’in herkese açık web istemcisi | Küçük PCM ses parçaları, sürekli WebSocket ve kısmi metin/ses sonuçları kullanıyor. Gemini/OpenAI sağlayıcı ve yedek geçişi tanımları var. Dakika kredili bulut sistemi; yeni anahtar istemeden sınırsız ücretsiz altyapı sunmuyor. Hesaba giriş yapılmadı, kredi harcanmadı; 1 saniye iddiası bağımsız gecikme ölçümüyle doğrulanmadı. |
| Whisper Tiny + Whisper’ın İngilizceye çevirme görevi | Gerçek çok dilli örneklerde anlamı bozdu. Son paketten çıkarıldı. |
| Whisper Base + aynı İngilizceye çevirme görevi | Ses tanıma dışında Whisper’a çeviri yaptırmak kullanılmıyor. |
| Genel Marian/Opus çok dilli çeviri | Türkçede anlam bozulması ve cümle atlama görüldü; son paketten çıkarıldı. |
| Büyük İngilizce–Türkçe Opus modeli | Sözcük dizilimi düzeltildikten sonra çalıştı; yaklaşık 540 MB tek yön ve daha yüksek kaynak kullanımı nedeniyle seçilmedi. |
| Whisper Base, fp32 encoder | Denenen zor Türkçe/Arapça örneklerde yeterli doğruluk kazancı sağlamadı, daha yavaştı; seçilmedi. |
| Whisper Small, q8 | Bazı zor örneklerde daha doğruydu; aynı CPU deneyinde Base’e göre yaklaşık 2–3 kat yavaştı. Telefon üzerindeki sürekli akış için seçilmedi. |
| Chrome yerleşik Translator API | Telefon desteği bütün cihazlarda olmadığı için buna bağımlı bir çözüm seçilmedi. |
| Tarayıcı Web Speech Recognition | Tarayıcı/servis desteği değişken ve otomatik kaynak dil için eşdeğer değil; tek güvenilir yedek olarak kullanılmadı. |
| **Whisper Base q8 + Firefox/Bergamot** | Denenen seçenekler içinde boyut, hız ve çok dilli metin çevirisi dengesi için seçildi. Ses tanıma kusursuz değildir; yeterli cihaz kaynağı gerektirir. |

## Hata ve uzun oturum benzetimleri

Gerçek üretim arayüzü ve Speech SDK kullanıldı; Azure hizmet sonuçları ve
sunucu yanıtları kontrollü olarak taklit edildi. Bunlar gerçek Azure/Firebase
aboneliğine üç saatlik ses gönderildiği anlamına gelmez.

- Azure kota/eşzamanlılık reddi → ücretsiz yedek.
- Başlatırken bozuk/eksik Azure bağlantısı, SDK başlatma hatası ve token yenileme kesintisi → ücretsiz yedek.
- Hazır yedek varken Azure kimlik doğrulama hatasında yeniden bağlantı beklemeden geçiş.
- Önceki metnin ve asıl mikrofonun korunması; eski Azure olaylarının ve geç dönen sunucu yanıtının yeni oturumu bozamaması.
- **Üç saatlik hızlandırılmış yerel oturum: 2.160 yenileme**, Azure token yenileme isteği yok.
- Azure için bir saatlik benzetim: **720 yenileme**, token yenilenmesi ve oturum yeniden bağlanması.
- Gün sınırı, süresi biten oturum ve günlük hakların tükenmesi.
- Hazırlık sırasında Durdur; sonradan mikrofonun açılmaması ve yeni hak rezervasyonu yapılmaması.
- Yedeğin indirme hatasının çalışan Azure’yi durdurmaması; desteklenmeyen cihazda açık hata.
- Sonraki Başlat’ta Azure’nin yeniden denenmesi.

## Diğer doğrulamalar

- `node --test tests/*.test.mjs`: **20 geçti, 0 başarısız, 1 atlandı**. Atlanan test gerçek Firebase Emulator ortamını gerektiriyor.
- Netlify’nin paketleyicisi ile `features` ve `tts` işlevleri paketlendi. Ayrı klasörde Node 22 altında Firebase Admin app/auth/database modülleri ve kimliksiz endpoint yanıtı doğrulandı.
- Ana sekmeler ve 320–480 piksel telefon genişlikleri kontrol edildi; diğer sekmeye geçince mikrofonun kapandığı doğrulandı.
- Canlı sitene deploy yapılmadı. Gerçek Azure anahtarı veya Firebase servis hesabı bu testlere verilmedi.

## Sınırlar

Fiziksel telefon/APK ve gerçek üç saatlik telefon oturumu burada denenmedi.
Tüm Chromium işlemlerinin RSS toplamı deney boyunca yaklaşık 2,1–3,3 GiB
aralığındaydı; paylaşılan bellek birden fazla sayılabildiğinden bu rakam
telefon için kesin RAM gereksinimi değildir. Yine de düşük bellekli
telefonlarda evrensel çalışma veya bir saniye gecikme garantisi verilemez.
İlk model indirmesi bitmeden “kullanıcı hiç beklemez” garantisi de yoktur.

## Kaynaklar

- https://cevirist.com/
- https://cevirist.com/assets/index-AW81ujmu.js
- https://github.com/mozilla/translations
- https://github.com/browsermt/bergamot-translator
- https://huggingface.co/Xenova/whisper-base
- https://huggingface.co/datasets/google/fleurs — örnek konuşma verileri, CC BY 4.0.
- https://developer.chrome.com/docs/ai/translator-api
- https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
- https://docs.cloud.google.com/storage/docs/cross-origin
- https://docs.cloud.google.com/storage/docs/request-endpoints
- https://azure.microsoft.com/en-us/pricing/details/cognitive-services/speech-services/
