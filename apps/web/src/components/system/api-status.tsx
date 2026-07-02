"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Status = "checking" | "online" | "offline";

export function ApiStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    const controller = new AbortController();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

    fetch(`${apiUrl}/health`, {
      signal: controller.signal
    })
      .then((response) => setStatus(response.ok ? "online" : "offline"))
      .catch(() => setStatus("offline"));

    return () => controller.abort();
  }, []);

  if (status === "online") {
    return (
      <Badge variant="success" className="gap-1.5">
        <Wifi className="h-3.5 w-3.5" />
        API online
      </Badge>
    );
  }

  if (status === "offline") {
    return (
      <Badge variant="warning" className="gap-1.5">
        <WifiOff className="h-3.5 w-3.5" />
        API offline
      </Badge>
    );
  }

  return <Badge variant="secondary">Checking API</Badge>;
}
