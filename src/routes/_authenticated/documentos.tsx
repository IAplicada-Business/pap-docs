import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/documentos")({
  beforeLoad: () => {
    throw redirect({ to: "/empresas" });
  },
  component: () => null,
});
