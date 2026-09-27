"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, Card, CardBody, Field, Input } from "@/components/ui/primitives";
import { api, ApiClientError } from "@/lib/client";

function useSubmit() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setLoading(true);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  };
  return { error, loading, run };
}

export function LoginForm() {
  const { error, loading, run } = useSubmit();
  const router = useRouter();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    run(async () => {
      await api("/api/auth/login", {
        method: "POST",
        body: { email: fd.get("email"), password: fd.get("password") },
      });
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next?.startsWith("/") ? next : "/dashboard");
    });
  };
  return (
    <Card>
      <CardBody className="pt-5">
        <h1 className="text-lg font-semibold">Sign in to GigFlow</h1>
        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <Field label="Email"><Input name="email" type="email" required autoComplete="email" /></Field>
          <Field label="Password"><Input name="password" type="password" required autoComplete="current-password" /></Field>
          {error && <p className="text-sm text-negative" role="alert">{error}</p>}
          <Button className="w-full" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</Button>
        </form>
        <div className="mt-4 flex justify-between text-xs text-muted">
          <Link href="/forgot-password" className="hover:text-fg">Forgot password?</Link>
          <Link href="/register" className="hover:text-fg">Create account</Link>
        </div>
      </CardBody>
    </Card>
  );
}

export function RegisterForm() {
  const { error, loading, run } = useSubmit();
  const router = useRouter();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    run(async () => {
      await api("/api/auth/register", {
        method: "POST",
        body: { email: fd.get("email"), password: fd.get("password"), name: fd.get("name") },
      });
      router.push("/onboarding");
    });
  };
  return (
    <Card>
      <CardBody className="pt-5">
        <h1 className="text-lg font-semibold">Create your account</h1>
        <p className="text-xs text-muted mt-1">Free while GigFlow is in early access.</p>
        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <Field label="Name"><Input name="name" autoComplete="name" placeholder="What should we call you?" /></Field>
          <Field label="Email"><Input name="email" type="email" required autoComplete="email" /></Field>
          <Field label="Password" hint="8+ characters, letters and numbers">
            <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
          </Field>
          {error && <p className="text-sm text-negative" role="alert">{error}</p>}
          <Button className="w-full" disabled={loading}>{loading ? "Creating…" : "Create account"}</Button>
        </form>
        <p className="mt-4 text-xs text-muted text-center">
          Already have an account? <Link href="/login" className="text-accent">Sign in</Link>
        </p>
      </CardBody>
    </Card>
  );
}

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      await api("/api/auth/forgot-password", {
        method: "POST",
        body: { email: new FormData(e.currentTarget).get("email") },
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Card>
      <CardBody className="pt-5">
        <h1 className="text-lg font-semibold">Reset your password</h1>
        {sent ? (
          <p className="mt-4 text-sm text-muted">
            If an account exists for that email, a reset link is on its way.
            In development, the link is printed to the server console.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <Field label="Email"><Input name="email" type="email" required autoComplete="email" /></Field>
            {error && <p className="text-sm text-negative" role="alert">{error}</p>}
            <Button className="w-full" disabled={loading}>{loading ? "Sending…" : "Send reset link"}</Button>
          </form>
        )}
        <p className="mt-4 text-xs text-muted"><Link href="/login" className="hover:text-fg">← Back to sign in</Link></p>
      </CardBody>
    </Card>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (fd.get("password") !== fd.get("confirm")) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true); setError(null);
    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        body: { token, password: fd.get("password") },
      });
      router.push("/login?reset=1");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong.");
      setLoading(false);
    }
  };
  return (
    <Card>
      <CardBody className="pt-5">
        <h1 className="text-lg font-semibold">Choose a new password</h1>
        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <Field label="New password" hint="8+ characters, letters and numbers">
            <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
          </Field>
          <Field label="Confirm password"><Input name="confirm" type="password" required autoComplete="new-password" /></Field>
          {error && <p className="text-sm text-negative" role="alert">{error}</p>}
          <Button className="w-full" disabled={loading}>{loading ? "Updating…" : "Update password"}</Button>
        </form>
      </CardBody>
    </Card>
  );
}

export function VerifyEmail({ token }: { token?: string }) {
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");
  const verify = async (t: string) => {
    try {
      await api("/api/auth/verify-email", { method: "POST", body: { token: t } });
      setState("ok");
    } catch (e) {
      setState("err");
      setMsg(e instanceof ApiClientError ? e.message : "Verification failed.");
    }
  };
  return (
    <Card>
      <CardBody className="pt-5">
        <h1 className="text-lg font-semibold">Verify your email</h1>
        {state === "ok" ? (
          <>
            <p className="mt-4 text-sm text-muted">Your email is verified — you are all set.</p>
            <Link href="/dashboard" className="block mt-5"><Button className="w-full">Go to dashboard</Button></Link>
          </>
        ) : state === "err" ? (
          <>
            <p className="mt-4 text-sm text-negative">{msg}</p>
            <p className="mt-2 text-xs text-muted">You can request a new link from Settings → Account.</p>
          </>
        ) : token ? (
          <div className="mt-5">
            <Button className="w-full" onClick={() => verify(token)}>Verify my email</Button>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">
            Check your inbox for a verification link. In development, the link is printed to the server console.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
