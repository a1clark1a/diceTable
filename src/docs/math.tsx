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
    title: '4 · Keep highest / lowest',
    subtitle: 'e.g. 4d6kh3, the classic ability-score roll',
    plain: (
      <Text>
        For every way the dice could come up, sort the faces, drop the ones
        you aren’t keeping, and add up the rest. Listing those rolls one at a
        time is the obvious way to do it and the slow one: four dice is already
        1,296 of them, and a die that can explode has far more faces to combine.
        DiceTable counts levels instead, which reaches the same answer without
        ever writing a roll down. Section 10 has the identity it uses. It is the
        same walk whether the dice match or not.
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
    snippet: `// what "keep the K highest of N dice" means
for each ordered outcome (r₁, r₂, …, r_N):
    sorted   = sort_desc(r₁, …, r_N)
    kept_sum = sorted[0] + sorted[1] + … + sorted[K−1]

// what gets run instead: count dice at each level, never an outcome
sum of top K  =  Σ  min(K, C_t)        C_t = dice showing at least t
                t≥1                    (see §10)`,
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
        Reaching 13 takes a 6, then a 6, then a 1:{' '}
        <Code>1/6 · 1/6 · 1/6 = 1/216</Code>. Totals like 12 never appear at
        all, because every 6 in the chain keeps rolling. Each multiple of 6 is
        a gap on the chart, up to the depth cap, where the chain stops and the
        last 6 is kept.
      </Text>
    ),
    snippet: `// recursive: P_explode = non-exploding tail + (exploding face) ⊛ P_explode
explode(P, F, depth):
    if depth == 0:
        return P                       // no more recursion
    P_keep = { k : P(k)  for k ≠ F }   // non-exploding outcomes
    P_pop  = { k : P(F)  for k = F }   // the exploding face
    P_next = explode(P, F, depth − 1)
    return P_keep ⊕ ( P_pop ⊛ P_next )   // P_pop sits at F, so ⊛ already shifts by F

// ⊕ = pointwise sum, ⊛ = convolution`,
  },
  {
    id: 'pool',
    title: '8 · Dice pools: counting successes',
    subtitle: 'e.g. 7d10 count ≥8, score by how many dice clear the bar',
    plain: (
      <Text>
        A pool roll never adds the faces. Each die simply succeeds or fails,
        so the only number that matters per die is its chance of clearing the
        threshold. DiceTable reads that chance off the die’s exact
        distribution (after any rerolls), then builds the pool one die at a
        time: each new die either adds one success or adds nothing. Mixed
        pools like 2d6 + 3d8 build each part’s count the same way, then
        combine them with the convolution from section 2. A modifier becomes
        auto-successes that shift the final count, and any result that would
        land below zero piles up at exactly zero.
      </Text>
    ),
    example: (
      <Text>
        In 7d10 with “count ≥8”, each die succeeds with <Code>p = 3/10</Code>
        , so exactly 2 successes has probability{' '}
        <Code>C(7,2) · 0.3² · 0.7⁵ ≈ 0.318</Code>.
        <br />
        Add “reroll 1s once” and each die’s chance rises to{' '}
        <Code>p = 33/100</Code>, because a rerolled 1 gets a fresh shot at 8
        or higher.
      </Text>
    ),
    snippet: `// per-die success chance, read off the exact single-die odds
p = Σ P(die = f)     for every face f that meets the threshold

// build the pool one die at a time (Bernoulli convolution)
start:    P(0) = 1
per die:  P_next(k) = P(k) · (1 − p) + P(k − 1) · p

// identical dice collapse to the binomial formula
P(k successes in N dice) = C(N, k) · p^k · (1 − p)^(N − k)

// modifier M = auto-successes, clamped at zero
P_final(k) = Σ P_pool(j)     over all j with max(0, j + M) = k`,
  },
  {
    id: 'compare',
    title: '9 · Roll-off and head-to-head: who wins?',
    subtitle: 'exact win and tie chances, no simulation',
    plain: (
      <Text>
        Both comparison views build on one idea: a roll wins at some result
        when it lands there <em>and</em> everyone else lands lower. Head-to-head
        checks that against a single opponent. The roll-off multiplies the
        “lands lower” chances of every other roll at once, so one pass over a
        roll’s results gives its chance of holding the single highest number.
        Landing equal is counted separately as a tie, which nobody wins
        outright. That’s why win chances across a roll-off can add up to less
        than 100%.
      </Text>
    ),
    example: (
      <Text>
        1d20 against 1d6: adding up each d20 face times the chance the d6 is
        lower gives a win chance of <Code>82.5%</Code>. They tie on the six
        shared faces with chance{' '}
        <Code>6 · (1/20)(1/6) = 5%</Code>, and the d6 sneaks the win in the
        remaining <Code>12.5%</Code>.
      </Text>
    ),
    snippet: `// head-to-head: A strictly beats B
P(A beats B) = Σ  P_A(v) · P_B(X < v)
               v

// tie: both land on the same value
P(tie) = Σ  P_A(v) · P_B(v)
         v

// n-way roll-off: roll i alone on top
win_i = Σ  P_i(v) · Π  P_j(X < v)      over every other roll j
        v          j≠i

// tie share: best-or-tied-best, minus outright wins
tie_i = Σ  P_i(v) · Π  P_j(X ≤ v)  −  win_i
        v          j≠i`,
  },
  {
    id: 'keep-across',
    title: '10 · Keep across parts: dice of different sizes',
    subtitle: 'e.g. 1d8 + 1d6 · keep highest 1, the trait-and-wild-die roll',
    plain: (
      <Text>
        Keeping the best few dice is the same question whether they match or
        not, so this is the walk section 4 runs too. The trick is to stop
        thinking about which die won and count levels instead. For any
        threshold t, count how many dice show at least t. The
        sum of the top n dice is the same as adding up, for every t, the smaller
        of n and that count. So DiceTable walks t downward from the highest face,
        tracking how many dice of each part have reached the current level.
        Dice inside a part are identical, so how many of them arrive at each
        level is a binomial step, which keeps the bookkeeping small. Keeping the
        lowest n is the same walk read against a mirrored roll.
      </Text>
    ),
    example: (
      <Text>
        For 1d8 + 1d6 · keep highest 1, the chance the best die is at most{' '}
        <Code>v</Code> is just the chance both are:{' '}
        <Code>P(max ≤ v) = (v/8) · (min(v,6)/6)</Code>. That gives a mean of{' '}
        <Code>251/48 ≈ 5.229</Code>, against <Code>4.5</Code> for the d8 alone.
      </Text>
    ),
    snippet: `// the level identity, for positive integer faces
sum of top n  =  Σ  min(n, C_t)        C_t = dice showing at least t
                t≥1

// keep highest 1 has a closed form: everyone lands at or below v
P(max ≤ v) = Π  F_p(v) ^ m_p           m_p = dice in part p
             p

// general n: walk t downward, state = dice per part already at or above t
// newcomers within a part are binomial, since those dice are identical
P(k of part p arrive) = C(remaining, k) · q^k · (1 − q)^(remaining − k)
                        q = P(die = t | die ≤ t)

// keep lowest n of v  =  keep highest n of (maxFace + 1 − v), read back`,
  },
  {
    id: 'check',
    title: '11 · Checks: an effect scaled by how the roll went',
    subtitle: 'e.g. 1d20 + 7 ≥15 → 1d8 + 4, crit 20 doubles the dice',
    plain: (
      <Text>
        A check row is a weighted mix of three distributions, which is why it
        still hands the chart a single curve. First the check roll is split into
        outcomes: the faces that crit, the faces that clear the bar, and the
        rest. A critical is classified on the face the die shows rather than on
        the total, because that is where advantage and rerolls already live
        exactly, and it always counts as a success. Then the effect is built
        like any summed roll, along with the bigger version a critical rolls.
        Each outcome scales the effect it applies, where half is floor division
        and nothing is a certain zero, and the results are mixed in proportion
        to how often each outcome happens. The mean that comes out is the
        average per attempt, misses included.
      </Text>
    ),
    example: (
      <Text>
        1d20+7 against 15 succeeds on a face of 8 or better, so 12 plain
        successes and the 20, and it fails on the other 7 faces. Mixing{' '}
        <Code>0.60 · (1d8+4)</Code> with <Code>0.05 · (2d8+4)</Code> and{' '}
        <Code>0.35 · 0</Code> gives a mean of exactly <Code>5.75</Code>.
      </Text>
    ),
    snippet: `// 1. split the check roll into disjoint outcomes
P(crit)    = Σ P(face = f)          for every crit face f
P(success) = Σ P(face = f)          f + modifier meets the threshold, f not a crit
P(fail)    = 1 − P(crit) − P(success)

// 2. scale one distribution by what an outcome applies
scale(D, full)    = D
scale(D, half)    = distribution of floor(D / 2)
scale(D, nothing) = point mass at 0

// 3. mix them, weighted by how often each outcome happens
P_row = P(fail)    · scale(effect, onFailure)
      + P(success) · scale(effect, onSuccess)
      + P(crit)    · scale(critEffect, onSuccess)

// advantage applies to the check roll, so it also raises the crit chance
P(crit on 20, advantage) = 1 − (19/20)² = 0.0975`,
  },
];
