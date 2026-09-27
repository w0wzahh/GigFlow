import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 text-center">
      <Logo />
      <h1 className="text-2xl font-semibold tracking-tight mt-8">Page not found</h1>
      <p className="text-sm text-muted mt-2 max-w-sm">The page you are looking for does not exist or was moved.</p>
      <Link href="/" className="mt-6"><Button>Back to GigFlow</Button></Link>
    </div>
  );
}
