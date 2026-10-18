import { Link, NavLink, Outlet } from "react-router-dom";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5BDB] ${
    isActive ? "fond-bold text-[#3B5BDB]" : "hover:underline"
  }`;

export default function Layout() {
  return (
    <div className='min-h-screen bg-[#FBFAF7] text-[#22252B]'>
      <header className='border-b border-black/10'>
        <div className='mx-auto flex max-w-[960px] items-center justify-between p-4'>
          <Link
            to='/'
            className='rounded text-2xl fond-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5BDB]'
          >
            Gather
          </Link>
          <nav className='flex gap-2 text-base'>
            <NavLink to='/events/new' className={navClass}>
              New event
            </NavLink>
            <NavLink to='/me' className={navClass}>
              My events
            </NavLink>
            <NavLink to='/login' className={navClass}>
              Log in
            </NavLink>
            <NavLink to='/register' className={navClass}>
              Sign up
            </NavLink>
          </nav>
        </div>
      </header>
      <main className='mx-auto max-w-[#960px] p-4'>
        <Outlet />
      </main>
    </div>
  );
}
