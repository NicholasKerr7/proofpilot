"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ApiStatus } from "@/components/system/api-status";

type AuthMode = "login" | "register";

interface AuthPanelProps {
  error: string | null;
  isSubmitting: boolean;
  onLogin: (input: { email: string; password: string }) => Promise<void>;
  onRegister: (input: { email: string; name: string; password: string }) => Promise<void>;
}

export function AuthPanel({ error, isSubmitting, onLogin, onRegister }: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>("register");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    if (mode === "login") {
      await onLogin({ email, password });
      return;
    }

    await onRegister({
      email,
      name: String(formData.get("name") ?? ""),
      password
    });
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-6">
      <div className="grid w-full max-w-5xl gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.65fr)] lg:items-center">
        <section className="rounded-lg border border-border bg-card/70 p-5 backdrop-blur sm:p-7">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <Badge>Account Ban / Appeal Builder</Badge>
            <ApiStatus />
          </div>
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-md border border-primary/35 bg-primary/15 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="max-w-2xl text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
            Build a professional appeal packet from screenshots, emails, PDFs, and notes.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
            Create a private case, capture evidence, track missing proof, draft the statement,
            and prepare a packet export.
          </p>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>{mode === "login" ? "Log in" : "Create account"}</CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Access your private cases."
                : "Start the first Account Ban appeal case."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleSubmit}>
              {mode === "register" ? (
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" autoComplete="name" placeholder="Case owner" />
                </div>
              ) : null}
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="owner@example.com"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={8}
                  required
                />
              </div>

              {error ? (
                <p className="rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
                  {error}
                </p>
              ) : null}

              <Button type="submit" disabled={isSubmitting}>
                {mode === "login" ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                {isSubmitting ? "Working..." : mode === "login" ? "Log in" : "Create account"}
              </Button>
            </form>

            <Separator className="my-5" />

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? "Create a new account" : "Use an existing account"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
