import {
  useCallback,
  useState,
  type RefObject,
} from 'react';
import {
  Box,
  Flex,
  HStack,
  IconButton,
  Menu,
  Portal,
} from '@chakra-ui/react';
import { Check, Dices, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../state/useApp';
import {
  MAX_EXPRESSIONS,
} from '../types';
import { ExamplesDialog } from './presets/ExamplesDialog';
import { ClearAllDialog } from './ClearAllDialog';
import { ScrollButtons } from './ScrollButtons';
import { ChartViewChips } from './chart/ChartViewChips';
import {
  effectiveChartView,
  targetViewAvailable,
} from './chart/effectiveView';
import {
  ROLL_MODES,
  isRollMode,
  rollModeSummary,
} from './rollModes';

interface WorkshopToolbarProps {
  // Only the table view owns a chart, so its absence is what hides the
  // chart-view chips and the jump-to-chart button on the other views.
  chartRef?: RefObject<HTMLDivElement | null>;
}

export function WorkshopToolbar({ chartRef }: WorkshopToolbarProps) {
  const {
    expressions,
    setAllRollModes,
    addExpression,
    chartViews,
    target,
  } = useApp();
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);

  const showChartView = chartRef !== undefined;

  const hasRows = expressions.length > 0;
  const atCap = expressions.length >= MAX_EXPRESSIONS;
  const { activeMode, mixed } = rollModeSummary(expressions);

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

  return (
    <Box
      position="sticky"
      top={0}
      zIndex={2}
      bg="bg"
      py={2}
      // At md the columns scroll inside themselves and the parameters bar
      // carries every global control, so this band has nothing left to hold.
      display={{ base: 'block', md: 'none' }}
      borderBottomWidth="1px"
      // Not border.subtle: rows scrolling under a sticky bar need a visible
      // edge or the top one looks like it is bleeding into the toolbar.
      borderColor="border"
    >
      <Flex gap={2} rowGap={2} align="center" wrap="wrap">
        {showChartView && hasRows && (
          <ChartViewChips
            surface="shape"
            active={effectiveChartView(
              chartViews.shape,
              targetViewAvailable(target, expressions),
            )}
            hasTarget={targetViewAvailable(target, expressions)}
            groupLabel="Shape column view"
          />
        )}

        {/* ms="auto" rather than a flexible spacer: it still right-aligns this
            cluster when it wraps onto a row of its own, which is what keeps
            Clear all reachable between 768px and roughly 1030px. */}
        <HStack gap={2} rowGap={2} align="center" wrap="wrap" ms="auto">
          {/* This bar is the only thing on screen below md, so its copy of the
              pair owns that band and the caption row's copy owns the one above. */}
          <ScrollButtons
            chartRef={chartRef}
            display={{ base: 'inline-flex', md: 'none' }}
          />
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
        </HStack>
      </Flex>
      <ExamplesDialog open={examplesOpen} onOpenChange={setExamplesOpen} />
      <ClearAllDialog open={clearOpen} onOpenChange={setClearOpen} />
    </Box>
  );
}
