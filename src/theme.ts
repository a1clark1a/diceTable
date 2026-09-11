import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

// Raw hex is allowed here, alongside src/components/chart/palette.ts and
// index.html. These grounds are custom values with no entry in any Chakra ramp,
// so they cannot be written as {colors.*} references.
//
// Only semantic tokens are overridden. Raw ramp entries stay untouched on
// purpose: in dark mode gray.muted, gray.border and Chakra's own bg.emphasized
// default all resolve through gray.800, so remapping it would turn every dark
// border and emphasized surface near-white.
const config = defineConfig({
  theme: {
    semanticTokens: {
      colors: {
        bg: {
          DEFAULT: { value: { _light: '#f2f1ed', _dark: '#131519' } },
          subtle: { value: { _light: '#eae8e3', _dark: '#181b20' } },
          muted: { value: { _light: '#dedcd5', _dark: '#21252b' } },
          emphasized: { value: { _light: '#dedcd5', _dark: '#262b32' } },
          // Raised against bg, which is the recessed page ground. The pair is a
          // 1.08:1 surface delta by design; it separates by lightness, not by a
          // border, so nothing reads as a stack of identical off-whites.
          panel: { value: { _light: '#fbfaf8', _dark: '#1a1d22' } },
          inverted: { value: { _light: '#23231f', _dark: '#e8eaed' } },
        },
        fg: {
          DEFAULT: { value: { _light: '#22221f', _dark: '#e4e7eb' } },
          muted: { value: { _light: '#5c5952', _dark: '#a5acb6' } },
          // Chakra's stock fg.subtle is gray.400, which measures 2.56:1 in light
          // and fails as text. This one sits just off fg.muted so the smallest
          // labels stay readable: 6.01:1 light, 6.62:1 dark on bg.panel.
          subtle: { value: { _light: '#63605a', _dark: '#9aa3ae' } },
          inverted: { value: { _light: '#fbfaf8', _dark: '#14161a' } },
        },
        border: {
          DEFAULT: { value: { _light: '#d6d2c9', _dark: '#303640' } },
          subtle: { value: { _light: '#e3e0d8', _dark: '#252a31' } },
          emphasized: { value: { _light: '#bdb8ac', _dark: '#414855' } },
        },
        blue: {
          solid: { value: { _light: '#3a5fb0', _dark: '#3d6bcc' } },
          fg: { value: { _light: '#2f4f96', _dark: '#93b4f6' } },
          subtle: { value: { _light: '#e5e9f4', _dark: '#1b2333' } },
        },
        purple: {
          solid: { value: { _light: '#6b4ea8', _dark: '#6f55bc' } },
          fg: { value: { _light: '#5b3f94', _dark: '#b7a2f0' } },
          subtle: { value: { _light: '#ede9f3', _dark: '#241e36' } },
        },
        green: {
          subtle: { value: { _light: '#e4ede5', _dark: '#16231d' } },
        },
        orange: {
          subtle: { value: { _light: '#f3ebdc', _dark: '#241e14' } },
        },
        red: {
          subtle: { value: { _light: '#f4e4e1', _dark: '#251a19' } },
        },
        // The ramp is body text on bg.panel, so it is measured there: good
        // 5.39:1 light / 7.40:1 dark, mid 5.45 / 7.90, bad 6.12 / 5.56. Literal
        // hex rather than ramp references because no Chakra ramp carries this
        // desaturated family, and the stock greens and ambers read as a
        // different palette against a warm ground.
        hit: {
          good: { value: { _light: '#2c7454', _dark: '#58be92' } },
          mid: { value: { _light: '#8a5e17', _dark: '#dda857' } },
          bad: { value: { _light: '#a0403a', _dark: '#e4726a' } },
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
