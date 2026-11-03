import { publicPageMetadata } from "@/lib/metadata";
import ResourceLibrary from "@/components/resource-library";
import { RESOURCE_GUIDES } from "@/lib/resources";

export const metadata = publicPageMetadata("/resources", "Tutorials & Resources · dfCTF", "Explore cybersecurity topics, find tool guides, and follow learning paths from an introduction to optional practice.");

export default function ResourcesPage() {
  const guides = RESOURCE_GUIDES.map(({ id, title, summary, tools, deeper }) => ({
    id, title, summary, tools: [...tools, ...deeper].map(({ id, name, when, platform }) => ({ id, name, when, platform })),
  }));
  return <ResourceLibrary guides={guides} />;
}
