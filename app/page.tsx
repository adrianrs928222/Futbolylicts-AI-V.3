import Dashboard from "@/components/Dashboard";
import { dateInMadrid } from "@/lib/date";
import { buildDailyAnalysis } from "@/lib/engine/analyze";

export const dynamic = "force-dynamic";

export default async function Home() {
  const analysis = await buildDailyAnalysis(dateInMadrid());
  return <Dashboard analysis={analysis} />;
}
