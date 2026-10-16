import { render, screen, userEvent } from "@testing-library/react-native";
import { Chip } from "./chip";

describe("Chip", () => {
  it("has a remove control named after what it removes", async () => {
    const onRemove = jest.fn();
    await render(
      <Chip label="Sugar" removeLabel="Sugar (diabetes)" onRemove={onRemove} />
    );

    await userEvent.press(
      screen.getByRole("button", { name: "Remove Sugar (diabetes)" })
    );

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("has no remove control without onRemove", async () => {
    await render(<Chip label="For Papa · Sugar" />);

    expect(screen.getByText("For Papa · Sugar")).toBeOnTheScreen();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
