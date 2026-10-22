import {validateStory} from './story-core.mjs';
// Reviewed, aligned mini-dialogues. Every source token still passes the same
// learned-word validator; these are a fallback, not permission to add words.
const lines={
 morning:{tr:'Günaydın!',de:'Guten Morgen!',en:'Good morning!',ar:'صباح الخير!',fr:'Bonjour !',es:'¡Buenos días!',ru:'Доброе утро!'},
 hello:{tr:'Merhaba!',de:'Hallo!',en:'Hello!',ar:'مرحبا!',fr:'Bonjour !',es:'¡Hola!',ru:'Здравствуйте!'},
 how:{tr:'Nasılsın?',de:'Wie geht es dir?',en:'How are you?',ar:'كيف حالك؟',fr:'Comment vas-tu ?',es:'¿Cómo estás?',ru:'Как дела?'},
 fine:{tr:'İyiyim, teşekkür ederim.',de:'Mir geht es gut, danke.',en:'I am fine, thank you.',ar:'أنا بخير، شكرا.',fr:'Je vais bien, merci.',es:'Estoy bien, gracias.',ru:'Хорошо, спасибо.'},
 afternoon:{tr:'İyi günler!',de:'Guten Tag!',en:'Good afternoon!',ar:'مساء الخير!',fr:'Bon après-midi !',es:'¡Buenas tardes!',ru:'Добрый день!'},
 soon:{tr:'Yakında görüşürüz!',de:'Bis bald!',en:'See you soon!',ar:'إلى اللقاء قريبا!',fr:'À bientôt !',es:'¡Hasta luego!',ru:'До свидания!'},
 thanks:{tr:'Teşekkürler!',de:'Danke!',en:'Thank you!',ar:'شكرا!',fr:'Merci !',es:'¡Gracias!',ru:'Спасибо!'},
 family:{tr:'Aile: anne, baba, çocuk.',de:'Die Familie: die Mutter, der Vater, das Kind.',en:'The family: the mother, the father, the child.',ar:'العائلة: الأم، الأب، الطفل.',fr:'La famille : la mère, le père, l’enfant.',es:'La familia: la madre, el padre, el niño.',ru:'Семья: мать, отец, ребёнок.'},
 breakfast:{tr:'Ekmek, su, elma.',de:'Das Brot, das Wasser, der Apfel.',en:'Bread, water, an apple.',ar:'خبز، ماء، تفاحة.',fr:'Du pain, de l’eau, une pomme.',es:'Pan, agua, una manzana.',ru:'Хлеб, вода, яблоко.'},
 myFamily:{tr:'Ailem: annem, babam, kız kardeşim.',de:'Meine Familie: meine Mutter, mein Vater, meine Schwester.',en:'My family: my mother, my father, my sister.',ar:'عائلتي: أمي، أبي، أختي.',fr:'Ma famille : ma mère, mon père, ma sœur.',es:'Mi familia: mi madre, mi padre, mi hermana.',ru:'Моя семья: моя мама, мой папа, моя сестра.'},
 pleaseFood:{tr:'Ekmek, lütfen! Su, lütfen!',de:'Brot, bitte! Wasser, bitte!',en:'Bread, please! Water, please!',ar:'خبز، من فضلك! ماء، من فضلك!',fr:'Du pain, s’il vous plaît ! De l’eau, s’il vous plaît !',es:'¡Pan, por favor! ¡Agua, por favor!',ru:'Хлеб, пожалуйста! Вода, пожалуйста!'},
 familyReply:{tr:'Aile: baba, ben, sen.',de:'Eine Familie: Vater, ich, du.',en:'A family: father, me, you.',ar:'عائلة: أب، أنا، أنت.',fr:'Une famille : papa, moi, toi.',es:'Una familia: papá, yo, tú.',ru:'Семья: папа, я, ты.'},
 food:{tr:'Ekmek, su.',de:'Brot, Wasser.',en:'Bread, water.',ar:'خبز، ماء.',fr:'Du pain, de l’eau.',es:'Pan, agua.',ru:'Хлеб, вода.'}
};
const scenes={
 de:[['morning','hello','family','breakfast','thanks']],
 en:[['hello','myFamily','pleaseFood','thanks']],
 ar:[['hello','familyReply','food','thanks']],
 tr:[['hello','family','breakfast','thanks']],
 fr:[['hello','how','fine','afternoon','soon']],
 es:[['hello','how','fine','afternoon','soon']],
 ru:[['hello','how','fine','afternoon','soon']]
};
export function knownStory(pool,options){
 for(const sequence of scenes[options.language]||[]){
  const data={title:null,sentences:sequence.map(key=>({text:lines[key][options.language],translation:lines[key][options.native]}))};
  try{return {...validateStory(data,pool,options),provider:'guided',format:'dialogue'};}catch{}
 }
 return null;
}
