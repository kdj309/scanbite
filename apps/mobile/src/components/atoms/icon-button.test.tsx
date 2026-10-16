import { render, screen, userEvent } from "@testing-library/react-native";
import { IconButton } from "./icon-button";

describe("IconButton", () => {
  it("is announced by its label and calls onPress", async () => {
    const onPress = jest.fn();
    await render(<IconButton icon="close" label="Close" onPress={onPress} />);

    await userEvent.press(screen.getByRole("button", { name: "Close" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("keeps disabled when the caller adds its own state", async () => {
    await render(
      <IconButton
        icon="close"
        label="Close"
        disabled
        accessibilityState={{ selected: true }}
      />
    );
    const button = screen.getByRole("button", { name: "Close" });

    expect(button).toBeSelected();
    expect(button).toBeDisabled();
  });
});
