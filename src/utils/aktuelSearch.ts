import type { AktuelCategory, AktuelProduct } from '../mcp/types';

export function normalizeTr(raw: string): string {
  return raw
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s."/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeNormalized(text: string): string[] {
  return text
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

// Common Turkish informal spellings & joined/spaced equivalents
const TOKEN_CANONICAL_MAP: Record<string, string> = {
  makinasi: 'makinesi',
  makineleri: 'makinesi',
  makinalari: 'makinesi',
  sarz: 'sarj',
  sarzli: 'sarjli',
  ketil: 'kettle',
  kettl: 'kettle',
  eyirfrayir: 'airfryer',
  eyirfrayer: 'airfryer',
  blutut: 'bluetooth',
  bluetoot: 'bluetooth',
  bluetoth: 'bluetooth',
  kablolusuz: 'kablosuz',
  dudklu: 'duduklu',
  nofrost: 'no frost',
  airfryer: 'airfryer',
  powerbank: 'powerbank',
  smartwatch: 'smartwatch',
  suisitici: 'su isitici',
  suisiticisi: 'su isitici',
  caymakinesi: 'cay makinesi',
  caymakinasi: 'cay makinesi',
  kahvemakinesi: 'kahve makinesi',
  kahvemakinasi: 'kahve makinesi',
  tostmakinesi: 'tost makinesi',
  tostmakinasi: 'tost makinesi',
  camasirmakinesi: 'camasir makinesi',
  bulasikmakinesi: 'bulasik makinesi',
  dikeysupurge: 'dikey supurge',
  robotsupurge: 'robot supurge',
  akillisaat: 'akilli saat',
  buharliutu: 'buharli utu',
  typec: 'type c',
  usbc: 'usb c',
  tshirt: 'tisort',
};

const QUERY_STOP_TOKENS = new Set([
  'var',
  'mi',
  'mu',
  'fiyat',
  'fiyati',
  'fiyatlari',
  'ne',
  'kadar',
  'kac',
  'tl',
  'en',
  'ucuz',
  'aktuel',
  'aktuelde',
  'kampanya',
  'indirim',
  'urun',
  'urunleri',
]);

// Known short Turkish words that undergo vowel/consonant endings
const SHORT_STEM_OVERRIDES: Record<string, string> = {
  utusu: 'utu',
  utuler: 'utu',
  utuleri: 'utu',
  sutlu: 'sut',
  sutu: 'sut',
  cayi: 'cay',
  caylar: 'cay',
  yagi: 'yag',
  yaglar: 'yag',
  tuzu: 'tuz',
  tava: 'tava',
  tavalari: 'tava',
  tavasi: 'tava',
  saati: 'saat',
  saatler: 'saat',
  saatleri: 'saat',
};

export function getTokenStemCandidates(token: string): string[] {
  const candidates = new Set<string>([token]);
  const mapped = TOKEN_CANONICAL_MAP[token];
  if (mapped && !mapped.includes(' ')) {
    candidates.add(mapped);
  }
  const override = SHORT_STEM_OVERRIDES[token];
  if (override) {
    candidates.add(override);
  }

  if (token.length < 5) {
    return [...candidates];
  }

  // Never strip privative -siz/-suz so "kablosuz" never matches "kablo" and "yagsiz" never matches "yag"
  if (token.endsWith('siz') || token.endsWith('suz')) {
    return [...candidates];
  }

  let base = token;

  // Preserve -ci/-cu root before possessive -si/-su: isiticisi -> isitici, sogutucusu -> sogutucu
  if (/(ci|cu)(si|su)$/.test(base)) {
    const stemCi = base.replace(/(ci|cu)(si|su)$/, '$1');
    if (stemCi.length >= 4) {
      candidates.add(stemCi);
      base = stemCi;
    }
  }

  // Strip plural + possessive tails
  const tailPatterns = [
    /(lari|leri)$/,
    /(lar|ler)$/,
    /(sini|sinin|sina|sinda|sunu|sunun)$/,
    /(ini|inin|ina|inda|unu|unun)$/,
  ];

  for (const re of tailPatterns) {
    if (re.test(base)) {
      const stripped = base.replace(re, '');
      if (stripped.length >= 4) {
        candidates.add(stripped);
        base = stripped;
        break;
      }
    }
  }

  // Reverse Turkish consonant softening: bardagi -> bardak, bicagi -> bicak, dolabi -> dolap, kabi -> kap
  const softenPairs: Array<[RegExp, string]> = [
    [/(ag)(i|u|a)$/, 'ak'],
    [/(eg)(i|e)$/, 'ek'],
    [/(ig)(i)$/, 'ik'],
    [/(og|ug)(u)$/, 'ok'],
    [/(ab)(i|a)$/, 'ap'],
    [/(eb)(i|e)$/, 'ep'],
  ];
  for (const [re, rep] of softenPairs) {
    if (re.test(token)) {
      const hardened = token.replace(re, rep);
      if (hardened.length >= 3) {
        candidates.add(hardened);
      }
    }
  }

  // Strip common single possessive/accusative vowel endings (-si/-su/-i/-u)
  if (base.length >= 6 && /(si|su|yi|yu|ni|nu)$/.test(base)) {
    const s = base.slice(0, -2);
    if (s.length >= 4) candidates.add(s);
  } else if (base.length >= 5 && /(i|u|a|e)$/.test(base) && !/(makine|supurge|tencere|testere|sepeti|unitesi)/.test(base)) {
    const s = base.slice(0, -1);
    if (s.length >= 4) candidates.add(s);
  }

  if (base.endsWith('makinasi')) {
    candidates.add(base.replace(/makinasi$/, 'makinesi'));
  }

  return [...candidates];
}

export function canonicalizePhrase(norm: string): string {
  if (!norm) return '';
  const tokens = norm.split(/\s+/).filter(Boolean);
  const rewritten = tokens.map((tok) => TOKEN_CANONICAL_MAP[tok] ?? tok);
  return rewritten.join(' ').replace(/\s+/g, ' ').trim();
}

export const SYNONYM_GROUPS: string[][] = [
  // Su ısıtıcı & çay-kahve
  ['kettle', 'ketil', 'su isitici', 'su isiticisi', 'elektrikli su isitici', 'su kaynatici'],
  ['cay makinesi', 'cay makinasi', 'cayci', 'semaver', 'elektrikli caydanlik', 'cay otomati'],
  ['caydanlik', 'celik caydanlik', 'emaye caydanlik', 'demlik'],
  [
    'kahve makinesi',
    'kahve makinasi',
    'turk kahvesi makinesi',
    'turk kahve makinesi',
    'filtre kahve makinesi',
    'espresso makinesi',
    'kapsul kahve makinesi',
    'elektrikli cezve',
  ],
  ['cezve', 'celik cezve', 'granit cezve'],
  ['filtre kahve', 'kapsul kahve', 'granul kahve', 'cekirdek kahve', 'hazir kahve'],

  // Küçük mutfak aletleri & pişiriciler
  ['airfryer', 'air fryer', 'yagsiz fritoz', 'sicak hava fritozu', 'hava fritozu', 'fritoz'],
  [
    'blender',
    'el blenderi',
    'cubuk blender',
    'multi blender',
    'blender seti',
    'smoothie blender',
    'kisisel blender',
    'mikser',
    'dograyici',
    'mutfak robotu',
    'parcalayici',
  ],
  ['tost makinesi', 'tost makinasi', 'izgara tost', 'tost izgara', 'waffle makinesi', 'waffle makinasi'],
  ['ekmek kizartma', 'toaster', 'ekmek kizartma makinesi'],
  ['kiyma makinesi', 'kiyma makinasi', 'et cekme makinesi'],
  ['meyve sikacagi', 'narenciye sikacagi', 'kati meyve sikacagi', 'portakal sikacagi'],
  ['mikrodalga', 'mikrodalga firin', 'mini firin', 'midi firin', 'ankastre firin', 'firin'],
  ['ocak', 'set ustu ocak', 'elektrikli ocak', 'ankastre ocak'],
  ['davlumbaz', 'aspirator'],
  ['mutfak tartisi', 'dijital terazi', 'hassas terazi'],

  // Tencere, tava, termos & sofra
  ['tava', 'granit tava', 'teflon tava', 'dokum tava', 'krep tavasi', 'sahan', 'wok', 'pankek tavasi'],
  [
    'tencere',
    'celik tencere',
    'duduklu tencere',
    'karniyarik tenceresi',
    'derin tencere',
    'emaye tencere',
    'granit tencere',
    'dokum tencere',
  ],
  ['duduklu', 'duduklu tencere', 'basinc tenceresi'],
  ['termos', 'matara', 'suluk', 'celik termos', 'termos mug', 'kupa termos', 'yemek termosu'],
  ['bardak', 'su bardagi', 'mesrubat bardagi', 'cay bardagi'],
  ['kupa', 'fincan', 'kahve fincani', 'fincan takimi', 'mug'],
  ['surahi', 'karaf', 'su sisesi', 'cam sise'],
  ['yemek takimi', 'tabak', 'servis tabagi', 'pasta tabagi', 'kase', 'kahvalti takimi'],
  ['catal kasik', 'catal kasik bicak', 'kasik seti'],
  ['bicak', 'sef bicagi', 'bicak seti', 'soyucu', 'rende', 'kesme tahtasi', 'dograma tahtasi'],
  ['saklama kabi', 'erzak kabi', 'kilitli saklama kabi', 'kahvaltilik', 'kavanoz', 'cam kavanoz'],
  ['tepsi', 'servis tepsisi', 'firin tepsisi', 'borcam'],
  ['suzgec', 'pirinc suzgeci', 'makarna suzgeci', 'kevgir', 'kepce', 'spatula'],

  // Elektronik, TV, bilgisayar, ses, mobil
  ['tv', 'televizyon', 'qled', 'oled', 'smart tv', 'led tv', 'uhd tv', 'android tv', 'google tv', 'webos tv', '4k tv'],
  ['monitor', 'oyuncu monitoru', 'ips monitor', 'bilgisayar monitoru', 'ekran'],
  ['kulaklik', 'kulak ici kulaklik', 'oyuncu kulakligi', 'tws', 'earbuds', 'headset'],
  ['kablosuz kulaklik', 'bluetooth kulaklik', 'tws', 'earbuds'],
  ['powerbank', 'power bank', 'tasinabilir sarj', 'yedek batarya'],
  ['sarj aleti', 'sarj adaptoru', 'hizli sarj', 'sarj kablosu', 'type c', 'usb kablo', 'data kablosu'],
  ['hoparlor', 'bluetooth hoparlor', 'speaker', 'ses bombasi', 'soundbar'],
  ['akilli saat', 'smartwatch', 'smart watch', 'akilli bileklik', 'spor saati'],
  ['laptop', 'notebook', 'dizustu', 'dizustu bilgisayar', 'bilgisayar'],
  ['tablet', 'ipad', 'android tablet'],
  ['cep telefonu', 'akilli telefon', 'smartphone', 'telefon'],
  ['mouse', 'fare', 'oyuncu mouse', 'oyuncu faresi'],
  ['kablosuz mouse', 'kablosuz fare', 'bluetooth mouse', 'bluetooth fare'],
  ['klavye', 'kablosuz klavye', 'oyuncu klavyesi', 'mekanik klavye'],
  ['uzatma kablosu', 'coklu priz', 'akim korumali priz', 'grup priz', 'priz'],
  ['wifi guclendirici', 'menzil genisletici', 'router', 'modem', 'access point'],
  ['yazici', 'printer', 'tarayici'],
  ['kamera', 'guvenlik kamerasi', 'ip kamera', 'bebek kamerasi', 'aksiyon kamerasi'],

  // Beyaz eşya & iklimlendirme
  ['buzdolabi', 'nofrost', 'no frost', 'mini buzdolabi', 'buro tipi buzdolabi'],
  ['derin dondurucu', 'dondurucu', 'sandik tipi dondurucu', 'cekmeceli dondurucu'],
  ['camasir makinesi', 'camasir makinasi'],
  ['bulasik makinesi', 'bulasik makinasi'],
  ['kurutma makinesi', 'kurutma makinasi', 'camasir kurutma', 'camasir kurutma makinesi'],
  ['klima', 'inverter klima', 'mobil klima', 'portatif klima'],
  ['vantilator', 'ayakli vantilator', 'masa vantilatoru', 'kule tipi vantilator', 'hava sogutucu', 'serinletici'],
  ['isitici', 'fanli isitici', 'quartz isitici', 'konvektor', 'soba', 'radyator', 'yagli radyator', 'elektrikli soba'],
  ['hava nemlendirici', 'hava temizleyici', 'buhar makinesi'],

  // Süpürge, ütü, temizlik, kişisel bakım
  [
    'supurge',
    'dikey supurge',
    'dik supurge',
    'robot supurge',
    'sarjli supurge',
    'elektrikli supurge',
    'toz torbasiz supurge',
    'islak kuru supurge',
  ],
  ['hali yikama', 'koltuk yikama', 'leke cikarma makinesi'],
  ['buharli temizleyici', 'buharli mop', 'buharli paspas', 'buharli temizlik'],
  ['utu', 'buharli utu', 'buhar kazanli utu', 'dikey utu', 'kirisik giderici'],
  ['utu masasi', 'utu tahtasi'],
  ['mop', 'paspas', 'temizlik seti', 'tablet mop', 'sprey mop', 'vilada', 'kovali paspas'],
  ['cam silici', 'cam silme', 'cekpas', 'mikrofiber bez'],
  ['sac kurutma', 'sac kurutma makinesi', 'fon makinesi', 'sac sekillendirici', 'sac duzlestirici', 'sac masasi'],
  ['tiras makinesi', 'tiras makinasi', 'sakal kesme', 'sac kesme', 'sac sakal kesme', 'epilator', 'ipl'],
  ['elektrikli dis fircasi', 'sarjli dis fircasi', 'agiz dusu'],
  ['baskul', 'vucut analiz tartisi', 'akilli tarti', 'dijital baskul'],

  // Ev yaşam, mobilya, tekstil, aydınlatma
  ['koltuk', 'kanepe', 'cekyat', 'yatakli koltuk', 'berjer', 'puf', 'tekli koltuk'],
  ['koltuk ortusu', 'kanepe ortusu', 'cekyat ortusu'],
  ['sehpa', 'zigon sehpa', 'orta sehpa', 'yan sehpa', 'c sehpa'],
  ['dolap', 'gardrop', 'gardirop', 'cok amacli dolap', 'vestiyer', 'portmanto', 'ayakkabilik', 'kitaplik', 'sifonyer', 'komodin'],
  ['tv unitesi', 'televizyon unitesi', 'tv sehpasi'],
  ['calisma masasi', 'bilgisayar masasi', 'ofis masasi', 'oyuncu masasi'],
  ['calisma koltugu', 'ofis koltugu', 'oyuncu koltugu', 'ofis sandalyesi'],
  ['nevresim', 'nevresim takimi', 'carsaf', 'lastikli carsaf', 'pike', 'yastik kilifi'],
  ['yorgan', 'battaniye', 'yatak ortusu', 'polar battaniye', 'wellsoft battaniye', 'wellsoft yorgan'],
  ['yastik', 'ortopedik yastik', 'visco yastik', 'silikon yastik', 'mikrojel yastik'],
  ['hali', 'kilim', 'yolluk', 'pelus hali', 'kaymaz taban hali'],
  ['bornoz', 'havlu', 'banyo havlusu', 'el havlusu', 'yuz havlusu', 'plaj havlusu'],
  ['hurc', 'vakumlu poset', 'organizer', 'duzenleyici', 'sepet', 'camasir sepeti', 'kirli sepeti'],
  ['camasir kurutmalik', 'kurutmalik', 'kurutma askiligi'],
  ['avize', 'lambader', 'abajur', 'masa lambasi', 'gece lambasi', 'ampul', 'akilli ampul', 'led ampul'],
  ['valiz', 'bavul', 'kabin boy valiz', 'orta boy valiz', 'buyuk boy valiz'],

  // Yapı, tamirat, oto
  ['matkap', 'sarjli matkap', 'darbeli matkap', 'akulu vidalama', 'vidalama'],
  ['testere', 'daire testere', 'dekupaj', 'zincirli testere', 'tilki kuyrugu'],
  ['takim cantasi', 'alet seti', 'tamir seti', 'el aletleri', 'lokma takimi'],
  ['avuc taslama', 'spiral', 'taslama', 'zimpara'],
  ['kompresor', 'hava pompasi', 'lastik sisirme'],
  ['basincli yikama', 'basinc yikama', 'oto yikama makinesi'],
  ['arac supurgesi', 'oto supurge', 'araba supurgesi', 'sarjli arac supurgesi'],
  ['arac kamerasi', 'dashcam', 'arac ici kamera'],
  ['silikon tabancasi', 'sicak silikon', 'havya', 'lehim'],
  ['merdiven', 'katlanir merdiven', 'aluminyum merdiven', 'basamak'],
  ['kasa', 'para kasasi', 'celik kasa', 'elektronik kasa', 'sifreli kasa'],
  ['hortum', 'bahce hortumu', 'sulama tabancasi'],

  // Kamp, spor, oyuncak, giyim
  ['cadir', 'kamp cadiri', 'otomatik cadir'],
  ['kamp sandalyesi', 'katlanir sandalye', 'plaj sandalyesi', 'piknik sandalyesi'],
  ['uyku tulumu', 'kamp mati', 'sisme yatak', 'sisme mat'],
  ['fener', 'el feneri', 'kafa lambasi', 'kamp lambasi', 'isildak', 'solar lamba'],
  ['mangal', 'barbeku'],
  ['piknik sepeti', 'buzluk', 'termos canta', 'sogutucu canta'],
  ['scooter', 'elektrikli scooter', 'cocuk scooter'],
  ['bisiklet', 'dag bisikleti', 'sehir bisikleti', 'katlanir bisiklet', 'cocuk bisikleti'],
  ['pilates', 'yoga mati', 'dambil', 'agirlik', 'egzersiz', 'barfiks'],
  ['oyuncak', 'pelus', 'figur', 'lego', 'yapboz', 'puzzle', 'uzaktan kumandali', 'kutu oyunu'],
  ['ayakkabi', 'spor ayakkabi', 'sneaker', 'bot', 'cizme', 'terlik', 'ev terligi'],
  ['mont', 'kaban', 'parka', 'sisme mont', 'ceket', 'yelek', 'polar'],
  ['pijama', 'pijama takimi', 'esofman', 'esofman takimi', 'tayt'],

  // Sık aranan temel gıda & temizlik sarf
  ['zeytinyagi', 'sizma zeytinyagi', 'riviera zeytinyagi'],
  ['aycicek yagi', 'sivi yag', 'misir yagi'],
  ['tereyagi', 'tereyag'],
  ['deterjan', 'camasir deterjani', 'sivi deterjan', 'bulasik tableti', 'bulasik kapsulu', 'toz deterjan'],
  ['tuvalet kagidi', 'kagit havlu', 'pecete'],
  ['islak havlu', 'islak mendil', 'islak temizlik mendili', 'cep mendili'],
  ['bebek bezi', 'cocuk bezi', 'kulot bez'],
  ['kedi mamasi', 'kopek mamasi', 'yas mama', 'kuru mama', 'kedi kumu'],
];

export function damerauLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  if (Math.abs(m - n) > 3) return Math.abs(m - n);

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let val = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        val = Math.min(val, dp[i - 2][j - 2] + cost);
      }
      dp[i][j] = val;
    }
  }
  return dp[m][n];
}

function maxFuzzyEditsForLength(len: number): number {
  if (len <= 3) return 0;
  if (len <= 7) return 1;
  return 2;
}

function isFuzzyTokenMatch(a: string, b: string, maxEdits: number): number {
  if (maxEdits <= 0 || a.length < 4 || b.length < 4) return 0;
  const dist = damerauLevenshtein(a, b);
  if (dist === 0 || dist > maxEdits) return 0;
  if ((dist >= 2 || a.length <= 5 || b.length <= 5) && a[0] !== b[0]) return 0;
  return dist;
}

function buildStemmedPhrase(norm: string): string {
  const tokens = norm.split(/\s+/).filter(Boolean);
  return tokens
    .map((tok) => {
      const stems = getTokenStemCandidates(tok);
      // Prefer the shortest meaningful stem >= 4 chars (or canonical mapped)
      const shortest = stems.reduce((best, cur) =>
        cur.length >= 4 && cur.length < best.length ? cur : best,
      stems[0]);
      return shortest;
    })
    .join(' ');
}

function cleanQueryStopWords(norm: string): string {
  const tokens = norm.split(/\s+/).filter(Boolean);
  const kept = tokens.filter((t) => !QUERY_STOP_TOKENS.has(t));
  return kept.length > 0 ? kept.join(' ') : norm;
}

function dedupePhraseTokens(phrase: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tok of phrase.split(/\s+/).filter(Boolean)) {
    if (!seen.has(tok)) {
      seen.add(tok);
      out.push(tok);
    }
  }
  return out.join(' ');
}

export function expandSearchVariants(rawQuery: string): {
  primaryQuery: string;
  synonymQueries: string[];
  displaySynonyms: string[];
} {
  const rawNorm = normalizeTr(rawQuery);
  if (!rawNorm) return { primaryQuery: '', synonymQueries: [], displaySynonyms: [] };

  const canon = cleanQueryStopWords(canonicalizePhrase(rawNorm));
  const stemmed = buildStemmedPhrase(canon);
  const compactCanon = canon.replace(/\s+/g, '');
  const queryTokens = canon.split(/\s+/).filter(Boolean);
  const stemmedTokens = stemmed.split(/\s+/).filter(Boolean);

  const matchedGroups: Array<{
    group: string[];
    matchedTerm: string;
    matchedIn: string;
    matchKind: 'exact' | 'stem' | 'fuzzy';
    coveredTokens: Set<string>;
  }> = [];

  for (const group of SYNONYM_GROUPS) {
    let bestExact: { term: string; matchedIn: string; kind: 'exact' | 'stem' } | null = null;
    let bestFuzzy: { term: string; matchedIn: string; fuzzyTok: string } | null = null;

    for (const term of group) {
      const termEscaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const boundaryRe = new RegExp(`(?:^|\\s)${termEscaped}(?:\\s|$)`);
      const isPrefixOfSingleTerm = !term.includes(' ') && canon.length >= 5 && term.startsWith(canon);
      const compactTerm = term.replace(/\s+/g, '');
      const isCompactMatch = compactTerm.length >= 6 && compactCanon === compactTerm;

      if (canon === term || boundaryRe.test(canon) || isPrefixOfSingleTerm || isCompactMatch) {
        if (!bestExact || term.length > bestExact.term.length) {
          bestExact = { term, matchedIn: canon, kind: 'exact' };
        }
        continue;
      }

      if (stemmed !== canon && (stemmed === term || boundaryRe.test(stemmed))) {
        if (!bestExact || (bestExact.kind !== 'exact' && term.length > bestExact.term.length) || term.length > bestExact.term.length) {
          bestExact = { term, matchedIn: stemmed, kind: 'stem' };
        }
        continue;
      }

      // Fuzzy match only as fallback if no exact/stem term matched yet in this group
      if (!bestExact && !bestFuzzy) {
        if (!term.includes(' ') && term.length >= 4) {
          const maxEdits = maxFuzzyEditsForLength(term.length);
          for (const qt of [...queryTokens, ...stemmedTokens]) {
            if (isFuzzyTokenMatch(qt, term, maxEdits) > 0) {
              bestFuzzy = { term, matchedIn: canon, fuzzyTok: qt };
              break;
            }
          }
        } else if (term.includes(' ') && queryTokens.length >= 2) {
          const maxEdits = maxFuzzyEditsForLength(term.length);
          if (isFuzzyTokenMatch(canon, term, maxEdits) > 0 || isFuzzyTokenMatch(stemmed, term, maxEdits) > 0) {
            bestFuzzy = { term, matchedIn: canon, fuzzyTok: canon };
          }
        }
      }
    }

    if (bestExact) {
      matchedGroups.push({
        group,
        matchedTerm: bestExact.term,
        matchedIn: bestExact.matchedIn,
        matchKind: bestExact.kind,
        coveredTokens: new Set(bestExact.term.split(/\s+/).filter(Boolean)),
      });
    } else if (bestFuzzy) {
      matchedGroups.push({
        group,
        matchedTerm: bestFuzzy.term,
        matchedIn: bestFuzzy.matchedIn,
        matchKind: 'fuzzy',
        coveredTokens: new Set(bestFuzzy.fuzzyTok.split(/\s+/).filter(Boolean)),
      });
    }
  }

  // Collect tokens already matched exactly/by-stem so fuzzy matches on other groups (e.g. kasa -> kase) don't bleed in
  const exactCoveredTokens = new Set<string>();
  for (const entry of matchedGroups) {
    if (entry.matchKind !== 'fuzzy') {
      for (const t of entry.coveredTokens) {
        exactCoveredTokens.add(t);
      }
    }
  }

  const tokensOverlapOrStemMatch = (a: string, b: string): boolean => {
    if (a === b) return true;
    const sa = getTokenStemCandidates(a);
    const sb = getTokenStemCandidates(b);
    return sa.some((x) => sb.includes(x));
  };

  // Suppress fuzzy matches colliding with exact matches & suppress sub-phrases of longer matches
  // (e.g. "su isiticisi" must NOT trigger generic "isitici"; "tv unitesi" must NOT trigger "tv";
  // "kablosuz fare" must NOT trigger generic "fare"; "arac supurgesi" must NOT trigger generic "supurge").
  const filteredGroups = matchedGroups.filter((entry) => {
    if (entry.matchKind === 'fuzzy') {
      for (const ct of entry.coveredTokens) {
        if (exactCoveredTokens.has(ct)) return false;
      }
    }
    const entryToks = [...entry.coveredTokens];
    const subEscaped = entry.matchedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const subRe = new RegExp(`(?:^|\\s)${subEscaped}(?:\\s|$)`);
    return !matchedGroups.some((other) => {
      if (other === entry || other.matchedTerm.length <= entry.matchedTerm.length) {
        return false;
      }
      if (subRe.test(other.matchedTerm)) {
        return true;
      }
      const otherToks = [...other.coveredTokens];
      return (
        otherToks.length > entryToks.length &&
        entryToks.length > 0 &&
        entryToks.every((et) => otherToks.some((ot) => tokensOverlapOrStemMatch(et, ot)))
      );
    });
  });

  const synonymSet = new Set<string>();
  const displaySet = new Set<string>();

  for (const { group, matchedTerm, matchedIn, coveredTokens } of filteredGroups) {
    const matchedTokens = new Set([...matchedTerm.split(/\s+/).filter(Boolean), ...coveredTokens]);
    const sourceTokens = matchedIn.split(/\s+/).filter(Boolean);
    const contextTokens = sourceTokens.filter((tok) => {
      if (matchedTokens.has(tok)) return false;
      const stems = getTokenStemCandidates(tok);
      if (stems.some((st) => matchedTokens.has(st))) return false;
      for (const mt of matchedTokens) {
        if (mt.length >= 4 && tok.length >= 4 && isFuzzyTokenMatch(tok, mt, maxFuzzyEditsForLength(mt.length)) > 0) {
          return false;
        }
      }
      return true;
    });

    for (const alt of group) {
      if (alt === matchedTerm && contextTokens.length === 0 && canon === alt) {
        continue;
      }

      if (contextTokens.length > 0) {
        // Preserve user brand/material qualifiers (e.g., "samsung televizyon" -> "samsung tv", "cam su isitici" -> "cam kettle")
        const combined = dedupePhraseTokens(`${contextTokens.join(' ')} ${alt}`);
        if (combined && combined !== canon) {
          synonymSet.add(combined);
          displaySet.add(alt);
        }
      } else if (alt !== canon) {
        synonymSet.add(alt);
        displaySet.add(alt);
      }
    }
  }

  // If canonicalized query differs from raw normalized (e.g. "kahve makinası" -> "kahve makinesi"), ensure canon itself is tried as a primary-weight variant
  if (canon !== rawNorm) {
    synonymSet.delete(canon);
  }

  return {
    primaryQuery: canon,
    synonymQueries: [...synonymSet],
    displaySynonyms: [...displaySet].filter((s) => s !== canon),
  };
}

function scoreSingleTokenMatch(
  queryToken: string,
  productTokens: string[],
  allowFuzzy = true,
): number {
  const queryStems = getTokenStemCandidates(queryToken);

  if (productTokens.includes(queryToken)) {
    return 38;
  }

  // Stem match (e.g., "isiticisi" <-> "isitici", "tencereleri" <-> "tencere", "bardagi" <-> "bardak")
  for (const pt of productTokens) {
    if (queryStems.includes(pt)) {
      return 32;
    }
    const ptStems = getTokenStemCandidates(pt);
    if (queryStems.some((qs) => ptStems.includes(qs))) {
      return 30;
    }
  }

  // Safe prefix match: 4+ chars on primary query tokens, 5+ chars on synonym variants (prevents "kasa" -> "kasar")
  const queryIsNegative = queryToken.endsWith('siz') || queryToken.endsWith('suz');
  const minPrefixLen = allowFuzzy ? 4 : 5;
  if (queryToken.length >= minPrefixLen) {
    for (const pt of productTokens) {
      if (pt.startsWith(queryToken)) {
        return 22;
      }
      if (pt.length >= minPrefixLen && queryToken.startsWith(pt)) {
        const ptIsNegative = pt.endsWith('siz') || pt.endsWith('suz');
        if (!queryIsNegative || ptIsNegative) {
          return 20;
        }
      }
    }
  }

  // Compound token substring ONLY for >= 5 chars inside an actual token (e.g. "buzdolabi" in "minibuzdolabi")
  if (queryToken.length >= 5) {
    for (const pt of productTokens) {
      if (pt.includes(queryToken)) {
        return 18;
      }
    }
  }

  // Bounded fuzzy edit-distance match (e.g. "ketle" -> "kettle", "samsng" -> "samsung")
  if (allowFuzzy) {
    const maxEdits = maxFuzzyEditsForLength(queryToken.length);
    if (maxEdits > 0) {
      let bestDist = Infinity;
      for (const pt of productTokens) {
        const d = isFuzzyTokenMatch(queryToken, pt, maxEdits);
        if (d > 0 && d < bestDist) {
          bestDist = d;
        }
      }
      if (bestDist === 1) return 16;
      if (bestDist >= 2 && bestDist <= maxEdits) return 10;
    }
  }

  return 0;
}

export function scoreProductMatch(
  product: Pick<AktuelProduct, 'brand' | 'title' | 'category' | 'campaignTitle' | 'timingStatus'>,
  queryNorm: string,
  isSynonymVariant: boolean,
): number {
  const titleBrandHay = canonicalizePhrase(normalizeTr(`${product.brand} ${product.title}`));
  const categoryHay = normalizeTr(product.category).replace(/_/g, ' ');
  const coreHay = `${titleBrandHay} ${categoryHay}`.trim();
  const campaignHay = normalizeTr(product.campaignTitle);
  if (!coreHay) return 0;

  const titleBrandTokens = tokenizeNormalized(titleBrandHay);
  const categoryTokens = tokenizeNormalized(categoryHay);
  const coreTokens = [...titleBrandTokens, ...categoryTokens];
  const queryTokens = tokenizeNormalized(queryNorm);
  if (queryTokens.length === 0) return 0;

  let score = 0;

  if (titleBrandHay.includes(queryNorm)) {
    score += isSynonymVariant ? 80 : 125;
  } else if (coreHay.includes(queryNorm)) {
    score += isSynonymVariant ? 60 : 95;
  } else if (!isSynonymVariant && campaignHay.includes(queryNorm)) {
    score += 50;
  }

  let matchedTokens = 0;
  let tokenScoreSum = 0;

  for (const qt of queryTokens) {
    let tokScore = scoreSingleTokenMatch(qt, titleBrandTokens, !isSynonymVariant);
    if (tokScore === 0) {
      // Category token matches carry slightly lower weight than title/brand matches
      const catScore = scoreSingleTokenMatch(qt, categoryTokens, false);
      if (catScore > 0) {
        tokScore = Math.round(catScore * 0.72);
      }
    }
    if (tokScore === 0 && !isSynonymVariant) {
      const campTokens = tokenizeNormalized(campaignHay);
      if (campTokens.includes(qt)) {
        tokScore = 14;
      }
    }
    if (tokScore > 0) {
      matchedTokens += 1;
      tokenScoreSum += isSynonymVariant ? Math.round(tokScore * 0.8) : tokScore;
    }
  }

  if (queryTokens.length > 1) {
    const requiredMatches =
      isSynonymVariant || queryTokens.length <= 2
        ? queryTokens.length
        : Math.max(2, Math.ceil(queryTokens.length * 0.67));
    if (matchedTokens < requiredMatches) return 0;
    score += tokenScoreSum;
    if (!isSynonymVariant && matchedTokens < queryTokens.length) {
      score -= (queryTokens.length - matchedTokens) * 18;
    }
  } else if (matchedTokens === 0) {
    return 0;
  } else {
    score += tokenScoreSum;
  }

  // Slight boost if matched strictly inside title/brand vs category-only
  if (titleBrandTokens.length > 0 && coreTokens.length > 0) {
    if (product.timingStatus === 'aktif') score += 8;
    if (product.timingStatus === 'yaklasan') score += 5;
  }
  return score;
}

export function matchAktuelQueryScore(
  product: Pick<AktuelProduct, 'brand' | 'title' | 'category' | 'campaignTitle' | 'timingStatus'>,
  rawQuery: string,
): number {
  const { primaryQuery, synonymQueries } = expandSearchVariants(rawQuery);
  if (!primaryQuery) return 1;

  let bestScore = scoreProductMatch(product, primaryQuery, false);
  for (const syn of synonymQueries) {
    const synScore = scoreProductMatch(product, syn, true);
    if (synScore > bestScore) {
      bestScore = synScore;
    }
  }
  return bestScore;
}

export function classifyAktuelCategory(title: string, brand = ''): AktuelCategory {
  const hay = normalizeTr(`${brand} ${title}`);

  // 1. Furniture & specific home fixtures (before electronics/toys so "tv unitesi" != tv & "pelus hali" != toy)
  if (
    /\b(tv unitesi|televizyon unitesi|calisma masasi|bilgisayar masasi|gardirop|gardrop|portmanto|vestiyer|kitaplik|konsol|komodin|sifonyer|zigon sehpa|orta sehpa|c sehpa|sehpa|utu masasi|pelus hali|hali|kilim|yolluk|koltuk ortusu|nevresim|carsaf|yorgan|yastik|battaniye|havlu|bornoz|hurc)\b/.test(
      hay,
    )
  ) {
    return 'ev_yasam';
  }

  // 2. Toy exclusions & explicit toy sets (e.g. "Pilsan Çay Seti", "Matkaplı Puzzle")
  if (/\b(oyuncak|pelus|lego|puzzle|yapboz|oyun hamuru|kutu oyunu|uzaktan kumandali|cek birak|surpriz|cocuk acilir koltuk)\b/.test(hay)) {
    return 'oyuncak';
  }

  // 3. Kitchen appliances & cookware BEFORE gida (so "Çay Makinesi", "Kahve Makinesi", "Çay Bardağı" -> mutfak, not gida!)
  if (
    /\b(tost peyniri|tava peyniri|tava yogurt|tava yogurdu|sutlu cikolata)\b/.test(hay)
  ) {
    return 'gida';
  }

  if (
    /\b(cay makinesi|cay makinasi|kahve makinesi|kahve makinasi|tost makinesi|tost makinasi|cay bardagi|su bardagi|cay suzgeci|pirinc suzgeci|caydanlik|semaver|tencere|tenceresi|duduklu|tava|tavasi|sahan|termos|matara|suluk|bardak|bardagi|kupa|fincan|fincani|tabak|tabagi|blender|mikser|dograyici|airfryer|fritoz|mikrodalga|mini firin|midi firin|su isitici|su isiticisi|kettle|kek kalibi|saklama kabi|kavanoz|bicak|bicagi|catal|kasik|soyucu|tepsi|cezve|surahi|karaf|borcam|mutfak)\b/.test(
      hay,
    )
  ) {
    return 'mutfak';
  }

  // 4. Vehicle vacuum & hardware before general electronics
  if (
    /\b(arac supurgesi|oto supurge|matkap|vidalama|testere|avuc taslama|silikon tabancasi|takim cantasi|alet seti|tornavida|pense|merdiven|lehim|kompresor|aku|jenerator|para kasasi|elektronik kasa|basincli yikama)\b/.test(
      hay,
    )
  ) {
    return 'yapi_oto';
  }

  // 5. Electronics & white goods
  if (
    /\b(tv|televizyon|qled|oled|uhd|tablet|telefon|laptop|notebook|kulaklik|bluetooth|hoparlor|soundbar|powerbank|sarj|kamera|yazici|monitor|klavye|mouse|akilli saat|smartwatch|supurge|utu|sac kurutma|tiras|epilator|buzdolabi|nofrost|camasir makinesi|bulasik makinesi|kurutma makinesi|kombi|klima|vantilator|isitici|konvektor)\b/.test(
      hay,
    )
  ) {
    return 'elektronik';
  }

  // 6. Food & consumables
  if (
    /(peynir|yogurt|sut\b|sutu|ayran|zeytin|sucuk|salam|sosis|tavuk|pilav|corba|kiyma|doner|kokorec|burger|nugget|borek|milfoy|kruvasan|bal\b|bali\b|tahin|pekmez|margarin|recel|helva|nutella|cikolata|biskuvi|kek\b|gofret|cips|kahve|cay\b|meyve suyu|gazoz|kola|deterjan|yumusatici|temizleyici|sokucu|sabun|sampuan|tuvalet kagidi|pecete|islak havlu|bebek bezi|makarna|pirinc|bulgur|unu\b|un\b|yag\b|yagi\b|zeytinyagi|aycicek|salca|puding|tatli|patates|dondurma|ton baligi|karbonat|gida)/.test(
      hay,
    )
  ) {
    return 'gida';
  }

  // 7. Camping & outdoor
  if (
    /\b(cadir|kamp|uyku tulumu|kamp sandalyesi|katlanir sandalye|piknik|mangal|barbeku|el feneri|kafa lambasi|sisme yatak|hamak|termos canta|oltalik|sirt cantasi)\b/.test(
      hay,
    )
  ) {
    return 'kamp';
  }

  // 8. Remaining toys & bikes/scooters
  if (/\b(bebek|figur|araba|top\b|topu|scooter|bisiklet|boyama)\b/.test(hay)) {
    return 'oyuncak';
  }

  // 9. Remaining home & living
  if (/\b(dolap|masa|sandalye|koltuk|raf|ayna|sepet|askilik|lamba|avize|abajur|dekor)\b/.test(hay)) {
    return 'ev_yasam';
  }

  // 10. Apparel
  if (
    /\b(mont|ceket|kazak|sweatshirt|pantolon|pijama|tayt|corap|terlik|ayakkabi|bot|cizme|bere|atki|eldiven|ic giyim|tshirt|tisort|gomlek|yelek|polar|esofman)\b/.test(
      hay,
    )
  ) {
    return 'giyim';
  }

  return 'diger';
}
