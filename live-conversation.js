/* Canlı Çeviri girişi ve Karşılıklı Çeviri.
   Mevcut canlı çeviri (live-translate.js) olduğu gibi kalır; bu dosya yalnızca
   önüne bir seçim ekranı koyar ve ayrı bir yüz yüze çeviri ekranı sunar.
   Üst yarı: A dilinde konuşulan → B diline çeviri. Alt yarı: B → A.
   Sunucu tarafında aynı canlı çeviri kotası ve oturum kuralları kullanılır. */
(function(root){'use strict';
// CORE dilleri canlı çeviriyle aynı yolları kullanır; diğerleri yalnızca bu
// ekranda, Azure konuşma tanıma ve metin çevirisiyle sunulur.
const CORE=['de','tr','en','ar','fr','es','ru'];
const EXTRA=['uk','fa','pl','ro','it','sq','bs','hr','sr','pt','bg','el','hu','nl','ps','zh','hi'];
const LANGS=[...CORE,...EXTRA];
const FLAGS={tr:'🇹🇷',de:'🇩🇪',en:'🇬🇧',ar:'🇸🇦',fr:'🇫🇷',es:'🇪🇸',ru:'🇷🇺',uk:'🇺🇦',fa:'🇮🇷',pl:'🇵🇱',ro:'🇷🇴',it:'🇮🇹',sq:'🇦🇱',bs:'🇧🇦',hr:'🇭🇷',sr:'🇷🇸',pt:'🇵🇹',bg:'🇧🇬',el:'🇬🇷',hu:'🇭🇺',nl:'🇳🇱',ps:'🇦🇫',zh:'🇨🇳',hi:'🇮🇳'};
const LOCALES={tr:'tr-TR',de:'de-DE',en:'en-US',ar:'ar-SA',fr:'fr-FR',es:'es-ES',ru:'ru-RU',uk:'uk-UA',fa:'fa-IR',pl:'pl-PL',ro:'ro-RO',it:'it-IT',sq:'sq-AL',bs:'bs-BA',hr:'hr-HR',sr:'sr-RS',pt:'pt-PT',bg:'bg-BG',el:'el-GR',hu:'hu-HU',nl:'nl-NL',ps:'ps-AF',zh:'zh-CN',hi:'hi-IN'};
const AZURE_TARGET={sr:'sr-Latn',pt:'pt-pt',zh:'zh-Hans'},MYMEMORY={sr:'sr-Latn',pt:'pt-PT',zh:'zh-CN'};
const azureTarget=code=>AZURE_TARGET[code]||code;
const HISTORY_MAX=20,HISTORY_ROWS=200;
const COPY={
 tr:{eyebrow:'LUMIRA · CANLI ÇEVİRİ',modesTitle:'Nasıl çevirelim?',modesIntro:'Bir dersi ya da konuşmayı dinleyip çevir veya iki kişi arasında karşılıklı tercüman olarak kullan.',liveTitle:'Canlı Çeviri',liveDesc:'Ders, video veya konuşmayı dinler; söyleneni anında seçtiğin dile çevirir.',convoTitle:'Karşılıklı Çeviri',convoDesc:'İki kişi, iki dil: üstte bir dil, altta diğeri. Her konuşma karşı tarafın diline çevrilir.',back:'Geri',top:'Üst taraf',bottom:'Alt taraf',swap:'Dilleri değiştir',speak:'{lang} konuş',listening:'Dinleniyor… durdurmak için dokun',switchTo:'{lang} konuşmaya geç',auto:'Konuşulan dili otomatik algıla',autoStart:'Dinlemeyi başlat',autoStop:'Dinlemeyi durdur',autoListening:'İki dil de dinleniyor — sırayla konuşun.',speakAloud:'Çevirileri sesli oku',clear:'Temizle',empty:'{from} konuşulanlar burada {to} diline çevrilir.',starting:'Mikrofon ve bağlantı hazırlanıyor…',ready:'Konuşacak kişi kendi tarafındaki mikrofona dokunsun.',readyAuto:'Başlat’a dokunun; konuşulan dil otomatik algılanır.',sameLang:'İki taraf için farklı iki dil seç.',pending:'Çevriliyor…',failedTranslation:'Çeviri şu an yapılamadı.',browserMode:'Bu cihazda tarayıcının konuşma tanıması kullanılıyor; otomatik dil algılama yerine sırayla konuşun.',autoFallback:'Otomatik algılama başlatılamadı; sırayla konuşma moduna geçildi.',remaining:'Kalan süre: {n} dk',unlimited:'Süre sınırı yok',tip:'İpucu: Telefonu ikinizin arasına koyun. Konuşan kişi kendi tarafındaki düğmeye dokunur.',transcript:'📄 Döküm',history:'🕘 Geçmiş',keep:'Konuşmaları bu cihazda sakla',transcriptTitle:'Konuşma dökümü',historyTitle:'Kayıtlı konuşmalar',historyNote:'Konuşmalar yalnızca bu cihazda saklanır; hesabına yüklenmez. İstediğin zaman silebilirsin.',historyEmpty:'Henüz kayıtlı konuşma yok.',transcriptEmpty:'Henüz çevrilen bir konuşma yok.',copy:'Kopyala',copied:'Döküm kopyalandı.',copyFailed:'Kopyalanamadı.',share:'Paylaş',download:'İndir (.txt)',print:'Yazdır / PDF',printHint:'PDF olarak kaydetmek için yazdırma ekranında “PDF olarak kaydet”i seç.',close:'Kapat',deleteOne:'Sil',deleteAll:'Tümünü sil',confirmDeleteAll:'Bu cihazdaki tüm kayıtlı konuşmalar silinsin mi?',lines:'{n} cümle',backToHistory:'Geçmiş',moreLangs:'Diğer diller',appName:'Lumira · Karşılıklı Çeviri',words:'📒 Kelimeler',wordsTitle:'Notlarım’a kelime ekle',wordsIntro:'Konuşmadaki {lang} kelimeler aşağıda. Öğrenmek istediklerine dokun; anlamlarını {native} olarak getirip Notlarım’a kaydederiz.',wordsNone:'Bu konuşmada kaydedilecek kelime bulunamadı.',wordsUnsupported:'Notlarım şu dilleri destekler: {list}. Bu konuşmada bu dillerden biri yok.',wordsPick:'Seçilenlerle devam et ({n})',wordsMax:'Tek seferde en fazla {n} kelime seçebilirsin.',wordsReview:'{lang} kelimeyi ve {native} anlamını kontrol et, gerekirse düzelt. Örnek cümle konuşmadan alınır.',wordsWord:'Kelime',wordsMeaning:'Anlamı',wordsLoading:'Anlam getiriliyor…',wordsMeaningFailed:'Anlam bulunamadı; kendin yazabilirsin.',wordsSave:'📒 Notlarım’a ekle ({n})',wordsSaving:'Kaydediliyor…',wordsSaved:'{n} kelime Notlarım’a eklendi.',wordsLogin:'Notlarım’a kaydetmek için giriş yap.',wordsFailed:'Kaydedilemedi. Bağlantını kontrol edip tekrar dene.',wordsBack:'Kelime seçimine dön',wordsInNotes:'Zaten Notlarım’da',wordsRemove:'Listeden çıkar',wordsUnavailable:'Notlarım şu anda kullanılamıyor.',backToTranscript:'Döküme dön'},
 en:{eyebrow:'LUMIRA · LIVE TRANSLATION',modesTitle:'How should we translate?',modesIntro:'Listen to a lesson or talk and translate it, or use the app as an interpreter between two people.',liveTitle:'Live Translation',liveDesc:'Listens to a lesson, video or talk and translates it into your chosen language instantly.',convoTitle:'Face-to-face Translation',convoDesc:'Two people, two languages: one language on top, the other below. Each turn is translated for the other person.',back:'Back',top:'Top side',bottom:'Bottom side',swap:'Swap languages',speak:'Speak {lang}',listening:'Listening… tap to stop',switchTo:'Switch to {lang}',auto:'Detect the spoken language automatically',autoStart:'Start listening',autoStop:'Stop listening',autoListening:'Both languages are being heard — take turns speaking.',speakAloud:'Read translations aloud',clear:'Clear',empty:'{from} speech appears here, translated into {to}.',starting:'Preparing the microphone and connection…',ready:'Whoever speaks taps the microphone on their side.',readyAuto:'Tap Start; the spoken language is detected automatically.',sameLang:'Choose two different languages.',pending:'Translating…',failedTranslation:'The translation is not available right now.',browserMode:'This device uses the browser’s speech recognition; take turns instead of automatic detection.',autoFallback:'Automatic detection could not start; switched to taking turns.',remaining:'Time left: {n} min',unlimited:'No time limit',tip:'Tip: place the phone between you. The speaker taps the button on their side.',transcript:'📄 Transcript',history:'🕘 History',keep:'Keep conversations on this device',transcriptTitle:'Conversation transcript',historyTitle:'Saved conversations',historyNote:'Conversations are stored only on this device and are not uploaded to your account. You can delete them at any time.',historyEmpty:'No saved conversations yet.',transcriptEmpty:'Nothing has been translated yet.',copy:'Copy',copied:'Transcript copied.',copyFailed:'Could not copy.',share:'Share',download:'Download (.txt)',print:'Print / PDF',printHint:'To save a PDF, choose “Save as PDF” in the print dialog.',close:'Close',deleteOne:'Delete',deleteAll:'Delete all',confirmDeleteAll:'Delete all saved conversations on this device?',lines:'{n} lines',backToHistory:'History',moreLangs:'More languages',appName:'Lumira · Face-to-face Translation',words:'📒 Words',wordsTitle:'Add words to Notebook',wordsIntro:'Here are the {lang} words from the conversation. Tap the ones you want to learn; we fetch their meanings in {native} and save them to your Notebook.',wordsNone:'No words to save were found in this conversation.',wordsUnsupported:'Notebook supports these languages: {list}. This conversation does not include any of them.',wordsPick:'Continue with selected ({n})',wordsMax:'You can select up to {n} words at a time.',wordsReview:'Check each {lang} word and its {native} meaning and correct them if needed. The example sentence comes from the conversation.',wordsWord:'Word',wordsMeaning:'Meaning',wordsLoading:'Fetching meaning…',wordsMeaningFailed:'No meaning found; you can type it yourself.',wordsSave:'📒 Add to Notebook ({n})',wordsSaving:'Saving…',wordsSaved:'{n} words added to your Notebook.',wordsLogin:'Sign in to save words to your Notebook.',wordsFailed:'Could not save. Check your connection and try again.',wordsBack:'Back to word selection',wordsInNotes:'Already in your Notebook',wordsRemove:'Remove from list',wordsUnavailable:'Notebook is not available right now.',backToTranscript:'Back to transcript'},
 de:{eyebrow:'LUMIRA · LIVE-ÜBERSETZUNG',modesTitle:'Wie möchtest du übersetzen?',modesIntro:'Hör einem Unterricht oder Gespräch zu und übersetze es, oder nutze die App als Dolmetscher zwischen zwei Personen.',liveTitle:'Live-Übersetzung',liveDesc:'Hört Unterricht, Videos oder Gespräche und übersetzt sofort in deine Sprache.',convoTitle:'Gesprächsübersetzung',convoDesc:'Zwei Personen, zwei Sprachen: oben die eine, unten die andere. Jeder Beitrag wird für die andere Person übersetzt.',back:'Zurück',top:'Obere Seite',bottom:'Untere Seite',swap:'Sprachen tauschen',speak:'{lang} sprechen',listening:'Hört zu… zum Stoppen tippen',switchTo:'Zu {lang} wechseln',auto:'Gesprochene Sprache automatisch erkennen',autoStart:'Zuhören starten',autoStop:'Zuhören beenden',autoListening:'Beide Sprachen werden gehört — sprecht abwechselnd.',speakAloud:'Übersetzungen vorlesen',clear:'Leeren',empty:'Gesprochenes auf {from} erscheint hier, übersetzt ins {to}.',starting:'Mikrofon und Verbindung werden vorbereitet…',ready:'Wer spricht, tippt auf das Mikrofon auf seiner Seite.',readyAuto:'Tippe auf Starten; die Sprache wird automatisch erkannt.',sameLang:'Wähle zwei verschiedene Sprachen.',pending:'Wird übersetzt…',failedTranslation:'Die Übersetzung ist gerade nicht verfügbar.',browserMode:'Dieses Gerät nutzt die Spracherkennung des Browsers; sprecht abwechselnd statt mit automatischer Erkennung.',autoFallback:'Die automatische Erkennung startete nicht; abwechselndes Sprechen ist aktiv.',remaining:'Restzeit: {n} Min.',unlimited:'Ohne Zeitlimit',tip:'Tipp: Leg das Handy zwischen euch. Wer spricht, tippt auf die Taste auf seiner Seite.',transcript:'📄 Protokoll',history:'🕘 Verlauf',keep:'Gespräche auf diesem Gerät speichern',transcriptTitle:'Gesprächsprotokoll',historyTitle:'Gespeicherte Gespräche',historyNote:'Gespräche werden nur auf diesem Gerät gespeichert und nicht in dein Konto hochgeladen. Du kannst sie jederzeit löschen.',historyEmpty:'Noch keine gespeicherten Gespräche.',transcriptEmpty:'Noch nichts übersetzt.',copy:'Kopieren',copied:'Protokoll kopiert.',copyFailed:'Kopieren nicht möglich.',share:'Teilen',download:'Herunterladen (.txt)',print:'Drucken / PDF',printHint:'Für ein PDF wähle im Druckdialog „Als PDF speichern“.',close:'Schließen',deleteOne:'Löschen',deleteAll:'Alle löschen',confirmDeleteAll:'Alle gespeicherten Gespräche auf diesem Gerät löschen?',lines:'{n} Sätze',backToHistory:'Verlauf',moreLangs:'Weitere Sprachen',appName:'Lumira · Gesprächsübersetzung',words:'📒 Wörter',wordsTitle:'Wörter zu Notizen hinzufügen',wordsIntro:'Hier sind die Wörter auf {lang} aus dem Gespräch. Tippe auf die Wörter, die du lernen willst; wir holen ihre Bedeutung auf {native} und speichern sie in deinen Notizen.',wordsNone:'In diesem Gespräch wurden keine Wörter zum Speichern gefunden.',wordsUnsupported:'Notizen unterstützen diese Sprachen: {list}. Keine davon kommt in diesem Gespräch vor.',wordsPick:'Mit Auswahl weiter ({n})',wordsMax:'Du kannst höchstens {n} Wörter auf einmal auswählen.',wordsReview:'Prüfe jedes Wort ({lang}) und seine Bedeutung ({native}) und korrigiere sie bei Bedarf. Der Beispielsatz stammt aus dem Gespräch.',wordsWord:'Wort',wordsMeaning:'Bedeutung',wordsLoading:'Bedeutung wird geladen…',wordsMeaningFailed:'Keine Bedeutung gefunden; du kannst sie selbst eintragen.',wordsSave:'📒 Zu Notizen hinzufügen ({n})',wordsSaving:'Wird gespeichert…',wordsSaved:'{n} Wörter zu deinen Notizen hinzugefügt.',wordsLogin:'Melde dich an, um Wörter in deinen Notizen zu speichern.',wordsFailed:'Speichern fehlgeschlagen. Prüfe deine Verbindung und versuche es erneut.',wordsBack:'Zurück zur Wortauswahl',wordsInNotes:'Schon in deinen Notizen',wordsRemove:'Aus der Liste entfernen',wordsUnavailable:'Notizen sind gerade nicht verfügbar.',backToTranscript:'Zurück zum Protokoll'},
 ar:{eyebrow:'LUMIRA · الترجمة الفورية',modesTitle:'كيف تريد الترجمة؟',modesIntro:'استمع إلى درس أو حديث وترجمه، أو استخدم التطبيق مترجمًا بين شخصين.',liveTitle:'الترجمة الفورية',liveDesc:'يستمع إلى الدرس أو الفيديو أو الحديث ويترجمه فورًا إلى لغتك.',convoTitle:'الترجمة وجهًا لوجه',convoDesc:'شخصان ولغتان: لغة في الأعلى وأخرى في الأسفل. يُترجم كل كلام إلى لغة الطرف الآخر.',back:'رجوع',top:'الجهة العليا',bottom:'الجهة السفلى',swap:'بدّل اللغتين',speak:'تحدث بـ{lang}',listening:'جارٍ الاستماع… اضغط للإيقاف',switchTo:'انتقل إلى {lang}',auto:'اكتشف لغة الكلام تلقائيًا',autoStart:'ابدأ الاستماع',autoStop:'أوقف الاستماع',autoListening:'يتم الاستماع إلى اللغتين — تحدثا بالتناوب.',speakAloud:'اقرأ الترجمات بصوت عالٍ',clear:'مسح',empty:'يظهر هنا الكلام بـ{from} مترجمًا إلى {to}.',starting:'جارٍ تجهيز الميكروفون والاتصال…',ready:'من يتحدث يضغط على الميكروفون في جهته.',readyAuto:'اضغط ابدأ؛ تُكتشف اللغة تلقائيًا.',sameLang:'اختر لغتين مختلفتين.',pending:'جارٍ الترجمة…',failedTranslation:'الترجمة غير متاحة حاليًا.',browserMode:'يستخدم هذا الجهاز التعرف على الكلام في المتصفح؛ تحدثا بالتناوب بدل الاكتشاف التلقائي.',autoFallback:'تعذر بدء الاكتشاف التلقائي؛ تم التحويل إلى التحدث بالتناوب.',remaining:'الوقت المتبقي: {n} د',unlimited:'بلا حد زمني',tip:'نصيحة: ضع الهاتف بينكما. يضغط المتحدث على الزر في جهته.',transcript:'📄 النص الكامل',history:'🕘 السجل',keep:'احفظ المحادثات على هذا الجهاز',transcriptTitle:'نص المحادثة',historyTitle:'المحادثات المحفوظة',historyNote:'تُحفظ المحادثات على هذا الجهاز فقط ولا تُرفع إلى حسابك. يمكنك حذفها في أي وقت.',historyEmpty:'لا توجد محادثات محفوظة بعد.',transcriptEmpty:'لم تتم ترجمة أي شيء بعد.',copy:'نسخ',copied:'تم نسخ النص.',copyFailed:'تعذر النسخ.',share:'مشاركة',download:'تنزيل (.txt)',print:'طباعة / PDF',printHint:'لحفظ ملف PDF اختر «حفظ بتنسيق PDF» في نافذة الطباعة.',close:'إغلاق',deleteOne:'حذف',deleteAll:'حذف الكل',confirmDeleteAll:'هل تريد حذف كل المحادثات المحفوظة على هذا الجهاز؟',lines:'{n} جمل',backToHistory:'السجل',moreLangs:'لغات أخرى',appName:'Lumira · الترجمة وجهًا لوجه',words:'📒 الكلمات',wordsTitle:'أضف كلمات إلى ملاحظاتي',wordsIntro:'هذه كلمات {lang} من المحادثة. اضغط على الكلمات التي تريد تعلمها؛ سنجلب معانيها بـ{native} ونحفظها في ملاحظاتي.',wordsNone:'لم تُعثر في هذه المحادثة على كلمات للحفظ.',wordsUnsupported:'تدعم ملاحظاتي هذه اللغات: {list}. لا تتضمن هذه المحادثة أيًا منها.',wordsPick:'تابع بالمحدد ({n})',wordsMax:'يمكنك اختيار {n} كلمة كحد أقصى في المرة الواحدة.',wordsReview:'تحقق من كل كلمة بـ{lang} ومعناها بـ{native} وصححهما عند الحاجة. الجملة المثال مأخوذة من المحادثة.',wordsWord:'الكلمة',wordsMeaning:'المعنى',wordsLoading:'جارٍ جلب المعنى…',wordsMeaningFailed:'لم يُعثر على معنى؛ يمكنك كتابته بنفسك.',wordsSave:'📒 أضف إلى ملاحظاتي ({n})',wordsSaving:'جارٍ الحفظ…',wordsSaved:'أُضيفت {n} كلمات إلى ملاحظاتي.',wordsLogin:'سجّل الدخول لحفظ الكلمات في ملاحظاتي.',wordsFailed:'تعذر الحفظ. تحقق من اتصالك وحاول مجددًا.',wordsBack:'العودة إلى اختيار الكلمات',wordsInNotes:'موجودة في ملاحظاتي',wordsRemove:'إزالة من القائمة',wordsUnavailable:'ملاحظاتي غير متاحة الآن.',backToTranscript:'العودة إلى النص'},
 fr:{eyebrow:'LUMIRA · TRADUCTION EN DIRECT',modesTitle:'Comment traduire ?',modesIntro:'Écoute un cours ou une discussion et traduis-le, ou utilise l’app comme interprète entre deux personnes.',liveTitle:'Traduction en direct',liveDesc:'Écoute un cours, une vidéo ou une discussion et traduit instantanément dans ta langue.',convoTitle:'Traduction face à face',convoDesc:'Deux personnes, deux langues : une en haut, l’autre en bas. Chaque intervention est traduite pour l’autre.',back:'Retour',top:'Côté haut',bottom:'Côté bas',swap:'Inverser les langues',speak:'Parler {lang}',listening:'Écoute… touche pour arrêter',switchTo:'Passer au {lang}',auto:'Détecter la langue parlée automatiquement',autoStart:'Démarrer l’écoute',autoStop:'Arrêter l’écoute',autoListening:'Les deux langues sont écoutées — parlez à tour de rôle.',speakAloud:'Lire les traductions à voix haute',clear:'Effacer',empty:'Ce qui est dit en {from} apparaît ici, traduit en {to}.',starting:'Préparation du micro et de la connexion…',ready:'La personne qui parle touche le micro de son côté.',readyAuto:'Touche Démarrer ; la langue est détectée automatiquement.',sameLang:'Choisis deux langues différentes.',pending:'Traduction…',failedTranslation:'La traduction n’est pas disponible pour le moment.',browserMode:'Cet appareil utilise la reconnaissance vocale du navigateur ; parlez à tour de rôle au lieu de la détection automatique.',autoFallback:'La détection automatique n’a pas démarré ; mode à tour de rôle activé.',remaining:'Temps restant : {n} min',unlimited:'Sans limite de temps',tip:'Astuce : pose le téléphone entre vous. La personne qui parle touche le bouton de son côté.',transcript:'📄 Transcription',history:'🕘 Historique',keep:'Garder les conversations sur cet appareil',transcriptTitle:'Transcription de la conversation',historyTitle:'Conversations enregistrées',historyNote:'Les conversations restent uniquement sur cet appareil et ne sont pas envoyées sur ton compte. Tu peux les supprimer à tout moment.',historyEmpty:'Aucune conversation enregistrée.',transcriptEmpty:'Rien n’a encore été traduit.',copy:'Copier',copied:'Transcription copiée.',copyFailed:'Copie impossible.',share:'Partager',download:'Télécharger (.txt)',print:'Imprimer / PDF',printHint:'Pour un PDF, choisis « Enregistrer au format PDF » dans la fenêtre d’impression.',close:'Fermer',deleteOne:'Supprimer',deleteAll:'Tout supprimer',confirmDeleteAll:'Supprimer toutes les conversations enregistrées sur cet appareil ?',lines:'{n} phrases',backToHistory:'Historique',moreLangs:'Autres langues',appName:'Lumira · Traduction face à face',words:'📒 Mots',wordsTitle:'Ajouter des mots à Mes notes',wordsIntro:'Voici les mots en {lang} de la conversation. Touche ceux que tu veux apprendre ; nous cherchons leur sens en {native} et les enregistrons dans Mes notes.',wordsNone:'Aucun mot à enregistrer n’a été trouvé dans cette conversation.',wordsUnsupported:'Mes notes prend en charge ces langues : {list}. Aucune n’apparaît dans cette conversation.',wordsPick:'Continuer avec la sélection ({n})',wordsMax:'Tu peux choisir au maximum {n} mots à la fois.',wordsReview:'Vérifie chaque mot en {lang} et son sens en {native}, puis corrige-les si besoin. La phrase d’exemple vient de la conversation.',wordsWord:'Mot',wordsMeaning:'Sens',wordsLoading:'Recherche du sens…',wordsMeaningFailed:'Aucun sens trouvé ; tu peux l’écrire toi-même.',wordsSave:'📒 Ajouter à Mes notes ({n})',wordsSaving:'Enregistrement…',wordsSaved:'{n} mots ajoutés à Mes notes.',wordsLogin:'Connecte-toi pour enregistrer des mots dans Mes notes.',wordsFailed:'Enregistrement impossible. Vérifie ta connexion et réessaie.',wordsBack:'Retour au choix des mots',wordsInNotes:'Déjà dans Mes notes',wordsRemove:'Retirer de la liste',wordsUnavailable:'Mes notes n’est pas disponible pour le moment.',backToTranscript:'Retour à la transcription'},
 es:{eyebrow:'LUMIRA · TRADUCCIÓN EN VIVO',modesTitle:'¿Cómo traducimos?',modesIntro:'Escucha una clase o conversación y tradúcela, o usa la app como intérprete entre dos personas.',liveTitle:'Traducción en vivo',liveDesc:'Escucha una clase, un vídeo o una charla y lo traduce al instante a tu idioma.',convoTitle:'Traducción cara a cara',convoDesc:'Dos personas, dos idiomas: uno arriba y otro abajo. Cada intervención se traduce para la otra persona.',back:'Volver',top:'Parte superior',bottom:'Parte inferior',swap:'Intercambiar idiomas',speak:'Hablar {lang}',listening:'Escuchando… toca para detener',switchTo:'Cambiar a {lang}',auto:'Detectar el idioma hablado automáticamente',autoStart:'Empezar a escuchar',autoStop:'Dejar de escuchar',autoListening:'Se escuchan los dos idiomas — hablad por turnos.',speakAloud:'Leer las traducciones en voz alta',clear:'Borrar',empty:'Lo dicho en {from} aparece aquí, traducido al {to}.',starting:'Preparando el micrófono y la conexión…',ready:'Quien hable toca el micrófono de su lado.',readyAuto:'Toca Empezar; el idioma se detecta automáticamente.',sameLang:'Elige dos idiomas diferentes.',pending:'Traduciendo…',failedTranslation:'La traducción no está disponible ahora.',browserMode:'Este dispositivo usa el reconocimiento de voz del navegador; hablad por turnos en lugar de la detección automática.',autoFallback:'La detección automática no pudo iniciarse; se activó el modo por turnos.',remaining:'Tiempo restante: {n} min',unlimited:'Sin límite de tiempo',tip:'Consejo: coloca el móvil entre vosotros. Quien habla toca el botón de su lado.',transcript:'📄 Transcripción',history:'🕘 Historial',keep:'Guardar las conversaciones en este dispositivo',transcriptTitle:'Transcripción de la conversación',historyTitle:'Conversaciones guardadas',historyNote:'Las conversaciones solo se guardan en este dispositivo y no se suben a tu cuenta. Puedes borrarlas cuando quieras.',historyEmpty:'Aún no hay conversaciones guardadas.',transcriptEmpty:'Todavía no se ha traducido nada.',copy:'Copiar',copied:'Transcripción copiada.',copyFailed:'No se pudo copiar.',share:'Compartir',download:'Descargar (.txt)',print:'Imprimir / PDF',printHint:'Para guardar un PDF, elige «Guardar como PDF» en la ventana de impresión.',close:'Cerrar',deleteOne:'Borrar',deleteAll:'Borrar todo',confirmDeleteAll:'¿Borrar todas las conversaciones guardadas en este dispositivo?',lines:'{n} frases',backToHistory:'Historial',moreLangs:'Más idiomas',appName:'Lumira · Traducción cara a cara',words:'📒 Palabras',wordsTitle:'Añadir palabras a Mis notas',wordsIntro:'Estas son las palabras en {lang} de la conversación. Toca las que quieras aprender; buscamos su significado en {native} y las guardamos en Mis notas.',wordsNone:'No se encontraron palabras para guardar en esta conversación.',wordsUnsupported:'Mis notas admite estos idiomas: {list}. Ninguno aparece en esta conversación.',wordsPick:'Continuar con la selección ({n})',wordsMax:'Puedes elegir como máximo {n} palabras a la vez.',wordsReview:'Revisa cada palabra en {lang} y su significado en {native} y corrígelos si hace falta. La frase de ejemplo viene de la conversación.',wordsWord:'Palabra',wordsMeaning:'Significado',wordsLoading:'Buscando significado…',wordsMeaningFailed:'No se encontró significado; puedes escribirlo tú.',wordsSave:'📒 Añadir a Mis notas ({n})',wordsSaving:'Guardando…',wordsSaved:'{n} palabras añadidas a Mis notas.',wordsLogin:'Inicia sesión para guardar palabras en Mis notas.',wordsFailed:'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.',wordsBack:'Volver a la selección de palabras',wordsInNotes:'Ya está en Mis notas',wordsRemove:'Quitar de la lista',wordsUnavailable:'Mis notas no está disponible ahora.',backToTranscript:'Volver a la transcripción'},
 ru:{eyebrow:'LUMIRA · ЖИВОЙ ПЕРЕВОД',modesTitle:'Как переводить?',modesIntro:'Слушай урок или разговор и переводи его либо используй приложение как переводчика между двумя людьми.',liveTitle:'Живой перевод',liveDesc:'Слушает урок, видео или разговор и сразу переводит на выбранный язык.',convoTitle:'Перевод лицом к лицу',convoDesc:'Два человека, два языка: один сверху, другой снизу. Каждая реплика переводится для собеседника.',back:'Назад',top:'Верхняя сторона',bottom:'Нижняя сторона',swap:'Поменять языки',speak:'Говорить: {lang}',listening:'Слушаю… нажми, чтобы остановить',switchTo:'Переключиться: {lang}',auto:'Определять язык речи автоматически',autoStart:'Начать слушать',autoStop:'Остановить',autoListening:'Слушаю оба языка — говорите по очереди.',speakAloud:'Озвучивать переводы',clear:'Очистить',empty:'Здесь появится сказанное ({from}) с переводом ({to}).',starting:'Подготовка микрофона и соединения…',ready:'Говорящий нажимает микрофон на своей стороне.',readyAuto:'Нажми «Начать»; язык определится автоматически.',sameLang:'Выбери два разных языка.',pending:'Перевод…',failedTranslation:'Перевод сейчас недоступен.',browserMode:'На этом устройстве используется распознавание речи браузера; говорите по очереди вместо автоопределения.',autoFallback:'Автоопределение не запустилось; включён режим по очереди.',remaining:'Осталось: {n} мин',unlimited:'Без ограничения времени',tip:'Совет: положите телефон между собой. Говорящий нажимает кнопку на своей стороне.',transcript:'📄 Запись',history:'🕘 История',keep:'Сохранять разговоры на этом устройстве',transcriptTitle:'Запись разговора',historyTitle:'Сохранённые разговоры',historyNote:'Разговоры хранятся только на этом устройстве и не загружаются в аккаунт. Их можно удалить в любой момент.',historyEmpty:'Сохранённых разговоров пока нет.',transcriptEmpty:'Пока ничего не переведено.',copy:'Копировать',copied:'Запись скопирована.',copyFailed:'Не удалось скопировать.',share:'Поделиться',download:'Скачать (.txt)',print:'Печать / PDF',printHint:'Чтобы сохранить PDF, выбери «Сохранить как PDF» в окне печати.',close:'Закрыть',deleteOne:'Удалить',deleteAll:'Удалить всё',confirmDeleteAll:'Удалить все сохранённые разговоры на этом устройстве?',lines:'Фраз: {n}',backToHistory:'История',moreLangs:'Другие языки',appName:'Lumira · Перевод лицом к лицу',words:'📒 Слова',wordsTitle:'Добавить слова в «Мои заметки»',wordsIntro:'Вот слова на языке «{lang}» из разговора. Нажми на те, что хочешь выучить; мы найдём их значение на языке «{native}» и сохраним в «Мои заметки».',wordsNone:'В этом разговоре не найдено слов для сохранения.',wordsUnsupported:'«Мои заметки» поддерживают эти языки: {list}. В этом разговоре нет ни одного из них.',wordsPick:'Продолжить с выбранными ({n})',wordsMax:'За один раз можно выбрать не больше {n} слов.',wordsReview:'Проверь каждое слово и его значение и при необходимости исправь. Пример предложения взят из разговора.',wordsWord:'Слово',wordsMeaning:'Значение',wordsLoading:'Ищем значение…',wordsMeaningFailed:'Значение не найдено; можно вписать его самому.',wordsSave:'📒 Добавить в «Мои заметки» ({n})',wordsSaving:'Сохранение…',wordsSaved:'Добавлено слов в «Мои заметки»: {n}.',wordsLogin:'Войди, чтобы сохранять слова в «Мои заметки».',wordsFailed:'Не удалось сохранить. Проверь соединение и попробуй снова.',wordsBack:'Назад к выбору слов',wordsInNotes:'Уже в «Мои заметки»',wordsRemove:'Убрать из списка',wordsUnavailable:'«Мои заметки» сейчас недоступны.',backToTranscript:'Назад к записи'}
};
const T=(key,values)=>{let s=(COPY[root.NATIVE_LANG]||COPY.en)[key];if(s===undefined)s=COPY.en[key]!==undefined?COPY.en[key]:key;for(const[k,v]of Object.entries(values||{}))s=s.split('{'+k+'}').join(String(v));return s;};
const F=()=>root.LUMIRA_FEATURES;
const fail=code=>Object.assign(new Error(code),{featureCode:code});
const name=code=>{const names=(typeof root.t==='function'&&root.t('lang_names'))||{};if(names[code])return names[code];try{return new Intl.DisplayNames([root.NATIVE_LANG||'tr'],{type:'language'}).of(code);}catch(e){return code;}};
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const button=(text,cls,fn)=>{const b=el('button',cls,text);b.type='button';b.onclick=fn;return b;};
const other=side=>side==='top'?'bottom':'top';
const stopTracks=stream=>{try{stream?.getTracks().forEach(track=>track.stop());}catch(e){}};
const prefs={get(k,d){try{const v=localStorage.getItem(k);return v===null?d:JSON.parse(v);}catch(e){return d;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}};

const s={host:null,view:null,observer:null,pair:{top:'de',bottom:'tr'},auto:false,speak:false,keep:true,convoId:'',saveTimer:null,entries:{top:[],bottom:[]},draft:{top:'',bottom:''},
 phase:'idle',side:null,generation:0,sessionId:null,stream:null,engine:'',recognizer:null,audio:null,input:null,browser:null,SDK:null,speech:null,tokenDeadline:0,
 renewTimer:null,deadlineTimer:null,renewPending:false,remaining:null,remainingAt:0,wakeLock:null,mutedUntil:0,seen:new Set(),notice:'',noticeBad:false,sdkPromise:null,abort:null};

/* ------------------------------------------------------------- seçim ekranı */
function open(host){
 if(!host)return;
 unmountConvo();
 s.host=host;s.view='modes';watch(host);
 const page=el('section','workspace lc-modes');page.dataset.liveModes='';page.lang=root.NATIVE_LANG||'tr';page.dir=page.lang==='ar'?'rtl':'ltr';
 const hero=el('header','work-hero');hero.append(el('span','work-eyebrow',T('eyebrow')),el('h1','',T('modesTitle')),el('p','',T('modesIntro')));
 const modes=el('div','practice-modes');
 modes.append(mode('🎙️',T('liveTitle'),T('liveDesc'),openLive,'live'),mode('🗣️',T('convoTitle'),T('convoDesc'),mountConvo,'conversation'));
 page.append(hero,modes);host.replaceChildren(page);
}
function mode(icon,title,text,fn,key){
 const b=button('','practice-mode',fn),body=el('span');b.dataset.liveMode=key;
 body.append(el('strong','',title),el('small','',text));
 b.append(Object.assign(el('span','practice-mode-icon'),{textContent:icon}),body,el('span','practice-mode-arrow',root.NATIVE_LANG==='ar'?'‹':'›'));
 return b;
}
function openLive(){
 const host=s.host;s.view=null;s.observer?.disconnect();
 if(!root.LUMIRA_LIVE)return;
 root.LUMIRA_LIVE.mount(host);
 // The existing screen is unchanged; only its Back button returns here.
 const back=host.querySelector('#ltBack');
 if(back)back.onclick=()=>{try{root.LUMIRA_LIVE.stop();}catch(e){}root.LUMIRA_LIVE.unmount();open(host);};
}
function watch(host){
 s.observer?.disconnect();
 s.observer=new MutationObserver(()=>{
  if(!s.host)return;
  const gone=!s.host.querySelector('[data-live-modes],[data-convo]')||s.host.style.display==='none';
  if(gone){if(s.view==='convo')end('stopped');s.view=null;s.observer.disconnect();}
 });
 s.observer.observe(host,{childList:true,attributes:true,attributeFilter:['style']});
}

/* ------------------------------------------------------- karşılıklı ekran */
function mountConvo(){
 const host=s.host;if(!host)return;
 const saved=prefs.get('lumira_convo_v1',null),target=typeof root.TARGET_LANG==='string'?root.TARGET_LANG:(typeof TARGET_LANG!=='undefined'?TARGET_LANG:'de'),native=root.NATIVE_LANG||'tr';
 let top=saved&&LANGS.includes(saved.top)?saved.top:(LANGS.includes(target)&&target!==native?target:native==='de'?'en':'de');
 let bottom=saved&&LANGS.includes(saved.bottom)?saved.bottom:(LANGS.includes(native)?native:'tr');
 if(top===bottom)bottom=top==='tr'?'de':'tr';
 s.pair={top,bottom};s.auto=!!(saved&&saved.auto);s.speak=!!(saved&&saved.speak);s.keep=!(saved&&saved.keep===false);
 s.entries={top:[],bottom:[]};s.draft={top:'',bottom:''};s.notice='';s.noticeBad=false;s.view='convo';s.convoId=newConvoId();
 shell();watch(host);
 let signedIn=false;try{signedIn=!!root.firebase?.auth?.().currentUser;}catch(e){}
 if(signedIn&&navigator.onLine!==false)F()?.api?.('status').then(()=>{if(s.view==='convo')paintQuota();}).catch(()=>{});
}
function savePrefs(){prefs.set('lumira_convo_v1',{top:s.pair.top,bottom:s.pair.bottom,auto:s.auto,speak:s.speak,keep:s.keep});}
/* Yeni bir konuşma: önceki konuşma geçmişe yazılır, ekran temizlenir. */
function resetConversation(){flushHistory();s.entries={top:[],bottom:[]};s.draft={top:'',bottom:''};s.convoId=newConvoId();}
function shell(){
 const host=s.host;if(!host)return;
 const page=el('section','workspace lc-screen');page.dataset.convo='';page.lang=root.NATIVE_LANG||'tr';page.dir=page.lang==='ar'?'rtl':'ltr';
 page.append(button((page.dir==='rtl'?'→ ':'← ')+T('back'),'work-back',()=>{end('stopped');open(host);}));
 const head=el('header','lc-head');head.append(el('h1','',T('convoTitle')),el('p','lc-tip',T('tip')));page.append(head);
 const pair=el('div','lc-pair');
 const collator=(()=>{try{return new Intl.Collator(root.NATIVE_LANG||'tr');}catch(e){return null;}})();
 const extras=EXTRA.slice().sort((a,b)=>collator?collator.compare(name(a),name(b)):name(a)<name(b)?-1:1);
 const pick=side=>{
  const select=el('select','lc-select');select.setAttribute('aria-label',T(side));
  const option=code=>{const o=el('option','',FLAGS[code]+' '+name(code));o.value=code;return o;};
  CORE.forEach(code=>select.append(option(code)));
  const group=el('optgroup');group.label=T('moreLangs');extras.forEach(code=>group.append(option(code)));select.append(group);
  select.value=s.pair[side];
  select.onchange=()=>{const value=select.value;if(value===s.pair[other(side)])s.pair[other(side)]=s.pair[side];s.pair[side]=value;savePrefs();if(s.phase!=='idle')end('stopped');resetConversation();paintAll();};
  return select;
 };
 const swap=button('⇅','lc-swap',()=>{s.pair={top:s.pair.bottom,bottom:s.pair.top};const t=s.entries.top;s.entries.top=s.entries.bottom;s.entries.bottom=t;savePrefs();if(s.phase!=='idle')end('stopped');paintAll();});swap.setAttribute('aria-label',T('swap'));swap.title=T('swap');
 pair.append(pick('top'),swap,pick('bottom'));page.append(pair);
 ['top','bottom'].forEach(side=>{
  const panel=el('section','lc-panel lc-'+side);panel.dataset.side=side;
  const bar=el('div','lc-panel-head');bar.append(el('span','lc-direction'));panel.append(bar);
  const list=el('div','lc-transcript');list.setAttribute('aria-live','polite');list.dataset.list=side;panel.append(list);
  const mic=button('','lc-mic',()=>tapSide(side));mic.dataset.mic=side;panel.append(mic);
  page.append(panel);
 });
 const autoRow=el('div','lc-auto');const autoBtn=button('','lc-mic lc-auto-btn',tapAuto);autoBtn.dataset.mic='auto';autoRow.append(autoBtn);page.append(autoRow);
 const options=el('div','lc-options');
 const toggle=(key,label)=>{const row=el('label','lc-toggle'),box=el('input');box.type='checkbox';box.checked=!!s[key];box.dataset.option=key;box.onchange=()=>{s[key]=box.checked;savePrefs();if(key==='auto'){if(s.phase!=='idle')end('stopped');paintAll();}if(key==='speak'&&!box.checked)root.VOICE_stop?.();if(key==='keep'){if(box.checked)scheduleSave();else{clearTimeout(s.saveTimer);removeHistory(s.convoId);}}};row.append(box,el('span','',label));return row;};
 options.append(toggle('auto',T('auto')),toggle('speak',T('speakAloud')),toggle('keep',T('keep')));
 page.append(options);
 const tools=el('div','lc-tools');
 tools.append(button(T('transcript'),'work-btn subtle',()=>openTranscript(null)),button(T('words'),'work-btn subtle lc-words-btn',()=>openWords(null)),button(T('history'),'work-btn subtle',openHistory),button(T('clear'),'work-btn subtle lc-clear',()=>{resetConversation();paintPanels();}));
 page.append(tools);
 const status=el('p','lc-status');status.setAttribute('role','status');page.append(status);
 const quota=el('p','lc-quota');page.append(quota);
 host.replaceChildren(page);
 paintAll();
}
function q(selector){return s.host?.querySelector(selector)||null;}
function paintAll(){
 if(!q('[data-convo]'))return;
 const selects=s.host.querySelectorAll('.lc-select');
 ['top','bottom'].forEach((side,i)=>{if(selects[i]&&selects[i].value!==s.pair[side])selects[i].value=s.pair[side];});
 const optAuto=q('[data-option="auto"]');if(optAuto)optAuto.checked=s.auto;
 paintPanels();paintControls();
}
function paintPanels(){
 ['top','bottom'].forEach(side=>{
  const from=s.pair[side],to=s.pair[other(side)],panel=q('.lc-'+side),list=q('[data-list="'+side+'"]');if(!panel||!list)return;
  panel.querySelector('.lc-direction').textContent=FLAGS[from]+' '+name(from)+'  →  '+FLAGS[to]+' '+name(to);
  panel.classList.toggle('is-live',s.phase==='listening'&&(s.auto||s.side===side));
  const near=list.scrollHeight-list.scrollTop-list.clientHeight<60;
  list.replaceChildren();
  const rows=s.entries[side];
  if(!rows.length&&!s.draft[side])list.append(el('p','lc-empty',T('empty',{from:name(from),to:name(to)})));
  rows.forEach(row=>{
   const item=el('div','lc-entry');
   const original=el('p','lc-original',row.original);original.lang=from;original.dir='auto';
   item.append(original);
   if(!row.merged){const translated=el('p','lc-translated'+(row.state==='pending'?' is-pending':row.state==='failed'?' is-failed':''),row.translated||(row.state==='failed'?T('failedTranslation'):T('pending')));translated.lang=to;translated.dir='auto';item.append(translated);}
   list.append(item);
  });
  if(s.draft[side]){const draft=el('p','lc-draft',s.draft[side]);draft.lang=from;draft.dir='auto';list.append(draft);}
  if(near||s.phase==='listening')list.scrollTop=list.scrollHeight;
 });
}
function paintControls(){
 if(!q('[data-convo]'))return;
 const live=s.phase==='listening',starting=s.phase==='starting';
 ['top','bottom'].forEach(side=>{
  const mic=q('[data-mic="'+side+'"]');if(!mic)return;
  mic.hidden=s.auto;
  const lang=name(s.pair[side]),active=live&&s.side===side;
  mic.textContent=active?'■ '+T('listening'):(live?'🎙️ '+T('switchTo',{lang}):'🎙️ '+T('speak',{lang}));
  mic.classList.toggle('is-active',active);mic.disabled=starting;mic.setAttribute('aria-pressed',String(active));
 });
 const autoBtn=q('[data-mic="auto"]');
 if(autoBtn){autoBtn.parentElement.hidden=!s.auto;autoBtn.textContent=live?'■ '+T('autoStop'):'🎙️ '+T('autoStart');autoBtn.classList.toggle('is-active',live);autoBtn.disabled=starting;}
 const status=q('.lc-status');
 if(status){
  let text=s.notice;
  if(!text)text=starting?T('starting'):live?(s.auto?T('autoListening'):''):(s.auto?T('readyAuto'):T('ready'));
  status.textContent=text;status.classList.toggle('bad',!!s.notice&&s.noticeBad);
 }
 paintQuota();
}
function paintQuota(){
 const line=q('.lc-quota');if(!line)return;
 if(s.phase!=='listening'||s.remaining===undefined){
  // Dinleme başlamadan da bugünkü kalan süre görünür.
  const c=s.phase==='idle'?F()?.getQuota?.()?.convo:null,L=root.LUMIRA_LIMITS;
  line.textContent=c&&L?(c.limitSeconds===null?L.text('convoUnlimited'):L.text('convoLeft',{n:Math.floor((c.remainingSeconds||0)/60),limit:Math.round(c.limitSeconds/60)})):'';return;
 }
 if(s.remaining===null){line.textContent=T('unlimited');return;}
 const left=Math.max(0,s.remaining-(performance.now()-s.remainingAt)/1000);
 line.textContent=T('remaining',{n:Math.max(0,Math.ceil(left/60))});
}
function notify(key,bad){s.notice=key?(COPY.en[key]!==undefined?T(key):(F()?.text?.(key)||key)):'';s.noticeBad=!!bad;paintControls();}

/* --------------------------------------------------------------- kontrol */
function tapSide(side){
 if(s.phase==='starting')return;
 if(s.phase==='listening'){if(s.side===side){end('stopped');return;}switchSide(side);return;}
 begin(side);
}
function tapAuto(){if(s.phase==='starting')return;if(s.phase==='listening'){end('stopped');return;}begin(null);}
async function begin(side){
 if(s.pair.top===s.pair.bottom){notify('sameLang',true);return;}
 if(!F()){notify('speech_unavailable',true);return;}
 if(root.LUMIRA_LIVE?.isActive?.()){try{root.LUMIRA_LIVE.stop();}catch(e){}}
 if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){notify('browser_unsupported',true);return;}
 const generation=++s.generation,id=F().id();
 s.sessionId=id;s.phase='starting';s.side=side||null;s.notice='';s.seen=new Set();s.abort=new AbortController();paintAll();
 root.VOICE_stop?.();
 try{
  const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
  if(generation!==s.generation){stopTracks(stream);return;}
  s.stream=stream;
  stream.getTracks().forEach(track=>track.addEventListener('ended',()=>{if(generation===s.generation)end('microphone_unavailable',true);},{once:true}));
  const status=await F().api('status');
  if(generation!==s.generation)return;
  // Karşılıklı Çeviri'nin süresi Canlı Çeviri'den ayrı bir havuzdan düşer (aynı miktar).
  const data=await F().api('liveStart',{id,provider:'local',pool:'convo'});
  if(generation!==s.generation){F().api('liveStop',{id,pool:'convo'}).catch(()=>{});return;}
  applyLease(data,generation);heartbeat(generation,id);
  const azure=(status.providers||[]).includes('azure')||status.speechConfigured===true;
  if(azure){
   try{await startAzure(generation);return;}
   catch(e){if(generation!==s.generation)return;if(['login_required','live_limit','convo_limit','usage_unavailable','live_already_active','maintenance'].includes(e.featureCode))throw e;releaseRecognizer();}
  }
  if(browserSupported()){
   if(s.auto){s.auto=false;savePrefs();notify('browserMode');}
   startBrowser(generation,s.side||'bottom');return;
  }
  throw fail(azure?'speech_unavailable':'browser_speech_unsupported');
 }catch(e){
  if(generation!==s.generation)return;
  const code=e.featureCode||(['NotAllowedError','PermissionDeniedError'].includes(e.name)?'microphone_denied':['NotFoundError','NotReadableError'].includes(e.name)?'microphone_unavailable':'speech_unavailable');
  root.PWA?.logError?.({message:'Conversation start: '+String(code).replace(/[^a-z_]/gi,'').slice(0,60),stack:''});
  end(code,true);
 }
}
function browserSupported(){return typeof(root.SpeechRecognition||root.webkitSpeechRecognition)==='function';}
function sdk(){
 if(root.SpeechSDK)return Promise.resolve(root.SpeechSDK);
 if(s.sdkPromise)return s.sdkPromise;
 s.sdkPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='./vendor/speech-sdk-1.52.0.min.js';script.async=true;
  const timer=setTimeout(()=>{script.remove();s.sdkPromise=null;reject(fail('sdk_unavailable'));},15000);
  script.onload=()=>{clearTimeout(timer);if(root.SpeechSDK)resolve(root.SpeechSDK);else{s.sdkPromise=null;reject(fail('sdk_unavailable'));}};
  script.onerror=()=>{clearTimeout(timer);script.remove();s.sdkPromise=null;reject(fail('sdk_unavailable'));};
  document.head.append(script);
 });
 return s.sdkPromise;
}
async function startAzure(generation){
 const[SDK,data]=await Promise.all([sdk(),F().api('liveConnect',{id:s.sessionId,provider:'azure',target:s.pair.bottom,source:s.auto?'auto':s.pair[s.side||'top']},{timeoutMs:6500})]);
 if(generation!==s.generation)throw fail('recognizer_replaced');
 if(!data?.speech?.token)throw fail('speech_unavailable');
 s.SDK=SDK;s.speech=data.speech;s.tokenDeadline=performance.now()+Math.max(0,data.speech.expiresAt-Date.now());s.engine='azure';
 try{await connectRecognizer(generation);}
 catch(e){
  // Continuous language detection can be refused by the service: fall back
  // to taking turns with a fixed language per side, which always works.
  if(s.auto&&e.featureCode!=='recognizer_replaced'&&generation===s.generation){s.auto=false;s.side=s.side||'top';savePrefs();await connectRecognizer(generation);notify('autoFallback');return;}
  throw e;
 }
}
function connectRecognizer(generation){
 releaseRecognizer();
 const SDK=s.SDK,speech=s.speech;
 if(!SDK||!speech||!s.stream||generation!==s.generation)return Promise.reject(fail('recognizer_replaced'));
 s.input=s.stream.clone();s.audio=SDK.AudioConfig.fromStreamInput(s.input);
 let recognizer;
 if(s.auto){
  const config=SDK.SpeechConfig.fromAuthorizationToken(speech.token,speech.region);
  config.setProperty(SDK.PropertyId.SpeechServiceConnection_Endpoint,'wss://'+speech.region+'.stt.speech.microsoft.com/speech/universal/v2');
  config.setProperty(SDK.PropertyId.SpeechServiceConnection_LanguageIdMode,'Continuous');
  const detect=SDK.AutoDetectSourceLanguageConfig.fromLanguages([LOCALES[s.pair.top],LOCALES[s.pair.bottom]]);
  if(SDK.LanguageIdMode?.Continuous!==undefined)detect.mode=SDK.LanguageIdMode.Continuous;
  recognizer=SDK.SpeechRecognizer.FromConfig(config,detect,s.audio);recognizer.lumiraAuto=true;
 }else{
  const side=s.side||'top',from=s.pair[side],to=s.pair[other(side)];
  const config=SDK.SpeechTranslationConfig.fromAuthorizationToken(speech.token,speech.region);
  config.speechRecognitionLanguage=LOCALES[from];config.addTargetLanguage(azureTarget(to));
  recognizer=new SDK.TranslationRecognizer(config,s.audio);recognizer.lumiraSide=side;
 }
 s.recognizer=recognizer;
 const current=()=>generation===s.generation&&s.recognizer===recognizer;
 recognizer.recognizing=(_,e)=>{if(current())azureResult(recognizer,e?.result,false);};
 recognizer.recognized=(_,e)=>{if(current())azureResult(recognizer,e?.result,true);};
 recognizer.canceled=(_,e)=>{
  if(!current())return;
  const detail=String(e?.errorDetails||'').replace(/(?:https?|wss?):\/\/\S+/gi,'…').replace(/[0-9a-f-]{20,}/gi,'…').slice(0,120);
  root.PWA?.logError?.({message:'Conversation Azure canceled: '+String(e?.errorCode??e?.reason??'unknown')+(recognizer.lumiraAuto?' auto':' fixed')+(detail?' · '+detail:''),stack:''});
  recognizer.lumiraCanceled=true;
  if(s.phase==='listening')recover(generation);
 };
 recognizer.sessionStopped=()=>{if(current()&&!recognizer.lumiraCanceled&&s.phase==='listening')recover(generation);};
 return new Promise((resolve,reject)=>{
  let settled=false;const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve();};
  const timer=setTimeout(()=>finish(fail('speech_unavailable')),10000);
  try{recognizer.startContinuousRecognitionAsync(()=>finish(),()=>finish(fail('speech_unavailable')));}catch(e){finish(fail('speech_unavailable'));}
 }).then(()=>{if(!current())throw fail('recognizer_replaced');if(recognizer.lumiraCanceled)throw fail('speech_unavailable');s.phase='listening';holdScreen(generation);paintAll();});
}
let recovering=0;
async function recover(generation){
 if(generation!==s.generation||recovering)return;
 recovering=Date.now();
 try{
  releaseRecognizer();
  await new Promise(resolve=>setTimeout(resolve,600));
  if(generation!==s.generation)return;
  try{await connectRecognizer(generation);}
  catch(e){
   if(generation!==s.generation)return;
   if(s.auto){s.auto=false;s.side=s.side||'top';savePrefs();try{await connectRecognizer(generation);notify('autoFallback');return;}catch(ignore){}}
   if(browserSupported()&&generation===s.generation){releaseRecognizer();startBrowser(generation,s.side||'bottom');notify('browserMode');return;}
   end('speech_unavailable',true);
  }
 }finally{recovering=0;}
}
function azureResult(recognizer,r,final){
 const SDK=s.SDK;
 if(!r||typeof r.text!=='string'||!r.text.trim()||r.text.length>4000)return;
 if(performance.now()<s.mutedUntil)return;
 let side;
 if(recognizer.lumiraAuto){
  if(final&&r.reason!==SDK.ResultReason.RecognizedSpeech)return;
  let locale='';try{locale=SDK.AutoDetectSourceLanguageResult.fromResult(r).language||'';}catch(e){}
  if(!locale){try{const json=JSON.parse(r.json||'{}');locale=json.PrimaryLanguage?.Language||'';}catch(e){}}
  const code=String(locale).split('-')[0].toLowerCase();
  side=code===s.pair.top?'top':code===s.pair.bottom?'bottom':null;
  if(!side)return;
 }else{
  if(final&&r.reason!==SDK.ResultReason.TranslatedSpeech)return;
  side=recognizer.lumiraSide;
 }
 if(!final){s.draft[side]=r.text;paintPanels();return;}
 const key=Number.isFinite(r.offset)?[r.offset,r.duration,side].join(':'):null;
 if(key&&s.seen.has(key))return;if(key){s.seen.add(key);if(s.seen.size>400)s.seen.delete(s.seen.values().next().value);}
 s.draft[side]='';
 const to=s.pair[other(side)];
 let translated='';if(!recognizer.lumiraAuto){try{translated=r.translations.get(azureTarget(to))||'';}catch(e){}}
 const row={original:r.text.trim(),translated:translated.trim(),state:translated.trim()?'done':'pending'};
 push(side,row);
 if(row.state==='pending')translateRow(row,s.pair[side],to);else speakRow(row,to);
}
function push(side,row){row.at=Date.now();row.from=s.pair[side];row.to=s.pair[other(side)];s.entries[side].push(row);if(s.entries[side].length>60)s.entries[side].shift();paintPanels();scheduleSave();}
function translateRow(row,from,to){
 const generation=s.generation;
 translateText(row.original,from,to,{id:s.sessionId,signal:s.abort?.signal}).then(text=>{if(generation!==s.generation)return;row.translated=text;row.state='done';paintPanels();scheduleSave();speakRow(row,to);},error=>{
  if(generation!==s.generation)return;
  if(['login_required','live_limit','convo_limit','session_expired'].includes(error?.featureCode)){end(error.featureCode,true);return;}
  row.state='failed';paintPanels();scheduleSave();
 });
}
/* Metin çevirisi: CORE çiftleri mevcut yolu (LUMIRA_TEXT) olduğu gibi kullanır.
   Diğer diller önce sunucudaki sağlayıcılarla, sonra anonim MyMemory ile çevrilir. */
function plainText(html){const field=document.createElement('textarea');field.innerHTML=html;return field.value.replace(/<[^>]*>/gu,'').trim();}
async function translateText(text,from,to,{id,signal}={}){
 if(CORE.includes(from)&&CORE.includes(to)&&root.LUMIRA_TEXT)return root.LUMIRA_TEXT.translate(text,from,to,{id,signal});
 if(typeof text!=='string'||!text.trim()||text.length>4000||!LANGS.includes(from)||!LANGS.includes(to))throw fail('invalid_input');
 if(from===to)return text;
 if(signal?.aborted)throw fail('recognizer_replaced');
 if(id&&F())try{const result=await F().api('liveText',{id,text,source:from,target:to},{signal,timeoutMs:9000});if(typeof result?.translated==='string'&&result.translated.trim())return result.translated.trim();}catch(error){if(['login_required','live_limit','session_expired','maintenance','usage_unavailable'].includes(error.featureCode)||signal?.aborted)throw error;}
 const parts=root.LUMIRA_TEXT?.segments?root.LUMIRA_TEXT.segments(text):[text],out=[];
 for(const part of parts){
  const controller=new AbortController(),stop=()=>controller.abort();signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted)controller.abort();const timer=setTimeout(stop,12000);
  try{
   const url=new URL('https://api.mymemory.translated.net/get');url.searchParams.set('q',part);url.searchParams.set('langpair',(MYMEMORY[from]||from)+'|'+(MYMEMORY[to]||to));
   const response=await fetch(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'}),data=await response.json();
   if(data.quotaFinished||Number(data.responseStatus)===429)throw fail('free_text_limit');
   const value=data.responseData?.translatedText;
   if(!response.ok||Number(data.responseStatus)!==200||typeof value!=='string'||!value.trim()||/MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID LANGUAGE PAIR/iu.test(value))throw fail('text_translation_unavailable');
   out.push(plainText(value));
  }catch(error){throw error.featureCode?error:fail(signal?.aborted?'recognizer_replaced':'text_translation_unavailable');}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',stop);}
 }
 return out.join(' ');
}
/* Tarayıcı konuşma tanıması yedeği: LUMIRA_BROWSER ile aynı arayüz, ama her
   dilin kendi yerel ayarı ve yukarıdaki çeviri yolu kullanılır. */
class ConvoBrowser{
 constructor({id,source,target,onReady,onDraft,onFinal,onResult,onError}){Object.assign(this,{id,source,target,onReady,onDraft,onFinal,onResult,onError});this.attempt=0;this.queue=[];this.abort=new AbortController();}
 start(){
  const Recognition=root.SpeechRecognition||root.webkitSpeechRecognition;if(typeof Recognition!=='function')throw fail('browser_speech_unsupported');
  this.closed=false;const rec=this.rec=new Recognition();rec.lang=LOCALES[this.source];rec.continuous=true;rec.interimResults=true;rec.maxAlternatives=1;
  rec.onstart=()=>{if(!this.closed)this.onReady?.();};
  rec.onresult=event=>{if(this.closed)return;const results=event?.results;if(!results)return;let draft='';for(let k=Math.max(0,event.resultIndex||0);k<results.length&&!this.closed;k++){const text=String(results[k]?.[0]?.transcript||'').trim().slice(0,4000);if(!text)continue;if(results[k].isFinal){const row=this.onFinal?.(text);if(row)this.enqueue({original:text,row});}else draft=(draft+text+' ').slice(-4000);}this.attempt=0;if(!this.closed)this.onDraft?.(draft.trim());};
  rec.onerror=event=>{if(this.closed)return;const code=String(event?.error||'');if(['not-allowed','service-not-allowed','audio-capture','language-not-supported'].includes(code)){this.stop();this.onError?.(fail(code==='audio-capture'?'microphone_unavailable':code==='language-not-supported'?'browser_speech_unsupported':'microphone_denied'));}else if(!['no-speech','aborted'].includes(code)&&++this.attempt>=3){this.stop();this.onError?.(fail('browser_speech_unavailable'));}};
  rec.onend=()=>{if(this.closed)return;clearTimeout(this.timer);this.timer=setTimeout(()=>{if(this.closed)return;try{rec.start();}catch(e){if(++this.attempt>=3){this.stop();this.onError?.(fail('browser_speech_unavailable'));}else rec.onend();}},400+this.attempt*300);};
  try{rec.start();}catch(e){this.stop();throw fail('browser_speech_unavailable');}
 }
 enqueue(entry){if(this.closed)return;this.queue.push(entry);this.pump();}
 async pump(){if(this.running)return;this.running=true;try{while(this.queue.length&&!this.closed){const entry=this.queue.shift();try{const translated=await translateText(entry.original,this.source,this.target,{id:this.id,signal:this.abort.signal});if(!this.closed)this.onResult?.({...entry,translated});}catch(error){if(!this.closed)this.onError?.(error,entry);}}}finally{this.running=false;}}
 stop(){this.closed=true;clearTimeout(this.timer);this.queue=[];this.abort.abort();if(this.rec){this.rec.onresult=this.rec.onerror=this.rec.onend=this.rec.onstart=null;try{this.rec.abort();}catch(e){}this.rec=null;}}
}
function speakRow(row,lang){
 if(!s.speak||!row.translated||!root.VOICE_read)return;
 // The recognizer keeps running; results heard while the translation is read
 // aloud (the phone's own voice) are ignored.
 s.mutedUntil=Infinity;
 const release=()=>{s.mutedUntil=performance.now()+700;};
 try{root.VOICE_read(row.translated,{language:lang,onEnd:release,onError:release,onCancel:release});}catch(e){release();}
}
function startBrowser(generation,side){
 s.browser?.stop();s.browser=null;
 if(!browserSupported())throw fail('browser_speech_unsupported');
 stopTracks(s.stream);s.stream=null; // the browser recogniser opens its own capture
 s.engine='browser';s.side=side;
 const from=s.pair[side],to=s.pair[other(side)];
 const Session=CORE.includes(from)&&CORE.includes(to)&&root.LUMIRA_BROWSER&&root.LUMIRA_TEXT&&root.LUMIRA_SOURCE?root.LUMIRA_BROWSER.BrowserSession:ConvoBrowser;
 const session=new Session({id:s.sessionId,source:from,target:to,
  onReady:()=>{if(generation===s.generation&&s.browser===session){s.phase='listening';holdScreen(generation);paintAll();}},
  onDraft:text=>{if(generation===s.generation&&s.browser===session&&performance.now()>=s.mutedUntil){s.draft[side]=text;paintPanels();}},
  onFinal:text=>{if(generation!==s.generation||s.browser!==session||performance.now()<s.mutedUntil)return null;s.draft[side]='';const row={original:text,translated:'',state:'pending'};push(side,row);return row;},
  onResult:entry=>{
   if(generation!==s.generation||s.browser!==session)return;
   const rows=(entry.rows||(entry.row?[entry.row]:[])).filter(row=>s.entries[side].includes(row));
   rows.forEach((row,i)=>{if(i===rows.length-1){row.translated=entry.translated;row.state='done';}else{row.merged=true;row.state='done';}});
   paintPanels();scheduleSave();if(rows.length)speakRow(rows[rows.length-1],to);
  },
  onError:(error,entry)=>{
   if(generation!==s.generation||s.browser!==session)return;
   if(entry&&!['login_required','live_limit','convo_limit','session_expired','maintenance'].includes(error.featureCode)){const rows=entry.rows||(entry.row?[entry.row]:[]);rows.forEach(row=>{row.state='failed';});paintPanels();scheduleSave();return;}
   end(error.featureCode||'browser_speech_unavailable',true);
  }});
 s.browser=session;
 try{session.start();}catch(e){end(e.featureCode||'browser_speech_unavailable',true);}
}
function switchSide(side){
 if(s.auto||s.phase!=='listening'||s.side===side)return;
 const generation=s.generation;s.side=side;s.draft={top:'',bottom:''};root.VOICE_stop?.();s.mutedUntil=0;
 if(s.engine==='browser'){startBrowser(generation,side);paintAll();return;}
 s.phase='starting';paintAll();
 connectRecognizer(generation).catch(()=>{if(generation===s.generation)recover(generation);});
}

/* ----------------------------------------------------------- oturum / kota */
function applyLease(data,generation){
 if(generation!==s.generation)return;
 const now=performance.now();
 s.remaining=data.quota?.convo?.remainingSeconds??null;s.remainingAt=now;
 const wait=Math.max(0,(data.session?.until||0)-(data.quota?.serverNow||Date.now()));
 clearTimeout(s.deadlineTimer);
 s.deadlineTimer=setTimeout(()=>{
  if(generation!==s.generation)return;
  const exhausted=s.remaining!==null&&s.remaining-(performance.now()-s.remainingAt)/1000<=.1;
  end(exhausted?'convo_limit':'usage_unavailable',true);
 },wait);
 if(data.speech){s.speech=data.speech;s.tokenDeadline=now+data.speech.expiresAt-(data.quota?.serverNow||Date.now());if(s.recognizer)s.recognizer.authorizationToken=data.speech.token;}
 paintQuota();
}
function heartbeat(generation,id){
 clearInterval(s.renewTimer);
 s.renewTimer=setInterval(()=>{renew(generation,id);paintQuota();},5000);
}
async function renew(generation,id){
 if(generation!==s.generation||id!==s.sessionId||s.renewPending)return;
 s.renewPending=true;
 try{
  let data;
  try{data=await F().api('liveRenew',{id,provider:'local',pool:'convo'},{timeoutMs:6000});}
  catch(e){if(generation!==s.generation)return;if(e.featureCode!=='session_expired')throw e;data=await F().api('liveStart',{id,provider:'local',pool:'convo'},{timeoutMs:6000});}
  if(generation!==s.generation){F().api('liveStop',{id,pool:'convo'}).catch(()=>{});return;}
  applyLease(data,generation);
  if(s.engine==='azure'&&s.tokenDeadline-performance.now()<60000){
   const token=await F().api('liveConnect',{id,provider:'azure',target:s.pair.bottom,source:s.auto?'auto':s.pair[s.side||'top']},{timeoutMs:6500}).catch(()=>null);
   if(token?.speech&&generation===s.generation){s.speech=token.speech;s.tokenDeadline=performance.now()+token.speech.expiresAt-Date.now();if(s.recognizer)s.recognizer.authorizationToken=token.speech.token;}
  }
 }catch(e){
  if(generation!==s.generation)return;
  if(['login_required','live_limit','convo_limit','maintenance','live_already_active'].includes(e.featureCode)){end(e.featureCode,true);return;}
 }finally{s.renewPending=false;}
}
function holdScreen(generation){
 if(document.hidden||!navigator.wakeLock||s.wakeLock)return;
 navigator.wakeLock.request('screen').then(lock=>{if(generation!==s.generation||s.phase!=='listening'){lock.release().catch(()=>{});return;}s.wakeLock=lock;lock.addEventListener('release',()=>{if(s.wakeLock===lock)s.wakeLock=null;},{once:true});}).catch(()=>{});
}
function releaseRecognizer(){
 const r=s.recognizer,a=s.audio,input=s.input;s.recognizer=null;s.audio=null;s.input=null;
 if(!r){try{a?.close();}catch(e){}stopTracks(input);return;}
 const close=()=>{try{r.close();}catch(e){}try{a?.close();}catch(e){}stopTracks(input);};
 try{r.stopContinuousRecognitionAsync(close,close);}catch(e){close();}
 setTimeout(close,1500);
}
function end(message,bad){
 const id=s.sessionId,wasActive=s.phase!=='idle';
 ++s.generation;s.phase='idle';s.side=null;s.sessionId=null;s.engine='';s.draft={top:'',bottom:''};s.mutedUntil=0;
 s.abort?.abort();s.abort=null;
 clearInterval(s.renewTimer);clearTimeout(s.deadlineTimer);s.renewPending=false;
 s.browser?.stop();s.browser=null;releaseRecognizer();stopTracks(s.stream);s.stream=null;s.speech=null;
 if(s.wakeLock){s.wakeLock.release().catch(()=>{});s.wakeLock=null;}
 if(id)F()?.api('liveStop',{id,pool:'convo'},{keepalive:true}).catch(()=>{});
 flushHistory();
 if(bad&&message)notify(message,true);else if(wasActive)notify('');
 if(message==='live_limit'||message==='convo_limit')root.LUMIRA_ACCESS?.open(message);
 paintAll();
}
function unmountConvo(){if(s.view==='convo'){end('stopped');flushHistory();}}

/* ------------------------------------------- döküm ve cihazdaki geçmiş */
function newConvoId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
function historyKey(){let id='';try{id=root.firebase?.auth?.().currentUser?.uid||'';}catch(e){}return 'lumira_convo_history_v1_'+(id||'guest');}
function readHistory(){try{const list=JSON.parse(localStorage.getItem(historyKey())||'[]');return Array.isArray(list)?list.filter(x=>x&&typeof x.id==='string'&&Array.isArray(x.rows)):[];}catch(e){return[];}}
function writeHistory(list){try{if(root.LUMIRA_CLEARING_DATA)return;if(list.length)localStorage.setItem(historyKey(),JSON.stringify(list));else localStorage.removeItem(historyKey());}catch(e){}}
function currentRows(){
 return[...s.entries.top,...s.entries.bottom].filter(row=>row&&row.original).sort((a,b)=>(a.at||0)-(b.at||0)).slice(-HISTORY_ROWS)
  .map(row=>({from:row.from,to:row.to,o:String(row.original).slice(0,4000),t:row.merged?'':String(row.translated||'').slice(0,4000),at:row.at||Date.now(),...(row.merged?{m:1}:{})}));
}
function currentRecord(){const rows=currentRows();return rows.length?{id:s.convoId,at:rows[0].at,updated:Date.now(),top:s.pair.top,bottom:s.pair.bottom,rows}:null;}
function scheduleSave(){if(!s.keep||!s.convoId)return;clearTimeout(s.saveTimer);s.saveTimer=setTimeout(flushHistory,900);}
function flushHistory(){
 clearTimeout(s.saveTimer);s.saveTimer=null;
 if(!s.keep||!s.convoId)return;
 const record=currentRecord();if(!record)return;
 const list=readHistory().filter(x=>x.id!==record.id);list.unshift(record);
 writeHistory(list.sort((a,b)=>(b.updated||0)-(a.updated||0)).slice(0,HISTORY_MAX));
}
function removeHistory(id){writeHistory(readHistory().filter(x=>x.id!==id));}
function fmtTime(at,withDate){try{return new Date(at).toLocaleString(root.NATIVE_LANG||'tr',withDate?{dateStyle:'medium',timeStyle:'short'}:{hour:'2-digit',minute:'2-digit'});}catch(e){return new Date(at).toISOString().slice(withDate?0:11,16);}}
function pairLabel(record){const langs=[...new Set(record.rows.flatMap(r=>[r.from,r.to]).filter(c=>LANGS.includes(c)))];const pair=langs.length?langs:[record.top,record.bottom];return pair.map(c=>(FLAGS[c]||'')+' '+name(c)).join(' ⇄ ');}
function plainTranscript(record){
 const lines=[T('appName'),fmtTime(record.at,true)+' · '+[...new Set(record.rows.flatMap(r=>[r.from,r.to]))].filter(c=>LANGS.includes(c)).map(name).join(' ⇄ '),''];
 record.rows.forEach(r=>{lines.push('['+fmtTime(r.at)+'] '+name(r.from)+': '+r.o);if(r.t)lines.push('    → '+name(r.to)+': '+r.t);});
 return lines.join('\n');
}
function escapeHtml(text){return String(text).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function printTranscript(record){
 // Pencere tıklama anında açılır; böylece tarayıcı kullanıcı hareketini korur.
 const dir=(root.NATIVE_LANG||'tr')==='ar'?'rtl':'ltr';
 const rows=record.rows.map(r=>'<div class="row"><div class="time">'+escapeHtml(fmtTime(r.at))+' · '+escapeHtml(name(r.from))+'</div><p class="o" lang="'+r.from+'" dir="auto">'+escapeHtml(r.o)+'</p>'+(r.t?'<p class="t" lang="'+r.to+'" dir="auto">'+escapeHtml(r.t)+'</p>':'')+'</div>').join('');
 const html='<!doctype html><html lang="'+escapeHtml(root.NATIVE_LANG||'tr')+'" dir="'+dir+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escapeHtml(T('transcriptTitle'))+'</title><style>'
  +'body{margin:0;background:#eef1f6;color:#1b2536;font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}.bar{position:sticky;top:0;display:flex;gap:12px;align-items:center;justify-content:space-between;padding:12px 16px;background:#14233b;color:#e7efff;font-size:13px}.bar button{padding:9px 16px;border:0;border-radius:10px;background:#87dfd7;color:#102236;font-weight:700;font-size:14px}'
  +'.paper{max-width:760px;margin:20px auto;padding:28px 30px;background:#fff;border-radius:14px;box-shadow:0 6px 24px #0f1a2d22}h1{margin:0 0 4px;font-size:22px}.meta{margin:0 0 18px;color:#5a6780;font-size:13px}.row{padding:10px 0;border-bottom:1px solid #e3e8ef;break-inside:avoid}.time{color:#7a869c;font-size:11.5px}.o{margin:2px 0;color:#46526a}.t{margin:2px 0;font-weight:650;font-size:16px}.foot{margin-top:18px;color:#8a94a6;font-size:11px}'
  +'@media print{body{background:#fff}.bar{display:none}.paper{margin:0;box-shadow:none;max-width:none;padding:0}}</style></head><body><div class="bar"><span>'+escapeHtml(T('printHint'))+'</span><button onclick="window.print()">'+escapeHtml(T('print'))+'</button></div>'
  +'<main class="paper"><h1>'+escapeHtml(T('transcriptTitle'))+'</h1><p class="meta">'+escapeHtml(fmtTime(record.at,true)+' · '+pairLabel(record)+' · '+T('lines',{n:record.rows.length}))+'</p>'+rows+'<p class="foot">'+escapeHtml(T('appName'))+'</p></main></body></html>';
 let win=null;try{win=root.open('','_blank');}catch(e){}
 if(win){try{win.document.open();win.document.write(html);win.document.close();return;}catch(e){try{win.close();}catch(ignore){}}}
 const frame=document.createElement('iframe');frame.setAttribute('aria-hidden','true');frame.style.cssText='position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;';document.body.append(frame);
 const clean=()=>frame.remove();
 try{const doc=frame.contentWindow.document;doc.open();doc.write(html);doc.close();frame.contentWindow.addEventListener('afterprint',clean,{once:true});setTimeout(()=>{try{frame.contentWindow.focus();frame.contentWindow.print();}catch(e){clean();}},350);setTimeout(clean,60000);}catch(e){clean();}
}
function toast(text,kind){if(root.PWA?.toast)root.PWA.toast(text,{kind:kind||'good'});else{s.notice=text;s.noticeBad=kind==='bad';paintControls();}}
async function copyTranscript(record){
 const text=plainTranscript(record);
 try{await navigator.clipboard.writeText(text);toast(T('copied'));return;}catch(e){}
 try{const area=el('textarea');area.value=text;area.setAttribute('readonly','');area.style.cssText='position:fixed;opacity:0;top:0;left:0';document.body.append(area);area.select();const ok=document.execCommand('copy');area.remove();toast(ok?T('copied'):T('copyFailed'),ok?'good':'bad');}catch(e){toast(T('copyFailed'),'bad');}
}
function downloadTranscript(record){
 const blob=new Blob(['﻿'+plainTranscript(record)],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=el('a');
 const stamp=new Date(record.at),pad=v=>String(v).padStart(2,'0');
 a.href=url;a.download='lumira-ceviri-'+stamp.getFullYear()+pad(stamp.getMonth()+1)+pad(stamp.getDate())+'-'+pad(stamp.getHours())+pad(stamp.getMinutes())+'.txt';
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
}
function closeSheet(){document.removeEventListener('keydown',sheetKeys,true);const sheet=q('.lc-sheet');if(!sheet)return;sheet.remove();try{s.sheetReturn?.focus?.({preventScroll:true});}catch(e){}s.sheetReturn=null;}
function sheetKeys(event){if(event.key==='Escape'){event.preventDefault();closeSheet();}}
function sheet(title,build){
 const page=q('[data-convo]');if(!page)return;
 const existing=q('.lc-sheet');if(existing)existing.remove();else s.sheetReturn=document.activeElement;
 const backdrop=el('div','lc-sheet'),panel=el('div','lc-sheet-panel'),head=el('div','lc-sheet-head'),body=el('div','lc-sheet-body');
 backdrop.setAttribute('role','dialog');backdrop.setAttribute('aria-modal','true');backdrop.setAttribute('aria-label',title);
 const close=button('✕','lc-sheet-close',closeSheet);close.setAttribute('aria-label',T('close'));
 head.append(el('h2','',title),close);panel.append(head,body);backdrop.append(panel);
 backdrop.addEventListener('click',event=>{if(event.target===backdrop)closeSheet();});
 build(body,panel);page.append(backdrop);document.addEventListener('keydown',sheetKeys,true);
 close.focus({preventScroll:true});
}
function openTranscript(record,fromHistory){
 if(!record){flushHistory();record=currentRecord();}
 sheet(T('transcriptTitle'),(body,panel)=>{
  if(fromHistory){const back=button((root.NATIVE_LANG==='ar'?'→ ':'← ')+T('backToHistory'),'lc-sheet-back',openHistory);body.append(back);}
  if(!record||!record.rows.length){body.append(el('p','lc-empty',T('transcriptEmpty')));return;}
  body.append(el('p','lc-sheet-meta',fmtTime(record.at,true)+' · '+pairLabel(record)+' · '+T('lines',{n:record.rows.length})));
  const list=el('div','lc-sheet-list');
  record.rows.forEach(r=>{const item=el('div','lc-sheet-row');item.append(el('span','lc-sheet-time',fmtTime(r.at)+' · '+(FLAGS[r.from]||'')+' '+name(r.from)));const o=el('p','lc-original',r.o);o.lang=r.from;o.dir='auto';item.append(o);if(r.t){const t=el('p','lc-translated',r.t);t.lang=r.to;t.dir='auto';item.append(t);}list.append(item);});
  body.append(list);
  const actions=el('div','lc-sheet-actions');
  actions.append(button(T('words'),'work-btn subtle',()=>openWords(record,()=>openTranscript(record,fromHistory))),button(T('copy'),'work-btn subtle',()=>copyTranscript(record)));
  if(typeof navigator.share==='function')actions.append(button(T('share'),'work-btn subtle',()=>{navigator.share({title:T('transcriptTitle'),text:plainTranscript(record)}).catch(()=>{});}));
  actions.append(button(T('download'),'work-btn subtle',()=>downloadTranscript(record)),button(T('print'),'work-btn primary',()=>printTranscript(record)));
  panel.append(actions);
 });
}
function openHistory(){
 flushHistory();
 sheet(T('historyTitle'),(body,panel)=>{
  body.append(el('p','lc-sheet-meta',T('historyNote')));
  const list=readHistory();
  if(!list.length){body.append(el('p','lc-empty',T('historyEmpty')));return;}
  const wrap=el('div','lc-history');
  list.forEach(record=>{
   const row=el('div','lc-history-row'),open=button('','lc-history-open',()=>openTranscript(record,true));
   const first=record.rows.find(r=>r.t||r.o);
   open.append(el('strong','',fmtTime(record.at,true)),el('span','',pairLabel(record)+' · '+T('lines',{n:record.rows.length})));
   if(first){const preview=el('small','',first.o.slice(0,90));preview.dir='auto';open.append(preview);}
   const del=button('🗑','lc-history-del',()=>{removeHistory(record.id);if(record.id===s.convoId)s.convoId=newConvoId();openHistory();});del.setAttribute('aria-label',T('deleteOne'));del.title=T('deleteOne');
   row.append(open,del);wrap.append(row);
  });
  body.append(wrap);
  const actions=el('div','lc-sheet-actions');
  actions.append(button(T('deleteAll'),'work-btn subtle lc-danger',()=>{if(!root.confirm(T('confirmDeleteAll')))return;writeHistory([]);s.convoId=newConvoId();openHistory();}));
  panel.append(actions);
 });
}
/* ------------------------------------ konuşmadaki kelimeler → Notlarım */
// Notlarım yalnızca uygulamanın kendi dillerini tutar (CORE). Çok sık geçen
// işlev sözcükleri listede gösterilmez.
const WORDS_MAX=20,CHIPS_MAX=150;
const STOP={
 de:'der die das den dem des ein eine einen einem einer eines und oder aber ich du er sie es wir ihr mich mir dich dir sich uns euch ist sind war bin bist hat habe haben hast wird werden nicht kein keine zu im in am an auf aus mit von vom zum zur für bei nach vor um als wie so ja nein auch noch schon nur dass ob wenn was wer wo mein dein sein unser man doch mal hier da dann denn sehr gut',
 en:'the a an and or but i you he she it we they me him her us them is are was were be been am do does did have has had not no to of in on at for with from by as so yes if that this what who my your his its our their there then can will would ok okay',
 fr:'le la les un une des et ou mais je tu il elle on nous vous ils elles me te se est sont être avoir ai as a ne pas de du à au aux en dans sur pour avec par que qui ce cette mon ton son ma ta sa mes tes ses oui non si',
 es:'el la los las un una unos unas y o pero yo tú él ella nosotros vosotros ellos ellas me te se es son está están ser estar he ha hay no de del a al en con por para que quien este esta mi tu su sí si lo le les',
 ru:'и в во не на я ты он она оно мы вы они что как а но да нет с со к у о об по за из от до это то же ли бы мне меня тебя его её их был была было были есть',
 ar:'في من على إلى عن مع هذا هذه ذلك تلك هو هي أنا أنت نحن هم أن إن لا ما و أو ثم قد كان كانت يكون لم لن',
 tr:'ve veya ama bir bu şu o ben sen biz siz onlar da de ki mi mı mu mü ne için ile gibi çok daha en var yok değil evet hayır'
};
const stopWords=lang=>new Set(String(STOP[lang]||'').split(' ').filter(Boolean));
function learnCandidates(record){
 const native=root.NATIVE_LANG||'tr',target=typeof root.TARGET_LANG==='string'?root.TARGET_LANG:'';
 const present=[...new Set(record.rows.flatMap(r=>r.t?[r.from,r.to]:[r.from]))];
 return present.filter(code=>CORE.includes(code)&&code!==native).sort((a,b)=>(b===target)-(a===target));
}
function sentenceAround(text,index){
 let start=index,end=index;
 while(start>0&&!/[.!?…]/.test(text[start-1]))start--;
 while(end<text.length&&!/[.!?…]/.test(text[end]))end++;
 return text.slice(start,Math.min(text.length,end+1)).trim();
}
function wordsList(record,learn){
 const native=root.NATIVE_LANG||'tr',stop=stopWords(learn),map=new Map();
 record.rows.forEach(r=>{
  const text=r.from===learn?r.o:(r.to===learn&&r.t?r.t:'');if(!text)return;
  const other=r.from===learn?r.t:r.o,otherLang=r.from===learn?r.to:r.from;
  const pattern=/[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*/gu;let m;
  while((m=pattern.exec(text))){
   const word=m[0],key=word.toLocaleLowerCase(learn);
   if([...word].length<2||stop.has(key))continue;
   const before=text.slice(0,m.index).trimEnd(),initial=!before||/[.!?…:]$/.test(before);
   let entry=map.get(key);
   if(!entry){
    if(map.size>=CHIPS_MAX)continue;
    const sentence=sentenceAround(text,m.index).slice(0,300);
    // Çeviri yalnızca satır tek cümleyse örneğin karşılığı olarak kullanılır.
    entry={key,w:word,initial,count:0,ex:sentence,exTr:otherLang===native&&other&&sentence===text.trim()?String(other).slice(0,300):''};
    map.set(key,entry);
   }
   entry.count++;
   if(entry.initial&&!initial){entry.w=word;entry.initial=false;}
  }
 });
 // Yalnızca cümle başında geçen kelimeler küçük harfe çevrilir (Almanca adlar hariç).
 return[...map.values()].map(e=>Object.assign(e,{w:e.initial&&learn!=='de'?e.w.toLocaleLowerCase(learn):e.w}));
}
function savedWords(learn){
 const list=typeof root.NB_getFavorites==='function'?root.NB_getFavorites():[];
 return new Set((Array.isArray(list)?list:[]).filter(x=>x&&(x.lang||'de')===learn&&typeof x.w==='string').flatMap(x=>{const w=x.w.toLocaleLowerCase(learn);return[w,w.replace(/^(der|die|das)\s+/u,'')];}));
}
// Türkçe arayüzde uygulamanın kendi sözlüğü önce denenir (artikelli Almanca adlar dahil).
function vocabMeaning(learn,native,word){
 if(native!=='tr')return null;
 const list=typeof VOCAB!=='undefined'?VOCAB:root.VOCAB;if(!Array.isArray(list)||!word)return null;
 const key=word.toLocaleLowerCase(learn);
 return list.find(v=>v&&v.lang===learn&&typeof v.w==='string'&&v.tr&&(v.w.toLocaleLowerCase(learn)===key||(learn==='de'&&v.w.toLocaleLowerCase('de').replace(/^(der|die|das)\s+/u,'')===key)))||null;
}
async function fillMeanings(rows,learn,native){
 const queue=rows.slice();
 const worker=async()=>{
  while(queue.length){
   const r=queue.shift(),word=r.word.value.trim();
   if(!r.row.isConnected)continue;
   if(r.meaning.value.trim()||!word){r.meaning.placeholder='';continue;}
   const known=vocabMeaning(learn,native,word);
   if(known){r.word.value=known.w;r.meaning.value=known.tr;r.cat=known.cat||'';r.level=known.level||'';r.meaning.placeholder='';continue;}
   try{const text=await translateText(word,learn,native,{});if(r.row.isConnected&&!r.meaning.value.trim())r.meaning.value=String(text||'').trim().slice(0,160);}catch(e){}
   if(r.row.isConnected)r.meaning.placeholder=r.meaning.value?'':T('wordsMeaningFailed');
  }
 };
 await Promise.all([worker(),worker()]);
}
function openWords(record,back){
 if(!record){flushHistory();record=currentRecord();}
 const native=root.NATIVE_LANG||'tr',cands=record&&record.rows.length?learnCandidates(record):[];
 const st={learn:cands[0]||null,picked:new Map()};
 const backLabel=key=>(root.NATIVE_LANG==='ar'?'→ ':'← ')+T(key);
 sheet(T('wordsTitle'),(body,panel)=>{
  const actions=el('div','lc-sheet-actions');panel.append(actions);
  const reset=()=>{body.replaceChildren();actions.replaceChildren();actions.hidden=false;if(back)body.append(button(backLabel('backToTranscript'),'lc-sheet-back',back));};
  const empty=text=>{body.append(el('p','lc-empty',text));actions.hidden=true;};
  const pick=()=>{
   reset();
   if(!record||!record.rows.length)return empty(T('transcriptEmpty'));
   if(!st.learn)return empty(T('wordsUnsupported',{list:CORE.filter(c=>c!==native).map(name).join(', ')}));
   if(cands.length>1){
    const seg=el('div','lc-seg');seg.setAttribute('role','group');
    cands.forEach(code=>{const b=button(FLAGS[code]+' '+name(code),'lc-seg-btn',()=>{if(st.learn===code)return;st.learn=code;st.picked.clear();pick();});b.setAttribute('aria-pressed',String(st.learn===code));seg.append(b);});
    body.append(seg);
   }
   body.append(el('p','lc-sheet-meta',T('wordsIntro',{lang:name(st.learn),native:name(native)})));
   const words=wordsList(record,st.learn);
   if(!words.length)return empty(T('wordsNone'));
   const saved=savedWords(st.learn),wrap=el('div','lc-chips');
   const go=button('','work-btn primary',()=>review());
   const paintGo=()=>{go.textContent=T('wordsPick',{n:st.picked.size});go.disabled=!st.picked.size;};
   words.forEach(item=>{
    const chip=button('','lc-chip',null),label=el('span','',item.w);label.lang=st.learn;label.dir='auto';chip.dataset.word=item.key;
    if(saved.has(item.key)){chip.classList.add('is-saved');chip.disabled=true;chip.title=T('wordsInNotes');chip.append(el('span','lc-chip-mark','✓'));}
    chip.append(label);if(item.count>1)chip.append(el('small','','×'+item.count));
    const paint=()=>{const on=st.picked.has(item.key);chip.classList.toggle('is-picked',on);chip.setAttribute('aria-pressed',String(on));};
    chip.onclick=()=>{if(st.picked.has(item.key))st.picked.delete(item.key);else{if(st.picked.size>=WORDS_MAX){toast(T('wordsMax',{n:WORDS_MAX}),'bad');return;}st.picked.set(item.key,item);}paint();paintGo();};
    paint();wrap.append(chip);
   });
   body.append(wrap);actions.append(go);paintGo();
  };
  const review=()=>{
   reset();
   body.append(button(backLabel('wordsBack'),'lc-sheet-back',pick));
   body.append(el('p','lc-sheet-meta',T('wordsReview',{lang:name(st.learn),native:name(native)})));
   const list=el('div','lc-words'),status=el('p','lc-words-status'),rows=[];status.setAttribute('role','status');
   const save=button('','work-btn primary',null);
   let busy=false;
   const paintSave=()=>{const count=rows.filter(r=>r.word.value.trim()).length;save.textContent=busy?T('wordsSaving'):T('wordsSave',{n:count});save.disabled=busy||!count;};
   [...st.picked.values()].forEach(item=>{
    const row=el('div','lc-word'),fields=el('div','lc-word-fields');
    const word=el('input','lc-word-input');word.type='text';word.value=item.w;word.lang=st.learn;word.dir='auto';word.maxLength=80;word.setAttribute('aria-label',T('wordsWord'));
    const meaning=el('input','lc-word-input lc-word-meaning');meaning.type='text';meaning.placeholder=T('wordsLoading');meaning.lang=native;meaning.dir='auto';meaning.maxLength=160;meaning.setAttribute('aria-label',T('wordsMeaning'));
    const r={item,word,meaning,row,cat:'',level:''};
    const remove=button('✕','lc-word-del',()=>{st.picked.delete(item.key);rows.splice(rows.indexOf(r),1);row.remove();if(!rows.length){pick();return;}paintSave();});remove.setAttribute('aria-label',T('wordsRemove'));remove.title=T('wordsRemove');
    fields.append(word,meaning);row.append(fields,remove);
    if(item.ex){const ex=el('p','lc-word-ex',item.ex);ex.lang=st.learn;ex.dir='auto';row.append(ex);}
    word.oninput=paintSave;rows.push(r);list.append(row);
   });
   save.onclick=async()=>{
    if(busy)return;
    if(typeof root.NB_saveFavorite!=='function'){status.textContent=T('wordsUnavailable');return;}
    busy=true;paintSave();status.textContent='';
    let count=0;
    try{
     for(const r of rows.slice()){
      const w=r.word.value.trim();if(!w)continue;
      const ok=await root.NB_saveFavorite({lang:st.learn,meaningLang:native,w,tr:r.meaning.value.trim(),ex:r.item.ex||'',exTr:r.item.exTr||'',cat:r.cat||'Genel',level:r.level||''});
      if(ok!==false){count++;st.picked.delete(r.item.key);}
     }
    }catch(error){const code=error?.message;status.textContent=code==='nb_fav_login_required'?T('wordsLogin'):root.LUMIRA_LIMITS?.ERRORS.includes(code)&&typeof root.t==='function'?root.t(code):T('wordsFailed');}
    busy=false;
    if(count)toast(T('wordsSaved',{n:count}));
    if(!status.textContent)pick();else paintSave();
   };
   body.append(list,status);actions.append(save);paintSave();
   fillMeanings(rows,st.learn,native);
  };
  pick();
 });
}
function refreshLocale(){
 if(!s.host||!s.host.isConnected)return;
 if(s.view==='modes'&&q('[data-live-modes]'))open(s.host);
 else if(s.view==='convo'&&q('[data-convo]')){const notice=s.notice,bad=s.noticeBad;shell();s.notice=notice;s.noticeBad=bad;paintAll();}
}
root.addEventListener('lumira:localechange',()=>setTimeout(refreshLocale,0));
root.addEventListener('pagehide',()=>{if(s.phase!=='idle')end('paused');else flushHistory();});
root.addEventListener('lumira:featureauthchange',()=>{if(s.phase!=='idle')end('login_required',true);});
root.LUMIRA_LIVE_MODES={open,isMounted:()=>!!(s.host&&s.host.isConnected&&s.host.querySelector('[data-live-modes],[data-convo]')),unmount:()=>{unmountConvo();s.view=null;s.observer?.disconnect();},refreshLocale,
 _state:()=>({phase:s.phase,side:s.side,engine:s.engine,auto:s.auto,keep:s.keep,pair:{...s.pair},entries:{top:s.entries.top.length,bottom:s.entries.bottom.length}}),
 _push:(side,original,translated)=>{if(s.view!=='convo')return;push(side,{original,translated:translated||'',state:translated?'done':'failed'});},_flush:flushHistory,_history:readHistory,_plain:plainTranscript,_words:wordsList,_learn:learnCandidates,openWords:()=>openWords(null),LANGS,CORE};
})(window);
