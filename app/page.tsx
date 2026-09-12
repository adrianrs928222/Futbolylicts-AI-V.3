import Dashboard from "@/components/Dashboard";
import { dateInMadrid } from "@/lib/date";
import { buildCurrentOrNextAnalysis } from "@/lib/engine/analyze";
import { captureDailyAnalysis } from "@/lib/ml/service";

export const dynamic = "force-dynamic";

export default async function Home() {
  const analysis = await buildCurrentOrNextAnalysis(dateInMadrid());
  await captureDailyAnalysis(analysis);
  return <Dashboard analysis={analysis} />;
}
