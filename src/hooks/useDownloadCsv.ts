import { downloadCsv, type CsvColumn } from '#/lib/csv';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

export const useDownloadCsv = (
  props: {
    withToast?: boolean;
  } = {},
) => {
  const { withToast = true } = props;

  const { mutate, mutateAsync, isPending, isError, isSuccess, data } =
    useMutation({
      mutationFn: async ({
        prefix,
        rows,
        columns,
      }: {
        prefix: string;
        rows: Record<string, unknown>[];
        columns?: CsvColumn[];
        title?: string;
        uuid: string;
      }) => {
        downloadCsv(
          prefix,
          rows as unknown as Record<string, unknown>[],
          columns,
        );

        return;
      },
      onMutate: async (vars) => {
        if (withToast)
          toast.loading(
            `downloading ${vars.title ?? vars.prefix.split(/[_-]/).filter(Boolean).join(' ')}...`,
            {
              id: vars.uuid,
            },
          );
      },
      onSuccess: (_, vars) => {
        if (withToast)
          toast.success(`Exported ${vars.rows.length.toLocaleString()} rows`, {
            id: vars.uuid,
          });
      },
      onError: (e, vars) => {
        if (withToast) toast.error((e as Error).message, { id: vars.uuid });
      },
    });

  return { mutate, mutateAsync, isPending, isError, isSuccess, data };
};
