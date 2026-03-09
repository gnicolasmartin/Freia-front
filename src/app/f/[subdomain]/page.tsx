"use client";

import { use, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useFronts } from "@/providers/FrontsProvider";
import FrontRenderer from "@/components/fronts/FrontRenderer";
import FrontResetPasswordScreen from "@/components/fronts/FrontResetPasswordScreen";
import { Globe, AlertTriangle, Construction } from "lucide-react";

interface Props {
  params: Promise<{ subdomain: string }>;
}

export default function PublicFrontPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-900">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#dd7430]" />
        </div>
      }
    >
      <PublicFrontPageInner params={params} />
    </Suspense>
  );
}

function PublicFrontPageInner({ params }: Props) {
  const { subdomain } = use(params);
  const searchParams = useSearchParams();
  const resetToken = searchParams.get("reset");
  const { fronts, isLoading } = useFronts();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#dd7430]" />
      </div>
    );
  }

  // Find the front by subdomain
  const front = fronts.find((f) => f.subdomain.toLowerCase() === subdomain.toLowerCase());

  // Not found
  if (!front) {
    return <FrontErrorPage type="not-found" subdomain={subdomain} />;
  }

  // Not published (draft)
  if (front.status !== "published" || !front.publishedVersionId) {
    return <FrontErrorPage type="not-published" subdomain={subdomain} frontName={front.name} />;
  }

  // Get the published version
  const version = front.versions.find((v) => v.id === front.publishedVersionId);
  if (!version) {
    return <FrontErrorPage type="maintenance" subdomain={subdomain} frontName={front.name} />;
  }

  // Password reset flow
  if (resetToken) {
    return <FrontResetPasswordScreen front={front} version={version} resetToken={resetToken} />;
  }

  return <FrontRenderer front={front} version={version} />;
}

// --- Error pages ---

function FrontErrorPage({
  type,
  subdomain,
  frontName,
}: {
  type: "not-found" | "not-published" | "maintenance";
  subdomain: string;
  frontName?: string;
}) {
  const config = {
    "not-found": {
      icon: Globe,
      title: "Sitio no encontrado",
      description: `No existe un front configurado para "${subdomain}.freiatech.com".`,
      color: "text-slate-400",
    },
    "not-published": {
      icon: AlertTriangle,
      title: "No disponible",
      description: `${frontName ?? "Este front"} no está publicado actualmente.`,
      color: "text-amber-400",
    },
    maintenance: {
      icon: Construction,
      title: "En mantenimiento",
      description: `${frontName ?? "Este front"} está temporalmente fuera de servicio.`,
      color: "text-sky-400",
    },
  };

  const { icon: Icon, title, description, color } = config[type];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700">
            <Icon className={`size-12 ${color}`} />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">{title}</h1>
        <p className="text-slate-400 mb-8">{description}</p>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm hover:border-slate-600 transition-colors"
        >
          Ir al inicio
        </a>
        <p className="mt-8 text-xs text-slate-600">
          Powered by Freia
        </p>
      </div>
    </div>
  );
}
