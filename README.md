# Tally

Eine moderne Aufgaben- und Projektmanagement-App für macOS.

## Features

- **Aufgabenverwaltung** - Erstelle, organisiere und verfolge deine Aufgaben
- **Meeting-Planung** - Plane Meetings mit Erinnerungen und Links
- **Kunden & Projekte** - Verwalte Kunden mit automatischen Logos
- **Zeiterfassung** - Tracke deine Arbeitszeit pro Aufgabe
- **Fokus-Timer** - Pomodoro-Technik für konzentriertes Arbeiten
- **Whiteboard** - Visuelle Planung mit Export als Bild
- **Statistiken** - Überblick über deine Produktivität

## Installation

### Option 1: Download (Empfohlen)

Lade die neueste Version von der [Releases-Seite](https://github.com/Querbox/tally-app/releases) herunter.

### Option 2: Selbst bauen

```bash
# Repository klonen
git clone https://github.com/Querbox/tally-app.git
cd tally-app

# Dependencies installieren
npm install

# Entwicklungsserver starten
npm run tauri dev

# Für Produktion bauen
npm run tauri build
```

## Systemanforderungen

- macOS 11 (Big Sur) oder neuer
- Apple Silicon (M1, M2, M3, M4)

## Datenschutz

Alle Daten werden **lokal auf deinem Mac** gespeichert. Keine Cloud, keine Registrierung.

Optional: Firmenlogos können über einen externen Dienst geladen werden (DSGVO-konformer Opt-in).

## Technologie

- [Tauri](https://tauri.app/) - Desktop Framework
- [React](https://react.dev/) - UI Library
- [TypeScript](https://www.typescriptlang.org/) - Type Safety
- [Zustand](https://zustand-demo.pmnd.rs/) - State Management
- [Tailwind CSS](https://tailwindcss.com/) - Styling

## Lizenz

MIT
