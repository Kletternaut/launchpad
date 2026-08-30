# Launchpad unter Windows 11 – Installation und Betrieb

## Grundsatz

Launchpad läuft **ohne Docker** als normaler Windows-Dienst. Der Dienst startet den gebauten Node-Server als Child-Prozess und überwacht dessen Lebenszyklus.

Persönliche Lesezeichen, Datenbanken, Favicons und Backups gehören **nicht in Git** und werden niemals Bestandteil des Repositorys.

## Voraussetzungen

- Windows 11
- Git
- Node.js (LTS; passend zur im Projekt dokumentierten Version)
- .NET SDK passend zu `windows-service/LaunchpadService.csproj`
- Administratorrechte für die Dienstinstallation

## 1. Repository klonen

```powershell
git clone https://github.com/Kletternaut/launchpad.git
cd launchpad
```

Anschließend auf den gewünschten Branch wechseln.

## 2. Installation konfigurieren

`windows-service/install.ps1` verwendet **keinen fest verdrahteten Benutzerpfad**. Alle relevanten Werte können beim Aufruf angegeben werden.

Beispiel für eine Installation im Benutzerprofil:

```powershell
.\windows-service\install.ps1 `
  -InstallRoot "$env:LOCALAPPDATA\Kletternaut\Launchpad" `
  -DataRoot "$env:LOCALAPPDATA\Kletternaut\Launchpad\data" `
  -HostAddress "127.0.0.1" `
  -Port 3021
```

Für LAN-Zugriff muss die Bind-Adresse bewusst auf eine LAN-Adresse oder `0.0.0.0` gesetzt werden:

```powershell
.\windows-service\install.ps1 `
  -InstallRoot "D:\Apps\Launchpad" `
  -DataRoot "D:\Data\Launchpad" `
  -HostAddress "0.0.0.0" `
  -Port 3021
```

**Empfehlung:** Für den ersten Test `127.0.0.1` verwenden. LAN-Zugriff erst aktivieren, wenn Firewall und Zugriffsschutz festgelegt sind.

## 3. Was das Installationsskript macht

1. baut Client und Server mit `npm install` und `npm run build`
2. kopiert nur die benötigten Build-Artefakte in das angegebene Installationsverzeichnis
3. erzeugt die Dienstkonfiguration dort
4. veröffentlicht den .NET-Windows-Service
5. registriert den Dienst beim Windows Service Control Manager
6. konfiguriert Windows-Service-Recovery
7. startet den Dienst nur, wenn `-StartupType Automatic` gewählt wurde

Docker wird **nicht** installiert, gestartet oder benötigt.

## 4. Dienst kontrollieren

Mit `services.msc`:

- `Kletternaut Launchpad` suchen
- Starten / Stoppen / Neustarten
- Starttyp ändern
- Eigenschaften und Recovery prüfen

Oder per PowerShell:

```powershell
Get-Service KletternautLaunchpad
Start-Service KletternautLaunchpad
Stop-Service KletternautLaunchpad
Restart-Service KletternautLaunchpad
```

## 5. Konfiguration

Die bei der Installation erzeugte `appsettings.json` liegt unter dem gewählten Installationsverzeichnis im Ordner `config`.

Es gibt keine Abhängigkeit von `C:\ProgramData\...`.

Relative Pfade werden vom Verzeichnis der Service-Anwendung aufgelöst; absolute Pfade sind ausdrücklich möglich, wenn der Administrator sie selbst vorgibt.

## 6. Daten

Das Datenverzeichnis wird mit `-DataRoot` festgelegt. Dort liegen die persistenten Launchpad-Daten und Icons.

Das Verzeichnis sollte regelmäßig gesichert werden. Es gehört nicht ins Git-Repository.

## 7. Deinstallation

Vor einer späteren Deinstallationsroutine kann der Dienst kontrolliert entfernt werden:

```powershell
Stop-Service KletternautLaunchpad -ErrorAction SilentlyContinue
sc.exe delete KletternautLaunchpad
```

Die Daten werden dabei **nicht automatisch gelöscht**. Das ist absichtlich so, damit eine Deinstallation nicht versehentlich persönliche Lesezeichen vernichtet.

## 8. LAN und Firewall

Ein Dienst, der auf `0.0.0.0` lauscht, ist grundsätzlich im LAN erreichbar. Die Windows-Firewall sollte deshalb eine möglichst enge Regel erhalten (Port, Profil und ggf. lokale/Remote-Adressen einschränken).

Der LAN-Modus wird erst als endgültig sicher betrachtet, wenn zusätzlich ein Zugriffsschutz für die Weboberfläche vorhanden ist.

## Datenschutz

Die GitHub-Repository-Struktur enthält ausschließlich Software. Der Brave-Import findet später lokal statt. Eine echte `bookmarks.db`, ein Brave-Export oder private URLs dürfen niemals committed werden.
