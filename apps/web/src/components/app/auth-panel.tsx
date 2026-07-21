"use client";

import { type FormEvent, type KeyboardEvent, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  AtSign,
  LogIn,
  ShieldCheck,
  UserPlus,
  UserRound,
  UserRoundCheck
} from "lucide-react";
import { AuthBrand } from "@/components/app/auth/auth-brand";
import { AuthRecoveryForm } from "@/components/app/auth/auth-recovery-form";
import { AuthPasswordField } from "@/components/app/auth/auth-password-field";
import { AuthShowcase } from "@/components/app/auth/auth-showcase";
import { ApiStatus } from "@/components/system/api-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getTabKeyboardTarget } from "@/lib/tab-keyboard-navigation";
import { cn } from "@/lib/utils";

export type AuthMode = "login" | "register";

const authModes = ["login", "register"] as const satisfies readonly AuthMode[];

interface AuthPanelProps {
  error: string | null;
  initialMode?: AuthMode;
  initialResetToken?: string | null;
  isSubmitting: boolean;
  onBack?: () => void;
  onClearError: () => void;
  onClearResetToken?: () => void;
  onDemoLogin: () => Promise<void>;
  onLogin: (input: { email: string; password: string }) => Promise<void>;
  onRegister: (input: { email: string; name: string; password: string }) => Promise<void>;
}

export function AuthPanel({
  error,
  initialMode = "login",
  initialResetToken = null,
  isSubmitting,
  onBack,
  onClearError,
  onClearResetToken,
  onDemoLogin,
  onLogin,
  onRegister
}: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [recoveryToken, setRecoveryToken] = useState<string | null>(initialResetToken);
  const [clientError, setClientError] = useState<string | null>(null);
  const displayedError = clientError ?? error;
  const isDemoAccessEnabled = process.env.NODE_ENV === "development";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClientError(null);

    const normalizedEmail = email.trim().toLowerCase();

    if (mode === "login") {
      await onLogin({ email: normalizedEmail, password });
      return;
    }

    const normalizedName = name.trim();

    if (!normalizedName) {
      setClientError("Enter your full name.");
      return;
    }

    if (password !== passwordConfirmation) {
      setClientError("Passwords do not match.");
      return;
    }

    await onRegister({ email: normalizedEmail, name: normalizedName, password });
  }

  function changeMode(nextMode: AuthMode) {
    if (nextMode === mode) {
      return;
    }

    setMode(nextMode);
    setPassword("");
    setPasswordConfirmation("");
    setClientError(null);
    onClearError();
  }

  function handleModeKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const nextMode = getTabKeyboardTarget(authModes, mode, event.key);

    if (!nextMode) {
      return;
    }

    event.preventDefault();
    changeMode(nextMode);
    document.getElementById(`auth-${nextMode}-tab`)?.focus();
  }

  async function handleDemoLogin() {
    setClientError(null);
    onClearError();
    await onDemoLogin();
  }

  function openPasswordRecovery() {
    setRecoveryToken("");
    setPassword("");
    setClientError(null);
    onClearError();
  }

  function closePasswordRecovery() {
    setRecoveryToken(null);
    setPassword("");
    setPasswordConfirmation("");
    setClientError(null);
    onClearError();
    onClearResetToken?.();
  }

  const isLogin = mode === "login";
  const isRecovery = recoveryToken !== null;
  const isReset = Boolean(recoveryToken);
  const heading = isRecovery
    ? isReset
      ? "Choose a new password"
      : "Reset your password"
    : isLogin
      ? "Welcome back"
      : "Create your account";
  const description = isRecovery
    ? isReset
      ? "Enter a new password to secure your ProofPilot account."
      : "Enter your account email and we will send a time-limited reset link."
    : isLogin
      ? "Sign in to continue building your appeal packet."
      : "Create a private workspace for your first appeal case.";

  return (
    <main className="grid min-h-[100svh] items-center bg-black/30 px-4 py-5 sm:px-6 md:px-8 md:py-8 lg:px-10 lg:py-10">
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(26rem,0.7fr)] lg:items-center">
        <AuthShowcase />

        <section aria-labelledby="auth-heading" className="mx-auto w-full max-w-xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="lg:hidden">
              <AuthBrand />
            </div>
            {onBack ? (
              <Button onClick={onBack} type="button" variant="ghost">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to overview
              </Button>
            ) : null}
            <div className="lg:hidden">
              <ApiStatus />
            </div>
          </div>

          <Card className="proof-accent-frame overflow-hidden">
            <CardHeader className="gap-5 p-5 sm:p-7 md:p-8 md:pb-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge variant="secondary">Private workspace</Badge>
                <div className="hidden lg:block">
                  <ApiStatus />
                </div>
              </div>

              <div>
                <h1
                  className="text-2xl font-semibold tracking-normal text-foreground sm:text-3xl"
                  id="auth-heading"
                >
                  {heading}
                </h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
              </div>

              {!isRecovery ? (
                <div
                  aria-label="Authentication mode"
                  className="grid grid-cols-2 rounded-md border border-border bg-secondary/30 p-1"
                  role="tablist"
                >
                  <button
                    aria-controls="auth-mode-panel"
                    aria-selected={isLogin}
                    className={cn(
                      "min-h-11 rounded-sm px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                      isLogin
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    disabled={isSubmitting}
                    id="auth-login-tab"
                    onClick={() => changeMode("login")}
                    onKeyDown={handleModeKeyDown}
                    role="tab"
                    tabIndex={isLogin ? 0 : -1}
                    type="button"
                  >
                    Sign in
                  </button>
                  <button
                    aria-controls="auth-mode-panel"
                    aria-selected={!isLogin}
                    className={cn(
                      "min-h-11 rounded-sm px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                      !isLogin
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    disabled={isSubmitting}
                    id="auth-register-tab"
                    onClick={() => changeMode("register")}
                    onKeyDown={handleModeKeyDown}
                    role="tab"
                    tabIndex={!isLogin ? 0 : -1}
                    type="button"
                  >
                    Create account
                  </button>
                </div>
              ) : null}
            </CardHeader>

            <CardContent className="p-5 pt-0 sm:p-7 sm:pt-0 md:p-8 md:pt-0">
              {isRecovery ? (
                <AuthRecoveryForm
                  onBackToLogin={closePasswordRecovery}
                  resetToken={recoveryToken || null}
                />
              ) : (
                <div
                  aria-labelledby={isLogin ? "auth-login-tab" : "auth-register-tab"}
                  id="auth-mode-panel"
                  role="tabpanel"
                >
                  <form aria-busy={isSubmitting} className="grid gap-4" onSubmit={handleSubmit}>
                    {!isLogin ? (
                      <div className="grid gap-2">
                        <Label htmlFor="auth-name">Full name</Label>
                        <div className="relative">
                          <UserRound
                            aria-hidden="true"
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary"
                          />
                          <Input
                            autoComplete="name"
                            className="min-h-12 pl-10"
                            id="auth-name"
                            maxLength={120}
                            name="name"
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Nicholas Kerr"
                            required
                            value={name}
                          />
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-2">
                      <Label htmlFor="auth-email">Email address</Label>
                      <div className="relative">
                        <AtSign
                          aria-hidden="true"
                          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary"
                        />
                        <Input
                          autoCapitalize="none"
                          autoComplete="email"
                          className="min-h-12 pl-10"
                          id="auth-email"
                          maxLength={254}
                          name="email"
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="you@example.com"
                          required
                          spellCheck={false}
                          type="email"
                          value={email}
                        />
                      </div>
                    </div>

                    <AuthPasswordField
                      autoComplete={isLogin ? "current-password" : "new-password"}
                      id="auth-password"
                      key={mode}
                      label="Password"
                      name="password"
                      onChange={(event) => setPassword(event.target.value)}
                      value={password}
                    />

                    {isLogin ? (
                      <div className="flex justify-end">
                        <Button
                          className="h-auto min-h-0 px-0 py-1 text-primary hover:bg-transparent hover:text-primary/80"
                          onClick={openPasswordRecovery}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Forgot password?
                        </Button>
                      </div>
                    ) : null}

                    {!isLogin ? (
                      <>
                        <AuthPasswordField
                          autoComplete="new-password"
                          id="auth-password-confirmation"
                          label="Confirm password"
                          name="passwordConfirmation"
                          onChange={(event) => setPasswordConfirmation(event.target.value)}
                          value={passwordConfirmation}
                        />
                        <p className="text-xs leading-5 text-muted-foreground">
                          Use at least 8 characters. Passwords can be up to 120 characters.
                        </p>
                      </>
                    ) : null}

                    {displayedError ? (
                      <p
                        className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100"
                        id="auth-form-error"
                        role="alert"
                      >
                        {displayedError}
                      </p>
                    ) : null}

                    <Button
                      className="mt-1 w-full"
                      disabled={isSubmitting}
                      size="lg"
                      type="submit"
                    >
                      {isLogin ? (
                        <LogIn aria-hidden="true" className="h-4 w-4" />
                      ) : (
                        <UserPlus aria-hidden="true" className="h-4 w-4" />
                      )}
                      {isSubmitting ? "Working..." : isLogin ? "Sign in" : "Create account"}
                      {!isSubmitting ? (
                        <ArrowRight aria-hidden="true" className="ml-auto h-4 w-4" />
                      ) : null}
                    </Button>
                  </form>

                  {isLogin && isDemoAccessEnabled ? (
                    <>
                      <div className="my-5 flex items-center gap-3">
                        <Separator className="flex-1" />
                        <span className="text-xs uppercase tracking-normal text-muted-foreground">
                          Demo access
                        </span>
                        <Separator className="flex-1" />
                      </div>
                      <Button
                        className="w-full"
                        disabled={isSubmitting}
                        onClick={handleDemoLogin}
                        type="button"
                        variant="outline"
                      >
                        <UserRoundCheck aria-hidden="true" className="h-4 w-4" />
                        Sign in with demo account
                      </Button>
                    </>
                  ) : null}

                  <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                    <ShieldCheck
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                    />
                    Authentication is stored in a secure HTTP-only session cookie.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
