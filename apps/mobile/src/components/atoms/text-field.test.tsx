import { render, screen, userEvent } from "@testing-library/react-native";
import { TextField } from "./text-field";

describe("TextField", () => {
  it("is found by its label and reports what's typed", async () => {
    const onChangeText = jest.fn();
    await render(
      <TextField label="What do you call them?" onChangeText={onChangeText} />
    );

    await userEvent.type(
      screen.getByLabelText("What do you call them?"),
      "Papa"
    );

    expect(onChangeText).toHaveBeenLastCalledWith("Papa");
  });
});
