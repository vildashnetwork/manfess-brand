import { createFileRoute } from "@tanstack/react-router";
import { SpaHost } from "@/SpaHost";

export const Route = createFileRoute("/")({
  component: SpaHost,
});