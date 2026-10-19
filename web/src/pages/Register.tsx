import React, { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import FormField from "../components/FormField";
import { api, ApiError } from "../lib/api";
import type { User } from "../lib/types";

type Values = { display_name: string; email: string; password: string };
type Errors = Partial<Record<keyof Values, string>>;

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
// Mirrors the server's rules so most mistakes are caught without a round trip
function validate(v: Values): Errors {
  const e: Errors = {};
  if (!v.display_name.trim()) e.display_name = "Enter a display name.";
  else if (v.display_name.trim().length > 60)
    e.display_name = "Keep it to 60 characters or fewer.";
  if (!/^\S+@\S+\.\S+$/.test(v.email.trim()))
    e.email = "Enter a valid email address.";
  if (v.password.length < 8) e.password = "Use at least 8 characters.";
  else if (v.password.length > 128) e.password = "Use 128 characters or fewer.";
  return e;
}

export default function Register() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));

  const [values, setValues] = useState<Values>({
    display_name: "",
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={next} replace />;

  const set =
    (field: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [field]: e.target.value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      await api<User>("/auth/register", {
        method: "POST",
        body: JSON.stringify(values),
      });
      await login(values.email, values.password); // land logging in
      navigate(next, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === "email_taken") {
        setErrors({ email: err.message });
      } else if (err instanceof ApiError && err.fields) {
        setErrors(err.fields as Errors);
      } else if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError(
          "Couldn't reach the server. Check your connection and try again.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className='mx-auto max-w-sm py-8'>
      <h1 className='text-3xl font-bold'>Sign up</h1>

      <form
        onSubmit={handleSubmit}
        noValidate
        className='mt-6 flex flex-col gap-4'
      >
        {formError && (
          <p
            role='alert'
            className='rounded border border-red-300 bg-red-50 p-3 text-red-800'
          >
            {formError}
          </p>
        )}

        <FormField
          id='display_name'
          label='Display name'
          autoComplete='nickname'
          required
          value={values.display_name}
          onChange={set("display_name")}
          error={errors.display_name}
        />
        <FormField
          id='email'
          label='Email'
          type='email'
          autoComplete='email'
          required
          value={values.email}
          onChange={set("email")}
          error={errors.email}
        />
        <FormField
          id='password'
          label='Password'
          type='password'
          autoComplete='new-password'
          required
          value={values.password}
          onChange={set("password")}
          error={errors.password}
        />

        <button
          type='submit'
          disabled={submitting}
          className='min-h-11 rounded bg-[#3B5BDB] px-4 py-2 font-medium text-white disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5BDB] focus-visible:ring-offset-2'
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className='mt-6'>
        Already have an account?{" "}
        <Link
          to={`/login?next=${encodeURIComponent(next)}`}
          className='text-[#3B5BDB] underline'
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
