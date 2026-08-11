import { JOURNEYSYNC_BUILD_ID } from "../../release-version";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json(
    { version: JOURNEYSYNC_BUILD_ID },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Expires: "0",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
