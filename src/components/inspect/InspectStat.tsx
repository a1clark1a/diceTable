import {
  Box,
  Popover,
  Portal,
  Stack,
  Text,
  chakra,
} from '@chakra-ui/react';
import type { ReactNode } from 'react';
import type { Distribution } from '../../types';
import { DistributionTable } from './DistributionTable';
import { TIPS } from '../ui/tips';
import { formatNumber } from '../chart/format';

interface StatTriggerProps {
  ariaLabel: string;
  title: string;
  children: ReactNode;
}

function StatTrigger({ ariaLabel, title, children }: StatTriggerProps) {
  return (
    <Popover.Trigger asChild>
      <chakra.button
        type="button"
        cursor="pointer"
        bg="transparent"
        color="inherit"
        fontFamily="inherit"
        fontSize="inherit"
        fontWeight="inherit"
        px={1}
        mx={-1}
        py={0}
        borderRadius="sm"
        borderBottomWidth="1px"
        borderBottomStyle="dotted"
        borderBottomColor="fg.muted"
        _hover={{ bg: 'bg.muted', borderBottomColor: 'colorPalette.solid' }}
        _focusVisible={{
          outline: '2px solid',
          outlineColor: 'colorPalette.solid',
          outlineOffset: '2px',
        }}
        aria-label={ariaLabel}
        title={title}
      >
        {children}
      </chakra.button>
    </Popover.Trigger>
  );
}

interface PanelHeaderProps {
  label: string;
  hint: string;
  value: string;
}

function PanelHeader({ label, hint, value }: PanelHeaderProps) {
  return (
    <Stack gap={0.5}>
      <Text
        fontSize="2xs"
        textTransform="uppercase"
        color="fg.muted"
        fontWeight="semibold"
        letterSpacing="wider"
      >
        {label}
        <Text
          as="span"
          ml={2}
          fontFamily="mono"
          color="fg"
          fontSize="xs"
          style={{ fontVariantNumeric: 'tabular-nums' }}
          textTransform="none"
          letterSpacing="normal"
        >
          {value}
        </Text>
      </Text>
      <Text fontSize="xs" color="fg.muted">
        {hint}
      </Text>
    </Stack>
  );
}

const PANEL_WIDTH = { base: 'calc(100vw - 32px)', sm: '320px' } as const;

interface InspectStatBaseProps {
  exprName: string;
  hasDist: boolean;
  children: ReactNode;
}

interface InspectMeanProps extends InspectStatBaseProps {
  dist: Distribution;
  mean: number;
}

export function InspectMean({
  exprName,
  hasDist,
  dist,
  mean,
  children,
}: InspectMeanProps) {
  if (!hasDist) return <>{children}</>;
  return (
    <Popover.Root positioning={{ placement: 'top' }} lazyMount unmountOnExit>
      <StatTrigger
        ariaLabel={`Inspect mean for ${exprName}`}
        title={TIPS.inspectMean}
      >
        {children}
      </StatTrigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content maxW="320px" w={PANEL_WIDTH}>
            <Popover.Arrow>
              <Popover.ArrowTip />
            </Popover.Arrow>
            <Popover.Body p={3}>
              <Stack gap={2}>
                <PanelHeader
                  label="Mean"
                  hint={TIPS.inspectMean}
                  value={`µ ≈ ${formatNumber(mean, 3)}`}
                />
                <DistributionTable
                  dist={dist}
                  mean={mean}
                  showCumulative={false}
                  showWeighted
                  maxHeight="280px"
                />
              </Stack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}

interface InspectModeProps extends InspectStatBaseProps {
  dist: Distribution;
  modes: number[];
}

export function InspectMode({
  exprName,
  hasDist,
  dist,
  modes,
  children,
}: InspectModeProps) {
  if (!hasDist) return <>{children}</>;
  const valueLabel =
    modes.length === 0
      ? '—'
      : modes.length === 1
        ? String(modes[0])
        : `${modes.length} tied`;
  return (
    <Popover.Root positioning={{ placement: 'top' }} lazyMount unmountOnExit>
      <StatTrigger
        ariaLabel={`Inspect mode for ${exprName}`}
        title={TIPS.inspectMode}
      >
        {children}
      </StatTrigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content maxW="320px" w={PANEL_WIDTH}>
            <Popover.Arrow>
              <Popover.ArrowTip />
            </Popover.Arrow>
            <Popover.Body p={3}>
              <Stack gap={2}>
                <PanelHeader
                  label="Mode"
                  hint={TIPS.inspectMode}
                  value={valueLabel}
                />
                <DistributionTable
                  dist={dist}
                  modes={modes}
                  order="prob-desc"
                  showCumulative={false}
                  limit={10}
                  maxHeight="280px"
                />
                <Text fontSize="2xs" color="fg.muted">
                  Top {Math.min(10, dist.size)} of {dist.size} possible{' '}
                  {dist.size === 1 ? 'result' : 'results'}.
                </Text>
              </Stack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}

interface InspectSigmaProps extends InspectStatBaseProps {
  dist: Distribution;
  mean: number;
  stddev: number;
}

export function InspectSigma({
  exprName,
  hasDist,
  dist,
  mean,
  stddev,
  children,
}: InspectSigmaProps) {
  if (!hasDist) return <>{children}</>;
  const lo = mean - stddev;
  const hi = mean + stddev;
  return (
    <Popover.Root positioning={{ placement: 'top' }} lazyMount unmountOnExit>
      <StatTrigger
        ariaLabel={`Inspect spread for ${exprName}`}
        title={TIPS.inspectSigma}
      >
        {children}
      </StatTrigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content maxW="320px" w={PANEL_WIDTH}>
            <Popover.Arrow>
              <Popover.ArrowTip />
            </Popover.Arrow>
            <Popover.Body p={3}>
              <Stack gap={2}>
                <PanelHeader
                  label="Spread (σ)"
                  hint={TIPS.inspectSigma}
                  value={`σ ≈ ${formatNumber(stddev, 3)}`}
                />
                <Box
                  fontSize="2xs"
                  color="fg.muted"
                  fontFamily="mono"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  Shaded: {formatNumber(lo, 2)} – {formatNumber(hi, 2)}
                </Box>
                <DistributionTable
                  dist={dist}
                  mean={mean}
                  shadeRange={{ lo, hi }}
                  showCumulative={false}
                  maxHeight="260px"
                />
              </Stack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}

