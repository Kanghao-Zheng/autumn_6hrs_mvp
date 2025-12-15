import { UploadZone } from "@/components/onboarding/UploadZone";

export function UploadOverlay() {
  return (
    <main className="relative h-screen bg-slate-50/50">
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/10 backdrop-blur-sm p-6">
        <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="text-xs font-semibold uppercase tracking-wide text-orange-600">
            Autumn Hotel OS
          </div>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Welcome to Autumn.
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Upload your reservation history (.csv) to generate your Knowledge Graph.
          </p>

          <div className="mt-6">
            <UploadZone />
          </div>
        </div>
      </div>
    </main>
  );
}

