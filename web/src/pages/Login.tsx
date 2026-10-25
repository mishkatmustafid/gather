import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useState, type FormEvent } from "react";
import { ApiError } from "../lib/api";
import FormField from "../components/FormField";
import { usePageTitle } from "../lib/usePageTitle";

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default function Login() {
  usePageTitle("Log in");
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={next} replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(next, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields) setFieldErrors(err.fields);
        setFormError(err.fields ? null : err.message); // e.g.: "Email or password is incorrect."
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
      <h1 className='text-3xl font-bold'>Log In</h1>

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
          id='email'
          label='Email'
          type='email'
          autoComplete='email'
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
        />
        <FormField
          id='password'
          label='Password'
          type='password'
          autoComplete='current-password'
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
        />
        <button
          type='submit'
          disabled={submitting}
          className='min-h-11 rounded bg-[#3B5BDB] px-4 py-2 font-medium text-white disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5BDB] focus-visible:ring-offset-2'
        >
          {submitting ? "Logging in..." : "Log In"}
        </button>
      </form>

      <p className='mt-6'>
        No Account?{" "}
        <Link
          to={`/register?next=${encodeURIComponent(next)}`}
          className='text-[#3B5BDB] underline'
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
