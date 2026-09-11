import {
  useCallback,
  useMemo,
  useState,
  type RefObject,
} from 'react';
import {
  Box,
  Button,
  CloseButton,
  Dialog,
  Flex,
  HStack,
  IconButton,
  Menu,
  Portal,
  Text,
} from '@chakra-ui/react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Dices,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react';
import { useApp } from '../state/useApp';
import { isTotalsMode } from '../engine/expression';
import { effectiveChartView, targetViewAvailable } from './chart/effectiveView';
import { ParamLabel } from './ParamLabel';
import {
  MAX_EXPRESSIONS,
  type ChartView,
  type Expression,
  type RollMode,
} from '../types';
import { ExamplesDialog } from './presets/ExamplesDialog';
import { ShareImagePopover } from './share/ShareImagePopover';
import { Tooltip } from './ui/tooltip';
import { HelpTerm } from './ui/help-term';
import { tipForId } from '../docs/glossary';
import { useIsDesktop } from '../hooks/useBreakpoint';

interface SegmentedOption {
  value: string;
  label: string;
  // Kept separate from label so an abbreviated chip still announces its full
  // name. The visible text stays a prefix of it, which is what WCAG 2.5.3
  // needs for speech input to reach the chip by what it says.
  ariaLabel: string;
  tip: string;
}

const CHART_VIEWS: readonly (SegmentedOption & { value: ChartView })[] = [
  { value: 'pmf', label: 'PMF', ariaLabel: 'PMF', tip: tipForId('pmf') },
  { value: 'cdf', label: 'CDF', ariaLabel: 'CDF', tip: tipForId('cdf') },
  { value: 'ccdf', label: 'CCDF', ariaLabel: 'CCDF', tip: tipForId('ccdf') },
  {
    value: 'target',
    label: 'TARGET',
    ariaLabel: 'TARGET',
    tip: tipForId('targetView'),
  },
];

const ROLL_MODES: readonly (SegmentedOption & { value: RollMode })[] = [
  {
    value: 'normal',
    label: 'Normal',
    ariaLabel: 'Normal',
    tip: tipForId('rollModeNormal'),
  },
  {
    value: 'advantage',
    label: 'Adv',
    ariaLabel: 'Advantage',
    tip: tipForId('rollModeAdvantage'),
  },
  {
    value: 'disadvantage',
    label: 'Dis',
    ariaLabel: 'Disadvantage',
    tip: tipForId('rollModeDisadvantage'),
  },
];

function isRollMode(value: string): value is RollMode {
  return (
    value === 'normal' || value === 'advantage' || value === 'disadvantage'
  );
}

interface RollModeSummary {
  activeMode: RollMode | null;
  mixed: boolean;
}

// Pool rows ignore rollMode entirely (they count successes), so only rows that
// read it decide "mixed" - sum rows and check rows, where it applies to the
// check roll. An all-pool table falls back to the stored modes so a definite
// chip shows instead of a permanently mixed label.
function rollModeSummary(expressions: Expression[]): RollModeSummary {
  const sumModes = new Set(
    expressions.filter(isTotalsMode).map((e) => e.rollMode),
  );
  const mixed = sumModes.size > 1;
  const firstSumMode = sumModes.values().next().value ?? null;
  return {
    mixed,
    activeMode: mixed
      ? null
      : firstSumMode ?? expressions[0]?.rollMode ?? null,
  };
}

interface SegmentedProps {
  options: readonly SegmentedOption[];
  active: string | null;
  onSelect: (value: string) => void;
  groupLabel: string;
  grow: boolean;
}

function Segmented({
  options,
  active,
  onSelect,
  groupLabel,
  grow,
}: SegmentedProps) {
  return (
    <Box
      gap={1}
      role="group"
      aria-label={groupLabel}
      // Stretching is only worth it on a phone. Left on up to the 768px
      // desktop switch it produced 165px chips around a 40px word.
      flex={grow ? { base: '1 1 auto', sm: '0 0 auto' } : '0 0 auto'}
      display={grow ? { base: 'grid', sm: 'inline-flex' } : 'inline-flex'}
      gridTemplateColumns={
        grow
          ? { base: `repeat(${options.length}, minmax(2.5rem, auto))`, sm: 'none' }
          : 'none'
      }
    >
      {options.map((o) => {
        const isActive = active === o.value;
        return (
          <Tooltip key={o.value} content={o.tip}>
            <Button
              size="sm"
              variant={isActive ? 'solid' : 'plain'}
              colorPalette={isActive ? 'blue' : 'gray'}
              onClick={() => onSelect(o.value)}
              aria-pressed={isActive}
              aria-label={o.ariaLabel}
              // Height, not minH: the sm recipe pins h to 36px, which wins over
              // any smaller floor. Phones keep the 40px touch target.
              h={{ base: '40px', md: '24px' }}
              px={3}
              borderRadius="sm"
              fontSize="12px"
              fontWeight="500"
              // plain defines no hover of its own, so an unselected chip would
              // have no affordance at all.
              _hover={{ bg: isActive ? 'colorPalette.solid/90' : 'bg.subtle' }}
            >
              {o.label}
            </Button>
          </Tooltip>
        );
      })}
    </Box>
  );
}

interface WorkshopToolbarProps {
  // Only the table view owns a chart, so its absence is what hides the
  // chart-view chips and the jump-to-chart button on the other views.
  chartRef?: RefObject<HTMLDivElement | null>;
}

export function WorkshopToolbar({ chartRef }: WorkshopToolbarProps) {
  const isDesktop = useIsDesktop();
  const {
    chartView,
    setChartView,
    target,
    expressions,
    setAllRollModes,
    addExpression,
  } = useApp();
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);

  const showChartView = chartRef !== undefined;
  const hasTarget = targetViewAvailable(target, expressions);
  const effectiveView = effectiveChartView(chartView, hasTarget);
  const chartOptions = useMemo(
    () => CHART_VIEWS.filter((v) => v.value !== 'target' || hasTarget),
    [hasTarget],
  );

  const hasRows = expressions.length > 0;
  const atCap = expressions.length >= MAX_EXPRESSIONS;
  const { activeMode, mixed } = rollModeSummary(expressions);

  const scrollToTop = useCallback(() => {
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const scrollToChart = useCallback(() => {
    chartRef?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [chartRef]);

  const onChartSelect = useCallback(
    (value: string) => {
      const match = CHART_VIEWS.find((v) => v.value === value);
      if (match) setChartView(match.value);
    },
    [setChartView],
  );

  const onModeSelect = useCallback(
    (value: string) => {
      if (isRollMode(value)) setAllRollModes(value);
    },
    [setAllRollModes],
  );

  // Menu items carry their own onClick rather than a single Menu.Root
  // onSelect: zag resolves onSelect from the *highlighted* item, while a
  // keyboard Enter dispatches a real DOM click on the item either way. Wiring
  // the click covers both input paths without depending on the highlight.
  const onAdd = useCallback(() => {
    if (!atCap) addExpression();
  }, [addExpression, atCap]);

  const scrollButtons = (
    <>
      <Tooltip content="Scroll to top">
        <IconButton
          size="sm"
          variant="ghost"
          aria-label="Scroll to top"
          onClick={scrollToTop}
          minW="40px"
          minH="40px"
        >
          <ArrowUp size={16} />
        </IconButton>
      </Tooltip>
      {showChartView && (
        <Tooltip content="Jump to chart">
          <IconButton
            size="sm"
            variant="ghost"
            aria-label="Jump to chart"
            onClick={scrollToChart}
            minW="40px"
            minH="40px"
          >
            <ArrowDown size={16} />
          </IconButton>
        </Tooltip>
      )}
    </>
  );

  return (
    <Box
      position="sticky"
      top={0}
      zIndex={2}
      bg="bg"
      py={2}
      minH="46px"
      borderBottomWidth="1px"
      // Not border.subtle: rows scrolling under a sticky bar need a visible
      // edge or the top one looks like it is bleeding into the toolbar.
      borderColor="border"
    >
      <Flex gap={2} rowGap={2} align="center" wrap="wrap">
        {showChartView && (
          <>
            <Box display={{ base: 'none', md: 'inline-flex' }}>
              <ParamLabel>View</ParamLabel>
            </Box>
            <Segmented
              options={chartOptions}
              active={effectiveView}
              onSelect={onChartSelect}
              groupLabel="Chart view"
              grow={!isDesktop}
            />
          </>
        )}
        {/* ms="auto" rather than a flexible spacer: it still right-aligns this
            cluster when it wraps onto a row of its own, which is what keeps
            Clear all reachable between 768px and roughly 1030px. */}
        <HStack gap={2} rowGap={2} align="center" wrap="wrap" ms="auto">
          {isDesktop ? (
          <>
            {hasRows && (
              <>
                <ParamLabel>
                  <HelpTerm tip={tipForId('globalRollMode')}>
                    Roll mode
                  </HelpTerm>
                  {mixed ? ' (mixed)' : ''}
                </ParamLabel>
                <Segmented
                  options={ROLL_MODES}
                  active={activeMode}
                  onSelect={onModeSelect}
                  groupLabel="Global roll mode"
                  grow={false}
                />
                <Tooltip content={tipForId('examples')}>
                  <Button
                    size="sm"
                    variant="outline"
                    minH="40px"
                    onClick={() => setExamplesOpen(true)}
                  >
                    <Dices size={16} />
                    Examples
                  </Button>
                </Tooltip>
              </>
            )}
            <Tooltip
              content={`Up to ${MAX_EXPRESSIONS} rolls. Delete a row to add another.`}
              disabled={!atCap}
            >
              <Button
                size="sm"
                variant="outline"
                minH="40px"
                onClick={addExpression}
                disabled={atCap}
                aria-label="Add roll"
              >
                <Plus size={16} />
                Add
              </Button>
            </Tooltip>
            {hasRows && (
              <Tooltip content={tipForId('clearAll')}>
                <Button
                  size="sm"
                  variant="ghost"
                  colorPalette="red"
                  minH="40px"
                  onClick={() => setClearOpen(true)}
                >
                  <Trash2 size={16} />
                  Clear all
                </Button>
              </Tooltip>
            )}
            <ShareImagePopover />
            {scrollButtons}
          </>
        ) : (
          <>
            <ShareImagePopover />
            {scrollButtons}
            <Menu.Root>
              <Menu.Trigger asChild>
                <IconButton
                  size="sm"
                  variant="ghost"
                  aria-label="Table actions"
                  minW="40px"
                  minH="40px"
                >
                  <MoreHorizontal size={16} />
                </IconButton>
              </Menu.Trigger>
              <Portal>
                <Menu.Positioner>
                  <Menu.Content minW="15rem">
                    {hasRows && (
                      <>
                        <Menu.RadioItemGroup
                          value={activeMode ?? ''}
                          onValueChange={(details) =>
                            onModeSelect(details.value)
                          }
                        >
                          <Menu.ItemGroupLabel>
                            Roll mode{mixed ? ' (mixed)' : ''}
                          </Menu.ItemGroupLabel>
                          {ROLL_MODES.map((m) => (
                            <Menu.RadioItem
                              key={m.value}
                              value={m.value}
                              minH="40px"
                            >
                              {m.ariaLabel}
                              <Menu.ItemIndicator>
                                <Check size={14} />
                              </Menu.ItemIndicator>
                            </Menu.RadioItem>
                          ))}
                        </Menu.RadioItemGroup>
                        <Menu.Separator />
                      </>
                    )}
                    <Menu.Item
                      value="add"
                      disabled={atCap}
                      minH="40px"
                      onClick={onAdd}
                    >
                      <Plus size={14} />
                      Add roll
                    </Menu.Item>
                    {hasRows && (
                      <>
                        <Menu.Item
                          value="examples"
                          minH="40px"
                          onClick={() => setExamplesOpen(true)}
                        >
                          <Dices size={14} />
                          Example rolls
                        </Menu.Item>
                        <Menu.Item
                          value="clear"
                          color="red.fg"
                          minH="40px"
                          onClick={() => setClearOpen(true)}
                        >
                          <Trash2 size={14} />
                          Clear all rolls
                        </Menu.Item>
                      </>
                    )}
                  </Menu.Content>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>
          </>
        )}
        </HStack>
      </Flex>
      <ExamplesDialog open={examplesOpen} onOpenChange={setExamplesOpen} />
      <ClearAllDialog open={clearOpen} onOpenChange={setClearOpen} />
    </Box>
  );
}

interface ClearAllDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ClearAllDialog({ open, onOpenChange }: ClearAllDialogProps) {
  const { expressions, replaceExpressions } = useApp();
  const count = expressions.length;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => onOpenChange(e.open)}
      lazyMount
      unmountOnExit
      placement="center"
      role="alertdialog"
      size="xs"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Clear the table?</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text>
                This removes{' '}
                {count === 1 ? 'the only roll' : `all ${count} rolls`} and
                can't be undone.
              </Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline">Cancel</Button>
              </Dialog.ActionTrigger>
              <Button
                colorPalette="red"
                onClick={() => {
                  replaceExpressions([]);
                  onOpenChange(false);
                }}
              >
                {count === 1 ? 'Clear 1 roll' : `Clear ${count} rolls`}
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
