import { Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';

interface ParamLabelProps {
  children: ReactNode;
  color?: string;
}

/** The lead-in label on a parameters bar group: TARGET, POOL TARGET, ROLL MODE. */
export function ParamLabel({ children, color = 'fg.muted' }: ParamLabelProps) {
  return (
    <Text
      as="span"
      fontSize="10px"
      fontWeight="600"
      fontFamily="mono"
      textTransform="uppercase"
      letterSpacing="0.07em"
      color={color}
      whiteSpace="nowrap"
    >
      {children}
    </Text>
  );
}

/** Fixed gutter so every group's controls start at the same offset. */
export const PARAM_LABEL_GUTTER = '74px';
