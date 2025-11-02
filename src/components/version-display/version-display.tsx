import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";
import { isDevelopment } from "@/utils/is-development";
import styles from "./version-display.module.css";

export function VersionDisplay() {
  const [version, setVersion] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const appVersion = await getVersion();
        setVersion(appVersion);
      } catch (error) {
        console.error("Failed to fetch version:", error);
        // Fallback to package.json version for web
        setVersion(import.meta.env.VITE_APP_VERSION || "0.1.31");
      } finally {
        setIsLoading(false);
      }
    };

    fetchVersion();
  }, []);

  if (isLoading) {
    return null;
  }

  return (
    <div className={styles.version}>
      v{version}
      {isDevelopment() && <span className={styles.devBadge}>DEV</span>}
    </div>
  );
}
