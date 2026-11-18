import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api";
import EventForm from "./EventForm";

const empty = {
  title: "",
  description: "",
  location: "",
  starts_at: "",
  ends_at: "",
  capacity: "",
};

function setup(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  const user = userEvent.setup();
  render(
    <EventForm
      initial={empty}
      submitLabel='Create event'
      submittingLabel='Creating event...'
      onSubmit={onSubmit}
    />,
  );
  const submit = () =>
    user.click(screen.getByRole("button", { name: "Create event" }));
  return { user, onSubmit, submit };
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/title/i), "Board games");
  await user.type(screen.getByLabelText(/location/i), "Library");
  // jsdom can't type into datetime-local inputs, so set the value directly
  fireEvent.change(screen.getByLabelText(/starts/i), {
    target: { value: "2026-11-14T18:00" },
  });
  fireEvent.change(screen.getByLabelText(/ends/i), {
    target: { value: "2026-11-14T21:00" },
  });
  await user.type(screen.getByLabelText(/capacity/i), "10");
}

describe("EventForm", () => {
  it("shows an error for every required field and does not submit an empty form", async () => {
    const { onSubmit, submit } = setup();

    await submit();

    expect(
      screen.getByText("Title must be at least 3 characters."),
    ).toBeInTheDocument();
    expect(screen.getByText("Add a location.")).toBeInTheDocument();
    expect(screen.getByText("Choose a start time.")).toBeInTheDocument();
    expect(screen.getByText("Choose an end time.")).toBeInTheDocument();
    expect(
      screen.getByText("Capacity must be a whole number, at least 1."),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("blocks submit when the end is before the start", async () => {
    const { user, onSubmit, submit } = setup();
    await fillValid(user);
    fireEvent.change(screen.getByLabelText(/ends/i), {
      target: { value: "2026-11-14T17:00" },
    });

    await submit();

    expect(screen.getByText("End must be after start.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits a converted payload when the form is valid", async () => {
    const { user, onSubmit, submit } = setup();
    await fillValid(user);

    await submit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      title: "Board games",
      description: null, // empty string becomes null
      location: "Library",
      capacity: 10, // string becomes number
      starts_at: new Date("2026-11-14T18:00").toISOString(),
      ends_at: new Date("2026-11-14T21:00").toISOString(),
    });
  });

  it("shows server field errors next to the right field", async () => {
    const onSubmit = vi.fn().mockRejectedValue(
      new ApiError(422, "validation_error", "Some fields are invalid.", {
        title: "That title is taken.",
      }),
    );
    const { user, submit } = setup(onSubmit);
    await fillValid(user);

    await submit();

    expect(await screen.findByText("That title is taken.")).toBeInTheDocument();
  });

  it("disables the button while saving to block double submits", async () => {
    const onSubmit = vi.fn(() => new Promise<void>(() => {})); // never resolves
    const { user, submit } = setup(onSubmit);

    await fillValid(user);

    await submit();

    const button = screen.getByRole("button", { name: /creating event/i });
    expect(button).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Create event" }),
    ).not.toBeInTheDocument();
  });
});
