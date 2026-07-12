import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { demoWorkspace } from "./demo-data";
import { SleeveWorkspace } from "./sleeve-workspace";

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value() { this.setAttribute("open", ""); },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value() { this.removeAttribute("open"); },
  });
});

describe("workspace controls", () => {
  it("opens help and offers Me when adding a person", () => {
    render(
      <SleeveWorkspace
        data={demoWorkspace}
        user={{ email: "demo@example.test" }}
        isDemo
        onSignOut={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open help" }));
    expect(screen.getByRole("heading", { name: "How Sleeve works" })).toBeVisible();
    expect(screen.getByText("Share only what’s needed")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    fireEvent.click(screen.getByRole("button", { name: "Switch person. Currently viewing You" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Add a person" }));

    const relationship = screen.getByLabelText("Relationship");
    expect(relationship).toHaveValue("Me");
    expect(screen.getByRole("option", { name: "Me" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Your name")).toBeVisible();
  });
});
