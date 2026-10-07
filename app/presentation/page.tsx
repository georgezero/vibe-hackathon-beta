export const dynamic = "force-dynamic";

import { getPresentationLiveData } from "@/lib/presentation-data";
import { PresentationStage } from "@/components/presentation/PresentationStage";

export default async function PresentationPage() {
  const data = await getPresentationLiveData();
  return <PresentationStage initialData={data} />;
}
