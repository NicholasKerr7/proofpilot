import {
  CaseCollaboratorRole,
  CaseCollaboratorStatus
} from "@proofpilot/database";
import { describe, expect, it } from "vitest";
import {
  buildCaseAccessWhere,
  createCaseAccess
} from "./case-access.js";

const userId = "user-1";

describe("case access", () => {
  it("keeps owner-only resources scoped to the owner", () => {
    expect(buildCaseAccessWhere(userId, "OWNER")).toEqual({ ownerId: userId });
  });

  it("allows active editors and viewers to read a shared case", () => {
    expect(buildCaseAccessWhere(userId, "READ")).toEqual({
      OR: [
        { ownerId: userId },
        {
          collaborators: {
            some: {
              userId,
              status: CaseCollaboratorStatus.ACTIVE
            }
          }
        }
      ]
    });
  });

  it("requires an active editor role for collaborator writes", () => {
    expect(buildCaseAccessWhere(userId, "EDIT")).toEqual({
      OR: [
        { ownerId: userId },
        {
          collaborators: {
            some: {
              userId,
              status: CaseCollaboratorStatus.ACTIVE,
              role: CaseCollaboratorRole.EDITOR
            }
          }
        }
      ]
    });
  });

  it("grants full permissions to the case owner", () => {
    expect(
      createCaseAccess(userId, {
        ownerId: userId,
        collaborators: [],
        sharingSettings: { preventDownloads: true }
      })
    ).toEqual({
      canDownload: true,
      canEdit: true,
      canManage: true,
      role: "OWNER"
    });
  });

  it("grants editors write and download access without management access", () => {
    expect(
      createCaseAccess(userId, {
        ownerId: "owner-1",
        collaborators: [{ role: CaseCollaboratorRole.EDITOR }],
        sharingSettings: { preventDownloads: true }
      })
    ).toEqual({
      canDownload: true,
      canEdit: true,
      canManage: false,
      role: "EDITOR"
    });
  });

  it("applies the owner download policy to viewers", () => {
    expect(
      createCaseAccess(userId, {
        ownerId: "owner-1",
        collaborators: [{ role: CaseCollaboratorRole.VIEWER }],
        sharingSettings: { preventDownloads: true }
      })
    ).toEqual({
      canDownload: false,
      canEdit: false,
      canManage: false,
      role: "VIEWER"
    });
  });
});
