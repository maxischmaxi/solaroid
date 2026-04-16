// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Modal } from "@/components/modals/Modal";

afterEach(() => {
  cleanup();
});

describe("Modal", () => {
  it("renders nothing when open is false", () => {
    render(
      <Modal open={false} onClose={() => {}} title="Test">
        content
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders as a dialog with the given title when open", () => {
    render(
      <Modal open={true} onClose={() => {}} title="Hallo">
        Inhalt
      </Modal>,
    );
    const dialog = screen.getByRole("dialog", { name: "Hallo" });
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="X">
        Inhalt
      </Modal>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="X">
        Inhalt
      </Modal>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Schließen" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not register an ESC listener when closed", () => {
    const onClose = vi.fn();
    render(
      <Modal open={false} onClose={onClose} title="X">
        Inhalt
      </Modal>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});
