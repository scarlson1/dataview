import { NewBusinessForm } from '#/components/NewBusinessForm';
import {
  newBusinessFormOpts,
  type NewBusinessValues,
} from '#/constants/newBusinessForm';
import { useAppForm } from '#/hooks/form';
import { queryClient } from '#/queryClient';
import { supabase } from '#/supabaseClient';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { toast } from 'sonner';

export const Route = createFileRoute('/policies/new')({
  component: RouteComponent,
});

function RouteComponent() {
  const { data: clients } = useSuspenseQuery({
    queryKey: ['clients'],
    queryFn: async () => await supabase.from(''),
  });

  const mutation = useMutation({
    mutationFn: async (values: NewBusinessValues) => {
      // may need edge function if table updates are complex ??
      // return supabase
      // .curationSets(resolvedSetName)
      // .items(resolvedItemId)
      // .upsert({ id: resolvedItemId, ...params } as CurationObjectSchema);
    },
    onMutate: (vars) => {
      toast.loading(`saving ${vars.companyName}...`, { id: 'new-business' });
    },
    onSuccess: (data, vars) => {
      toast.success(`${vars.companyName} saved`, { id: 'new-business' });
    },
    onError: (err, vars) => {
      const msg = err.message || `error saving new business`;
      toast.error(msg, { id: 'new-business' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['clients'], // collectionQueryKeys.curationSets(clusterId),
      });
    },
  });

  const form = useAppForm({
    ...newBusinessFormOpts,
    onSubmit: async ({ value }) => {
      mutation.mutate(value);
      // try {
      //   const result = await mutation.mutateAsync({
      //     ...value
      //   });
      //   if (isNew) {
      //     form.reset();
      //     onSaved(resolvedSetName, result.id);
      //   }
      // } catch (err) {
      //   console.log(err);
      // }
    },
  });

  return (
    <NewBusinessForm
      form={form}
      spacing={2}
      rowSpacing={undefined}
      columnSpacing={undefined}
    />
  );
}
