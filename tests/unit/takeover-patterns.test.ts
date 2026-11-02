/**
 * Regression tests from the first benchmark run (seed 2026): real takeover
 * pages that the English/Indonesian-only lexicon missed. Page titles are
 * quoted from the live pages; URLs are the cited ones.
 */
import { describe, expect, it } from "vitest";
import { decide } from "../../src/core/signals/verdict";
import { isSpamHost, spamScore } from "../../src/core/signals/lexicon";

const live = (url: string, finalUrl: string, title: string, text = "") => ({
  url,
  live: { ok: true, status: 200, finalUrl, redirects: finalUrl === url ? [] : [finalUrl], title, text, fetchedAt: "2026-11-02T00:00:00Z" },
});

describe("takeover patterns found by the benchmark", () => {
  it("Thai gambling page on a music society's domain is possessed, not alive", () => {
    const d = decide(live("http://jaschaheifetzsociety.org/", "https://jaschaheifetzsociety.org/", "jaschaheifetzsociety - สล็อต PG เว็บตรง แตกหนัก RTPสูง"));
    expect(d.verdict).toBe("possessed");
  });

  it("Thai casino page behind a religion statistics deep link is possessed, not a ghost", () => {
    const d = decide(
      live(
        "http://www.adherents.com/Religions_By_Adherents.html",
        "https://www.adherents.com/",
        "UFABET คาสิโนออนไลน์ เว็บตรง ยูฟ่าเบท ฝากถอนออโต้ ไม่มีขั้นต่ำ",
      ),
    );
    expect(d.verdict).toBe("possessed");
  });

  it("a registrar's 'Domain registered' holding page is possessed", () => {
    const d = decide(
      live("http://www.jaguarssp.com/Animal%20Mgmt/JAGUAR%20GUIDELINES.pdf", "http://www.jaguarssp.com/", "Domain registered | Dynadot"),
    );
    expect(d.verdict).toBe("possessed");
  });

  it("a redirect to a slot-site domain is possessed even when that server is down", () => {
    const d = decide({
      url: "http://www.fourdir.com/california_cultures.htm",
      live: { ok: false, status: 521, finalUrl: "https://rejekibetapkslot.com/", redirects: ["https://rejekibetapkslot.com/"], fetchedAt: "x" },
    });
    expect(d.verdict).toBe("possessed");
  });

  it("Vietnamese, Chinese and Korean gambling vocabulary is recognised", () => {
    expect(spamScore("nhà cái uy tín cá cược thể thao nổ hũ tài xỉu").score).toBeGreaterThanOrEqual(0.5);
    expect(spamScore("澳门博彩 娱乐城 百家乐 老虎机").score).toBeGreaterThanOrEqual(0.5);
    expect(spamScore("카지노 토토 바카라 슬롯").score).toBeGreaterThanOrEqual(0.5);
  });

  it("ordinary pages that mention one gambling word are not spam", () => {
    expect(spamScore("The Monte Carlo Casino opened in 1863 and is owned by the Société des Bains de Mer.").score).toBeLessThan(0.34);
    expect(isSpamHost("https://www.betterment.com/")).toBe(false);
    expect(isSpamHost("https://rejekibetapkslot.com/")).toBe(true);
  });
});
