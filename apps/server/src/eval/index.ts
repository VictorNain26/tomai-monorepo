/** The evaluation set, validated at load: the harness comes back with step 8 of the overhaul. */

import sixieme from './exercises/sixieme.json' with { type: 'json' };
import cinquieme from './exercises/cinquieme.json' with { type: 'json' };
import quatrieme from './exercises/quatrieme.json' with { type: 'json' };
import troisieme from './exercises/troisieme.json' with { type: 'json' };
import scenarios from './scenarios.json' with { type: 'json' };
import { datasetSchema } from './schema';

export const dataset = datasetSchema.parse({
  exercises: [...sixieme, ...cinquieme, ...quatrieme, ...troisieme],
  scenarios,
});
