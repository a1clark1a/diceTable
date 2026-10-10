import { HStack, IconButton, Portal, VisuallyHidden } from '@chakra-ui/react';
import { ArrowDown, ArrowUp, CopyPlus } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { useApp } from '../../state/useApp';
import { MAX_EXPRESSIONS, type Expression } from '../../types';
import { tipForId } from '../../docs/glossary';
import { Tooltip } from '../ui/tooltip';
import { tapTarget } from '../tapTarget';
import { TapTip } from './TapTip';
import { VariantsControl } from './SweepPanel';

// Duplicating collapses the source's editor and opens the copy's, so the
// button that was pressed unmounts and focus would fall to the page. The copy's
// editor is the only RowTools that mounts in that commit, and it takes focus
// on its own Duplicate button, whose label names the copy.
let focusDuplicateOnMount = false;

interface RowToolsProps {
  expression: Expression;
}

export function RowTools({ expression }: RowToolsProps) {
  const { id: exprId, name: exprName } = expression;
  const { expressions, duplicateExpression, moveExpression } = useApp();
  const index = expressions.findIndex((e) => e.id === exprId);
  const total = expressions.length;
  const atTop = index <= 0;
  const atBottom = index < 0 || index >= total - 1;
  const atCap = total >= MAX_EXPRESSIONS;

  const upRef = useRef<HTMLButtonElement>(null);
  const downRef = useRef<HTMLButtonElement>(null);
  const duplicateRef = useRef<HTMLButtonElement>(null);
  const refocus = useRef<HTMLButtonElement | null>(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (!focusDuplicateOnMount) return;
    focusDuplicateOnMount = false;
    duplicateRef.current?.focus();
  }, []);

  // Reordering moves this row's DOM, and a moved node drops focus, so the
  // pressed button takes it back once the new position has rendered.
  useEffect(() => {
    const el = refocus.current;
    refocus.current = null;
    if (el !== null && document.activeElement !== el) el.focus();
  }, [index]);

  const move = (delta: -1 | 1) => {
    const blocked = delta === -1 ? atTop : atBottom;
    if (blocked) return;
    refocus.current = delta === -1 ? upRef.current : downRef.current;
    moveExpression(exprId, delta);
    setAnnouncement(`Moved to ${index + delta + 1} of ${total}`);
  };

  const duplicate = () => {
    if (atCap) return;
    focusDuplicateOnMount = true;
    duplicateExpression(exprId);
  };

  return (
    <HStack
      gap={1}
      flexShrink={0}
      ms="auto"
      role="group"
      aria-label="Row order and copies"
    >
      <ToolButton
        ref={upRef}
        label="Move roll up"
        tip={tipForId(atTop ? 'moveUpAtTop' : 'moveUp')}
        blocked={atTop}
        onClick={() => move(-1)}
      >
        <ArrowUp size={14} />
      </ToolButton>
      <ToolButton
        ref={downRef}
        label="Move roll down"
        tip={tipForId(atBottom ? 'moveDownAtBottom' : 'moveDown')}
        blocked={atBottom}
        onClick={() => move(1)}
      >
        <ArrowDown size={14} />
      </ToolButton>
      <ToolButton
        ref={duplicateRef}
        label={`Duplicate ${exprName}`}
        tip={
          atCap
            ? `Up to ${MAX_EXPRESSIONS} rolls. Delete a row to add another.`
            : tipForId('duplicate')
        }
        blocked={atCap}
        onClick={duplicate}
      >
        <CopyPlus size={14} />
      </ToolButton>
      <VariantsControl expr={expression} total={total} />
      {/* Portalled so the region stays put while the row it belongs to moves:
          a live region that is itself re-inserted is not reliably read. */}
      <Portal>
        <VisuallyHidden role="status" aria-live="polite">
          {announcement}
        </VisuallyHidden>
      </Portal>
    </HStack>
  );
}

interface ToolButtonProps {
  ref: Ref<HTMLButtonElement>;
  label: string;
  tip: string;
  blocked: boolean;
  onClick: () => void;
  children: ReactNode;
}

// aria-disabled + data-disabled rather than the native attribute, so a button
// at the end of the list keeps its focus (a move to the top must not drop the
// keyboard user's place) and its tooltip can still say why it does nothing,
// including to a tap on a phone.
function ToolButton({ ref, label, tip, blocked, onClick, children }: ToolButtonProps) {
  const button = (
    <IconButton
      ref={ref}
      aria-label={label}
      size="sm"
      variant="ghost"
      h={tapTarget('32px')}
      minW={tapTarget('32px')}
      aria-disabled={blocked || undefined}
      data-disabled={blocked ? '' : undefined}
      onClick={onClick}
    >
      {children}
    </IconButton>
  );
  return blocked ? (
    <TapTip tip={tip}>{button}</TapTip>
  ) : (
    <Tooltip content={tip}>{button}</Tooltip>
  );
}
