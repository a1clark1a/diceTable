import { Box, Heading, Link, List, Stack, Text } from '@chakra-ui/react';

export default function PrivacyPage() {
  return (
    <Stack gap={6} maxW="640px" mx="auto" py={{ base: 4, md: 8 }}>
      <Stack gap={2}>
        <Heading as="h1" size={{ base: 'lg', md: 'xl' }} letterSpacing="tight">
          Privacy
        </Heading>
        <Text color="fg.subtle" fontSize="sm">
          Last updated: 2026-05-28
        </Text>
      </Stack>

      <Text color="fg.muted">
        DiceTable is a dice probability tool. It runs in your browser, stores
        your rolls on your device, and collects the minimum needed to keep the
        site working. No accounts, no profiles, no advertising.
      </Text>

      <Section title="What this site collects">
        <List.Root gap={2} color="fg.muted">
          <List.Item>
            Anonymous page analytics (pageviews, anonymized country, device
            type, referrer) via Vercel Analytics. No cookies, no cross-site
            tracking.
          </List.Item>
          <List.Item>
            Anonymous performance metrics (load time, layout shift, input
            delay) via Vercel Speed Insights.
          </List.Item>
          <List.Item>
            Anonymous error reports when the app crashes. These include the
            error message, a stack trace, the route you were on, and a
            coarse browser family (Chrome, Safari, Firefox). They never
            include your dice expressions or any input from your table.
          </List.Item>
        </List.Root>
      </Section>

      <Section title="What this site does not collect">
        <List.Root gap={2} color="fg.muted">
          <List.Item>No account information. There are no accounts.</List.Item>
          <List.Item>No cookies and no third-party trackers.</List.Item>
          <List.Item>
            No personal information (name, email, IP address beyond what is
            transiently needed to serve a request).
          </List.Item>
          <List.Item>
            No advertising identifiers and no data sold to third parties.
          </List.Item>
        </List.Root>
      </Section>

      <Section title="Data stored on your device">
        <Text color="fg.muted">
          Your rolls, target settings, and view preferences are saved in your
          browser&apos;s <Text as="span" fontFamily="mono">localStorage</Text>{' '}
          under the key <Text as="span" fontFamily="mono">dicetable.v2</Text>.
          This data never leaves your device. You can clear it any time from
          your browser settings, or from the error screen if the app fails to
          load.
        </Text>
      </Section>

      <Section title="Third-party services">
        <Text color="fg.muted">
          The site is hosted on{' '}
          <Link href="https://vercel.com" rel="noopener" target="_blank">
            Vercel
          </Link>
          , which processes analytics and performance data on our behalf. See{' '}
          <Link
            href="https://vercel.com/legal/privacy-policy"
            rel="noopener"
            target="_blank"
          >
            Vercel&apos;s privacy policy
          </Link>{' '}
          for details on their handling.
        </Text>
      </Section>

      <Section title="Contact">
        <Text color="fg.muted">
          Questions or requests about this policy:{' '}
          <Link href="mailto:dicetablesupport@gmail.com">
            dicetablesupport@gmail.com
          </Link>
          .
        </Text>
      </Section>

      <Section title="Changes">
        <Text color="fg.muted">
          If this policy changes, the &ldquo;Last updated&rdquo; date above
          changes with it. Material changes will be announced on the site
          before they take effect.
        </Text>
      </Section>
    </Stack>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Stack gap={2}>
      <Heading as="h2" size="sm" letterSpacing="tight">
        {title}
      </Heading>
      <Box>{children}</Box>
    </Stack>
  );
}
