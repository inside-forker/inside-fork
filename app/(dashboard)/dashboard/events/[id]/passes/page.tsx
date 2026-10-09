import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PassesPageProps {
  params: Promise<{ id: string }>;
}

export default async function EventPassesPage({ params }: PassesPageProps) {
  const resolvedParams = await params;
  redirect(`/dashboard/events/${resolvedParams.id}/tickets`);
}
