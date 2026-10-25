import { useState, type FormEvent } from "react";
import { ApiError } from "../lib/api";
import {
  FIELD_FOR_CODE,
  toPayload,
  validateEvent,
  type EventErrors,
  type EventPayload,
  type EventValues,
} from "../lib/eventForm";
import FormField from "./FormField";

type Props = {
  initial: EventValues;
  submitLabel: string;
  submittingLabel: string;
  onSubmit: (payload: EventPayload) => Promise<void>;
  onCancel?: () => void;
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5BDB] focus-visible:ring-offset-2";

export default function EventForm({
  initial,
  submitLabel,
  submittingLabel,
  onSubmit,
  onCancel,
}: Props) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<EventErrors>({});
  const [saving, setSaving] = useState(false);

  const set =
    (field: keyof EventValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [field]: e.target.value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validateEvent(values);
    setErrors(found);
    if (Object.keys(found).length) {
      // Move focus to the first invalid field so keyboard and screen-reader users land on it
      const first = Object.keys(found)[0];
      document.getElementById(`event-${first}`)?.focus();
      return;
    }

    setSaving(true);
    try {
      await onSubmit(toPayload(values));
      // On success the page navigates away, so there's nothing to reset here
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setErrors(err.fields as EventErrors);
      } else if (err instanceof ApiError && FIELD_FOR_CODE[err.code]) {
        setErrors({ [FIELD_FOR_CODE[err.code]]: err.message });
      } else {
        setErrors({
          _form:
            err instanceof Error
              ? err.message
              : "Couldn't save the event. Try again.",
        });
      }
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className='mt-6 flex max-w-xl flex-col gap-4'
    >
      {errors._form && (
        <p
          role='alert'
          className='rounded border border-red-300 bg-red-50 p-3 text-red-800'
        >
          {errors._form}
        </p>
      )}

      <FormField
        id='event-title'
        label='Title'
        required
        maxLength={120}
        value={values.title}
        onChange={set("title")}
        error={errors.title}
      />

      <div className='flex flex-col gap-1'>
        <label htmlFor='event-description' className='font-medium'>
          Description{" "}
          <span className='font-normal text-black/60'>(optional)</span>
        </label>
        <textarea
          id='event-description'
          rows={4}
          value={values.description}
          onChange={set("description")}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={
            errors.description ? "event-description-error" : undefined
          }
          className={`rounded border px-3 py-2 ${focusRing} ${errors.description ? "border-red-600" : "border-black/20"}`}
        />
        {errors.description && (
          <p id='event-description-error' className='text-sm text-red-700'>
            {errors.description}
          </p>
        )}
      </div>

      <FormField
        id='event-location'
        label='Location'
        required
        maxLength={200}
        value={values.location}
        onChange={set("location")}
        error={errors.location}
      />

      <div className='grid gap-4 sm:grid-cols-2'>
        <FormField
          id='event-starts_at'
          label='Starts'
          type='datetime-local'
          required
          value={values.starts_at}
          onChange={set("starts_at")}
          error={errors.starts_at}
        />
        <FormField
          id='event-ends_at'
          label='Ends'
          type='datetime-local'
          required
          min={values.starts_at || undefined}
          value={values.ends_at}
          onChange={set("ends_at")}
          error={errors.ends_at}
        />
      </div>

      <FormField
        id='event-capacity'
        label='Capacity'
        type='number'
        inputMode='numeric'
        required
        min={1}
        max={10000}
        step={1}
        value={values.capacity}
        onChange={set("capacity")}
        error={errors.capacity}
      />

      <div className='mt-2 flex flex-wrap gap-3'>
        <button
          type='submit'
          disabled={saving}
          className={`min-h-11 rounded bg-[#3B5BDB] px-4 font-medium text-white disabled:opacity-60 ${focusRing}`}
        >
          {saving ? submittingLabel : submitLabel}
        </button>
        {onCancel && (
          <button
            type='button'
            onClick={onCancel}
            disabled={saving}
            className={`min-h-11 rounded border border-black/20 px-4 disabled:opacity-60 ${focusRing}`}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
