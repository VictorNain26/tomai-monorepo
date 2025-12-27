/**
 * Test de l'usage réaliste des élèves
 * Simule VRAIMENT comment les élèves parlent et interagissent
 *
 * Run: docker exec tomai-backend-dev bun run scripts/test-realistic-student-usage.ts
 *
 * Catégories testées:
 * 1. Aide aux devoirs (cas #1 en usage réel)
 * 2. Confusion/blocage sur un concept
 * 3. Frustration/démotivation
 * 4. Demande de réponse directe (test socratique)
 * 5. Questions mal formulées (typos, abréviations)
 */

const BASE_URL = 'http://localhost:3000';
const CHILD_USERNAME = 'testchild';
const CHILD_PASSWORD = 'Child123!';
const DELAY_MS = 2000;

// Scénarios RÉALISTES par niveau
const REALISTIC_SCENARIOS = [
  // === CYCLE 2 (CP-CE2) : 6-8 ans ===
  {
    level: 'cp',
    subject: 'mathematiques',
    message: "je sais pas compter apres 10",
    context: "Frustration simple - CP qui bloque sur les nombres"
  },
  {
    level: 'ce1',
    subject: 'francais',
    message: "c koi un nom propre",
    context: "Question basique avec typo/abréviation typique"
  },
  {
    level: 'ce2',
    subject: 'mathematiques',
    message: "jai un exo de maths 24+37 c combien",
    context: "Demande directe de réponse - test si Tom guide ou donne"
  },

  // === CYCLE 3 (CM1-6ème) : 9-11 ans ===
  {
    level: 'cm1',
    subject: 'mathematiques',
    message: "je comprends rien aux divisions cest trop dur",
    context: "Expression de frustration + blocage conceptuel"
  },
  {
    level: 'cm2',
    subject: 'sciences',
    message: "pk les plantes sont vertes?",
    context: "Curiosité naturelle avec abréviation"
  },
  {
    level: 'sixieme',
    subject: 'mathematiques',
    message: "jai un dm de maths sur les fractions aide moi stp",
    context: "Aide aux devoirs - cas d'usage #1"
  },

  // === CYCLE 4 (5ème-3ème) : 12-14 ans ===
  {
    level: 'cinquieme',
    subject: 'mathematiques',
    message: "les nombres relatifs jcomprends pas pourquoi -3 + 5 ca fait 2",
    context: "Confusion conceptuelle spécifique"
  },
  {
    level: 'quatrieme',
    subject: 'francais',
    message: "jai une dissert a faire sur moliere jai 0 idee",
    context: "Demande d'aide large - pas de question précise"
  },
  {
    level: 'quatrieme',
    subject: 'mathematiques',
    message: "pythagore jy comprends rien, donne moi juste la formule",
    context: "Demande explicite de réponse directe"
  },
  {
    level: 'troisieme',
    subject: 'histoire',
    message: "brevet dans 2 semaines jsuis perdu sur la 2nd guerre mondiale",
    context: "Stress examen + sujet vaste"
  },
  {
    level: 'troisieme',
    subject: 'mathematiques',
    message: "les fonctions ca sert a quoi dans la vraie vie?",
    context: "Question sur l'utilité - motivation"
  },

  // === LYCÉE (2nde-Term) : 15-17 ans ===
  {
    level: 'seconde',
    subject: 'mathematiques',
    message: "équations du 2nd degré je bloque sur le discriminant",
    context: "Blocage technique précis"
  },
  {
    level: 'premiere',
    subject: 'philosophie',
    message: "dissertation sur la liberté, jcomprends pas la problématique",
    context: "Difficulté méthodologique"
  },
  {
    level: 'terminale',
    subject: 'mathematiques',
    message: "les intégrales cest quoi en fait? genre concretement",
    context: "Demande de sens, pas de technique"
  },
  {
    level: 'terminale',
    subject: 'physique',
    message: "bac blanc demain, révise moi la mécanique stp",
    context: "Demande de révision rapide sous stress"
  },

  // === CAS SPÉCIAUX ===
  {
    level: 'cm2',
    subject: 'mathematiques',
    message: "jarrive pas",
    context: "Message minimal - élève découragé"
  },
  {
    level: 'quatrieme',
    subject: 'francais',
    message: "je deteste le francais ca sert a rien",
    context: "Démotivation totale"
  },
  {
    level: 'troisieme',
    subject: 'mathematiques',
    message: "exo 3 page 47 aide",
    context: "Référence à un livre sans contexte"
  },
];

interface TestResult {
  scenario: string;
  level: string;
  subject: string;
  message: string;
  context: string;
  response: string;
  timeMs: number;
}

async function signIn(): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/api/auth/sign-in/username`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: CHILD_USERNAME, password: CHILD_PASSWORD })
  });
  if (!res.ok) throw new Error(`Sign in failed: ${await res.text()}`);
  return res.headers.getSetCookie();
}

async function chat(cookies: string[], message: string, subject: string, level: string): Promise<{ response: string; time: number }> {
  const start = Date.now();

  const res = await fetch(`${BASE_URL}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookies.join('; ') },
    body: JSON.stringify({
      messages: [{ role: 'user', content: message }],
      data: { subject, schoolLevel: level }
    })
  });

  if (!res.ok) throw new Error(`Chat failed: ${await res.text()}`);

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  let raw = '';

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      raw += decoder.decode(value);
    }
  }

  // Parse SSE
  let text = '';
  for (const line of raw.split('\n')) {
    if (line.startsWith('data: ')) {
      try {
        const json = JSON.parse(line.slice(6));
        if (json.type === 'content' && json.delta) text += json.delta;
        if (json.type === 'error') throw new Error(json.error?.message || 'Generation error');
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }

  return { response: text, time: Date.now() - start };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('='.repeat(70));
  console.log('TEST USAGE RÉALISTE DES ÉLÈVES');
  console.log('Simule comment les élèves parlent vraiment à Tom');
  console.log('='.repeat(70));
  console.log('');

  console.log('Signing in...');
  const cookies = await signIn();
  console.log('Signed in\n');

  const results: TestResult[] = [];
  let successCount = 0;

  for (let i = 0; i < REALISTIC_SCENARIOS.length; i++) {
    const scenario = REALISTIC_SCENARIOS[i];
    const scenarioNum = i + 1;

    console.log(`[${scenarioNum}/${REALISTIC_SCENARIOS.length}] ${scenario.level.toUpperCase()} - ${scenario.subject}`);
    console.log(`   Context: ${scenario.context}`);
    console.log(`   Message: "${scenario.message}"`);

    try {
      const { response, time } = await chat(cookies, scenario.message, scenario.subject, scenario.level);

      if (response) {
        results.push({
          scenario: `#${scenarioNum}`,
          level: scenario.level,
          subject: scenario.subject,
          message: scenario.message,
          context: scenario.context,
          response,
          timeMs: time
        });
        successCount++;
        console.log(`   Response: ${time}ms - ${response.length} chars`);
        console.log(`   Preview: "${response.slice(0, 80).replace(/\n/g, ' ')}..."`);
      } else {
        console.log(`   WARNING: Empty response`);
      }
    } catch (e) {
      console.log(`   ERROR: ${e}`);
    }

    console.log('');

    if (i < REALISTIC_SCENARIOS.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log('='.repeat(70));
  console.log(`RÉSUMÉ: ${successCount}/${REALISTIC_SCENARIOS.length} réponses collectées`);
  console.log('='.repeat(70));

  if (results.length === 0) {
    console.log('Aucune réponse. Vérifier quota API Gemini.');
    return;
  }

  // Générer le prompt d'analyse pour Claude
  console.log('\n' + '='.repeat(70));
  console.log('PROMPT D\'ANALYSE POUR CLAUDE');
  console.log('Copier tout ce qui suit et coller dans Claude');
  console.log('='.repeat(70) + '\n');

  const analysisPrompt = `# Analyse Pédagogique - Usage Réel des Élèves

Tu es expert en sciences de l'éducation. Analyse ces réponses de notre tuteur IA selon les principes **Rosenshine + Sweller** (recherche validée).

## Critères d'évaluation

### 1. PETITES ÉTAPES (Rosenshine #2 + Sweller)
- Information décomposée en étapes digestibles
- Max 4-5 éléments nouveaux à la fois
- Vérifie la compréhension avant de continuer

### 2. EXEMPLES RÉSOLUS (Worked Example Effect)
- Pour un concept nouveau: montre un exemple complet AVANT de demander à l'élève
- "Voici comment je fais..." puis "À ton tour"

### 3. PRATIQUE GUIDÉE (Rosenshine #5)
- Accompagne les premiers essais
- Feedback immédiat sur la démarche (pas juste le résultat)

### 4. ADAPTATION (Rosenshine #7, #8)
- Vocabulaire adapté au niveau
- Si l'élève est perdu → simplifie, donne la réponse si nécessaire
- Ne laisse JAMAIS un élève frustré sans aide

### 5. VÉRIFICATION (Rosenshine #6)
- Demande de reformuler/expliquer (pas juste "oui/non")
- "Explique-moi ce que tu as compris"

---

## Réponses à analyser

${results.map((r, i) => `
### Scénario ${r.scenario}: ${r.level.toUpperCase()} - ${r.subject}
**Contexte**: ${r.context}
**Message élève**: "${r.message}"
**Temps réponse**: ${r.timeMs}ms

**Réponse Tom**:
\`\`\`
${r.response}
\`\`\`
`).join('\n---\n')}

---

## Format attendu

Pour CHAQUE réponse, évalue:

| Critère | Score (1-5) | Justification |
|---------|-------------|---------------|
| Petites étapes | X/5 | ... |
| Exemples résolus | X/5 | ... |
| Pratique guidée | X/5 | ... |
| Adaptation niveau | X/5 | ... |
| Vérification | X/5 | ... |

**Points forts**:
**À améliorer**:

---

## En conclusion

1. **Score moyen global** (/5)
2. **Tendances problématiques** identifiées
3. **Recommandations prioritaires** pour améliorer le prompt système (max 3)
`;

  console.log(analysisPrompt);
  console.log('\n' + '='.repeat(70));
}

main().catch(console.error);
