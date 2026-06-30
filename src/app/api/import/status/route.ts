import { getImportDiagnostics } from "@/lib/importers/local-stores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ diagnostics: await getImportDiagnostics() });
}
