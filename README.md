# neon-harbor-heatline

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/mutclodk/neon-harbor-heatline/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/mutclodk/neon-harbor-heatline/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

NEON HARBOR: HEATLINE is an action game set in the golden-hour atmosphere of Port Solano, playable directly in the browser. Players can seamlessly transition between driving vehicle fleets and exploring the city on foot across distinct urban sectors. Take on varied criminal and tactical missions while navigating dynamic traffic and pedestrian activity throughout the harbour. As crimes escalate, manage your heat level to evade increasingly aggressive police responses patrolling the streets. Complete objectives efficiently to maximize your final score and earn top grades on the results screen.

Features:
- Distinct Port Solano districts offering varied urban landscapes, harbour fronts, and roadways.
- Curated mission set with diverse objectives, checkpoints, and high-octane challenges.
- Dynamic wanted and heat system scaling police pressure dynamically based on player actions.
- Ambient traffic and pedestrian simulation populating city streets with responsive AI entities.
- Real-time minimap and HUD interface displaying navigation markers, speed, heat, and mission targets.
- Fully deterministic physics and game loop simulation ensuring reproducible gameplay across sessions.

Controls: WASD or arrow keys to move and drive, E to enter or exit a car, Shift to sprint, Esc to pause.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. (The entrypoint main.ts also packages the game and its dossier for the make.fun grader: MAKEFUN_OUTPUT_DIR=out node main.ts)

---
<sub>Entered on [make.fun](https://make.fun/?ref=steady-heron-12&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
