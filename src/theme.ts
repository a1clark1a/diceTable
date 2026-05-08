import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

const config = defineConfig({
  theme: {
    semanticTokens: {
      colors: {
        hit: {
          good: {
            value: { _light: '{colors.green.600}', _dark: '{colors.green.400}' },
          },
          mid: {
            value: {
              _light: '{colors.yellow.600}',
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
