/* Lumira 1.9.6 — reviewed parallel examples; no network or generated word-level joins. */
(function(root){
'use strict';
const languages=["tr","de","en","ar","fr","es","ru"];
const rows=[
  [
    "Sen çok naziksin.",
    "Du bist sehr nett.",
    "You are very kind.",
    "أنت لطيف جداً.",
    "Tu es très gentil.",
    "Eres muy amable.",
    "Ты очень добрый."
  ],
  [
    "İyi misin?",
    "Geht es dir gut?",
    "Are you okay?",
    "هل أنت بخير؟",
    "Est-ce que tu vas bien ?",
    "¿Estás bien?",
    "Ты в порядке?"
  ],
  [
    "Ben Almanca öğreniyorum.",
    "Ich lerne Deutsch.",
    "I am learning German.",
    "أنا أتعلم الألمانية.",
    "J'apprends l'allemand.",
    "Estoy aprendiendo alemán.",
    "Я учу немецкий язык."
  ],
  [
    "Ben Türkçe öğreniyorum.",
    "Ich lerne Türkisch.",
    "I am learning Turkish.",
    "أنا أتعلم التركية.",
    "J'apprends le turc.",
    "Estoy aprendiendo turco.",
    "Я учу турецкий язык."
  ],
  [
    "Bu benim kitabım.",
    "Das ist mein Buch.",
    "This is my book.",
    "هذا كتابي.",
    "C'est mon livre.",
    "Este es mi libro.",
    "Это моя книга."
  ],
  [
    "Araba çok hızlı.",
    "Das Auto ist sehr schnell.",
    "The car is very fast.",
    "السيارة سريعة جداً.",
    "La voiture est très rapide.",
    "El coche es muy rápido.",
    "Машина очень быстрая."
  ],
  [
    "Kitap ilginç.",
    "Das Buch ist interessant.",
    "The book is interesting.",
    "الكتاب ممتع.",
    "Le livre est intéressant.",
    "El libro es interesante.",
    "Книга интересная."
  ],
  [
    "Bir bardak su, lütfen.",
    "Ein Glas Wasser, bitte.",
    "A glass of water, please.",
    "كوب ماء، من فضلك.",
    "Un verre d'eau, s'il vous plaît.",
    "Un vaso de agua, por favor.",
    "Стакан воды, пожалуйста."
  ],
  [
    "Taze ekmek alıyorum.",
    "Ich kaufe frisches Brot.",
    "I am buying fresh bread.",
    "أشتري خبزاً طازجاً.",
    "J'achète du pain frais.",
    "Estoy comprando pan fresco.",
    "Я покупаю свежий хлеб."
  ],
  [
    "Elma tatlı.",
    "Der Apfel ist süß.",
    "The apple is sweet.",
    "التفاحة حلوة.",
    "La pomme est sucrée.",
    "La manzana es dulce.",
    "Яблоко сладкое."
  ],
  [
    "Sebze sağlıklıdır.",
    "Gemüse ist gesund.",
    "Vegetables are healthy.",
    "الخضروات صحية.",
    "Les légumes sont bons pour la santé.",
    "Las verduras son saludables.",
    "Овощи полезны для здоровья."
  ],
  [
    "Bir kız kardeşim var.",
    "Ich habe eine Schwester.",
    "I have a sister.",
    "لدي أخت.",
    "J'ai une sœur.",
    "Tengo una hermana.",
    "У меня есть сестра."
  ],
  [
    "İki çocuğum var.",
    "Ich habe zwei Kinder.",
    "I have two children.",
    "لدي طفلان.",
    "J'ai deux enfants.",
    "Tengo dos hijos.",
    "У меня двое детей."
  ],
  [
    "Şimdi evde kalıyorum.",
    "Ich bleibe jetzt zu Hause.",
    "I am staying at home now.",
    "أبقى في المنزل الآن.",
    "Je reste à la maison maintenant.",
    "Ahora me quedo en casa.",
    "Сейчас я остаюсь дома."
  ],
  [
    "Bugün evde kalıyorum.",
    "Ich bleibe heute zu Hause.",
    "I am staying at home today.",
    "أبقى في المنزل اليوم.",
    "Je reste à la maison aujourd'hui.",
    "Hoy me quedo en casa.",
    "Сегодня я остаюсь дома."
  ],
  [
    "Yardımına ihtiyacım var.",
    "Ich brauche deine Hilfe.",
    "I need your help.",
    "أحتاج إلى مساعدتك.",
    "J'ai besoin de ton aide.",
    "Necesito tu ayuda.",
    "Мне нужна твоя помощь."
  ],
  [
    "Film başlıyor.",
    "Der Film fängt an.",
    "The film is starting.",
    "يبدأ الفيلم.",
    "Le film commence.",
    "La película empieza.",
    "Фильм начинается."
  ],
  [
    "Bu kelime ne anlama geliyor?",
    "Was bedeutet dieses Wort?",
    "What does this word mean?",
    "ماذا تعني هذه الكلمة؟",
    "Que signifie ce mot ?",
    "¿Qué significa esta palabra?",
    "Что означает это слово?"
  ],
  [
    "Buraya park edebilir miyim?",
    "Darf ich hier parken?",
    "May I park here?",
    "هل يمكنني ركن السيارة هنا؟",
    "Puis-je me garer ici ?",
    "¿Puedo aparcar aquí?",
    "Можно здесь припарковаться?"
  ],
  [
    "Bugün daha iyiyim.",
    "Mir geht es heute besser.",
    "I am feeling better today.",
    "أشعر بتحسن اليوم.",
    "Je me sens mieux aujourd'hui.",
    "Hoy me siento mejor.",
    "Сегодня мне лучше."
  ],
  [
    "Sınav çok basitti.",
    "Die Prüfung war sehr einfach.",
    "The exam was very easy.",
    "كان الامتحان سهلاً جداً.",
    "L'examen était très facile.",
    "El examen fue muy fácil.",
    "Экзамен был очень лёгким."
  ],
  [
    "Ben de geliyorum.",
    "Ich komme auch.",
    "I am coming too.",
    "أنا قادم أيضاً.",
    "Je viens aussi.",
    "Yo también voy.",
    "Я тоже иду."
  ],
  [
    "Seni çok seviyorum.",
    "Ich liebe dich sehr.",
    "I love you very much.",
    "أحبك كثيراً.",
    "Je t'aime beaucoup.",
    "Te quiero mucho.",
    "Я тебя очень люблю."
  ],
  [
    "Sana kitabı veriyorum.",
    "Ich gebe dir das Buch.",
    "I am giving you the book.",
    "أعطيك الكتاب.",
    "Je te donne le livre.",
    "Te doy el libro.",
    "Я даю тебе книгу."
  ],
  [
    "Size kuralı açıklıyorum.",
    "Ich erkläre euch die Regel.",
    "I am explaining the rule to you.",
    "أشرح لكم القاعدة.",
    "Je vous explique la règle.",
    "Os explico la regla.",
    "Я объясняю вам правило."
  ],
  [
    "Yarın görüşürüz.",
    "Bis morgen.",
    "See you tomorrow.",
    "أراك غداً.",
    "À demain.",
    "Hasta mañana.",
    "До завтра."
  ],
  [
    "Yakında görüşürüz.",
    "Wir sehen uns bald.",
    "See you soon.",
    "أراك قريباً.",
    "À bientôt.",
    "Hasta pronto.",
    "До скорого."
  ],
  [
    "Yardım için teşekkürler.",
    "Danke für die Hilfe.",
    "Thank you for the help.",
    "شكراً على المساعدة.",
    "Merci pour l'aide.",
    "Gracias por la ayuda.",
    "Спасибо за помощь."
  ],
  [
    "Lütfen bana yardım et.",
    "Bitte hilf mir.",
    "Please help me.",
    "من فضلك ساعدني.",
    "Aide-moi, s'il te plaît.",
    "Por favor, ayúdame.",
    "Пожалуйста, помоги мне."
  ],
  [
    "Nerede yaşıyorsun?",
    "Wo wohnst du?",
    "Where do you live?",
    "أين تسكن؟",
    "Où habites-tu ?",
    "¿Dónde vives?",
    "Где ты живёшь?"
  ],
  [
    "Adın ne?",
    "Wie heißt du?",
    "What is your name?",
    "ما اسمك؟",
    "Comment t'appelles-tu ?",
    "¿Cómo te llamas?",
    "Как тебя зовут?"
  ],
  [
    "Saat kaç?",
    "Wie spät ist es?",
    "What time is it?",
    "كم الساعة؟",
    "Quelle heure est-il ?",
    "¿Qué hora es?",
    "Который час?"
  ],
  [
    "Bugün hava güzel.",
    "Das Wetter ist heute schön.",
    "The weather is nice today.",
    "الطقس جميل اليوم.",
    "Il fait beau aujourd'hui.",
    "Hoy hace buen tiempo.",
    "Сегодня хорошая погода."
  ],
  [
    "Bu çok pahalı.",
    "Das ist sehr teuer.",
    "This is very expensive.",
    "هذا غالٍ جداً.",
    "C'est très cher.",
    "Esto es muy caro.",
    "Это очень дорого."
  ],
  [
    "Bunu anlamıyorum.",
    "Ich verstehe das nicht.",
    "I do not understand this.",
    "لا أفهم هذا.",
    "Je ne comprends pas cela.",
    "No entiendo esto.",
    "Я этого не понимаю."
  ],
  [
    "Biraz su istiyorum.",
    "Ich möchte etwas Wasser.",
    "I would like some water.",
    "أريد بعض الماء.",
    "Je voudrais de l'eau.",
    "Quisiera un poco de agua.",
    "Я хочу немного воды."
  ],
  [
    "Bu bir okul.",
    "Das ist eine Schule.",
    "This is a school.",
    "هذه مدرسة.",
    "C'est une école.",
    "Esto es una escuela.",
    "Это школа."
  ],
  [
    "Telefonum yeni.",
    "Mein Telefon ist neu.",
    "My phone is new.",
    "هاتفي جديد.",
    "Mon téléphone est neuf.",
    "Mi teléfono es nuevo.",
    "Мой телефон новый."
  ],
  [
    "Yeni bir akıllı telefon aldım.",
    "Ich habe ein neues Smartphone gekauft.",
    "I bought a new smartphone.",
    "اشتريت هاتفاً ذكياً جديداً.",
    "J'ai acheté un nouveau smartphone.",
    "Compré un teléfono inteligente nuevo.",
    "Я купил новый смартфон."
  ],
  [
    "Bu kalem seninki.",
    "Dieser Stift gehört dir.",
    "This pen is yours.",
    "هذا القلم لك.",
    "Ce stylo est à toi.",
    "Este bolígrafo es tuyo.",
    "Эта ручка твоя."
  ],
  [
    "Bu çanta onunki.",
    "Diese Tasche gehört ihr.",
    "This bag is hers.",
    "هذه الحقيبة لها.",
    "Ce sac est à elle.",
    "Este bolso es suyo (de ella).",
    "Эта сумка её."
  ],
  [
    "Bu ev bizimki.",
    "Dieses Haus gehört uns.",
    "This house is ours.",
    "هذا البيت لنا.",
    "Cette maison est à nous.",
    "Esta casa es nuestra.",
    "Этот дом наш."
  ],
  [
    "Bu araba onlarınki.",
    "Dieses Auto gehört ihnen.",
    "This car is theirs.",
    "هذه السيارة لهم.",
    "Cette voiture est à eux.",
    "Este coche es de ellos.",
    "Эта машина их."
  ],
  [
    "Siz çok naziksiniz.",
    "Sie sind sehr freundlich.",
    "You are very kind.",
    "أنت لطيف جداً.",
    "Vous êtes très aimable.",
    "Usted es muy amable.",
    "Вы очень добры."
  ],
  [
    "Biz Berlin'de oturuyoruz.",
    "Wir wohnen in Berlin.",
    "We live in Berlin.",
    "نحن نسكن في برلين.",
    "Nous habitons à Berlin.",
    "Vivimos en Berlín.",
    "Мы живём в Берлине."
  ],
  [
    "O Berlin'den geliyor.",
    "Er kommt aus Berlin.",
    "He comes from Berlin.",
    "هو قادم من برلين.",
    "Il vient de Berlin.",
    "Él viene de Berlín.",
    "Он из Берлина."
  ],
  [
    "O Münih'te yaşıyor.",
    "Sie wohnt in München.",
    "She lives in Munich.",
    "هي تعيش في ميونخ.",
    "Elle habite à Munich.",
    "Ella vive en Múnich.",
    "Она живёт в Мюнхене."
  ],
  [
    "Bugün yağmur yağıyor.",
    "Es regnet heute.",
    "It is raining today.",
    "إنها تمطر اليوم.",
    "Il pleut aujourd'hui.",
    "Hoy está lloviendo.",
    "Сегодня идёт дождь."
  ],
  [
    "Siz benim arkadaşlarımsınız.",
    "Ihr seid meine Freunde.",
    "You are my friends.",
    "أنتم أصدقائي.",
    "Vous êtes mes amis.",
    "Sois mis amigos.",
    "Вы мои друзья."
  ],
  [
    "Erkek kardeşinin adı ne?",
    "Wie heißt dein Bruder?",
    "What is your brother's name?",
    "ما اسم أخيك؟",
    "Comment s'appelle ton frère ?",
    "¿Cómo se llama tu hermano?",
    "Как зовут твоего брата?"
  ],
  [
    "O beni görmüyor.",
    "Er sieht mich nicht.",
    "He does not see me.",
    "هو لا يراني.",
    "Il ne me voit pas.",
    "Él no me ve.",
    "Он меня не видит."
  ],
  [
    "O bana her zaman yardım eder.",
    "Er hilft mir immer.",
    "He always helps me.",
    "هو يساعدني دائماً.",
    "Il m'aide toujours.",
    "Él siempre me ayuda.",
    "Он всегда мне помогает."
  ],
  [
    "Onu her gün görüyorum.",
    "Ich sehe ihn jeden Tag.",
    "I see him every day.",
    "أراه كل يوم.",
    "Je le vois tous les jours.",
    "Lo veo todos los días.",
    "Я вижу его каждый день."
  ],
  [
    "Ona inanmıyorum.",
    "Ich glaube ihm nicht.",
    "I do not believe him.",
    "لا أصدقه.",
    "Je ne le crois pas.",
    "No le creo.",
    "Я ему не верю."
  ],
  [
    "Onu uzun zamandır tanıyorum.",
    "Ich kenne sie schon lange.",
    "I have known her for a long time.",
    "أعرفها منذ وقت طويل.",
    "Je la connais depuis longtemps.",
    "La conozco desde hace mucho tiempo.",
    "Я давно её знаю."
  ],
  [
    "Ona bir mektup yazıyorum.",
    "Ich schreibe ihr einen Brief.",
    "I am writing her a letter.",
    "أكتب لها رسالة.",
    "Je lui écris une lettre.",
    "Le escribo una carta a ella.",
    "Я пишу ей письмо."
  ],
  [
    "Onu hemen yapıyorum.",
    "Ich mache es sofort.",
    "I am doing it right away.",
    "أفعل ذلك فوراً.",
    "Je le fais tout de suite.",
    "Lo hago de inmediato.",
    "Я делаю это немедленно."
  ],
  [
    "O yarın bizi ziyaret ediyor.",
    "Sie besucht uns morgen.",
    "She is visiting us tomorrow.",
    "ستزورنا غداً.",
    "Elle nous rend visite demain.",
    "Ella nos visita mañana.",
    "Она навестит нас завтра."
  ],
  [
    "O bize şehri gösteriyor.",
    "Er zeigt uns die Stadt.",
    "He is showing us the city.",
    "هو يرينا المدينة.",
    "Il nous montre la ville.",
    "Él nos muestra la ciudad.",
    "Он показывает нам город."
  ],
  [
    "Sizi daha sonra görürüm.",
    "Ich sehe euch später.",
    "I will see you later.",
    "أراكم لاحقاً.",
    "Je vous verrai plus tard.",
    "Os veré más tarde.",
    "Я увижу вас позже."
  ],
  [
    "Onları yarın ararım.",
    "Ich rufe sie morgen an.",
    "I will call them tomorrow.",
    "سأتصل بهم غداً.",
    "Je les appellerai demain.",
    "Los llamaré mañana.",
    "Я позвоню им завтра."
  ],
  [
    "Yardımları için onlara teşekkür ederim.",
    "Ich danke ihnen für die Hilfe.",
    "I thank them for their help.",
    "أشكرهم على مساعدتهم.",
    "Je les remercie pour leur aide.",
    "Les agradezco su ayuda.",
    "Я благодарю их за помощь."
  ],
  [
    "Karnım ağrıyor.",
    "Mein Bauch tut weh.",
    "My stomach hurts.",
    "بطني يؤلمني.",
    "J'ai mal au ventre.",
    "Me duele la barriga.",
    "У меня болит живот."
  ],
  [
    "Adresin nedir?",
    "Wie ist deine Adresse?",
    "What is your address?",
    "ما عنوانك؟",
    "Quelle est ton adresse ?",
    "¿Cuál es tu dirección?",
    "Какой у тебя адрес?"
  ],
  [
    "Bir cevaba ihtiyacım var.",
    "Ich brauche eine Antwort.",
    "I need an answer.",
    "أحتاج إلى إجابة.",
    "J'ai besoin d'une réponse.",
    "Necesito una respuesta.",
    "Мне нужен ответ."
  ],
  [
    "Doktora gitmeliyim.",
    "Ich muss zum Arzt.",
    "I must go to the doctor.",
    "يجب أن أذهب إلى الطبيب.",
    "Je dois aller chez le médecin.",
    "Debo ir al médico.",
    "Мне нужно пойти к врачу."
  ],
  [
    "Bu benim görevim.",
    "Das ist meine Aufgabe.",
    "This is my task.",
    "هذه مهمتي.",
    "C'est ma tâche.",
    "Esta es mi tarea.",
    "Это моя задача."
  ],
  [
    "Mesleğin nedir?",
    "Was ist dein Beruf?",
    "What is your profession?",
    "ما مهنتك؟",
    "Quelle est ta profession ?",
    "¿Cuál es tu profesión?",
    "Какая у тебя профессия?"
  ],
  [
    "Şimdi yatağa gidiyorum.",
    "Ich gehe jetzt ins Bett.",
    "I am going to bed now.",
    "سأذهب إلى الفراش الآن.",
    "Je vais me coucher maintenant.",
    "Ahora me voy a la cama.",
    "Сейчас я иду спать."
  ],
  [
    "Annem yemek yapmayı sever.",
    "Meine Mutter kocht gern.",
    "My mother likes cooking.",
    "أمي تحب الطبخ.",
    "Ma mère aime cuisiner.",
    "A mi madre le gusta cocinar.",
    "Моя мама любит готовить."
  ],
  [
    "Babam çok çalışır.",
    "Mein Vater arbeitet viel.",
    "My father works a lot.",
    "أبي يعمل كثيراً.",
    "Mon père travaille beaucoup.",
    "Mi padre trabaja mucho.",
    "Мой отец много работает."
  ],
  [
    "Çocuk dışarıda oynuyor.",
    "Das Kind spielt draußen.",
    "The child is playing outside.",
    "الطفل يلعب في الخارج.",
    "L'enfant joue dehors.",
    "El niño juega afuera.",
    "Ребёнок играет на улице."
  ],
  [
    "Erkek kardeşim daha büyük.",
    "Mein Bruder ist älter.",
    "My brother is older.",
    "أخي أكبر سناً.",
    "Mon frère est plus âgé.",
    "Mi hermano es mayor.",
    "Мой брат старше."
  ],
  [
    "Bugün güzel bir gün.",
    "Heute ist ein guter Tag.",
    "Today is a good day.",
    "اليوم يوم جميل.",
    "Aujourd'hui est une belle journée.",
    "Hoy es un buen día.",
    "Сегодня хороший день."
  ]
];
root.LUMIRA_PARALLEL_EXAMPLES={languages,rows};
})(typeof window!=="undefined"?window:globalThis);
