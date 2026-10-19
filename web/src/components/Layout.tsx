import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b5BDB]";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded px-2 py-1 ${focusRing} ${isActive ? "font-bold text-[#3B5BDB]" : "hover:underline"}`;

export default function Layout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/");
  }
  return (
    <div className='min-h-screen bg-[#FBFAF7] text-[#22252B]'>
      <header className='border-b border-black/10'>
        <div className='mx-auto flex max-w-[960px] flex-wrap items-center justify-between gap-2 p-4'>
          <Link to='/' className={`rounded text-2xl fond-bold ${focusRing}`}>
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
                  <span className='px-2 text-black/60'>
                    Hi, {user.display_name}
                  </span>
                  <button
                    type='button'
                    onClick={handleLogout}
                    className={`rounded px-2 py-1 hover:underline ${focusRing}`}
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

      <main className='mx-auto max-w-[#960px] p-4'>
        <Outlet />
      </main>
    </div>
  );
}
