import { render, screen } from "@testing-library/react-native";
import { SeverityBadge, type BadgeSeverity } from "./severity-badge";

describe("SeverityBadge", () => {
  it.each<[BadgeSeverity, string]>([
    ["green", "Safe"],
    ["yellow", "Caution"],
    ["red", "Avoid"],
    ["none", "Analyze for you"],
  ])("reads %s as '%s'", async (severity, words) => {
    await render(<SeverityBadge severity={severity} />);

    expect(screen.getByLabelText(words)).toBeOnTheScreen();
  });

  it("reads a custom label instead of the plain word", async () => {
    await render(<SeverityBadge severity="red" label="Avoid for Papa" />);

    expect(screen.getByLabelText("Avoid for Papa")).toBeOnTheScreen();
  });
});
