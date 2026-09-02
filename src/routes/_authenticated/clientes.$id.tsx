import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/clientes/$id")({
  beforeLoad: () => {
    throw redirect({ to: "/empresas" });
  },
  component: () => null,
});
