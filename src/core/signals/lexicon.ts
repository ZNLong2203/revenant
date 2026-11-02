/**
 * Phrase lists behind the detectors. Kept as data so they can be reviewed and
 * extended without touching the decision logic.
 */
import { hostOf } from "../url";

/** Hosts that only ever serve parked or for-sale domains. */
export const PARKING_HOSTS = [
  "sedo.com", "sedoparking.com", "dan.com", "afternic.com", "hugedomains.com", "parkingcrew.net", "bodis.com",
  "above.com", "undeveloped.com", "domainmarket.com", "buydomains.com", "sav.com", "parklogic.com",
  "domainnamesales.com", "efty.com", "atom.com", "squadhelp.com", "brandbucket.com", "namebright.com",
  "uniregistry.com", "domainlore.com", "epik.com", "perfectdomain.com", "spaceship.com", "afternic.net",
  "godaddysites.com", "ww1.", "ww25.",
];

/** Phrases a parking or for-sale page shows instead of the original site. */
export const PARKING_PHRASES = [
  "this domain may be for sale", "this domain is for sale", "the domain is for sale", "buy this domain",
  "domain for sale", "is available for purchase", "make an offer on this domain", "this domain has expired",
  "domain has expired", "renew this domain", "parked free", "parked domain", "this web page is parked",
  "related searches", "sponsored listings", "inquire about this domain", "get this domain",
  "the owner of this domain", "hugedomains", "domain name is for sale", "this page is provided courtesy of godaddy",
  "check out the domain", "premium domain", "lease to own", "domain registered", "this domain is registered",
  "this domain was recently registered", "registered at dynadot", "dynadot", "namecheap parking", "parkingpage",
  "domain parking", "parked by", "is parked free", "courtesy of namecheap", "future home of something quite cool", "this website is for sale", "website is for sale", "this site is for sale",
];

/**
 * Words that dominate the spam that squatters put on expired domains:
 * online gambling (in English and Indonesian, the most common takeover
 * language in our samples), pills, essay mills, loans, adult content.
 */
export const SPAM_TERMS = [
  // gambling
  "casino", "slot gacor", "slot online", "situs slot", "judi", "togel", "toto", "bandar", "rtp slot", "maxwin",
  "sbobet", "poker online", "betting", "sportsbook", "bonus deposit", "jackpot", "pragmatic play", "pg soft",
  "link alternatif", "daftar", "agen", "gacor", "scatter", "bet88", "1xbet", "parimatch", "qq online",
  "domino qq", "live casino", "situs", "slot88", "nagaslot", "zeus slot",
  // pills and adult
  "viagra", "cialis", "levitra", "kamagra", "escort", "xxx", "porn", "hookup", "sex cam",
  // essay mills, loans, crypto pumps, knock-offs
  "essay writing service", "write my essay", "payday loan", "cash advance", "replica watches",
  "crypto signals", "forex signals", "binary options", "cheap jerseys", "seo backlinks", "buy followers",
  // brand names that only ever appear on gambling pages
  "ufabet", "pg slot", "w88", "fun88", "188bet", "dafabet", "betflik", "jili", "joker123", "slot pg",
  "superliga168", "ligaciputra", "game online terbaru", "slot online terbaru", "situs game online",
  "sv388", "ae888", "kubet", "jun88", "okvip", "789bet", "new88", "shbet", "f8bet", "hi88",
  // Thai
  "สล็อต", "คาสิโน", "บาคาร่า", "เว็บตรง", "แทงบอล", "หวย", "เครดิตฟรี", "ฝากถอน", "แตกหนัก", "ยูฟ่าเบท",
  // Vietnamese
  "nhà cái", "cá cược", "tài xỉu", "nổ hũ", "đá gà", "xổ số", "lô đề", "game bài", "bắn cá",
  // Chinese, Japanese, Korean
  "博彩", "娱乐城", "百家乐", "老虎机", "赌场", "彩票", "体育投注", "真人视讯", "オンラインカジノ", "カジノ",
  "카지노", "토토", "바카라", "슬롯", "먹튀",
];

/** Words in registrable domains that squatters pick for gambling sites. */
export const SPAM_HOST = /(slot|togel|casino|kasino|judi|gacor|poker|ufabet|bet\d|\dbet|bandar|maxwin|sbobet|baccarat|toto\d|qq\d|bola|jackpot)/i;

export const SOFT_404_PHRASES = [
  "page not found", "404 not found", "error 404", "404 error", "not found", "page cannot be found",
  "page can't be found", "page could not be found", "page does not exist", "page doesn't exist",
  "no longer available", "has been removed", "has been moved", "content not found", "nothing was found",
  "we couldn't find", "we can't find", "we could not find", "sorry, this page", "oops", "file not found",
  "the requested url was not found", "resource not found", "page unavailable", "this page isn't available",
  "this page is no longer", "article not found", "no results found", "page missing",
  "account suspended", "website is not available", "this site is under construction", "site not found",
];

/** Interstitials served to bots instead of the page (we never try to get past them). */
export const BOT_WALL_PHRASES = [
  "client challenge", "just a moment", "attention required", "checking your browser", "verify you are human",
  "are you a robot", "access denied", "please enable javascript and cookies", "ddos protection by",
  "request unsuccessful. incapsula", "pardon our interruption", "bot verification", "security check",
];

export function botWallHits(title: string | undefined, text: string | undefined): string[] {
  return countHits(`${title ?? ""} ${(text ?? "").slice(0, 400)}`, BOT_WALL_PHRASES);
}

export function isParkingHost(url: string): boolean {
  const host = hostOf(url);
  return PARKING_HOSTS.some((p) => (p.endsWith(".") ? host.startsWith(p) : host === p || host.endsWith(`.${p}`)));
}

/** Scripts written without spaces between words (Thai, CJK) cannot use word boundaries. */
const UNSPACED = /[฀-๿぀-ヿ㐀-鿿가-힯]/;

function countHits(haystack: string, phrases: readonly string[]): string[] {
  const h = ` ${haystack.toLowerCase()} `;
  return phrases.filter((p) => {
    if (UNSPACED.test(p)) return h.includes(p);
    // require word boundaries so "toto" doesn't match "pothoto"
    let i = h.indexOf(p);
    while (i !== -1) {
      const before = h[i - 1];
      const after = h[i + p.length];
      if (!/[\p{L}\p{N}]/u.test(before ?? " ") && !/[\p{L}\p{N}]/u.test(after ?? " ")) return true;
      i = h.indexOf(p, i + 1);
    }
    return false;
  });
}

/** The final host looks like a gambling site's domain. */
export function isSpamHost(url: string): boolean {
  return SPAM_HOST.test(hostOf(url));
}

export function parkingHits(text: string): string[] {
  return countHits(text, PARKING_PHRASES);
}

/**
 * Spam score in [0, 1]: distinct spam terms found, saturating at 6. A normal
 * page about, say, Monte Carlo might mention "casino" once; squatter pages
 * stack a dozen of these terms.
 */
export function spamScore(text: string): { score: number; hits: string[] } {
  const hits = countHits(text, SPAM_TERMS);
  return { score: Math.min(1, hits.length / 6), hits };
}

/** Soft-404 phrasing in a page title or the first part of its text. */
export function soft404Hits(title: string | undefined, text: string | undefined): string[] {
  const head = `${title ?? ""} ${(text ?? "").slice(0, 600)}`;
  return countHits(head, SOFT_404_PHRASES);
}
