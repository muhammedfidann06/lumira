(function(root){'use strict';
 const locales={tr:'tr-TR',de:'de-DE',en:'en-US',ar:'ar-SA',fr:'fr-FR',es:'es-ES',ru:'ru-RU'};
 const copy={tr:['Konuşulan dil','Otomatik tespit','Derste öğretmenin dilini seçebilirsin. Otomatik mod desteklenen diller arasında geçiş yapar.'],en:['Spoken language','Detect automatically','Choose your teacher’s language for a lesson. Automatic mode switches between supported languages.'],de:['Gesprochene Sprache','Automatisch erkennen','Wähle im Unterricht die Sprache der Lehrkraft. Automatik wechselt zwischen unterstützten Sprachen.'],ar:['لغة الكلام','اكتشاف تلقائي','اختر لغة المعلم أثناء الدرس. ينتقل الوضع التلقائي بين اللغات المدعومة.'],fr:['Langue parlée','Détection automatique','En cours, choisis la langue du professeur. Le mode automatique reconnaît les langues prises en charge.'],es:['Idioma hablado','Detección automática','En clase, elige el idioma del profesor. El modo automático cambia entre los idiomas compatibles.'],ru:['Язык речи','Определять автоматически','На уроке выбери язык преподавателя. Автоматический режим распознаёт поддерживаемые языки.']};
 const normalize=source=>Object.hasOwn(locales,source)?source:'auto';
 function recognizer(SDK,speech,target,source,audio){
  source=normalize(source);const config=SDK.SpeechTranslationConfig.fromAuthorizationToken(speech.token,speech.region);
  // The current SDK rejects fromEndpoint(endpoint, '') before a bearer token
  // can be assigned. Build token auth first, then set the public endpoint.
  if(source==='auto')config.setProperty(SDK.PropertyId.SpeechServiceConnection_Endpoint,'wss://'+speech.region+'.stt.speech.microsoft.com/speech/universal/v2');
  config.authorizationToken=speech.token;config.addTargetLanguage(target);
  if(SDK.PropertyId.Speech_SegmentationSilenceTimeoutMs!==undefined)config.setProperty(SDK.PropertyId.Speech_SegmentationSilenceTimeoutMs,'800');
  if(SDK.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs!==undefined)config.setProperty(SDK.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs,'0');
  if(source!=='auto'){config.speechRecognitionLanguage=locales[source];return new SDK.TranslationRecognizer(config,audio);}
  config.setProperty(SDK.PropertyId.SpeechServiceConnection_LanguageIdMode,'Continuous');
  const detect=SDK.AutoDetectSourceLanguageConfig.fromLanguages(Object.values(locales));
  // FromConfig merges the detection properties over the translation config.
  // Leaving detect at its default would overwrite Continuous with AtStart.
  if(SDK.LanguageIdMode?.Continuous!==undefined)detect.mode=SDK.LanguageIdMode.Continuous;
  else detect.properties?.setProperty(SDK.PropertyId.SpeechServiceConnection_LanguageIdMode,'Continuous');
  return SDK.TranslationRecognizer.FromConfig(config,detect,audio);
 }
 root.LUMIRA_SOURCE={locales,normalize,recognizer,text:i=>(copy[root.NATIVE_LANG]||copy.en)[i]};
})(window);
