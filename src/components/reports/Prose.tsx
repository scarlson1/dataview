/**
 * Renders the report agent's narration as GitHub-flavored markdown. The agent
 * emits lists, `code`, and paragraph breaks; a bare <Typography> collapses those
 * to a single run-on line, so this styles react-markdown output to match the
 * app's small-body type scale.
 */

import Box from '@mui/material/Box';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MONO_FONT } from '#/theme/tokens';

export const Prose = ({ text }: { text: string }) => (
  <Box
    sx={{
      fontSize: 13.5,
      color: 'text.secondary',
      lineHeight: 1.55,
      // Collapse the outer margins react-markdown gives block elements so the
      // prose sits flush in the turn timeline.
      '& > :first-of-type': { mt: 0 },
      '& > :last-child': { mb: 0 },
      '& p': { my: 0.75 },
      '& ul, & ol': { my: 0.75, pl: 2.5 },
      '& li': { my: 0.25 },
      '& code': {
        fontFamily: MONO_FONT,
        fontSize: '0.85em',
        px: 0.5,
        py: 0.125,
        borderRadius: 0.75,
        bgcolor: 'paper2',
      },
      '& strong': { color: 'text.primary', fontWeight: 600 },
      '& a': { color: 'primary.main' },
    }}
  >
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
  </Box>
);
