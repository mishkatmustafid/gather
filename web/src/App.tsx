import { useState, useEffect } from "react";

export default function App() {
  const [status, setStatus] = useState("Checking...");

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/health`)
      .then((res) => res.json())
      .then((data) => setStatus(data.status))
      .catch((err) => {
        console.error(`Error: ${err.message}`);
        setStatus(`Error: ${err.message}`);
      });
  }, []);

  return (
    <main className='mx-auto max-w-3xl p-8'>
      <h1 className='text-3xl font-bold'>Gather</h1>
      <p className='mt-2'>API status: {status}</p>
    </main>
  );
}
