import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/competencias")({
  beforeLoad: () => {
    throw redirect({ to: "/empresas" });
  },
  component: () => null,
});
