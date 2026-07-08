/**
 * Collapsible monospace SQL block with a copy button. Shared by the builder
 * (candidate + final SQL) and the report detail page.
 */

import { useCopyToClipboard } from '#/hooks/useCopyToClipboard';
import { MONO_FONT } from '#/theme/tokens';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { Check, ChevronDown, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface SqlBlockProps {
  sql: string;
  label?: string;
  defaultOpen?: boolean;
}

export const SqlBlock = ({
  sql,
  label = 'SQL',
  defaultOpen = false,
}: SqlBlockProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  // The "copied" reset timer — cleared on unmount so it never fires against an
  // unmounted component.
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const [copy] = useCopyToClipboard({
    onSuccess: () => {
      // toast('copied!')
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1500);
    },
    onError: () => toast.error('copy failed'),
  });

  // const copy = async () => {
  //   try {
  //     await navigator.clipboard.writeText(sql);
  //   } catch {
  //     // Clipboard access can be denied (permissions, insecure context).
  //     toast.error('Copy failed');
  //     return;
  //   }
  //   setCopied(true);
  //   clearTimeout(copiedTimer.current);
  //   copiedTimer.current = setTimeout(() => setCopied(false), 1500);
  // };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        <Box
          onClick={() => setOpen((o) => !o)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            cursor: 'pointer',
          }}
        >
          <ChevronDown
            size={15}
            style={{
              transition: 'transform 0.15s ease',
              transform: open ? 'none' : 'rotate(-90deg)',
            }}
          />
          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
            {label}
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Tooltip title={copied ? 'Copied' : 'Copy SQL'} placement='top'>
          <IconButton size='small' onClick={() => copy(sql)}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </IconButton>
        </Tooltip>
      </Box>
      {open && (
        <Box
          component='pre'
          sx={(theme) => ({
            m: 0,
            p: 1.5,
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.vars.palette.paper2,
            fontFamily: MONO_FONT,
            fontSize: 12.5,
            lineHeight: 1.5,
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          })}
        >
          {sql}
        </Box>
      )}
    </Box>
  );
};
