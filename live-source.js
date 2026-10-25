(function(root){'use strict';
 const locales={tr:'tr-TR',de:'de-DE',en:'en-US',ar:'ar-SA',fr:'fr-FR',es:'es-ES',ru:'ru-RU'};
 const copy={tr:['Konuşulan dil','Otomatik tespit','Derste öğretmenin dilini seçebilirsin. Otomatik mod desteklenen diller arasında geçiş yapar.'],en:['Spoken language','Detect automatically','Choose your teacher’s language for a lesson. Automatic mode switches between supported languages.'],de:['Gesprochene Sprache','Automatisch erkennen','Wähle im Unterricht die Sprache der Lehrkraft. Automatik wechselt zwischen unterstützten Sprachen.'],ar:['لغة الكلام','اكتشاف تلقائي','اختر لغة المعلم أثناء الدرس. ينتقل الوضع التلقائي بين اللغات المدعومة.'],fr:['Langue parlée','Détection automatique','En cours, choisis la langue du professeur. Le mode automatique reconnaît les langues prises en charge.'],es:['Idioma hablado','Detección automática','En clase, elige el idioma del profesor. El modo automático cambia entre los idiomas compatibles.'],ru:['Язык речи','Определять автоматически','На уроке выбери язык преподавателя. Автоматический режим распознаёт поддерживаемые языки.']};
 const normalize=source=>Object.hasOwn(locales,source)?source:'auto';
 function recognizer(SDK,speech,target,source,audio){
  source=normalize(source);
  if(source!=='auto'){
   const config=SDK.SpeechTranslationConfig.fromAuthorizationToken(speech.token,speech.region);config.addTargetLanguage(target);config.speechRecognitionLanguage=locales[source];
   if(SDK.PropertyId.Speech_SegmentationSilenceTimeoutMs!==undefined)config.setProperty(SDK.PropertyId.Speech_SegmentationSilenceTimeoutMs,'800');
   if(SDK.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs!==undefined)config.setProperty(SDK.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs,'0');
   return new SDK.TranslationRecognizer(config,audio);
  }
  // Continuous LID is supported by JavaScript SpeechRecognizer, not by
  // TranslationRecognizer. Translate each finalized transcript separately.
  const config=SDK.SpeechConfig.fromAuthorizationToken(speech.token,speech.region);
  config.setProperty(SDK.PropertyId.SpeechServiceConnection_Endpoint,'wss://'+speech.region+'.stt.speech.microsoft.com/speech/universal/v2');
  config.setProperty(SDK.PropertyId.SpeechServiceConnection_LanguageIdMode,'Continuous');
  if(SDK.PropertyId.Speech_SegmentationSilenceTimeoutMs!==undefined)config.setProperty(SDK.PropertyId.Speech_SegmentationSilenceTimeoutMs,'800');
  if(SDK.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs!==undefined)config.setProperty(SDK.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs,'0');
  const detect=SDK.AutoDetectSourceLanguageConfig.fromLanguages(Object.values(locales));
  if(SDK.LanguageIdMode?.Continuous!==undefined)detect.mode=SDK.LanguageIdMode.Continuous;
  else detect.properties?.setProperty(SDK.PropertyId.SpeechServiceConnection_LanguageIdMode,'Continuous');
  const result=SDK.SpeechRecognizer.FromConfig(config,detect,audio);result.lumiraTranscriptOnly=true;return result;
 }
 const inputCopy={tr:['Mikrofon ayarları','Mikrofon','Varsayılan mikrofon','Mikrofon seviyesi','Konuşarak mikrofonunu kontrol et.','Gürültü azaltma ve otomatik ses düzeyi','Sanal mikrofon sesini kesiyorsa bu seçeneği kapatıp yeniden başlatabilirsin.'],en:['Microphone settings','Microphone','Default microphone','Input level','Speak to check your microphone.','Noise reduction and automatic gain','If a virtual microphone cuts out, turn this off and restart listening.'],de:['Mikrofoneinstellungen','Mikrofon','Standardmikrofon','Eingangspegel','Sprich, um dein Mikrofon zu prüfen.','Rauschunterdrückung und automatische Verstärkung','Wenn ein virtuelles Mikrofon aussetzt, deaktiviere diese Option und starte erneut.'],ar:['إعدادات الميكروفون','الميكروفون','الميكروفون الافتراضي','مستوى الإدخال','تحدث للتحقق من الميكروفون.','تقليل الضوضاء وضبط الصوت تلقائياً','إذا كان الميكروفون الافتراضي يقطع الصوت، أوقف هذا الخيار وأعد بدء الاستماع.'],fr:['Réglages du microphone','Microphone','Microphone par défaut','Niveau d’entrée','Parle pour vérifier ton microphone.','Réduction du bruit et gain automatique','Si un microphone virtuel coupe le son, désactive cette option et relance l’écoute.'],es:['Ajustes del micrófono','Micrófono','Micrófono predeterminado','Nivel de entrada','Habla para comprobar tu micrófono.','Reducción de ruido y ganancia automática','Si el micrófono virtual corta el audio, desactiva esta opción y reinicia la escucha.'],ru:['Настройки микрофона','Микрофон','Микрофон по умолчанию','Уровень сигнала','Произнеси что-нибудь для проверки микрофона.','Шумоподавление и автоматическая громкость','Если виртуальный микрофон обрывает звук, отключи этот параметр и запусти прослушивание снова.']};
 root.LUMIRA_SOURCE={locales,normalize,recognizer,text:i=>(copy[root.NATIVE_LANG]||copy.en)[i],inputText:i=>(inputCopy[root.NATIVE_LANG]||inputCopy.en)[i]};
})(window);
