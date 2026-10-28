import { describe, expect, it } from "vitest";
import { RESOURCE_GUIDES } from "@/lib/resources";

describe("resource guide content", () => {
  it("covers the original subjects and the added investigation and defense areas", () => {
    expect(RESOURCE_GUIDES.map(guide => guide.id)).toEqual(expect.arrayContaining([
      "general-skills", "osint", "steganography", "forensics", "web-exploitation", "binary-exploitation",
      "miscellaneous", "cryptography", "audio-recovery", "network-defense", "scripting-automation",
      "cloud-containers", "incident-response", "identity-host-security", "mobile-wireless",
    ]));
  });

  it("keeps section, disclosure, heading, and tool anchors unique", () => {
    const anchors = ["resources-content", "getting-started", "getting-started-title", "practice-safely", "practice-safely-title"];
    for (const guide of RESOURCE_GUIDES) {
      anchors.push(guide.id, `${guide.id}-title`, `${guide.id}-deeper`, ...[...guide.tools, ...guide.deeper].map(tool => tool.id));
    }
    expect(anchors.every(anchor => /^[a-z][a-z0-9-]*$/.test(anchor))).toBe(true);
    expect(new Set(anchors).size).toBe(anchors.length);
  });

  it("gives every area a starting workflow and an optional deeper path with references", () => {
    for (const guide of RESOURCE_GUIDES) {
      expect(guide.summary.trim(), guide.id).not.toBe("");
      expect(guide.tools.length, guide.id).toBeGreaterThan(0);
      expect(guide.deeper.length, guide.id).toBeGreaterThanOrEqual(3);
      expect(guide.concepts.length, guide.id).toBeGreaterThanOrEqual(3);
      expect(new Set(guide.concepts.map(concept => concept.title)).size, guide.id).toBe(guide.concepts.length);
      for (const concept of guide.concepts) {
        expect(concept.title.trim(), guide.id).not.toBe("");
        expect(concept.detail.trim(), guide.id).not.toBe("");
      }
      for (const tool of [...guide.tools, ...guide.deeper]) {
        for (const text of [tool.name, tool.platform, tool.when, tool.observe, tool.pitfall]) expect(text.trim(), tool.id).not.toBe("");
        expect(tool.steps.length, tool.id).toBeGreaterThanOrEqual(3);
        expect(tool.steps.every(step => step.trim().length > 0), tool.id).toBe(true);
        expect(tool.links.length, tool.id).toBeGreaterThan(0);
        for (const link of tool.links) {
          const url = new URL(link.href);
          expect(url.protocol, tool.id).toBe("https:");
          expect(url.username + url.password, tool.id).toBe("");
          expect(link.label.trim(), tool.id).not.toBe("");
        }
        if (tool.example) {
          expect(tool.example.label.trim(), tool.id).not.toBe("");
          expect(tool.example.code.trim(), tool.id).not.toBe("");
        }
      }
    }
  });
});
