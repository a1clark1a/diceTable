import { Input, type InputProps } from '@chakra-ui/react';
import { flushedFocusRing } from './editor/focusRings';

/**
 * Rows carry a field per cell, so a bordered box each turns the table into a
 * grid of forms. Flushed drops the box; the hover wash is what keeps the cell
 * reading as editable without it.
 */
export function FlushedInput(props: InputProps) {
  return (
    <Input
      variant="flushed"
      px={1}
      borderRadius="4px"
      _hover={{ bg: 'bg.subtle' }}
      _focusVisible={flushedFocusRing}
      {...props}
    />
  );
}
