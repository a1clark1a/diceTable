import { chakra } from '@chakra-ui/react';
import * as React from 'react';
import { Tooltip } from './tooltip';

const Underlined = chakra('span', {
  base: {
    borderBottomWidth: '1px',
    borderBottomStyle: 'dotted',
    borderBottomColor: 'fg.muted',
    cursor: 'help',
    outline: 'none',
    _focusVisible: {
      borderBottomColor: 'colorPalette.solid',
      borderBottomStyle: 'solid',
    },
  },
});

export interface HelpTermProps {
  tip: React.ReactNode;
  children: React.ReactNode;
  ariaLabel?: string;
}

export function HelpTerm({ tip, children, ariaLabel }: HelpTermProps) {
  return (
    <Tooltip content={tip}>
      <Underlined
        tabIndex={0}
        aria-label={ariaLabel}
      >
        {children}
      </Underlined>
    </Tooltip>
  );
}
