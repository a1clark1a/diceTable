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
    title: '1 · A single die: every face equally likely',
    subtitle: 'the building block for everything else',
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
    title: '2 · Multiple dice: convolution',
    subtitle: 'how 2d6 makes a bell-shaped curve from 2 to 12',
    plain: (
      <Text>
        When you roll two dice and add them up, the chance of any given total
        is just the count of every face pair that produces it, divided by all
        the pairs that could come up. The move of taking two sets of odds
        and combining them into the odds of their sum has a name:{' '}
        <em>convolution</em>.
      </Text>
    ),
    example: (
      <Text>
        Pairs that sum to 7:{' '}
        <Code>(1,6), (2,5), (3,4), (4,3), (5,2), (6,1)</Code>. Six pairs out
        of 36 total, so <Code>P(sum = 7) = 6/36 ≈ 0.1667</Code>.
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
    title: '3 · Modifier: shifting the whole roll',
    subtitle: '+M slides every result up by M (or down, if it’s negative)',
    plain: (
      <Text>
        Adding a flat <Code>+M</Code> doesn’t change any of the chances. It
        just relabels every result. The chart looks the same as before, just
        slid sideways.
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
    title: '4 · Keep highest / lowest: looking at every possible roll',
    subtitle: 'e.g. 4d6kh3, the classic ability-score roll',
    plain: (
      <Text>
        For every way the dice could come up, sort the faces, drop the ones
        you aren’t keeping, and add up the rest. There’s no shortcut formula
        for this one, so DiceTable just goes through every possible roll and
        weights it by how often it would actually happen.
      </Text>
    ),
    example: (
      <Text>
        4d6 has <Code>6⁴ = 1296</Code> possible rolls. Sort each one
        descending and add the top 3. The average works out to{' '}
        <Code>≈ 12.24</Code>, noticeably higher than{' '}
        <Code>10.5</Code> for plain 3d6.
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
    subtitle: 'roll the whole thing twice, keep the higher (or lower)',
    plain: (
      <Text>
        Advantage applies to the entire roll, not to one die at a time.
        DiceTable starts from the normal odds of the roll, then works out
        “if you rolled this twice, how often would the higher result land on
        each number?” Disadvantage is the same idea, but keeping the lower.
      </Text>
    ),
    example: (
      <Text>
        The chance of rolling a 20 on 1d20 normally is{' '}
        <Code>1/20 = 0.05</Code>.
        <br />
        With advantage it nearly doubles, to{' '}
        <Code>1 − (19/20)² ≈ 0.0975</Code>.
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
    title: '6 · Reroll: once vs. always',
    subtitle: 'two flavors that play very differently',
    plain: (
      <Text>
        <strong>Reroll once:</strong> if your first roll matches one of the
        trigger faces, you reroll one time and keep whatever comes up, even
        if it triggers again.
        <br />
        <strong>Reroll always:</strong> keep rerolling until you land on a
        face that isn’t in the trigger set, so the final result can never be
        one of the rerolled faces.
      </Text>
    ),
    example: (
      <Text>
        Take 1d6 with “reroll 1 once.” Five times out of six the first roll
        sticks (faces 2 to 6).
        <br />
        One time in six the 1 triggers a reroll, and the second roll is a
        normal 1d6.
        <br />
        Combining those two cases gives{' '}
        <Code>P(face k) = 5/6 · [k ≠ 1] · 1/5 + 1/6 · 1/6</Code>.
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
    title: '7 · Explode: chained rolls on a trigger face',
    subtitle: 'e.g. d6!, roll again on a 6 and add it on',
    plain: (
      <Text>
        When the die lands on the trigger face, you roll it again and add the
        new result. That second roll can itself trigger another, and so on.
        In theory the chain could keep going forever, so DiceTable stops it
        after a few links to keep the chart readable. Whatever tiny chance is
        left over gets folded into the highest result on the chart.
      </Text>
    ),
    example: (
      <Text>
        Rolling a 6 on a d6! never stays as 6, because a 6 always triggers
        another roll. So <Code>P(total = 6) = 0</Code>.
        <br />
        A total of 7 means rolling a 6, then a 1:{' '}
        <Code>1/6 · 1/6 ≈ 0.028</Code>.
        <br />
        Reaching 12 takes a 6, then a 6, then whatever the chain cap forces:{' '}
        <Code>1/36</Code>.
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
