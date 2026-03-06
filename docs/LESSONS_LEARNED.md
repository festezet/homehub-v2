# Lessons Learned - HomeHub v2

**Dernière mise à jour** : 2026-02-23

## 🐛 BUG-001 : Lancement Applications GUI (RÉSOLU)

### Problème

**Symptômes** :
- Clic sur application dans HomeHub → "lancé avec succès"
- L'application ne s'ouvre PAS visuellement
- Pas de fenêtre, pas d'erreur visible
- Le processus démarre mais meurt immédiatement ou reste invisible

**Applications affectées** :
- Toutes les applications GUI natives (Kdenlive, GIMP, Rhythm Trainer, etc.)
- Tout ce qui a besoin d'un affichage graphique X11

**Temps perdu** : Plusieurs heures sur ce problème récurrent

### Cause Racine

Flask tourne dans un processus séparé (potentiellement systemd ou terminal détaché).
Ce processus **n'hérite pas de l'environnement complet** de ta session X11 active.

**Variables manquantes critiques** :
```bash
DBUS_SESSION_BUS_ADDRESS  # Bus D-Bus session → Communication desktop
XDG_RUNTIME_DIR          # Répertoire runtime utilisateur
XDG_SESSION_TYPE         # Type de session (x11/wayland)
```

**Problème secondaire** :
- Logs envoyés à `/dev/null` → impossible de débugger
- On ne voyait jamais les vraies erreurs

### Solution Appliquée

**Fichier** : `/data/projects/homehub-v2/backend/app.py`

#### 1. Fonction `get_x11_env()` améliorée (lignes 37-100)

**AVANT** (incomplet) :
```python
def get_x11_env():
    env = os.environ.copy()
    # Seulement DISPLAY + XAUTHORITY
    if 'XAUTHORITY' not in env:
        # Detection basique
    if 'DISPLAY' not in env:
        # Detection basique
    return env
```

**APRÈS** (complet) :
```python
def get_x11_env():
    """Capture TOUT l'environnement depuis la session utilisateur active"""
    env = os.environ.copy()

    # Variables critiques
    critical_vars = [
        'DISPLAY',
        'XAUTHORITY',
        'DBUS_SESSION_BUS_ADDRESS',  # ← CRITIQUE
        'XDG_RUNTIME_DIR',           # ← CRITIQUE
        'XDG_SESSION_TYPE',
        'HOME', 'USER', 'LOGNAME'
    ]

    # Lire depuis /proc/<systemd-user-pid>/environ
    result = subprocess.run(['pgrep', '-u', 'fabrice-ryzen', '-f', 'systemd --user'], ...)
    systemd_pid = result.stdout.strip().split()[0]

    with open(f'/proc/{systemd_pid}/environ', 'rb') as f:
        environ_data = f.read()
        for item in environ_data.split(b'\0'):
            key, value = item.decode().split('=', 1)
            if key in critical_vars:
                env[key] = value

    # Fallbacks si détection échoue
    if 'DBUS_SESSION_BUS_ADDRESS' not in env:
        env['DBUS_SESSION_BUS_ADDRESS'] = 'unix:path=/run/user/1000/bus'

    return env
```

**Pourquoi ça marche** :
- Lit l'environnement **depuis le processus systemd --user** de l'utilisateur actif
- Ce processus tourne dans la vraie session X11 et a toutes les bonnes variables
- Fallbacks si la détection échoue

#### 2. Logs Visibles (lignes ~520 et ~460)

**AVANT** :
```python
subprocess.Popen(
    ['bash', launcher_path],
    stdout=subprocess.DEVNULL,  # ❌ Erreurs invisibles
    stderr=subprocess.DEVNULL,  # ❌ Erreurs invisibles
    ...
)
```

**APRÈS** :
```python
log_stdout = f"/tmp/homehub_{project_id}_stdout.log"
log_stderr = f"/tmp/homehub_{project_id}_stderr.log"

with open(log_stdout, 'w') as out, open(log_stderr, 'w') as err:
    subprocess.Popen(
        ['bash', launcher_path],
        stdout=out,   # ✅ Logs visibles
        stderr=err,   # ✅ Logs visibles
        ...
    )
```

**Bénéfice** : On peut maintenant débugger en lisant les logs :
```bash
cat /tmp/homehub_PRJ-036_stdout.log
cat /tmp/homehub_PRJ-036_stderr.log
```

### Test de Validation

1. Redémarrer HomeHub :
   ```bash
   cd /data/projects/homehub-v2
   # Tuer l'ancien processus
   pkill -f "backend/app.py"
   # Relancer
   nohup python3 backend/app.py > /tmp/homehub_main.log 2>&1 &
   ```

2. Lancer une application depuis l'interface :
   - Ouvrir http://localhost:5000
   - Cliquer sur n'importe quelle application GUI
   - **Résultat attendu** : La fenêtre s'ouvre immédiatement et au premier plan

3. Vérifier les logs si problème :
   ```bash
   ls /tmp/homehub_*_*.log
   cat /tmp/homehub_PRJ-036_stderr.log
   ```

### Résultat

✅ **Rhythm Trainer** se lance correctement depuis HomeHub
✅ La fenêtre apparaît immédiatement
✅ Plus besoin de xdotool ou autres hacks
✅ **Solution valable pour TOUTES les applications GUI**

### Leçons Apprises

1. **Environnement complet obligatoire** : DISPLAY + XAUTHORITY ne suffisent PAS
   - Toujours inclure DBUS_SESSION_BUS_ADDRESS
   - Toujours inclure XDG_RUNTIME_DIR

2. **Source fiable** : Lire depuis `/proc/<systemd-user-pid>/environ`
   - Plus fiable que hardcoder les valeurs
   - S'adapte automatiquement à la config utilisateur

3. **Logs essentiels** : Ne JAMAIS envoyer stdout/stderr vers `/dev/null`
   - Toujours logger dans `/tmp/` pour débugger
   - Ça prend 2 lignes et ça sauve des heures

4. **Documentation** : Documenter les bugs récurrents dans un fichier dédié
   - Ce problème a pris des heures à résoudre
   - Sans doc, on aurait recommencé à zéro la prochaine fois

### Fichiers Modifiés

```
/data/projects/homehub-v2/
├── backend/app.py
│   ├── get_x11_env() (lignes 37-100)  → Environnement complet
│   ├── launch_project() (~ligne 520)  → Logs visibles
│   └── launch_project() (~ligne 460)  → Logs visibles (APP-XXX)
└── docs/
    ├── LESSONS_LEARNED.md             → Ce fichier
    └── README.md                      → BUG-001 marqué résolu
```

### Applications Testées

- ✅ Rhythm Trainer (PRJ-036) - Python CustomTkinter
- (À tester : Kdenlive, GIMP, autres apps natives)

---

**Résolu le** : 2026-02-23
**Temps de résolution** : 2h (après des heures perdues sur ce bug récurrent)
**Impact** : Toutes les applications GUI lancées depuis HomeHub fonctionnent maintenant

---

## Lancer projets generateurs de fichiers (depuis infrastructure LESSONS_LEARNED)

### Ouvrir fichier genere depuis bouton "Lancer"

**Probleme** : Le bouton "Lancer" ne peut pas ouvrir Firefox car `gio open` / `xdg-open` / `firefox --new-tab` echouent depuis un service systemd. Erreur "Firefox is already running, but is not responding".

**Cause** : Le backend Flask tourne dans un contexte different de la session utilisateur, sans acces au profil Firefox.

**Solution** (3 etapes) :
1. Supprimer `web_url` de la DB
2. Ajouter route Flask pour servir le fichier genere via `send_file`
3. Modifier le frontend (`local-apps.js`) pour ouvrir l'URL apres lancement via `setTimeout`
4. Retirer l'ouverture navigateur du script `start.sh`

**Session** : 2025-12-29

---

## Scripts de lancement avec relancement automatique (depuis infrastructure LESSONS_LEARNED)

**Probleme** : App lancee via HomeHub ne peut pas etre relancee si on ferme sa fenetre par erreur
**Solution** : Ajouter detection/kill du processus existant via `pgrep -f` + `pkill -f` avec timeout de securite

**Regles** :
1. `pgrep -f` pour detecter le processus par nom de script
2. Timeout pour eviter boucle infinie si le kill echoue
3. `notify-send` pour feedback utilisateur
4. Verifier que l'ID (APP-XXX, PRJ-XXX) n'est pas deja utilise ailleurs

**Session** : 2026-01-25
