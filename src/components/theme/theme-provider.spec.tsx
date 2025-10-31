import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "./theme-provider";

// Mock the theme import
vi.mock("./theme", () => ({
  theme: {
    colors: {
      primary: "#000000",
      secondary: {
        light: "#ffffff",
        dark: "#000000",
      },
    },
    font: {
      family: "Arial",
    },
    spacing: {
      small: "4px",
    },
    radius: {
      small: "2px",
    },
    shadow: {
      small: "0 1px 2px rgba(0,0,0,0.1)",
    },
    spinner: {
      duration: "1s",
    },
    grid: {
      columns: "12",
    },
    breakpoints: {
      mobile: "768px",
    },
  },
}));

describe("ThemeProvider", () => {
  beforeEach(() => {
    // Clear any existing CSS custom properties
    const root = document.documentElement;
    const styles = root.style;
    for (let i = styles.length; i--; ) {
      const name = styles[i];
      if (
        name.startsWith("--color-") ||
        name.startsWith("--font-") ||
        name.startsWith("--spacing-") ||
        name.startsWith("--radius-") ||
        name.startsWith("--shadow-") ||
        name.startsWith("--spinner-") ||
        name.startsWith("--grid-") ||
        name.startsWith("--breakpoints-")
      ) {
        styles.removeProperty(name);
      }
    }
  });

  it("renders children", () => {
    const { getByText } = render(
      <ThemeProvider>
        <div>Test content</div>
      </ThemeProvider>
    );

    expect(getByText("Test content")).toBeInTheDocument();
  });

  it("injects CSS custom properties on mount", () => {
    const root = document.documentElement;

    render(
      <ThemeProvider>
        <div>Test</div>
      </ThemeProvider>
    );

    // Check that some CSS custom properties were set
    expect(root.style.getPropertyValue("--color-primary")).toBe("#000000");
    expect(root.style.getPropertyValue("--color-secondary-light")).toBe(
      "#ffffff"
    );
    expect(root.style.getPropertyValue("--color-secondary-dark")).toBe(
      "#000000"
    );
    expect(root.style.getPropertyValue("--font-family")).toBe("Arial");
    expect(root.style.getPropertyValue("--spacing-small")).toBe("4px");
    expect(root.style.getPropertyValue("--radius-small")).toBe("2px");
    expect(root.style.getPropertyValue("--breakpoints-mobile")).toBe("768px");
  });

  it("handles nested theme objects correctly", () => {
    const root = document.documentElement;

    render(
      <ThemeProvider>
        <div>Test</div>
      </ThemeProvider>
    );

    // Check nested properties
    expect(root.style.getPropertyValue("--color-secondary-light")).toBe(
      "#ffffff"
    );
    expect(root.style.getPropertyValue("--color-secondary-dark")).toBe(
      "#000000"
    );
  });
});
