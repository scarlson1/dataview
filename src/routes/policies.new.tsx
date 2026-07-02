// import { NewBusinessForm } from '#/components/NewBusinessForm';
// import {
//   newBusinessFormOpts,
//   type NewBusinessValues,
// } from '#/constants/newBusinessForm';
// import type { Database } from '#/data/database.types';
// import { useAppForm } from '#/hooks/form';
// import { queryClient } from '#/queryClient';
// import { supabase } from '#/supabaseClient';
// import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
// import { toast } from 'sonner';

export const Route = createFileRoute('/policies/new')({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>TODO: new policy form</div>;
  // may need to be dynamic autocomplete options if many clients
  // const { data: clients } = useSuspenseQuery({
  //   queryKey: ['clients'],
  //   queryFn: async () => await supabase.from('clients').select(),
  // });
  // console.log('clients', clients);

  // const mutation = useMutation({
  //   mutationFn: async (values: NewBusinessValues) => {
  //     // The intake form captures the insured (client). Persist a prospect client
  //     // record; downstream NBS pipeline / policy binding is driven from the
  //     // Workflow board (see routes/_dashboard.workflow.tsx).
  //     const { data, error } = await supabase
  //       .from('clients')
  //       .insert({
  //         company_name: values.companyName || null,
  //         first_name: values.firstName || null,
  //         last_name: values.lastName || null,
  //         client_type: (values.clientType || null) as
  //           | Database['public']['Enums']['clienttype']
  //           | null,
  //         industry: 'Unspecified',
  //         address_line1: values.addressLine1 || null,
  //         address_line2: values.addressLine2 || null,
  //         city: values.city || null,
  //         state: values.state || null,
  //         postal: values.postal || null,
  //         status: 'prospect',
  //       })
  //       .select('id, company_name')
  //       .single();
  //     if (error) throw error;
  //     return data;
  //   },
  //   onMutate: (vars) => {
  //     toast.loading(`saving ${vars.companyName}...`, { id: 'new-business' });
  //   },
  //   onSuccess: (_data, vars) => {
  //     toast.success(`${vars.companyName} saved`, { id: 'new-business' });
  //   },
  //   onError: (err) => {
  //     const msg = err.message || `error saving new business`;
  //     toast.error(msg, { id: 'new-business' });
  //   },
  //   onSettled: () => {
  //     queryClient.invalidateQueries({ queryKey: ['clients'] });
  //   },
  // });

  // const form = useAppForm({
  //   ...newBusinessFormOpts,
  //   onSubmit: async ({ value }) => {
  //     mutation.mutate(value);
  //     // try {
  //     //   const result = await mutation.mutateAsync({
  //     //     ...value
  //     //   });
  //     //   if (isNew) {
  //     //     form.reset();
  //     //     onSaved(resolvedSetName, result.id);
  //     //   }
  //     // } catch (err) {
  //     //   console.log(err);
  //     // }
  //   },
  // });

  // return (
  //   <NewBusinessForm
  //     form={form}
  //     spacing={2}
  //     rowSpacing={undefined}
  //     columnSpacing={undefined}
  //   />
  // );
}
