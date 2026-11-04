import { describe, expect, it } from "vitest";
import { CARD_PRESETS, CARD_THEMES, DEFAULT_CARD, accentForTheme, activeCardPreset, cardAccent, cardAccentContrast, cardFilename, parseCardPreferences, presetAccent, renderProfileCard } from "@/lib/profile-card";
import { profileMilestones, type PublicProfileCard } from "@/lib/player-profile";

const card:PublicProfileCard={codename:"fixture_player",displayName:"Fixture Learner",bio:"A fictional profile for automated tests.",scope:"Practice · all time",period:"All-time practice",asOf:"2026-11-03T10:00:00Z",rank:2,points:150,solved:3,firstBloods:1,milestones:profileMilestones({rank:2,points:150,solved:3,firstBloods:1})};
describe("public card rendering",()=>{
  it("offers only dark and light, preserves old preferences and uses one font family",()=>{
    expect(CARD_THEMES).toEqual(["dark","light"]);
    expect(parseCardPreferences({theme:"paper"}).theme).toBe("light");
    for(const theme of ["carbon","midnight","unknown"])expect(parseCardPreferences({theme}).theme).toBe("dark");
    for(const theme of CARD_THEMES)expect(renderProfileCard(card,{...DEFAULT_CARD,theme}).match(/font-family=/g)).toHaveLength(1);
  });
  it("escapes text and ignores private fields and unsafe image sources",()=>{
    const svg=renderProfileCard({...card,displayName:'<script>&"',bio:'<image href="https://private.test/secret"/>',email:"DO_NOT_EXPORT",token:"PRIVATE_TOKEN",avatar:"http://127.0.0.1/private"} as PublicProfileCard,DEFAULT_CARD);
    expect(svg).toContain("&lt;script&gt;&amp;&quot;");
    expect(svg).not.toMatch(/<script|<image|foreignObject|DO_NOT_EXPORT|PRIVATE_TOKEN|\shref="/);
    expect(svg).toContain('width="1200" height="675"');
    expect(()=>encodeURIComponent(renderProfileCard({...card,displayName:"Invalid \ud800 name",bio:"\uffff"},DEFAULT_CARD))).not.toThrow();
  });
  it("limits persisted choices and never manufactures an unearned milestone",()=>{
    const preferences=parseCardPreferences({theme:"unknown",accent:"javascript",showBio:false,milestones:["unearned","first-capture","first-blood","ten-captures","first-capture"]});
    expect(preferences).toMatchObject({theme:"dark",accent:null,showBio:false,milestones:["first-capture","first-blood"]});
    const svg=renderProfileCard({...card,rank:null,points:0,solved:0,firstBloods:0,milestones:[]},preferences);
    expect(svg).toContain("Unranked");expect(svg).toContain("Points");expect(svg).toContain("Solves");expect(svg).not.toContain("First solve");expect(svg).not.toContain(card.bio);
  });
  it("accepts any hex accent, migrates saved names and rejects unsafe values",()=>{
    expect(parseCardPreferences({accent:"#A1B2C3"}).accent).toBe("#a1b2c3");
    expect(renderProfileCard(card,parseCardPreferences({accent:"#a1b2c3"}))).toContain('fill="#a1b2c3"');
    expect(parseCardPreferences({accent:"gold"}).accent).toBeNull();
    expect(parseCardPreferences({accent:"mint"}).accent).toBe("#78d6b1");
    expect(parseCardPreferences({accent:"cyan",theme:"light"}).accent).toBe("#086781");
    for(const accent of ['"/><script>','#fff','#12345g','red',42,{}])expect(parseCardPreferences({accent}).accent).toBeNull();
    expect(renderProfileCard(card,{...DEFAULT_CARD,accent:'"/><script>'})).not.toContain("<script");
  });
  it("keeps every preset readable and moves it to the right shade when the theme changes",()=>{
    for(const preset of CARD_PRESETS)for(const theme of CARD_THEMES){
      expect(cardAccentContrast({theme,accent:preset[theme]})).toBeGreaterThanOrEqual(3);
      expect(activeCardPreset({theme,accent:presetAccent(preset,theme)})?.name).toBe(preset.name);
    }
    expect(accentForTheme({theme:"dark",accent:"#78d6b1"},"light")).toBe("#126346");
    expect(accentForTheme({theme:"dark",accent:null},"light")).toBeNull();
    expect(accentForTheme({theme:"dark",accent:"#123456"},"light")).toBe("#123456");
    expect(activeCardPreset({theme:"dark",accent:"#123456"})).toBeNull();
  });
  it("follows the theme's gold by default and measures accent contrast",()=>{
    expect(cardAccent({theme:"dark",accent:null})).toBe("#ffd23f");
    expect(cardAccent({theme:"light",accent:null})).toBe("#795600");
    expect(cardAccentContrast({theme:"dark",accent:null})).toBeGreaterThan(3);
    expect(cardAccentContrast({theme:"light",accent:null})).toBeGreaterThan(3);
    expect(cardAccentContrast({theme:"dark",accent:"#101113"})).toBeLessThan(3);
    expect(cardAccentContrast({theme:"light",accent:"#ffd23f"})).toBeLessThan(3);
  });
  it("uses self-contained images across themes and bounded multilingual names",()=>{
    for(const theme of CARD_THEMES){
      const svg=renderProfileCard({...card,displayName:"学ぶ人🌐".repeat(12)}, {...DEFAULT_CARD,theme});
      expect(svg).not.toMatch(/<image|url\(|<foreignObject|@font-face|<script/);
      expect(svg).toContain("…");
      expect(svg).toContain(card.scope);expect(svg).toContain("Nov 3, 2026");expect(svg).not.toContain(card.period);
    }
    expect(cardFilename("../bad/name💻","week")).toBe("dfctf-bad-name-week.png");
  });
});
