# Sözlük incelemesi — Lumira 1.9.5

## Bildirilen hatanın kaynağı ve düzeltmesi

Almanca `du` kelimesi Türkçe `sen` üzerinden Arapça `أنت` ile eşleşiyordu. Ancak iki kaydın örnekleri farklıydı:

- Almanca: `Du bist sehr nett.` → `Sen çok naziksin.`
- Arapça sözlükteki bağımsız örnek: `هل أنت بخير؟` → `İyi misin?`

Eski kod, kelimeler eşleştiği için bu iki bağımsız cümleyi de birbirinin çevirisi sayıyordu. Yeni kartta Almanca örneğin karşılığı **أنت لطيف جداً.** gösterilir. Gerçek üretim HTML'i üzerinde bu metin ve sağdan sola yön doğrulandı.

## Bütün veri üzerinde yapılan kontroller

| Dil | Önceki kayıt | Yeni kayıt |
| --- | ---: | ---: |
| Almanca | 6.473 | 6.474 |
| İngilizce | 6.348 | 6.352 |
| Arapça | 5.875 | 5.876 |
| Fransızca | 5.960 | 5.961 |
| İspanyolca | 5.934 | 5.935 |
| Rusça | 6.127 | 6.128 |
| Toplam | 36.717 | **36.726** |

Tüm kayıtlarda kelime, Türkçe anlam, örnek, örneğin Türkçe karşılığı, seviye, kategori ve sözcük türü alanları tarandı; boş zorunlu alan bulunmadı. Bozuk Unicode karakterleri, geçersiz seviyeler, Firebase anahtar güvenliği ve kelimelerin yanlışlıkla aynı ilerleme / favori kaydını kullanması kontrol edildi.

Dokuz ekleme: `Sie (höflich)`, `yours`, `hers`, `ours`, `theirs`, `أنتِ`, Fransızca `smartphone`, İspanyolca `teléfono inteligente`, Rusça `смартфон`.

Almanca örnekte `Er lernt schnell deutsch.` yazımı **Er lernt schnell Deutsch.** olarak düzeltildi. Mevcut kelimeler veya farklı seviyedeki kullanım örnekleri topluca silinmedi.

## Çapraz dil mantığı

- Türkçe karşılıkta `bir`, `biraz` gibi anlam taşıyan parçalar artık silinmez.
- Bilinen sözcük türleri uyuşmuyorsa eşleşme reddedilir; örneğin Türkçe `yüz` üzerinden sayı ile yüz/çehre birleştirilmez.
- Aynı sözcüğün farklı seviyelerdeki aynı anlamı artık sırf tekrarlandığı için gereksiz yere kaybolmaz. Birden çok farklı kelimeyle belirsiz eşleşmeler yine kullanılmaz.
- Cümle çevirisi, ayrıca incelenmiş paralel örnekten veya **aynı tam Türkçe cümleye** bağlı yerel kayıttan gelir. İncelenen paralel örneğin kaynak cümlesi de doğrulanır.
- 44 cümle grubu yedi dilde eklendi. API çağrısı veya yeni model indirmesi gerekmez; bu dosyalar çevrimdışı kabuktadır.
- Diğer dil çiftlerinde Arapça sağdan sola metin ve arka yüz seslendirme dili düzeltildi. Deftere eklenen çapraz favorinin anlam dili korunur.
- Kullanıcı kendi defterindeki örneği değiştirirse eski cümlenin çevirisi yeni cümleye iliştirilmez.

**İncelemenin sınırı:** 36.726 kaydın tamamını bağımsız dil uzmanlarıyla yeniden çevirmedik. Otomatik alan / eşleşme kontrolleri, bütün eski sözcüklerin ve cümlelerin dilsel olarak kusursuz olduğu anlamına gelmez. Türkçe içermeyen 30 dil yönünde toplam 124.965 kart eşleşmesi incelendi. Bu sürümde 32.563 örnek için cümle düzeyinde kaynak eşleşmesi vardır; kalan 92.402 örnek eşleşmesinde özgün kaynak cümle korunur ve çevirisinin henüz hazır olmadığı kullanıcının dilinde belirtilir. Bu sayılar dil yönleri toplamıdır; benzersiz kelime sayısı değildir. Alakasız bir cümle, eksik çeviriyi gizlemek için gösterilmez.

## İlerleme kayıtları

Eski ilerleme anahtarı Arapça ve Rusça harfleri `_` işaretine çeviriyordu; farklı sözcükler aynı kayda düşebiliyordu. Yeni anahtarlar Unicode ve noktalama ayrımını korur. Eski anahtar yalnızca tek bir sözcüğü belirtiyorsa çalışma sayıları yeni anahtara aktarılır. Belirsiz eski kaydın hangi sözcüğe ait olduğu geri çıkarılamaz; bütün benzer anahtarlı sözcükleri öğrenilmiş saymak yerine kayıt ayrı korunur. Sunucudaki eski kayıtlar topluca silinmez; XP ve rozet verileri sıfırlanmaz.

Makine tarafından okunabilen sonuçlar: `tests/vocab-audit-1.9.5.json`.
