import { useCallback, useState } from 'react';

type CopiedValue = string | null;

type CopyFn = (text: string) => Promise<boolean>;

export function useCopyToClipboard(
  props: {
    onSuccess?: (text: string) => void;
    onError?: (err: unknown) => void;
  } = {},
): [CopyFn, CopiedValue] {
  const { onSuccess, onError } = props || {};

  const [copiedText, setCopiedText] = useState<CopiedValue>(null);

  const copy: CopyFn = useCallback(
    async (text) => {
      if (!navigator?.clipboard) {
        console.warn('Clipboard not supported');
        return false;
      }

      // Try to save to clipboard then save it in the state if worked
      try {
        await navigator.clipboard.writeText(text);
        setCopiedText(text);
        if (onSuccess) onSuccess(text);
        return true;
      } catch (error) {
        console.warn('Copy failed', error);
        setCopiedText(null);
        if (onError) onError(error);
        return false;
      }
    },
    [onSuccess, onError],
  );

  return [copy, copiedText];
}
