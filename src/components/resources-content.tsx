"use client";

import ResourceLibrary from "./resource-library";
import { RESOURCE_GUIDES } from "@/lib/resources";

export default function ResourcesContent() {
  const guides = RESOURCE_GUIDES.map(({ id, title, summary, tools, deeper }) => ({
    id, title, summary, tools: [...tools, ...deeper].map(({ id, name, when, platform }) => ({ id, name, when, platform })),
  }));
  return <ResourceLibrary guides={guides} />;
}
