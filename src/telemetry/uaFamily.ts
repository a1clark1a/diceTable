const PATTERNS: ReadonlyArray<{ family: string; regex: RegExp }> = [
  { family: 'Edge', regex: /Edg(?:e|A|iOS)?\/(\d+)/ },
  { family: 'Firefox', regex: /Firefox\/(\d+)/ },
  { family: 'Chrome', regex: /Chrome\/(\d+)/ },
  { family: 'Safari', regex: /Version\/(\d+)[\d.]* Safari\// },
];

export function getUaFamily(userAgent: string = navigator.userAgent): string {
  for (const { family, regex } of PATTERNS) {
    const match = regex.exec(userAgent);
    if (match && match[1]) {
      return `${family} ${match[1]}`;
    }
  }
  return 'Other';
}
