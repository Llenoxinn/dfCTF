import { describe, expect, it } from "vitest";
import { RESOURCE_GUIDES } from "@/lib/resources";
import { CATEGORIES } from "@/lib/types";
import { GLOSSARY, LEARNING_PATHS, TOPIC_INFO, matchingTools, parseLearningProgress } from "@/lib/resource-learning";
import { LESSON_PLANS } from "@/lib/resource-lesson-plan";

describe("learning library", () => {
  it("gives every topic clear goals, a recap, and known prerequisites without cycles", () => {
    expect(Object.keys(LESSON_PLANS).sort()).toEqual(RESOURCE_GUIDES.map(guide => guide.id).sort());
    function visit(id: string, ancestors: string[] = []) {
      expect(ancestors).not.toContain(id);
      const lesson = LESSON_PLANS[id]; expect(lesson).toBeDefined();
      expect(lesson.goals).toHaveLength(3); expect(lesson.recap.length).toBeGreaterThanOrEqual(2);
      for (const prerequisite of lesson.prerequisites) visit(prerequisite, [...ancestors, id]);
    }
    for (const id of Object.keys(LESSON_PLANS)) visit(id);
  });
  it("gives every real topic a starting level, practice category, and a place in a learning path", () => {
    const ids = RESOURCE_GUIDES.map(guide => guide.id);
    expect(Object.keys(TOPIC_INFO).sort()).toEqual([...ids].sort());
    expect(new Set(LEARNING_PATHS.map(path => path.id)).size).toBe(LEARNING_PATHS.length);
    for (const path of LEARNING_PATHS) {
      expect(path.topics.length).toBeGreaterThan(1);
      expect(new Set(path.topics).size).toBe(path.topics.length);
      for (const topic of path.topics) expect(ids).toContain(topic);
    }
    for (const id of ids) {
      expect(CATEGORIES).toContain(TOPIC_INFO[id].category);
      expect(LEARNING_PATHS.some(path => path.topics.includes(id))).toBe(true);
      expect(TOPIC_INFO[id].practice.length).toBeGreaterThan(30);
    }
  });

  it("combines words and platform on the same tool, without hiding title matches", () => {
    const fixture = { id: "general-skills", title: "General skills", summary: "Learn files", tools: [
      { id: "powershell", name: "PowerShell 7", when: "Read local text", platform: "Windows" },
      { id: "cyberchef", name: "CyberChef", when: "Decode text", platform: "Browser" },
    ] };
    expect(matchingTools(fixture, " POWERSHELL text ", "Windows").map(tool => tool.id)).toEqual(["powershell"]);
    expect(matchingTools(fixture, "PowerShell", "Browser")).toEqual([]);
    expect(matchingTools(fixture, "PowerShell CyberChef", "")).toEqual([]);
    expect(matchingTools(fixture, "general SKILLS", "Browser").map(tool => tool.id)).toEqual(["cyberchef"]);
    expect(matchingTools(fixture, " ", "")).toHaveLength(2);
  });

  it("keeps glossary terms safe for whole-word matching and supplies useful explanations", () => {
    for (const [term, definition] of Object.entries(GLOSSARY)) {
      expect(term).toMatch(/^[a-z0-9 -]+$/i);
      expect(definition.length).toBeGreaterThan(40);
    }
  });
});

describe("saved learning progress", () => {
  it("accepts bounded known topics and plain identifiers while rejecting external destinations and object keys", () => {
    const saved = parseLearningProgress(JSON.stringify({ version: 1,
      bookmarks: ["general-skills", "general-skills/powershell", "general-skills", "__proto__", "https://example.test", "osint/../../admin"],
      completed: ["osint", "missing-topic", false, "osint"],
      open: { "general-skills": ["powershell", "powershell-exercise", "powershell", "<script>"], unknown: ["x"] },
      last: { topic: "general-skills", section: "general-skills-tools" },
    }));
    expect(saved).toEqual({ bookmarks: ["general-skills", "general-skills/powershell"], completed: ["osint"], open: { "general-skills": ["powershell", "powershell-exercise"] }, last: { topic: "general-skills", section: "general-skills-tools" } });
    expect(parseLearningProgress('{"version":1,"last":{"topic":"osint","section":"https://example.test"}}').last).toBeNull();
    expect(parseLearningProgress('{"version":1,"last":{"topic":"osint","section":"osint-basics","path":"foundations"}}').last?.path).toBe("foundations");
    expect(parseLearningProgress('{"version":1,"last":{"topic":"cryptography","section":"cryptography-basics","path":"foundations"}}').last?.path).toBeUndefined();
  });

  it("recovers from malformed, future, oversized, and unexpected storage without throwing", () => {
    for (const raw of [null, "{broken", "null", "[]", '"text"', '{"version":2,"bookmarks":["osint"]}', "x".repeat(100_001)]) {
      expect(parseLearningProgress(raw)).toEqual({ bookmarks: [], completed: [], open: {}, last: null });
    }
    expect(parseLearningProgress('{"version":1,"bookmarks":{},"completed":null,"open":[],"last":42}')).toEqual({ bookmarks: [], completed: [], open: {}, last: null });
  });
});
