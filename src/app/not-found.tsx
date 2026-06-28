import Link from "next/link";
import { Zap, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center">
        <Zap className="w-8 h-8 text-primary" />
      </div>
      <div>
        <h1 className="text-6xl font-black text-foreground mb-2">404</h1>
        <p className="text-xl font-semibold text-foreground mb-1">Page not found</p>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center gap-2 btn-primary text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Store
      </Link>
    </div>
  );
}
