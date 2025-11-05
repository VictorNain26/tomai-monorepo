# Fix Gitlink Corrompu - apps/app

**Problème identifié** : `apps/app` est enregistré comme **gitlink** (mode 160000 = submodule) dans l'index Git, mais sans fichier `.gitmodules` correspondant.

## 🔍 Diagnostic Complet

```bash
# État actuel
$ git ls-tree HEAD:apps
160000 commit 44776d1... app      ← GITLINK (submodule corrompu)
040000 tree 07106b0... landing    ← TREE normal (OK)

# Erreur Git
$ git add apps/app
fatal: in unpopulated submodule 'apps/app'

# Configuration manquante
$ cat .gitmodules
(fichier n'existe pas)
```

**Cause Root** : `apps/app` a été créé comme repository Git indépendant, puis ajouté au monorepo, créant automatiquement un gitlink au lieu d'un tree normal.

---

## ✅ Solution Propre et Officielle

### Étape 1 : Sauvegarder l'Historique Git de apps/app

**Backup déjà créé** :
- `/home/ordiv/code/TomIA/archives/tomai-app-git-backup.bundle` (1.3 MB)
- Contient l'historique complet avec 5 commits

```bash
# Pour restaurer plus tard si nécessaire :
git clone /home/ordiv/code/TomIA/archives/tomai-app-git-backup.bundle restored-app
```

---

### Étape 2 : Supprimer le Gitlink de l'Index Git

**Documentation officielle** : `git rm --cached <path>` pour supprimer un gitlink

```bash
# Supprimer la référence gitlink de l'index
git rm --cached apps/app

# Vérification
git status
# Doit montrer : deleted: apps/app
```

**Important** : Cette commande NE supprime PAS le contenu physique de `apps/app/`, seulement la référence gitlink dans l'index Git.

---

### Étape 3 : Ajouter apps/app Comme Dossier Normal

```bash
# Ajouter tous les fichiers de apps/app comme fichiers normaux
git add apps/app/

# Vérification
git status
# Doit montrer : new file: apps/app/package.json, etc.

# Voir le type dans l'index
git ls-files --stage | grep "apps/app"
# Doit montrer 100644 (fichier) ou 100755 (exécutable), PAS 160000
```

---

### Étape 4 : Commit des Changements

```bash
# Commit avec message explicite
git commit -m "fix: Convert apps/app from gitlink to normal directory

- Remove corrupted gitlink reference (mode 160000)
- Add apps/app content as normal files
- Preserve Git history in archives/tomai-app-git-backup.bundle

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

# Push vers origin
git push origin main
```

---

### Étape 5 : Vérification Post-Fix

```bash
# 1. Vérifier que apps/app est un tree normal
git ls-tree HEAD:apps | grep app
# Doit afficher : 040000 tree ... app (PAS 160000 commit)

# 2. Vérifier que les fichiers sont trackés
git ls-files apps/app | wc -l
# Doit afficher > 0

# 3. Tester le build Turbo
pnpm build
# Les deux apps (landing + app) doivent builder

# 4. Vérifier l'état Git
git status
# Doit afficher : nothing to commit, working tree clean
```

---

## 🚀 Déploiement Vercel Post-Fix

Une fois le fix appliqué et pushé, `apps/app` sera visible sur Vercel.

**Configuration Vercel Dashboard** :
```yaml
Project Name: tomai-app
Framework Preset: Vite (détecté via package.json)
Root Directory: apps/app
Build Command: turbo build (ou vite build)
Output Directory: dist
Install Command: pnpm install
```

---

## 📊 Avant/Après

### Avant (État Corrompu)
```
tomai-monorepo/
├── .git/
│   └── index (apps/app = gitlink 160000)
├── apps/
│   ├── app/
│   │   ├── .git/ ← Repository indépendant
│   │   └── src/
│   └── landing/

Résultat : Vercel ne voit pas apps/app
```

### Après (État Fixé)
```
tomai-monorepo/
├── .git/
│   └── index (apps/app = tree 040000)
├── apps/
│   ├── app/
│   │   └── src/ ← Fichiers normaux trackés
│   └── landing/

Résultat : Vercel voit apps/app ✅
```

---

## ⚠️ Prévention Future

**Pour ajouter une nouvelle app au monorepo** :

```bash
# ❌ MAUVAIS : Créer un repo Git dans l'app
cd apps/new-app
git init  # Crée un gitlink automatiquement

# ✅ BON : Créer l'app sans .git interne
cd apps/new-app
# Créer les fichiers directement
# Git du monorepo les trackera automatiquement
```

---

## 🎯 Checklist d'Exécution

- [x] Backup Git history créé (tomai-app-git-backup.bundle)
- [ ] `git rm --cached apps/app` exécuté
- [ ] `git add apps/app/` exécuté
- [ ] Vérification type tree (040000) avec `git ls-tree HEAD:apps`
- [ ] Commit avec message explicite
- [ ] Push vers origin main
- [ ] Vérification Vercel Dashboard (apps/app visible)
- [ ] Test build production `pnpm build`

---

## 📚 Sources

- **Git Official Docs** : https://git-scm.com/docs/gitrepository-layout
- **Git Submodules** : `git help submodule`
- **Gitlink Explanation** : Mode 160000 = special Git object for submodules
