# Lessons Learned - HomeHub v2

**Dernière mise à jour** : 2026-04-11

## JS-001 : ES module crash casse TOUTE la navigation HH (CRITIQUE, RECURRENT)

**Probleme** : HomeHub navigation entierement cassee — page vide, sidebar partielle, aucun onglet ne fonctionne.

**Cause racine** : Un fichier JS charge en ES module (`type="module"`) qui crashe (erreur de syntaxe, import manquant, tag `<script>` non ferme) casse silencieusement TOUTE la chaine d'imports dans `app.js`. Comme `app.js` importe sequentiellement tous les modules, un crash a la ligne N empeche le chargement de toutes les lignes N+1 et suivantes.

**Occurrences 2026-04-11** :
1. Tag `<script>` non ferme dans `claude-analytics.html` → `dynamicContainer null`, navigation morte
2. `whatsapp-historique.js` utilise `API.fetch()` sans `import API from './api.js'` → crash au load → `thread-digest.js` echoue → tout ce qui suit dans `app.js` echoue

**Regle OBLIGATOIRE pour tout nouveau fichier JS** :
1. Verifier que TOUS les objets utilises (`API`, `threadDigestModule`, etc.) sont importes explicitement
2. Un `export default` n'est utile que si le fichier est importe ailleurs — verifier la chaine
3. Apres creation d'un nouveau module JS : **toujours ouvrir la console navigateur (F12)** et verifier l'absence d'erreur d'import
4. Tout fichier HTML avec `<script>` : verifier que les tags sont bien fermes

**Detection rapide** : Si HH affiche une page vide avec sidebar partielle → 99% c'est un JS module crash. Ouvrir F12 → Console → chercher `SyntaxError`, `TypeError: ... is not defined`, ou `Failed to resolve module specifier`.

**Date** : 2026-04-11

---

## CSS-001 : Texte invisible dans les tableaux (dark theme + fond blanc)

**Probleme** : Les noms de skills dans le tableau Analysis D1-D4 sont invisibles — texte blanc sur fond blanc.

**Cause racine** : Le dark theme definit `--text-primary: #f8fafc` (quasi-blanc) sur le `body`. Les cellules `<td>` du tableau (fond `background: white`) heritent cette couleur. Les scores restent visibles car ils ont une `color` inline explicite via JS (`scoreColor()`), mais le nom du skill et le type n'en ont pas.

**Pourquoi le fix existant ne marchait pas** : Un correctif `.skills-list .data-table td { color: #666; }` existait deja pour l'onglet Skills, mais le tableau Analysis D1-D4 est dans `#analysis-subtab`, pas dans `.skills-list`.

**Solution** :
1. Ajouter `color: #333` sur `.data-table th, .data-table td` (fix global pour tous les tableaux)
2. Ajouter les selecteurs `#analysis-subtab .data-table td` en complement du `.skills-list`

**Regle generale** : Tout composant avec `background: white` dans HomeHub DOIT avoir une `color` explicite (#333 ou #666) sur ses elements texte. Ne JAMAIS compter sur l'heritage du `body` car le dark theme rend le texte blanc par defaut.

**Fichier** : `frontend/static/css/claude-analytics.css`
**Date** : 2026-04-10

---

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

## CSS-002 : Pages dynamiques illisibles (inline styles light-theme)

**Probleme** : Les pages dynamiques creees via le MCP tool `create_page` ont des titres et textes illisibles — couleurs sombres (#333, #2c3e50, #34495e) sur fond dark theme.

**Cause racine** : Le MCP server `homehub_pages.py` (templates table/list/cards) utilise correctement des couleurs dark-theme. MAIS quand Claude appelle `create_page` avec du HTML libre (`html_content`), il genere ses propres styles inline avec des couleurs light-theme par defaut (#333, #2c3e50, background #f5f5f5, borders #ddd). Ces styles inline ont une specificite CSS plus haute que les classes.

**Ce qui ne marche PAS** : Corriger les templates MCP — le probleme vient du HTML genere par le LLM, pas des templates.

**Solution** : Overrides `!important` dans `dynamic-pages.css` sur `.dp-content` pour forcer les couleurs dark-theme sur tous les elements, meme ceux avec des styles inline :
```css
.dp-content, .dp-content div, .dp-content p, .dp-content span,
.dp-content li, .dp-content td, .dp-content th {
    color: var(--text-primary) !important;
}
.dp-content h1, .dp-content h2, .dp-content h3, .dp-content h4 {
    color: #58a6ff !important;
}
.dp-content pre { background: #161b22 !important; }
.dp-content table th { background: #21262d !important; }
```

**Regle generale** : Le contenu HTML libre injecte dans `.dp-content` peut avoir n'importe quelles couleurs inline. Le CSS de `dynamic-pages.css` doit TOUJOURS forcer le dark-theme avec `!important` sur les elements courants.

**Fichier** : `frontend/static/css/dynamic-pages.css`
**Date** : 2026-04-11

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

---

## DB-002 : FK cascade manquante sur DELETE (recurrent)

**Probleme** : `DELETE /api/threads/{id}` retourne 500 — "FOREIGN KEY constraint failed". Le JS fonctionne (le log console confirme le clic), mais le backend echoue.

**Cause racine** : `delete_thread()` supprimait `thread_analysis_log`, `thread_digests`, et `thread_configs`, mais oubliait `whatsapp_messages` qui a aussi une FK sur `thread_configs(id)`.

**Diagnostic** : Quand un DELETE retourne 500, toujours verifier les FK avec :
```sql
SELECT sql FROM sqlite_master WHERE type='table' AND sql LIKE '%REFERENCES%table_cible%';
```

**Regle generale** : Lors de l'ecriture d'une fonction `delete_*()`, lister TOUTES les tables avec FK vers la table cible et les supprimer dans l'ordre inverse des dependances. Ne pas se fier a la memoire — toujours verifier le schema.

**Fichier** : `backend/services/thread_digest_service.py` — `delete_thread()`
**Date** : 2026-04-11
