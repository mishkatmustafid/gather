import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
// @ts-expect-error CSS is loaded by the bundler and has no TypeScript declarations.
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

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <EventList /> },
      { path: "/events/new", element: <NewEvent /> },
      { path: "/events/:id", element: <EventDetail /> },
      { path: "/events/:id/edit", element: <EditEvent /> },
      { path: "/login", element: <Login /> },
      { path: "/register", element: <Register /> },
      { path: "/me", element: <Me /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
