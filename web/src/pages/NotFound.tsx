import { Link } from "react-router-dom";
import { usePageTitle } from "../lib/usePageTitle";

export default function NotFound() {
  usePageTitle("Page not found");
  return (
    <div>
      <h1 className='text-3xl font-bold'>Page not found.</h1>
      <Link to='/' className='mt-4 inline-block text-[#3B5BDB] underline'>
        Back to events
      </Link>
    </div>
  );
}
