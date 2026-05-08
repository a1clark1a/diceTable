export const TIPS = {
  pmf: 'How likely each exact result is. (Probability Mass Function.)',
  cdf: 'How often you’ll roll at most a given number. (Cumulative Distribution Function.)',
  ccdf:
    'How often you’ll roll at least a given number — useful for "beat the DC" checks. (Complementary CDF.)',
  targetView:
    'Shows each row’s chances against your targets — bars left to right go in target order.',
  sigma:
    'How spread out the results are. Lower σ means more consistent rolls.',
  mean: 'The average result you’d see over many rolls.',
  meanSigma:
    'The average result, with how spread out rolls land around it. Lower σ means more consistent rolls.',
  range: 'The smallest and largest possible results.',
  mode: 'The result(s) you’ll see most often. When many results are equally likely, only a few are shown — click to see all of them.',
  min: 'The smallest possible result.',
  max: 'The largest possible result.',
  mod: 'A flat number added to every roll’s total.',
  hit: 'How often each row meets the target. With multiple targets, you’ll see one row per target.',
  roll: 'Open the roller — pick how many times to roll, see recent results. History stays until you reload the page.',
  target:
    'Reference numbers like ACs or save DCs — up to 5. Press Enter to add each; the Hit % column shows how often each row meets each one.',
  rollMode:
    'Applies to the whole roll. Advantage rolls twice and takes the higher; disadvantage rolls twice and takes the lower.',
  rollModeNormal: 'Roll once.',
  rollModeAdvantage: 'Roll twice and take the higher result.',
  rollModeDisadvantage: 'Roll twice and take the lower result.',
  keep:
    'Keep only the highest or lowest N dice from the pool. For example, 4d6kh3 rolls 4d6 and keeps the 3 highest.',
  reroll:
    'Reroll specific faces. "Once" rerolls each die at most once; "always" keeps going until the result is acceptable.',
  explode:
    'When a die lands on a chosen face, roll it again and add the result. Capped at a maximum depth.',
  inspectDistribution:
    'See the chance of every result. Useful for double-checking the stats above.',
  inspectMean:
    'How the average is built. Each row shows what that result contributes to the mean.',
  inspectMode:
    'The results most likely to come up, ordered by chance.',
  inspectSigma:
    'The shaded band is one σ either side of the mean — most rolls land here.',
  share:
    'Copy a link, copy JSON, or download a file of your rolls. Anyone with the link sees the same table.',
  import:
    'Bring rolls in from a share link, JSON, or a file. Choose to add to the table or replace it.',
};

export function tipForKeep(token: string): string {
  const m = /^k(h|l)(\d+)$/.exec(token);
  if (!m) return TIPS.keep;
  const dir = m[1] === 'h' ? 'highest' : 'lowest';
  const n = m[2];
  return `${token}: keep the ${n} ${dir} dice from the pool.`;
}
