import { render, screen, userEvent } from "@testing-library/react-native";
import { Text } from "react-native";
import { PersonTile } from "./person-tile";

describe("PersonTile", () => {
  it("not added yet: a button that starts this person", async () => {
    const onPress = jest.fn();
    await render(
      <PersonTile
        title="Partner"
        subtitle="Husband or wife"
        leading={<Text>♥</Text>}
        onPress={onPress}
      />
    );

    await userEvent.press(
      screen.getByRole("button", { name: "Partner, Husband or wife" })
    );
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("added: read as added, with its own edit button", async () => {
    const onEdit = jest.fn();
    await render(
      <PersonTile
        title="Partner"
        subtitle="Priya"
        leading={<Text>♥</Text>}
        edit={{ label: "Edit Priya", onPress: onEdit }}
      />
    );

    expect(screen.getByLabelText("Partner, Priya, added")).toBeOnTheScreen();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    await userEvent.press(screen.getByRole("button", { name: "Edit Priya" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
