import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "./AuthContext";
import RequireAuth from "./RequireAuth";

vi.mock("./AuthContext", () => ({ useAuth: vi.fn() }));

function mockAuth(state: Partial<ReturnType<typeof useAuth>>) {
  vi.mocked(useAuth).mockReturnValue({
    user: null,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    ...state,
  });
}

function LoginProbe() {
  const { search } = useLocation();
  return <p>Login page {search}</p>;
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path='/me'
          element={
            <RequireAuth>
              <p>My events</p>
            </RequireAuth>
          }
        />
        <Route path='/login' element={<LoginProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireAuth", () => {
  beforeEach(() => vi.mocked(useAuth).mockReset());

  it("redirects logged-out users to login, remembering where they were going", () => {
    mockAuth({ user: null });
    renderAt("/me");

    expect(screen.getByText("Login page ?next=%2Fme")).toBeInTheDocument();
    expect(screen.queryByText("My events")).not.toBeInTheDocument();
  });

  it("shows a loading state instead of redirecting while the session is checked", () => {
    mockAuth({ loading: true });
    renderAt("/me");

    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText(/Login page/)).not.toBeInTheDocument();
  });

  it("renders the page for logged-in users", () => {
    mockAuth({
      user: { id: "u1", email: "amira@example.com", display_name: "Amira" },
    });
    renderAt("/me");

    expect(screen.getByText("My events")).toBeInTheDocument();
  });
});
