import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
};

export default function FormField({ id, label, error, ...input }: Props) {
  const errorId = `${id}-error`;
  return (
    <div className='flex flex-col gap-1'>
      <label htmlFor={id} className='font-medium'>
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`rounded border px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5BDB]${error ? "borde-red-600" : "border-black/20"}`}
        {...input}
      />
      {error && (
        <p id={errorId} className='text-sm text-red-700'>
          {error}
        </p>
      )}
    </div>
  );
}
