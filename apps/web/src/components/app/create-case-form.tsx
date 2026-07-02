"use client";

import { FormEvent } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CreateCasePayload } from "@/lib/client/types";

interface CreateCaseFormProps {
  isSubmitting: boolean;
  onCreateCase: (payload: CreateCasePayload) => Promise<void>;
}

export function CreateCaseForm({ isSubmitting, onCreateCase }: CreateCaseFormProps) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const deadline = String(formData.get("deadline") ?? "");
    const payload: CreateCasePayload = {
      title: String(formData.get("title") ?? ""),
      platform: String(formData.get("platform") ?? ""),
      summary: String(formData.get("summary") ?? ""),
      caseTypeSlug: "account-ban-appeal"
    };

    if (deadline) {
      payload.deadline = new Date(`${deadline}T12:00:00`).toISOString();
    }

    await onCreateCase(payload);
    form.reset();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create case</CardTitle>
        <CardDescription>Open a private Account Ban appeal workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="case-title">Case title</Label>
            <Input
              id="case-title"
              name="title"
              minLength={3}
              placeholder="PayPal account closure appeal"
              required
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="platform">Platform</Label>
              <Input id="platform" name="platform" placeholder="PayPal" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deadline">Deadline</Label>
              <Input id="deadline" name="deadline" type="date" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="summary">Situation summary</Label>
            <Textarea
              id="summary"
              name="summary"
              placeholder="Account was closed after a payment review and I need to submit evidence."
            />
          </div>
          <Button type="submit" disabled={isSubmitting}>
            <Plus className="h-4 w-4" />
            {isSubmitting ? "Creating..." : "Create case"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
