import { render, screen } from "@testing-library/react";
import HomePage from "./page";

describe("HomePage", () => {
  it("renders the platform heading and a link to the staff dashboard", () => {
    render(<HomePage />);

    expect(screen.getByText("Atria Wellness Intake Platform")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Staff Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });
});
