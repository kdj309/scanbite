import { render, screen } from "@testing-library/react-native";
import { Text } from "./text";

describe("Text", () => {
  it.each(["display", "h1", "h2"] as const)(
    "announces %s as a heading",
    async (variant) => {
      await render(<Text variant={variant}>Why this matters</Text>);

      expect(
        screen.getByRole("header", { name: "Why this matters" })
      ).toBeOnTheScreen();
    }
  );

  it("doesn't announce body text as a heading", async () => {
    await render(<Text>Neither number is a daily limit.</Text>);

    expect(screen.queryByRole("header")).toBeNull();
  });
});
