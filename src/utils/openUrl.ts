import { openUrl as tauriOpenUrl } from '@tauri-apps/plugin-opener';

/**
 * Opens a URL in the system's default browser.
 * Uses Tauri's opener plugin when running in Tauri, falls back to window.open.
 */
export async function openUrl(url: string): Promise<void> {
  let finalUrl = url;
  if (!/^https?:\/\//i.test(url) && !url.startsWith('mailto:')) {
    finalUrl = 'https://' + url;
  }

  try {
    await tauriOpenUrl(finalUrl);
  } catch {
    // Fallback for non-Tauri environments
    window.open(finalUrl, '_blank');
  }
}
