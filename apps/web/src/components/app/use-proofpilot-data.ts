"use client";

import { useCallback, useMemo, useState } from "react";
import {
  defaultUserSettingsValues,
  type UserSettings
} from "@proofpilot/types";
import { apiRequest } from "@/lib/client/api";
import type {
  AppNotification,
  CaseRecord,
  CaseType
} from "@/lib/client/types";

const fallbackCaseTypes: CaseType[] = [
  {
    id: "account-ban-appeal",
    slug: "account-ban-appeal",
    name: "Account Ban / Appeal Builder",
    description:
      "Build an organized appeal packet for account bans, holds, closures, and platform restrictions."
  }
];

/** Owns authenticated workspace data, selection, refresh keys, and unread counters. */
export function useProofPilotData(initialCaseId: string | null) {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [caseTypes, setCaseTypes] = useState<CaseType[]>(fallbackCaseTypes);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(initialCaseId);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isCaseLoading, setIsCaseLoading] = useState(false);
  const [inboxRefreshKey, setInboxRefreshKey] = useState(0);
  const [notificationRefreshKey, setNotificationRefreshKey] = useState(0);
  const [unreadInboxCount, setUnreadInboxCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const selectedCase = useMemo(
    () => cases.find((caseRecord) => caseRecord.id === selectedCaseId) ?? cases[0] ?? null,
    [cases, selectedCaseId]
  );

  const loadCases = useCallback(async () => {
    setIsCaseLoading(true);

    try {
      const nextCases = await apiRequest<CaseRecord[]>("/api/cases");
      setCases(nextCases);
      setSelectedCaseId((currentId) =>
        currentId && nextCases.some((caseRecord) => caseRecord.id === currentId)
          ? currentId
          : nextCases[0]?.id ?? null
      );
      return nextCases;
    } finally {
      setIsCaseLoading(false);
    }
  }, []);

  const loadCaseTypes = useCallback(async () => {
    try {
      const nextCaseTypes = await apiRequest<CaseType[]>("/api/case-types");
      setCaseTypes(nextCaseTypes.length ? nextCaseTypes : fallbackCaseTypes);
    } catch {
      setCaseTypes(fallbackCaseTypes);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const nextSettings = await apiRequest<UserSettings>("/api/settings");
      setSettings(nextSettings);
      return nextSettings;
    } catch {
      const fallbackSettings = createFallbackSettings();
      setSettings(fallbackSettings);
      return fallbackSettings;
    }
  }, []);

  const loadUnreadNotificationCount = useCallback(async () => {
    try {
      const notifications = await apiRequest<AppNotification[]>("/api/notifications");
      setUnreadNotificationCount(
        notifications.filter((notification) => !notification.readAt).length
      );
    } catch {
      setUnreadNotificationCount(0);
    }
  }, []);

  const loadUnreadInboxCount = useCallback(async () => {
    try {
      const conversations = await apiRequest<Array<{ readAt: string | null }>>(
        "/api/inbox/conversations"
      );
      setUnreadInboxCount(
        conversations.filter((conversation) => !conversation.readAt).length
      );
    } catch {
      setUnreadInboxCount(0);
    }
  }, []);

  const refreshNotifications = useCallback(() => {
    setNotificationRefreshKey((currentKey) => currentKey + 1);
    void loadUnreadNotificationCount();
  }, [loadUnreadNotificationCount]);

  const refreshInbox = useCallback(() => {
    setInboxRefreshKey((currentKey) => currentKey + 1);
    void loadUnreadInboxCount();
  }, [loadUnreadInboxCount]);

  const loadCaseDetail = useCallback(async (caseId: string) => {
    const caseDetail = await apiRequest<CaseRecord>(`/api/cases/${caseId}`);
    setCases((currentCases) => {
      const caseExists = currentCases.some((caseRecord) => caseRecord.id === caseDetail.id);

      if (!caseExists) {
        return [caseDetail, ...currentCases];
      }

      return currentCases.map((caseRecord) =>
        caseRecord.id === caseDetail.id ? caseDetail : caseRecord
      );
    });
    setSelectedCaseId(caseDetail.id);
    return caseDetail;
  }, []);

  return {
    cases,
    caseTypes,
    inboxRefreshKey,
    isCaseLoading,
    loadCaseDetail,
    loadCases,
    loadCaseTypes,
    loadSettings,
    loadUnreadInboxCount,
    loadUnreadNotificationCount,
    notificationRefreshKey,
    refreshInbox,
    refreshNotifications,
    selectedCase,
    selectedCaseId,
    setCases,
    setSelectedCaseId,
    setSettings,
    setUnreadInboxCount,
    setUnreadNotificationCount,
    settings,
    unreadInboxCount,
    unreadNotificationCount
  };
}

/** Provides a complete settings contract when optional settings retrieval fails. */
function createFallbackSettings(): UserSettings {
  const timestamp = new Date().toISOString();

  return {
    ...defaultUserSettingsValues,
    lastSyncedAt: timestamp,
    updatedAt: timestamp,
    storage: {
      documentBytes: 0,
      documentCount: 0,
      exportBytes: 0,
      exportCount: 0,
      usedBytes: 0
    }
  };
}
