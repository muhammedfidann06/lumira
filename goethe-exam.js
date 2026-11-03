/* Seviye Tespit girişi ve Goethe-Zertifikat deneme sınavları.
   Sınavlar resmî sınavın yapısını (bölümler, Teil'ler, görev türleri, süreler,
   60 puan geçme sınırı) izler; içerik Lumira için özgün yazılmıştır ve
   goethe/<seviye>-<no>.json dosyalarından istek üzerine yüklenir. */
(function(root){'use strict';
const VERSION=(()=>{try{return new URL(document.currentScript.src).searchParams.get('v')||'1';}catch(e){return '1';}})();
const COPY={
 tr:{hubEyebrow:'LUMIRA · SEVİYE TESPİT',hubTitle:'Seviyeni ölç',hubIntro:'Kelime bilgini hızlıca test et ya da seçtiğin dilin sertifika sınavı düzeninde tam bir deneme sınavına gir.',wordTitle:'Kelime Seviye Tespit Sınavı',wordDesc:'Seçtiğin seviyedeki kelimeleri test et. Doğru bildiklerin bilinenler listene eklenir.',goetheTitle:'Sertifika Deneme Sınavları',goetheDesc:'Önce dili seç: Goethe, Cambridge, DELF/DALF, DELE, ТРКИ ve daha fazlası, gerçek sınav düzeninde.',back:'Geri',heroTitle:'Goethe-Zertifikat deneme sınavları',heroText:'Bölümler, görev türleri ve süreler resmî sınavla aynı düzende. Tüm sorular Lumira için özgün hazırlandı.',disclaimer:'Bu deneme sınavları Goethe-Institut tarafından hazırlanmamıştır ve resmî sınav yerine geçmez.',official:'Resmî örnek sınavlar (goethe.de)',levelA1:'Günlük hayatın temel ifadeleri: kendini tanıtma, basit sorular, kısa notlar.',levelA2:'Tanıdık konularda kısa metinler, duyurular ve basit yazışmalar.',levelB1:'Günlük hayatta ve işte bağımsız dil kullanımı; görüş bildirme.',levelB2:'Uzun ve soyut metinleri anlama, akıcı tartışma ve resmî yazışma.',testsCount:'{n} deneme',passedCount:'{n} bölüm geçildi',test:'Deneme {n}',modules:'Bölümler',minutes:'{n} dk',questions:'{n} soru',tasks:'{n} görev',notStarted:'Başlanmadı',inProgress:'Devam ediyor',passed:'Geçti',belowPass:'Sınırın altında',done:'Tamamlandı',start:'Başla',resume:'Kaldığın yerden devam et',retake:'Yeniden çöz',review:'Cevapları incele',timed:'Gerçek sınav süresiyle çöz',timeLeft:'Kalan süre',timeUp:'Süre doldu; cevapların değerlendirildi.',part:'Teil {i}/{n}',prev:'← Önceki',next:'Sonraki →',finish:'Bölümü bitir',unanswered:'{n} soru boş. Yine de bitirilsin mi?',saveExit:'Kaydet ve çık',listen:'▶ Dinle',stop:'■ Durdur',playsLeft:'Kalan dinleme hakkı: {n}',noPlays:'Dinleme hakkın bitti.',noVoice:'Seslendirme açılamadı. İnternet bağlantını kontrol edip tekrar dene.',score:'{c}/{t} doğru',points:'{p} / 100 puan',pass:'Geçtin!',fail:'Geçmek için en az {n} puan gerekir.',yourAnswer:'Senin cevabın',rightAnswer:'Doğru cevap',empty:'Boş',transcript:'Dinleme metni',toTests:'Deneme listesi',toModules:'Bölümlere dön',writeHere:'Metnini buraya yaz…',words:'{n} kelime',target:'Hedef: yaklaşık {n} kelime',contentPoints:'İçerik noktaları — yazdıklarını işaretle',sample:'Örnek çözüm',showSample:'Örnek çözümü göster',hideSample:'Örnek çözümü gizle',check:'Dil kontrolü yap',checking:'Kontrol ediliyor…',issues:'{n} dil önerisi bulundu:',noIssues:'Dil hatası bulunamadı.',formScore:'Form: {c}/{t} doğru',writingNote:'Serbest yazım gerçek sınavda değerlendiricilerce puanlanır. Burada içerik noktalarını işaretler, metnini yapay zekâya sınav ölçütleriyle puanlatır ve örnek çözümle karşılaştırırsın.',speakingNote:'Konuşma bölümü gerçek sınavda bir görevliyle yapılır. Burada her görevi sesli cevaplar, yapay zekâdan tahmini puan ve geri bildirim alır, örnek cevapları dinlersin.',phrases:'Yararlı ifadeler',sampleAnswer:'Örnek cevap',listenSample:'🔊 Örnek cevabı dinle',markDone:'Bölümü tamamla',loading:'Sınav yükleniyor…',loadError:'Sınav yüklenemedi. İnternet bağlantını kontrol edip tekrar dene.',retry:'Tekrar dene',xp:'+{n} XP kazandın!',answered:'{a}/{t} cevaplandı',best:'En iyi: {p}',lesen:'Okuma',hoeren:'Dinleme',schreiben:'Yazma',sprechen:'Konuşma',login:'Sınav sonuçlarının kaydedilmesi için giriş yap.',aiScore:'🤖 Yapay zekâ ile puanla',aiScoring:'Puanlanıyor…',aiRescore:'🤖 Yeniden puanla',aiTitle:'Yapay zekâ değerlendirmesi',aiEstimate:'Tahmini puan',aiStale:'Metni puanladıktan sonra değiştirdin. Güncel puan için yeniden puanla.',aiNote:'Puan, sınav ölçütlerine göre yapay zekâ ile tahmin edilir; resmî sınav puanı değildir. Her puanlama 1 yazma kontrolü hakkı kullanır.',aiLogin:'Yapay zekâ puanlaması için giriş yap.',tooShort:'Puanlamak için en az {n} kelime gerekli.',critTask:'Görevin yerine getirilmesi',critCoherence:'Tutarlılık ve akış',critVocabulary:'Kelime bilgisi',critGrammar:'Dil bilgisi',strengths:'Güçlü yönlerin',improvements:'Geliştirebileceklerin',corrections:'Düzeltmeler',improved:'Geliştirilmiş metin',moduleEstimate:'Tahmini puan · {m}',scoreRest:'🤖 Kalan görevleri puanla ({n})',scoredCount:'{a}/{t} görev puanlandı',unscoredNote:'Tahmini bölüm puanını görmek için tüm görevleri yapay zekâya puanlat.',record:'🎙️ Cevabını söyle',recordStop:'■ Kaydı bitir',recordHint:'{lang} konuş; söylediklerin aşağıya yazılır. Gerekirse metni düzeltebilirsin.',typeHint:'Bu cihazda konuşma tanıma yok. Cevabını {lang} yazabilirsin.',answerLabel:'Cevabın',speechFailed:'Konuşma tanınamadı. Tekrar dene ya da cevabını yaz.',micDenied:'Mikrofon izni verilmedi. Tarayıcı ayarlarından mikrofonu aç.',pronunciation:'Telaffuz değerlendirilmez; söylediklerinin yazıya dökülmüş hali puanlanır.',sumTitle:'🎓 Sertifika deneme sınavların',sumEmpty:'Henüz {name} denemesi çözmedin. Gerçek sınav düzeninde denemeler seni bekliyor.',sumOpen:'Deneme sınavlarına git',sumExams:'{n}/{t} deneme',sumAvg:'ort. {p}',sumWeak:'🎯 En zayıf: {level} · {m} Teil {k} (%{p})',sumWeakModule:'🎯 En zayıf: {level} · {m} (%{p})',sumNext:'{level} · Deneme {n} ile devam et',sumAll:'Tüm denemeler',levelC1:'Karmaşık ve uzun metinleri anlama, akademik ve mesleki konularda akıcı, yapılandırılmış ifade.',fullTitle:'Tam sınav',fullDesc:'Bütün bölümler arka arkaya, gerçek sınav sırası ve süreleriyle (toplam {min} dk). Puanlarını en sonda tek bir sonuç belgesinde görürsün.',fullStart:'🏁 Tam sınavı başlat',fullResume:'▶ Devam et · {m} ({i}/{n})',fullRestart:'Baştan başla',fullConfirmRestart:'Devam eden tam sınav silinip baştan başlansın mı?',fullLast:'Son tam sınav: {p} / 100',fullView:'Sonuç belgesini gör',fullIntro:'Tam sınav · Bölüm {i}/{n}. Süre gerçek sınavdaki gibi işler; bölümü bitirince sıradakine geçersin.',fullDone:'{m} tamamlandı',fullNextUp:'Sıradaki bölüm: {m} · {min} dakika',fullContinue:'{m} bölümüne başla',fullPause:'Ara ver, sonra devam et',fullBreakHint:'Gerçek sınavda bölümler arasında kısa molalar olur. Puanlarını en sonda, sonuç belgesinde görürsün.',certTitle:'Sonuç belgesi',certHeading:'{level} · Deneme {n} sonucu',certOverall:'Genel puan',certPassedAll:'Tüm bölümleri geçtin!',certPassedSome:'{a}/{t} bölüm geçildi',certPassed:'Sınavı geçtin!',certFailed:'Bu sefer olmadı',certIncomplete:'Sonuç henüz tamamlanmadı',certPending:'Yazma ve konuşma görevleri henüz puanlanmadı. Genel sonucu görmek için yapay zekâ ile puanla.',certModular:'B1, B2 ve C1’de her bölüm ayrı değerlendirilir: geçmek için her bölümde en az 60 puan gerekir.',certTotalRule:'A1 ve A2’de toplam puan değerlendirilir: geçmek için en az 60 puan gerekir.',certScore:'🤖 Yazma ve konuşma görevlerini puanla ({n})',certNote:'Bu bir deneme sonucudur, resmî bir sertifika değildir. Yazma ve konuşma puanları yapay zekâ tahminidir; boş bırakılan görevler 0 puan sayılır.',certNotScored:'puanlanmadı',certPrint:'🖨️ Yazdır / PDF',certPrintHint:'PDF olarak kaydetmek için yazdırma penceresinde “PDF olarak kaydet”i seç.',certShare:'Paylaş',certShareText:'Lumira’da {exam} · Deneme {n} tam sınavında {p}/100 aldım!',certRetry:'Tam sınavı yeniden çöz',certModule:'Bölüm',certPoints:'Puan',certGrade:'Derece',certFooter:'Lumira ile oluşturuldu',freeNote:'Rozetsiz 1 deneme ücretsiz. Herhangi bir rozet tüm denemeleri sınırsız açar.',freeFirst:'Rozetsiz 1 deneme ücretsiz: başlattığın ilk deneme, ücretsiz denemen olur.',lockedTitle:'Bu deneme rozet gerektiriyor',lockedText:'Ücretsiz deneme hakkını {exam} için kullandın. Tüm denemeler için herhangi bir rozet yeterli; en küçük rozet de olur.',lockedCta:'Rozetleri gör',lockedChip:'🔒 Rozet gerekli',openFree:'Ücretsiz denemene git',chooseCertTitle:'Hangi dilin sınavına hazırlanıyorsun?',chooseCertIntro:'Dili seç; o dilde tanınan sertifika sınavının formatında denemeler açılır.',familyHero:'{name} deneme sınavları',familyDisclaimer:'Bu deneme sınavları {org} tarafından hazırlanmamıştır ve resmî sınav yerine geçmez.',arabicDisclaimer:'Arapça için herkesçe tanınan tek bir sertifika bulunmadığından bu denemeler Avrupa Dilleri Ortak Çerçevesi (CEFR) seviyelerine göre dört beceriyle hazırlandı; resmî bir sınav yerine geçmez.',ruleTotal:'Toplam puan değerlendirilir: geçmek için en az {n} puan gerekir.',ruleDelf:'Geçmek için 100 üzerinden en az 50 puan ve her bölümde 25 üzerinden en az 5 puan gerekir.',ruleDele:'İki grup ayrı değerlendirilir: Okuma ile Yazma ve Dinleme ile Konuşma gruplarının her birinde en az 60 puan gerekir.',ruleTorfl:'Her alt testte en az %66 başarı gerekir.',grammatik:'Kelime ve dil bilgisi'},
 en:{hubEyebrow:'LUMIRA · PLACEMENT',hubTitle:'Measure your level',hubIntro:'Quickly test your vocabulary or take a full practice exam in the format of a certificate exam for the language you choose.',wordTitle:'Vocabulary Placement Test',wordDesc:'Test the words of your chosen level. Words you know are added to your known list.',goetheTitle:'Certificate practice exams',goetheDesc:'Choose a language first: Goethe, Cambridge, DELF/DALF, DELE, TORFL and more, in the real exam layout.',back:'Back',heroTitle:'Goethe-Zertifikat practice exams',heroText:'Sections, task types and timings follow the official exam. Every question was written for Lumira.',disclaimer:'These practice exams are not produced by the Goethe-Institut and do not replace the official exam.',official:'Official sample exams (goethe.de)',levelA1:'Basic everyday expressions: introducing yourself, simple questions, short notes.',levelA2:'Short texts, announcements and simple messages on familiar topics.',levelB1:'Independent use in daily life and at work; giving opinions.',levelB2:'Understanding long, abstract texts; fluent discussion and formal writing.',testsCount:'{n} exams',passedCount:'{n} sections passed',test:'Exam {n}',modules:'Sections',minutes:'{n} min',questions:'{n} questions',tasks:'{n} tasks',notStarted:'Not started',inProgress:'In progress',passed:'Passed',belowPass:'Below pass mark',done:'Done',start:'Start',resume:'Continue where you left off',retake:'Take again',review:'Review answers',timed:'Use the real exam time',timeLeft:'Time left',timeUp:'Time is up; your answers were scored.',part:'Teil {i}/{n}',prev:'← Previous',next:'Next →',finish:'Finish section',unanswered:'{n} questions are unanswered. Finish anyway?',saveExit:'Save and exit',listen:'▶ Listen',stop:'■ Stop',playsLeft:'Plays left: {n}',noPlays:'No plays left.',noVoice:'The audio could not be played. Check your internet connection and try again.',score:'{c}/{t} correct',points:'{p} / 100 points',pass:'You passed!',fail:'You need at least {n} points to pass.',yourAnswer:'Your answer',rightAnswer:'Correct answer',empty:'Blank',transcript:'Transcript',toTests:'Exam list',toModules:'Back to sections',writeHere:'Write your text here…',words:'{n} words',target:'Target: about {n} words',contentPoints:'Content points — tick what you covered',sample:'Sample answer',showSample:'Show sample answer',hideSample:'Hide sample answer',check:'Check language',checking:'Checking…',issues:'{n} language suggestions:',noIssues:'No language errors found.',formScore:'Form: {c}/{t} correct',writingNote:'Free writing is marked by examiners in the real exam. Here you tick the content points, have your text scored by AI against the exam criteria and compare it with a sample answer.',speakingNote:'The speaking test is done with an examiner in the real exam. Here you answer each task out loud, get an estimated score and feedback from AI, and listen to sample answers.',phrases:'Useful phrases',sampleAnswer:'Sample answer',listenSample:'🔊 Listen to the sample',markDone:'Complete section',loading:'Loading exam…',loadError:'The exam could not be loaded. Check your connection and try again.',retry:'Try again',xp:'You earned +{n} XP!',answered:'{a}/{t} answered',best:'Best: {p}',lesen:'Reading',hoeren:'Listening',schreiben:'Writing',sprechen:'Speaking',login:'Sign in to save your exam results.',aiScore:'🤖 Score with AI',aiScoring:'Scoring…',aiRescore:'🤖 Score again',aiTitle:'AI assessment',aiEstimate:'Estimated score',aiStale:'You changed the text after it was scored. Score again for an up-to-date result.',aiNote:'The score is an AI estimate based on the exam criteria, not an official result. Each assessment uses 1 writing check.',aiLogin:'Sign in to use AI scoring.',tooShort:'At least {n} words are needed for scoring.',critTask:'Task fulfilment',critCoherence:'Coherence and flow',critVocabulary:'Vocabulary',critGrammar:'Grammar',strengths:'Your strengths',improvements:'What to improve',corrections:'Corrections',improved:'Improved version',moduleEstimate:'Estimated score · {m}',scoreRest:'🤖 Score the remaining tasks ({n})',scoredCount:'{a}/{t} tasks scored',unscoredNote:'Score every task with AI to see an estimated section score.',record:'🎙️ Speak your answer',recordStop:'■ Stop recording',recordHint:'Speak {lang}; what you say is written below. You can correct the text if needed.',typeHint:'Speech recognition is not available on this device. You can type your answer in {lang}.',answerLabel:'Your answer',speechFailed:'Speech could not be recognised. Try again or type your answer.',micDenied:'Microphone access was denied. Allow the microphone in your browser settings.',pronunciation:'Pronunciation is not assessed; the transcript of what you said is scored.',sumTitle:'🎓 Your certificate practice exams',sumEmpty:'You have not taken a {name} practice exam yet. Exams in the real layout are waiting for you.',sumOpen:'Go to practice exams',sumExams:'{n}/{t} exams',sumAvg:'avg. {p}',sumWeak:'🎯 Weakest: {level} · {m} Teil {k} ({p}%)',sumWeakModule:'🎯 Weakest: {level} · {m} ({p}%)',sumNext:'Continue with {level} · Exam {n}',sumAll:'All exams',levelC1:'Understanding complex, long texts; fluent, well-structured expression on academic and professional topics.',fullTitle:'Full exam',fullDesc:'All sections back to back in the real order and timing ({min} min in total). You see your scores at the end on a single result sheet.',fullStart:'🏁 Start the full exam',fullResume:'▶ Continue · {m} ({i}/{n})',fullRestart:'Start over',fullConfirmRestart:'Delete the full exam in progress and start over?',fullLast:'Last full exam: {p} / 100',fullView:'View result sheet',fullIntro:'Full exam · Section {i}/{n}. The timer runs as in the real exam; when you finish this section you move on to the next one.',fullDone:'{m} completed',fullNextUp:'Next section: {m} · {min} minutes',fullContinue:'Start {m}',fullPause:'Take a break, continue later',fullBreakHint:'The real exam has short breaks between sections. You will see your scores at the end, on the result sheet.',certTitle:'Result sheet',certHeading:'{level} · Exam {n} result',certOverall:'Overall score',certPassedAll:'You passed every section!',certPassedSome:'{a}/{t} sections passed',certPassed:'You passed the exam!',certFailed:'Not this time',certIncomplete:'The result is not complete yet',certPending:'The writing and speaking tasks have not been scored yet. Score them with AI to see the overall result.',certModular:'At B1, B2 and C1 each section is assessed separately: you need at least 60 points in every section to pass it.',certTotalRule:'At A1 and A2 the total score counts: you need at least 60 points to pass.',certScore:'🤖 Score the writing and speaking tasks ({n})',certNote:'This is a practice result, not an official certificate. Writing and speaking scores are AI estimates; tasks left empty count as 0 points.',certNotScored:'not scored',certPrint:'🖨️ Print / PDF',certPrintHint:'To save it as a PDF, choose “Save as PDF” in the print dialog.',certShare:'Share',certShareText:'I scored {p}/100 in the {exam} · Exam {n} full practice exam on Lumira!',certRetry:'Retake the full exam',certModule:'Section',certPoints:'Points',certGrade:'Grade',certFooter:'Created with Lumira',freeNote:'One practice exam is free without a badge. Any badge unlocks every exam without limits.',freeFirst:'One exam is free without a badge: the first exam you start becomes your free exam.',lockedTitle:'This exam needs a badge',lockedText:'You used your free exam on {exam}. Any badge unlocks every exam, even the smallest one.',lockedCta:'See badges',lockedChip:'🔒 Badge needed',openFree:'Go to your free exam',chooseCertTitle:'Which language exam are you preparing for?',chooseCertIntro:'Choose a language to open practice exams in the format of a recognised certificate for it.',familyHero:'{name} practice exams',familyDisclaimer:'These practice exams are not produced by {org} and do not replace the official exam.',arabicDisclaimer:'There is no single, universally recognised Arabic certificate, so these exams follow the CEFR levels across all four skills. They do not replace an official exam.',ruleTotal:'The total score counts: you need at least {n} points to pass.',ruleDelf:'You need at least 50/100 overall and at least 5/25 in every section.',ruleDele:'Two groups are assessed separately: you need at least 60 in Reading + Writing and in Listening + Speaking.',ruleTorfl:'You need at least 66% in every subtest.',grammatik:'Vocabulary and grammar'},
 de:{hubEyebrow:'LUMIRA · EINSTUFUNG',hubTitle:'Miss dein Niveau',hubIntro:'Teste schnell deinen Wortschatz oder mach eine vollständige Übungsprüfung im Format einer Zertifikatsprüfung für die Sprache deiner Wahl.',wordTitle:'Wortschatz-Einstufungstest',wordDesc:'Teste die Wörter deines Niveaus. Bekannte Wörter kommen auf deine Liste.',goetheTitle:'Zertifikats-Übungsprüfungen',goetheDesc:'Wähle zuerst eine Sprache: Goethe, Cambridge, DELF/DALF, DELE, TORFL und mehr, im echten Prüfungsaufbau.',back:'Zurück',heroTitle:'Übungsprüfungen Goethe-Zertifikat',heroText:'Teile, Aufgabentypen und Zeiten folgen der offiziellen Prüfung. Alle Aufgaben wurden für Lumira geschrieben.',disclaimer:'Diese Übungsprüfungen stammen nicht vom Goethe-Institut und ersetzen die offizielle Prüfung nicht.',official:'Offizielle Übungssätze (goethe.de)',levelA1:'Einfache Alltagsausdrücke: sich vorstellen, einfache Fragen, kurze Notizen.',levelA2:'Kurze Texte, Durchsagen und einfache Nachrichten zu vertrauten Themen.',levelB1:'Selbstständige Sprachverwendung im Alltag und im Beruf; Meinungen äußern.',levelB2:'Lange, abstrakte Texte verstehen; flüssig diskutieren und formell schreiben.',testsCount:'{n} Prüfungen',passedCount:'{n} Module bestanden',test:'Prüfung {n}',modules:'Module',minutes:'{n} Min.',questions:'{n} Aufgaben',tasks:'{n} Aufgaben',notStarted:'Nicht begonnen',inProgress:'Begonnen',passed:'Bestanden',belowPass:'Unter der Grenze',done:'Erledigt',start:'Starten',resume:'Weitermachen',retake:'Neu machen',review:'Antworten ansehen',timed:'Mit echter Prüfungszeit',timeLeft:'Restzeit',timeUp:'Die Zeit ist um; deine Antworten wurden bewertet.',part:'Teil {i}/{n}',prev:'← Zurück',next:'Weiter →',finish:'Modul beenden',unanswered:'{n} Aufgaben sind offen. Trotzdem beenden?',saveExit:'Speichern und beenden',listen:'▶ Hören',stop:'■ Stopp',playsLeft:'Noch {n}× hören',noPlays:'Keine Wiedergabe mehr.',noVoice:'Die Sprachausgabe konnte nicht gestartet werden. Prüfe deine Internetverbindung und versuche es erneut.',score:'{c}/{t} richtig',points:'{p} / 100 Punkte',pass:'Bestanden!',fail:'Zum Bestehen brauchst du mindestens {n} Punkte.',yourAnswer:'Deine Antwort',rightAnswer:'Richtige Antwort',empty:'Leer',transcript:'Hörtext',toTests:'Prüfungsliste',toModules:'Zu den Modulen',writeHere:'Schreib deinen Text hier…',words:'{n} Wörter',target:'Ziel: etwa {n} Wörter',contentPoints:'Inhaltspunkte — hake ab, was du geschrieben hast',sample:'Musterlösung',showSample:'Musterlösung zeigen',hideSample:'Musterlösung ausblenden',check:'Sprache prüfen',checking:'Wird geprüft…',issues:'{n} sprachliche Hinweise:',noIssues:'Keine Sprachfehler gefunden.',formScore:'Formular: {c}/{t} richtig',writingNote:'Freies Schreiben wird in der echten Prüfung von Prüfenden bewertet. Hier hakst du die Inhaltspunkte ab, lässt deinen Text von der KI nach den Prüfungskriterien bewerten und vergleichst ihn mit der Musterlösung.',speakingNote:'Die mündliche Prüfung findet mit Prüfenden statt. Hier beantwortest du jede Aufgabe laut, bekommst eine geschätzte Punktzahl und Feedback von der KI und hörst Musterantworten.',phrases:'Redemittel',sampleAnswer:'Musterantwort',listenSample:'🔊 Musterantwort hören',markDone:'Modul abschließen',loading:'Prüfung wird geladen…',loadError:'Die Prüfung konnte nicht geladen werden. Prüfe die Verbindung und versuche es erneut.',retry:'Erneut versuchen',xp:'+{n} XP verdient!',answered:'{a}/{t} beantwortet',best:'Bestes: {p}',lesen:'Lesen',hoeren:'Hören',schreiben:'Schreiben',sprechen:'Sprechen',login:'Melde dich an, um deine Ergebnisse zu speichern.',aiScore:'🤖 Mit KI bewerten',aiScoring:'Wird bewertet…',aiRescore:'🤖 Erneut bewerten',aiTitle:'KI-Bewertung',aiEstimate:'Geschätzte Punktzahl',aiStale:'Du hast den Text nach der Bewertung geändert. Bewerte ihn erneut für ein aktuelles Ergebnis.',aiNote:'Die Punktzahl ist eine KI-Schätzung nach den Prüfungskriterien, kein offizielles Ergebnis. Jede Bewertung verbraucht 1 Schreibprüfung.',aiLogin:'Melde dich an, um die KI-Bewertung zu nutzen.',tooShort:'Für eine Bewertung sind mindestens {n} Wörter nötig.',critTask:'Aufgabenerfüllung',critCoherence:'Kohärenz und Flüssigkeit',critVocabulary:'Wortschatz',critGrammar:'Strukturen',strengths:'Deine Stärken',improvements:'Das kannst du verbessern',corrections:'Korrekturen',improved:'Verbesserte Fassung',moduleEstimate:'Geschätzte Punktzahl · {m}',scoreRest:'🤖 Restliche Aufgaben bewerten ({n})',scoredCount:'{a}/{t} Aufgaben bewertet',unscoredNote:'Lass alle Aufgaben von der KI bewerten, um eine geschätzte Modulpunktzahl zu sehen.',record:'🎙️ Antwort sprechen',recordStop:'■ Aufnahme beenden',recordHint:'Sprich {lang}; was du sagst, erscheint unten als Text. Du kannst ihn bei Bedarf korrigieren.',typeHint:'Auf diesem Gerät gibt es keine Spracherkennung. Du kannst deine Antwort auf {lang} schreiben.',answerLabel:'Deine Antwort',speechFailed:'Die Sprache wurde nicht erkannt. Versuche es erneut oder schreib deine Antwort.',micDenied:'Kein Mikrofonzugriff. Erlaube das Mikrofon in den Browsereinstellungen.',pronunciation:'Die Aussprache wird nicht bewertet; bewertet wird die Abschrift deiner Antwort.',sumTitle:'🎓 Deine Zertifikats-Übungsprüfungen',sumEmpty:'Du hast noch keine {name}-Übungsprüfung gemacht. Prüfungen im echten Aufbau warten auf dich.',sumOpen:'Zu den Übungsprüfungen',sumExams:'{n}/{t} Prüfungen',sumAvg:'Ø {p}',sumWeak:'🎯 Am schwächsten: {level} · {m} Teil {k} ({p} %)',sumWeakModule:'🎯 Am schwächsten: {level} · {m} ({p} %)',sumNext:'Weiter mit {level} · Prüfung {n}',sumAll:'Alle Prüfungen',levelC1:'Komplexe, lange Texte verstehen; sich fließend und strukturiert zu akademischen und beruflichen Themen äußern.',fullTitle:'Gesamtprüfung',fullDesc:'Alle Teile hintereinander in echter Reihenfolge und Zeit (insgesamt {min} Min.). Deine Punkte siehst du erst am Ende auf einem Ergebnisblatt.',fullStart:'🏁 Gesamtprüfung starten',fullResume:'▶ Weiter · {m} ({i}/{n})',fullRestart:'Neu beginnen',fullConfirmRestart:'Die laufende Gesamtprüfung löschen und neu beginnen?',fullLast:'Letzte Gesamtprüfung: {p} / 100',fullView:'Ergebnisblatt ansehen',fullIntro:'Gesamtprüfung · Modul {i}/{n}. Die Zeit läuft wie in der echten Prüfung; danach geht es mit dem nächsten Modul weiter.',fullDone:'{m} abgeschlossen',fullNextUp:'Nächstes Modul: {m} · {min} Minuten',fullContinue:'{m} beginnen',fullPause:'Pause machen, später weiter',fullBreakHint:'In der echten Prüfung gibt es kurze Pausen zwischen den Modulen. Deine Punkte siehst du am Ende auf dem Ergebnisblatt.',certTitle:'Ergebnisblatt',certHeading:'{level} · Prüfung {n}: Ergebnis',certOverall:'Gesamtpunktzahl',certPassedAll:'Alle Teile bestanden!',certPassedSome:'{a}/{t} Module bestanden',certPassed:'Prüfung bestanden!',certFailed:'Diesmal nicht bestanden',certIncomplete:'Das Ergebnis ist noch nicht vollständig',certPending:'Die Schreib- und Sprechaufgaben sind noch nicht bewertet. Lass sie von der KI bewerten, um das Gesamtergebnis zu sehen.',certModular:'Bei B1, B2 und C1 wird jedes Modul einzeln bewertet: Zum Bestehen brauchst du in jedem Modul mindestens 60 Punkte.',certTotalRule:'Bei A1 und A2 zählt die Gesamtpunktzahl: Zum Bestehen brauchst du mindestens 60 Punkte.',certScore:'🤖 Schreib- und Sprechaufgaben bewerten ({n})',certNote:'Dies ist ein Übungsergebnis, kein offizielles Zertifikat. Die Punkte für Schreiben und Sprechen sind KI-Schätzungen; leere Aufgaben zählen 0 Punkte.',certNotScored:'nicht bewertet',certPrint:'🖨️ Drucken / PDF',certPrintHint:'Zum Speichern als PDF im Druckdialog „Als PDF speichern“ wählen.',certShare:'Teilen',certShareText:'Ich habe in der Gesamtprüfung {exam} · Prüfung {n} bei Lumira {p}/100 Punkte erreicht!',certRetry:'Gesamtprüfung wiederholen',certModule:'Modul',certPoints:'Punkte',certGrade:'Prädikat',certFooter:'Erstellt mit Lumira',freeNote:'Ohne Abzeichen ist eine Übungsprüfung kostenlos. Jedes Abzeichen schaltet alle Prüfungen unbegrenzt frei.',freeFirst:'Ohne Abzeichen ist eine Prüfung kostenlos: Die erste Prüfung, die du beginnst, wird deine kostenlose Prüfung.',lockedTitle:'Für diese Prüfung brauchst du ein Abzeichen',lockedText:'Deine kostenlose Prüfung ist {exam}. Jedes Abzeichen schaltet alle Prüfungen frei, auch das kleinste.',lockedCta:'Abzeichen ansehen',lockedChip:'🔒 Abzeichen nötig',openFree:'Zu deiner kostenlosen Prüfung',chooseCertTitle:'Auf welche Sprachprüfung bereitest du dich vor?',chooseCertIntro:'Wähle eine Sprache, um Übungsprüfungen im Format eines anerkannten Zertifikats zu öffnen.',familyHero:'{name} – Übungsprüfungen',familyDisclaimer:'Diese Übungsprüfungen stammen nicht von {org} und ersetzen nicht die offizielle Prüfung.',arabicDisclaimer:'Für Arabisch gibt es kein allgemein anerkanntes Einzelzertifikat. Diese Prüfungen folgen daher den GER-Niveaus in allen vier Fertigkeiten und ersetzen keine offizielle Prüfung.',ruleTotal:'Es zählt die Gesamtpunktzahl: Zum Bestehen brauchst du mindestens {n} Punkte.',ruleDelf:'Zum Bestehen brauchst du insgesamt mindestens 50/100 und in jedem Teil mindestens 5/25.',ruleDele:'Zwei Gruppen werden getrennt bewertet: Du brauchst mindestens 60 in Lesen + Schreiben und in Hören + Sprechen.',ruleTorfl:'In jedem Untertest brauchst du mindestens 66 %.',grammatik:'Wortschatz und Grammatik'},
 ar:{hubEyebrow:'LUMIRA · تحديد المستوى',hubTitle:'قِس مستواك',hubIntro:'اختبر مفرداتك بسرعة أو أدِّ امتحانًا تجريبيًا كاملًا بصيغة امتحان شهادة للغة التي تختارها.',wordTitle:'اختبار تحديد مستوى المفردات',wordDesc:'اختبر كلمات المستوى الذي تختاره. تُضاف الكلمات التي تعرفها إلى قائمتك.',goetheTitle:'امتحانات الشهادات التجريبية',goetheDesc:'اختر اللغة أولًا: غوته وكامبريدج وDELF/DALF وDELE وTORFL وغيرها، بترتيب الامتحان الحقيقي.',back:'رجوع',heroTitle:'امتحانات تجريبية لشهادة غوته',heroText:'الأقسام وأنواع المهام والأوقات بترتيب الامتحان الرسمي. كُتبت كل الأسئلة خصيصًا لـ Lumira.',disclaimer:'هذه الامتحانات التجريبية ليست من إعداد معهد غوته ولا تغني عن الامتحان الرسمي.',official:'نماذج الامتحان الرسمية (goethe.de)',levelA1:'تعابير يومية أساسية: التعريف بالنفس، أسئلة بسيطة، ملاحظات قصيرة.',levelA2:'نصوص قصيرة وإعلانات ورسائل بسيطة عن مواضيع مألوفة.',levelB1:'استخدام مستقل للغة في الحياة اليومية والعمل؛ إبداء الرأي.',levelB2:'فهم نصوص طويلة ومجردة؛ نقاش طليق وكتابة رسمية.',testsCount:'{n} امتحانات',passedCount:'{n} أقسام ناجحة',test:'الامتحان {n}',modules:'الأقسام',minutes:'{n} د',questions:'{n} أسئلة',tasks:'{n} مهام',notStarted:'لم يبدأ',inProgress:'قيد التقدم',passed:'ناجح',belowPass:'دون حد النجاح',done:'مكتمل',start:'ابدأ',resume:'تابع من حيث توقفت',retake:'أعد الحل',review:'راجع الإجابات',timed:'حلّ بزمن الامتحان الحقيقي',timeLeft:'الوقت المتبقي',timeUp:'انتهى الوقت وتم تقييم إجاباتك.',part:'Teil {i}/{n}',prev:'→ السابق',next:'التالي ←',finish:'أنهِ القسم',unanswered:'هناك {n} أسئلة بلا إجابة. هل تريد الإنهاء؟',saveExit:'احفظ واخرج',listen:'▶ استمع',stop:'■ إيقاف',playsLeft:'مرات الاستماع المتبقية: {n}',noPlays:'انتهت مرات الاستماع.',noVoice:'تعذر تشغيل الصوت. تحقق من اتصالك بالإنترنت وحاول مجددًا.',score:'{c}/{t} صحيحة',points:'{p} / 100 نقطة',pass:'نجحت!',fail:'تحتاج إلى {n} درجة على الأقل للنجاح.',yourAnswer:'إجابتك',rightAnswer:'الإجابة الصحيحة',empty:'فارغة',transcript:'نص الاستماع',toTests:'قائمة الامتحانات',toModules:'العودة إلى الأقسام',writeHere:'اكتب نصك هنا…',words:'{n} كلمة',target:'الهدف: نحو {n} كلمة',contentPoints:'نقاط المحتوى — علِّم ما كتبته',sample:'حل نموذجي',showSample:'اعرض الحل النموذجي',hideSample:'أخفِ الحل النموذجي',check:'دقق اللغة',checking:'جارٍ التدقيق…',issues:'{n} اقتراحات لغوية:',noIssues:'لم تُعثر على أخطاء لغوية.',formScore:'الاستمارة: {c}/{t} صحيحة',writingNote:'يقيّم الممتحنون الكتابة الحرة في الامتحان الحقيقي. هنا تعلّم نقاط المحتوى، ويقيّم الذكاء الاصطناعي نصك وفق معايير الامتحان، وتقارنه بالحل النموذجي.',speakingNote:'يُجرى امتحان المحادثة مع ممتحن. هنا تجيب عن كل مهمة بصوت عالٍ، وتحصل على درجة تقديرية وملاحظات من الذكاء الاصطناعي، وتستمع إلى إجابات نموذجية.',phrases:'تعابير مفيدة',sampleAnswer:'إجابة نموذجية',listenSample:'🔊 استمع إلى الإجابة النموذجية',markDone:'أكمل القسم',loading:'جارٍ تحميل الامتحان…',loadError:'تعذر تحميل الامتحان. تحقق من الاتصال وحاول مجددًا.',retry:'إعادة المحاولة',xp:'ربحت +{n} XP!',answered:'{a}/{t} تمت الإجابة',best:'الأفضل: {p}',lesen:'القراءة',hoeren:'الاستماع',schreiben:'الكتابة',sprechen:'المحادثة',login:'سجّل الدخول لحفظ نتائج الامتحان.',aiScore:'🤖 قيّم بالذكاء الاصطناعي',aiScoring:'جارٍ التقييم…',aiRescore:'🤖 أعد التقييم',aiTitle:'تقييم الذكاء الاصطناعي',aiEstimate:'الدرجة التقديرية',aiStale:'غيّرت النص بعد تقييمه. أعد التقييم للحصول على نتيجة محدثة.',aiNote:'الدرجة تقدير بالذكاء الاصطناعي وفق معايير الامتحان وليست نتيجة رسمية. يستهلك كل تقييم فحص كتابة واحدًا.',aiLogin:'سجّل الدخول لاستخدام التقييم بالذكاء الاصطناعي.',tooShort:'يلزم {n} كلمات على الأقل للتقييم.',critTask:'تحقيق المهمة',critCoherence:'الترابط والانسيابية',critVocabulary:'المفردات',critGrammar:'القواعد',strengths:'نقاط قوتك',improvements:'ما يمكنك تحسينه',corrections:'التصحيحات',improved:'نسخة محسّنة',moduleEstimate:'الدرجة التقديرية · {m}',scoreRest:'🤖 قيّم المهام المتبقية ({n})',scoredCount:'تم تقييم {a}/{t} مهام',unscoredNote:'قيّم كل المهام بالذكاء الاصطناعي لترى درجة تقديرية للقسم.',record:'🎙️ قل إجابتك',recordStop:'■ أوقف التسجيل',recordHint:'تحدث بـ{lang}؛ يُكتب ما تقوله في الأسفل. يمكنك تصحيح النص عند الحاجة.',typeHint:'التعرف على الكلام غير متاح على هذا الجهاز. يمكنك كتابة إجابتك بـ{lang}.',answerLabel:'إجابتك',speechFailed:'تعذر التعرف على الكلام. حاول مجددًا أو اكتب إجابتك.',micDenied:'لم يُسمح بالميكروفون. فعّله من إعدادات المتصفح.',pronunciation:'لا يُقيَّم النطق؛ يُقيَّم النص المكتوب لما قلته.',sumTitle:'🎓 امتحانات الشهادات التجريبية',sumEmpty:'لم تؤدِّ أي امتحان {name} تجريبي بعد. امتحانات بترتيب الامتحان الحقيقي بانتظارك.',sumOpen:'انتقل إلى الامتحانات التجريبية',sumExams:'{n}/{t} امتحانات',sumAvg:'المتوسط {p}',sumWeak:'🎯 الأضعف: {level} · {m} Teil {k} (%{p})',sumWeakModule:'🎯 الأضعف: {level} · {m} (%{p})',sumNext:'تابع مع {level} · الامتحان {n}',sumAll:'كل الامتحانات',levelC1:'فهم النصوص الطويلة والمعقدة، والتعبير بطلاقة وتنظيم في الموضوعات الأكاديمية والمهنية.',fullTitle:'الامتحان الكامل',fullDesc:'كل الأقسام متتالية بترتيب الامتحان الحقيقي وأوقاته (المجموع {min} دقيقة). ترى درجاتك في النهاية في ورقة نتيجة واحدة.',fullStart:'🏁 ابدأ الامتحان الكامل',fullResume:'▶ تابع · {m} ({i}/{n})',fullRestart:'ابدأ من جديد',fullConfirmRestart:'هل تريد حذف الامتحان الكامل الجاري والبدء من جديد؟',fullLast:'آخر امتحان كامل: {p} / 100',fullView:'عرض ورقة النتيجة',fullIntro:'الامتحان الكامل · القسم {i}/{n}. يجري الوقت كما في الامتحان الحقيقي؛ عند إنهاء هذا القسم تنتقل إلى التالي.',fullDone:'اكتمل {m}',fullNextUp:'القسم التالي: {m} · {min} دقيقة',fullContinue:'ابدأ {m}',fullPause:'خذ استراحة وتابع لاحقًا',fullBreakHint:'في الامتحان الحقيقي توجد استراحات قصيرة بين الأقسام. سترى درجاتك في النهاية في ورقة النتيجة.',certTitle:'ورقة النتيجة',certHeading:'نتيجة {level} · الامتحان {n}',certOverall:'الدرجة الكلية',certPassedAll:'نجحت في كل الأقسام!',certPassedSome:'نجحت في {a}/{t} أقسام',certPassed:'نجحت في الامتحان!',certFailed:'ليس هذه المرة',certIncomplete:'النتيجة لم تكتمل بعد',certPending:'لم تُقيَّم مهام الكتابة والمحادثة بعد. قيّمها بالذكاء الاصطناعي لترى النتيجة الكلية.',certModular:'في B1 وB2 وC1 يُقيَّم كل قسم على حدة: يلزم 60 درجة على الأقل في كل قسم للنجاح فيه.',certTotalRule:'في A1 وA2 تُحتسب الدرجة الكلية: يلزم 60 درجة على الأقل للنجاح.',certScore:'🤖 قيّم مهام الكتابة والمحادثة ({n})',certNote:'هذه نتيجة تدريبية وليست شهادة رسمية. درجات الكتابة والمحادثة تقديرات بالذكاء الاصطناعي، والمهام المتروكة فارغة تُحتسب صفرًا.',certNotScored:'لم تُقيَّم',certPrint:'🖨️ طباعة / PDF',certPrintHint:'لحفظها بصيغة PDF اختر «حفظ بصيغة PDF» في نافذة الطباعة.',certShare:'مشاركة',certShareText:'حصلت على {p}/100 في الامتحان الكامل {exam} · الامتحان {n} على Lumira!',certRetry:'أعد الامتحان الكامل',certModule:'القسم',certPoints:'الدرجة',certGrade:'التقدير',certFooter:'أُنشئت باستخدام Lumira',freeNote:'امتحان تجريبي واحد مجاني بدون شارة. أي شارة تفتح كل الامتحانات بلا حدود.',freeFirst:'امتحان واحد مجاني بدون شارة: أول امتحان تبدؤه يصبح امتحانك المجاني.',lockedTitle:'يتطلب هذا الامتحان شارة',lockedText:'استخدمت امتحانك المجاني في {exam}. أي شارة تفتح كل الامتحانات، حتى أصغرها.',lockedCta:'عرض الشارات',lockedChip:'🔒 تلزم شارة',openFree:'انتقل إلى امتحانك المجاني',chooseCertTitle:'لأي امتحان لغة تستعد؟',chooseCertIntro:'اختر لغة لتظهر امتحانات تجريبية بصيغة شهادة معترف بها لها.',familyHero:'امتحانات {name} التجريبية',familyDisclaimer:'لم يُعِدّ {org} هذه الامتحانات التجريبية، وهي لا تحل محل الامتحان الرسمي.',arabicDisclaimer:'لا توجد شهادة واحدة معترف بها عالميًا للعربية، لذا تتبع هذه الامتحانات مستويات الإطار الأوروبي المرجعي في المهارات الأربع، ولا تحل محل امتحان رسمي.',ruleTotal:'تُحتسب الدرجة الكلية: يلزم {n} درجة على الأقل للنجاح.',ruleDelf:'يلزم 50/100 على الأقل إجمالًا و5/25 على الأقل في كل قسم.',ruleDele:'تُقيَّم مجموعتان منفصلتان: يلزم 60 على الأقل في القراءة والكتابة وفي الاستماع والمحادثة.',ruleTorfl:'يلزم 66% على الأقل في كل اختبار فرعي.',grammatik:'المفردات والقواعد'},
 fr:{hubEyebrow:'LUMIRA · TEST DE NIVEAU',hubTitle:'Mesure ton niveau',hubIntro:'Teste rapidement ton vocabulaire ou passe un examen blanc complet au format d’une certification de la langue de ton choix.',wordTitle:'Test de niveau de vocabulaire',wordDesc:'Teste les mots du niveau choisi. Les mots connus rejoignent ta liste.',goetheTitle:'Examens blancs de certification',goetheDesc:'Choisis d’abord une langue : Goethe, Cambridge, DELF/DALF, DELE, TORFL et plus encore, au format réel.',back:'Retour',heroTitle:'Examens blancs Goethe-Zertifikat',heroText:'Épreuves, types de tâches et durées suivent l’examen officiel. Toutes les questions ont été écrites pour Lumira.',disclaimer:'Ces examens blancs ne sont pas produits par le Goethe-Institut et ne remplacent pas l’examen officiel.',official:'Modèles d’examen officiels (goethe.de)',levelA1:'Expressions quotidiennes de base : se présenter, questions simples, courts messages.',levelA2:'Textes courts, annonces et messages simples sur des sujets familiers.',levelB1:'Usage autonome au quotidien et au travail ; donner son avis.',levelB2:'Comprendre des textes longs et abstraits ; discuter avec aisance, écrire formellement.',testsCount:'{n} examens',passedCount:'{n} modules réussis',test:'Examen {n}',modules:'Modules',minutes:'{n} min',questions:'{n} questions',tasks:'{n} tâches',notStarted:'Pas commencé',inProgress:'En cours',passed:'Réussi',belowPass:'Sous le seuil',done:'Terminé',start:'Commencer',resume:'Reprendre où tu t’étais arrêté',retake:'Refaire',review:'Voir les réponses',timed:'Avec la durée réelle de l’examen',timeLeft:'Temps restant',timeUp:'Temps écoulé ; tes réponses ont été évaluées.',part:'Teil {i}/{n}',prev:'← Précédent',next:'Suivant →',finish:'Terminer le module',unanswered:'{n} questions sans réponse. Terminer quand même ?',saveExit:'Enregistrer et quitter',listen:'▶ Écouter',stop:'■ Arrêter',playsLeft:'Écoutes restantes : {n}',noPlays:'Plus d’écoute disponible.',noVoice:'Impossible de lancer l’audio. Vérifie ta connexion Internet et réessaie.',score:'{c}/{t} justes',points:'{p} / 100 points',pass:'Réussi !',fail:'Il faut au moins {n} points pour réussir.',yourAnswer:'Ta réponse',rightAnswer:'Bonne réponse',empty:'Vide',transcript:'Transcription',toTests:'Liste des examens',toModules:'Retour aux modules',writeHere:'Écris ton texte ici…',words:'{n} mots',target:'Objectif : environ {n} mots',contentPoints:'Points de contenu — coche ce que tu as traité',sample:'Corrigé type',showSample:'Afficher le corrigé',hideSample:'Masquer le corrigé',check:'Vérifier la langue',checking:'Vérification…',issues:'{n} suggestions linguistiques :',noIssues:'Aucune erreur trouvée.',formScore:'Formulaire : {c}/{t} justes',writingNote:'À l’examen, l’écrit libre est noté par des examinateurs. Ici, tu coches les points de contenu, fais noter ton texte par l’IA selon les critères de l’examen et le compares avec un corrigé.',speakingNote:'L’épreuve orale se passe avec un examinateur. Ici, tu réponds à voix haute à chaque tâche, obtiens une note estimée et des conseils de l’IA, et écoutes des réponses types.',phrases:'Expressions utiles',sampleAnswer:'Réponse type',listenSample:'🔊 Écouter la réponse type',markDone:'Terminer le module',loading:'Chargement de l’examen…',loadError:'Impossible de charger l’examen. Vérifie ta connexion et réessaie.',retry:'Réessayer',xp:'+{n} XP gagnés !',answered:'{a}/{t} répondues',best:'Meilleur : {p}',lesen:'Lecture',hoeren:'Écoute',schreiben:'Écriture',sprechen:'Oral',login:'Connecte-toi pour enregistrer tes résultats.',aiScore:'🤖 Noter avec l’IA',aiScoring:'Notation…',aiRescore:'🤖 Noter à nouveau',aiTitle:'Évaluation par l’IA',aiEstimate:'Note estimée',aiStale:'Tu as modifié le texte après la notation. Note-le à nouveau pour un résultat à jour.',aiNote:'La note est une estimation de l’IA selon les critères de l’examen, pas un résultat officiel. Chaque évaluation utilise 1 vérification d’écriture.',aiLogin:'Connecte-toi pour utiliser la notation par l’IA.',tooShort:'Il faut au moins {n} mots pour noter.',critTask:'Réalisation de la tâche',critCoherence:'Cohérence et fluidité',critVocabulary:'Vocabulaire',critGrammar:'Grammaire',strengths:'Tes points forts',improvements:'À améliorer',corrections:'Corrections',improved:'Version améliorée',moduleEstimate:'Note estimée · {m}',scoreRest:'🤖 Noter les tâches restantes ({n})',scoredCount:'{a}/{t} tâches notées',unscoredNote:'Fais noter toutes les tâches par l’IA pour voir une note estimée du module.',record:'🎙️ Dis ta réponse',recordStop:'■ Arrêter l’enregistrement',recordHint:'Parle {lang} ; ce que tu dis s’écrit ci-dessous. Tu peux corriger le texte si besoin.',typeHint:'La reconnaissance vocale n’est pas disponible sur cet appareil. Tu peux écrire ta réponse en {lang}.',answerLabel:'Ta réponse',speechFailed:'La parole n’a pas été reconnue. Réessaie ou écris ta réponse.',micDenied:'Accès au micro refusé. Autorise le micro dans les réglages du navigateur.',pronunciation:'La prononciation n’est pas évaluée ; la transcription de ta réponse est notée.',sumTitle:'🎓 Tes examens blancs de certification',sumEmpty:'Tu n’as pas encore passé d’examen blanc {name}. Des examens au format réel t’attendent.',sumOpen:'Aller aux examens blancs',sumExams:'{n}/{t} examens',sumAvg:'moy. {p}',sumWeak:'🎯 Le plus faible : {level} · {m} Teil {k} ({p} %)',sumWeakModule:'🎯 Le plus faible : {level} · {m} ({p} %)',sumNext:'Continuer avec {level} · Examen {n}',sumAll:'Tous les examens',levelC1:'Comprendre des textes longs et complexes ; s’exprimer avec aisance et structure sur des sujets académiques et professionnels.',fullTitle:'Examen complet',fullDesc:'Toutes les épreuves à la suite, dans l’ordre et le temps réels ({min} min au total). Tu découvres tes notes à la fin, sur une seule feuille de résultats.',fullStart:'🏁 Commencer l’examen complet',fullResume:'▶ Continuer · {m} ({i}/{n})',fullRestart:'Recommencer',fullConfirmRestart:'Supprimer l’examen complet en cours et recommencer ?',fullLast:'Dernier examen complet : {p} / 100',fullView:'Voir la feuille de résultats',fullIntro:'Examen complet · Épreuve {i}/{n}. Le temps s’écoule comme à l’examen ; à la fin de cette épreuve, tu passes à la suivante.',fullDone:'{m} terminé',fullNextUp:'Épreuve suivante : {m} · {min} minutes',fullContinue:'Commencer {m}',fullPause:'Faire une pause, continuer plus tard',fullBreakHint:'À l’examen, il y a de courtes pauses entre les épreuves. Tu verras tes notes à la fin, sur la feuille de résultats.',certTitle:'Feuille de résultats',certHeading:'Résultat {level} · Examen {n}',certOverall:'Note globale',certPassedAll:'Tu as réussi toutes les épreuves !',certPassedSome:'{a}/{t} épreuves réussies',certPassed:'Tu as réussi l’examen !',certFailed:'Pas cette fois',certIncomplete:'Le résultat n’est pas encore complet',certPending:'Les tâches d’écrit et d’oral ne sont pas encore notées. Fais-les noter par l’IA pour voir le résultat global.',certModular:'Aux niveaux B1, B2 et C1, chaque épreuve est évaluée séparément : il faut au moins 60 points dans chaque épreuve pour la réussir.',certTotalRule:'Aux niveaux A1 et A2, c’est la note totale qui compte : il faut au moins 60 points pour réussir.',certScore:'🤖 Noter les tâches d’écriture et d’oral ({n})',certNote:'Ceci est un résultat d’entraînement, pas un diplôme officiel. Les notes d’écrit et d’oral sont des estimations de l’IA ; les tâches laissées vides valent 0 point.',certNotScored:'non noté',certPrint:'🖨️ Imprimer / PDF',certPrintHint:'Pour l’enregistrer en PDF, choisis « Enregistrer au format PDF » dans la fenêtre d’impression.',certShare:'Partager',certShareText:'J’ai obtenu {p}/100 à l’examen blanc complet {exam} · Examen {n} sur Lumira !',certRetry:'Repasser l’examen complet',certModule:'Épreuve',certPoints:'Points',certGrade:'Mention',certFooter:'Créé avec Lumira',freeNote:'Un examen blanc est gratuit sans badge. N’importe quel badge débloque tous les examens sans limite.',freeFirst:'Un examen est gratuit sans badge : le premier examen que tu commences devient ton examen gratuit.',lockedTitle:'Cet examen nécessite un badge',lockedText:'Tu as utilisé ton examen gratuit pour {exam}. N’importe quel badge débloque tous les examens, même le plus petit.',lockedCta:'Voir les badges',lockedChip:'🔒 Badge requis',openFree:'Aller à ton examen gratuit',chooseCertTitle:'À quel examen de langue te prépares-tu ?',chooseCertIntro:'Choisis une langue pour ouvrir des examens blancs au format d’une certification reconnue.',familyHero:'Examens blancs {name}',familyDisclaimer:'Ces examens blancs ne sont pas produits par {org} et ne remplacent pas l’examen officiel.',arabicDisclaimer:'Il n’existe pas de certification d’arabe unique reconnue partout ; ces examens suivent donc les niveaux du CECRL pour les quatre compétences et ne remplacent pas un examen officiel.',ruleTotal:'C’est la note totale qui compte : il faut au moins {n} points pour réussir.',ruleDelf:'Il faut au moins 50/100 au total et au moins 5/25 dans chaque épreuve.',ruleDele:'Deux groupes sont évalués séparément : il faut au moins 60 en lecture + écrit et en écoute + oral.',ruleTorfl:'Il faut au moins 66 % dans chaque sous-test.',grammatik:'Lexique et grammaire'},
 es:{hubEyebrow:'LUMIRA · PRUEBA DE NIVEL',hubTitle:'Mide tu nivel',hubIntro:'Pon a prueba tu vocabulario o haz un examen de práctica completo con el formato de un certificado del idioma que elijas.',wordTitle:'Prueba de nivel de vocabulario',wordDesc:'Pon a prueba las palabras del nivel elegido. Las que sepas se añaden a tu lista.',goetheTitle:'Exámenes de práctica de certificados',goetheDesc:'Elige primero un idioma: Goethe, Cambridge, DELF/DALF, DELE, TORFL y más, con el formato real.',back:'Volver',heroTitle:'Exámenes de práctica Goethe-Zertifikat',heroText:'Las pruebas, los tipos de tarea y los tiempos siguen el examen oficial. Todas las preguntas se escribieron para Lumira.',disclaimer:'Estos exámenes de práctica no son del Goethe-Institut y no sustituyen al examen oficial.',official:'Modelos de examen oficiales (goethe.de)',levelA1:'Expresiones cotidianas básicas: presentarse, preguntas sencillas, notas breves.',levelA2:'Textos breves, avisos y mensajes sencillos sobre temas conocidos.',levelB1:'Uso independiente en la vida diaria y el trabajo; dar opiniones.',levelB2:'Comprender textos largos y abstractos; debatir con fluidez y escribir formalmente.',testsCount:'{n} exámenes',passedCount:'{n} módulos aprobados',test:'Examen {n}',modules:'Módulos',minutes:'{n} min',questions:'{n} preguntas',tasks:'{n} tareas',notStarted:'Sin empezar',inProgress:'En curso',passed:'Aprobado',belowPass:'Por debajo del aprobado',done:'Hecho',start:'Empezar',resume:'Continuar donde lo dejaste',retake:'Repetir',review:'Revisar respuestas',timed:'Con el tiempo real del examen',timeLeft:'Tiempo restante',timeUp:'Se acabó el tiempo; tus respuestas se han corregido.',part:'Teil {i}/{n}',prev:'← Anterior',next:'Siguiente →',finish:'Terminar módulo',unanswered:'Hay {n} preguntas sin responder. ¿Terminar igualmente?',saveExit:'Guardar y salir',listen:'▶ Escuchar',stop:'■ Detener',playsLeft:'Escuchas restantes: {n}',noPlays:'No quedan escuchas.',noVoice:'No se pudo reproducir el audio. Revisa tu conexión a internet e inténtalo de nuevo.',score:'{c}/{t} correctas',points:'{p} / 100 puntos',pass:'¡Aprobado!',fail:'Necesitas al menos {n} puntos para aprobar.',yourAnswer:'Tu respuesta',rightAnswer:'Respuesta correcta',empty:'En blanco',transcript:'Transcripción',toTests:'Lista de exámenes',toModules:'Volver a los módulos',writeHere:'Escribe tu texto aquí…',words:'{n} palabras',target:'Objetivo: unas {n} palabras',contentPoints:'Puntos de contenido — marca lo que has tratado',sample:'Solución modelo',showSample:'Mostrar solución modelo',hideSample:'Ocultar solución modelo',check:'Revisar el idioma',checking:'Revisando…',issues:'{n} sugerencias lingüísticas:',noIssues:'No se encontraron errores.',formScore:'Formulario: {c}/{t} correctas',writingNote:'En el examen real, la expresión escrita la corrigen examinadores. Aquí marcas los puntos de contenido, haces que la IA puntúe tu texto según los criterios del examen y lo comparas con una solución modelo.',speakingNote:'La prueba oral se hace con un examinador. Aquí respondes cada tarea en voz alta, recibes una puntuación estimada y comentarios de la IA y escuchas respuestas modelo.',phrases:'Expresiones útiles',sampleAnswer:'Respuesta modelo',listenSample:'🔊 Escuchar la respuesta modelo',markDone:'Completar módulo',loading:'Cargando examen…',loadError:'No se pudo cargar el examen. Revisa tu conexión e inténtalo de nuevo.',retry:'Reintentar',xp:'¡Has ganado +{n} XP!',answered:'{a}/{t} respondidas',best:'Mejor: {p}',lesen:'Lectura',hoeren:'Comprensión auditiva',schreiben:'Escritura',sprechen:'Expresión oral',login:'Inicia sesión para guardar tus resultados.',aiScore:'🤖 Puntuar con IA',aiScoring:'Puntuando…',aiRescore:'🤖 Volver a puntuar',aiTitle:'Evaluación con IA',aiEstimate:'Puntuación estimada',aiStale:'Has cambiado el texto después de puntuarlo. Vuelve a puntuarlo para un resultado actualizado.',aiNote:'La puntuación es una estimación de la IA según los criterios del examen, no un resultado oficial. Cada evaluación usa 1 revisión de escritura.',aiLogin:'Inicia sesión para usar la puntuación con IA.',tooShort:'Se necesitan al menos {n} palabras para puntuar.',critTask:'Cumplimiento de la tarea',critCoherence:'Coherencia y fluidez',critVocabulary:'Vocabulario',critGrammar:'Gramática',strengths:'Tus puntos fuertes',improvements:'Qué mejorar',corrections:'Correcciones',improved:'Versión mejorada',moduleEstimate:'Puntuación estimada · {m}',scoreRest:'🤖 Puntuar las tareas restantes ({n})',scoredCount:'{a}/{t} tareas puntuadas',unscoredNote:'Puntúa todas las tareas con IA para ver una puntuación estimada del módulo.',record:'🎙️ Di tu respuesta',recordStop:'■ Detener grabación',recordHint:'Habla en {lang}; lo que digas se escribe abajo. Puedes corregir el texto si hace falta.',typeHint:'El reconocimiento de voz no está disponible en este dispositivo. Puedes escribir tu respuesta en {lang}.',answerLabel:'Tu respuesta',speechFailed:'No se reconoció la voz. Inténtalo de nuevo o escribe tu respuesta.',micDenied:'Se denegó el micrófono. Permítelo en los ajustes del navegador.',pronunciation:'No se evalúa la pronunciación; se puntúa la transcripción de lo que dijiste.',sumTitle:'🎓 Tus exámenes de práctica de certificados',sumEmpty:'Aún no has hecho ningún examen de práctica {name}. Te esperan exámenes con el formato real.',sumOpen:'Ir a los exámenes de práctica',sumExams:'{n}/{t} exámenes',sumAvg:'media {p}',sumWeak:'🎯 Lo más débil: {level} · {m} Teil {k} ({p} %)',sumWeakModule:'🎯 Lo más débil: {level} · {m} ({p} %)',sumNext:'Seguir con {level} · Examen {n}',sumAll:'Todos los exámenes',levelC1:'Comprender textos largos y complejos; expresarse con fluidez y estructura sobre temas académicos y profesionales.',fullTitle:'Examen completo',fullDesc:'Todas las pruebas seguidas, con el orden y los tiempos reales ({min} min en total). Verás tus puntuaciones al final, en una sola hoja de resultados.',fullStart:'🏁 Empezar el examen completo',fullResume:'▶ Continuar · {m} ({i}/{n})',fullRestart:'Empezar de nuevo',fullConfirmRestart:'¿Borrar el examen completo en curso y empezar de nuevo?',fullLast:'Último examen completo: {p} / 100',fullView:'Ver la hoja de resultados',fullIntro:'Examen completo · Prueba {i}/{n}. El tiempo corre como en el examen real; al terminar esta prueba pasas a la siguiente.',fullDone:'{m} completado',fullNextUp:'Siguiente prueba: {m} · {min} minutos',fullContinue:'Empezar {m}',fullPause:'Hacer una pausa y seguir después',fullBreakHint:'En el examen real hay pausas cortas entre las pruebas. Verás tus puntuaciones al final, en la hoja de resultados.',certTitle:'Hoja de resultados',certHeading:'Resultado {level} · Examen {n}',certOverall:'Puntuación global',certPassedAll:'¡Has aprobado todas las pruebas!',certPassedSome:'{a}/{t} pruebas aprobadas',certPassed:'¡Has aprobado el examen!',certFailed:'Esta vez no',certIncomplete:'El resultado aún no está completo',certPending:'Las tareas de expresión escrita y oral aún no están puntuadas. Puntúalas con IA para ver el resultado global.',certModular:'En B1, B2 y C1 cada prueba se evalúa por separado: necesitas al menos 60 puntos en cada una para aprobarla.',certTotalRule:'En A1 y A2 cuenta la puntuación total: necesitas al menos 60 puntos para aprobar.',certScore:'🤖 Puntuar las tareas de escritura y expresión oral ({n})',certNote:'Este es un resultado de práctica, no un certificado oficial. Las puntuaciones de expresión escrita y oral son estimaciones de la IA; las tareas vacías cuentan 0 puntos.',certNotScored:'sin puntuar',certPrint:'🖨️ Imprimir / PDF',certPrintHint:'Para guardarlo como PDF, elige «Guardar como PDF» en la ventana de impresión.',certShare:'Compartir',certShareText:'¡He sacado {p}/100 en el examen completo {exam} · Examen {n} en Lumira!',certRetry:'Repetir el examen completo',certModule:'Prueba',certPoints:'Puntos',certGrade:'Calificación',certFooter:'Creado con Lumira',freeNote:'Un examen de práctica es gratis sin insignia. Cualquier insignia desbloquea todos los exámenes sin límite.',freeFirst:'Un examen es gratis sin insignia: el primer examen que empieces será tu examen gratis.',lockedTitle:'Este examen necesita una insignia',lockedText:'Usaste tu examen gratis en {exam}. Cualquier insignia desbloquea todos los exámenes, incluso la más pequeña.',lockedCta:'Ver insignias',lockedChip:'🔒 Insignia necesaria',openFree:'Ir a tu examen gratis',chooseCertTitle:'¿Para qué examen de idioma te preparas?',chooseCertIntro:'Elige un idioma para abrir exámenes de práctica con el formato de un certificado reconocido.',familyHero:'Exámenes de práctica {name}',familyDisclaimer:'Estos exámenes de práctica no los elabora {org} y no sustituyen al examen oficial.',arabicDisclaimer:'No existe un único certificado de árabe reconocido en todo el mundo; estos exámenes siguen los niveles del MCER en las cuatro destrezas y no sustituyen a un examen oficial.',ruleTotal:'Cuenta la puntuación total: necesitas al menos {n} puntos para aprobar.',ruleDelf:'Necesitas al menos 50/100 en total y al menos 5/25 en cada prueba.',ruleDele:'Se evalúan dos grupos por separado: necesitas al menos 60 en lectura + expresión escrita y en audición + expresión oral.',ruleTorfl:'Necesitas al menos un 66 % en cada subprueba.',grammatik:'Léxico y gramática'},
 ru:{hubEyebrow:'LUMIRA · ОПРЕДЕЛЕНИЕ УРОВНЯ',hubTitle:'Определи свой уровень',hubIntro:'Быстро проверь словарный запас или пройди полный пробный экзамен в формате сертификационного экзамена по выбранному языку.',wordTitle:'Тест уровня по словам',wordDesc:'Проверь слова выбранного уровня. Известные слова попадут в твой список.',goetheTitle:'Пробные сертификационные экзамены',goetheDesc:'Сначала выбери язык: Goethe, Cambridge, DELF/DALF, DELE, ТРКИ и другие — в формате настоящего экзамена.',back:'Назад',heroTitle:'Пробные экзамены Goethe-Zertifikat',heroText:'Разделы, типы заданий и время соответствуют официальному экзамену. Все задания написаны для Lumira.',disclaimer:'Эти пробные экзамены не созданы Goethe-Institut и не заменяют официальный экзамен.',official:'Официальные образцы (goethe.de)',levelA1:'Базовые бытовые выражения: представиться, простые вопросы, короткие записки.',levelA2:'Короткие тексты, объявления и простые сообщения на знакомые темы.',levelB1:'Самостоятельное общение в быту и на работе; выражение мнения.',levelB2:'Понимание длинных абстрактных текстов; свободная дискуссия и официальные письма.',testsCount:'Экзаменов: {n}',passedCount:'Сдано модулей: {n}',test:'Экзамен {n}',modules:'Модули',minutes:'{n} мин',questions:'Заданий: {n}',tasks:'Заданий: {n}',notStarted:'Не начат',inProgress:'В процессе',passed:'Сдано',belowPass:'Ниже порога',done:'Готово',start:'Начать',resume:'Продолжить с места остановки',retake:'Пройти заново',review:'Посмотреть ответы',timed:'С реальным временем экзамена',timeLeft:'Осталось времени',timeUp:'Время вышло; ответы проверены.',part:'Teil {i}/{n}',prev:'← Назад',next:'Далее →',finish:'Завершить модуль',unanswered:'Без ответа: {n}. Всё равно завершить?',saveExit:'Сохранить и выйти',listen:'▶ Слушать',stop:'■ Стоп',playsLeft:'Осталось прослушиваний: {n}',noPlays:'Прослушивания закончились.',noVoice:'Не удалось воспроизвести аудио. Проверь подключение к интернету и попробуй снова.',score:'Верно: {c}/{t}',points:'{p} / 100 баллов',pass:'Сдано!',fail:'Для сдачи нужно не меньше {n} баллов.',yourAnswer:'Твой ответ',rightAnswer:'Правильный ответ',empty:'Пусто',transcript:'Текст аудио',toTests:'Список экзаменов',toModules:'К модулям',writeHere:'Напиши текст здесь…',words:'Слов: {n}',target:'Цель: около {n} слов',contentPoints:'Пункты содержания — отметь, что раскрыл',sample:'Образец',showSample:'Показать образец',hideSample:'Скрыть образец',check:'Проверить язык',checking:'Проверка…',issues:'Языковых подсказок: {n}',noIssues:'Ошибок не найдено.',formScore:'Анкета: {c}/{t} верно',writingNote:'На настоящем экзамене письмо оценивают экзаменаторы. Здесь ты отмечаешь пункты содержания, получаешь оценку ИИ по критериям экзамена и сравниваешь текст с образцом.',speakingNote:'Устная часть проходит с экзаменатором. Здесь ты отвечаешь на каждое задание вслух, получаешь примерный балл и советы ИИ и слушаешь образцы ответов.',phrases:'Полезные фразы',sampleAnswer:'Образец ответа',listenSample:'🔊 Прослушать образец',markDone:'Завершить модуль',loading:'Загрузка экзамена…',loadError:'Не удалось загрузить экзамен. Проверь подключение и попробуй снова.',retry:'Повторить',xp:'+{n} XP получено!',answered:'Отвечено: {a}/{t}',best:'Лучший: {p}',lesen:'Чтение',hoeren:'Аудирование',schreiben:'Письмо',sprechen:'Говорение',login:'Войди, чтобы сохранять результаты.',aiScore:'🤖 Оценить с ИИ',aiScoring:'Оценка…',aiRescore:'🤖 Оценить снова',aiTitle:'Оценка ИИ',aiEstimate:'Примерный балл',aiStale:'Ты изменил текст после оценки. Оцени снова, чтобы получить актуальный результат.',aiNote:'Балл — оценка ИИ по критериям экзамена, а не официальный результат. Каждая оценка расходует 1 проверку письма.',aiLogin:'Войди, чтобы пользоваться оценкой ИИ.',tooShort:'Для оценки нужно не меньше {n} слов.',critTask:'Выполнение задания',critCoherence:'Связность и беглость',critVocabulary:'Лексика',critGrammar:'Грамматика',strengths:'Твои сильные стороны',improvements:'Что улучшить',corrections:'Исправления',improved:'Улучшенный вариант',moduleEstimate:'Примерный балл · {m}',scoreRest:'🤖 Оценить оставшиеся задания ({n})',scoredCount:'Оценено заданий: {a}/{t}',unscoredNote:'Оцени все задания с ИИ, чтобы увидеть примерный балл модуля.',record:'🎙️ Произнеси ответ',recordStop:'■ Остановить запись',recordHint:'Говори на выбранном языке ({lang}); сказанное появится ниже. При необходимости текст можно исправить.',typeHint:'На этом устройстве нет распознавания речи. Ответ можно написать ({lang}).',answerLabel:'Твой ответ',speechFailed:'Речь не распознана. Попробуй снова или напиши ответ.',micDenied:'Нет доступа к микрофону. Разреши его в настройках браузера.',pronunciation:'Произношение не оценивается; оценивается расшифровка сказанного.',sumTitle:'🎓 Твои пробные сертификационные экзамены',sumEmpty:'Ты ещё не проходил пробный экзамен {name}. Тебя ждут экзамены в настоящем формате.',sumOpen:'К пробным экзаменам',sumExams:'Экзаменов: {n}/{t}',sumAvg:'ср. {p}',sumWeak:'🎯 Слабее всего: {level} · {m} Teil {k} ({p}%)',sumWeakModule:'🎯 Слабее всего: {level} · {m} ({p}%)',sumNext:'Продолжить: {level} · экзамен {n}',sumAll:'Все экзамены',levelC1:'Понимание длинных сложных текстов; свободная и структурированная речь на академические и профессиональные темы.',fullTitle:'Полный экзамен',fullDesc:'Все разделы подряд в настоящем порядке и времени (всего {min} мин). Баллы ты увидишь в конце, на одном листе результатов.',fullStart:'🏁 Начать полный экзамен',fullResume:'▶ Продолжить · {m} ({i}/{n})',fullRestart:'Начать заново',fullConfirmRestart:'Удалить текущий полный экзамен и начать заново?',fullLast:'Последний полный экзамен: {p} / 100',fullView:'Открыть лист результатов',fullIntro:'Полный экзамен · Модуль {i}/{n}. Время идёт как на настоящем экзамене; после этого модуля ты переходишь к следующему.',fullDone:'{m} завершён',fullNextUp:'Следующий модуль: {m} · {min} мин',fullContinue:'Начать {m}',fullPause:'Сделать перерыв и продолжить позже',fullBreakHint:'На настоящем экзамене между модулями бывают короткие перерывы. Баллы ты увидишь в конце, на листе результатов.',certTitle:'Лист результатов',certHeading:'Результат {level} · экзамен {n}',certOverall:'Общий балл',certPassedAll:'Ты сдал все разделы!',certPassedSome:'Сдано модулей: {a}/{t}',certPassed:'Экзамен сдан!',certFailed:'В этот раз не получилось',certIncomplete:'Результат ещё не готов',certPending:'Задания по письму и устной речи ещё не оценены. Оцени их с ИИ, чтобы увидеть общий результат.',certModular:'На уровнях B1, B2 и C1 каждый модуль оценивается отдельно: для сдачи нужно не меньше 60 баллов в каждом модуле.',certTotalRule:'На уровнях A1 и A2 учитывается общий балл: для сдачи нужно не меньше 60 баллов.',certScore:'🤖 Оценить задания по письму и устной речи ({n})',certNote:'Это пробный результат, а не официальный сертификат. Баллы за письмо и устную речь — оценка ИИ; пустые задания дают 0 баллов.',certNotScored:'не оценено',certPrint:'🖨️ Печать / PDF',certPrintHint:'Чтобы сохранить в PDF, выбери «Сохранить как PDF» в окне печати.',certShare:'Поделиться',certShareText:'Я набрал {p}/100 на полном пробном экзамене {exam} · экзамен {n} в Lumira!',certRetry:'Пройти полный экзамен снова',certModule:'Модуль',certPoints:'Баллы',certGrade:'Оценка',certFooter:'Создано в Lumira',freeNote:'Без значка один пробный экзамен бесплатный. Любой значок открывает все экзамены без ограничений.',freeFirst:'Без значка один экзамен бесплатный: первый начатый экзамен станет твоим бесплатным.',lockedTitle:'Для этого экзамена нужен значок',lockedText:'Бесплатный экзамен уже использован: {exam}. Любой значок открывает все экзамены, даже самый маленький.',lockedCta:'Посмотреть значки',lockedChip:'🔒 Нужен значок',openFree:'Перейти к бесплатному экзамену',chooseCertTitle:'К экзамену по какому языку ты готовишься?',chooseCertIntro:'Выбери язык, чтобы открыть пробные экзамены в формате признанного сертификата.',familyHero:'Пробные экзамены {name}',familyDisclaimer:'Эти пробные экзамены не являются материалами {org} и не заменяют официальный экзамен.',arabicDisclaimer:'Единого общепризнанного сертификата по арабскому языку нет, поэтому эти экзамены следуют уровням CEFR по всем четырём навыкам и не заменяют официальный экзамен.',ruleTotal:'Учитывается общий балл: для сдачи нужно не меньше {n} баллов.',ruleDelf:'Нужно не меньше 50/100 в сумме и не меньше 5/25 в каждом разделе.',ruleDele:'Две группы оцениваются отдельно: нужно не меньше 60 в чтении + письме и в аудировании + говорении.',ruleTorfl:'В каждом субтесте нужно не меньше 66 %.',grammatik:'Лексика и грамматика'}
};
const T=(key,values)=>{let s=(COPY[root.NATIVE_LANG]||COPY.en)[key];if(s===undefined)s=COPY.en[key]!==undefined?COPY.en[key]:key;for(const[k,v]of Object.entries(values||{}))s=s.split('{'+k+'}').join(String(v));return s;};
const LEVELS=[
 {id:'A1',title:'Goethe-Zertifikat A1 · Start Deutsch 1',minutes:{lesen:25,hoeren:20,schreiben:20,sprechen:15},order:['hoeren','lesen','schreiben','sprechen']},
 {id:'A2',title:'Goethe-Zertifikat A2',minutes:{lesen:30,hoeren:30,schreiben:30,sprechen:15},order:['lesen','hoeren','schreiben','sprechen']},
 {id:'B1',title:'Goethe-Zertifikat B1',minutes:{lesen:65,hoeren:40,schreiben:60,sprechen:15},order:['lesen','hoeren','schreiben','sprechen']},
 {id:'B2',title:'Goethe-Zertifikat B2',minutes:{lesen:65,hoeren:40,schreiben:75,sprechen:15},order:['lesen','hoeren','schreiben','sprechen']},
 {id:'C1',title:'Goethe-Zertifikat C1',minutes:{lesen:65,hoeren:40,schreiben:80,sprechen:15},order:['lesen','hoeren','schreiben','sprechen'],count:5}
];
// 'grammatik' yalnızca ТРКИ'de (Лексика. Грамматика) bulunan ayrı bir bölümdür.
const MODULES=['grammatik','lesen','hoeren','schreiben','sprechen'],OBJECTIVE=['grammatik','lesen','hoeren'];
const COUNT=10,XP=50,FULL_XP=100,LETTERS='abcdefghijklmnopqrstuvwxyz';
// Goethe-Prädikate stehen auf jedem Zeugnis auf Deutsch.
const goetheGrade=p=>p>=90?'sehr gut':p>=80?'gut':p>=70?'befriedigend':p>=60?'ausreichend':'nicht bestanden';
// A1/A2 werden als Gesamtprüfung bewertet, ab B1 zählt jedes Modul einzeln.
const modular=level=>!['A1','A2'].includes(String(level).slice(0,2));
const lv=(id,title,minutes,order,count=1)=>({id,title,minutes,order,count});
const STD=['lesen','hoeren','schreiben','sprechen'];
/* Sertifika aileleri: dil seçilince o dilde tanınan sınavın düzeni kullanılır.
   Almanca kimlikler önceki sürümlerle aynı kalır (B1-01); diğerleri dil önekli (en-B1-01). */
const FAMILIES=[
 {lang:'de',id:'goethe',name:'Goethe-Zertifikat',short:'Goethe',org:'Goethe-Institut',locale:'de-DE',dir:'goethe',prefix:'',levels:LEVELS,
  names:{lesen:'Lesen',hoeren:'Hören',schreiben:'Schreiben',sprechen:'Sprechen'},rule:'goethe',pass:60,
  notOfficial:'Dies ist kein offizielles Zertifikat des Goethe-Instituts.'},
 {lang:'en',id:'cambridge',name:'Cambridge English',short:'Cambridge',org:'Cambridge University Press & Assessment',locale:'en-GB',dir:'exams/en',prefix:'en-',levels:[
   lv('A2','A2 Key (KET)',{lesen:40,schreiben:20,hoeren:30,sprechen:10},['lesen','schreiben','hoeren','sprechen']),
   lv('B1','B1 Preliminary (PET)',{lesen:45,schreiben:45,hoeren:30,sprechen:12},['lesen','schreiben','hoeren','sprechen']),
   lv('B2','B2 First (FCE)',{lesen:75,schreiben:80,hoeren:40,sprechen:14},['lesen','schreiben','hoeren','sprechen']),
   lv('C1','C1 Advanced (CAE)',{lesen:90,schreiben:90,hoeren:40,sprechen:15},['lesen','schreiben','hoeren','sprechen'])],
  names:{lesen:'Reading',hoeren:'Listening',schreiben:'Writing',sprechen:'Speaking'},rule:'total',pass:60,
  notOfficial:'This is not an official Cambridge English certificate.'},
 {lang:'fr',id:'delf',name:'DELF / DALF',short:'DELF',org:'France Éducation international',locale:'fr-FR',dir:'exams/fr',prefix:'fr-',levels:[
   lv('A1','DELF A1',{hoeren:20,lesen:30,schreiben:30,sprechen:7},['hoeren','lesen','schreiben','sprechen']),
   lv('A2','DELF A2',{hoeren:25,lesen:30,schreiben:45,sprechen:8},['hoeren','lesen','schreiben','sprechen']),
   lv('B1','DELF B1',{hoeren:25,lesen:45,schreiben:45,sprechen:15},['hoeren','lesen','schreiben','sprechen']),
   lv('B2','DELF B2',{hoeren:30,lesen:60,schreiben:60,sprechen:20},['hoeren','lesen','schreiben','sprechen']),
   lv('C1','DALF C1',{hoeren:40,lesen:50,schreiben:150,sprechen:30},['hoeren','lesen','schreiben','sprechen'])],
  names:{hoeren:'Compréhension de l’oral',lesen:'Compréhension des écrits',schreiben:'Production écrite',sprechen:'Production orale'},abbr:{hoeren:'CO',lesen:'CE',schreiben:'PE',sprechen:'PO'},rule:'delf',pass:50,
  notOfficial:'Ceci n’est pas un diplôme officiel du DELF ou du DALF.'},
 {lang:'es',id:'dele',name:'DELE',short:'DELE',org:'Instituto Cervantes',locale:'es-ES',dir:'exams/es',prefix:'es-',levels:[
   lv('A1','DELE A1',{lesen:45,hoeren:25,schreiben:25,sprechen:15},STD),
   lv('A2','DELE A2',{lesen:60,hoeren:35,schreiben:50,sprechen:15},STD),
   lv('B1','DELE B1',{lesen:70,hoeren:40,schreiben:60,sprechen:15},STD),
   lv('B2','DELE B2',{lesen:70,hoeren:40,schreiben:80,sprechen:20},STD),
   lv('C1','DELE C1',{lesen:90,hoeren:50,schreiben:80,sprechen:20},STD)],
  names:{lesen:'Comprensión de lectura',hoeren:'Comprensión auditiva',schreiben:'Expresión e interacción escritas',sprechen:'Expresión e interacción orales'},abbr:{lesen:'Lectura',hoeren:'Auditiva',schreiben:'Escrita',sprechen:'Oral'},rule:'dele',pass:60,
  notOfficial:'Este no es un diploma oficial DELE del Instituto Cervantes.'},
 {lang:'ru',id:'torfl',name:'ТРКИ (TORFL)',short:'ТРКИ',org:'государственной системы ТРКИ',locale:'ru-RU',dir:'exams/ru',prefix:'ru-',levels:[
   lv('A1','ТЭУ · Элементарный уровень',{grammatik:50,lesen:50,hoeren:30,schreiben:50,sprechen:25},['grammatik','lesen','hoeren','schreiben','sprechen']),
   lv('A2','ТБУ · Базовый уровень',{grammatik:50,lesen:50,hoeren:35,schreiben:60,sprechen:25},['grammatik','lesen','hoeren','schreiben','sprechen']),
   lv('B1','ТРКИ-1 · Первый уровень',{grammatik:60,lesen:50,hoeren:35,schreiben:60,sprechen:25},['grammatik','lesen','hoeren','schreiben','sprechen']),
   lv('B2','ТРКИ-2 · Второй уровень',{grammatik:90,lesen:60,hoeren:35,schreiben:65,sprechen:45},['grammatik','lesen','hoeren','schreiben','sprechen']),
   lv('C1','ТРКИ-3 · Третий уровень',{grammatik:90,lesen:75,hoeren:35,schreiben:60,sprechen:45},['grammatik','lesen','hoeren','schreiben','sprechen'])],
  names:{grammatik:'Лексика. Грамматика',lesen:'Чтение',hoeren:'Аудирование',schreiben:'Письмо',sprechen:'Говорение'},abbr:{grammatik:'Лексика'},rule:'torfl',pass:66,
  notOfficial:'Это не официальный сертификат ТРКИ.'},
 {lang:'ar',id:'arabic',name:'Arabic CEFR',short:'CEFR',org:'',locale:'ar-SA',dir:'exams/ar',prefix:'ar-',levels:[
   lv('A1','العربية · A1',{lesen:25,hoeren:20,schreiben:20,sprechen:15},STD),
   lv('A2','العربية · A2',{lesen:30,hoeren:30,schreiben:30,sprechen:15},STD),
   lv('B1','العربية · B1',{lesen:60,hoeren:40,schreiben:60,sprechen:15},STD),
   lv('B2','العربية · B2',{lesen:65,hoeren:40,schreiben:75,sprechen:15},STD),
   lv('C1','العربية · C1',{lesen:65,hoeren:40,schreiben:80,sprechen:15},STD)],
  names:{lesen:'القراءة',hoeren:'الاستماع',schreiben:'الكتابة',sprechen:'المحادثة'},rule:'total',pass:60,
  notOfficial:'هذه ليست شهادة رسمية.'},
 {lang:'tr',id:'tys',name:'Türkçe Yeterlik Sınavı (TYS)',short:'TYS',org:'Yunus Emre Enstitüsü',locale:'tr-TR',dir:'exams/tr',prefix:'tr-',levels:[
   lv('A1','TYS · A1',{lesen:25,hoeren:20,schreiben:20,sprechen:15},STD),
   lv('A2','TYS · A2',{lesen:30,hoeren:30,schreiben:30,sprechen:15},STD),
   lv('B1','TYS · B1',{lesen:60,hoeren:40,schreiben:60,sprechen:15},STD),
   lv('B2','TYS · B2',{lesen:65,hoeren:40,schreiben:75,sprechen:15},STD),
   lv('C1','TYS · C1',{lesen:65,hoeren:40,schreiben:80,sprechen:15},STD)],
  names:{lesen:'Okuma',hoeren:'Dinleme',schreiben:'Yazma',sprechen:'Konuşma'},rule:'total',pass:60,
  notOfficial:'Bu, resmî bir Türkçe Yeterlik Sınavı belgesi değildir.'}
];
const GERMAN=FAMILIES[0];
const familyFor=lang=>FAMILIES.find(f=>f.lang===lang)||null;
const famOf=id=>{const m=/^([a-z]{2})-[ABC][12]-\d\d$/.exec(String(id));return m&&familyFor(m[1])||GERMAN;};
// Açık ekranın sertifika ailesi; adlar, ses ve geçme sınırı buna göre seçilir.
let fam=GERMAN;
const useFamily=f=>{if(f)fam=f;return fam;};
const NAMES=new Proxy({},{get:(t,m)=>fam.names[m]||String(m)});
const shortName=m=>fam.abbr?.[m]||fam.names[m]||m;
const passMark=()=>fam.pass;
const levelCode=id=>{const f=famOf(id);return String(id).slice(f.prefix.length,f.prefix.length+2);};
const countOf=id=>(levelOf(id)||{}).count||COUNT;
const grade=p=>{
 if(fam.rule==='goethe')return goetheGrade(p);
 if(fam.rule==='delf')return Math.round(p/4)+' / 25';
 if(fam.id==='cambridge')return p>=80?'Grade A':p>=75?'Grade B':p>=60?'Grade C':'Fail';
 const ok=p>=fam.pass;return{dele:ok?'Apto':'No apto',torfl:ok?'Сдан':'Не сдан',arabic:ok?'ناجح':'راسب',tys:ok?'Başarılı':'Başarısız'}[fam.id]||'';
};
// Rozetsiz hesaplarda tek deneme ücretsizdir: başlatılan ilk deneme (sonuçlarda '_free').
const FREE_KEY='_free';
// Doğru/yanlış ve evet/hayır seçenekleri sınavın dilinde gösterilir.
const TRUE_FALSE={de:['Richtig','Falsch'],en:['True','False'],fr:['Vrai','Faux'],es:['Verdadero','Falso'],ru:['Верно','Неверно'],ar:['صحيح','خطأ'],tr:['Doğru','Yanlış']};
// Üst çubuktaki bölüm sayacı da sınavın kendi terimiyle yazılır (Teil, Part, Partie…).
const PART={en:'Part',fr:'Partie',es:'Tarea',ru:'Часть',ar:'الجزء',tr:'Bölüm'};
const YES_NO={de:['Ja','Nein'],en:['Yes','No'],fr:['Oui','Non'],es:['Sí','No'],ru:['Да','Нет'],ar:['نعم','لا'],tr:['Evet','Hayır']};
const BUTTERFLY='<svg viewBox="0 0 64 48" aria-hidden="true"><path fill="#a5ecdb" d="M30 22C25 2 2-2 6 13c3 9 13 13 24 12C12 22 9 39 20 40c9 1 11-10 12-14Z"/><path fill="#b4b9ee" d="M34 22C39 2 62-2 58 13c-3 9-13 13-24 12 18-3 21 14 10 15-9 1-11-10-12-14Z"/></svg>';
const testId=(level,i,f=fam)=>f.prefix+level+'-'+String(i).padStart(2,'0');
const levelOf=id=>{const f=famOf(id),code=String(id).slice(f.prefix.length,f.prefix.length+2);return f.levels.find(L=>L.id===code);};
const numberOf=id=>Number(String(id).slice(-2));
// Seviye adı sınavın adını zaten içeriyorsa (Goethe, DELF/DALF, DELE…) olduğu gibi, değilse başına eklenerek gösterilir.
const titleOf=L=>fam.id==='goethe'||fam.id==='delf'||L.title.includes(fam.short)?L.title:fam.short+' · '+L.title;
const fileOf=id=>{const f=famOf(id);return f.dir+'/'+String(id).slice(f.prefix.length).toLowerCase()+'.json';};
const n=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const btn=(text,cls,fn)=>{const b=n('button',cls,text);b.type='button';b.onclick=fn;return b;};
// Sınav metinleri seçilen ailenin dilinde işaretlenir (Arapça sağdan sola).
const de=e=>{e.lang=fam.lang;e.dir=fam.lang==='ar'?'rtl':'ltr';return e;};
const langName=code=>{try{const names=root.t?.('lang_names');if(names&&names[code])return names[code];}catch(e){}try{return new Intl.DisplayNames([root.NATIVE_LANG||'tr'],{type:'language'}).of(code);}catch(e){return code;}};
const uid=()=>{try{return root.firebase.auth().currentUser?.uid||'';}catch(e){return '';}};
const database=()=>{try{return root.LB_getDb?.()||null;}catch(e){return null;}};
const toast=(text,kind)=>root.PWA?.toast?.(text,{kind:kind||'good'});
const store={get(k){try{const v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch(e){return null;}},set(k,v){try{if(root.LUMIRA_CLEARING_DATA)return;if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,JSON.stringify(v));}catch(e){}}};
const progressKey=(id,m)=>'lumira_goethe_run_v1_'+(uid()||'guest')+'_'+id+'_'+m;
const lastKey=(id,m)=>'lumira_goethe_last_v1_'+(uid()||'guest')+'_'+id+'_'+m;
const resultsKey=()=>'lumira_goethe_results_v1_'+(uid()||'guest');
// Tam sınav: dört bölüm arka arkaya. Devam eden sınav ve son tamamlanan sonuç ayrı tutulur.
const fullKey=id=>'lumira_goethe_full_v1_'+(uid()||'guest')+'_'+id;
const fullLastKey=id=>'lumira_goethe_fulllast_v1_'+(uid()||'guest')+'_'+id;

let state=null,timer=null,observer=null,speechRun=0,activeDone=null,listening=null;
let results={},resultsFor=null,resultsLoading=null;
const exams=new Map();

/* ---------------------------------------------------------------- yardımcılar */
function valid(view){return !!state&&state.host.isConnected&&!!state.host.querySelector('[data-goethe]')&&(!view||state.view===view);}
function visible(){return valid()&&state.host.offsetParent!==null&&!document.hidden;}
function stopSpeech(){speechRun++;const done=activeDone;activeDone=null;try{root.VOICE_stop?.();}catch(e){}if(done)done();}
function stopAll(){clearInterval(timer);timer=null;stopSpeech();stopListening();}
/* Sprechen: tarayıcının konuşma tanıması cevabı Almanca metne döker. Chrome
   sessizlikte oturumu kapatır; kayıt sürerken sınırlı sayıda yeniden başlatılır. */
const recognitionSupported=()=>typeof(root.SpeechRecognition||root.webkitSpeechRecognition)==='function';
function stopListening(){const l=listening;listening=null;if(!l)return;l.closed=true;try{l.rec.onresult=l.rec.onerror=l.rec.onend=null;l.rec.abort();}catch(e){}l.onState(false);}
function listen(onText,onState,onError){
 if(!recognitionSupported())return false;
 stopSpeech();stopListening();
 const Recognition=root.SpeechRecognition||root.webkitSpeechRecognition,rec=new Recognition(),l={rec,closed:false,restarts:0,onState};
 rec.lang=fam.locale;rec.continuous=true;rec.interimResults=true;rec.maxAlternatives=1;
 let heard='';
 rec.onresult=e=>{if(l.closed)return;let interim='';for(let k=e.resultIndex;k<e.results.length;k++){const said=String(e.results[k][0]?.transcript||'').trim();if(!said)continue;if(e.results[k].isFinal)heard=(heard?heard+' ':'')+said;else interim+=(interim?' ':'')+said;}l.restarts=0;onText(heard.slice(0,3000),interim.slice(0,1000));};
 rec.onerror=e=>{if(l.closed)return;const code=String(e.error||'');if(['not-allowed','service-not-allowed'].includes(code)){stopListening();onError('micDenied');}else if(!['no-speech','aborted'].includes(code)){stopListening();onError('speechFailed');}};
 rec.onend=()=>{if(l.closed)return;if(++l.restarts>12){stopListening();return;}try{rec.start();}catch(e){stopListening();}};
 listening=l;
 try{rec.start();}catch(e){listening=null;return false;}
 onState(true);return true;
}
function watch(host){
 observer?.disconnect();
 observer=new MutationObserver(()=>{if(state&&!state.host.querySelector('[data-goethe]')){stopAll();saveRun();observer.disconnect();}});
 observer.observe(host,{childList:true});
}
function page(title,description,backFn){
 stopAll();
 const p=n('section','workspace ge-page');p.dataset.goethe='';p.lang=root.NATIVE_LANG||'tr';p.dir=p.lang==='ar'?'rtl':'ltr';
 if(backFn)p.append(btn((p.dir==='rtl'?'→ ':'← ')+T('back'),'work-back',backFn));
 if(title){const h=n('header','work-hero');h.append(n('span','work-eyebrow',T('hubEyebrow')),Object.assign(n('span','work-mascot'),{innerHTML:BUTTERFLY}),n('h1','',title));if(description)h.append(n('p','',description));p.append(h);}
 state.host.replaceChildren(p);
 try{state.host.scrollIntoView?.({block:'start'});}catch(e){}
 return p;
}
function mode(icon,title,text,fn,key){
 const b=btn('','practice-mode',fn),body=n('span');b.dataset.placementMode=key;
 body.append(n('strong','',title),n('small','',text));
 b.append(Object.assign(n('span','practice-mode-icon'),{textContent:icon}),body,n('span','practice-mode-arrow',(root.NATIVE_LANG==='ar')?'‹':'›'));
 return b;
}
function paragraphs(text,cls){
 const box=de(n('div',cls||'ge-text-body'));
 String(text||'').split(/\n{2,}/).forEach(block=>{const p=n('p');block.split('\n').forEach((line,i)=>{if(i)p.append(n('br'));p.append(document.createTextNode(line));});box.append(p);});
 return box;
}
function fmtClock(ms){const s=Math.max(0,Math.ceil(ms/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}
function itemCount(exam,m){return(exam[m]||[]).reduce((sum,teil)=>sum+(teil.items?teil.items.length:0),0);}
function wordCount(text){return(String(text).match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)||[]).length;}

/* ------------------------------------------------------------------ veri */
function validExam(d){
 const objective=m=>Array.isArray(d[m])&&d[m].length>0&&d[m].every(t=>t&&Array.isArray(t.items)&&t.items.length>0&&t.items.every(item=>item&&item.a!==undefined));
 return !!d&&typeof d==='object'&&objective('lesen')&&objective('hoeren')&&Array.isArray(d.schreiben)&&Array.isArray(d.sprechen);
}
async function loadExam(id){
 if(exams.has(id))return exams.get(id);
 const controller=new AbortController(),stop=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch(fileOf(id)+'?v='+encodeURIComponent(VERSION),{signal:controller.signal});
  if(!response.ok)throw new Error('exam_unavailable');
  const data=await response.json();
  if(!validExam(data))throw new Error('exam_invalid');
  exams.set(id,data);return data;
 }finally{clearTimeout(stop);}
}
function loadResults(){
 const account=uid();
 if(resultsFor!==account){resultsFor=account;results=store.get(resultsKey())||{};resultsLoading=null;}
 if(resultsLoading)return resultsLoading;
 const db=database();
 if(!account||!db)return Promise.resolve(results);
 resultsLoading=db.ref('progress/'+account+'/goethe').once('value').then(snapshot=>{
  if(uid()!==account)return results;
  const remote=snapshot.val()||{};
  for(const[id,mods]of Object.entries(remote)){if(id===FREE_KEY){if(typeof mods==='string'&&levelOf(mods))results[FREE_KEY]=mods;continue;}if(!mods||typeof mods!=='object')continue;results[id]=Object.assign({},results[id]||{},mods);}
  store.set(resultsKey(),results);return results;
 }).catch(()=>results);
 return resultsLoading;
}
async function saveResult(id,m,entry,points=XP){
 const account=uid(),local=Object.assign({},(results[id]||{})[m]||{});
 const merged=Object.assign(local,entry,{at:Date.now(),count:(local.count||0)+1},entry.pct!==undefined?{best:Math.max(local.best||0,entry.pct),last:entry.pct}:{});
 results[id]=Object.assign({},results[id]||{},{[m]:merged});store.set(resultsKey(),results);
 const db=database();
 if(!account||!db)return 0;
 let award=false;
 try{
  await db.ref('progress/'+account+'/goethe/'+id+'/'+m).transaction(current=>{
   const cur=current&&typeof current==='object'?current:{};award=false;
   const next=Object.assign({},cur,entry,{at:Date.now(),count:(cur.count||0)+1});
   if(entry.pct!==undefined){next.best=Math.max(Number(cur.best)||0,entry.pct);next.last=entry.pct;}
   if(entry.pct!==undefined&&entry.pct>=passMark()&&!cur.xp){next.xp=true;award=true;}
   return next;
  },undefined,false);
 }catch(e){return 0;}
 if(award&&typeof root.PR_addXp==='function'){root.PR_addXp(points,'Goethe '+id+' · '+(NAMES[m]||'Gesamtprüfung'));results[id][m].xp=true;store.set(resultsKey(),results);return points;}
 return 0;
}

/* ------------------------------------------------------- ücretsiz deneme hakkı */
const tierNow=()=>{try{return root.LUMIRA_LIMITS?.tier?.()||0;}catch(e){return 0;}};
function freeExam(){
 const saved=results[FREE_KEY];if(typeof saved==='string'&&levelOf(saved))return saved;
 // Önceki sürümlerde çözülmüş ilk deneme ücretsiz deneme sayılır.
 let first=null,at=Infinity;
 for(const[id,mods]of Object.entries(results)){if(id===FREE_KEY||!levelOf(id)||!mods||typeof mods!=='object')continue;for(const m of MODULES){const t=Number(mods[m]?.at);if(Number.isFinite(t)&&t<at){at=t;first=id;}}}
 return first;
}
function unlocked(id){return tierNow()>0||!freeExam()||freeExam()===id;}
function claimFree(id){
 if(tierNow()>0||freeExam())return;
 results[FREE_KEY]=id;store.set(resultsKey(),results);
 const account=uid(),db=database();
 if(account&&db)db.ref('progress/'+account+'/goethe/'+FREE_KEY).transaction(current=>typeof current==='string'&&current?undefined:id,undefined,false).catch(()=>{});
}
const examName=id=>famOf(id).short+' '+levelCode(id)+' · '+T('test',{n:numberOf(id)});
function upgrade(){if(root.LUMIRA_LIMITS)root.LUMIRA_LIMITS.upgrade('goethe_badge_required');else root.LUMIRA_ACCESS?.open('goethe_badge_required');}
function lockCard(id){
 const card=n('article','ge-lock');card.dataset.goetheLock='';
 const free=freeExam();
 card.append(n('strong','','🔒 '+T('lockedTitle')),n('p','',T('lockedText',{exam:free?examName(free):''})));
 const actions=n('div','ge-actions');actions.append(btn(T('lockedCta'),'work-btn primary',upgrade));
 if(free&&free!==id)actions.append(btn(T('openFree'),'work-btn subtle',()=>overview(free)));
 card.append(actions);return card;
}
// Rozet bilgisi tazelenince açık ekran yeniden çizilir (ör. satın alma sonrası).
let shownTier=null;
function watchTier(){
 shownTier=tierNow();
 root.LUMIRA_LIMITS?.refresh?.().then(()=>{if(tierNow()!==shownTier&&valid()&&['levels','tests','overview'].includes(state.view)){shownTier=tierNow();refreshLocale();}});
}

/* ------------------------------------------------------------------ ekranlar */
function hub(host,options){
 state={host,options:options||{},view:'hub'};watch(host);
 const p=page(T('hubTitle'),T('hubIntro'),state.options.home||null);
 const modes=n('div','practice-modes');
 modes.append(mode('🔤',T('wordTitle'),T('wordDesc'),()=>{const word=state.options.word;stopAll();state=null;observer?.disconnect();word?.();},'word'),mode('🎓',T('goetheTitle'),T('goetheDesc'),languages,'goethe'));
 p.append(modes);
 loadResults();watchTier();
 // İlerleme kartından gelindiyse doğrudan istenen dile/seviyeye/denemeye git.
 const target=state.options.target;state.options.target=null;
 const chosen=target&&target.lang?familyFor(target.lang):null;
 if(target&&target.test&&levelOf(target.test)&&numberOf(target.test)>=1&&numberOf(target.test)<=countOf(target.test))overview(target.test);
 else if(target&&target.level){useFamily(chosen||GERMAN);if(fam.levels.some(L=>L.id===target.level))tests(target.level);else levels();}
 else if(chosen){useFamily(chosen);levels();}
 else if(target)languages();
}
/* Önce dil seçilir; her dilde o dilin tanınan sertifika sınavının düzeni açılır. */
function languages(){
 state.view='languages';
 const p=page(T('chooseCertTitle'),T('chooseCertIntro'),()=>hub(state.host,state.options));
 if(!tierNow())p.append(n('p','ge-free-note',T('freeNote')));
 const native=root.NATIVE_LANG||'tr',target=typeof root.TARGET_LANG==='string'?root.TARGET_LANG:'de';
 const list=FAMILIES.filter(f=>f.lang!==native).sort((a,b)=>(b.lang===target)-(a.lang===target));
 const grid=n('div','ge-levels ge-families');
 for(const f of list){
  const b=btn('','ge-level ge-family',()=>{useFamily(f);levels();}),body=n('span','ge-level-body');b.dataset.goetheFamily=f.lang;
  const range=f.levels[0].id+'–'+f.levels.at(-1).id,total=f.levels.reduce((s,L)=>s+(L.count||COUNT),0);
  body.append(n('strong','',langName(f.lang)),n('small','',f.name),n('span','ge-level-meta',range+' · '+T('testsCount',{n:total})));
  b.append(n('span','ge-level-id ge-family-flag',{de:'🇩🇪',en:'🇬🇧',fr:'🇫🇷',es:'🇪🇸',ru:'🇷🇺',ar:'🇸🇦',tr:'🇹🇷'}[f.lang]),body,n('span','practice-mode-arrow',(root.NATIVE_LANG==='ar')?'‹':'›'));
  grid.append(b);
 }
 p.append(grid);
}
function levels(){
 state.view='levels';state.lang=fam.lang;
 const p=page(T('familyHero',{name:fam.name}),T('heroText'),languages);
 p.append(n('p','ge-disclaimer',fam.org?T('familyDisclaimer',{org:fam.org}):T('arabicDisclaimer')));
 if(!tierNow())p.append(n('p','ge-free-note',T('freeNote')));
 const grid=n('div','ge-levels');p.append(grid);
 const paint=()=>{grid.replaceChildren(...fam.levels.map(L=>{
  const count=L.count||COUNT;let passedCount=0;for(let i=1;i<=count;i++){const r=results[testId(L.id,i)]||{};MODULES.forEach(m=>{if((r[m]?.best||0)>=passMark())passedCount++;});}
  const b=btn('','ge-level',()=>tests(L.id)),body=n('span','ge-level-body');b.dataset.goetheLevel=L.id;
  body.append(n('strong','',L.title),n('small','',T('level'+L.id)),n('span','ge-level-meta',T('testsCount',{n:count})+(passedCount?' · '+T('passedCount',{n:passedCount}):'')));
  b.append(n('span','ge-level-id',L.id),body,n('span','practice-mode-arrow',(root.NATIVE_LANG==='ar')?'‹':'›'));return b;
 }));};
 paint();loadResults().then(()=>{if(valid('levels'))paint();});
}
function moduleChip(m,r){
 const chip=n('span','ge-chip');
 if(r&&r.best!==undefined){chip.classList.add(r.best>=passMark()?'good':'warn');chip.textContent=shortName(m)+' '+r.best;}
 else if(!OBJECTIVE.includes(m)&&r&&r.done){chip.textContent=shortName(m)+' ✓';chip.classList.add('good');}
 else chip.textContent=shortName(m)+' —';
 return chip;
}
function tests(level){
 state.view='tests';state.level=level;state.lang=fam.lang;
 const L=fam.levels.find(x=>x.id===level)||fam.levels[0],p=page(L.title,T('level'+L.id),levels);
 const list=n('div','ge-tests');p.append(list);
 const paint=()=>{list.replaceChildren(...Array.from({length:L.count||COUNT},(_,k)=>{
  const id=testId(level,k+1),r=results[id]||{},b=btn('','ge-test',()=>overview(id)),chips=n('span','ge-chips');b.dataset.goetheTest=id;
  L.order.forEach(m=>chips.append(moduleChip(m,r[m])));
  if(r.full&&Number.isFinite(r.full.best))chips.append(n('span','ge-chip ge-chip-full '+(r.full.passed?'good':'warn'),'🏁 '+r.full.best));
  const started=MODULES.some(m=>store.get(progressKey(id,m)))||!!store.get(fullKey(id)),locked=!unlocked(id);
  if(locked)b.classList.add('is-locked');
  b.append(n('strong','',T('test',{n:k+1})),n('small','',locked?T('lockedChip'):started?T('inProgress'):MODULES.some(m=>r[m])?'':T('notStarted')),chips);return b;
 }));};
 paint();loadResults().then(()=>{if(valid('tests')&&state.level===level)paint();});
}
async function overview(id){
 useFamily(famOf(id));
 state.view='overview';state.testId=id;state.level=levelCode(id);
 const L=levelOf(id),p=page(T('test',{n:numberOf(id)})+' · '+L.id,titleOf(L),()=>tests(L.id));
 const box=n('p','work-empty',T('loading'));p.append(box);
 let exam;
 try{exam=await loadExam(id);}catch(e){if(!valid('overview')||state.testId!==id)return;box.textContent=T('loadError');p.append(btn(T('retry'),'work-btn',()=>overview(id)));return;}
 if(!valid('overview')||state.testId!==id)return;
 box.remove();
 if(!uid())p.append(n('p','work-help',T('login')));
 const open=unlocked(id);
 if(!open)p.append(lockCard(id));
 else{if(!tierNow()&&!freeExam())p.append(n('p','ge-free-note',T('freeFirst')));p.append(fullCard(id));}
 const grid=n('div','ge-modules');p.append(grid);
 for(const m of L.order){
  const r=(results[id]||{})[m],saved=store.get(progressKey(id,m)),card=n('article','ge-module');card.dataset.goetheModule=m;
  const head=n('div','ge-module-head');head.append(n('strong','',NAMES[m]),n('span','ge-module-sub',T(m)));
  const count=OBJECTIVE.includes(m)?T('questions',{n:itemCount(exam,m)}):T('tasks',{n:(exam[m]||[]).length});
  const meta=n('p','ge-module-meta',T('minutes',{n:L.minutes[m]})+' · '+count);
  card.append(head,meta);
  if(r&&r.best!==undefined){const status=n('p','ge-module-status '+(r.best>=passMark()?'good':'warn'),T('best',{p:r.best})+' · '+T(r.best>=passMark()?'passed':'belowPass'));card.append(status);}
  else if(r&&r.done)card.append(n('p','ge-module-status good',T('done')));
  const actions=n('div','ge-actions');
  // Kilitli denemede yalnızca daha önce çözülmüş bölümler incelenebilir.
  if(open&&saved){actions.append(btn(T('resume'),'work-btn primary',()=>run(id,m,{})));actions.append(btn(T('retake'),'work-btn subtle',()=>run(id,m,{fresh:true})));}
  else if(open)actions.append(btn(r?T('retake'):T('start'),'work-btn primary',()=>run(id,m,{fresh:true})));
  if(OBJECTIVE.includes(m)&&store.get(lastKey(id,m)))actions.append(btn(T('review'),'work-btn subtle',()=>run(id,m,{review:true})));
  else if(!OBJECTIVE.includes(m)&&store.get(lastKey(id,m)))actions.append(btn(T('review'),'work-btn subtle',()=>showProductive(id,m)));
  if(actions.children.length)card.append(actions);grid.append(card);
 }
}

/* --------------------------------------------------------- bölüm çalıştırıcı */
function run(id,m,options){
 useFamily(famOf(id));
 const exam=exams.get(id);if(!exam){overview(id);return;}
 if(!options.review){if(!unlocked(id)){upgrade();overview(id);return;}claimFree(id);}
 const L=levelOf(id),total=L.minutes[m]*60000,full=!!options.full&&!options.review,key=progressKey(id,m)+(full?'_full':'');
 let saved=options.fresh?null:store.get(key);
 if(options.review){const last=store.get(lastKey(id,m));if(!last){overview(id);return;}saved={answers:last.answers||{},teil:0,plays:{},timed:false,remaining:total,texts:{},form:{},checks:{},scores:{}};}
 if(!saved||typeof saved!=='object')saved={answers:{},teil:0,plays:{},timed:OBJECTIVE.includes(m)||m==='schreiben',remaining:total,texts:{},form:{},checks:{},scores:{}};
 ['answers','plays','texts','form','checks','scores'].forEach(k=>{if(!saved[k]||typeof saved[k]!=='object')saved[k]={};});
 saved.teil=Math.min(Math.max(0,Number(saved.teil)||0),Math.max(0,(exam[m]||[]).length-1));
 if(!Number.isFinite(saved.remaining))saved.remaining=total;
 // Tam sınavda süre her zaman gerçek sınavdaki gibi işler.
 if(full)saved.timed=m!=='sprechen';
 state.view='module';state.run={id,m,exam,saved,review:!!options.review,total,full,key};
 if(options.fresh)store.set(key,null);
 if(!options.review&&!options.fresh&&saved.started)paintTeil();
 else if(options.review||m==='sprechen')paintTeil();
 else intro();
}
function saveRun(){
 const r=state&&state.run;if(!r||r.review||r.finished)return;
 r.saved.started=true;store.set(r.key||progressKey(r.id,r.m),r.saved);
}
function intro(){
 const r=state.run,L=levelOf(r.id),exam=r.exam;
 const p=page(NAMES[r.m]+' · '+T('test',{n:numberOf(r.id)}),T(r.m)+' · '+T('minutes',{n:L.minutes[r.m]}),()=>overview(r.id));
 const panel=n('div','work-panel'),list=n('ol','ge-intro-list');
 if(r.full)panel.append(fullSteps(r.id,L.order.indexOf(r.m)),n('p','ge-full-note',T('fullIntro',{i:L.order.indexOf(r.m)+1,n:L.order.length})));
 exam[r.m].forEach(teil=>{const li=de(n('li'));li.append(n('strong','',teil.title+' '),document.createTextNode(teil.task||''));list.append(li);});
 panel.append(list);
 if(r.m==='schreiben')panel.append(n('p','work-help',T('writingNote')));
 if(!r.full){
  const toggle=n('label','ge-toggle'),box=n('input');box.type='checkbox';box.checked=r.saved.timed!==false;box.onchange=()=>{r.saved.timed=box.checked;};
  toggle.append(box,document.createTextNode(T('timed')+' · '+T('minutes',{n:L.minutes[r.m]})));
  panel.append(toggle);
 }
 panel.append(btn(T('start'),'work-btn primary ge-wide',()=>{r.saved.started=true;r.saved.remaining=r.total;saveRun();paintTeil();}));
 p.append(panel);
}
function topBar(p,r,teilIndex,count){
 const bar=n('div','ge-bar');
 const exit=btn(r.review?T('toModules'):T('saveExit'),'ge-exit',()=>{saveRun();overview(r.id);});
 const title=n('span','ge-bar-title',(r.full?'🏁 ':'')+NAMES[r.m]+' · '+(PART[fam.lang]?PART[fam.lang]+' '+(teilIndex+1)+'/'+count:T('part',{i:teilIndex+1,n:count})));
 const clock=n('span','ge-clock');clock.setAttribute('role','timer');clock.setAttribute('aria-label',T('timeLeft'));
 bar.append(exit,title,clock);p.append(bar);
 if(r.review||!r.saved.timed||r.m==='sprechen'){clock.hidden=true;return;}
 const paint=()=>{clock.textContent='⏱ '+fmtClock(r.saved.remaining);clock.classList.toggle('low',r.saved.remaining<5*60000);};
 paint();let last=Date.now(),tick=0;
 timer=setInterval(()=>{
  if(!valid('module')||state.run!==r){clearInterval(timer);return;}
  const now=Date.now();
  if(visible())r.saved.remaining-=now-last;else stopSpeech();
  last=now;paint();
  if(r.saved.remaining<=0){clearInterval(timer);r.saved.remaining=0;toast(T('timeUp'),'bad');if(OBJECTIVE.includes(r.m))finish(true);else finishProductive(true);return;}
  if(++tick%10===0)saveRun();
 },1000);
}
function answeredCount(r){let a=0,t=0;r.exam[r.m].forEach((teil,i)=>teil.items.forEach((item,j)=>{t++;if(r.saved.answers[i+'-'+j]!==undefined)a++;}));return{a,t};}
function paintTeil(){
 const r=state.run,parts=r.exam[r.m],i=r.saved.teil,teil=parts[i];
 if(r.m==='schreiben'){paintWriting();return;}
 if(r.m==='sprechen'){paintSpeaking();return;}
 const p=page(null,null,null);p.classList.add('ge-run');
 topBar(p,r,i,parts.length);
 const progress=n('div','ge-progress'),fill=n('span');progress.append(fill);p.append(progress);
 const counter=n('p','ge-counter');p.append(counter);
 const paintProgress=()=>{const c=answeredCount(r);fill.style.width=Math.round(c.a/c.t*100)+'%';counter.textContent=T('answered',{a:c.a,t:c.t});};paintProgress();
 const card=n('article','ge-teil');p.append(card);
 card.append(de(n('h2','',teil.title)));
 if(teil.task)card.append(de(n('p','ge-task',teil.task)));
 (teil.texts||[]).forEach(text=>{const box=n('section','ge-text');if(text.title)box.append(de(n('h3','',text.title)));box.append(paragraphs(text.body));card.append(box);});
 if(teil.audio)card.append(player(teil.audio,'t'+i,teil.plays||1,r));
 if(Array.isArray(teil.choices)){const list=n('div','ge-choices');teil.choices.forEach(c=>{const row=de(n('div','ge-choice'));row.append(n('b','',c.key),paragraphs(c.text,'ge-choice-text'));list.append(row);});card.append(list);}
 let offset=0;for(let k=0;k<i;k++)offset+=parts[k].items.length;
 teil.items.forEach((item,j)=>card.append(itemCard(r,teil,item,i,j,offset+j+1,paintProgress)));
 const nav=n('div','ge-nav');
 if(i>0)nav.append(btn(T('prev'),'work-btn subtle',()=>{r.saved.teil=i-1;saveRun();paintTeil();}));
 if(i<parts.length-1)nav.append(btn(T('next'),'work-btn primary',()=>{r.saved.teil=i+1;saveRun();paintTeil();}));
 else if(!r.review)nav.append(btn(T('finish'),'work-btn primary',()=>{const c=answeredCount(r);if(c.a<c.t&&!root.confirm(T('unanswered',{n:c.t-c.a})))return;finish(false);}));
 else nav.append(btn(T('toModules'),'work-btn primary',()=>overview(r.id)));
 p.append(nav);
}
function optionsFor(teil,item){
 const type=item.type||teil.type;
 if(type==='rf')return[[TRUE_FALSE[fam.lang][0],true],[TRUE_FALSE[fam.lang][1],false]];
 if(type==='yn')return[[YES_NO[fam.lang][0],true],[YES_NO[fam.lang][1],false]];
 if(type==='match'){const keys=(teil.choices||[]).map(c=>c.key);if(teil.none)keys.push('0');return keys.map(k=>[k,k]);}
 return(item.options||[]).map((o,k)=>[o,k]);
}
function itemCard(r,teil,item,i,j,number,onAnswer){
 const key=i+'-'+j,type=item.type||teil.type,card=n('div','ge-item');card.dataset.item=key;
 const head=n('div','ge-item-head');head.append(n('span','ge-num',String(number)));
 if(item.q)head.append(de(n('p','ge-q',item.q)));card.append(head);
 if(item.text){const box=n('div','ge-item-text');box.append(paragraphs(item.text));card.append(box);}
 if(item.audio)card.append(player(item.audio,'i'+key,teil.plays||1,r));
 const group=n('div','ge-opts'+(type==='match'?' ge-letters':type==='abc'||type==='ab'?' ge-list':' ge-pair'));group.setAttribute('role','radiogroup');
 const options=optionsFor(teil,item),chosen=r.saved.answers[key];
 options.forEach(([label,value],k)=>{
  const b=de(n('button','ge-opt'));b.type='button';
  if(type==='abc'||type==='ab'){b.append(n('b','',LETTERS[k]),n('span','',label));}else b.textContent=label;
  b.setAttribute('role','radio');b.setAttribute('aria-checked',String(chosen===value));
  if(chosen===value)b.classList.add('is-selected');
  if(r.review){b.disabled=true;if(value===item.a)b.classList.add('is-correct');else if(chosen===value)b.classList.add('is-wrong');}
  else b.onclick=()=>{r.saved.answers[key]=value;saveRun();group.querySelectorAll('.ge-opt').forEach((x,m)=>{const on=options[m][1]===value;x.classList.toggle('is-selected',on);x.setAttribute('aria-checked',String(on));});onAnswer();};
  group.append(b);
 });
 card.append(group);
 if(r.review){
  const ok=chosen===item.a,line=n('p','ge-verdict '+(ok?'good':'bad'));
  const label=v=>{const o=options.find(x=>x[1]===v);return o?(type==='abc'||type==='ab'?LETTERS[options.indexOf(o)]+') '+o[0]:o[0]):T('empty');};
  line.textContent=(ok?'✓ ':'✗ ')+T('yourAnswer')+': '+(chosen===undefined?T('empty'):label(chosen))+(ok?'':' · '+T('rightAnswer')+': '+label(item.a));
  card.append(line);
  if(item.why)card.append(de(n('p','ge-why',item.why)));
 }
 return card;
}
/* Hörtexte werden per Sprachausgabe gelesen; Sprecherwechsel ändern die Tonhöhe. */
function parseScript(script){
 return String(script||'').split('\n').map(line=>line.trim()).filter(Boolean).map(line=>{const m=/^([\p{Lu}\p{Lo}][\p{L}\p{M}\p{N} .'-]{0,28}):\s+(.+)$/u.exec(line);return m?{speaker:m[1].trim(),text:m[2]}:{speaker:'',text:line};});
}
function speakScript(script,done,fail){
 stopSpeech();
 const lines=parseScript(script),speakers=[],mine=++speechRun;let index=0;
 activeDone=done;
 if(!root.VOICE_read||!lines.length){activeDone=null;fail();return;}
 const next=()=>{
  if(mine!==speechRun)return;
  if(index>=lines.length){activeDone=null;done();return;}
  const line=lines[index++];let who=line.speaker?speakers.indexOf(line.speaker):-1;if(line.speaker&&who<0)who=speakers.push(line.speaker)-1;
  const pitch=[1,0.82,1.16,0.92][Math.max(0,who)%4];
  root.VOICE_read(line.text,{language:fam.lang,rate:0.94,pitch,
   onEnd:()=>{if(mine===speechRun)setTimeout(next,line.speaker?420:650);},
   onError:()=>{if(mine===speechRun){speechRun++;activeDone=null;fail();}},
   onCancel:()=>{if(mine===speechRun){speechRun++;activeDone=null;done();}}});
 };
 next();
}
function player(script,key,plays,r){
 const wrap=n('div','ge-audio'),play=btn('','work-btn primary ge-play',null),info=n('span','ge-plays');
 let playing=false;
 const used=()=>Number(r.saved.plays[key])||0,left=()=>r.review?Infinity:Math.max(0,plays-used());
 const paint=()=>{if(!wrap.isConnected&&playing)return;play.textContent=playing?T('stop'):T('listen');play.disabled=!playing&&left()<=0;info.textContent=r.review?'':left()>0?T('playsLeft',{n:left()}):T('noPlays');};
 play.onclick=()=>{
  if(playing){stopSpeech();return;}
  if(left()<=0)return;
  if(!r.review){r.saved.plays[key]=used()+1;saveRun();}
  playing=true;paint();
  speakScript(script,()=>{playing=false;paint();},()=>{playing=false;if(!r.review){r.saved.plays[key]=Math.max(0,used()-1);saveRun();}paint();toast(T('noVoice'),'bad');});
 };
 paint();wrap.append(play,info);
 if(r.review){const details=n('details','ge-transcript'),summary=n('summary','',T('transcript'));details.append(summary,paragraphs(script));wrap.append(details);}
 return wrap;
}
async function finish(timeUp){
 const r=state.run;if(r.finished)return;r.finished=true;stopAll();
 const parts=r.exam[r.m],perTeil=parts.map((teil,i)=>{let c=0;teil.items.forEach((item,j)=>{if(r.saved.answers[i+'-'+j]===item.a)c++;});return{title:teil.title,c,t:teil.items.length};});
 const correct=perTeil.reduce((s,x)=>s+x.c,0),total=perTeil.reduce((s,x)=>s+x.t,0),pct=Math.round(correct/total*100);
 store.set(lastKey(r.id,r.m),{answers:r.saved.answers,at:Date.now()});store.set(r.key||progressKey(r.id,r.m),null);
 const entry={pct,correct,total,parts:perTeil.map(x=>Math.round(x.c/x.t*100))};
 // Tam sınavda puan gerçek sınavdaki gibi en sonda, sonuç belgesinde görünür.
 if(r.full){fullRecord(r.id,r.m,{pct,correct,total});saveResult(r.id,r.m,entry);fullBreak(r.id,r.m,timeUp);return;}
 const result={correct,total,perTeil,pct,timeUp};state.lastResult={id:r.id,m:r.m,result};
 paintResult(r.id,r.m,result,0);
 const xp=await saveResult(r.id,r.m,entry);
 if(xp&&valid('result')&&state.lastResult?.id===r.id){state.lastResult.xp=xp;paintResult(r.id,r.m,result,xp);}
}
function paintResult(id,m,result,xp){
 useFamily(famOf(id));
 state.view='result';
 const p=page(NAMES[m]+' · '+T('test',{n:numberOf(id)}),titleOf(levelOf(id)),()=>overview(id));
 const passed=result.pct>=passMark(),panel=n('div','work-panel ge-result');
 const ring=n('div','ge-ring '+(passed?'good':'warn'));ring.style.setProperty('--p',String(result.pct));ring.append(n('strong','',String(result.pct)),n('small','','/ 100'));
 const summary=n('div','ge-result-text');summary.append(n('h2','',passed?T('pass'):T('belowPass')),n('p','',T('score',{c:result.correct,t:result.total})+' · '+T('points',{p:result.pct})));
 if(!passed)summary.append(n('p','work-help',T('fail',{n:passMark()})));
 if(result.timeUp)summary.append(n('p','work-help',T('timeUp')));
 if(xp)summary.append(n('p','ge-xp',T('xp',{n:xp})));
 panel.append(ring,summary);p.append(panel);
 const breakdown=n('div','ge-breakdown');
 result.perTeil.forEach(x=>{const row=n('div','ge-break-row'),bar=n('span','ge-break-bar'),fill=n('span');fill.style.width=Math.round(x.c/x.t*100)+'%';bar.append(fill);row.append(de(n('span','ge-break-name',x.title)),bar,n('span','ge-break-score',x.c+'/'+x.t));breakdown.append(row);});
 p.append(breakdown);
 const actions=n('div','ge-actions');
 actions.append(btn(T('review'),'work-btn primary',()=>run(id,m,{review:true})),btn(T('retake'),'work-btn subtle',()=>run(id,m,{fresh:true})),btn(T('toModules'),'work-btn subtle',()=>overview(id)));
 p.append(actions);
}

/* ------------------------------------------------------------ Tam sınav */
function fullTotal(L){return L.order.reduce((s,m)=>s+L.minutes[m],0);}
function fmtDate(at){try{return new Date(at).toLocaleDateString(root.NATIVE_LANG||'tr',{year:'numeric',month:'long',day:'numeric'});}catch(e){return new Date(at).toISOString().slice(0,10);}}
function fullSteps(id,current){
 const L=levelOf(id),f=store.get(fullKey(id))||{},list=n('ol','ge-steps');
 L.order.forEach((m,i)=>{const done=!!(f.mods||{})[m],li=n('li','ge-step'+(done?' is-done':'')+(i===current?' is-current':''));li.append(n('span','ge-step-dot',done?'✓':String(i+1)),n('span','ge-step-name',NAMES[m]));if(i===current)li.setAttribute('aria-current','step');list.append(li);});
 return list;
}
function fullCard(id){
 const L=levelOf(id),f=store.get(fullKey(id)),last=store.get(fullLastKey(id)),step=f?Math.min(Number(f.step)||0,L.order.length):0;
 const card=n('article','ge-full');card.dataset.goetheFull='';
 const head=n('div','ge-full-head'),title=n('div','ge-full-title');
 title.append(n('strong','',T('fullTitle')),n('span','',T('fullDesc',{min:fullTotal(L)})));
 head.append(n('span','ge-full-icon','🏁'),title);card.append(head);
 if(f)card.append(fullSteps(id,step));
 if(last&&Number.isFinite(last.pct))card.append(n('p','ge-module-status '+(last.passed?'good':'warn'),T('fullLast',{p:last.pct})+' · '+overallLabel(last.pct,last.passed)));
 const actions=n('div','ge-actions');
 if(f){
  actions.append(btn(step>=L.order.length?T('fullView'):T('fullResume',{m:NAMES[L.order[step]],i:step+1,n:L.order.length}),'work-btn primary',()=>fullStep(id)));
  actions.append(btn(T('fullRestart'),'work-btn subtle',()=>{if(root.confirm(T('fullConfirmRestart')))startFull(id);}));
 }else{
  actions.append(btn(T('fullStart'),'work-btn primary',()=>startFull(id)));
  if(last)actions.append(btn(T('fullView'),'work-btn subtle',()=>certificate(id,true)));
 }
 card.append(actions);
 return card;
}
function startFull(id){
 if(!unlocked(id)){upgrade();overview(id);return;}
 levelOf(id).order.forEach(m=>store.set(progressKey(id,m)+'_full',null));
 store.set(fullKey(id),{step:0,mods:{},started:Date.now()});
 fullStep(id);
}
function fullRecord(id,m,entry){
 const f=store.get(fullKey(id));if(!f)return;
 f.mods=f.mods&&typeof f.mods==='object'?f.mods:{};f.mods[m]=entry;
 f.step=Math.max(Number(f.step)||0,levelOf(id).order.indexOf(m)+1);
 store.set(fullKey(id),f);
}
async function fullStep(id){
 useFamily(famOf(id));
 const f=store.get(fullKey(id)),L=levelOf(id);
 if(!f){overview(id);return;}
 try{await loadExam(id);}catch(e){overview(id);return;}
 if(!valid())return;
 const step=Math.min(Number(f.step)||0,L.order.length);
 if(step>=L.order.length){certificate(id);return;}
 run(id,L.order[step],{full:true});
}
function fullBreak(id,m,timeUp){
 useFamily(famOf(id));
 const L=levelOf(id),i=L.order.indexOf(m),next=L.order[i+1];
 if(!next){certificate(id);return;}
 state.view='fullBreak';state.fullBreak={id,m,timeUp};state.testId=id;
 const p=page(T('fullTitle')+' · '+T('test',{n:numberOf(id)})+' · '+L.id,titleOf(L),()=>overview(id));
 const panel=n('div','work-panel ge-full-break');panel.dataset.goetheFullBreak='';
 panel.append(fullSteps(id,i+1),n('h2','',T('fullDone',{m:NAMES[m]})));
 if(timeUp)panel.append(n('p','work-help',T('timeUp')));
 panel.append(n('p','ge-full-next',T('fullNextUp',{m:NAMES[next],min:L.minutes[next]})),n('p','work-help',T('fullBreakHint')));
 const actions=n('div','ge-actions');
 actions.append(btn(T('fullContinue',{m:NAMES[next]}),'work-btn primary',()=>fullStep(id)),btn(T('fullPause'),'work-btn subtle',()=>overview(id)));
 panel.append(actions);p.append(panel);
}
function certificateData(id,exam,f){
 const L=levelOf(id),mods={},pending=[];
 L.order.forEach(m=>{
  const x=(f.mods||{})[m];
  if(!x){mods[m]={pct:null,missing:true};return;}
  if(OBJECTIVE.includes(m)){mods[m]={pct:Number.isFinite(x.pct)?x.pct:null};return;}
  const out=productiveOutcome(exam,m,x.data||{},true);
  mods[m]={pct:out.pct};out.pending.forEach(row=>pending.push({m,row}));
 });
 const values=L.order.map(m=>mods[m].pct),complete=values.every(v=>v!==null);
 const pct=complete?Math.round(values.reduce((s,v)=>s+v,0)/values.length):null;
 const passedCount=L.order.filter(m=>mods[m].pct!==null&&mods[m].pct>=passMark()).length;
 return{mods,pct,complete,passedCount,passed:complete&&examPassed(id,mods,pct,passedCount),pending};
}
async function certificate(id,fromLast){
 useFamily(famOf(id));
 let exam;try{exam=await loadExam(id);}catch(e){overview(id);return;}
 if(!valid())return;
 const active=fromLast?null:store.get(fullKey(id)),f=active||store.get(fullLastKey(id));
 if(!f){overview(id);return;}
 paintCertificate(id,exam,f,!!active);
}
// Tamamlanan tam sınav bir kez kaydedilir; devam eden kayıt "son sonuç"a taşınır.
function finalizeFull(id,f,d){
 const L=levelOf(id),snapshot=Object.assign({},f,{done:true,finished:Date.now(),pct:d.pct,passed:d.passed});
 store.set(fullLastKey(id),snapshot);store.set(fullKey(id),null);
 L.order.forEach(m=>store.set(progressKey(id,m)+'_full',null));
 Object.assign(f,snapshot);
 const mods={};L.order.forEach(m=>{mods[m]=d.mods[m].pct;});
 saveResult(id,'full',{pct:d.pct,passed:d.passed,mods},FULL_XP).then(xp=>{
  if(!xp||!valid('certificate')||state.testId!==id)return;
  const box=state.host.querySelector('.ge-cert .ge-result-text');if(box&&!box.querySelector('.ge-xp'))box.append(n('p','ge-xp',T('xp',{n:xp})));
 });
}
/* Geçme kuralları sınava göre: Goethe B1+ ve ТРКИ her bölümü ayrı ister,
   DELF toplam 50 ve her bölümde 5/25, DELE iki grubun her birinde 60 ister. */
function examPassed(id,mods,pct,passedCount){
 const f=famOf(id),L=levelOf(id),v=m=>Number(mods[m]?.pct)||0;
 if(f.rule==='goethe')return modular(levelCode(id))?passedCount===L.order.length:pct>=60;
 if(f.rule==='torfl')return passedCount===L.order.length;
 if(f.rule==='delf')return pct>=50&&L.order.every(m=>v(m)>=20);
 if(f.rule==='dele')return(v('lesen')+v('schreiben'))/2>=60&&(v('hoeren')+v('sprechen'))/2>=60;
 return pct>=f.pass;
}
const moduleStyle=id=>{const f=famOf(id);return f.rule==='torfl'||f.rule==='goethe'&&modular(levelCode(id));};
function ruleText(id){
 const f=famOf(id);
 if(f.rule==='goethe')return modular(levelCode(id))?T('certModular'):T('certTotalRule');
 if(f.rule==='delf')return T('ruleDelf');if(f.rule==='dele')return T('ruleDele');if(f.rule==='torfl')return T('ruleTorfl');
 return T('ruleTotal',{n:f.pass});
}
function overallLabel(pct,passed){
 if(fam.rule==='goethe'||fam.id==='cambridge')return grade(pct);
 return{delf:passed?'Admis':'Non admis',dele:passed?'Apto':'No apto',torfl:passed?'Сдан':'Не сдан',arabic:passed?'ناجح':'راسب',tys:passed?'Başarılı':'Başarısız'}[fam.id]||'';
}
function verdictText(id,d){
 const L=levelOf(id);
 if(moduleStyle(id))return d.passed?T('certPassedAll'):T('certPassedSome',{a:d.passedCount,t:L.order.length});
 return d.passed?T('certPassed'):T('certFailed');
}
function paintCertificate(id,exam,f,active){
 useFamily(famOf(id));
 state.view='certificate';state.testId=id;state.level=levelCode(id);
 const L=levelOf(id),d=certificateData(id,exam,f);
 if(active&&d.complete){finalizeFull(id,f,d);active=false;}
 state.certLast=!active;
 const p=page(T('certTitle'),titleOf(L)+' · '+T('test',{n:numberOf(id)}),()=>overview(id));
 const cert=n('section','ge-cert');cert.dataset.goetheCert='';
 const top=n('div','ge-cert-top');
 top.append(de(n('span','ge-cert-eyebrow','LUMIRA · '+titleOf(L))),n('h2','',T('certHeading',{level:L.id,n:numberOf(id)})),n('span','ge-cert-date',fmtDate(f.finished||f.started||Date.now())));
 cert.append(top);
 const main=n('div','ge-result'),verdict=n('div','ge-result-text');
 if(d.complete){
  const ring=n('div','ge-ring '+(d.passed?'good':'warn'));ring.style.setProperty('--p',String(d.pct));ring.append(n('strong','',String(d.pct)),n('small','','/ 100'));main.append(ring);
  verdict.append(n('h2','',verdictText(id,d)));
  const overall=n('p','ge-cert-overall');overall.append(document.createTextNode(T('certOverall')+': '+d.pct+' / 100 · '),de(n('span','',overallLabel(d.pct,d.passed))));verdict.append(overall);
 }else verdict.append(n('h2','',T('certIncomplete')),n('p','work-help',T('certPending')));
 verdict.append(n('p','work-help',ruleText(id)));
 main.append(verdict);cert.append(main);
 const grid=n('div','ge-cert-grid');
 L.order.forEach(m=>{
  const x=d.mods[m],ok=x.pct!==null&&x.pct>=passMark();
  const tile=btn('','ge-cert-tile'+(x.pct===null?'':ok?' good':' warn'),()=>OBJECTIVE.includes(m)?run(id,m,{review:true}):showProductive(id,m));
  tile.dataset.goetheCertModule=m;tile.disabled=!!x.missing||!store.get(lastKey(id,m));tile.title=T('review');
  tile.append(n('strong','',NAMES[m]),n('span','ge-cert-score',x.pct===null?'—':String(x.pct)),x.pct===null?n('span','ge-cert-grade',T('certNotScored')):de(n('span','ge-cert-grade',grade(x.pct))));
  grid.append(tile);
 });
 cert.append(grid,n('p','ge-ai-note',T('certNote')));
 p.append(cert);
 const msg=n('p','ge-ai-msg');msg.setAttribute('role','status');
 if(state.certMsg){msg.textContent=state.certMsg;state.certMsg='';}
 if(d.pending.length){
  const score=btn(T('certScore',{n:d.pending.length}),'work-btn primary ge-wide',async()=>{
   if(!uid()){msg.textContent=T('aiLogin');return;}
   score.disabled=true;score.textContent=T('aiScoring');msg.textContent='';
   const where=active?fullKey(id):fullLastKey(id);
   try{for(const{m,row}of d.pending){const x=f.mods[m];x.data=Object.assign({},x.data);x.data.scores=Object.assign({},x.data.scores);x.data.scores[row.i]=await scoreAnswer(id,m,exam[m][row.i],row.text);store.set(where,f);}}
   catch(e){state.certMsg=errorText(e);}
   if(!valid('certificate')||state.testId!==id)return;
   L.order.forEach(m=>{if(!OBJECTIVE.includes(m)&&f.mods[m]&&f.mods[m].data)saveProductive(id,m,exam,f.mods[m].data);});
   paintCertificate(id,exam,f,active);
  });
  p.append(score);
 }
 p.append(msg);
 const actions=n('div','ge-actions');
 if(d.complete){
  actions.append(btn(T('certPrint'),'work-btn primary',()=>printCertificate(id,f,d)));
  if(typeof navigator.share==='function')actions.append(btn(T('certShare'),'work-btn subtle',()=>{navigator.share({title:T('certTitle'),text:certText(id,d)}).catch(()=>{});}));
 }
 actions.append(btn(T('certRetry'),'work-btn subtle',()=>{if(store.get(fullKey(id))&&!root.confirm(T('fullConfirmRestart')))return;startFull(id);}),btn(T('toModules'),'work-btn subtle',()=>overview(id)));
 p.append(actions);
}
function certText(id,d){
 const L=levelOf(id);
 return T('certShareText',{exam:fam.short+' '+L.id,level:L.id,n:numberOf(id),p:d.pct})+'\n'+L.order.map(m=>NAMES[m]+' '+d.mods[m].pct).join(' · ')+'\n'+verdictText(id,d);
}
const esc=text=>String(text).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function openPrint(html){
 // Pencere tıklama anında açılır; açılamazsa gizli bir çerçeveden yazdırılır.
 let win=null;try{win=root.open('','_blank');}catch(e){}
 if(win){try{win.document.open();win.document.write(html);win.document.close();return;}catch(e){try{win.close();}catch(ignore){}}}
 const frame=document.createElement('iframe');frame.setAttribute('aria-hidden','true');frame.style.cssText='position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;';document.body.append(frame);
 const clean=()=>frame.remove();
 try{const doc=frame.contentWindow.document;doc.open();doc.write(html);doc.close();frame.contentWindow.addEventListener('afterprint',clean,{once:true});setTimeout(()=>{try{frame.contentWindow.focus();frame.contentWindow.print();}catch(e){clean();}},350);setTimeout(clean,60000);}catch(e){clean();}
}
function printCertificate(id,f,d){
 const L=levelOf(id),lang=root.NATIVE_LANG||'tr',dir=lang==='ar'?'rtl':'ltr';
 let who='';try{who=root.firebase.auth().currentUser?.displayName||'';}catch(e){}
 const rows=L.order.map(m=>'<tr><td lang="'+fam.lang+'">'+esc(NAMES[m])+'</td><td class="num">'+esc(d.mods[m].pct)+' / 100</td><td lang="'+fam.lang+'">'+esc(grade(d.mods[m].pct))+'</td></tr>').join('');
 const html='<!doctype html><html lang="'+esc(lang)+'" dir="'+dir+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(T('certHeading',{level:L.id,n:numberOf(id)}))+'</title><style>'
  +'body{margin:0;background:#e9edf3;color:#1b2536;font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}.bar{position:sticky;top:0;display:flex;gap:12px;align-items:center;justify-content:space-between;padding:12px 16px;background:#14233b;color:#e7efff;font-size:13px}.bar button{padding:9px 16px;border:0;border-radius:10px;background:#87dfd7;color:#102236;font-weight:700;font-size:14px}'
  +'.paper{max-width:760px;margin:24px auto;padding:46px 50px;background:#fff;border-radius:6px;box-shadow:0 6px 24px #0f1a2d22;outline:2px solid #1f3b57;outline-offset:-16px}.brand{color:#4a6a8a;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase}h1{margin:10px 0 4px;font:700 28px/1.3 Georgia,"Times New Roman",serif}.sub{margin:0;color:#5a6780}.who{margin:22px 0 0;font:600 21px/1.4 Georgia,serif}'
  +'table{width:100%;margin:24px 0 18px;border-collapse:collapse}th,td{padding:10px 8px;border-bottom:1px solid #e3e8ef;text-align:start}th{color:#5a6780;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em}.num{text-align:end;font-variant-numeric:tabular-nums;white-space:nowrap}tr.total td{border-top:2px solid #1f3b57;border-bottom:0;font-weight:700;font-size:17px}'
  +'.verdict{display:inline-block;padding:7px 16px;border-radius:999px;background:#e3f6ec;color:#0f5c37;font-weight:700}.verdict.no{background:#fdeceb;color:#86231c}.rule{margin:12px 0 0;color:#5a6780;font-size:13px}.foot{margin-top:28px;padding-top:14px;border-top:1px solid #e3e8ef;color:#7a869c;font-size:11.5px;line-height:1.6}'
  +'@media print{body{background:#fff}.bar{display:none}.paper{margin:0;box-shadow:none;max-width:none}}@media(max-width:560px){.paper{margin:0;padding:34px 26px;border-radius:0}}</style></head><body>'
  +'<div class="bar"><span>'+esc(T('certPrintHint'))+'</span><button onclick="window.print()">'+esc(T('certPrint'))+'</button></div>'
  +'<main class="paper"><div class="brand">Lumira · '+esc(fam.name)+'</div><h1>'+esc(T('certHeading',{level:L.id,n:numberOf(id)}))+'</h1><p class="sub">'+esc(titleOf(L)+' · '+fmtDate(f.finished||Date.now()))+'</p>'
  +(who?'<p class="who">'+esc(who)+'</p>':'')
  +'<table><thead><tr><th>'+esc(T('certModule'))+'</th><th class="num">'+esc(T('certPoints'))+'</th><th>'+esc(T('certGrade'))+'</th></tr></thead><tbody>'+rows
  +'<tr class="total"><td>'+esc(T('certOverall'))+'</td><td class="num">'+esc(d.pct)+' / 100</td><td lang="'+fam.lang+'">'+esc(overallLabel(d.pct,d.passed))+'</td></tr></tbody></table>'
  +'<span class="verdict'+(d.passed?'':' no')+'">'+esc(verdictText(id,d))+'</span><p class="rule">'+esc(ruleText(id))+'</p>'
  +'<p class="foot">'+esc(T('certNote'))+'<br><span lang="'+fam.lang+'">'+esc(fam.notOfficial)+'</span> · '+esc(T('certFooter'))+'</p></main></body></html>';
 openPrint(html);
}

/* ------------------------------------------------------------ Schreiben */
function normalize(s){return String(s||'').toLocaleLowerCase(fam.lang).normalize('NFKC').replace(/[.,;:!?()"'„“”‚‘’-]/g,' ').replace(/\s+/g,' ').trim();}
function formCorrect(field,value){const v=normalize(value);if(!v)return false;return[field.a].concat(field.alt||[]).some(a=>{const x=normalize(a);return x&&(v===x||v.includes(x)||(x.length>3&&x.includes(v)&&v.length>=x.length-2));});}
function paintWriting(){
 const r=state.run,parts=r.exam.schreiben,i=r.saved.teil,teil=parts[i];
 const p=page(null,null,null);p.classList.add('ge-run');
 topBar(p,r,i,parts.length);
 const card=n('article','ge-teil');p.append(card);
 card.append(de(n('h2','',teil.title)));
 if(teil.task)card.append(de(n('p','ge-task',teil.task)));
 if(teil.situation){const box=n('section','ge-text');box.append(paragraphs(teil.situation));card.append(box);}
 if(Array.isArray(teil.form)){
  const form=n('div','ge-form');r.saved.form[i]=r.saved.form[i]||{};
  teil.form.forEach((field,k)=>{const label=de(n('label','ge-field'));const input=n('input');input.type='text';input.autocomplete='off';input.spellcheck=false;input.lang=fam.lang;input.value=r.saved.form[i][k]||'';input.oninput=()=>{r.saved.form[i][k]=input.value;saveRun();};label.append(n('span','',(k+1)+'. '+field.label),input);form.append(label);});
  card.append(form);
 }
 if(teil.prompt||teil.words){
  if(teil.prompt){const box=n('section','ge-text');box.append(paragraphs(teil.prompt));card.append(box);}
  if(Array.isArray(teil.points)&&teil.points.length){
   r.saved.checks[i]=r.saved.checks[i]||{};
   const list=n('div','ge-points');list.append(n('p','ge-points-title',T('contentPoints')));
   teil.points.forEach((point,k)=>{const row=de(n('label','ge-point')),box=n('input');box.type='checkbox';box.checked=!!r.saved.checks[i][k];box.onchange=()=>{r.saved.checks[i][k]=box.checked;saveRun();};row.append(box,document.createTextNode(point));list.append(row);});
   card.append(list);
  }
  const area=de(n('textarea','ge-textarea'));area.placeholder=T('writeHere');area.maxLength=3000;area.value=r.saved.texts[i]||'';
  const counter=n('p','ge-words');
  const paintCount=()=>{counter.textContent=T('words',{n:wordCount(area.value)})+(teil.words?' · '+T('target',{n:teil.words}):'');};
  const ai=aiBlock(r,i,()=>area.value);
  area.oninput=()=>{r.saved.texts[i]=area.value;paintCount();saveRun();ai.refresh();};paintCount();
  card.append(area,counter);
  const tools=n('div','ge-actions'),output=n('div','ge-check');output.setAttribute('role','status');tools.append(ai.button);
  const check=btn(T('check'),'work-btn subtle',async()=>{
   const text=area.value.trim();if(!text||!root.LUMIRA_FEATURES?.api)return;
   check.disabled=true;check.textContent=T('checking');output.replaceChildren();
   try{
    const result=await root.LUMIRA_FEATURES.api('check',{id:root.LUMIRA_FEATURES.id(),text,language:fam.lang,uiLanguage:root.NATIVE_LANG||'tr'});
    const matches=Array.isArray(result?.matches)?result.matches:[];
    if(!matches.length)output.append(n('p','ge-check-ok',T('noIssues')));
    else{output.append(n('p','',T('issues',{n:matches.length})));const ul=n('ul');matches.slice(0,12).forEach(m=>{const li=n('li'),bad=de(n('b','',text.slice(m.offset,m.offset+m.length))),fix=m.replacements?.[0]?.value;li.append(bad);if(fix!=null)li.append(document.createTextNode(' → '),de(n('b','ge-fix',fix)));if(m.message)li.append(n('span','',' · '+m.message));ul.append(li);});output.append(ul);}
    root.LUMIRA_FEATURES.api('status').catch(()=>{});
   }catch(e){output.append(n('p','ge-check-bad',e?.featureCode&&root.LUMIRA_FEATURES.errorText?root.LUMIRA_FEATURES.errorText(e):T('loadError')));}
   finally{check.disabled=false;check.textContent=T('check');}
  });
  if(!['ar','tr'].includes(fam.lang))tools.append(check);card.append(tools,ai.message,output,ai.panel);
 }
 if(teil.sample){
  const details=n('details','ge-sample'),summary=n('summary','',T('showSample'));
  details.ontoggle=()=>{summary.textContent=details.open?T('hideSample'):T('showSample');};
  details.append(summary,paragraphs(teil.sample));card.append(details);
 }
 const nav=n('div','ge-nav');
 if(i>0)nav.append(btn(T('prev'),'work-btn subtle',()=>{r.saved.teil=i-1;saveRun();paintTeil();}));
 if(i<parts.length-1)nav.append(btn(T('next'),'work-btn primary',()=>{r.saved.teil=i+1;saveRun();paintTeil();}));
 else nav.append(btn(T('markDone'),'work-btn primary',()=>finishProductive(false)));
 p.append(nav);
}

/* ------------------------------------------- yapay zekâ ile tahmini puan */
const CRITERIA=[['task','critTask'],['coherence','critCoherence'],['vocabulary','critVocabulary'],['grammar','critGrammar']];
const hashText=text=>{let h=5381;const s=String(text||'').trim();for(let k=0;k<s.length;k++)h=(h*33+s.charCodeAt(k))>>>0;return h.toString(36)+'.'+s.length;};
const minWords=(m,teil)=>m==='sprechen'?8:Math.max(8,Math.round((Number(teil.words)||40)*0.3));
const errorText=e=>e?.featureCode&&root.LUMIRA_FEATURES?.errorText?root.LUMIRA_FEATURES.errorText(e):T('loadError');
function taskText(m,teil){
 return[teil.title,teil.task,teil.situation,teil.prompt,Array.isArray(teil.points)&&teil.points.length?'Content points: '+teil.points.join(' | '):'',Array.isArray(teil.cards)&&teil.cards.length?'Cards: '+teil.cards.join(' | '):'',teil.words?'Target length: about '+teil.words+' words':'',m==='sprechen'?'Spoken answer':'']
  .filter(Boolean).join('\n').slice(0,3000);
}
async function scoreAnswer(id,m,teil,text){
 if(!uid())throw Object.assign(new Error('login_required'),{featureCode:'login_required'});
 if(!root.LUMIRA_FEATURES?.api)throw Object.assign(new Error('backend_unavailable'),{featureCode:'backend_unavailable'});
 const data=await root.LUMIRA_FEATURES.api('goetheScore',{id:root.LUMIRA_FEATURES.id(),level:levelCode(id),exam:famOf(id).id,module:m,task:taskText(m,teil),text:text.slice(0,4000),uiLanguage:root.NATIVE_LANG||'tr'},{timeoutMs:25000});
 const a=data&&data.assessment;
 if(!a||!Number.isFinite(a.score)||!a.criteria)throw Object.assign(new Error('writing_invalid_result'),{featureCode:'writing_invalid_result'});
 root.LUMIRA_FEATURES.api('status').catch(()=>{});
 return Object.assign({},a,{hash:hashText(text),at:Date.now()});
}
function aiPanel(a,stale){
 const box=n('section','ge-ai');box.dataset.goetheAi='';
 const head=n('div','ge-ai-head'),ring=n('div','ge-ring ge-ring-sm '+(a.score>=passMark()?'good':'warn'));ring.style.setProperty('--p',String(a.score));ring.append(n('strong','',String(a.score)),n('small','','/ 100'));
 const title=n('div','ge-ai-title');title.append(n('strong','',T('aiTitle')),n('span','',T('aiEstimate')+': '+a.score+' / 100 · '+T(a.score>=passMark()?'passed':'belowPass')));
 head.append(ring,title);box.append(head);
 if(stale)box.append(n('p','ge-ai-stale',T('aiStale')));
 const criteria=n('div','ge-ai-criteria');
 CRITERIA.forEach(([key,label])=>{const c=a.criteria&&a.criteria[key];if(!c)return;const row=n('div','ge-ai-crit'),top=n('div','ge-ai-crit-top'),bar=n('span','ge-break-bar'),fill=n('span');fill.style.width=Math.max(0,Math.min(100,c.score/5*100))+'%';bar.append(fill);top.append(n('strong','',T(label)),bar,n('span','ge-ai-crit-score',c.score+'/5'));row.append(top);if(c.comment)row.append(n('p','',c.comment));criteria.append(row);});
 box.append(criteria);
 const list=(title,items,cls)=>{if(!Array.isArray(items)||!items.length)return;const s=n('div','ge-ai-list '+cls);s.append(n('h4','',title));const ul=n('ul');items.forEach(x=>ul.append(n('li','',x)));s.append(ul);box.append(s);};
 list(T('strengths'),a.strengths,'good');list(T('improvements'),a.improvements,'warn');
 if(Array.isArray(a.corrections)&&a.corrections.length){const s=n('div','ge-ai-list ge-check');s.append(n('h4','',T('corrections')));const ul=n('ul');a.corrections.forEach(c=>{const li=n('li');li.append(de(n('b','',c.original)),document.createTextNode(' → '),de(n('b','ge-fix',c.replacement||'∅')));if(c.note)li.append(n('span','',' · '+c.note));ul.append(li);});s.append(ul);box.append(s);}
 if(a.improved){const d=n('details','ge-sample');d.append(n('summary','',T('improved')),paragraphs(a.improved));box.append(d);}
 box.append(n('p','ge-ai-note',T('aiNote')));
 return box;
}
/* Yazma ve konuşma görevlerinde ortak puanlama düğmesi + sonuç paneli. */
function aiBlock(r,i,read){
 const teil=r.exam[r.m][i],panel=n('div','ge-ai-wrap'),message=n('p','ge-ai-msg');message.setAttribute('role','status');
 let busy=false,shownStale=null;
 const button=btn(T('aiScore'),'work-btn primary ge-ai-btn',async()=>{
  if(busy)return;
  stopListening();
  if(!uid()){message.textContent=T('aiLogin');return;}
  const text=String(read()||'').trim(),need=minWords(r.m,teil);
  if(wordCount(text)<need){message.textContent=T('tooShort',{n:need});return;}
  busy=true;button.disabled=true;button.textContent=T('aiScoring');message.textContent='';
  try{const result=await scoreAnswer(r.id,r.m,teil,text);r.saved.texts[i]=read();r.saved.scores[i]=result;saveRun();}
  catch(e){message.textContent=errorText(e);}
  finally{busy=false;button.disabled=false;paint();}
 });
 const paint=()=>{const sc=r.saved.scores[i],stale=!!sc&&sc.hash!==hashText(read());shownStale=sc?stale:null;button.textContent=sc?T('aiRescore'):T('aiScore');panel.replaceChildren();if(sc)panel.append(aiPanel(sc,stale));};
 const refresh=()=>{const sc=r.saved.scores[i];if(sc&&(sc.hash!==hashText(read()))!==shownStale)paint();};
 paint();
 return{button,message,panel,refresh};
}
// strict (tam sınav): gerçek sınavdaki gibi boş ya da çok kısa bırakılan görev 0 puan sayılır.
function productiveOutcome(exam,m,data,strict){
 const parts=exam[m],maxWords=Math.max(0,...parts.map(teil=>Number(teil.words)||0)),rows=[];
 let fc=0,ft=0;
 parts.forEach((teil,i)=>{
  if(m==='schreiben'&&Array.isArray(teil.form)&&teil.form.length){let c=0;teil.form.forEach((field,k)=>{if(formCorrect(field,((data.form||{})[i]||{})[k]))c++;});fc+=c;ft+=teil.form.length;rows.push({i,title:teil.title,kind:'form',pct:Math.round(c/teil.form.length*100),weight:Math.max(10,Math.round((maxWords||30)/2))});return;}
  const text=String((data.texts||{})[i]||'').trim(),sc=(data.scores||{})[i],fresh=!!sc&&sc.hash===hashText(text),empty=!fresh&&!!strict&&wordCount(text)<minWords(m,teil);
  rows.push({i,title:teil.title,kind:'ai',text,score:fresh?sc:null,pct:fresh?sc.score:empty?0:null,empty,weight:m==='sprechen'?1:(Number(teil.words)||40)});
 });
 const ai=rows.filter(x=>x.kind==='ai'),complete=rows.every(x=>x.pct!==null)&&ai.length>0;
 const weight=rows.reduce((s,x)=>s+x.weight,0);
 return{rows,pct:complete?Math.round(rows.reduce((s,x)=>s+x.pct*x.weight,0)/weight):null,parts:rows.map(x=>x.pct),form:ft?Math.round(fc/ft*100):null,fc,ft,scored:ai.filter(x=>x.pct!==null).length,total:ai.length,pending:ai.filter(x=>x.pct===null&&wordCount(x.text)>=minWords(m,parts[x.i]))};
}
async function finishProductive(timeUp){
 const r=state.run;if(!r||r.finished)return;r.finished=true;stopAll();
 store.set(r.key||progressKey(r.id,r.m),null);
 const data={texts:r.saved.texts,form:r.saved.form,scores:r.saved.scores,at:Date.now()};
 store.set(lastKey(r.id,r.m),data);
 if(r.full){fullRecord(r.id,r.m,{data});saveProductive(r.id,r.m,r.exam,data);fullBreak(r.id,r.m,timeUp);return;}
 paintProductive(r.id,r.m,r.exam,data,{timeUp});
 await saveProductive(r.id,r.m,r.exam,data);
}
async function saveProductive(id,m,exam,data){
 const out=productiveOutcome(exam,m,data),entry={done:true};
 if(out.form!==null)entry.form=out.form;
 if(out.pct!==null){entry.pct=out.pct;entry.parts=out.parts;entry.ai=true;}
 const xp=await saveResult(id,m,entry);
 if(xp&&valid('result')&&state.lastResult?.id===id&&state.lastResult.m===m){state.lastResult.xp=xp;const box=state.host.querySelector('.ge-result-text');if(box&&!box.querySelector('.ge-xp'))box.append(n('p','ge-xp',T('xp',{n:xp})));}
}
async function showProductive(id,m){
 useFamily(famOf(id));
 const data=store.get(lastKey(id,m));if(!data){overview(id);return;}
 let exam;try{exam=await loadExam(id);}catch(e){overview(id);return;}
 if(!valid())return;
 paintProductive(id,m,exam,data,{});
}
function paintProductive(id,m,exam,data,opts){
 useFamily(famOf(id));
 state.view='result';state.lastResult={id,m,productive:true,xp:state.lastResult?.id===id&&state.lastResult.m===m?state.lastResult.xp:0};
 const out=productiveOutcome(exam,m,data);
 const p=page(NAMES[m]+' · '+T('test',{n:numberOf(id)}),titleOf(levelOf(id)),()=>overview(id));
 const panel=n('div','work-panel ge-result'),summary=n('div','ge-result-text');
 if(out.pct!==null){
  const ring=n('div','ge-ring '+(out.pct>=passMark()?'good':'warn'));ring.style.setProperty('--p',String(out.pct));ring.append(n('strong','',String(out.pct)),n('small','','/ 100'));panel.append(ring);
  summary.append(n('h2','',out.pct>=passMark()?T('pass'):T('belowPass')),n('p','',T('moduleEstimate',{m:NAMES[m]})+' · '+T('points',{p:out.pct})));
  if(out.pct<passMark())summary.append(n('p','work-help',T('fail',{n:passMark()})));
 }else{
  summary.append(n('h2','',T('done')));
  if(out.total)summary.append(n('p','',T('scoredCount',{a:out.scored,t:out.total})),n('p','work-help',T('unscoredNote')));
 }
 if(out.ft)summary.append(n('p','',T('formScore',{c:out.fc,t:out.ft})));
 if(opts.timeUp)summary.append(n('p','work-help',T('timeUp')));
 if(state.lastResult.xp)summary.append(n('p','ge-xp',T('xp',{n:state.lastResult.xp})));
 panel.append(summary);p.append(panel);
 if(out.pending.length){
  const msg=n('p','ge-ai-msg');msg.setAttribute('role','status');
  const rest=btn(T('scoreRest',{n:out.pending.length}),'work-btn primary ge-wide',async()=>{
   rest.disabled=true;rest.textContent=T('aiScoring');data.scores=Object.assign({},data.scores);
   try{for(const row of out.pending){data.scores[row.i]=await scoreAnswer(id,m,exam[m][row.i],row.text);store.set(lastKey(id,m),data);}}
   catch(e){msg.textContent=errorText(e);}
   if(!valid('result'))return;
   paintProductive(id,m,exam,data,opts);
   saveProductive(id,m,exam,data);
  });
  p.append(rest,msg);
 }
 const breakdown=n('div','ge-breakdown');
 out.rows.forEach(x=>{const row=n('div','ge-break-row'),bar=n('span','ge-break-bar'),fill=n('span');fill.style.width=(x.pct||0)+'%';bar.append(fill);row.append(de(n('span','ge-break-name',x.title)),bar,n('span','ge-break-score',x.pct===null?'—':String(x.pct)));breakdown.append(row);});
 p.append(breakdown);
 out.rows.forEach(x=>{
  if(x.kind!=='ai')return;
  const teil=exam[m][x.i],d=n('details','ge-feedback'),sum=n('summary');
  sum.append(de(n('strong','',x.title)),n('span','',m==='schreiben'?T('words',{n:wordCount(x.text)})+(teil.words?' · '+T('target',{n:teil.words}):''):T('words',{n:wordCount(x.text)})));
  d.append(sum);
  if(x.text){const box=n('section','ge-text');box.append(paragraphs(x.text));d.append(box);}
  if(x.score)d.append(aiPanel(x.score,false));
  p.append(d);
 });
 p.append(n('p','work-help',m==='sprechen'?T('pronunciation'):T('writingNote')));
 const actions=n('div','ge-actions');
 actions.append(btn(T('retake'),'work-btn subtle',()=>run(id,m,{fresh:true})),btn(T('toModules'),'work-btn primary',()=>overview(id)));
 p.append(actions);
}

/* ------------------------------------------------------------- Sprechen */
function paintSpeaking(){
 const r=state.run,parts=r.exam.sprechen,i=r.saved.teil,teil=parts[i];
 const p=page(null,null,null);p.classList.add('ge-run');
 topBar(p,r,i,parts.length);
 if(i===0)p.append(n('p','work-help',T('speakingNote')));
 const card=n('article','ge-teil');p.append(card);
 card.append(de(n('h2','',teil.title)));
 if(teil.task)card.append(de(n('p','ge-task',teil.task)));
 if(teil.situation){const box=n('section','ge-text');box.append(paragraphs(teil.situation));card.append(box);}
 if(Array.isArray(teil.cards)&&teil.cards.length){const grid=n('div','ge-cards');teil.cards.forEach(text=>grid.append(de(n('span','ge-card',text))));card.append(grid);}
 if(Array.isArray(teil.phrases)&&teil.phrases.length){const box=n('section','ge-phrases');box.append(n('h3','',T('phrases')));const ul=de(n('ul'));teil.phrases.forEach(x=>ul.append(n('li','',x)));box.append(ul);card.append(box);}
 card.append(speakingAnswer(r,i));
 if(teil.sample){
  // Örnek cevap kapalı başlar: önce kendi cevabını ver, sonra karşılaştır.
  const box=n('details','ge-sample-box'),summary=n('summary','',T('showSample'));
  box.ontoggle=()=>{summary.textContent=box.open?T('hideSample'):T('showSample');if(!box.open&&playing)stopSpeech();};
  box.append(summary,paragraphs(teil.sample));
  let playing=false;const listen=btn(T('listenSample'),'work-btn subtle',()=>{if(playing){stopSpeech();return;}playing=true;listen.textContent=T('stop');speakScript(teil.sample,()=>{playing=false;listen.textContent=T('listenSample');},()=>{playing=false;listen.textContent=T('listenSample');toast(T('noVoice'),'bad');});});
  box.append(listen);card.append(box);
 }
 const nav=n('div','ge-nav');
 if(i>0)nav.append(btn(T('prev'),'work-btn subtle',()=>{r.saved.teil=i-1;saveRun();paintTeil();}));
 if(i<parts.length-1)nav.append(btn(T('next'),'work-btn primary',()=>{r.saved.teil=i+1;saveRun();paintTeil();}));
 else nav.append(btn(T('markDone'),'work-btn primary',()=>finishProductive(false)));
 p.append(nav);
}
function speakingAnswer(r,i){
 const box=n('section','ge-answer');box.append(n('h3','',T('answerLabel')));
 const area=de(n('textarea','ge-textarea ge-answer-text'));area.maxLength=3000;area.value=r.saved.texts[i]||'';area.placeholder=T('writeHere');
 const counter=n('p','ge-words'),hint=n('p','ge-answer-hint'),message=n('p','ge-ai-msg');message.setAttribute('role','status');
 const paintCount=()=>{counter.textContent=T('words',{n:wordCount(area.value)});};
 const ai=aiBlock(r,i,()=>area.value);
 area.oninput=()=>{r.saved.texts[i]=area.value;paintCount();saveRun();ai.refresh();};
 const tools=n('div','ge-actions');
 if(recognitionSupported()){
  hint.textContent=T('recordHint',{lang:langName(fam.lang)});
  const record=btn(T('record'),'work-btn subtle ge-rec',()=>{
   if(listening){stopListening();return;}
   message.textContent='';
   const base=area.value.trim();
   const ok=listen((heard,interim)=>{area.value=[base,heard,interim].filter(Boolean).join(' ');r.saved.texts[i]=[base,heard].filter(Boolean).join(' ');paintCount();ai.refresh();},
    on=>{record.textContent=on?T('recordStop'):T('record');record.classList.toggle('is-active',on);record.setAttribute('aria-pressed',String(on));if(!on){area.value=r.saved.texts[i]||area.value;saveRun();paintCount();ai.refresh();}},
    key=>{message.textContent=T(key);});
   if(!ok)message.textContent=T('speechFailed');
  });
  record.setAttribute('aria-pressed','false');tools.append(record);
 }else hint.textContent=T('typeHint',{lang:langName(fam.lang)});
 tools.append(ai.button);paintCount();
 box.append(hint,area,counter,tools,message,ai.message,ai.panel,n('p','ge-ai-note',T('pronunciation')));
 return box;
}

/* -------------------------------------------------------------- yaşam döngüsü */
function refreshLocale(){
 if(!valid())return;
 const v=state.view;
 if(v==='hub')hub(state.host,state.options);
 else if(v==='languages')languages();
 else if(v==='levels'){useFamily(familyFor(state.lang));levels();}
 else if(v==='tests'){useFamily(familyFor(state.lang));tests(state.level);}
 else if(v==='overview')overview(state.testId);
 else if(v==='module'){if(state.run.saved.started||state.run.review||state.run.m==='sprechen')paintTeil();else intro();}
 else if(v==='fullBreak'&&state.fullBreak)fullBreak(state.fullBreak.id,state.fullBreak.m,state.fullBreak.timeUp);
 else if(v==='certificate')certificate(state.testId,state.certLast);
 else if(v==='result'&&state.lastResult?.productive)showProductive(state.lastResult.id,state.lastResult.m);
 else if(v==='result'&&state.lastResult)paintResult(state.lastResult.id,state.lastResult.m,state.lastResult.result,state.lastResult.xp||0);
}

/* ----------------------------------------- İlerleme ekranındaki özet kartı */
// Özet kartı seçilen dilin sertifika ailesini gösterir (varsayılan Almanca/Goethe).
function withFamily(f,fn){const previous=fam;fam=f||GERMAN;try{return fn();}finally{fam=previous;}}
function summaryData(f){return withFamily(f,()=>{
 const avg=list=>list.length?Math.round(list.reduce((s,x)=>s+x,0)/list.length):null;
 return fam.levels.map(L=>{
  const mods={},teile={};let tests=0,next=null,lastAt=0,full=null;
  MODULES.forEach(m=>{mods[m]=[];});
  for(let i=1;i<=(L.count||COUNT);i++){
   const r=results[testId(L.id,i)]||{};let any=false;
   if(r.full&&Number.isFinite(r.full.best)&&(!full||r.full.best>full.p))full={n:i,p:r.full.best,passed:!!r.full.passed};
   MODULES.forEach(m=>{
    const x=r[m];if(!x||typeof x!=='object')return;any=true;lastAt=Math.max(lastAt,Number(x.at)||0);
    const value=Number.isFinite(x.last)?x.last:x.best;if(Number.isFinite(value))mods[m].push(value);
    const parts=Array.isArray(x.parts)?x.parts:x.parts&&typeof x.parts==='object'?Object.values(x.parts):[];
    parts.forEach((p,k)=>{if(!Number.isFinite(p))return;const key=m+':'+k,row=teile[key]||(teile[key]={m,k,sum:0,n:0});row.sum+=p;row.n++;});
   });
   if(any)tests++;else if(next===null)next=i;
  }
  const modAvg={};MODULES.forEach(m=>{modAvg[m]=avg(mods[m]);});
  const scored=MODULES.filter(m=>modAvg[m]!==null);
  let weak=null;
  Object.values(teile).forEach(t=>{const p=Math.round(t.sum/t.n);if(!weak||p<weak.p)weak={m:t.m,k:t.k,p};});
  if(!weak)scored.forEach(m=>{if(!weak||modAvg[m]<weak.p)weak={m,p:modAvg[m]};});
  if(weak&&weak.p>=90)weak=null;
  return{level:L.id,tests,modAvg,overall:avg(scored.map(m=>modAvg[m])),weak,next,lastAt,full,count:L.count||COUNT};
 });
});}
function mountSummary(el,opts){
 if(!el)return;opts=opts||{};
 const open=target=>{try{opts.open?.(target);}catch(e){}};
 const paint=()=>{
  if(!el.isConnected)return;
  const chosen=familyFor(opts.language)||(opts.learningGerman?GERMAN:null);
  const f=chosen||GERMAN,data=summaryData(f),active=data.filter(x=>x.tests>0);
  if(!active.length&&!chosen){el.replaceChildren();el.hidden=true;return;}
  withFamily(f,()=>paintCard(f,data,active));
 };
 const paintCard=(f,data,active)=>{
  el.hidden=false;
  const card=n('section','pm-card ge-summary');card.dataset.goetheSummary='';card.lang=root.NATIVE_LANG||'tr';card.dir=card.lang==='ar'?'rtl':'ltr';
  card.append(n('h4','',T('sumTitle')+' · '+f.short));
  if(!active.length){card.append(n('p','ge-sum-empty',T('sumEmpty',{name:f.name})),btn(T('sumOpen'),'pm-btn primary ge-sum-cta',()=>open({lang:f.lang})));el.replaceChildren(card);return;}
  const list=n('div','ge-sum-list');
  active.forEach(x=>{
   const row=btn('','ge-sum-row',()=>open({lang:f.lang,level:x.level})),body=n('span','ge-sum-body'),top=n('span','ge-sum-top');row.dataset.goetheSummaryLevel=x.level;
   top.append(n('strong','',T('sumExams',{n:x.tests,t:x.count})));
   if(x.overall!==null)top.append(n('span','ge-sum-avg '+(x.overall>=passMark()?'good':'warn'),T('sumAvg',{p:x.overall})));
   const chips=n('span','ge-chips');
   f.levels.find(L=>L.id===x.level).order.forEach(m=>{const v=x.modAvg[m],chip=n('span','ge-chip',shortName(m)+' '+(v===null?'—':v));if(v!==null)chip.classList.add(v>=passMark()?'good':'warn');chips.append(chip);});
   if(x.full){const chip=n('span','ge-chip ge-chip-full '+(x.full.passed?'good':'warn'),'🏁 '+x.full.p);chip.title=T('fullTitle');chips.append(chip);}
   body.append(top,chips);
   row.append(n('span','ge-level-id',x.level),body,n('span','practice-mode-arrow',card.dir==='rtl'?'‹':'›'));
   list.append(row);
  });
  card.append(list);
  const focus=active.slice().sort((a,b)=>b.lastAt-a.lastAt)[0];
  if(focus.weak)card.append(n('p','ge-sum-weak',focus.weak.k!==undefined?T('sumWeak',{level:focus.level,m:NAMES[focus.weak.m],k:focus.weak.k+1,p:focus.weak.p}):T('sumWeakModule',{level:focus.level,m:NAMES[focus.weak.m],p:focus.weak.p})));
  card.append(focus.next?btn(T('sumNext',{level:focus.level,n:focus.next}),'pm-btn primary ge-sum-cta',()=>open({test:testId(focus.level,focus.next,f)})):btn(T('sumAll'),'pm-btn primary ge-sum-cta',()=>open({lang:f.lang,level:focus.level})));
  el.replaceChildren(card);
 };
 // loadResults() first switches the cache to the signed-in account.
 const loading=loadResults();paint();
 loading.then(paint,()=>{});
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){saveRun();if(valid())stopSpeech();}});
root.addEventListener('pagehide',saveRun);
root.addEventListener('lumira:featureauthchange',()=>{resultsFor=null;});
root.LUMIRA_GOETHE={hub,refreshLocale,isMounted:()=>valid(),stop:stopAll,validExam,LEVELS,COUNT,testId,mountSummary,summary:summaryData,_loadResults:loadResults,_formCorrect:formCorrect,_parseScript:parseScript,_productiveOutcome:productiveOutcome,_hashText:hashText,_certificateData:certificateData,_grade:grade,_countOf:countOf,_freeExam:freeExam,_unlocked:unlocked,_claimFree:claimFree,FAMILIES,_famOf:famOf,_fileOf:fileOf,_examPassed:examPassed,_useFamily:useFamily};
})(window);
