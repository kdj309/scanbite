import { render, screen, userEvent } from "@testing-library/react-native";
import { ChoiceRow } from "./choice-row";
import { SelectPill } from "./select-pill";
import { SelectTile } from "./select-tile";
import { StepProgress } from "./step-progress";

describe("SelectTile", () => {
  it("is a checkbox named by title and subtitle, showing whether it's picked", async () => {
    const onToggle = jest.fn();
    await render(
      <SelectTile
        title="Sugar"
        subtitle="Diabetes"
        selected
        onToggle={onToggle}
      />
    );
    const tile = screen.getByRole("checkbox", { name: "Sugar, Diabetes" });

    expect(tile).toBeChecked();
    await userEvent.press(tile);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe("SelectPill", () => {
  it("is a checkbox showing whether it's picked", async () => {
    const onToggle = jest.fn();
    await render(
      <SelectPill label="Peanuts" selected={false} onToggle={onToggle} />
    );
    const pill = screen.getByRole("checkbox", { name: "Peanuts" });

    expect(pill).not.toBeChecked();
    await userEvent.press(pill);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe("ChoiceRow", () => {
  it("is a radio group with the chosen option checked", async () => {
    const onChange = jest.fn();
    await render(
      <ChoiceRow
        label="Age in years"
        options={["18–39", "60+"]}
        value="60+"
        onChange={onChange}
      />
    );

    expect(screen.getByRole("radio", { name: "60+" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "18–39" })).not.toBeChecked();
    await userEvent.press(screen.getByRole("radio", { name: "18–39" }));
    expect(onChange).toHaveBeenCalledWith("18–39");
  });
});

describe("StepProgress", () => {
  it("is announced as the current step out of the total", async () => {
    await render(<StepProgress current={2} total={4} />);

    expect(screen.getByLabelText("Step 2 of 4")).toBeOnTheScreen();
  });
});
