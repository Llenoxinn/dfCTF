import { identiconPath } from "./pixel";
import type { PublicProfileCard } from "./player-profile";

export const CARD_WIDTH = 1200, CARD_HEIGHT = 675;
export const CARD_THEMES = ["dark", "light"] as const;
/** A null accent follows the theme's own gold. Any other accent is a validated #rrggbb the player chose. */
export type CardPreferences = { theme: typeof CARD_THEMES[number]; accent: string | null; showDisplayName: boolean; showBio: boolean; showFirstBloods: boolean; milestones: string[] };
export const DEFAULT_CARD: CardPreferences = { theme:"dark",accent:null,showDisplayName:true,showBio:true,showFirstBloods:true,milestones:["first-capture","first-blood"] };
const PALETTES = {
  dark:{bg:"#101113",surface:"#191b1e",text:"#ece8df",muted:"#aaa79f",line:"#36393d",accent:"#ffd23f"},
  light:{bg:"#f5f3ec",surface:"#eae8df",text:"#17181b",muted:"#55564e",line:"#c8c7be",accent:"#795600"},
};
const LEGACY_ACCENTS: Record<string, Record<CardPreferences["theme"], string>> = { mint:{dark:"#78d6b1",light:"#126346"}, cyan:{dark:"#70d4ef",light:"#086781"} };

export function parseCardPreferences(value: unknown): CardPreferences {
  const raw = value && typeof value === "object" ? value as Partial<CardPreferences> : {};
  const savedTheme = (raw as { theme?: string }).theme;
  const theme = savedTheme === "light" || savedTheme === "paper" ? "light" : "dark";
  const accent = typeof raw.accent === "string" ? raw.accent : "";
  return {
    theme,
    accent: /^#[0-9a-f]{6}$/i.test(accent) ? accent.toLowerCase() : LEGACY_ACCENTS[accent]?.[theme] ?? null,
    showDisplayName: typeof raw.showDisplayName === "boolean" ? raw.showDisplayName : true,
    showBio: typeof raw.showBio === "boolean" ? raw.showBio : true,
    showFirstBloods: typeof raw.showFirstBloods === "boolean" ? raw.showFirstBloods : true,
    milestones: Array.isArray(raw.milestones) ? [...new Set(raw.milestones.filter(id=>["first-capture","ten-captures","first-blood"].includes(id)))].slice(0,2) : [...DEFAULT_CARD.milestones],
  };
}

export function cardAccent(preferences: Pick<CardPreferences,"theme"|"accent">) { return preferences.accent ?? PALETTES[preferences.theme].accent; }

function luminance(hex: string) {
  const [r,g,b]=[1,3,5].map(i=>{const c=parseInt(hex.slice(i,i+2),16)/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});
  return .2126*r+.7152*g+.0722*b;
}
/** The accent's lowest contrast against the card surfaces it is drawn on. */
export function cardAccentContrast(preferences: Pick<CardPreferences,"theme"|"accent">) {
  const accent=luminance(cardAccent(preferences)), palette=PALETTES[preferences.theme];
  return Math.min(...[palette.bg,palette.surface].map(surface=>{const other=luminance(surface);return (Math.max(accent,other)+.05)/(Math.min(accent,other)+.05);}));
}

const graphemes = (value: string) => [...new Intl.Segmenter(undefined,{granularity:"grapheme"}).segment(value)].map(part=>part.segment);
const xml = (value: unknown) => String(value).toWellFormed().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g,"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]!));
function fit(value: string, max: number) { const chars=graphemes(value.replace(/\s+/g," ").trim()); return chars.length > max ? chars.slice(0,max-1).join("")+"…" : chars.join(""); }
function lines(value: string, max: number, count = 2) {
  const chars=graphemes(value.replace(/\s+/g," ").trim()), result:string[]=[];
  while(chars.length && result.length<count) result.push(chars.splice(0,max).join(""));
  if(chars.length) result[result.length-1]=fit(result.at(-1)!+"…",max);
  return result;
}

/** Shared preview/export renderer. No external resources, HTML, or user-supplied SVG. */
export function renderProfileCard(card: PublicProfileCard, preferences: CardPreferences): string {
  const prefs=parseCardPreferences(preferences);
  const palette = PALETTES[prefs.theme], accent = cardAccent(prefs);
  const text=(x:number,y:number,value:unknown,size=20,fill=palette.text,extra="")=>`<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${xml(value)}</text>`;
  const display=prefs.showDisplayName && card.displayName ? card.displayName : card.codename;
  const names=lines(display,20), hasName=display!==card.codename;
  const stats:[string,string][]=[["RANK",card.rank===null?"Unranked":`#${card.rank.toLocaleString("en")}`],["POINTS",card.points.toLocaleString("en")],["SOLVES",card.solved.toLocaleString("en")],...(prefs.showFirstBloods?[["FIRST BLOODS",card.firstBloods.toLocaleString("en")] as [string,string]]:[])];
  const badges=card.milestones.filter(m=>prefs.milestones.includes(m.id)).slice(0,2);
  const snapshot=new Intl.DateTimeFormat("en",{timeZone:"Asia/Manila",day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(card.asOf));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" font-family="Arial, sans-serif">
    <rect width="1200" height="675" fill="${palette.bg}"/>
    <rect x="24" y="24" width="1152" height="627" rx="12" fill="none" stroke="${palette.line}"/>
    <path d="M64 109H1136M64 580H1136" stroke="${palette.line}"/>
    ${text(64,79,"dfCTF",32,accent,'font-weight="800"')}
    ${text(1136,77,"PLAYER IDENTITY / PRACTICE",15,palette.muted,'text-anchor="end" letter-spacing="2"')}
    <rect x="64" y="148" width="120" height="120" rx="8" fill="${palette.surface}" stroke="${palette.line}"/>
    <g transform="translate(68 152)" fill="${accent}" shape-rendering="crispEdges"><path d="${identiconPath(card.codename,112)}"/></g>
    ${names.map((name,i)=>text(216,190+i*50,name,44,palette.text,'font-weight="700"')).join("")}
    ${hasName?text(216,names.length>1?280:242,`@${fit(card.codename,24)}`,24,accent):text(216,250,"INDEPENDENT PLAYER",14,palette.muted,'letter-spacing="2"')}
    ${prefs.showBio && card.bio?lines(card.bio,48).map((line,i)=>text(64,316+i*26,line,20,palette.muted)).join(""):""}
    <rect x="64" y="372" width="1072" height="128" rx="8" fill="${palette.surface}" stroke="${palette.line}"/>
    ${stats.map(([label,value],i)=>{const width=1072/stats.length,x=88+i*width;return `${i?`<path d="M${64+i*width} 396v80" stroke="${palette.line}"/>`:""}${text(x,409,label,14,palette.muted,'letter-spacing="1.5"')}${text(x,464,value,value.length>11?30:value.length>8?38:46,i===0?accent:palette.text,'font-weight="700"')}`;}).join("")}
    ${badges.map((badge,i)=>{const x=64+i*252;return `<rect x="${x}" y="525" width="232" height="34" rx="17" fill="${palette.surface}" stroke="${palette.line}"/>${text(x+18,548,"+",20,accent)}${text(x+42,548,badge.label,16,palette.text,'font-weight="600"')}`;}).join("")}
    ${text(64,609,card.scope,18,accent,'font-weight="700"')}
    ${text(1136,609,card.period,16,palette.muted,'text-anchor="end"')}
    ${text(64,635,`SNAPSHOT ${snapshot} PHT`,12,palette.muted,'letter-spacing="1"')}
    ${text(1136,635,"dfctf.vercel.app",13,palette.muted,'text-anchor="end"')}
  </svg>`;
}

export function cardFilename(codename: string, scope: string) {
  return `dfctf-${codename.replace(/[^a-z\d_.-]+/gi,"-").replace(/^[.-]+|[.-]+$/g,"").slice(0,32)||"player"}-${scope === "week" ? "week" : "all-time"}.png`;
}
