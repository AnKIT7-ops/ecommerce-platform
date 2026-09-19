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

/** Matches the backend's bcrypt ceiling, which counts bytes rather than characters. */
const MAX_PASSWORD_BYTES = 72;

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function RegisterPage() {
  useDocumentTitle("Create an account");
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const state = location.state as LocationState | null;
  const destination = state?.from
    ? `${state.from.pathname}${state.from.search ?? ""}`
    : "/products";

  function validate(): boolean {
    const errors: Record<string, string> = {};

    if (!fullName.trim()) errors.fullName = "Enter your name.";

    if (!email.trim()) errors.email = "Enter your email address.";
    else if (!/^\S+@\S+\.\S+$/.test(email.trim()))
      errors.email = "Enter a valid email address.";

    if (!password) errors.password = "Choose a password.";
    else if (password.length < 8)
      errors.password = "Use at least 8 characters.";
    else if (byteLength(password) > MAX_PASSWORD_BYTES)
      errors.password = "That password is too long. Use fewer, or simpler, characters.";

    if (confirmPassword !== password)
      errors.confirmPassword = "Both passwords must match.";

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await register(email.trim(), password, fullName.trim());
      navigate(destination, { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFieldErrors(caught.fieldErrors);
        setFormError(caught.message);
      } else {
        setFormError("Could not create your account. Try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Get started"
      title="Create your account"
      subtitle="You need an account to build a cart and place orders."
      footer={
        <>
          Already have an account?{" "}
          <Link
            to="/login"
            state={location.state}
            className="font-semibold text-volt hover:underline"
          >
            Sign in
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
          label="Full name"
          type="text"
          name="name"
          autoComplete="name"
          required
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          error={fieldErrors.fullName ?? fieldErrors.full_name}
          placeholder="How should we address you?"
        />

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
          name="new-password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
          hint="At least 8 characters."
          placeholder="Choose a password"
        />

        <Input
          label="Confirm password"
          type="password"
          name="confirm-password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={fieldErrors.confirmPassword}
          placeholder="Repeat your password"
        />

        <Button type="submit" size="lg" fullWidth isLoading={isSubmitting}>
          {isSubmitting ? "Creating account" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
