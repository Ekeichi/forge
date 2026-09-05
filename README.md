# Forge

Base de connaissances d'équipe interrogeable par un agent, cloisonnée par espace de travail et instrumentée de bout en bout.

---

## Le problème

La connaissance interne d'une équipe — procédures, décisions, contrats, conventions de projet — vit dans des documents éparpillés. Un modèle de langage généraliste ne la connaît pas, et la lui coller intégralement dans le contexte ne passe ni à l'échelle ni au budget.

Les assistants documentaires classiques répondent par un RAG systématique : chaque question déclenche une recherche vectorielle, y compris « combien font 2+2 ». C'est coûteux, ça injecte du bruit dans le contexte, et ça produit des réponses qui présentent une information trouvée dans un document comme une connaissance générale — ou l'inverse.

Forge prend un angle différent sur trois points :

1. **L'agent décide s'il faut chercher.** La recherche documentaire est un outil que le modèle appelle quand la question le justifie, pas une étape imposée du pipeline. Une question de culture générale ne touche pas la base.
2. **Le cloisonnement est vérifié à chaque requête.** Un espace de travail ne voit que ses documents, et l'appartenance est contrôlée côté serveur à chaque lecture comme à chaque écriture — jamais seulement à l'affichage.
3. **Tout est mesuré.** Chaque exécution enregistre l'outil choisi, la requête reformulée, les scores de similarité, le nombre de tours, la raison d'arrêt, la latence et les tokens. Ces mesures alimentent une page d'analytics et un jeu d'évaluations qui fait échouer la campagne sous un seuil de qualité.

---

## Architecture

Application Next.js unique (App Router). Pas de backend séparé : les mutations passent par des Server Actions, la logique métier vit dans `src/lib/`, et l'accès aux données passe par une couche d'autorisation unique.

```
src/
├── lib/                        Domaine — sans dépendance au runtime Next
│   ├── dal.ts                  Data Access Layer : session + appartenance (point de passage obligé)
│   ├── agent.ts                Boucle agent, définition des outils, métriques
│   ├── rag.ts                  Recherche vectorielle bornée au workspace
│   ├── quota.ts                Anti-rafale + plafond journalier
│   ├── auth.ts                 Configuration better-auth
│   └── prisma.ts               Client Prisma
│
├── app/
│   ├── workspaces/[workspaceId]/
│   │   ├── page.tsx            Membres, rôles, invitations, chat
│   │   ├── actions.ts          askForge — autorisation → quota → agent → journalisation
│   │   ├── analytics/          KPI et journal des exécutions
│   │   └── documents/          CRUD documents + réindexation
│   ├── profil/                 Espaces et invitations reçues
│   └── api/auth/[...all]/      Handler better-auth
│
└── generated/prisma/           Client Prisma généré (non versionné)

evals/                          Campagne d'évaluation : 16 cas, seuils bloquants
prisma/                         Schéma et migrations
```

### La règle d'accès aux données

Une Server Action est un endpoint HTTP public. Le `workspaceId` qu'elle reçoit vient du client et n'est jamais digne de confiance.

Tout accès à des données de workspace passe donc par `src/lib/dal.ts` :

```ts
verifySession()                      // session, ou redirection vers /sign-in
getMembership(workspaceId)           // l'appartenance, ou null
hasRole(workspaceId, minRole)        // MEMBER < ADMIN < OWNER
requireMembership(workspaceId, role) // lève si insuffisant
```

Les deux premières sont mémoïsées par `cache()` de React : page et action peuvent les appeler librement, une seule lecture par requête. Une mutation portant sur un identifiant fourni par le client est en outre bornée en base — `updateMany({ where: { id, workspaceId } })` plutôt que `update({ where: { id } })` — pour que la contrainte soit appliquée dans la même requête que l'écriture.

### Modèle de données

```
User ─┬─ WorkspaceMembership ─── Workspace ─┬─ Document ─── Chunk (embedding vector(384))
      │        (rôle)                       │
      └─ WorkspaceInvitation ───────────────┘
                                            └─ AgentRun (métriques d'exécution)
```

Trois rôles : `OWNER`, `ADMIN`, `MEMBER`. Le retrait d'un membre supprime l'appartenance et l'invitation associée, et prend effet immédiatement puisque l'autorisation est revérifiée à chaque requête.

---

## Stack

| Domaine | Choix | Version |
| --- | --- | --- |
| Framework | Next.js (App Router, Turbopack) | 16.3 |
| UI | React, Tailwind CSS | 19.2 / 4 |
| Base de données | PostgreSQL + pgvector | pg16 |
| ORM | Prisma | 6.19 |
| Authentification | better-auth (email/mot de passe) | 1.7 |
| Modèle | Claude Haiku 4.5 via `@anthropic-ai/sdk` | 0.123 |
| Embeddings | `Xenova/all-MiniLM-L6-v2` (384 dim.), en processus | transformers.js 2.17 |
| Tests | Vitest | 4.1 |

---

## Le pipeline RAG

### Indexation

Déclenchée à chaque sauvegarde de document, ainsi que par l'outil `create_document`.

```mermaid
flowchart LR
  A["Document sauvegardé"] --> B["Découpage<br/>1 ligne non vide = 1 chunk"]
  B --> C["all-MiniLM-L6-v2<br/>mean pooling + normalisation"]
  C --> D["Vecteur 384 dim."]
  D --> E[("Chunk.embedding<br/>pgvector")]
```

Le découpage est intégral à chaque sauvegarde : les chunks existants sont supprimés puis reconstruits.

### Recherche

```mermaid
flowchart LR
  A["Requête de l'agent"] --> B["Embedding<br/>même modèle"]
  B --> C["1 - (embedding &lt;=&gt; $1::vector)<br/>similarité cosinus"]
  C --> D["WHERE Document.workspaceId = ?"]
  D --> E["ORDER BY score DESC<br/>LIMIT 5"]
  E --> F["Extraits balisés<br/>&lt;document_content&gt;"]
```

Deux propriétés à retenir :

- **Le filtre workspace est dans la requête SQL**, appliqué via la jointure `Chunk → Document`. Le cloisonnement ne dépend pas d'un filtrage applicatif après coup.
- **Le vecteur est un paramètre lié** (`$1::vector`), jamais une chaîne interpolée.

Le score renvoyé est une similarité et non une distance : `1 - (a <=> b)`, donc 1 = identique, 0 = orthogonal. Un score haut est un chunk plus pertinent — c'est la convention utilisée partout, y compris dans les analytics.

### Séparation donnée / instruction

Les extraits sont renvoyés au modèle encadrés par `<document_content source="…">`, et les chevrons présents dans le contenu sont neutralisés pour qu'un document ne puisse pas fermer sa propre balise. Le prompt système pose la règle correspondante : ce qui se trouve entre ces balises est du texte à lire, jamais une consigne à exécuter. Le contexte total est plafonné à 8 000 caractères.

---

## La boucle agent

`runAgent(query, workspaceId, userId)` dans `src/lib/agent.ts`. Volontairement dépourvue de toute dépendance au runtime Next — ni session, ni `headers()`, ni `after()` — pour être appelable depuis le harnais d'évaluation hors serveur.

```mermaid
flowchart TD
  A["askForge(query, workspaceId)"] --> B{"Session valide ?"}
  B -- non --> B1["Redirection /sign-in"]
  B -- oui --> C{"Membre du workspace ?"}
  C -- non --> C1["Refus"]
  C -- oui --> D{"Quota disponible ?"}
  D -- non --> D1["Refus"]
  D -- oui --> E["messages.create<br/>system + outils"]

  E --> F{"stop_reason"}
  F -- "tool_use" --> G["Exécution des outils du tour"]
  G --> H["tool_result renvoyés au modèle"]
  H -->|"tour suivant, max 3"| E
  F -- "end_turn / max_tokens" --> I["Réponse"]

  I --> J["after() : AgentRun"]
```

**Outils disponibles**

| Outil | Rôle |
| --- | --- |
| `search_documents` | Recherche sémantique dans le workspace. Le modèle formule sa propre requête, distincte de la question de l'utilisateur. |
| `create_document` | Crée et indexe un document dans le workspace. |

**Propriétés de la boucle**

- Plusieurs outils peuvent être appelés dans un même tour ; chacun reçoit son `tool_result` apparié par `tool_use_id`.
- Un outil qui échoue ne fait pas tomber la boucle : l'erreur est renvoyée au modèle en `is_error`, comptée dans `toolErrors`, et le modèle peut réagir.
- Un outil inconnu est traité comme une erreur récupérable, pas comme un crash.
- Trois tours au maximum. Au-delà, `stopReason = max_iterations` et un message de repli — l'utilisateur ne reçoit jamais une chaîne vide.
- La journalisation passe par `after()` : la réponse part sans attendre l'écriture, qui reste garantie en environnement serverless.

**Ce qui est mesuré à chaque exécution**

`toolCalled`, `toolNames`, `toolQuery`, `resultCount`, `topScore`, `averageScore`, `docCreated`, `iterations`, `stopReason`, `toolErrors`, `success`, `latencyMs`, `inputTokens`, `outputTokens`.

Ces colonnes alimentent `/workspaces/[id]/analytics` : taux de succès, latence moyenne et p95, taux de recours aux outils, tours moyens, score de similarité moyen, consommation de tokens.

---

## Lancer le projet

**Prérequis** — Node 20+ (développé sur 24), Docker, une clé API Anthropic.

### 1. Dépendances

```bash
npm install
```

### 2. Variables d'environnement

Créez un fichier `.env` à la racine :

```bash
# Base de données
POSTGRES_USER=postgres
POSTGRES_PASSWORD=changez-moi
POSTGRES_DB=forge
DATABASE_URL="postgresql://postgres:changez-moi@localhost:5432/forge"
SHADOW_DATABASE_URL="postgresql://postgres:changez-moi@localhost:5432/forge_shadow"

# Authentification
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=<openssl rand -base64 32>

# Modèle
ANTHROPIC_API_KEY=sk-ant-...
```

Variables facultatives, avec leurs valeurs par défaut :

```bash
AGENT_BURST_MAX=10            # requêtes par utilisateur et par fenêtre
AGENT_BURST_WINDOW_S=60       # durée de la fenêtre, en secondes
AGENT_DAILY_WORKSPACE_MAX=200 # plafond journalier par espace de travail
```

`docker-compose.yml` lit `POSTGRES_PASSWORD` depuis ce fichier et échoue explicitement si la variable manque : aucun mot de passe n'est écrit dans un fichier versionné.

### 3. Base de données

```bash
docker compose up -d          # PostgreSQL + pgvector, sur 127.0.0.1:5432
npx prisma migrate dev        # migrations, extension vector comprise
npx prisma generate           # client généré dans src/generated/prisma (non versionné)
```

### 4. Développement

```bash
npm run dev
```

L'application écoute sur http://localhost:3000. Créez un compte, puis un espace de travail, ajoutez un document et interrogez-le.

> Le premier appel à l'agent télécharge le modèle d'embedding (~90 Mo) et le charge en mémoire. Ce premier appel prend plusieurs secondes ; les suivants sont immédiats.

### Tests et évaluations

```bash
npm test     # tests unitaires — dépendances mockées, aucun appel réseau
npm run eval # campagne d'évaluation — vraie base, vrai embedder, vraie API (facturée)
```

La campagne d'évaluation crée un espace de travail jetable, y indexe trois documents de référence, puis joue 16 cas. Elle mesure trois choses séparément — pour distinguer un échec de recherche d'un échec de raisonnement — et échoue sous ses seuils :

| Métrique | Ce qu'elle mesure | Seuil |
| --- | --- | --- |
| Précision de routage | Le bon outil est-il choisi (ou aucun) ? | ≥ 80 % |
| Recall@5 | Le chunk attendu est-il dans le top 5 ? | ≥ 90 % |
| Qualité des réponses | La réponse contient-elle les éléments attendus ? | par cas |

Elle vérifie aussi qu'aucune exécution ne sature `MAX_ITERATIONS` et qu'aucun outil n'échoue, et rapporte latence médiane, p95 et coût par requête.

---

## Choix techniques et compromis

### Server Actions plutôt qu'une API REST

Une seule application, mutations typées de bout en bout, pas de couche de sérialisation à maintenir. Le compromis est qu'une Server Action **est** un endpoint public : elle n'a pas de signature visible, ce qui rend facile d'oublier qu'elle est atteignable directement. La DAL existe précisément pour ça — c'est le point de passage qui rend l'oubli difficile.

### L'agent décide, le pipeline ne décide pas

Le RAG classique cherche à chaque requête. Ici la recherche est un outil, et le routage devient une métrique de premier ordre — d'où la précision de routage dans les évaluations. On y gagne le coût et la propreté du contexte sur les questions qui n'ont rien à voir avec les documents ; on y perd le déterminisme, et un mauvais routage produit une réponse générique là où un document faisait autorité. C'est ce que le seuil de 80 % surveille.

### Embeddings en processus plutôt que par API

`transformers.js` fait tourner MiniLM localement : pas de clé supplémentaire, pas de coût par document, pas de fuite du contenu vers un tiers, et les évaluations tournent hors ligne pour cette partie. Le prix est réel : ~90 Mo de modèle chargés en mémoire de chaque instance, plusieurs secondes au premier appel, et une réindexation qui occupe le processus. **C'est le point d'architecture à revoir en premier pour un déploiement serverless** — soit un service d'embedding dédié, soit une API.

MiniLM est par ailleurs un modèle anglophone utilisé sur un produit francophone. Il fonctionne, mais un modèle multilingue améliorerait le recall.

### Découpage par ligne

Le découpage actuel est un `split("\n")` : une ligne non vide donne un chunk. C'est simple, lisible, et le recall mesuré par les évaluations est bon — mais les documents de référence sont écrits une phrase par ligne, ce qui joue en faveur de cette stratégie. Sur un document rédigé en paragraphes ou collé depuis un PDF, elle produit des chunks trop courts ou trop longs, sans recouvrement. **Le recall@5 des évaluations n'est donc pas transférable tel quel** à des documents réels ; un découpage sémantique avec fenêtre glissante est le prochain pas.

### Similarité plutôt que distance

pgvector renvoie une distance cosinus (`<=>`, plus bas = plus proche). Elle est convertie en similarité une seule fois, dans la requête SQL, pour que « score haut = plus pertinent » soit vrai partout dans le code, les métriques et l'interface. Éviter deux conventions opposées dans la même base de code vaut la soustraction.

### Réindexation synchrone

Sauvegarder un document déclenche immédiatement son découpage et le calcul des embeddings, dans la requête. C'est direct et sans infrastructure, mais un document long fait attendre — et finit par faire expirer — la sauvegarde. Une file d'attente est nécessaire avant tout usage réel.

### Limites connues

Assumées à ce stade, listées pour qu'elles ne soient pas découvertes en production :

- **Pas d'index vectoriel** (`ivfflat` / `hnsw`) : la recherche est un scan séquentiel. Correct à petite échelle, linéaire ensuite.
- **Le singleton Prisma est désactivé** dans `src/lib/prisma.ts` : chaque rechargement à chaud crée un client, chaque instance un pool. À restaurer avant toute montée en charge.
- **Le limiteur anti-rafale est en mémoire**, donc par instance. Le plafond journalier, lui, est en base et donc global. Un store partagé est nécessaire dès la deuxième instance.
- **Pas de streaming ni d'historique de conversation** : chaque question est indépendante et la réponse arrive d'un bloc.
- **Pas de citations** : la réponse ne dit pas de quel document elle provient, alors que la recherche connaît le titre de chaque extrait.
- **Pas d'envoi d'email** : une invitation n'est visible que sur `/profil`, et la vérification d'adresse est désactivée en conséquence.
- **Les analytics portent sur les 50 dernières exécutions** et sont agrégées côté application.
