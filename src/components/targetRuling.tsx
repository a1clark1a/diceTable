import { Box, type BoxProps } from '@chakra-ui/react';
import type { TargetRuling } from '../types';
import { Tooltip } from './ui/tooltip';
import { RULING_SYMBOL, RULING_TIP } from './targetRulingMeta';

export interface RulingSymbolProps extends Omit<BoxProps, 'children'> {
  ruling: TargetRuling;
}

export function RulingSymbol({ ruling, ...rest }: RulingSymbolProps) {
  return (
    <Tooltip content={RULING_TIP[ruling]}>
      <Box as="span" tabIndex={0} cursor="help" outline="none" {...rest}>
        {RULING_SYMBOL[ruling]}
      </Box>
    </Tooltip>
  );
}
