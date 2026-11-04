import { milestoneIconPath } from "./milestone-icons";
import { codenameField, ditherPath, identiconPath } from "./pixel";
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
/** Ready-made accents, each with a shade that stays readable on either card theme. Gold is the null default. */
export const CARD_PRESETS = [
  {name:"Gold",dark:PALETTES.dark.accent,light:PALETTES.light.accent},
  {name:"Mint",dark:"#78d6b1",light:"#126346"},
  {name:"Cyan",dark:"#70d4ef",light:"#086781"},
  {name:"Coral",dark:"#ff8a75",light:"#b23a24"},
  {name:"Pink",dark:"#ff8fc7",light:"#a8266b"},
  {name:"Lime",dark:"#c6e75a",light:"#566b00"},
] as const;
export type CardPreset = typeof CARD_PRESETS[number];
const presetValue = (preset: CardPreset, theme: CardPreferences["theme"]) => preset.name === "Gold" ? null : preset[theme];
const legacyAccent = (accent: string, theme: CardPreferences["theme"]) => { const preset = CARD_PRESETS.find(p => p.name.toLowerCase() === accent); return preset ? presetValue(preset, theme) : null; };

export function parseCardPreferences(value: unknown): CardPreferences {
  const raw = value && typeof value === "object" ? value as Partial<CardPreferences> : {};
  const savedTheme = (raw as { theme?: string }).theme;
  const theme = savedTheme === "light" || savedTheme === "paper" ? "light" : "dark";
  const accent = typeof raw.accent === "string" ? raw.accent : "";
  return {
    theme,
    accent: /^#[0-9a-f]{6}$/i.test(accent) ? accent.toLowerCase() : legacyAccent(accent, theme),
    showDisplayName: typeof raw.showDisplayName === "boolean" ? raw.showDisplayName : true,
    showBio: typeof raw.showBio === "boolean" ? raw.showBio : true,
    showFirstBloods: typeof raw.showFirstBloods === "boolean" ? raw.showFirstBloods : true,
    milestones: Array.isArray(raw.milestones) ? [...new Set(raw.milestones.filter(id=>["first-capture","ten-captures","first-blood"].includes(id)))].slice(0,2) : [...DEFAULT_CARD.milestones],
  };
}

export function cardAccent(preferences: Pick<CardPreferences,"theme"|"accent">) { return preferences.accent ?? PALETTES[preferences.theme].accent; }

export function activeCardPreset(preferences: Pick<CardPreferences,"theme"|"accent">) { const accent = cardAccent(preferences); return CARD_PRESETS.find(preset => preset[preferences.theme] === accent) ?? null; }
export function presetAccent(preset: CardPreset, theme: CardPreferences["theme"]) { return presetValue(preset, theme); }
/** The accent to keep when the card theme changes: a preset moves to its readable shade, a custom color stays as chosen. */
export function accentForTheme(preferences: Pick<CardPreferences,"theme"|"accent">, theme: CardPreferences["theme"]) {
  const preset = activeCardPreset(preferences);
  return preset ? presetValue(preset, theme) : preferences.accent;
}

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
  const isWide=(value:string)=>/[ᄀ-￿]|\p{Extended_Pictographic}/u.test(value);
  const display=prefs.showDisplayName && card.displayName ? card.displayName : card.codename;
  const names=lines(display,isWide(display)?11:19), hasName=display!==card.codename;
  const bio=prefs.showBio && card.bio?lines(card.bio,isWide(card.bio)?24:46):[];
  const handleY=352+(names.length-1)*54+38, bioY=hasName?handleY+42:352+(names.length-1)*54+44;
  const rank=card.rank===null?"Unranked":`#${card.rank.toLocaleString("en")}`, points=card.points.toLocaleString("en");
  const big=(value:string)=>Math.min(84,Math.floor(383/value.length));
  const lower:[string,string][]=[["Solves",card.solved.toLocaleString("en")],...(prefs.showFirstBloods?[["First Bloods",card.firstBloods.toLocaleString("en")] as [string,string]]:[])];
  const badges=card.milestones.filter(m=>prefs.milestones.includes(m.id)).slice(0,2);
  const snapshot=new Intl.DateTimeFormat("en",{timeZone:"Asia/Manila",day:"numeric",month:"short",year:"numeric"}).format(new Date(card.asOf));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" font-family="ui-monospace, 'Cascadia Mono', Consolas, Menlo, monospace">
    <rect width="1200" height="675" fill="${palette.bg}"/>
    <path d="${ditherPath(1200,232,8,codenameField(card.codename,1200,232))}" fill="${accent}" shape-rendering="crispEdges"/>
    <rect x="48" y="48" width="150" height="64" fill="${palette.bg}"/>
    ${text(66,92,"dfCTF",34,accent,'font-weight="700"')}
    <rect x="48" y="168" width="128" height="128" fill="${palette.bg}" stroke="${palette.line}"/>
    <g transform="translate(56 176)" fill="${accent}" shape-rendering="crispEdges"><path d="${identiconPath(card.codename,112)}"/></g>
    ${names.map((name,i)=>text(48,352+i*54,name,48,palette.text,'font-weight="700" letter-spacing="-1"')).join("")}
    ${hasName?text(48,handleY,`@${fit(card.codename,24)}`,24,accent):""}
    ${bio.map((line,i)=>text(48,bioY+i*28,line,20,palette.muted)).join("")}
    <rect x="664" y="168" width="537" height="${badges.length?420:288}" fill="${palette.surface}" stroke="${palette.line}"/>
    ${text(696,216,"Rank",18,palette.muted)}${text(948,216,"Points",18,palette.muted)}
    ${text(696,296,rank,big(rank),accent,'font-weight="700" letter-spacing="-2"')}${text(948,296,points,big(points),palette.text,'font-weight="700" letter-spacing="-2"')}
    <path d="M664 328H1200" stroke="${palette.line}"/>
    ${lower.map(([label,value],i)=>{const x=696+i*252;return `${text(x,368,label,18,palette.muted)}${text(x,424,value,48,palette.text,'font-weight="700"')}`;}).join("")}
    ${badges.length?`<path d="M664 456H1200" stroke="${palette.line}"/>`:""}
    ${badges.map((badge,i)=>{const x=696+i*252;return `<g transform="translate(${x} 506) scale(2)" fill="${accent}" shape-rendering="crispEdges"><path d="${milestoneIconPath(badge.id)}"/></g>${text(x+44,530,badge.label,18,palette.text,'font-weight="600"')}`;}).join("")}
    ${text(48,638,card.scope,18,accent,'font-weight="700"')}
    ${text(1152,638,`${snapshot}  dfctf.vercel.app`,16,palette.muted,'text-anchor="end" xml:space="preserve"')}
  </svg>`;
}

export function cardFilename(codename: string, scope: string) {
  return `dfctf-${codename.replace(/[^a-z\d_.-]+/gi,"-").replace(/^[.-]+|[.-]+$/g,"").slice(0,32)||"player"}-${scope === "week" ? "week" : "all-time"}.png`;
}
