(function(root){'use strict';
 const locales={tr:'tr-TR',de:'de-DE',en:'en-US',ar:'ar-SA',fr:'fr-FR',es:'es-ES',ru:'ru-RU'};
 const copy={tr:['Konuşulan dil','Otomatik tespit','Derste öğretmenin dilini seçebilirsin. Otomatik mod desteklenen diller arasında geçiş yapar.'],en:['Spoken language','Detect automatically','Choose your teacher’s language for a lesson. Automatic mode switches between supported languages.'],de:['Gesprochene Sprache','Automatisch erkennen','Wähle im Unterricht die Sprache der Lehrkraft. Automatik wechselt zwischen unterstützten Sprachen.'],ar:['لغة الكلام','اكتشاف تلقائي','اختر لغة المعلم أثناء الدرس. ينتقل الوضع التلقائي بين اللغات المدعومة.'],fr:['Langue parlée','Détection automatique','En cours, choisis la langue du professeur. Le mode automatique reconnaît les langues prises en charge.'],es:['Idioma hablado','Detección automática','En clase, elige el idioma del profesor. El modo automático cambia entre los idiomas compatibles.'],ru:['Язык речи','Определять автоматически','На уроке выбери язык преподавателя. Автоматический режим распознаёт поддерживаемые языки.']};
 const normalize=source=>Object.hasOwn(locales,source)?source:'auto';
 function recognizer(SDK,speech,target,source,audio){
  source=normalize(source);const config=source==='auto'?SDK.SpeechTranslationConfig.fromEndpoint(new URL('wss://'+speech.region+'.stt.speech.microsoft.com/speech/universal/v2'),''):SDK.SpeechTranslationConfig.fromAuthorizationToken(speech.token,speech.region);
  config.authorizationToken=speech.token;config.addTargetLanguage(target);
  if(source!=='auto'){config.speechRecognitionLanguage=locales[source];return new SDK.TranslationRecognizer(config,audio);}
  config.setProperty(SDK.PropertyId.SpeechServiceConnection_LanguageIdMode,'Continuous');
  return SDK.TranslationRecognizer.FromConfig(config,SDK.AutoDetectSourceLanguageConfig.fromLanguages(Object.values(locales)),audio);
 }
 root.LUMIRA_SOURCE={locales,normalize,recognizer,text:i=>(copy[root.NATIVE_LANG]||copy.en)[i]};
})(window);
