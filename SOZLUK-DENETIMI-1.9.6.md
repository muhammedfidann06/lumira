# Sözlük ve örnek cümle incelemesi — 1.9.6

## Bildirilen hata

`du` kartında kelime eşleşmesi doğruydu; fakat eski kod, Arapçadaki aynı kelimenin bağımsız örneğini Almanca örneğin çevirisi gibi gösteriyordu. Kelime ve cümle eşleştirmesi ayrıldı:

| Kaynak | Arapça karşılığı |
| --- | --- |
| Du bist sehr nett. | أنت لطيف جداً. |
| Geht es dir gut? | هل أنت بخير؟ |

Bu iki cümle artık birbirinin yerine kullanılmaz. Almanca “du” kartının Arapça arka yüzü, gerçek üretim HTML'i üzerinde ayrıca doğrulandı.

## Veri durumu

| Sözlük | Kayıt |
| --- | ---: |
| Almanca | 6.474 |
| İngilizce | 6.352 |
| Arapça | 5.876 |
| Fransızca | 5.961 |
| İspanyolca | 5.935 |
| Rusça | 6.128 |
| Toplam | **36.726** |

1.9.5'te eklenen dokuz kelime ve Almanca yazım düzeltmesi korunmuştur; bu sürümde yeni kelime kaydı eklenmedi. Kelime, Türkçe anlam, kaynak örnek, Türkçe örnek karşılığı, kategori ve sözcük türü alanlarının tümü tarandı; boş zorunlu alan bulunmadı. Seviye, Unicode ve kayıt anahtarı regresyonları geçti.

Paralel cümle dosyasına 30 grup eklendi; toplam **74 grup, yedi dilde 518 metin**. Özellikle Almanca kişi zamirleri, aile ve günlük cümleler genişletildi. Bu dosya çevrimdışı kabuğa dahildir. Eklenen metinler bağımsız profesyonel dil uzmanı incelemesinden geçirilmiş bir veri seti değildir.

Türkçe içermeyen 30 dil yönündeki **124.965 kart eşleşmesi** için statik kaynak ilişkileri yeniden tarandı:

| Örnek karşılığının kaynağı | Kart / dil yönü toplamı |
| --- | ---: |
| Paralel cümle grubu ve kaynak cümle eşleşmesi | 335 |
| Aynı tam Türkçe cümleye bağlı başka sözlük kaydı | 32.306 |
| Statik karşılığı yok; yeni otomatik akış kullanılabilir | 92.324 |

Bunlar benzersiz kelime veya benzersiz cümle sayıları değildir; dil yönleri toplamıdır. **92.324 karşılık önceden üretilip ZIP'e konulmadı.** İlgili karta gelindiğinde ve yakın birkaç kart için ihtiyaç oldukça üretim istenir. İlk üretim giriş, internet, Firebase/Netlify ve çalışan bir mevcut metin sağlayıcısı gerektirir. Sonuç cihazda saklandıktan sonra aynı cihazda çevrimdışı kullanılabilir.

## Yanlış cümlenin karta bağlanmasını önleyen kontroller

- Kelimelerin Türkçe anlamının aynı olması, örnek cümlelerin de aynı olması sayılmaz.
- Paralel grupta kaynak cümle ve Türkçe dayanak birlikte kontrol edilir.
- Otomatik önbellek anahtarı tam kaynak cümle + kaynak dil + hedef dildir; kelime adına dayanmaz.
- Sunucu yalnızca uygulamanın hazır sözlüklerindeki özgün örnek cümleleri kabul eder. Kişisel notlar bu istemciden gönderilmez.
- Yanıt kimlikleri, sayıların korunması, işaretli sayıların işareti, hedef alfabeden metin bulunması ve bazı açık olumsuzluk kalıpları kontrol edilir. Hatalı biçimdeki yanıt başka sağlayıcıya geçişe yol açar.
- Kart veya dil değişiminde geç gelen yanıt yeni kartı değiştirmez. Hesap değişiminde bekleyen istekler iptal edilir. Kartın çevrilmiş yüzü ve sıra konumu asenkron sonuç gelince sıfırlanmaz.
- Üretilmiş sonuç kullanıcıya otomatik çeviri olarak belirtilir. Sonuç yoksa ilgisiz bir örnekle doldurulmaz.

**İncelemenin sınırı:** Alanların tam olması ve kaynak ilişkilerinin doğrulanması, mevcut bütün kelimelerin, Türkçe dayanakların ve cümlelerin dilsel açıdan kusursuz olduğu anlamına gelmez. Her kaydı bağımsız bir dil uzmanıyla yeniden çevirmedik. Olumsuzluk/alfabe/sayı kontrolleri de anlam doğruluğunun ispatı değildir; otomatik çeviri hata yapabilir. Gerçek sağlayıcı anahtarlarıyla bütün cümleleri yeniden üretip kalite ölçümü yapılmadı.

İlerleme ve favoriler için 1.9.5'teki Unicode anahtarları ve güvenli eski kayıt aktarımı korunmuştur. Eski belirsiz kayıtların hangi kelimeye ait olduğu geriye dönük kesin çıkarılamaz; kullanıcıların ilerlemesi topluca sıfırlanmaz.

Makine tarafından okunabilir tam sayımlar: `tests/vocab-audit-1.9.6.json`.
