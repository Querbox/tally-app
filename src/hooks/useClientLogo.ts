import { useState, useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import type { Client } from '../types';

// Cache für bereits geladene Logos (verhindert wiederholte Requests)
const logoCache = new Map<string, string | null>();

/**
 * Extrahiert die Domain aus einer URL oder E-Mail
 */
function extractDomain(input: string): string | null {
  if (!input) return null;

  // E-Mail-Adresse: info@example.com -> example.com
  if (input.includes('@')) {
    const parts = input.split('@');
    return parts[1]?.toLowerCase() || null;
  }

  // URL bereinigen: https://www.example.com/path -> example.com
  let domain = input.toLowerCase();
  domain = domain.replace(/^https?:\/\//, ''); // Protokoll entfernen
  domain = domain.replace(/^www\./, ''); // www. entfernen
  domain = domain.split('/')[0]; // Pfad entfernen
  domain = domain.split('?')[0]; // Query-Parameter entfernen

  return domain || null;
}

/**
 * Verschiedene Favicon-APIs als Fallback
 * Manche Websites funktionieren besser mit bestimmten APIs
 */
const FAVICON_PROVIDERS = [
  // DuckDuckGo - oft bessere Qualität
  (domain: string) => `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  // Google Favicon API - zuverlässig
  (domain: string) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
  // Favicon.io - Alternative
  (domain: string) => `https://favicon.io/favicon/${domain}`,
  // Direkt von der Website
  (domain: string) => `https://${domain}/favicon.ico`,
  // Mit www
  (domain: string) => `https://www.${domain}/favicon.ico`,
];

/**
 * Prüft ob ein Bild geladen werden kann und ob es nicht das Default-Icon ist
 */
async function checkImageValid(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    // Timeout nach 3 Sekunden
    const timeout = setTimeout(() => resolve(false), 3000);

    img.onload = () => {
      clearTimeout(timeout);
      const isValidSize = img.width >= 16 && img.height >= 16;
      resolve(isValidSize);
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(false);
    };

    img.src = url;
  });
}

/**
 * Versucht verschiedene Favicon-Provider nacheinander
 */
async function findWorkingFavicon(domain: string): Promise<string | null> {
  for (const getUrl of FAVICON_PROVIDERS) {
    const url = getUrl(domain);
    try {
      const isValid = await checkImageValid(url);
      if (isValid) {
        return url;
      }
    } catch {
      // Provider fehlgeschlagen, nächsten versuchen
      continue;
    }
  }
  return null;
}

/**
 * Hook zum Laden des Client-Logos
 * Berücksichtigt DSGVO-Einstellungen
 */
export function useClientLogo(client: Client | null | undefined) {
  const privacySettings = useSettingsStore((s) => s.privacySettings);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!client) {
      setLogoUrl(null);
      return;
    }

    // DSGVO-Check: Nur laden wenn User zugestimmt hat
    if (!privacySettings.allowExternalLogos) {
      setLogoUrl(null);
      return;
    }

    // Domain aus Website oder E-Mail extrahieren
    const domain = extractDomain(client.website || '') || extractDomain(client.contactEmail || '');

    if (!domain) {
      setLogoUrl(null);
      return;
    }

    // Cache prüfen
    const cacheKey = domain;
    if (logoCache.has(cacheKey)) {
      setLogoUrl(logoCache.get(cacheKey) || null);
      return;
    }

    // Logo laden
    setIsLoading(true);
    setHasError(false);

    findWorkingFavicon(domain).then((url) => {
      if (url) {
        logoCache.set(cacheKey, url);
        setLogoUrl(url);
      } else {
        logoCache.set(cacheKey, null);
        setLogoUrl(null);
        setHasError(true);
      }
      setIsLoading(false);
    });
  }, [client?.id, client?.website, client?.contactEmail, privacySettings.allowExternalLogos]);

  return { logoUrl, isLoading, hasError };
}

/**
 * Löscht den Logo-Cache (z.B. wenn User die Einstellung ändert)
 */
export function clearLogoCache() {
  logoCache.clear();
}

/**
 * Komponente für Client-Avatar (Logo oder Initialen)
 */
export function getClientInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
