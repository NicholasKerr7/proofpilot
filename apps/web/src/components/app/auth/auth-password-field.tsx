"use client";

import { type ChangeEventHandler, useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AuthPasswordFieldProps {
  autoComplete: "current-password" | "new-password";
  id: string;
  label: string;
  name: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  value: string;
}

export function AuthPasswordField({
  autoComplete,
  id,
  label,
  name,
  onChange,
  value
}: AuthPasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const visibilityLabel = isVisible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <LockKeyhole
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary"
        />
        <Input
          autoComplete={autoComplete}
          className="min-h-12 pl-10 pr-12"
          id={id}
          maxLength={120}
          minLength={8}
          name={name}
          onChange={onChange}
          required
          type={isVisible ? "text" : "password"}
          value={value}
        />
        <Button
          aria-label={visibilityLabel}
          className="absolute right-0 top-1/2 -translate-y-1/2"
          onClick={() => setIsVisible((currentValue) => !currentValue)}
          size="icon"
          title={visibilityLabel}
          type="button"
          variant="ghost"
        >
          {isVisible ? (
            <EyeOff aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Eye aria-hidden="true" className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
