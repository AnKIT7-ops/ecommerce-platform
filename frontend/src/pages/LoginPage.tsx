import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Button, Input } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { ApiError } from "../services";
import { AuthShell } from "./AuthShell";

interface LocationState {
  from?: { pathname: string; search?: string };
}

export function LoginPage() {
  useDocumentTitle("Sign in");
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Where the user was heading before being asked to sign in.
  const state = location.state as LocationState | null;
  const destination = state?.from
    ? `${state.from.pathname}${state.from.search ?? ""}`
    : "/products";

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!email.trim()) errors.email = "Enter your email address.";
    else if (!email.includes("@")) errors.email = "Enter a valid email address.";
    if (!password) errors.password = "Enter your password.";

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(destination, { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFieldErrors(caught.fieldErrors);
        setFormError(caught.message);
      } else {
        setFormError("Could not sign in. Try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to your account"
      subtitle="Your cart and order history are waiting."
      footer={
        <>
          New here?{" "}
          <Link
            to="/register"
            state={location.state}
            className="font-semibold text-volt hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && (
          <p
            role="alert"
            className="rounded-[6px] border border-signal/25 bg-signal-tint px-4 py-3 text-sm font-medium text-signal"
          >
            {formError}
          </p>
        )}

        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email}
          placeholder="you@example.com"
        />

        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
          placeholder="Your password"
        />

        <Button type="submit" size="lg" fullWidth isLoading={isSubmitting}>
          {isSubmitting ? "Signing in" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}
