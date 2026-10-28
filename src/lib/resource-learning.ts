import type { ResourceGuide } from "./resources";
import type { Category } from "./types";

export const TOPIC_INFO: Record<string, { level: "Beginner" | "Intermediate"; category: Category; practice: string }> = {
  "general-skills": { level: "Beginner", category: "General skills", practice: "Start with a small file, identify its format, and keep notes about what you find." },
  osint: { level: "Beginner", category: "OSINT", practice: "Look for a fictional investigation with supplied public clues and a clear scope." },
  steganography: { level: "Beginner", category: "Steganography", practice: "Inspect a supplied image or recording before trying any transformations." },
  forensics: { level: "Beginner", category: "Forensics", practice: "Reconstruct events from a supplied file, log, or packet capture." },
  "web-exploitation": { level: "Beginner", category: "Web exploitation", practice: "Read a saved request or use the isolated target explicitly supplied by the challenge." },
  "binary-exploitation": { level: "Intermediate", category: "Binary exploitation", practice: "Begin with a small teaching program and its supplied debugger output." },
  miscellaneous: { level: "Beginner", category: "Miscellaneous", practice: "Try a small puzzle that rewards careful observation and a short, repeatable script." },
  cryptography: { level: "Intermediate", category: "Miscellaneous", practice: "Look for a cryptography-tagged puzzle and identify its representation before choosing a method." },
  "audio-recovery": { level: "Beginner", category: "Steganography", practice: "Look for an audio or media puzzle. Start by identifying streams and channels." },
  "network-defense": { level: "Intermediate", category: "Forensics", practice: "Use an offline network capture to study traffic. Challenge infrastructure is not a traffic-test target." },
  "scripting-automation": { level: "Beginner", category: "General skills", practice: "Choose a file-processing puzzle and automate one observation at a time." },
  "cloud-containers": { level: "Intermediate", category: "Miscellaneous", practice: "The closest board category is Miscellaneous. Look for a cloud or configuration puzzle; availability varies." },
  "incident-response": { level: "Intermediate", category: "Forensics", practice: "Look for logs or event fixtures and build a timeline supported by the supplied evidence." },
  "identity-host-security": { level: "Beginner", category: "General skills", practice: "Look for a permissions or filesystem puzzle. The closest board category is General skills." },
  "mobile-wireless": { level: "Intermediate", category: "Forensics", practice: "Look for a supplied application or wireless capture; availability varies. Work offline within its stated scope." },
};

export const LEARNING_PATHS = [
  { id: "foundations", title: "Beginner foundations", summary: "Build confidence with files, simple scripts, and the first investigation skills.", topics: ["general-skills", "scripting-automation", "osint", "steganography", "forensics"] },
  { id: "investigations", title: "Digital investigations", summary: "Follow clues from public information to media, files, and incident timelines.", topics: ["osint", "steganography", "audio-recovery", "forensics", "incident-response"] },
  { id: "web-security", title: "Web security", summary: "Understand the tools, requests, identity checks, and configuration behind a website.", topics: ["general-skills", "web-exploitation", "identity-host-security", "cloud-containers"] },
  { id: "network-defense", title: "Network defense", summary: "Read network evidence, learn defensive concepts, and investigate what happened.", topics: ["general-skills", "forensics", "network-defense", "incident-response", "mobile-wireless"] },
  { id: "windows", title: "Windows first steps", summary: "Start with PowerShell, then explore permissions, automation, and Windows event evidence.", topics: ["general-skills", "identity-host-security", "scripting-automation", "incident-response"] },
  { id: "programs-puzzles", title: "Programs & puzzles", summary: "Move from small scripts to cryptography, unfamiliar puzzles, and teaching binaries.", topics: ["scripting-automation", "miscellaneous", "cryptography", "binary-exploitation"] },
];

export type ResourceCard = Pick<ResourceGuide, "id" | "title" | "summary"> & {
  tools: { id: string; name: string; when: string; platform: string }[];
};

export function matchingTools(guide: ResourceCard, query: string, platform: string) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return guide.tools.filter(tool => {
    const text = `${guide.title} ${guide.summary} ${tool.name} ${tool.when} ${tool.platform}`.toLowerCase();
    return words.every(word => text.includes(word)) && (!platform || tool.platform.toLowerCase().includes(platform.toLowerCase()));
  });
}

export const GLOSSARY: Record<string, string> = {
  "SHA-256": "A hash function that produces a 256-bit digest, usually written as 64 hexadecimal characters. It helps compare file contents; it does not certify safety.",
  hash: "A value calculated from data. Comparing a file's hash with a trusted reference helps check whether its bytes match.",
  metadata: "Information describing data, such as a file's creation time, camera settings, or audio sample rate.",
  encoding: "A way to represent data in another form, such as Base64 or hexadecimal. Encoding does not make data secret.",
  encryption: "A transformation designed to keep information confidential, using a key to recover the original information.",
  packet: "A unit of data sent across a network. A capture records packets so you can inspect their contents and timing.",
  DNS: "Domain Name System: the system used to look up records for domain names, including the addresses used to reach services.",
  HTTP: "Hypertext Transfer Protocol: the request-and-response protocol used by websites and many APIs.",
  TLS: "Transport Layer Security: a protocol that protects a connection's data in transit and helps authenticate its peer.",
  API: "Application Programming Interface: a defined way for software to request data or operations from another component.",
  cookie: "A small value a website asks a browser to store and send with matching requests, often to maintain a session.",
  permissions: "Rules specifying which users or processes may read, change, or run a resource.",
  authentication: "Checking an identity, for example with a password or an authenticator code.",
  authorization: "Deciding which actions an authenticated identity is allowed to perform.",
  "virtual machine": "A software-defined computer running a guest operating system. Its isolation depends on configuration, shared folders, and network access.",
  spectrogram: "A view showing how the frequencies in a recording change over time. It complements the waveform and listening.",
  artifact: "A file or other piece of evidence supplied for an investigation or challenge.",
  OSINT: "Open-source intelligence: investigating information available from permitted public sources and checking its context and reliability.",
  DDoS: "Distributed denial of service: many sources overwhelming a service or its resources. These guides study defensive evidence and bounded, authorized labs.",
  certificate: "A digitally signed statement binding an identity to a public key, used in systems such as TLS.",
  memory: "The working storage a program uses while running. A memory image records a snapshot for later investigation.",
  container: "A way to package and run a process with operating-system isolation. Containers share the host kernel and are not equivalent to separate virtual machines.",
};

export const LEARNING_STORAGE_KEY = "dfctf:learning:v1";
export type LearningProgress = {
  bookmarks: string[];
  completed: string[];
  open: Record<string, string[]>;
  last: { topic: string; section: string; path?: string } | null;
};

const safeId = (value: unknown): value is string => typeof value === "string" && /^[a-z][a-z0-9-]{0,99}$/.test(value);
const topicExists = (value: unknown): value is string => typeof value === "string" && Object.hasOwn(TOPIC_INFO, value);
const strings = (value: unknown) => Array.isArray(value) ? [...new Set(value.filter(safeId))].slice(0, 100) : [];

export function parseLearningProgress(raw: string | null): LearningProgress {
  const empty: LearningProgress = { bookmarks: [], completed: [], open: {}, last: null };
  if (!raw || raw.length > 100_000) return empty;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || value.version !== 1) return empty;
    const validBookmark = (key: unknown): key is string => {
      if (typeof key !== "string") return false;
      const [topic, tool, extra] = key.split("/");
      return topicExists(topic) && extra === undefined && (tool === undefined || safeId(tool));
    };
    return {
      bookmarks: Array.isArray(value.bookmarks) ? [...new Set<string>(value.bookmarks.filter(validBookmark))].slice(0, 100) : [],
      completed: strings(value.completed).filter(topicExists),
      open: value.open && typeof value.open === "object" && !Array.isArray(value.open) ? Object.fromEntries(Object.entries(value.open).filter(([id]) => topicExists(id)).map(([id, ids]) => [id, strings(ids)])) : {},
      last: value.last && topicExists(value.last.topic) && safeId(value.last.section) ? { topic: value.last.topic, section: value.last.section, ...(LEARNING_PATHS.some(path => path.id === value.last.path && path.topics.includes(value.last.topic)) ? { path: value.last.path } : {}) } : null,
    };
  } catch { return empty; }
}
