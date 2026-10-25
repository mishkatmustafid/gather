import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import Layout from "./components/Layout";
import EventList from "./pages/EventList";
import EventDetail from "./pages/EventDetail";
import NewEvent from "./pages/NewEvent.tsx";
import EditEvent from "./pages/EditEvent.tsx";
import Login from "./pages/Login.tsx";
import Register from "./pages/Register.tsx";
import Me from "./pages/Me.tsx";
import NotFound from "./pages/NotFound.tsx";
import { AuthProvider } from "./auth/AuthContext.tsx";
import RequireAuth from "./auth/RequireAuth.tsx";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient.ts";

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <EventList /> },
      {
        path: "/events/new",
        element: (
          <RequireAuth>
            <NewEvent />
          </RequireAuth>
        ),
      },
      { path: "/events/:id", element: <EventDetail /> },
      {
        path: "/events/:id/edit",
        element: (
          <RequireAuth>
            <EditEvent />
          </RequireAuth>
        ),
      },
      { path: "/login", element: <Login /> },
      { path: "/register", element: <Register /> },
      {
        path: "/me",
        element: (
          <RequireAuth>
            <Me />
          </RequireAuth>
        ),
      },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
