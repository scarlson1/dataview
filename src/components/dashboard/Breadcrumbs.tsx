import { RouterLink } from '#/components/RouterLink';
import MuiBreadcrumbs from '@mui/material/Breadcrumbs';
import { useMatches } from '@tanstack/react-router';

export const Breadcrumbs = () => {
  const matches = useMatches();

  const breadcrumbItems = matches
    .filter((match) => Boolean(match.loaderData?.crumb))
    .map(({ pathname, loaderData }) => ({
      href: pathname,
      label: loaderData?.crumb,
    }));

  return (
    <MuiBreadcrumbs maxItems={2} aria-label='breadcrumb'>
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
