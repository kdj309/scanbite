import { render, screen, userEvent } from "@testing-library/react-native";
import { IconButton } from "./icon-button";

describe("IconButton", () => {
  it("is announced by its label and calls onPress", async () => {
    const onPress = jest.fn();
    await render(
      <IconButton icon="chevronLeft" label="Back" onPress={onPress} />
    );

    await userEvent.press(screen.getByRole("button", { name: "Back" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("keeps disabled when the caller adds its own state", async () => {
    await render(
      <IconButton
        icon="chevronLeft"
        label="Back"
        disabled
        accessibilityState={{ selected: true }}
      />
    );
    const button = screen.getByRole("button", { name: "Back" });

    expect(button).toBeSelected();
    expect(button).toBeDisabled();
  });
});
