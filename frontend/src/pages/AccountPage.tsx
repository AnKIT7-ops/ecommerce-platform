import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Badge, Button, Input } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import { PageHeader } from "../components/PageHeader";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { ApiError, authService } from "../services";
import { formatDate } from "../utils/format";

export function AccountPage() {
  useDocumentTitle("Your account");
  const navigate = useNavigate();
  const { user, logout, setUser } = useAuth();
  const { itemCount } = useCart();

  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [didSave, setDidSave] = useState(false);

  if (!user) return null;

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    setDidSave(false);
    try {
      setUser(await authService.updateProfile(fullName.trim()));
      setDidSave(true);
    } catch (caught) {
      setSaveError(
        caught instanceof ApiError ? caught.message : "Could not save your details.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleSignOut() {
    logout();
    navigate("/");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Account"
        title={user.full_name || "Your account"}
        meta={user.email}
      />

      <section className="rounded-[6px] border border-hairline bg-paper p-6">
        <h2 className="display-wide text-base font-bold text-ink">Account details</h2>

        <dl className="mt-5 grid gap-px overflow-hidden rounded-[6px] border border-hairline bg-hairline sm:grid-cols-3">
          <div className="bg-paper px-4 py-3">
            <dt className="eyebrow label-narrow">Member since</dt>
            <dd className="tabular mt-1 text-sm text-ink">{formatDate(user.created_at)}</dd>
          </div>
          <div className="bg-paper px-4 py-3">
            <dt className="eyebrow label-narrow">Account type</dt>
            <dd className="mt-1">
              <Badge
                className={
                  user.role === "admin"
                    ? "bg-ink text-paper"
                    : "bg-volt-tint text-volt-dark"
                }
              >
                {user.role}
              </Badge>
            </dd>
          </div>
          <div className="bg-paper px-4 py-3">
            <dt className="eyebrow label-narrow">In your cart</dt>
            <dd className="tabular mt-1 text-sm text-ink">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </dd>
          </div>
        </dl>

        <form onSubmit={handleSave} className="mt-6 max-w-sm space-y-4">
          <Input
            label="Full name"
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="How should we address you?"
          />

          <Input
            label="Email"
            type="email"
            value={user.email}
            disabled
            hint="Your sign-in email cannot be changed here."
          />

          {saveError && (
            <p role="alert" className="text-sm font-medium text-signal">
              {saveError}
            </p>
          )}
          <div aria-live="polite">
            {didSave && <p className="text-sm font-medium text-good">Details saved.</p>}
          </div>

          <Button type="submit" isLoading={isSaving}>
            {isSaving ? "Saving" : "Save changes"}
          </Button>
        </form>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link
          to="/orders"
          className="rounded-[6px] border border-hairline bg-paper p-5 transition-colors hover:border-ink"
        >
          <p className="text-sm font-bold text-ink">Order history</p>
          <p className="mt-1 text-sm text-muted">Track what you have bought and its status.</p>
        </Link>
        <Link
          to="/cart"
          className="rounded-[6px] border border-hairline bg-paper p-5 transition-colors hover:border-ink"
        >
          <p className="text-sm font-bold text-ink">Your cart</p>
          <p className="mt-1 text-sm text-muted">
            {itemCount > 0
              ? `${itemCount} ${itemCount === 1 ? "item" : "items"} waiting for checkout.`
              : "Nothing in it yet."}
          </p>
        </Link>
      </section>

      <section className="mt-6 rounded-[6px] border border-hairline bg-paper p-6">
        <h2 className="display-wide text-base font-bold text-ink">Sign out</h2>
        <p className="mt-1 text-sm text-muted">
          Signing out clears your session on this device. Your cart is kept on the server.
        </p>
        <Button variant="secondary" className="mt-4" onClick={handleSignOut}>
          Sign out
        </Button>
      </section>
    </div>
  );
}
