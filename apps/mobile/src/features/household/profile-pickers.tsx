import {
  ALLERGEN_LABELS,
  HEALTH_CONDITION_LABELS,
  HEALTH_CONDITION_SHORT_LABELS,
  type AllergenCode,
  type HealthConditionCode,
} from "@foodscanner/shared";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, ChoiceRow, SelectPill, SelectTile } from "@/components";
import { spacing } from "@/theme";
import {
  AGE_BANDS,
  MAIN_ALLERGIES,
  MAIN_CONDITIONS,
  MORE_ALLERGIES,
  MORE_CONDITIONS,
  toggled,
  type AgeBand,
} from "./profile-options";

type PickerProps<T> = {
  value: readonly T[];
  onChange: (value: T[]) => void;
};

/** The age bands in one row; "a ballpark is fine". */
export function AgePicker({
  value,
  onChange,
}: {
  value: AgeBand | undefined;
  onChange: (value: AgeBand) => void;
}) {
  return (
    <ChoiceRow
      label="Age in years"
      options={AGE_BANDS}
      value={value}
      onChange={onChange}
    />
  );
}

/** Six condition tiles, the other four behind "More conditions". */
export function ConditionsPicker({
  value,
  onChange,
}: PickerProps<HealthConditionCode>) {
  // Open from the start if something in it is already picked.
  const [showMore, setShowMore] = useState(() =>
    value.some((code) => MORE_CONDITIONS.includes(code))
  );
  const toggle = (code: HealthConditionCode) => onChange(toggled(value, code));

  return (
    <View style={styles.section}>
      <View style={styles.grid}>
        {MAIN_CONDITIONS.map((code) => (
          <SelectTile
            key={code}
            title={HEALTH_CONDITION_SHORT_LABELS[code]}
            subtitle={HEALTH_CONDITION_LABELS[code]}
            selected={value.includes(code)}
            onToggle={() => toggle(code)}
            style={styles.tile}
          />
        ))}
      </View>
      <Button
        variant="link"
        title={
          showMore
            ? "Fewer conditions"
            : `More conditions (${MORE_CONDITIONS.length})`
        }
        onPress={() => setShowMore((shown) => !shown)}
        accessibilityState={{ expanded: showMore }}
      />
      {showMore && (
        <View style={styles.pills}>
          {MORE_CONDITIONS.map((code) => (
            <SelectPill
              key={code}
              label={HEALTH_CONDITION_SHORT_LABELS[code]}
              accessibilityLabel={HEALTH_CONDITION_LABELS[code]}
              selected={value.includes(code)}
              onToggle={() => toggle(code)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/** The eight common allergens, the other three behind "More allergies". */
export function AllergiesPicker({
  value,
  onChange,
}: PickerProps<AllergenCode>) {
  const [showMore, setShowMore] = useState(() =>
    value.some((code) => MORE_ALLERGIES.includes(code))
  );

  return (
    <View style={styles.section}>
      <View style={styles.pills}>
        {[...MAIN_ALLERGIES, ...(showMore ? MORE_ALLERGIES : [])].map(
          (code) => (
            <SelectPill
              key={code}
              label={ALLERGEN_LABELS[code]}
              selected={value.includes(code)}
              onToggle={() => onChange(toggled(value, code))}
            />
          )
        )}
      </View>
      <Button
        variant="link"
        title={
          showMore
            ? "Fewer allergies"
            : `More allergies (${MORE_ALLERGIES.length})`
        }
        onPress={() => setShowMore((shown) => !shown)}
        accessibilityState={{ expanded: showMore }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xxs },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  // Three per row.
  tile: { width: "31.5%" },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
});
