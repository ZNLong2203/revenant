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

describe("false ghosts found on live-tagged controls (seed 3110)", () => {
  it("a bot challenge page is unknown, not a ghost", () => {
    const d = decide({
      url: "https://www.ctpost.com/entertainment/article/danny-glover-university-of-bridgeport.php",
      live: { ok: true, status: 200, finalUrl: "https://www.ctpost.com/entertainment/article/danny-glover-university-of-bridgeport.php", redirects: [], title: "Client Challenge", text: "Client Challenge", fetchedAt: "x" },
      sibling: { ok: true, status: 200, redirects: [], title: "Client Challenge", text: "Client Challenge", fetchedAt: "x" },
    });
    expect(d.verdict).toBe("unknown");
  });

  it("a JavaScript shell that looks the same on every path is not a ghost", () => {
    const shell = "Hibernian FC Loading";
    const d = decide({
      url: "https://www.hibernianfc.co.uk/news/2024/june/10/david-marshall-retires",
      live: { ok: true, status: 200, finalUrl: "https://www.hibernianfc.co.uk/news/2024/june/10/david-marshall-retires", redirects: [], title: "", text: shell, fetchedAt: "x" },
      sibling: { ok: true, status: 200, redirects: [], title: "", text: shell, fetchedAt: "x" },
    });
    expect(d.verdict).not.toBe("ghost");
  });
});

describe("misses on the held-out seed 4040 (fixed after the run, not counted in the published numbers)", () => {
  it("a 'This website is for sale!' page is possessed", () => {
    const d = decide({
      url: "http://theblock-mag.com/interview-refinery29/",
      live: { ok: true, status: 200, finalUrl: "http://theblock-mag.com/", redirects: ["http://theblock-mag.com/"], title: "theblock-mag.com - This website is for sale! - theblock mag Resources and Information.", text: "This website is for sale! theblock-mag.com is your first and best source for information about theblock mag.", fetchedAt: "x" },
    });
    expect(d.verdict).toBe("possessed");
  });

  it("an Indonesian game-site page on a metal review domain is possessed", () => {
    const d = decide({
      url: "http://www.live-metal.net/cdreviews_typeonegative_deadagain",
      live: { ok: true, status: 200, finalUrl: "https://www.live-metal.net/", redirects: ["https://www.live-metal.net/"], title: "Superliga168 & Ligaciputra | Ragam Game Online Terbaru 2026", text: "Superliga168 Ligaciputra situs game online terbaru daftar slot online terbaru", fetchedAt: "x" },
    });
    expect(d.verdict).toBe("possessed");
  });
});
