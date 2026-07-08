import { Link as MuiLink, type LinkProps as MuiLinkProps } from '@mui/material';
import { createLink } from '@tanstack/react-router';
import { forwardRef } from 'react';

const MuiLinkComponent = forwardRef<HTMLAnchorElement, MuiLinkProps>(
  (props, ref) => <MuiLink ref={ref} {...props} />,
);
MuiLinkComponent.displayName = 'MuiLinkComponent';
export const RouterLink = createLink(MuiLinkComponent);
