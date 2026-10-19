/* Shared account API and translated copy for writing quotas / live translation. */
(function () {
  'use strict';
  const COPY = {
    tr: { title:'🎙️ Canlı Çeviri', back:'← Notlarım’a dön', target:'Tercih edilen dil', source:'Duyulan dil', auto:'Otomatik algılanıyor', original:'Konuşulanlar', translation:'Çeviri', emptySource:'Konuşmaya başladığında duyulanlar burada görünecek.', emptyTarget:'Tercih ettiğin dildeki çeviri burada görünecek.', start:'🎙️ Dinlemeye başla', stop:'⏹ Durdur', clear:'Metni temizle', ready:'Hazır', starting:'Mikrofona ve çeviri servisine bağlanılıyor…', listening:'Dinleniyor', stopped:'Dinleme durduruldu', loading:'Kullanım hakkın kontrol ediliyor…', unlimited:'Sınırsız kullanım', writing:'Son 30 gün: {used} / {limit} · Kalan {remaining} kontrol', live:'Bugün kalan: {time} / {limit} dk', reset:'Yenilenme: {date}', privacy:'Başlat’a bastığında sesin yazıya dökülmek ve çevrilmek için çevrimiçi işlenir. Uygulama ses kaydı saklamaz.', paused:'Uygulamadan ayrıldığın için dinleme durduruldu.', login_required:'Devam etmek için hesabına giriş yap.', server_not_configured:'Bu özellik henüz kullanıma açılmadı.', speech_not_configured:'Canlı çeviri servisi henüz etkinleştirilmemiş.', writing_limit:'30 günlük yazma pratiği hakkın doldu. İlk kullanımının süresi dolduğunda yeniden kontrol yapabilirsin.', live_limit:'Bugünkü canlı çeviri süren doldu.', live_already_active:'Bu hesapla başka bir yerde canlı çeviri açık. Önce o oturumu durdur.', usage_unavailable:'Kullanım hakkın doğrulanamadı. Biraz sonra tekrar dene.', writing_unavailable:'Yazım kontrol servisine şu anda ulaşılamıyor. Kullanım hakkın düşürülmedi.', writing_service_busy:'Yazım servisi yoğun. Kullanım hakkın düşürülmedi; biraz sonra dene.', unsupported_language:'Bu dilde otomatik yazım kontrolü henüz desteklenmiyor.', speech_unavailable:'Çeviri servisine bağlanılamadı. Tekrar deneyebilirsin.', microphone_denied:'Mikrofon izni verilmedi. Tarayıcı ayarlarından bu site için mikrofonu aç.', microphone_unavailable:'Mikrofon kullanılamıyor. Başka bir uygulamanın mikrofonu kullanmadığını kontrol et.', browser_unsupported:'Bu tarayıcıda mikrofon desteklenmiyor. Güncel Safari veya Chrome ile HTTPS üzerinden aç.', sdk_unavailable:'Çeviri bileşeni yüklenemedi. Bağlantını kontrol edip tekrar dene.', session_expired:'Dinleme bağlantısı sona erdi. Yeniden başlatabilirsin.', operation_busy:'Bu metin hâlâ kontrol ediliyor. Birkaç saniye sonra tekrar dene.', purchase_verification_unavailable:'Rozetin bu hesapla eşleştirilmesi tamamlanamadı. Satın alımları geri yüklemeyi tekrar dene.', restore:'Satın alımları geri yükle', restored:'Satın alımlar hesabınla eşleştirildi.', noPurchases:'Geri yüklenecek satın alım bulunamadı.' },
    en: { title:'🎙️ Live Translation', back:'← Back to my notes', target:'Preferred language', source:'Detected language', auto:'Detecting automatically', original:'What is being said', translation:'Translation', emptySource:'Speech will appear here when you start talking.', emptyTarget:'The translation into your preferred language will appear here.', start:'🎙️ Start listening', stop:'⏹ Stop', clear:'Clear text', ready:'Ready', starting:'Connecting to the microphone and translation service…', listening:'Listening', stopped:'Listening stopped', loading:'Checking your allowance…', unlimited:'Unlimited use', writing:'Last 30 days: {used} / {limit} · {remaining} checks left', live:'Left today: {time} / {limit} min', reset:'Renews: {date}', privacy:'When you start, audio is processed online to transcribe and translate it. The app does not store audio recordings.', paused:'Listening stopped because you left the app.', login_required:'Sign in to your account to continue.', server_not_configured:'This feature is not available yet.', speech_not_configured:'Live translation has not been enabled yet.', writing_limit:'Your writing allowance for the last 30 days is used up. A check becomes available when your oldest use expires.', live_limit:'You have used today’s live translation allowance.', live_already_active:'Live translation is already running on this account. Stop that session first.', usage_unavailable:'Your allowance could not be verified. Please try again later.', writing_unavailable:'The checking service is unavailable. Your allowance was not reduced.', writing_service_busy:'The checking service is busy. No check was deducted. Try again later.', unsupported_language:'Automatic writing checks are not supported for this language yet.', speech_unavailable:'Could not connect to the translation service. Try again.', microphone_denied:'Microphone permission was denied. Enable the microphone for this site in your browser settings.', microphone_unavailable:'The microphone is unavailable. Check whether another app is using it.', browser_unsupported:'This browser cannot access the microphone. Open the HTTPS site in a current Safari or Chrome.', sdk_unavailable:'The translation component could not load. Check your connection and try again.', session_expired:'The listening session ended. You can start again.', operation_busy:'This text is still being checked. Try again in a few seconds.', purchase_verification_unavailable:'Your badge could not be linked to this account. Please try restoring purchases again.', restore:'Restore purchases', restored:'Purchases linked to your account.', noPurchases:'There are no purchases to restore.' },
    de: { title:'🎙️ Live-Übersetzung', back:'← Zurück zu meinen Notizen', target:'Gewünschte Sprache', source:'Erkannte Sprache', auto:'Automatische Erkennung', original:'Gesprochener Text', translation:'Übersetzung', emptySource:'Der gesprochene Text erscheint hier.', emptyTarget:'Die Übersetzung erscheint hier.', start:'🎙️ Zuhören starten', stop:'⏹ Stoppen', clear:'Text löschen', ready:'Bereit', starting:'Mikrofon und Übersetzungsdienst werden verbunden…', listening:'Hört zu', stopped:'Zuhören beendet', loading:'Kontingent wird geprüft…', unlimited:'Unbegrenzte Nutzung', writing:'Letzte 30 Tage: {used} / {limit} · {remaining} Prüfungen übrig', live:'Heute übrig: {time} / {limit} Min.', reset:'Erneuerung: {date}', privacy:'Beim Start wird Audio online transkribiert und übersetzt. Die App speichert keine Audioaufnahmen.', paused:'Das Zuhören wurde beim Verlassen der App beendet.', login_required:'Melde dich an, um fortzufahren.', server_not_configured:'Diese Funktion ist noch nicht verfügbar.', speech_not_configured:'Die Live-Übersetzung ist noch nicht aktiviert.', writing_limit:'Dein Kontingent für 30 Tage ist aufgebraucht.', live_limit:'Dein heutiges Zeitkontingent ist aufgebraucht.', live_already_active:'Für dieses Konto läuft bereits eine Sitzung. Beende sie zuerst.', usage_unavailable:'Das Kontingent konnte nicht geprüft werden. Versuche es später erneut.', writing_unavailable:'Der Prüfdienst ist nicht erreichbar. Es wurde keine Nutzung abgezogen.', writing_service_busy:'Der Prüfdienst ist ausgelastet. Es wurde keine Nutzung abgezogen.', unsupported_language:'Diese Sprache wird noch nicht automatisch geprüft.', speech_unavailable:'Der Übersetzungsdienst ist nicht erreichbar.', microphone_denied:'Erlaube den Mikrofonzugriff in den Website-Einstellungen.', microphone_unavailable:'Das Mikrofon ist nicht verfügbar.', browser_unsupported:'Öffne die HTTPS-Seite in einem aktuellen Safari oder Chrome.', sdk_unavailable:'Die Übersetzungskomponente konnte nicht geladen werden.', session_expired:'Die Sitzung ist beendet. Du kannst neu starten.', operation_busy:'Der Text wird noch geprüft. Warte einige Sekunden.', restore:'Käufe wiederherstellen', restored:'Käufe mit dem Konto verknüpft.', noPurchases:'Keine Käufe zum Wiederherstellen.' },
    ar: { title:'🎙️ ترجمة مباشرة', back:'← العودة إلى ملاحظاتي', target:'اللغة المفضلة', source:'اللغة المكتشفة', auto:'اكتشاف تلقائي', original:'الكلام المسموع', translation:'الترجمة', emptySource:'سيظهر الكلام هنا عند بدء التحدث.', emptyTarget:'ستظهر الترجمة هنا.', start:'🎙️ بدء الاستماع', stop:'⏹ إيقاف', clear:'مسح النص', ready:'جاهز', starting:'جارٍ الاتصال بالميكروفون وخدمة الترجمة…', listening:'جارٍ الاستماع', stopped:'توقف الاستماع', loading:'جارٍ التحقق من رصيدك…', unlimited:'استخدام غير محدود', writing:'آخر 30 يوماً: {used} / {limit} · المتبقي {remaining}', live:'المتبقي اليوم: {time} / {limit} دقيقة', reset:'يتجدد: {date}', privacy:'عند البدء يُعالج الصوت عبر الإنترنت لنسخه وترجمته. لا يحفظ التطبيق تسجيلات صوتية.', paused:'توقف الاستماع لأنك غادرت التطبيق.', login_required:'سجّل الدخول للمتابعة.', server_not_configured:'هذه الميزة غير متاحة بعد.', speech_not_configured:'لم تُفعّل الترجمة المباشرة بعد.', writing_limit:'استهلكت رصيد الكتابة لآخر 30 يوماً.', live_limit:'استهلكت وقت الترجمة المتاح اليوم.', live_already_active:'توجد جلسة استماع أخرى لهذا الحساب. أوقفها أولاً.', usage_unavailable:'تعذر التحقق من الرصيد. حاول لاحقاً.', writing_unavailable:'خدمة التدقيق غير متاحة. لم يُخصم من رصيدك.', writing_service_busy:'خدمة التدقيق مشغولة. لم يُخصم من رصيدك.', unsupported_language:'التدقيق غير مدعوم لهذه اللغة بعد.', speech_unavailable:'تعذر الاتصال بخدمة الترجمة.', microphone_denied:'اسمح باستخدام الميكروفون من إعدادات الموقع.', microphone_unavailable:'الميكروفون غير متاح.', browser_unsupported:'افتح الموقع عبر HTTPS في متصفح Safari أو Chrome حديث.', sdk_unavailable:'تعذر تحميل مكوّن الترجمة.', session_expired:'انتهت الجلسة. يمكنك البدء مجدداً.', operation_busy:'لا يزال النص قيد التدقيق. انتظر قليلاً.', restore:'استعادة المشتريات', restored:'رُبطت المشتريات بحسابك.', noPurchases:'لا توجد مشتريات لاستعادتها.' },
    fr: { title:'🎙️ Traduction en direct', back:'← Retour à mes notes', target:'Langue souhaitée', source:'Langue détectée', auto:'Détection automatique', original:'Paroles entendues', translation:'Traduction', emptySource:'Les paroles apparaîtront ici.', emptyTarget:'La traduction apparaîtra ici.', start:'🎙️ Commencer à écouter', stop:'⏹ Arrêter', clear:'Effacer le texte', ready:'Prêt', starting:'Connexion au microphone et au service…', listening:'Écoute en cours', stopped:'Écoute arrêtée', loading:'Vérification de ton quota…', unlimited:'Utilisation illimitée', writing:'30 derniers jours : {used} / {limit} · {remaining} vérifications restantes', live:'Reste aujourd’hui : {time} / {limit} min', reset:'Renouvellement : {date}', privacy:'Au démarrage, l’audio est traité en ligne pour le transcrire et le traduire. L’application ne conserve pas les enregistrements audio.', paused:'L’écoute s’est arrêtée car tu as quitté l’application.', login_required:'Connecte-toi pour continuer.', server_not_configured:'Cette fonctionnalité n’est pas encore disponible.', speech_not_configured:'La traduction en direct n’est pas encore activée.', writing_limit:'Ton quota des 30 derniers jours est épuisé.', live_limit:'Ton temps de traduction pour aujourd’hui est épuisé.', live_already_active:'Une session est déjà active sur ce compte. Arrête-la d’abord.', usage_unavailable:'Impossible de vérifier ton quota. Réessaie plus tard.', writing_unavailable:'Le service de correction est indisponible. Ton quota n’a pas diminué.', writing_service_busy:'Le service est occupé. Ton quota n’a pas diminué.', unsupported_language:'Cette langue n’est pas encore prise en charge.', speech_unavailable:'Le service de traduction est inaccessible.', microphone_denied:'Autorise le microphone dans les paramètres du site.', microphone_unavailable:'Le microphone n’est pas disponible.', browser_unsupported:'Ouvre le site HTTPS avec Safari ou Chrome à jour.', sdk_unavailable:'Le composant de traduction n’a pas pu être chargé.', session_expired:'La session est terminée. Tu peux recommencer.', operation_busy:'Ce texte est encore en cours de vérification.', restore:'Restaurer les achats', restored:'Achats associés à ton compte.', noPurchases:'Aucun achat à restaurer.' },
    es: { title:'🎙️ Traducción en directo', back:'← Volver a mis notas', target:'Idioma preferido', source:'Idioma detectado', auto:'Detección automática', original:'Lo que se dice', translation:'Traducción', emptySource:'Las palabras aparecerán aquí.', emptyTarget:'La traducción aparecerá aquí.', start:'🎙️ Empezar a escuchar', stop:'⏹ Detener', clear:'Borrar texto', ready:'Listo', starting:'Conectando con el micrófono y el servicio…', listening:'Escuchando', stopped:'Escucha detenida', loading:'Comprobando tu cuota…', unlimited:'Uso ilimitado', writing:'Últimos 30 días: {used} / {limit} · Quedan {remaining} revisiones', live:'Queda hoy: {time} / {limit} min', reset:'Se renueva: {date}', privacy:'Al empezar, el audio se procesa en línea para transcribirlo y traducirlo. La aplicación no guarda grabaciones.', paused:'La escucha se detuvo porque saliste de la aplicación.', login_required:'Inicia sesión para continuar.', server_not_configured:'Esta función aún no está disponible.', speech_not_configured:'La traducción en directo aún no está activada.', writing_limit:'Has agotado tu cuota de los últimos 30 días.', live_limit:'Has agotado el tiempo de traducción de hoy.', live_already_active:'Ya hay una sesión activa con esta cuenta. Detenla primero.', usage_unavailable:'No se pudo comprobar tu cuota. Inténtalo más tarde.', writing_unavailable:'El servicio no está disponible. No se descontó ninguna revisión.', writing_service_busy:'El servicio está ocupado. No se descontó ninguna revisión.', unsupported_language:'Este idioma aún no admite revisión automática.', speech_unavailable:'No se pudo conectar con el servicio de traducción.', microphone_denied:'Permite el micrófono en los ajustes del sitio.', microphone_unavailable:'El micrófono no está disponible.', browser_unsupported:'Abre el sitio HTTPS en Safari o Chrome actualizado.', sdk_unavailable:'No se pudo cargar el componente de traducción.', session_expired:'La sesión terminó. Puedes empezar de nuevo.', operation_busy:'El texto aún se está revisando.', restore:'Restaurar compras', restored:'Compras vinculadas a tu cuenta.', noPurchases:'No hay compras que restaurar.' },
    ru: { title:'🎙️ Живой перевод', back:'← К моим заметкам', target:'Язык перевода', source:'Определённый язык', auto:'Автоопределение', original:'Исходная речь', translation:'Перевод', emptySource:'Здесь появится распознанная речь.', emptyTarget:'Здесь появится перевод.', start:'🎙️ Начать слушать', stop:'⏹ Остановить', clear:'Очистить текст', ready:'Готово', starting:'Подключение микрофона и службы перевода…', listening:'Слушаю', stopped:'Прослушивание остановлено', loading:'Проверка лимита…', unlimited:'Без ограничений', writing:'За 30 дней: {used} / {limit} · Осталось {remaining} проверок', live:'Осталось сегодня: {time} / {limit} мин', reset:'Обновление: {date}', privacy:'После запуска звук обрабатывается онлайн для распознавания и перевода. Приложение не сохраняет аудиозаписи.', paused:'Прослушивание остановлено, так как ты покинул приложение.', login_required:'Войди в аккаунт для продолжения.', server_not_configured:'Эта функция пока недоступна.', speech_not_configured:'Живой перевод ещё не включён.', writing_limit:'Лимит за последние 30 дней исчерпан.', live_limit:'Лимит перевода на сегодня исчерпан.', live_already_active:'Для этого аккаунта уже идёт сеанс. Сначала останови его.', usage_unavailable:'Не удалось проверить лимит. Попробуй позже.', writing_unavailable:'Служба проверки недоступна. Лимит не уменьшен.', writing_service_busy:'Служба занята. Лимит не уменьшен.', unsupported_language:'Автоматическая проверка этого языка пока недоступна.', speech_unavailable:'Не удалось подключиться к службе перевода.', microphone_denied:'Разреши доступ к микрофону в настройках сайта.', microphone_unavailable:'Микрофон недоступен.', browser_unsupported:'Открой HTTPS-сайт в актуальном Safari или Chrome.', sdk_unavailable:'Не удалось загрузить компонент перевода.', session_expired:'Сеанс завершён. Можно начать заново.', operation_busy:'Этот текст ещё проверяется.', restore:'Восстановить покупки', restored:'Покупки привязаны к аккаунту.', noPurchases:'Нет покупок для восстановления.' }
  };
  const EXTRA = {
    tr: { operation_expired:'Kontrol işlemi zamanında tamamlanamadı. Tekrar deneyebilirsin; başarısız işlem kullanım hakkından düşülmez.', reconnecting:'Bağlantı yenileniyor… Dinleme yeniden devam edecek.', speech_auth_error:'Konuşma servisi erişimi reddetti. Azure anahtarı ve bölge ayarı kontrol edilmeli.', speech_busy:'Konuşma servisinin eşzamanlı kullanım veya hizmet kotasına ulaşıldı. Biraz sonra tekrar dene.', speech_config_error:'Konuşma servisi bağlantı ayarlarını kabul etmedi.' },
    en: { operation_expired:'The check could not finish in time. Try again; a failed check does not use your allowance.', reconnecting:'Reconnecting… Listening will resume.', speech_auth_error:'The speech service denied access. Check the Azure key and region.', speech_busy:'The speech service concurrency or service quota was reached. Try again later.', speech_config_error:'The speech service rejected the connection settings.' },
    de: { operation_expired:'Die Prüfung konnte nicht rechtzeitig abgeschlossen werden. Versuche es erneut; fehlgeschlagene Prüfungen verbrauchen kein Kontingent.', reconnecting:'Verbindung wird erneuert… Das Zuhören wird fortgesetzt.', speech_auth_error:'Der Sprachdienst hat den Zugriff verweigert. Azure-Schlüssel und Region prüfen.', speech_busy:'Das Dienstlimit für gleichzeitige Verbindungen oder Nutzung wurde erreicht. Versuche es später erneut.', speech_config_error:'Der Sprachdienst hat die Verbindungseinstellungen abgelehnt.' },
    ar: { operation_expired:'لم يكتمل التدقيق في الوقت المحدد. حاول مجددًا؛ لا تُحتسب المحاولة الفاشلة من حصتك.', reconnecting:'جارٍ إعادة الاتصال… سيُستأنف الاستماع.', speech_auth_error:'رفضت خدمة الكلام الوصول. تحقق من مفتاح Azure والمنطقة.', speech_busy:'تم بلوغ حد الاتصالات المتزامنة أو حصة الخدمة. حاول لاحقًا.', speech_config_error:'رفضت خدمة الكلام إعدادات الاتصال.' },
    fr: { operation_expired:'La vérification a expiré. Réessaie ; une vérification échouée ne consomme pas ton quota.', reconnecting:'Reconnexion… L’écoute va reprendre.', speech_auth_error:'Le service vocal a refusé l’accès. Vérifie la clé Azure et la région.', speech_busy:'La limite de connexions ou le quota du service est atteint. Réessaie plus tard.', speech_config_error:'Le service vocal a refusé les paramètres de connexion.' },
    es: { operation_expired:'La revisión no terminó a tiempo. Inténtalo de nuevo; una revisión fallida no consume tu cuota.', reconnecting:'Reconectando… La escucha se reanudará.', speech_auth_error:'El servicio de voz denegó el acceso. Revisa la clave y la región de Azure.', speech_busy:'Se alcanzó el límite de conexiones o la cuota del servicio. Inténtalo más tarde.', speech_config_error:'El servicio de voz rechazó los ajustes de conexión.' },
    ru: { operation_expired:'Проверка не завершилась вовремя. Попробуй снова; неудачная проверка не расходует лимит.', reconnecting:'Повторное подключение… Прослушивание продолжится.', speech_auth_error:'Служба речи отказала в доступе. Проверь ключ Azure и регион.', speech_busy:'Достигнут лимит подключений или квота службы. Попробуй позже.', speech_config_error:'Служба речи отклонила настройки подключения.' }
  };
  Object.keys(EXTRA).forEach(lang => Object.assign(COPY[lang], EXTRA[lang]));
  const LOCAL = {
    "tr": {
      "local_preparing": "Ücretsiz çeviri hazırlanıyor… %{percent}",
      "local_listening": "Dinleniyor · Cihazında ücretsiz çeviri",
      "local_ready": "Ücretsiz yedek model dosyaları hazır.",
      "local_hint": "Çevrimiçi hizmet kullanılamazsa cihazında devam eder. İlk kullanımda model dosyaları yüklenir; Wi-Fi önerilir.",
      "local_downloading": "Ücretsiz yedek hazırlanıyor · %{percent}. İlk yükleme internet kullanır.",
      "local_backup_error": "Ücretsiz yedek yüklenemedi. Bağlantını kontrol edip tekrar deneyebilirsin.",
      "local_retry": "Yedeği yeniden hazırla",
      "local_unsupported": "Bu tarayıcı cihaz içi çeviriyi desteklemiyor. Güncel Chrome veya Safari ile aç.",
      "local_download_error": "Ücretsiz model yüklenemedi. İnternet bağlantını ve boş depolama alanını kontrol edip tekrar başlat.",
      "local_model_error": "Cihaz içi çeviri tamamlanamadı. Cihazda yeterli bellek kalmamış olabilir; yeniden açıp deneyebilirsin.",
      "local_too_slow": "Bu cihaz konuşmaya yetişemediği için dinleme durduruldu. Konuşmaları atlamamak için daha güçlü bir cihaz kullan.",
      "local_audio_error": "Cihaz içi ses işleme başlatılamadı. Mikrofonu kontrol edip tekrar başlat.",
      "local_source_unsupported": "Desteklenen dillerde konuşulması bekleniyor…",
      "local_server_update": "Çevirinin sunucu dosyaları da güncellenmeli. Site yöneticisine bildir.",
      "privacy": "Çevrimiçi modda sesin Azure’da işlenir. Cihaz içi modda ses ve metin cihazında işlenir; ses kaydı saklanmaz. Modeller ilk kullanımda yüklenir. Kullanım hakkın için internet bağlantısı gerekir."
    },
    "en": {
      "local_preparing": "Preparing free translation… {percent}%",
      "local_listening": "Listening · Free translation on your device",
      "local_ready": "Free backup model files are ready.",
      "local_hint": "If the online service is unavailable, translation continues on your device. Models download on first use; Wi-Fi is recommended.",
      "local_downloading": "Preparing free backup · {percent}%. The first download uses internet data.",
      "local_backup_error": "The free backup could not load. Check your connection and try again.",
      "local_retry": "Prepare backup again",
      "local_unsupported": "This browser does not support on-device translation. Open in a current Chrome or Safari.",
      "local_download_error": "Could not load the free model. Check your connection and available storage, then start again.",
      "local_model_error": "On-device translation could not finish. The device may be low on memory; reopen and try again.",
      "local_too_slow": "Listening stopped because this device could not keep up. Use a faster device to avoid skipping speech.",
      "local_audio_error": "On-device audio could not start. Check the microphone and try again.",
      "local_source_unsupported": "Waiting for speech in a supported language…",
      "local_server_update": "The translation server files also need updating. Contact the site owner.",
      "privacy": "Online mode processes audio with Azure. On-device mode processes speech and text on your device; audio recordings are not stored. Models download on first use. An internet connection is required to verify your allowance."
    },
    "de": {
      "local_preparing": "Kostenlose Übersetzung wird vorbereitet… {percent} %",
      "local_listening": "Ich höre zu · Kostenlose Übersetzung auf deinem Gerät",
      "local_ready": "Die Modelldateien für die kostenlose Reserve sind bereit.",
      "local_hint": "Ist der Onlinedienst nicht verfügbar, geht es auf deinem Gerät weiter. Modelle werden beim ersten Mal geladen; WLAN wird empfohlen.",
      "local_downloading": "Kostenlose Reserve wird vorbereitet · {percent} %. Der erste Download benötigt Internetdaten.",
      "local_backup_error": "Die kostenlose Reserve konnte nicht geladen werden. Prüfe die Verbindung und versuche es erneut.",
      "local_retry": "Reserve erneut vorbereiten",
      "local_unsupported": "Dieser Browser unterstützt die Übersetzung auf dem Gerät nicht. Öffne aktuelles Chrome oder Safari.",
      "local_download_error": "Das kostenlose Modell konnte nicht geladen werden. Prüfe Verbindung und freien Speicher und starte erneut.",
      "local_model_error": "Die Übersetzung auf dem Gerät konnte nicht abgeschlossen werden. Vielleicht ist zu wenig Arbeitsspeicher frei. Öffne die App erneut.",
      "local_too_slow": "Das Gerät konnte der Sprache nicht folgen. Das Zuhören wurde beendet, damit keine Sprache übersprungen wird. Verwende ein schnelleres Gerät.",
      "local_audio_error": "Die lokale Audioverarbeitung konnte nicht starten. Prüfe das Mikrofon.",
      "local_source_unsupported": "Warte auf eine unterstützte Sprache…",
      "local_server_update": "Die Serverdateien für die Übersetzung müssen ebenfalls aktualisiert werden. Informiere den Betreiber.",
      "privacy": "Im Onlinemodus verarbeitet Azure das Audio. Im lokalen Modus bleiben Sprach- und Textverarbeitung auf deinem Gerät; Aufnahmen werden nicht gespeichert. Modelle werden beim ersten Mal geladen. Dein Kontingent wird online geprüft."
    },
    "ar": {
      "local_preparing": "جارٍ تجهيز الترجمة المجانية… {percent}٪",
      "local_listening": "جارٍ الاستماع · ترجمة مجانية على جهازك",
      "local_ready": "ملفات نماذج البديل المجاني جاهزة.",
      "local_hint": "إذا تعذرت الخدمة عبر الإنترنت، تستمر الترجمة على جهازك. تُنزَّل النماذج عند أول استخدام؛ يُنصح بشبكة Wi-Fi.",
      "local_downloading": "جارٍ تجهيز البديل المجاني · {percent}٪. التنزيل الأول يستهلك بيانات الإنترنت.",
      "local_backup_error": "تعذر تحميل البديل المجاني. تحقق من الاتصال وحاول مجددًا.",
      "local_retry": "تجهيز البديل مجددًا",
      "local_unsupported": "هذا المتصفح لا يدعم الترجمة على الجهاز. افتح الموقع في إصدار حديث من Chrome أو Safari.",
      "local_download_error": "تعذر تحميل النموذج المجاني. تحقق من الاتصال ومساحة التخزين ثم ابدأ مجددًا.",
      "local_model_error": "تعذر إكمال الترجمة على الجهاز. قد تكون الذاكرة غير كافية؛ أعد فتح التطبيق وحاول مجددًا.",
      "local_too_slow": "توقف الاستماع لأن الجهاز لم يستطع مواكبة الكلام. استخدم جهازًا أسرع لتجنب فقدان أجزاء من الحديث.",
      "local_audio_error": "تعذر بدء معالجة الصوت على الجهاز. تحقق من الميكروفون.",
      "local_source_unsupported": "بانتظار كلام بلغة مدعومة…",
      "local_server_update": "يجب تحديث ملفات خادم الترجمة أيضًا. أبلغ مسؤول الموقع.",
      "privacy": "في الوضع المتصل، تعالج Azure الصوت. في الوضع المحلي، يُعالج الصوت والنص على جهازك ولا تُحفَظ تسجيلات صوتية. تُنزَّل النماذج عند أول استخدام. يلزم الإنترنت للتحقق من حصة الاستخدام."
    },
    "fr": {
      "local_preparing": "Préparation de la traduction gratuite… {percent} %",
      "local_listening": "Écoute en cours · Traduction gratuite sur ton appareil",
      "local_ready": "Les modèles du relais gratuit sont prêts.",
      "local_hint": "Si le service en ligne est indisponible, la traduction continue sur ton appareil. Les modèles se téléchargent à la première utilisation ; le Wi-Fi est conseillé.",
      "local_downloading": "Préparation du relais gratuit · {percent} %. Le premier téléchargement utilise des données Internet.",
      "local_backup_error": "Le relais gratuit n’a pas pu être chargé. Vérifie ta connexion et réessaie.",
      "local_retry": "Préparer à nouveau le relais",
      "local_unsupported": "Ce navigateur ne prend pas en charge la traduction locale. Ouvre une version récente de Chrome ou Safari.",
      "local_download_error": "Le modèle gratuit n’a pas pu être chargé. Vérifie la connexion et l’espace libre, puis recommence.",
      "local_model_error": "La traduction locale n’a pas pu aboutir. La mémoire de l’appareil est peut-être insuffisante ; rouvre l’application et réessaie.",
      "local_too_slow": "L’appareil ne suit pas le rythme de la parole. L’écoute a été arrêtée pour éviter de sauter des passages. Utilise un appareil plus rapide.",
      "local_audio_error": "Le traitement audio local n’a pas pu démarrer. Vérifie le microphone.",
      "local_source_unsupported": "En attente d’une langue prise en charge…",
      "local_server_update": "Les fichiers du serveur de traduction doivent aussi être mis à jour. Préviens le responsable du site.",
      "privacy": "En mode en ligne, Azure traite l’audio. En mode local, l’audio et le texte sont traités sur ton appareil ; les enregistrements ne sont pas conservés. Les modèles se téléchargent à la première utilisation. Ton quota est vérifié en ligne."
    },
    "es": {
      "local_preparing": "Preparando traducción gratuita… {percent} %",
      "local_listening": "Escuchando · Traducción gratuita en tu dispositivo",
      "local_ready": "Los archivos del respaldo gratuito están listos.",
      "local_hint": "Si el servicio en línea no está disponible, la traducción continúa en tu dispositivo. Los modelos se descargan la primera vez; se recomienda Wi-Fi.",
      "local_downloading": "Preparando respaldo gratuito · {percent} %. La primera descarga usa datos de Internet.",
      "local_backup_error": "No se pudo cargar el respaldo gratuito. Revisa la conexión e inténtalo de nuevo.",
      "local_retry": "Preparar respaldo otra vez",
      "local_unsupported": "Este navegador no admite la traducción en el dispositivo. Abre una versión actual de Chrome o Safari.",
      "local_download_error": "No se pudo cargar el modelo gratuito. Revisa la conexión y el almacenamiento libre y vuelve a empezar.",
      "local_model_error": "No se pudo completar la traducción local. Puede faltar memoria; abre de nuevo la aplicación e inténtalo otra vez.",
      "local_too_slow": "Se detuvo la escucha porque el dispositivo no pudo seguir el ritmo. Usa uno más rápido para evitar omitir partes del audio.",
      "local_audio_error": "No se pudo iniciar el audio local. Revisa el micrófono.",
      "local_source_unsupported": "Esperando una lengua compatible…",
      "local_server_update": "También hay que actualizar los archivos del servidor de traducción. Avisa al responsable del sitio.",
      "privacy": "En modo en línea, Azure procesa el audio. En modo local, el audio y el texto se procesan en tu dispositivo; no se guardan grabaciones. Los modelos se descargan la primera vez. Se requiere Internet para verificar tu cuota."
    },
    "ru": {
      "local_preparing": "Подготовка бесплатного перевода… {percent} %",
      "local_listening": "Слушаю · Бесплатный перевод на устройстве",
      "local_ready": "Файлы моделей для бесплатного резерва готовы.",
      "local_hint": "Если онлайн-служба недоступна, перевод продолжится на устройстве. При первом использовании загружаются модели; рекомендуется Wi-Fi.",
      "local_downloading": "Подготовка бесплатного резерва · {percent} %. Первая загрузка расходует интернет-трафик.",
      "local_backup_error": "Не удалось загрузить бесплатный резерв. Проверь подключение и повтори попытку.",
      "local_retry": "Подготовить резерв снова",
      "local_unsupported": "Браузер не поддерживает перевод на устройстве. Открой сайт в актуальном Chrome или Safari.",
      "local_download_error": "Не удалось загрузить бесплатную модель. Проверь подключение и свободное место, затем начни снова.",
      "local_model_error": "Не удалось завершить перевод на устройстве. Возможно, не хватает памяти. Открой приложение заново и повтори попытку.",
      "local_too_slow": "Устройство не успевает обрабатывать речь. Прослушивание остановлено, чтобы не пропускать фрагменты. Используй более быстрое устройство.",
      "local_audio_error": "Не удалось запустить обработку звука на устройстве. Проверь микрофон.",
      "local_source_unsupported": "Ожидание речи на поддерживаемом языке…",
      "local_server_update": "Нужно обновить и серверные файлы перевода. Сообщи владельцу сайта.",
      "privacy": "В онлайн-режиме звук обрабатывает Azure. В локальном режиме звук и текст обрабатываются на устройстве; записи не сохраняются. Модели загружаются при первом использовании. Для проверки лимита нужен Интернет."
    }
  };
  Object.keys(LOCAL).forEach(lang => Object.assign(COPY[lang], LOCAL[lang]));
  const PROVIDER_PRIVACY={"tr": "Çevrimiçi modda sesin çalışan çeviri sağlayıcısında işlenir (Azure, Gemini, Groq veya Cloudflare). Cihaz modunda ses ve metin cihazında işlenir. Uygulama ses kaydı saklamaz. Modeller ilk kullanımda indirilir; kullanım hakkını doğrulamak için internet gerekir.", "en": "Online audio is processed by the active translation provider (Azure, Gemini, Groq or Cloudflare). In device mode, speech and text are processed on your device. The app does not store recordings. Models download on first use; allowance checks require internet.", "de": "Online verarbeitet der aktive Übersetzungsdienst deine Audiodaten (Azure, Gemini, Groq oder Cloudflare). Im lokalen Modus bleiben Sprach- und Textverarbeitung auf deinem Gerät. Die App speichert keine Aufnahmen. Modelle werden beim ersten Mal geladen; das Kontingent wird online geprüft.", "ar": "في الوضع المتصل، يعالج مزود الترجمة النشط الصوت (Azure أو Gemini أو Groq أو Cloudflare). في الوضع المحلي، تتم معالجة الصوت والنص على جهازك. لا يحفظ التطبيق التسجيلات. تُنزّل النماذج عند أول استخدام؛ يلزم الإنترنت للتحقق من حصة الاستخدام.", "fr": "En ligne, le service de traduction actif traite l’audio (Azure, Gemini, Groq ou Cloudflare). En mode local, la parole et le texte sont traités sur ton appareil. L’application ne conserve pas les enregistrements. Les modèles se téléchargent au premier usage ; la vérification du quota nécessite Internet.", "es": "En línea, el proveedor de traducción activo procesa el audio (Azure, Gemini, Groq o Cloudflare). En modo local, la voz y el texto se procesan en tu dispositivo. La aplicación no guarda grabaciones. Los modelos se descargan la primera vez; verificar el cupo requiere Internet.", "ru": "В онлайн-режиме звук обрабатывает активный сервис перевода (Azure, Gemini, Groq или Cloudflare). В локальном режиме речь и текст обрабатываются на устройстве. Приложение не хранит записи. Модели загружаются при первом использовании; для проверки лимита нужен интернет."};
  Object.keys(PROVIDER_PRIVACY).forEach(lang=>{COPY[lang].privacy=PROVIDER_PRIVACY[lang];});
  const CONNECTION_COPY={tr:'Hizmete şu anda bağlanılamıyor. Lütfen biraz sonra tekrar dene.',en:'The service cannot be reached right now. Please try again shortly.',de:'Der Dienst ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal.',ar:'يتعذر الاتصال بالخدمة حالياً. يُرجى المحاولة مرة أخرى بعد قليل.',fr:'Le service est momentanément inaccessible. Réessaie dans quelques instants.',es:'No se puede conectar con el servicio en este momento. Inténtalo de nuevo en unos instantes.',ru:'Сейчас не удаётся подключиться к сервису. Попробуй ещё раз немного позже.'};
  Object.keys(CONNECTION_COPY).forEach(lang=>{COPY[lang].server_not_configured=CONNECTION_COPY[lang];COPY[lang].backend_unavailable=CONNECTION_COPY[lang];COPY[lang].request_timeout=CONNECTION_COPY[lang];});
  for(const [lang,copy] of Object.entries(window.LUMIRA_ACCESS_COPY.rows)){
    Object.assign(COPY[lang],{writing:copy.writingUsage,live:copy.liveUsage,unlimited:copy.noLimit,writing_limit:copy.limitTitle,live_limit:copy.limitTitle,pdf_limit:copy.pdfNote,pdf_badge_required:copy.needBadge});
  }
  const listeners = new Set();
  let cached = null, cachedUid = '', cachedToken = '', cachedTokenUid = '', authBound = false;
  const endpoint=name=>window.LUMIRA_BACKEND?.url(name) || '/.netlify/functions/'+name;
  const user = () => { try { return window.firebase.auth().currentUser; } catch (e) { return null; } };
  let expiryTimer;
  function entitlement(){
    const uid=user()?.uid;if(!uid)return null;let policy=cachedUid===uid?cached:null;
    if(!policy)try{policy=JSON.parse(localStorage.getItem('lumira_entitlement_'+uid)||'null');}catch{}
    if(!policy||!Array.isArray(policy.memberships))return policy;
    const now=Number(policy.serverNow||Date.now())+Math.max(0,Date.now()-(policy.savedAt||Date.now()));
    const rows=policy.memberships.filter(row=>!row.revoked&&!row.removed&&row.sources.some(s=>['active','trialing','past_due'].includes(s.status)&&(s.lifetime||s.endsAt>now)&&(!s.cancelAt||s.cancelAt>now)));
    const amount=Math.max(0,...rows.map(row=>row.amount)),limit=amount===0?0:amount===1?5:null,used=policy.pdf?.used||0;
    return{...policy,tier:amount,badge:rows.find(row=>row.amount===amount)?.badge||'',supportAmounts:rows.map(row=>row.amount),offline:amount>0,pdf:{...policy.pdf,limit,remaining:limit===null?null:Math.max(0,limit-used)}};
  }
  const text = (key, values) => {
    const copy = COPY[window.NATIVE_LANG || 'tr'] || COPY.en;
    let s = copy[key] || COPY.en[key] || copy.usage_unavailable;
    Object.keys(values || {}).forEach(k => { s = s.replaceAll('{' + k + '}', String(values[k])); });
    return s;
  };
  function fail(code) { return Object.assign(new Error(code), { featureCode: code }); }
  function publish(quota, uid) {
    if (!quota || user()?.uid !== uid) return;
    cached = {...quota,savedAt:Date.now()}; cachedUid = uid;
    clearTimeout(expiryTimer);
    const ends=(quota.memberships||[]).filter(row=>row.active).flatMap(row=>row.sources.filter(s=>s.active&&!s.lifetime).map(s=>s.cancelAt?Math.min(s.endsAt,s.cancelAt):s.endsAt)).filter(at=>at>quota.serverNow);
    if(ends.length){expiryTimer=setTimeout(()=>{if(user()?.uid!==uid)return;window.PR_refreshBadges?.();if(navigator.onLine)api('status').catch(()=>{});},Math.min(2147483000,Math.max(100,Math.min(...ends)-quota.serverNow+100)));expiryTimer?.unref?.();}
    try { localStorage.setItem('lumira_entitlement_'+uid,JSON.stringify({tier:quota.tier,badge:quota.badge,pdf:quota.pdf,offline:quota.offline,supportAmounts:quota.supportAmounts,revokedSupport:quota.revokedSupport,memberships:quota.memberships,serverNow:quota.serverNow,savedAt:Date.now()})); } catch(e) {}
    listeners.forEach(fn => fn(quota));
    document.querySelectorAll('[data-writing-quota]').forEach(el => { el.textContent = writingLabel(quota); el.classList.remove('feature-error'); });
  }
  async function api(action, params, options) {
    const u = user();
    if (!u) throw fail('login_required');
    const uid = u.uid;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(options?.service==='stories'?45000:25000,options?.timeoutMs || (options?.service==='stories'?45000:25000)));
    const abort=()=>controller.abort();
    if(options?.signal){if(options.signal.aborted)abort();else options.signal.addEventListener('abort',abort,{once:true});}
    let tokenAbort;
    try {
      const getToken = refresh => Promise.race([Promise.resolve().then(()=>u.getIdToken(refresh)),new Promise((resolve,reject)=>{
        tokenAbort=()=>reject(Object.assign(new Error('Request cancelled'),{name:'AbortError'}));
        if(controller.signal.aborted)tokenAbort();else controller.signal.addEventListener('abort',tokenAbort,{once:true});
      })]);
      const send=async refresh=>{
      const token=await getToken(refresh);controller.signal.removeEventListener('abort',tokenAbort);
      if(user()?.uid!==uid)throw fail('login_required');
      cachedToken=token;cachedTokenUid=uid;
      return fetch(endpoint(options?.service|| (options?.admin?'admin-badges':options?.audio?'live-audio':'features')), {
        method: 'POST', credentials:'omit', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(Object.assign({ action }, params)), keepalive: !!(options && options.keepalive)
      });
      };
      let response=await send(false);if(response.status===401){await response.body?.cancel();response=await send(true);}
      let data;
      try { data = await response.json(); } catch (e) { throw fail('backend_unavailable'); }
      if(!data || typeof data!=='object' || Array.isArray(data))throw fail('backend_unavailable');
      if (user()?.uid !== uid) throw fail('login_required');
      if (data.quota) publish(data.quota, uid);
      if (!response.ok) {
        if(['writing_limit','live_limit','pdf_limit','pdf_badge_required'].includes(data.error))window.LUMIRA_ACCESS?.open(data.error,data.quota || cached);
        throw fail(data.error || 'usage_unavailable');
      }
      return data;
    } catch (e) { throw e.featureCode ? e : fail(options?.audio || action==='liveConnect'?'speech_unavailable':e?.code?.startsWith('auth/')?'login_required':e?.name==='AbortError'?'request_timeout':'backend_unavailable'); }
    finally { clearTimeout(timer);if(tokenAbort)controller.signal.removeEventListener('abort',tokenAbort);options?.signal?.removeEventListener('abort',abort); }
  }
  function writingLabel(quota) {
    const q = quota.writing;
    let label = q.limit === null ? text('unlimited') : text('writing', q);
    if (q.remaining === 0 && q.resetsAt) label += ' · ' + text('reset', { date: new Date(q.resetsAt).toLocaleString(window.NATIVE_LANG || 'tr') });
    return label;
  }
  function mountWriting(el) {
    if (!el) return;
    if (cached && cachedUid === user()?.uid) el.textContent = writingLabel(cached);
    else el.textContent = text('loading');
    api('status').catch(e => { if (el.isConnected) { el.textContent = text(e.featureCode); el.classList.add('feature-error'); } });
  }
  async function verifyPurchase(sku, purchaseToken, expectedUid) {
    if (expectedUid && user()?.uid !== expectedUid) throw fail('login_required');
    return api('verifyPurchase', { sku, purchaseToken });
  }
  async function restorePurchases() {
    if (!user()) throw fail('login_required');
    if (typeof window.getDigitalGoodsService !== 'function') throw fail('purchase_verification_unavailable');
    const uid = user().uid, service = await window.getDigitalGoodsService('https://play.google.com/billing');
    const purchases = await service.listPurchases();
    let count = 0;
    for (const p of purchases) {
      if (!/^lumira_support_(1|5|10|25|50|100)$/.test(p.itemId)) continue;
      await verifyPurchase(p.itemId, p.purchaseToken, uid);
      count++;
    }
    await api('status');
    return count;
  }
  // Best-effort unload release uses the last already-obtained ID token.
  function releaseOnExit(id) {
    if (!id || !cachedToken || cachedTokenUid!==user()?.uid) return;
    fetch(endpoint('features'), { method: 'POST', credentials:'omit', keepalive: true, headers: { 'Content-Type':'application/json', Authorization:'Bearer ' + cachedToken }, body: JSON.stringify({ action:'liveStop', id }) }).catch(() => {});
  }
  window.LUMIRA_FEATURES = { api, service:(service,action,params,options)=>api(action,params,{...options,service}), adminBadges:(action,params,options)=>api(action,params,{...options,admin:true}), audio:(params,options)=>api('audio',params,{...options,audio:true}), entitlement, text, errorText: e => text(e?.featureCode || 'usage_unavailable'), mountWriting, verifyPurchase, restorePurchases, releaseOnExit,
    id: () => crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(20)), n => n.toString(16).padStart(2,'0')).join(''),
    getQuota: () => cachedUid === user()?.uid ? cached : null,
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); }
  };
  function bindAuth() {
    if (authBound) return;
    try {
      window.firebase.auth().onAuthStateChanged(() => {
        clearTimeout(expiryTimer); cached = null; cachedUid = ''; cachedToken = ''; cachedTokenUid = '';
        window.dispatchEvent(new Event('lumira:featureauthchange'));
      });
      authBound = true;
    } catch (e) { /* Firebase may initialize later; DOMContentLoaded retries. */ }
  }
  bindAuth();
  document.addEventListener('DOMContentLoaded', bindAuth, { once: true });
})();
