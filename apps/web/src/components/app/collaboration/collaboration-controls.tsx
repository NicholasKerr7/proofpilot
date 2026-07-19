import {
  Download,
  Eye,
  FileClock,
  LockKeyhole,
  PencilLine,
  ScrollText,
  UploadCloud,
  type LucideIcon
} from "lucide-react";
import {
  caseInvitationExpiryOptions,
  type CaseCollaborationSettings,
  type CaseInvitationExpiryDays,
  type UpdateCaseCollaborationSettingsInput
} from "@proofpilot/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

interface CollaborationControlsProps {
  pendingAction: string | null;
  settings: CaseCollaborationSettings;
  onUpdate: (input: UpdateCaseCollaborationSettingsInput) => Promise<void>;
  onViewActivity: () => void;
}

export function CollaborationControls({
  pendingAction,
  settings,
  onUpdate,
  onViewActivity
}: CollaborationControlsProps) {
  const isUpdating = pendingAction === "settings";

  return (
    <Card>
      <CardHeader className="p-4 pb-3">
        <CardTitle className="text-sm uppercase text-primary">Sharing controls</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-0 p-4 pt-0">
        <ControlRow
          detail="Case data stays private and owner-controlled."
          icon={LockKeyhole}
          label="Secure sharing"
        >
          <Badge variant={settings.secureSharing ? "success" : "warning"}>
            {settings.secureSharing ? "Always on" : "Off"}
          </Badge>
        </ControlRow>
        <Separator />
        <ControlRow
          detail="Every collaboration change is recorded."
          icon={ScrollText}
          label="Access logging"
        >
          <Badge variant={settings.accessLogging ? "success" : "warning"}>
            {settings.accessLogging ? "Always on" : "Off"}
          </Badge>
        </ControlRow>
        <Separator />
        <ControlRow
          detail="Sets the policy for future collaborator access."
          icon={Download}
          label="Prevent downloads"
        >
          <Switch
            aria-label="Prevent collaborator downloads"
            checked={settings.preventDownloads}
            disabled={isUpdating}
            onCheckedChange={(checked) => {
              void onUpdate({ preventDownloads: checked });
            }}
          />
        </ControlRow>
        <Separator />
        <ControlRow
          detail="Pending invitations expire automatically."
          icon={FileClock}
          label="Invitation expiration"
        >
          <Label className="sr-only" htmlFor="invitation-expiry">
            Invitation expiration
          </Label>
          <Select
            className="h-10 min-h-10 w-24 text-xs"
            disabled={isUpdating}
            id="invitation-expiry"
            onChange={(event) => {
              void onUpdate({
                invitationExpiryDays: Number(event.target.value) as CaseInvitationExpiryDays
              });
            }}
            value={String(settings.invitationExpiryDays)}
          >
            {caseInvitationExpiryOptions.map((days) => (
              <option key={days} value={days}>
                {days} {days === 1 ? "day" : "days"}
              </option>
            ))}
          </Select>
        </ControlRow>

        <div className="mt-4 border-t border-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase text-primary">Permissions</h3>
            <Badge variant="warning">Policy preview</Badge>
          </div>
          <div className="mt-2 divide-y divide-border">
            <PermissionRow icon={Eye} label="View case & documents" value="Viewer + Editor" />
            <PermissionRow icon={PencilLine} label="Edit case information" value="Editor" />
            <PermissionRow icon={UploadCloud} label="Upload & manage files" value="Editor" />
            <PermissionRow
              icon={Download}
              label="Download packet"
              value={settings.preventDownloads ? "Blocked" : "Allowed"}
            />
          </div>
        </div>

        <Button className="mt-4" onClick={onViewActivity} type="button" variant="outline">
          <ScrollText aria-hidden="true" className="h-4 w-4" />
          View access activity
        </Button>
      </CardContent>
    </Card>
  );
}

interface ControlRowProps {
  children: React.ReactNode;
  detail: string;
  icon: LucideIcon;
  label: string;
}

function ControlRow({ children, detail, icon: Icon, label }: ControlRowProps) {
  return (
    <div className="grid min-h-20 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3 first:pt-0">
      <span className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
        <Icon aria-hidden="true" className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{detail}</span>
      </span>
      {children}
    </div>
  );
}

function PermissionRow({
  icon: Icon,
  label,
  value
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-2">
      <Icon aria-hidden="true" className="h-4 w-4 text-primary" />
      <span className="text-sm text-foreground">{label}</span>
      <span className="text-xs font-medium text-muted-foreground">{value}</span>
    </div>
  );
}
