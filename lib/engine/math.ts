import type { OutcomeProbabilities } from "@/lib/engine/types";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function poissonProbability(lambda: number, k: number): number {
  let factorial = 1;
  for (let i = 2; i <= k; i += 1) factorial *= i;
  return Math.exp(-lambda) * Math.pow(lambda, k) / factorial;
}

export function overProbability(lambdaTotal: number, line: 0.5 | 1.5 | 2.5 | 3.5 | 4.5): number {
  const maxGoals = Math.floor(line);
  let underOrEqual = 0;
  for (let goals = 0; goals <= maxGoals; goals += 1) underOrEqual += poissonProbability(lambdaTotal, goals);
  return clamp(1 - underOrEqual, 0, 1);
}

export function teamOverProbability(lambda: number, line: 0.5 | 1.5): number {
  if (line === 0.5) return 1 - poissonProbability(lambda, 0);
  return 1 - poissonProbability(lambda, 0) - poissonProbability(lambda, 1);
}

export function bttsProbability(lambdaHome: number, lambdaAway: number): number {
  return 1 - Math.exp(-lambdaHome) - Math.exp(-lambdaAway) + Math.exp(-(lambdaHome + lambdaAway));
}

export function outcomeProbabilities(lambdaHome: number, lambdaAway: number, maxGoals = 8): OutcomeProbabilities {
  let home = 0, draw = 0, away = 0;
  for (let h = 0; h <= maxGoals; h += 1) {
    const ph = poissonProbability(lambdaHome, h);
    for (let a = 0; a <= maxGoals; a += 1) {
      const p = ph * poissonProbability(lambdaAway, a);
      if (h > a) home += p;
      else if (h === a) draw += p;
      else away += p;
    }
  }
  const total = home + draw + away;
  return { home: home / total, draw: draw / total, away: away / total };
}
