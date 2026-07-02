import { createFormHook } from '@tanstack/react-form';
// import { MaskInput } from '../components/forms/MaskInput';
import { SubmitButton } from '#/components/forms/SubmitButton';
// import { WizardNavButtons } from '../components/forms/WizardNavButtons';
import { lazy } from 'react';
import { fieldContext, formContext } from './formContext';

const TextField = lazy(() => import('../components/forms/TextField.tsx'));
const DatePicker = lazy(() => import('../components/forms/DatePicker.tsx'));
const Autocomplete = lazy(() => import('../components/forms/Autocomplete.tsx'));
const ToggleButtonGroup = lazy(
  () => import('../components/forms/ToggleButtonGroup.tsx'),
);
const EntitySelect = lazy(() => import('../components/forms/EntitySelect.tsx'));
const Checkbox = lazy(() => import('../components/forms/Checkbox.tsx'));
const Select = lazy(() => import('../components/forms/Select.tsx'));

// TODO: create other reusable input types (number input, select, masked fields etc.)

// useAppForm is similar to useForm, but provides reusable custom UI components (<field.TextField>, <form.SubmitButton>, etc.)
const { useAppForm, withForm, withFieldGroup } = createFormHook({
  fieldComponents: {
    TextField,
    Checkbox,
    Select,
    DatePicker,
    Autocomplete,
    EntitySelect,
    ToggleButtonGroup,
    // MaskInput,
  },
  formComponents: {
    SubmitButton,
    // WizardNavButtons,
  },
  fieldContext,
  formContext,
});

export { useAppForm, withFieldGroup, withForm };
