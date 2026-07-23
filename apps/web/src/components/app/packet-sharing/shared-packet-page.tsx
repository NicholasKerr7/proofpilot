"use client";

import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import Image from "next/image";
import {
  CalendarClock,
  CheckCircle2,
  Download,
  ExternalLink,
  FileCheck2,
  KeyRound,
  LockKeyhole,
  MailCheck,
  MessageSquareText,
  Send,
  ShieldCheck
} from "lucide-react";
import type {
  PacketShareAccessResponse,
  PacketShareAccessRequestResponse,
  PacketShareCommentRecord,
  PacketShareContentResponse,
  PublicPacketShareMetadata
} from "@proofpilot/types";
import {
  formatPacketShareBytes,
  formatPacketShareDate,
  getPacketSharePermissionLabel
} from "@/components/app/packet-sharing/packet-sharing-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/client/api";

type LoadState = "loading" | "ready" | "error";

export function SharedPacketPage() {
  const token = useSyncExternalStore(subscribeToHash, readHashToken, () => null);

  return <SharedPacketSession key={token ?? "pending"} token={token} />;
}

function SharedPacketSession({ token }: { token: string | null }) {
  const [metadata, setMetadata] = useState<PublicPacketShareMetadata | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [email, setEmail] = useState("");
  const [access, setAccess] = useState<PacketShareAccessResponse | null>(null);
  const [challenge, setChallenge] = useState<
    Extract<PacketShareAccessRequestResponse, { status: "CODE_REQUIRED" }> | null
  >(null);
  const [code, setCode] = useState("");
  const [content, setContent] = useState<PacketShareContentResponse | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (!token) {
      return undefined;
    }

    async function loadMetadata() {
      try {
        const nextMetadata = await apiRequest<PublicPacketShareMetadata>(
          "/api/public/packet-shares/metadata",
          {
            body: JSON.stringify({ token }),
            method: "POST"
          }
        );

        if (isMounted) {
          setMetadata(nextMetadata);
          setLoadState("ready");
        }
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "This shared packet could not be opened."
          );
          setLoadState("error");
        }
      }
    }

    void loadMetadata();

    return () => {
      isMounted = false;
    };
  }, [token]);

  async function handleAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await apiRequest<PacketShareAccessRequestResponse>(
        "/api/public/packet-shares/access/request",
        {
          body: JSON.stringify({ email, token }),
          method: "POST"
        }
      );
      if (response.status === "CODE_REQUIRED") {
        setChallenge(response);
        setCode(response.developmentCode ?? "");
        return;
      }

      const nextAccess = response.access;
      const nextContent = await loadPacketContent(token, nextAccess.accessToken);
      setAccess(nextAccess);
      setContent(nextContent);
    } catch (accessError) {
      setError(
        accessError instanceof Error
          ? accessError.message
          : "Packet access could not be confirmed."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!challenge || !token) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const nextAccess = await apiRequest<PacketShareAccessResponse>(
        "/api/public/packet-shares/access/verify",
        {
          body: JSON.stringify({
            challengeId: challenge.challengeId,
            code,
            email,
            token
          }),
          method: "POST"
        }
      );
      const nextContent = await loadPacketContent(token, nextAccess.accessToken);
      setAccess(nextAccess);
      setContent(nextContent);
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : "The verification code could not be confirmed."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!access || !comment.trim() || !token) {
      return;
    }

    setError(null);
    setIsCommenting(true);

    try {
      const createdComment = await apiRequest<PacketShareCommentRecord>(
        "/api/public/packet-shares/comments",
        {
          body: JSON.stringify({ content: comment, token }),
          headers: { Authorization: `Bearer ${access.accessToken}` },
          method: "POST"
        }
      );
      setContent((current) =>
        current
          ? { ...current, comments: [...current.comments, createdComment] }
          : current
      );
      setComment("");
    } catch (commentError) {
      setError(
        commentError instanceof Error ? commentError.message : "Comment could not be added."
      );
    } finally {
      setIsCommenting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/95 px-4 py-4">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2" aria-label="ProofPilot">
            <Image
              alt=""
              className="h-10 w-10 shrink-0 object-contain"
              height={40}
              priority
              src="/brand/proofpilot-brand-icon-transparent.webp"
              width={40}
            />
            <span className="truncate text-lg font-semibold">
              Proof<span className="text-primary">Pilot</span>
            </span>
          </div>
          <Badge variant="secondary">
            <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
            Recipient access
          </Badge>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-8 sm:px-6 md:py-12">
        <section className="grid gap-3 border-b border-border pb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-primary">Protected packet link</p>
            <h1 className="mt-1 text-2xl font-semibold leading-8 md:text-3xl">
              A case packet was shared with you
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Enter the invited email address to confirm that you are on this packet&apos;s recipient
              list.
            </p>
          </div>
        </section>

        {loadState === "loading" && token !== "" ? (
          <div className="rounded-md border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Checking packet link...
          </div>
        ) : null}

        {token === "" ? (
          <div className="rounded-md border border-red-400/30 bg-red-400/10 px-4 py-4 text-sm text-red-100" role="alert">
            This packet link is incomplete. Ask the sender for a new link.
          </div>
        ) : null}

        {loadState === "error" && token !== "" ? (
          <div className="rounded-md border border-red-400/30 bg-red-400/10 px-4 py-4 text-sm text-red-100" role="alert">
            {error}
          </div>
        ) : null}

        {loadState === "ready" && metadata && !content ? (
          <section
            aria-labelledby="recipient-access-heading"
            className="grid gap-5 rounded-md border border-border bg-card p-5 md:grid-cols-[minmax(0,1fr)_16rem] md:items-start md:p-6"
          >
            {challenge ? (
              <form className="grid gap-4" onSubmit={handleVerification}>
                <div>
                  <div className="flex items-center gap-2 text-primary">
                    <MailCheck className="h-5 w-5" aria-hidden="true" />
                    <h2 id="recipient-access-heading" className="text-lg font-semibold text-foreground">
                      Enter verification code
                    </h2>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    We sent a six-digit code to {maskEmail(email)}. It expires in 10 minutes.
                  </p>
                </div>
                {challenge.developmentCode ? (
                  <div className="rounded-md border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
                    Local preview code: <span className="font-mono font-semibold">{challenge.developmentCode}</span>
                  </div>
                ) : null}
                <div className="grid gap-2">
                  <Label htmlFor="packet-access-code">Verification code</Label>
                  <Input
                    autoComplete="one-time-code"
                    className="h-14 text-center font-mono text-xl"
                    id="packet-access-code"
                    inputMode="numeric"
                    maxLength={6}
                    onChange={(event) =>
                      setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    pattern="\d{6}"
                    required
                    value={code}
                  />
                </div>
                {error ? (
                  <p className="text-sm text-red-200" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button disabled={isSubmitting || code.length !== 6} type="submit">
                    <KeyRound className="h-4 w-4" aria-hidden="true" />
                    {isSubmitting ? "Verifying..." : "Verify and open"}
                  </Button>
                  <Button
                    onClick={() => {
                      setChallenge(null);
                      setCode("");
                      setError(null);
                    }}
                    type="button"
                    variant="outline"
                  >
                    Use another email
                  </Button>
                </div>
              </form>
            ) : (
            <form className="grid gap-4" onSubmit={handleAccess}>
              <div>
                <h2 id="recipient-access-heading" className="text-lg font-semibold">
                  Confirm recipient email
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Access is limited to the email addresses selected by the packet owner.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="packet-recipient-email">Email address</Label>
                <Input
                  autoComplete="email"
                  id="packet-recipient-email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={email}
                />
              </div>
              {error ? (
                <p className="text-sm text-red-200" role="alert">
                  {error}
                </p>
              ) : null}
              <Button disabled={isSubmitting} type="submit">
                <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                {isSubmitting ? "Confirming..." : "Open shared packet"}
              </Button>
            </form>
            )}

            <dl className="grid gap-3 border-t border-border pt-4 text-sm md:border-l md:border-t-0 md:pl-5 md:pt-0">
              <div>
                <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                  Link expiration
                </dt>
                <dd className="mt-1 font-medium">{formatPacketShareDate(metadata.expiresAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Identity check</dt>
                <dd className="mt-1 font-medium">
                  {metadata.requireEmailVerification ? "Email verification" : "Recipient list"}
                </dd>
              </div>
            </dl>
          </section>
        ) : null}

        {content && access ? (
          <>
            <section className="grid gap-5 rounded-md border border-primary/30 bg-card p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-teal-300" aria-hidden="true" />
                  <Badge variant="success">Access confirmed</Badge>
                  <Badge variant="secondary">
                    {getPacketSharePermissionLabel(content.permission)}
                  </Badge>
                </div>
                <h2 className="mt-3 break-words text-xl font-semibold leading-7">
                  {content.packet.title}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatPacketShareBytes(content.packet.byteSize)} / Generated {formatPacketShareDate(content.packet.createdAt, "Recently")}
                </p>
              </div>
              <div className="grid w-full gap-2 sm:grid-cols-2 md:w-auto md:grid-cols-1">
                <Button asChild>
                  <a href={content.viewUrl} rel="noreferrer" target="_blank">
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    View packet
                  </a>
                </Button>
                {content.downloadUrl ? (
                  <Button asChild variant="secondary">
                    <a href={content.downloadUrl} rel="noreferrer" target="_blank">
                      <Download className="h-4 w-4" aria-hidden="true" />
                      Download PDF
                    </a>
                  </Button>
                ) : null}
              </div>
            </section>

            <SharedPacketComments
              comment={comment}
              comments={content.comments}
              error={error}
              isCommenting={isCommenting}
              onCommentChange={setComment}
              onSubmit={handleComment}
              readOnly={content.permission === "VIEW"}
            />
          </>
        ) : null}
      </main>
    </div>
  );
}

function maskEmail(value: string) {
  const [local = "", domain = ""] = value.split("@");
  const visibleLocal = local.slice(0, Math.min(2, local.length));
  return `${visibleLocal}${"*".repeat(Math.max(2, local.length - visibleLocal.length))}@${domain}`;
}

interface SharedPacketCommentsProps {
  comment: string;
  comments: PacketShareCommentRecord[];
  error: string | null;
  isCommenting: boolean;
  onCommentChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  readOnly: boolean;
}

function SharedPacketComments({
  comment,
  comments,
  error,
  isCommenting,
  onCommentChange,
  onSubmit,
  readOnly
}: SharedPacketCommentsProps) {
  return (
    <section aria-labelledby="packet-comments-heading" className="grid gap-4 border-t border-border pt-6">
      <div>
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 id="packet-comments-heading" className="text-lg font-semibold">
            Packet comments
          </h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {readOnly
            ? "This link has view-only access."
            : "Comments are visible to other recipients with access to this packet."}
        </p>
      </div>

      {comments.length ? (
        <div className="divide-y divide-border border-y border-border">
          {comments.map((item) => (
            <article className="grid gap-1 py-3" key={item.id}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-foreground">
                  {item.isOwn ? "You" : "Packet recipient"}
                </span>
                <time className="text-muted-foreground" dateTime={item.createdAt}>
                  {formatPacketShareDate(item.createdAt, "Recently")}
                </time>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {item.content}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border bg-secondary/30 px-4 py-4 text-sm text-muted-foreground">
          No comments have been added to this packet.
        </p>
      )}

      {!readOnly ? (
        <form className="grid gap-3" onSubmit={onSubmit}>
          <Label htmlFor="packet-comment">Add a comment</Label>
          <Textarea
            id="packet-comment"
            maxLength={2000}
            onChange={(event) => onCommentChange(event.target.value)}
            placeholder="Add a clear note about this packet..."
            required
            rows={4}
            value={comment}
          />
          {error ? (
            <p className="text-sm text-red-200" role="alert">
              {error}
            </p>
          ) : null}
          <Button className="justify-self-start" disabled={isCommenting} type="submit">
            <Send className="h-4 w-4" aria-hidden="true" />
            {isCommenting ? "Posting..." : "Post comment"}
          </Button>
        </form>
      ) : null}

      <p className="flex items-center gap-2 text-xs leading-5 text-muted-foreground">
        <FileCheck2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        Packet access ends when this share expires or the owner revokes it.
      </p>
    </section>
  );
}

function loadPacketContent(token: string, accessToken: string) {
  return apiRequest<PacketShareContentResponse>("/api/public/packet-shares/content", {
    body: JSON.stringify({ token }),
    headers: { Authorization: `Bearer ${accessToken}` },
    method: "POST"
  });
}

function subscribeToHash(onStoreChange: () => void) {
  window.addEventListener("hashchange", onStoreChange);
  return () => window.removeEventListener("hashchange", onStoreChange);
}

function readHashToken() {
  return window.location.hash.slice(1).trim();
}
