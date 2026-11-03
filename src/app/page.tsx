import Workspace from "@/components/workspace";
import { publicPageMetadata, SITE_DESCRIPTION, SITE_TITLE } from "@/lib/metadata";
export const dynamic="force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const privateView = query.auth || query.token || query.reset || query.error || query.returnTo || query.challenge || (query.view && query.view !== "home");
  return { ...publicPageMetadata("/", SITE_TITLE, SITE_DESCRIPTION), ...(privateView ? { robots: { index: false, follow: false } } : {}) };
}

export default function Page() {
  return <Workspace />;
}
