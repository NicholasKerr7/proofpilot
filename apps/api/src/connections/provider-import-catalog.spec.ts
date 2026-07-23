import { describe, expect, it } from "vitest";
import {
  getDemoProviderImportItems,
  materializeDemoProviderImport
} from "./provider-import-catalog.js";

describe("provider import catalog", () => {
  it("publishes the synthetic passport as a Google Drive demo item", () => {
    expect(getDemoProviderImportItems("GOOGLE_DRIVE")).toContainEqual(
      expect.objectContaining({
        id: "drive-identity-verification",
        kind: "FILE",
        mimeType: "image/png",
        name: "synthetic-passport.png"
      })
    );
  });

  it("materializes the bundled passport image rather than a placeholder", async () => {
    const material = await materializeDemoProviderImport(
      "GOOGLE_DRIVE",
      "drive-identity-verification"
    );

    expect(material).not.toBeNull();
    expect(material?.body.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    );
    expect(material?.body.byteLength).toBeGreaterThan(2_000_000);
    expect(material).toMatchObject({
      mimeType: "image/png",
      originalName: "synthetic-passport.png"
    });
  });
});
