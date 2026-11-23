import { createFileRoute } from "@tanstack/react-router";
import { handleAethiApi } from "@/lib/aethi-api.server";

const handle = ({ request }: { request: Request }) => handleAethiApi(request);

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
    },
  },
});
