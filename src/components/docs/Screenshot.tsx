import { useState } from 'react';
import { Box, Image, Text } from '@chakra-ui/react';

export interface ScreenshotProps {
  src: string;
  alt: string;
  caption?: string;
}

type Status = 'loading' | 'loaded' | 'error';

export function Screenshot({ src, alt, caption }: ScreenshotProps) {
  const [status, setStatus] = useState<Status>('loading');

  return (
    <Box
      mt={3}
      mb={2}
      borderRadius="md"
      overflow="hidden"
      borderWidth="1px"
      borderStyle={status === 'loaded' ? 'solid' : 'dashed'}
      borderColor="border.subtle"
      bg={status === 'loaded' ? 'bg.panel' : 'bg.subtle'}
      position="relative"
    >
      <Image
        src={src}
        alt={alt}
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
        display={status === 'loaded' ? 'block' : 'none'}
        w="100%"
        h="auto"
      />
      {status !== 'loaded' && (
        <Box
          minH="160px"
          px={6}
          py={8}
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          textAlign="center"
          color="fg.muted"
          gap={2}
        >
          <Text
            fontSize="2xs"
            fontWeight="semibold"
            textTransform="uppercase"
            letterSpacing="wider"
            color="fg.muted"
          >
            screenshot
          </Text>
          <Text fontSize="sm" fontStyle="italic" maxW="52ch">
            {caption ?? alt}
          </Text>
        </Box>
      )}
    </Box>
  );
}
