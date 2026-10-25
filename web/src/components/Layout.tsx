import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b5BDB]";

// min-h-11 = 44px, the minimum comfortable touch target
const navClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-11 items-center rounded px-2 ${focusRing} ${isActive ? "font-bold text-[#3B5BDB]" : "hover:underline"}`;

export default function Layout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/");
  }
  return (
    <div className='min-h-screen bg-[#FBFAF7] text-[#22252B]'>
      {/* Lets keyboard users jump past the header; invisible until focused */}
      <a
        href='#main'
        className='sr-only rounded bg-[#3B5BDB] px-4 py-2 font-medium text-white focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10'
      >
        Skip to main content
      </a>
      <header className='border-b border-black/10'>
        <div className='mx-auto flex max-w-[960px] flex-wrap items-center justify-between gap-2 p-4'>
          <Link to='/' className={`rounded text-2xl font-bold ${focusRing}`}>
            Gather
          </Link>

          {/* Render nothing while /auth/me is in flight, so the links don't flicker */}
          {!loading && (
            <nav
              aria-label='Main'
              className='flex flex-wrap items-center gap-2'
            >
              {user ? (
                <>
                  <NavLink to='/events/new' className={navClass}>
                    New event
                  </NavLink>
                  <NavLink to='/me' className={navClass}>
                    My events
                  </NavLink>
                  {/* ...New event and My events NavLinks unchanged... */}
                  {/* Hidden on narrow screens to keep the header to one or two lines */}
                  <span className='hidden px-2 text-black/60 sm:inline'>
                    Hi, {user.display_name}
                  </span>
                  <button
                    type='button'
                    onClick={handleLogout}
                    className={`inline-flex min-h-11 items-center rounded px-2 hover:underline ${focusRing}`}
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <NavLink to='/login' className={navClass}>
                    Log in
                  </NavLink>
                  <NavLink to='/register' className={navClass}>
                    Sign up
                  </NavLink>
                </>
              )}
            </nav>
          )}
        </div>
      </header>

      <main
        id='main'
        tabIndex={-1}
        className='mx-auto max-w-[960px] p-4 focus:outline-none'
      >
        <Outlet />
      </main>
    </div>
  );
}
