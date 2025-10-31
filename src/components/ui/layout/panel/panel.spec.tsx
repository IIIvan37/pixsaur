import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Panel } from "./panel";
import styles from "./panel.module.css";

describe("Panel", () => {
  it("renders with children", () => {
    const { container } = render(
      <Panel>
        <div>Test content</div>
      </Panel>
    );

    const panel = container.firstChild as HTMLElement;
    expect(panel).toHaveClass(styles.panel);
    expect(screen.getByText("Test content")).toBeInTheDocument();
  });

  it("renders multiple children", () => {
    render(
      <Panel>
        <div>Child 1</div>
        <div>Child 2</div>
        <div>Child 3</div>
      </Panel>
    );

    expect(screen.getByText("Child 1")).toBeInTheDocument();
    expect(screen.getByText("Child 2")).toBeInTheDocument();
    expect(screen.getByText("Child 3")).toBeInTheDocument();
  });

  it("renders with complex children", () => {
    render(
      <Panel>
        <h2>Title</h2>
        <p>Description text</p>
        <button>Action</button>
      </Panel>
    );

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Title"
    );
    expect(screen.getByText("Description text")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveTextContent("Action");
  });

  it("renders panel structure", () => {
    const { container } = render(<Panel />);

    const panel = container.firstChild as HTMLElement;
    expect(panel).toHaveClass(styles.panel);

    // Panel contains a Flex component
    const flexElement = panel.firstChild as HTMLElement;
    expect(flexElement).toBeInTheDocument();
  });

  it("applies correct CSS class", () => {
    const { container } = render(
      <Panel>
        <div>Content</div>
      </Panel>
    );

    const panel = container.firstChild;
    expect(panel).toHaveClass(styles.panel);
  });

  it("renders as a div element", () => {
    const { container } = render(
      <Panel>
        <div>Content</div>
      </Panel>
    );

    const panel = container.firstChild;
    expect(panel).toBeInstanceOf(HTMLDivElement);
  });
});
