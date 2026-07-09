/**
 * Rater builder shell. Local state is ONE RaterDefinition object — the source
 * of truth every editor mutates immutably; the diagram and test panel are
 * views of it. Save validates (zod + cross-step static checks) and upserts
 * to `raters` via supabase-js under RLS.
 */

import { supabase } from '#/supabaseClient';
import {
  raterDefinitionSchema,
  validateRaterDefinition,
  type RaterDefinition,
  type RaterStep,
  type RecordMapping,
} from '#/types/raters';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMutation } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  appendStep,
  moveStepAt,
  newStep,
  removeStepAt,
  replaceStepAt,
  type StepPath,
} from './definitionUtils';
import { InputDefsEditor } from './InputDefsEditor';
import { RecordMappingEditor } from './RecordMappingEditor';
import { StepListEditor, type StepListEditorHandlers } from './StepListEditor';
import { TestRunPanel, type TestRunState } from './TestRunPanel';

const RaterFlow = lazy(() =>
  import('./diagram/RaterFlow').then((m) => ({ default: m.RaterFlow })),
);

interface RaterBuilderProps {
  /** Editing an existing rater when set; creating otherwise. */
  raterId?: string;
  initialName?: string;
  initialDescription?: string;
  initialDefinition: RaterDefinition;
  initialRecordMapping?: RecordMapping | null;
  onSaved: (id: string) => void;
  onCancel?: () => void;
}

export const RaterBuilder = ({
  raterId,
  initialName,
  initialDescription,
  initialDefinition,
  initialRecordMapping,
  onSaved,
  onCancel,
}: RaterBuilderProps) => {
  const [name, setName] = useState(initialName ?? '');
  const [description, setDescription] = useState(initialDescription ?? '');
  const [definition, setDefinition] =
    useState<RaterDefinition>(initialDefinition);
  const [recordMapping, setRecordMapping] = useState<RecordMapping | null>(
    initialRecordMapping ?? null,
  );
  const [tab, setTab] = useState<'diagram' | 'test'>('diagram');
  const [testRun, setTestRun] = useState<TestRunState | null>(null);
  const [dirty, setDirty] = useState(false);

  const update = (next: RaterDefinition) => {
    setDefinition(next);
    setDirty(true);
    setTestRun(null); // a stale trace shouldn't highlight a changed diagram
  };

  const validation = useMemo(() => {
    const zod = raterDefinitionSchema.safeParse(definition);
    if (!zod.success) {
      return {
        errors: zod.error.issues.map((i) => ({
          stepId: undefined as string | undefined,
          message: i.message,
        })),
        warnings: [],
      };
    }
    return validateRaterDefinition(definition);
  }, [definition]);

  const errorStepIds = useMemo(
    () =>
      new Set(
        validation.errors
          .map((e) => e.stepId)
          .filter((id): id is string => Boolean(id)),
      ),
    [validation],
  );

  const handlers: StepListEditorHandlers = {
    onReplace: (path: StepPath, step: RaterStep) =>
      update(replaceStepAt(definition, path, step)),
    onRemove: (path: StepPath) => update(removeStepAt(definition, path)),
    onMove: (path: StepPath, delta) =>
      update(moveStepAt(definition, path, delta)),
    onAdd: (parentPath: StepPath, type) =>
      update(appendStep(definition, parentPath, newStep(definition, type))),
    errorStepIds,
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Give the rater a name');
      if (validation.errors.length) {
        throw new Error(
          `Fix ${validation.errors.length} validation error(s) first`,
        );
      }
      const row = {
        name: name.trim(),
        description: description.trim() || null,
        definition: definition as never,
        record_mapping: (recordMapping?.mappings.length
          ? recordMapping
          : null) as never,
      };
      if (raterId) {
        const { error } = await supabase
          .from('raters')
          .update(row)
          .eq('id', raterId);
        if (error) throw new Error(error.message);
        return raterId;
      }
      const { data, error } = await supabase
        .from('raters')
        .insert(row)
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      return (data as { id: string }).id;
    },
    onSuccess: (id) => {
      setDirty(false);
      toast.success(raterId ? 'Rater saved' : 'Rater created');
      onSaved(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const blocked = validation.errors.length
    ? `${validation.errors.length} validation error(s)`
    : null;

  return (
    <Stack spacing={2.5}>
      {/* header */}
      <Box
        sx={{
          display: 'flex',
          gap: 1.5,
          alignItems: 'flex-start',
          flexWrap: 'wrap',
        }}
      >
        <TextField
          label='Name'
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setDirty(true);
          }}
          size='small'
          required
          sx={{ width: 300 }}
        />
        <TextField
          label='Description'
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setDirty(true);
          }}
          size='small'
          sx={{ flex: 1, minWidth: 260 }}
        />
        <Stack direction='row' spacing={1}>
          {onCancel && (
            <Button onClick={onCancel} disabled={save.isPending}>
              Cancel
            </Button>
          )}
          <Button
            variant='contained'
            startIcon={
              <Save size={15} color='var(--palette-primary-contrastText)' />
            }
            disabled={save.isPending || !dirty}
            onClick={() => save.mutate()}
          >
            Save
          </Button>
        </Stack>
      </Box>

      {/* validation summary */}
      {validation.errors.length > 0 && (
        <Alert severity='error'>
          <Stack spacing={0.25}>
            {validation.errors.slice(0, 5).map((e, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static list
              <span key={i}>
                {e.stepId ? <b>{e.stepId}: </b> : null}
                {e.message}
              </span>
            ))}
            {validation.errors.length > 5 && (
              <span>…and {validation.errors.length - 5} more</span>
            )}
          </Stack>
        </Alert>
      )}
      {validation.errors.length === 0 && validation.warnings.length > 0 && (
        <Alert severity='warning'>
          <Stack spacing={0.25}>
            {validation.warnings.map((w, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static list
              <span key={i}>
                {w.stepId ? <b>{w.stepId}: </b> : null}
                {w.message}
              </span>
            ))}
          </Stack>
        </Alert>
      )}

      {/* two-column workspace */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            lg: 'minmax(420px, 1fr) minmax(380px, 1fr)',
          },
          gap: 2.5,
          alignItems: 'start',
        }}
      >
        <Stack spacing={2.5}>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1 }}>
              Inputs
            </Typography>
            <InputDefsEditor
              inputs={definition.inputs}
              onChange={(inputs) => update({ ...definition, inputs })}
            />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1 }}>
              Record pre-fill
            </Typography>
            <RecordMappingEditor
              inputs={definition.inputs}
              mapping={recordMapping}
              onChange={(m) => {
                setRecordMapping(m);
                setDirty(true);
              }}
            />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1 }}>
              Steps
            </Typography>
            <StepListEditor
              definition={definition}
              parentPath={[]}
              steps={definition.steps}
              handlers={handlers}
            />
          </Box>
        </Stack>

        <Paper
          variant='outlined'
          sx={{
            borderRadius: 2,
            position: 'sticky',
            top: 16,
            overflow: 'hidden',
          }}
        >
          <Tabs
            value={tab}
            onChange={(_e, v) => setTab(v)}
            sx={{ px: 1.5, minHeight: 42 }}
          >
            <Tab label='Diagram' value='diagram' sx={{ minHeight: 42 }} />
            <Tab label='Test run' value='test' sx={{ minHeight: 42 }} />
          </Tabs>
          <Box sx={{ p: 2 }}>
            {tab === 'diagram' ? (
              <Suspense fallback={<Box sx={{ height: 420 }} />}>
                <RaterFlow
                  definition={definition}
                  trace={testRun?.trace ?? undefined}
                />
              </Suspense>
            ) : (
              <TestRunPanel
                definition={definition}
                blocked={blocked}
                onResult={setTestRun}
              />
            )}
          </Box>
        </Paper>
      </Box>
    </Stack>
  );
};
