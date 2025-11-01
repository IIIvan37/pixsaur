import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Updater } from "./updater";

// Mock Tauri updater plugin
vi.mock("@tauri-apps/plugin-updater");

// Mock Tauri process plugin
vi.mock("@tauri-apps/plugin-process");

// Mock logger
vi.mock("@/utils/logger", () => ({
  updaterLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("Updater", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup Tauri environment
    (globalThis as { __TAURI_INTERNALS__?: never }).__TAURI_INTERNALS__ =
      {} as never;
  });

  it("does not render when no update is available", async () => {
    const { check } = await import("@tauri-apps/plugin-updater");
    vi.mocked(check).mockResolvedValue(null);

    const { container } = render(<Updater />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("renders update notification when update is available", async () => {
    const { check } = await import("@tauri-apps/plugin-updater");
    vi.mocked(check).mockResolvedValue({
      version: "0.1.22",
      currentVersion: "0.1.21",
      date: "2025-01-01",
      body: "Bug fixes",
      downloadAndInstall: vi.fn(),
    } as any);

    render(<Updater />);

    await waitFor(() => {
      expect(screen.getByText(/Mise à jour disponible/i)).toBeInTheDocument();
      const elementsWithVersion = screen.queryAllByText((_content, element) => {
        return element?.textContent?.includes("0.1.22") ?? false;
      });
      expect(elementsWithVersion.length).toBeGreaterThan(0);
    });
  });
  it("checks for updates on mount", async () => {
    const { check } = await import("@tauri-apps/plugin-updater");
    vi.mocked(check).mockResolvedValue(null);

    render(<Updater />);

    await waitFor(() => {
      expect(check).toHaveBeenCalledTimes(1);
    });
  });

  it("does not check for updates in non-Tauri environment", async () => {
    delete (globalThis as { __TAURI_INTERNALS__?: never }).__TAURI_INTERNALS__;
    const { check } = await import("@tauri-apps/plugin-updater");
    vi.mocked(check).mockResolvedValue(null);

    render(<Updater />);

    await waitFor(() => {
      expect(check).not.toHaveBeenCalled();
    });
  });

  it("handles update installation with progress", async () => {
    const mockDownloadAndInstall = vi.fn((callback) => {
      // Simulate download events
      callback({ event: "Started", data: { contentLength: 1000000 } });
      callback({ event: "Progress", data: { chunkLength: 500000 } });
      callback({ event: "Progress", data: { chunkLength: 500000 } });
      callback({ event: "Finished" });
      return Promise.resolve();
    });

    const { check } = await import("@tauri-apps/plugin-updater");
    const { relaunch } = await import("@tauri-apps/plugin-process");
    vi.mocked(check).mockResolvedValue({
      version: "0.1.22",
      currentVersion: "0.1.21",
      date: "2025-01-01",
      body: "Bug fixes",
      downloadAndInstall: mockDownloadAndInstall,
    } as any);

    vi.mocked(relaunch).mockResolvedValue(undefined);

    render(<Updater />);

    // Wait for update to be available
    await waitFor(() => {
      expect(screen.getByText(/Installer la mise à jour/i)).toBeInTheDocument();
    });

    // Click install
    const installButton = screen.getByRole("button", {
      name: /Installer la mise à jour/i,
    });
    installButton.click();

    // Wait for download to complete
    await waitFor(() => {
      expect(mockDownloadAndInstall).toHaveBeenCalled();
      expect(relaunch).toHaveBeenCalled();
    });
  });

  it("shows error message when update fails", async () => {
    const { check } = await import("@tauri-apps/plugin-updater");
    vi.mocked(check).mockResolvedValue({
      version: "0.1.22",
      currentVersion: "0.1.21",
      date: "2025-01-01",
      body: "Bug fixes",
      downloadAndInstall: vi.fn().mockRejectedValue(new Error("Network error")),
    } as any);

    render(<Updater />);

    // Wait for update to be available
    await waitFor(() => {
      expect(screen.getByText(/Installer la mise à jour/i)).toBeInTheDocument();
    });

    // Click install
    const installButton = screen.getByRole("button", {
      name: /Installer la mise à jour/i,
    });
    installButton.click();

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });

  it("handles check error gracefully", async () => {
    const { check } = await import("@tauri-apps/plugin-updater");
    vi.mocked(check).mockRejectedValue(new Error("Failed to check"));

    const { container } = render(<Updater />);

    await waitFor(() => {
      // Should not render anything on check error
      expect(container.firstChild).toBeNull();
    });
  });

  it("shows downloading state during installation", async () => {
    const mockDownloadAndInstall = vi.fn(() => {
      return new Promise(() => {
        // Never resolve to keep downloading state
      });
    });

    const { check } = await import("@tauri-apps/plugin-updater");
    vi.mocked(check).mockResolvedValue({
      version: "0.1.22",
      currentVersion: "0.1.21",
      date: "2025-01-01",
      body: "Bug fixes",
      downloadAndInstall: mockDownloadAndInstall,
    } as any);

    render(<Updater />);

    // Wait for update to be available
    await waitFor(() => {
      expect(screen.getByText(/Installer la mise à jour/i)).toBeInTheDocument();
    });

    // Click install
    const installButton = screen.getByRole("button", {
      name: /Installer la mise à jour/i,
    });
    installButton.click();

    // Should show downloading state
    await waitFor(() => {
      expect(screen.getByText(/Téléchargement/i)).toBeInTheDocument();
    });
  });

  it("does not call relaunch if download did not complete", async () => {
    const mockDownloadAndInstall = vi.fn((callback) => {
      // Simulate incomplete download (no Finished event)
      callback({ event: "Started", data: { contentLength: 1000000 } });
      callback({ event: "Progress", data: { chunkLength: 500000 } });
      return Promise.resolve();
    });

    const { check } = await import("@tauri-apps/plugin-updater");
    const { relaunch } = await import("@tauri-apps/plugin-process");
    vi.mocked(check).mockResolvedValue({
      version: "0.1.22",
      currentVersion: "0.1.21",
      date: "2025-01-01",
      body: "Bug fixes",
      downloadAndInstall: mockDownloadAndInstall,
    } as any);

    render(<Updater />);

    // Wait for update to be available
    await waitFor(() => {
      expect(screen.getByText(/Installer la mise à jour/i)).toBeInTheDocument();
    });

    // Click install
    const installButton = screen.getByRole("button", {
      name: /Installer la mise à jour/i,
    });
    installButton.click();

    // Wait for error
    await waitFor(() => {
      expect(
        screen.getByText(/Download did not complete successfully/i)
      ).toBeInTheDocument();
    });

    expect(relaunch).not.toHaveBeenCalled();
  });
});
