import { importAllLocalStores } from "@/lib/importers/local-stores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const result = await importAllLocalStores();

  return Response.json(result, { status: result.success ? 200 : 207 });
}
