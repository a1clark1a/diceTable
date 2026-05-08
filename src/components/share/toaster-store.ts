import { createToaster } from '@chakra-ui/react';

export const toaster = createToaster({
  placement: 'bottom-end',
  max: 3,
  overlap: true,
  gap: 8,
  duration: 3500,
});
