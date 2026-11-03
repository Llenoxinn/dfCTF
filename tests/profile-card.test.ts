import { describe, expect, it } from "vitest";
import { CARD_THEMES, DEFAULT_CARD, cardFilename, parseCardPreferences, renderProfileCard } from "@/lib/profile-card";
import { profileMilestones, type PublicProfileCard } from "@/lib/player-profile";

const card:PublicProfileCard={codename:"fixture_player",displayName:"Fixture Learner",bio:"A fictional profile for automated tests.",scope:"Practice · all time",period:"All-time practice",asOf:"2026-11-03T10:00:00Z",rank:2,points:150,solved:3,firstBloods:1,milestones:profileMilestones({rank:2,points:150,solved:3,firstBloods:1})};
describe("public card rendering",()=>{
  it("escapes text and ignores private fields and unsafe image sources",()=>{
    const svg=renderProfileCard({...card,displayName:'<script>&"',bio:'<image href="https://private.test/secret"/>',email:"DO_NOT_EXPORT",token:"PRIVATE_TOKEN",avatar:"http://127.0.0.1/private"} as PublicProfileCard,DEFAULT_CARD);
    expect(svg).toContain("&lt;script&gt;&amp;&quot;");
    expect(svg).not.toMatch(/<script|<image|foreignObject|DO_NOT_EXPORT|PRIVATE_TOKEN|\shref="/);
    expect(svg).toContain('width="1200" height="675"');
  });
  it("limits persisted choices and never manufactures an unearned milestone",()=>{
    const preferences=parseCardPreferences({theme:"unknown",accent:"javascript",showBio:false,milestones:["unearned","first-capture","first-blood","ten-captures","first-capture"]});
    expect(preferences).toMatchObject({theme:"carbon",accent:"gold",showBio:false,milestones:["first-capture","first-blood"]});
    const svg=renderProfileCard({...card,rank:null,points:0,solved:0,firstBloods:0,milestones:[]},preferences);
    expect(svg).toContain("Unranked");expect(svg).not.toContain("First capture");expect(svg).not.toContain(card.bio);
  });
  it("uses self-contained images across themes and bounded multilingual names",()=>{
    for(const theme of CARD_THEMES){
      const svg=renderProfileCard({...card,displayName:"学ぶ人🌐".repeat(12)}, {...DEFAULT_CARD,theme});
      expect(svg).not.toMatch(/<image|url\(|<foreignObject|@font-face|<script/);
      expect(svg).toContain("…");
      expect(svg).toContain(card.scope);
    }
    expect(cardFilename("../bad/name💻","week")).toBe("dfctf-bad-name-week.png");
  });
});
