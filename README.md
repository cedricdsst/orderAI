## OrderAI Drive-Through (Next.js + OpenAI)

Application Next.js (App Router, TypeScript, Tailwind) simulant une prise de commande en drive-through (type fast-food) pilotée par l'IA. L'IA renvoie un JSON structuré comprenant:
- **assistant_text**: message affiché dans le chat
- **order**: état courant de la commande (articles strictement issus du menu côté serveur)

### ✨ Fonctionnalités principales
- **🌐 Bilingue** : Interface complète français/anglais avec sélection au démarrage
- **🤖 IA adaptative** : Prompts système et réponses dans la langue choisie
- **📱 Interface moderne** : Design épuré avec 3 colonnes (Menu | Chat | Commande)
- **🔒 Anti-hallucination** : Validation stricte côté serveur, seuls les articles du menu sont acceptés
- **✅ Détection intelligente** : Reconnaissance automatique de fin de commande
- **💰 Prix européens** : Affichage en euros sans taxes séparées

### 1) Prérequis
- Node.js ≥ 18.17
- npm (ou pnpm/yarn si vous préférez)

### 2) Installation
```bash
npm install
```

### 3) Configuration des variables d'environnement
Créez un fichier `.env.local` à la racine du projet avec votre clé OpenAI.

Fichier: `.env.local`
```bash
# Clé API (sk-... OU sk-proj-...)
OPENAI_API_KEY=sk-...ou_sk-proj-...

# Important:
# - Si votre clé est de type sk-proj-..., N'AJOUTEZ PAS OPENAI_ORG / OPENAI_PROJECT ici.
#   La clé est déjà liée au projet et l'API ignore ces en-têtes.
# - Si votre clé est de type sk-... (org-scoped), vous pouvez préciser:
# OPENAI_ORG=org_...
# OPENAI_PROJECT=proj_...

# Optionnel: choisir le modèle (par défaut: gpt-4o-mini)
OPENAI_MODEL=gpt-4o-mini
```

**Notes importantes :**
- Si vous obtenez une erreur « insufficient_quota » alors que vous avez du crédit, vérifiez que la clé (surtout `sk-proj-...`) pointe vers un **projet** disposant de crédit. Sinon, utilisez une clé liée à l'**organisation** avec quota, ou définissez `OPENAI_ORG` et `OPENAI_PROJECT` correctement (uniquement pour une clé `sk-...`).
- Ne partagez jamais cette clé.
- En production (ex: Vercel), définissez les mêmes variables dans le dashboard d'hébergement.

### 4) Lancer le projet en local
```bash
npm run dev
```
Puis ouvrez `http://localhost:3000`.

### 5) Utilisation
1. **Sélection de langue** : Choisissez français 🇫🇷 ou anglais 🇺🇸 au démarrage
2. **Interface** :
   - **Gauche** : Menu avec prix (scrollable si nécessaire)
   - **Centre** : Chat avec l'assistant IA
   - **Droite** : Commande en cours (total et statut toujours visibles)
3. **Commande** : Parlez naturellement à l'IA ("Je veux un burger classique et des frites")
4. **Finalisation** : Dites "c'est bon" / "that's all" pour confirmer

### 6) Architecture technique
- **Backend** : Route `app/api/chat/route.ts` avec schéma JSON strict OpenAI
- **Validation** : Fonction `ensureOrderConsistency()` empêche toute hallucination
- **Langues** : Menus séparés FR/EN, prompts système adaptés, détection multilingue
- **UI** : Composants React avec props de locale, traductions centralisées

### 7) Personnalisation

#### Modifier le menu
Éditez `lib/menu.ts` - ajoutez vos articles dans `MENU_FR` et `MENU_EN` :
```typescript
{
  id: "mon_article", // ID unique (même dans les 2 langues)
  name: "Mon Article", // Nom dans la langue
  priceCents: 599 // Prix en centimes
}
```

#### Ajouter une langue
1. Étendez `translations.ts` avec votre langue
2. Ajoutez un menu dans `menu.ts`
3. Mettez à jour `LanguageSelector.tsx`
4. Adaptez les prompts dans `chat/route.ts`

### 8) Modèle OpenAI
Par défaut: `gpt-4o-mini`. Modifiable via `OPENAI_MODEL` dans `.env.local`.

### 9) Déploiement
- **Vercel recommandé** (Next.js 14 App Router)
- Définissez `OPENAI_API_KEY` dans les variables d'environnement
- Le build est automatiquement optimisé