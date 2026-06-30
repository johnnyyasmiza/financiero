export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    if (process.env.VERCEL === "1") {
      return Response.json({
        ok: false,
        diagnostics: [],
        message: "Diagnostic des imports locaux desactive sur Vercel. Le dossier imports/ est uniquement disponible en local.",
      });
    }

    const { getImportDiagnostics } = await import("@/lib/importers/local-stores");
    return Response.json({ ok: true, diagnostics: await getImportDiagnostics() });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        diagnostics: [],
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
