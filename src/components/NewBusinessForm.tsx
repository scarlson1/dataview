import { NewAgencyForm } from '#/components/NewAgencyForm';
import { NewClientForm } from '#/components/NewClientForm';
import {
  newBusinessFormOpts,
  newBusinessStage,
  priority,
} from '#/constants/newBusinessForm';
import { stateOptions } from '#/constants/usStates';
import type { Tables, TablesInsert } from '#/data/database.types';
import { useAppForm } from '#/hooks/form';
import { emptyToNull, toDateStr, toNumber } from '#/lib/formCoerce';
import { supabase } from '#/supabaseClient';
import {
  Badge,
  Box,
  Grid,
  InputAdornment,
  MenuItem,
  Skeleton,
  Typography,
  useTheme,
} from '@mui/material';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Suspense } from 'react';
import { toast } from 'sonner';

type NewBusinessSubmissionInsert = TablesInsert<'new_business_submissions'>;
type NewBusinessSubmission = Tables<'new_business_submissions'>;

type UwStatus = 'active' | 'inactive' | 'on_leave';

// interface NewBusinessFormProps {
//   onSuccess: (row: NewBusinessSubmission) => void;
//   onError: (msg: string) => void;
// }

interface NewBusinessFormProps {
  onSuccess?: (row: NewBusinessSubmission) => void;
}

export function NewBusinessForm({ onSuccess }: NewBusinessFormProps) {
  const theme = useTheme();

  const { mutateAsync } = useMutation({
    mutationFn: async (values: NewBusinessSubmissionInsert) => {
      const { data, error } = await supabase
        .from('new_business_submissions')
        .upsert(values)
        .select();

      if (error) throw new Error(error.message);
      // const row = data[0]
      // if (!row) throw new Error('upsert succeeded, failed to return data')
      return data[0] as NewBusinessSubmission;
    },
    onSuccess: (data) => {
      toast.success('record created', { id: 'new-business' });
      onSuccess?.(data);
    },
    onError: (err) => {
      console.log(err);
      toast.error('upsert failed', { id: 'new-business' });
    },
  });

  const form = useAppForm({
    ...newBusinessFormOpts,
    onSubmit: async ({ value }) => {
      try {
        const submission: NewBusinessSubmissionInsert = {
          // required (NOT NULL) columns
          client_id: value.clientId,
          agent_id: value.agencyId,
          // submission_number is NOT NULL + UNIQUE and app-generated (see migration).
          // TODO: move to a DB default/sequence so it's collision-proof server-side.
          submission_number:
            value.submissionNumber ||
            `SUB-${dayjs().year()}-${Date.now().toString(36).toUpperCase()}`,

          // pipeline status
          stage: value.stage,
          priority: value.priority,
          assigned_to: toNumber(value.assignedTo),
          submission_date: toDateStr(value.submissionDate),
          quote_due_date: toDateStr(value.quoteDueDate),
          quote_received: toDateStr(value.quoteReceivedDate),

          // relations
          carrier_id: toNumber(value.carrier),

          // policy data
          line_of_business: emptyToNull(value.policy.lineOfBusiness),
          policy_number: emptyToNull(value.policy.policyNumber),
          policy_eff_date: toDateStr(value.policy.effectiveDate),
          policy_exp_date: toDateStr(value.policy.expirationDate),
          jurisdiction: emptyToNull(value.policy.jurisdiction),
          home_state: emptyToNull(value.policy.state),
          annual_premium: toNumber(value.policy.annualPremium),
          terrorism_premium: toNumber(value.policy.terrorismPremium),
          policy_fee: toNumber(value.policy.policyFee),
          inspection_fee: toNumber(value.policy.inspectionFee),
          other_fees: toNumber(value.policy.otherFees),
          other_fee_description: emptyToNull(value.policy.otherFeeDescription),
          gross_com_pct_override: toNumber(
            value.policy.grossCommissionPctOverride,
          ),
          min_earned_prem_pct: toNumber(value.policy.minEarnedPremiumPct),

          // coverage limits
          cov_a_limit: toNumber(value.coverage.limitA),
          cov_b_limit: toNumber(value.coverage.limitB),
          cov_c_limit: toNumber(value.coverage.limitC),
          cov_d_limit: toNumber(value.coverage.limitD),
          deductible_amt: toNumber(value.coverage.deductibleDollarAmount),

          // lloyd's
          lloyds_umr: emptyToNull(value.lloyds.umr),
          yoa: toNumber(value.lloyds.yearOfAccount),
          section_number: emptyToNull(value.lloyds.sectionNumber),
          notes: emptyToNull(value.lloyds.notes),
        };

        await mutateAsync(submission);
      } catch (err) {
        console.log(err);
      }
    },
  });

  const { data: underwriters } = useSuspenseQuery({
    queryKey: ['underwriters'],
    queryFn: async () => {
      const { data, error } = await supabase.from('underwriters').select('*');
      // .eq('status', 'active'); // enable filter or add chip next to name with status

      if (error) return [];
      return data;
    },
  });

  const getUwStatusColor = (status: UwStatus) => {
    switch (status) {
      case 'active':
        return theme.vars.palette.success.light;
      case 'on_leave':
        return theme.vars.palette.warning.light;
      case 'inactive':
        return theme.vars.palette.error.light;
      default:
        return theme.vars.palette.grey[300];
    }
  };

  return (
    <form.AppForm>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
        }}
      >
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 3, py: 2 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <form.AppField name='submissionNumber'>
                {(field) => (
                  <field.TextField label='Submission #' size='small' />
                )}
              </form.AppField>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <form.AppField name='priority'>
                {(field) => (
                  <field.ToggleButtonGroup
                    label='priority'
                    color='primary'
                    exclusive
                    size='small'
                    options={[
                      {
                        label: priority.enum.low,
                        value: priority.enum.low,
                      },
                      {
                        label: priority.enum.medium,
                        value: priority.enum.medium,
                      },
                      {
                        label: priority.enum.high,
                        value: priority.enum.high,
                      },
                    ]}
                  />
                  //   {/* {priority.options.map((o) => (
                  //     <ToggleButton key={`priority-${o}`} value={o}>
                  //       {o}
                  //     </ToggleButton>
                  //   ))}
                  // </field.ToggleButtonGroup> */}
                )}
              </form.AppField>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <form.AppField name='stage'>
                {(field) => (
                  <field.TextField label='Stage' size='small' select>
                    {newBusinessStage.options.map((o) => (
                      <MenuItem key={`stage-${o}`} value={o}>
                        {o}
                      </MenuItem>
                    ))}
                  </field.TextField>
                )}
              </form.AppField>
            </Grid>

            <Grid size={6}>
              <Suspense fallback={<Skeleton variant='rounded' height={32} />}>
                <form.AppField name='submissionDate'>
                  {({ DatePicker }) => (
                    <DatePicker
                      label='Submission date'
                      slotProps={{
                        textField: {
                          size: 'small',
                        },
                      }}
                    />
                  )}
                </form.AppField>
              </Suspense>
            </Grid>

            <Grid size={6}>
              <Suspense fallback={<Skeleton variant='rounded' height={32} />}>
                <form.AppField name='quoteDueDate'>
                  {({ DatePicker }) => (
                    <DatePicker
                      label='Quote due'
                      slotProps={{
                        textField: {
                          size: 'small',
                        },
                      }}
                    />
                  )}
                </form.AppField>
              </Suspense>
            </Grid>

            <Grid size={6}>
              <Suspense fallback={<Skeleton variant='rounded' height={32} />}>
                <form.AppField name='quoteReceivedDate'>
                  {({ DatePicker }) => (
                    <DatePicker
                      label='Quote received'
                      // TODO: helperText (use sql column description ?)
                      slotProps={{
                        textField: {
                          size: 'small',
                          required: true,
                        },
                      }}
                    />
                  )}
                </form.AppField>
              </Suspense>
            </Grid>

            <Grid size={6}></Grid>

            <Grid size={12}>
              <form.AppField name='assignedTo'>
                {(field) => (
                  <field.TextField label='Assigned to' size='small' select>
                    {underwriters.map((o) => (
                      <MenuItem key={`uw-${o.id}`} value={o.id}>
                        <Badge
                          variant='dot'
                          sx={{
                            '': {
                              backgroundColor: getUwStatusColor(
                                o.status as UwStatus,
                              ),
                            },
                          }}
                        >
                          {o.display_name}
                        </Badge>
                      </MenuItem>
                    ))}
                  </field.TextField>
                )}
              </form.AppField>
            </Grid>

            {/* Client */}
            <form.AppField name='clientId'>
              {(field) => (
                <field.EntitySelect
                  label='Client'
                  table='clients'
                  searchColumns={['company_name', 'last_name', 'first_name']}
                  getOptionLabel={(r) =>
                    (r.company_name as string) ||
                    [r.first_name, r.last_name].filter(Boolean).join(' ') ||
                    `Client #${r.id}`
                  }
                  renderCreateForm={({ defaultName, onCreated, onCancel }) => (
                    <NewClientForm
                      defaultValues={{ companyName: defaultName }}
                      onCreated={onCreated}
                      onCancel={onCancel}
                    />
                    // <ClientCreateBody defaultName={defaultName} onCreated={onCreated} onCancel={onCancel} />
                  )}
                  size='small'
                />
              )}
            </form.AppField>

            {/* Agent/Agency */}
            <form.AppField name='agencyId'>
              {(field) => (
                <field.EntitySelect
                  label='Agent'
                  table='agencies'
                  searchColumns={['entity_name', 'last_name', 'first_name']}
                  getOptionLabel={(r) =>
                    (r.display_name as string) || `Agent #${r.id}`
                  }
                  renderCreateForm={({ defaultName, onCreated, onCancel }) => (
                    <NewAgencyForm
                      defaultValues={{ entityName: defaultName }}
                      onCreated={onCreated}
                      onCancel={onCancel}
                    />
                  )}
                  size='small'
                />
              )}
            </form.AppField>

            {/* Policy */}
            <Grid size={12}>
              <Typography variant='overline' color='textMuted'>
                Policy
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <form.AppField name='policy.lineOfBusiness'>
                {(field) => (
                  <field.TextField label='Line of business' size='small' />
                )}
              </form.AppField>
            </Grid>
            <Grid size={{ xs: 8, sm: 3 }}>
              <form.AppField name='policy.jurisdiction'>
                {(field) => (
                  <field.TextField label='Jurisdiction' size='small' />
                )}
              </form.AppField>
            </Grid>
            <Grid size={{ xs: 4, sm: 3 }}>
              <form.AppField name='policy.state'>
                {(field) => (
                  <field.Select
                    label='Home state'
                    size='small'
                    options={stateOptions}
                  />
                )}
              </form.AppField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <form.AppField name='policy.policyNumber'>
                {(field) => (
                  <field.TextField label='Policy number' size='small' />
                )}
              </form.AppField>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Suspense fallback={<Skeleton variant='rounded' height={40} />}>
                <form.AppField name='policy.effectiveDate'>
                  {({ DatePicker }) => (
                    <DatePicker
                      label='Effective date'
                      slotProps={{
                        textField: {
                          size: 'small',
                          required: true,
                        },
                      }}
                    />
                  )}
                </form.AppField>
              </Suspense>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Suspense fallback={<Skeleton variant='rounded' height={40} />}>
                <form.AppField name='policy.expirationDate'>
                  {({ DatePicker }) => (
                    <DatePicker
                      label='Expiration date'
                      slotProps={{
                        textField: {
                          size: 'small',
                          required: true,
                        },
                      }}
                    />
                  )}
                </form.AppField>
              </Suspense>
            </Grid>

            {/* Premium & fees */}
            <Grid size={12}>
              <Typography variant='overline' color='textMuted'>
                Premium & fees
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <form.AppField name='policy.annualPremium'>
                {(field) => (
                  <field.TextField
                    label='Annual premium'
                    size='small'
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position='start'>$</InputAdornment>
                        ),
                      },
                      htmlInput: { inputMode: 'decimal' },
                    }}
                  />
                )}
              </form.AppField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <form.AppField name='policy.terrorismPremium'>
                {(field) => (
                  <field.TextField
                    label='Terrorism premium'
                    size='small'
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position='start'>$</InputAdornment>
                        ),
                      },
                      htmlInput: { inputMode: 'decimal' },
                    }}
                  />
                )}
              </form.AppField>
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <form.AppField name='policy.policyFee'>
                {(field) => (
                  <field.TextField
                    label='Policy fee'
                    size='small'
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position='start'>$</InputAdornment>
                        ),
                      },
                      htmlInput: { inputMode: 'decimal' },
                    }}
                  />
                )}
              </form.AppField>
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <form.AppField name='policy.inspectionFee'>
                {(field) => (
                  <field.TextField
                    label='Inspection fee'
                    size='small'
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position='start'>$</InputAdornment>
                        ),
                      },
                      htmlInput: { inputMode: 'decimal' },
                    }}
                  />
                )}
              </form.AppField>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <form.AppField name='policy.otherFees'>
                {(field) => (
                  <field.TextField
                    label='Other fees'
                    size='small'
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position='start'>$</InputAdornment>
                        ),
                      },
                      htmlInput: { inputMode: 'decimal' },
                    }}
                  />
                )}
              </form.AppField>
            </Grid>
            <Grid size={12}>
              <form.AppField name='policy.otherFeeDescription'>
                {(field) => (
                  <field.TextField label='Other fee description' size='small' />
                )}
              </form.AppField>
            </Grid>

            {/* Commission */}
            <Grid size={12}>
              <Typography variant='overline' color='textMuted'>
                Commission
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <form.AppField name='policy.grossCommissionPctOverride'>
                {(field) => (
                  <field.TextField
                    label='Gross commission override'
                    size='small'
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position='end'>%</InputAdornment>
                        ),
                      },
                      htmlInput: { inputMode: 'decimal' },
                    }}
                  />
                )}
              </form.AppField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <form.AppField name='policy.minEarnedPremiumPct'>
                {(field) => (
                  <field.TextField
                    label='Min earned premium'
                    size='small'
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position='end'>%</InputAdornment>
                        ),
                      },
                      htmlInput: { inputMode: 'decimal' },
                    }}
                  />
                )}
              </form.AppField>
            </Grid>
          </Grid>
        </Box>

        <Box
          sx={{
            px: 3,
            py: 2,
            borderTop: 1,
            borderColor: 'divider',
            backgroundColor: 'background.paper',
          }}
        >
          <form.SubmitButton label='Submit' fullWidth />
        </Box>
      </Box>
    </form.AppForm>
  );
}

// export const NewBusinessForm = withForm({
//   ...newBusinessFormOpts,
//   props: {
//     spacing: 2,
//     rowSpacing: undefined as number | undefined,
//     columnSpacing: undefined as number | undefined,
//   },
//   render: function Render({ form, spacing }) {
//     const theme = useTheme();

//     const { data: underwriters } = useSuspenseQuery({
//       queryKey: ['underwriters'],
//       queryFn: async () => {
//         const { data, error } = await supabase.from('underwriters').select('*');
//         // .eq('status', 'active'); // enable filter or add chip next to name with status

//         if (error) return [];
//         return data;
//       },
//     });

//     const getUwStatusColor = (status: UwStatus) => {
//       switch (status) {
//         case 'active':
//           return theme.vars.palette.success.light;
//         case 'on_leave':
//           return theme.vars.palette.warning.light;
//         case 'inactive':
//           return theme.vars.palette.error.light;
//         default:
//           return theme.vars.palette.grey[300];
//       }
//     };

//     return (
//       <Grid container spacing={spacing}>
//         <Grid size={{ xs: 12, sm: 6 }}>
//           <form.AppField name='stage'>
//             {(field) => (
//               <field.TextField label='Stage' select>
//                 {newBusinessStage.options.map((o) => (
//                   <MenuItem key={`stage-${o}`} value={o}>
//                     {o}
//                   </MenuItem>
//                 ))}
//               </field.TextField>
//             )}
//           </form.AppField>
//         </Grid>
//         <Grid size={{ xs: 12, sm: 6 }}>
//           <form.AppField name='priority'>
//             {(field) => (
//               <field.ToggleButtonGroup
//                 label='priority'
//                 color='standard'
//                 options={[
//                   {
//                     label: priority.enum.low,
//                     value: priority.enum.low,
//                   },
//                   {
//                     label: priority.enum.medium,
//                     value: priority.enum.medium,
//                   },
//                   {
//                     label: priority.enum.high,
//                     value: priority.enum.high,
//                   },
//                 ]}
//               >
//                 {priority.options.map((o) => (
//                   <ToggleButton key={`priority-${o}`} value={o}>
//                     {o}
//                   </ToggleButton>
//                 ))}
//               </field.ToggleButtonGroup>
//             )}
//           </form.AppField>
//         </Grid>
//         <Grid size={{ xs: 12, sm: 6 }}>
//           <form.AppField name='stage'>
//             {(field) => (
//               <field.TextField label='Stage' select>
//                 {newBusinessStage.options.map((o) => (
//                   <MenuItem key={`stage-${o}`} value={o}>
//                     {o}
//                   </MenuItem>
//                 ))}
//               </field.TextField>
//             )}
//           </form.AppField>
//         </Grid>

//         <Grid size={6}>
//           <Suspense fallback={<Skeleton variant='rounded' height={32} />}>
//             <form.AppField name='submissionDate'>
//               {({ DatePicker }) => (
//                 <DatePicker
//                   label='Submission date'
//                   slotProps={{
//                     textField: {
//                       size: 'small',
//                     },
//                   }}
//                 />
//               )}
//             </form.AppField>
//           </Suspense>
//         </Grid>
//         <Grid size={6}>
//           <Suspense fallback={<Skeleton variant='rounded' height={32} />}>
//             <form.AppField name='quoteDueDate'>
//               {({ DatePicker }) => (
//                 <DatePicker
//                   label='Quote due date'
//                   slotProps={{
//                     textField: {
//                       size: 'small',
//                     },
//                   }}
//                 />
//               )}
//             </form.AppField>
//           </Suspense>
//         </Grid>
//         <Grid size={6}>
//           <Suspense fallback={<Skeleton variant='rounded' height={32} />}>
//             <form.AppField name='policy.expirationDate'>
//               {({ DatePicker }) => (
//                 <DatePicker
//                   label='Expiration date'
//                   slotProps={{
//                     textField: {
//                       size: 'small',
//                       required: true,
//                     },
//                   }}
//                 />
//               )}
//             </form.AppField>
//           </Suspense>
//         </Grid>

//         <Grid size={6}></Grid>

//         <Grid size={12}>
//           <form.AppField name='assignedTo'>
//             {(field) => (
//               <field.TextField label='Assigned to' select>
//                 {underwriters.map((o) => (
//                   <MenuItem key={`uw-${o.id}`} value={o.id}>
//                     <Badge
//                       variant='dot'
//                       sx={{
//                         '': {
//                           backgroundColor: getUwStatusColor(
//                             o.status as UwStatus,
//                           ),
//                         },
//                       }}
//                     >
//                       {o.display_name}
//                     </Badge>
//                   </MenuItem>
//                 ))}
//               </field.TextField>
//             )}
//           </form.AppField>
//         </Grid>

//         {/* Client */}
//         <form.AppField name='clientId'>
//           {(field) => (
//             <field.EntitySelect
//               label='Client'
//               table='clients'
//               searchColumns={['company_name', 'last_name', 'first_name']}
//               getOptionLabel={(r) =>
//                 (r.company_name as string) ||
//                 [r.first_name, r.last_name].filter(Boolean).join(' ') ||
//                 `Client #${r.id}`
//               }
//               renderCreateForm={({ defaultName, onCreated, onCancel }) => (
//                 <NewClientForm
//                   defaultValues={{ companyName: defaultName }}
//                   onCreated={onCreated}
//                   onCancel={onCancel}
//                 />
//                 // <ClientCreateBody defaultName={defaultName} onCreated={onCreated} onCancel={onCancel} />
//               )}
//             />
//           )}
//         </form.AppField>

//         {/* Agent/Agency */}
//         <form.AppField name='agencyId'>
//           {(field) => (
//             <field.EntitySelect
//               label='Agent'
//               table='agencies'
//               searchColumns={['entity_name', 'last_name', 'first_name']}
//               getOptionLabel={(r) =>
//                 (r.display_name as string) || `Agent #${r.id}`
//               }
//               renderCreateForm={({ defaultName, onCreated, onCancel }) => (
//                 <NewAgencyForm
//                   defaultValues={{ entityName: defaultName }}
//                   onCreated={onCreated}
//                   onCancel={onCancel}
//                 />
//               )}
//             />
//           )}
//         </form.AppField>

//         {/* Policy */}
//         <Grid size={12}>
//           <Typography variant='overline' color='textMuted'>
//             Policy
//           </Typography>
//         </Grid>
//         <Grid size={6}>
//           <Suspense fallback={<Skeleton variant='rounded' height={32} />}>
//             <form.AppField name='policy.effectiveDate'>
//               {({ DatePicker }) => (
//                 <DatePicker
//                   label='Effective date'
//                   slotProps={{
//                     textField: {
//                       size: 'small',
//                       // sx: compactInputSx,
//                       required: true,
//                     },
//                   }}
//                 />
//               )}
//             </form.AppField>
//           </Suspense>
//         </Grid>
//         <Grid size={6}>
//           <Suspense fallback={<Skeleton variant='rounded' height={32} />}>
//             <form.AppField name='policy.expirationDate'>
//               {({ DatePicker }) => (
//                 <DatePicker
//                   label='Expiration date'
//                   slotProps={{
//                     textField: {
//                       size: 'small',
//                       // sx: compactInputSx,
//                       required: true,
//                     },
//                   }}
//                 />
//               )}
//             </form.AppField>
//           </Suspense>
//         </Grid>
//       </Grid>
//     );
//   },
// });

// export const NewBusinessForm = withForm({
//   ...newBusinessFormOpts,
//   props: {
//     spacing: 2,
//     rowSpacing: undefined as number | undefined,
//     columnSpacing: undefined as number | undefined,
//   },
//   render: function Render({ form, spacing }) {
//     return (
//       <Grid container spacing={spacing}>
//         <Grid size={12}>
//           <form.AppField
//             name='companyName'
//             children={(field) => <field.TextField label='Name' />}
//           />
//         </Grid>
//       </Grid>
//     );
//   },
// });
