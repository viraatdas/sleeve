import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

    const relationship = screen.getByRole("combobox", { name: "Relationship" });
    expect(relationship).toHaveTextContent("Me");
    fireEvent.click(relationship);
    expect(screen.getByRole("option", { name: "Me" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Family member" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Your name")).toBeVisible();
  });

  it("shows an extraction review step before a scanned record is saved", async () => {
    render(
      <SleeveWorkspace
        data={demoWorkspace}
        user={{ email: "demo@example.test" }}
        isDemo
        onSignOut={vi.fn()}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: /Add record/ })[0]!);
    const fileInput = document.getElementById("record-file") as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(["x"], "card.png", { type: "image/png" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Extract & review" }));

    await screen.findByRole("heading", { name: "Review before saving" });
    expect(screen.getByDisplayValue("DEMO000000")).toBeInTheDocument();
    expect(screen.queryByText("Passport was added to this demo.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove Place of issue" }));
    fireEvent.click(screen.getByRole("button", { name: "Save record" }));
    await screen.findByText("Passport was added to this demo.");
  });

  it("deletes a record after inline confirmation", async () => {
    render(
      <SleeveWorkspace
        data={demoWorkspace}
        user={{ email: "demo@example.test" }}
        isDemo
        onSignOut={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: /Vision prescription/ });
    fireEvent.click(trigger);
    const card = trigger.closest("article");
    expect(card).not.toBeNull();
    fireEvent.click(within(card as HTMLElement).getByRole("button", { name: "Delete" }));
    fireEvent.click(within(card as HTMLElement).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByText("Vision prescription")).not.toBeInTheDocument());
    expect(screen.getByText("Vision prescription was deleted.")).toBeInTheDocument();
  });
});
