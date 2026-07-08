import { Link as MuiLink, type LinkProps as MuiLinkProps } from '@mui/material';
import MuiBreadcrumbs from '@mui/material/Breadcrumbs';
import { createLink, useMatches } from '@tanstack/react-router';
import { forwardRef } from 'react';

// 1. Forward the DOM ref and 2. Wrap with createLink
const MuiLinkComponent = forwardRef<HTMLAnchorElement, MuiLinkProps>(
  (props, ref) => <MuiLink ref={ref} {...props} />,
);
MuiLinkComponent.displayName = 'MuiLinkComponent';
export const RouterLink = createLink(MuiLinkComponent);

export const Breadcrumbs = () => {
  const matches = useMatches();

  const breadcrumbItems = matches
    .filter((match) => Boolean(match.loaderData?.crumb))
    .map(({ pathname, loaderData }) => ({
      href: pathname,
      label: loaderData?.crumb,
    }));

  return (
    <MuiBreadcrumbs aria-label='breadcrumb'>
      {breadcrumbItems.map((c) => (
        <RouterLink
          underline='hover'
          color='inherit'
          to={c.href}
          sx={{ fontSize: '0.875rem' }}
        >
          {c.label}
        </RouterLink>
      ))}
    </MuiBreadcrumbs>
  );
};
