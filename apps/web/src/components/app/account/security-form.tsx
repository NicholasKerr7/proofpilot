import { CheckCircle2 } from "lucide-react";
import { PasswordChangeForm } from "@/components/app/account/password-change-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SecurityForm() {
  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.65fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Confirm your current password before setting a new one.</CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordChangeForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password guidance</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <GuidanceItem text="Use at least 8 characters." />
          <GuidanceItem text="Choose a password you do not use elsewhere." />
          <GuidanceItem text="Your current browser stays signed in after the change." />
        </CardContent>
      </Card>
    </div>
  );
}

function GuidanceItem({ text }: { text: string }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
      <CheckCircle2 className="mt-0.5 h-4 w-4 text-teal-300" aria-hidden="true" />
      <p className="text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}
