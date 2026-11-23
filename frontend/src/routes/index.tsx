import { createFileRoute } from "@tanstack/react-router";
import App from "@/aethex/App";

export const Route = createFileRoute("/")({
  component: App,
});
