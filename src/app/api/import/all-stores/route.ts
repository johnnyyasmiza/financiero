export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    if (process.env.VERCEL === "1") {
      return Response.json({
        success: false,
        ok: false,
        message: "Import local des magasins desactive sur Vercel. Lance cette route en local avec le dossier imports/.",
      });
    }

    const { importAllLocalStores } = await import("@/lib/importers/local-stores");
    const result = await importAllLocalStores();

    return Response.json(result, { status: result.success ? 200 : 207 });
  } catch (error) {
    return Response.json(
      {
        success: false,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return POST();
}
