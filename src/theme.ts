import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

const config = defineConfig({
  theme: {
    semanticTokens: {
      colors: {
        hit: {
          good: {
            // green.600 on white is only 3.3:1. The 700 ramp clears AA for
            // both hit bands without changing the good/mid/bad hues.
            value: { _light: '{colors.green.700}', _dark: '{colors.green.400}' },
          },
          mid: {
            // yellow.600 on white measures 2.94:1, under the 4.5:1 AA floor
            // for body text. yellow.700 clears it without going brown.
            value: {
              _light: '{colors.yellow.700}',
              _dark: '{colors.yellow.400}',
            },
          },
          bad: {
            value: { _light: '{colors.red.600}', _dark: '{colors.red.400}' },
          },
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
