import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ResourceReader from "@/components/resource-reader";
import { RESOURCE_GUIDES } from "@/lib/resources";
import { LEARNING_PATHS } from "@/lib/resource-learning";

type Props = { params: Promise<{ topic: string }>; searchParams: Promise<{ path?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { topic } = await params;
  const guide = RESOURCE_GUIDES.find(guide => guide.id === topic);
  if (!guide) notFound();
  return { title: `${guide.title} · Tutorials & Resources · dfCTF`, description: guide.summary };
}

export default async function TopicPage({ params, searchParams }: Props) {
  const [{ topic }, query] = await Promise.all([params, searchParams]);
  const guide = RESOURCE_GUIDES.find(guide => guide.id === topic);
  if (!guide) notFound();
  const path = LEARNING_PATHS.find(path => path.id === query.path && path.topics.includes(topic));
  const sequence = path ? path.topics.map(id => RESOURCE_GUIDES.find(guide => guide.id === id)!) : RESOURCE_GUIDES;
  const position = sequence.findIndex(guide => guide.id === topic);
  const neighbor = (index: number) => sequence[index] ? { id: sequence[index].id, title: sequence[index].title } : undefined;
  return <ResourceReader key={guide.id} guide={guide} previous={neighbor(position - 1)} next={neighbor(position + 1)} path={path ? { id: path.id, title: path.title, position: position + 1, total: sequence.length } : undefined} />;
}
