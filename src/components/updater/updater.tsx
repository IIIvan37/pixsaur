import { Trans, useLingui } from "@lingui/react/macro";
import { check } from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useState } from "react";
import { updaterLogger } from "@/utils/logger";
import Button from "../ui/button/button";
import Icon from "../ui/icon";
import PixsaurPopover from "../ui/popover/popover";
import styles from "./updater.module.css";

/**
 * Check if running in Tauri environment
 */
function isTauri(): boolean {
  return (
    typeof globalThis !== "undefined" && "__TAURI_INTERNALS__" in globalThis
  );
}

/**
 * Auto-updater component for Tauri desktop app
 * Checks for updates on mount and allows user to install them
 */
export const Updater = () => {
  const { t } = useLingui();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateVersion, setUpdateVersion] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdates = useCallback(async () => {
    try {
      updaterLogger.info("Checking for updates...");

      if (isTauri()) {
        updaterLogger.info("Running in Tauri environment, calling updater API");
        const update = await check();

        if (update) {
          updaterLogger.info(`Update available: ${update.version}`);
          updaterLogger.info(`Current version: ${update.currentVersion}`);
          updaterLogger.info(`Update date: ${update.date}`);
          updaterLogger.info(`Update body: ${update.body}`);
          setUpdateAvailable(true);
          setUpdateVersion(update.version);
          setPopoverOpen(true);
        } else {
          updaterLogger.info("No updates available");
        }
      } else {
        updaterLogger.info("Running in web environment (development mode)");
        // Updates not available in web mode
      }
    } catch (error) {
      updaterLogger.error("Failed to check for updates:", error);
      setError(
        error instanceof Error ? error.message : "Unknown error occurred"
      );
    }
  }, []);

  useEffect(() => {
    checkForUpdates();
  }, [checkForUpdates]);

  const installUpdate = async () => {
    try {
      updaterLogger.info("Starting update download and installation...");
      updaterLogger.info(`User Agent: ${navigator.userAgent}`);
      setDownloading(true);
      setError(null);

      if (isTauri()) {
        const update = await check();

        if (!update) {
          updaterLogger.warn("No update found during installation attempt");
          setDownloading(false);
          setError("No update available");
          return;
        }

        updaterLogger.info(`Downloading update ${update.version}...`);
        updaterLogger.info(`Download URL: ${JSON.stringify(update)}`);

        let downloadComplete = false;
        let totalSize = 0;
        let downloadedSize = 0;

        // Download and install with progress tracking
        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case "Started":
              totalSize = event.data.contentLength || 0;
              updaterLogger.info(`Started downloading ${totalSize} bytes`);
              setDownloadProgress(0);
              break;
            case "Progress": {
              downloadedSize += event.data.chunkLength;
              const progress =
                totalSize > 0 ? (downloadedSize / totalSize) * 100 : 0;
              setDownloadProgress(Math.round(progress));

              // Log progress every 10% to avoid spam
              if (downloadedSize % 1000000 < 100000) {
                // Log roughly every MB
                updaterLogger.info(
                  `Download progress: ${downloadedSize} / ${totalSize} bytes (${Math.round(
                    progress
                  )}%)`
                );
              }
              break;
            }
            case "Finished":
              updaterLogger.info("Download finished, installing...");
              setDownloadProgress(100);
              downloadComplete = true;
              break;
          }
        });

        if (!downloadComplete) {
          throw new Error("Download did not complete successfully");
        }

        updaterLogger.info(
          "Update installed successfully, preparing to relaunch..."
        );

        // Relaunch the app to apply the update
        const { relaunch } = await import("@tauri-apps/plugin-process");
        updaterLogger.info("Relaunching application...");
        await relaunch();
      } else {
        // In web mode, just log
        updaterLogger.info("Would download and install update in production");
        setDownloading(false);
        setUpdateAvailable(false);
        setPopoverOpen(false);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      updaterLogger.error("Failed to download and install update:", error);
      updaterLogger.error("Error details:", errorMessage);
      setDownloading(false);
      setError(errorMessage);
      // Keep notification visible so user can try again
    }
  };

  if (!updateAvailable) {
    return null;
  }

  return (
    <div className={styles.updaterContainer}>
      <PixsaurPopover
        open={popoverOpen}
        onOpenChange={setPopoverOpen}
        trigger={
          <button
            type="button"
            className={styles.updateTrigger}
            aria-label={t`Update available: version ${updateVersion}`}
          >
            <Icon name="DownloadIcon" size={20} />
            <span className={styles.updateBadge}>1</span>
          </button>
        }
        side="bottom"
        align="end"
        sideOffset={12}
        variant="unstyled"
      >
        <div className={styles.updateContent}>
          <div className={styles.updateHeader}>
            <Icon
              name="InfoCircledIcon"
              size={20}
              className={styles.infoIcon}
            />
            <div>
              <h4 className={styles.updateTitle}>
                <Trans>Update Available</Trans>
              </h4>
              <p className={styles.updateVersion}>
                <Trans>Version {updateVersion}</Trans>
              </p>
            </div>
          </div>

          <p className={styles.updateDescription}>
            <Trans>
              A new version of Pixsaur is available. Click below to download and
              install it automatically.
            </Trans>
          </p>

          {error && (
            <div className={styles.errorMessage}>
              <Icon name="Cross2Icon" size={16} className={styles.errorIcon} />
              <span>{error}</span>
            </div>
          )}

          {downloading && downloadProgress > 0 && (
            <div className={styles.progressContainer}>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <span className={styles.progressText}>{downloadProgress}%</span>
            </div>
          )}

          <div className={styles.updateActions}>
            <Button
              variant="secondary"
              onClick={() => setPopoverOpen(false)}
              className={styles.laterButton}
            >
              <Trans>Later</Trans>
            </Button>
            <Button
              variant="primary"
              onClick={installUpdate}
              disabled={downloading}
            >
              {downloading ? (
                <>
                  <Icon
                    name="ReloadIcon"
                    size={16}
                    className={styles.loadingIcon}
                  />
                  <Trans>Downloading...</Trans>
                </>
              ) : (
                <>
                  <Icon name="DownloadIcon" size={16} />
                  <Trans>Install Update</Trans>
                </>
              )}
            </Button>
          </div>
        </div>
      </PixsaurPopover>
    </div>
  );
};
