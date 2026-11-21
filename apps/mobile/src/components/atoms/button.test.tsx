import { render, screen, userEvent } from "@testing-library/react-native";
import { Button } from "./button";

describe("Button", () => {
  it("is announced by its title and calls onPress", async () => {
    const onPress = jest.fn();
    await render(<Button title="Scan a product" onPress={onPress} />);

    await userEvent.press(
      screen.getByRole("button", { name: "Scan a product" })
    );

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("can't be pressed when disabled, and says so", async () => {
    const onPress = jest.fn();
    await render(<Button title="Save" disabled onPress={onPress} />);
    const button = screen.getByRole("button", { name: "Save" });

    await userEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
  });

  it("keeps its title for screen readers while loading, busy and not pressable", async () => {
    const onPress = jest.fn();
    await render(<Button title="Save" loading onPress={onPress} />);
    const button = screen.getByRole("button", { name: "Save" });

    await userEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeBusy();
    expect(button).toBeDisabled();
  });

  it("keeps busy and disabled when the caller adds its own state", async () => {
    await render(
      <Button title="Papa" loading accessibilityState={{ selected: true }} />
    );
    const button = screen.getByRole("button", { name: "Papa" });

    expect(button).toBeSelected();
    expect(button).toBeBusy();
    expect(button).toBeDisabled();
  });
});
