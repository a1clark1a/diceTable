import type { ReactNode } from 'react';
import { Code, Text } from '@chakra-ui/react';

export interface MathOp {
  id: string;
  title: string;
  subtitle: string;
  plain: ReactNode;
  example: ReactNode;
  snippet: string;
}

export const mathOps: readonly MathOp[] = [
  {
    id: 'uniform',
    title: '1 · A single die — uniform distribution',
    subtitle: 'building block for everything else',
    plain: (
      <Text>
        A fair N-sided die has the same chance of landing on each face. For a
        d6, every face is exactly 1 in 6.
      </Text>
    ),
    example: (
      <Text>
        P(X = <Code>1</Code>) = P(X = <Code>2</Code>) = … = P(X ={' '}
        <Code>6</Code>) = <Code>1/6 ≈ 0.1667</Code>
      </Text>
    ),
    snippet: `// uniform distribution on faces 1..N
P(X = k) = 1 / N    for k in [1, N]
P(X = k) = 0        otherwise`,
  },
  {
    id: 'convolution',
    title: '2 · Multiple dice — convolution',
    subtitle: 'how 2d6 becomes the bell-shaped 2..12 distribution',
    plain: (
      <Text>
        When you sum two independent dice, the chance of getting any specific
        total is the sum of every pair of face values that add up to it. This
        operation — combining two distributions into the distribution of their
        sum — is called <em>convolution</em>.
      </Text>
    ),
    example: (
      <Text>
        Pairs that sum to 7:{' '}
        <Code>(1,6), (2,5), (3,4), (4,3), (5,2), (6,1)</Code> — six pairs out
        of 36 total → <Code>P(sum = 7) = 6/36 ≈ 0.1667</Code>
      </Text>
    ),
    snippet: `// convolution of two independent distributions
(P_X * P_Y)(k) = Σ  P_X(j) · P_Y(k − j)
                 j

// for N dice, convolve N−1 times
P_total = P_die ⊛ P_die ⊛ … ⊛ P_die   (N copies)`,
  },
  {
    id: 'modifier',
    title: '3 · Modifier — distribution shift',
    subtitle: '+M slides every outcome up by M',
    plain: (
      <Text>
        Adding a flat <Code>+M</Code> doesn’t change any probabilities — it
        just relabels every outcome. The shape of the chart is identical, just
        shifted to the right.
      </Text>
    ),
    example: (
      <Text>
        Possible totals are <Code>3, 4, 5, 6, 7, 8</Code>, each with
        probability <Code>1/6</Code>. Same as 1d6 with each face relabeled.
      </Text>
    ),
    snippet: `P_(X + M)(k) = P_X(k − M)`,
  },
  {
    id: 'keep',
    title: '4 · Keep highest / lowest — combinatorial enumeration',
    subtitle: 'e.g. 4d6kh3 — the classic ability-score roll',
    plain: (
      <Text>
        For each possible outcome of the full pool of N dice, sort the rolled
        faces, drop the ones we’re not keeping, and sum the rest. We weight
        each outcome by its probability. There’s no closed-form shortcut —
        DiceTable enumerates every ordered draw.
      </Text>
    ),
    example: (
      <Text>
        All <Code>6⁴ = 1296</Code> ordered outcomes of 4d6. For each, sort
        descending, sum the top 3. Mean works out to <Code>≈ 12.24</Code> (vs.{' '}
        <Code>10.5</Code> for plain 3d6).
      </Text>
    ),
    snippet: `// keep the K highest of N dice
for each ordered outcome (r₁, r₂, …, r_N):
    sorted   = sort_desc(r₁, …, r_N)
    kept_sum = sorted[0] + sorted[1] + … + sorted[K−1]
    P(total = kept_sum) += (1/S)^N

// where S = die size`,
  },
  {
    id: 'advantage',
    title: '5 · Advantage / Disadvantage',
    subtitle: 'roll the whole expression twice, take max or min',
    plain: (
      <Text>
        Advantage applies to the entire roll, not a single die. We compute the
        base distribution once, then derive the “max of two independent draws”
        distribution from it.
      </Text>
    ),
    example: (
      <Text>
        P(rolling 20 normally) = <Code>1/20 = 0.05</Code>
        <br />
        P(rolling 20 with advantage) = <Code>1 − (19/20)² ≈ 0.0975</Code>
      </Text>
    ),
    snippet: `// advantage: max of two independent rolls
P_adv(X ≤ k) = P(X ≤ k)²
P_adv(X = k) = P_adv(X ≤ k) − P_adv(X ≤ k − 1)

// disadvantage: min of two independent rolls
P_dis(X ≥ k) = P(X ≥ k)²
P_dis(X = k) = P_dis(X ≥ k) − P_dis(X ≥ k + 1)`,
  },
  {
    id: 'reroll',
    title: '6 · Reroll — once vs. always',
    subtitle: 'two flavors with very different math',
    plain: (
      <Text>
        <strong>Reroll once:</strong> if the first roll is in the reroll set R,
        you re-roll exactly once and keep that result no matter what.
        <br />
        <strong>Reroll always:</strong> keep re-rolling until the result is
        not in R. Equivalent to drawing only from the acceptable faces.
      </Text>
    ),
    example: (
      <Text>
        With probability <Code>5/6</Code> the first roll is kept (faces 2..6).
        <br />
        With probability <Code>1/6</Code> we re-roll and the result is uniform
        on 1..6.
        <br />
        So P(face k) = <Code>5/6 · [k ≠ 1] · 1/5 + 1/6 · 1/6</Code>
      </Text>
    ),
    snippet: `// reroll once: blend kept first-roll with uniform second-roll
P_once(X = k) = (k ∉ R) · P(X = k)               // kept
              + P(X ∈ R) · P(X = k)              // re-rolled

// reroll always: distribution restricted to the acceptable set
P_always(X = k) = P(X = k) / P(X ∉ R)            for k ∉ R
P_always(X = k) = 0                              for k ∈ R`,
  },
  {
    id: 'explode',
    title: '7 · Explode — recursive convolution with a depth cap',
    subtitle: 'e.g. d6! — roll again on a 6 and add',
    plain: (
      <Text>
        When the die lands on the chosen face F, you roll it again and add.
        That second roll can also explode, and so on. DiceTable caps recursion
        at a maximum depth so the computation always terminates — the
        residual probability tail is small and capped to the highest
        representable value.
      </Text>
    ),
    example: (
      <Text>
        P(total = 6) = <Code>0</Code> (a 6 always explodes)
        <br />
        P(total = 7) = P(roll 6, then 1) = <Code>1/6 · 1/6 ≈ 0.028</Code>
        <br />
        P(total = 12) = P(6, then 6, then depth cap) = <Code>1/36</Code>
      </Text>
    ),
    snippet: `// recursive: P_explode = non-exploding tail + (exploding face) ⊛ P_explode
explode(P, F, depth):
    if depth == 0:
        return P                       // no more recursion
    P_keep = { k : P(k)  for k ≠ F }   // non-exploding outcomes
    P_pop  = { k : P(F)  for k = F }   // the exploding face
    P_next = explode(P, F, depth − 1)
    return P_keep ⊕ ( P_pop ⊛ shift_by_F(P_next) )

// ⊕ = pointwise sum, ⊛ = convolution`,
  },
];
