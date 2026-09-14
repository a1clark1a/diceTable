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
        // Hit text lands on four surfaces, not the one this was first measured
        // against. Chakra's table line variant paints rows bg, hover paints
        // bg.subtle, a pinned baseline row paints bg.muted, and the target bars
        // and check editor paint bg.panel. bg.muted is the darkest of them in
        // light mode and the lightest in dark, so it is the ground that binds,
        // and 14px semibold is not WCAG large text, so the bar is 4.5:1. On
        // bg.muted: good 4.82 light / 6.74 dark, mid 4.78 / 7.19, bad 5.24 /
        // 5.07. Literal hex rather than ramp references because no Chakra ramp
        // carries this desaturated family, and the stock greens and ambers read
        // as a different palette against a warm ground.
        hit: {
          good: { value: { _light: '#206949', _dark: '#58be92' } },
          mid: { value: { _light: '#7f5507', _dark: '#dda857' } },
          bad: { value: { _light: '#963839', _dark: '#e4726a' } },
        },
        // The eight series hues. Tokens rather than literals in the components
        // so the browser swaps the sets on a theme change with no render in
        // between; src/components/chart/palette.ts holds the same values for the
        // share image and explains why one shared set cannot work.
        row: {
          1: { value: { _light: '#21396a', _dark: '#8eb1f4' } },
          2: { value: { _light: '#673406', _dark: '#d79362' } },
          3: { value: { _light: '#075b3c', _dark: '#96edc1' } },
          4: { value: { _light: '#7a639c', _dark: '#8c70b4' } },
          5: { value: { _light: '#551b30', _dark: '#f6a1ba' } },
          6: { value: { _light: '#065e75', _dark: '#3ea6c7' } },
          7: { value: { _light: '#715b14', _dark: '#e4c878' } },
          8: { value: { _light: '#935059', _dark: '#c3707b' } },
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
