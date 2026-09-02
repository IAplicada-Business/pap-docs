import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEmpresa } from "@/hooks/use-perfil";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/empresas/$id")({
  component: EmpresaLayout,
});

function EmpresaLayout() {
  const { id } = Route.useParams();
  const { data: empresa, isLoading } = useEmpresa(id);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (!empresa) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Empresa nao encontrada</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A empresa solicitada nao existe ou voce nao tem acesso.
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
