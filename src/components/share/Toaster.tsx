import {
  Toaster as ChakraToaster,
  Toast,
  Portal,
  Stack,
} from '@chakra-ui/react';
import { toaster } from './toaster-store';

export function Toaster() {
  return (
    <Portal>
      <ChakraToaster toaster={toaster} insetInline={{ mdDown: '4' }}>
        {(t) => (
          <Toast.Root width={{ md: 'sm' }}>
            {t.type !== 'loading' && <Toast.Indicator />}
            <Stack gap="1" flex="1" maxWidth="100%">
              {t.title !== undefined && <Toast.Title>{t.title}</Toast.Title>}
              {t.description !== undefined && (
                <Toast.Description>{t.description}</Toast.Description>
              )}
            </Stack>
            {t.closable && <Toast.CloseTrigger />}
          </Toast.Root>
        )}
      </ChakraToaster>
    </Portal>
  );
}
