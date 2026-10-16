import { categoriesResponseSchema, type Severity } from "@foodscanner/shared";
import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "@/api/client";
import {
  colors,
  radii,
  screenGutter,
  severityColors,
  spacing,
  textStyles,
  type TextVariant,
} from "@/theme";

const SAMPLE_TEXT: Record<TextVariant, string> = {
  display: "Display",
  h1: "Multigrain biscuits",
  h2: "Why this matters",
  lead: "Too sweet for diabetes",
  title: "Palm oil",
  body: "Neither number is a personal daily limit.",
  bodyStrong: "Exceeds FSSAI's low sugar limit",
  caption: "Source: FSSAI Claims Regulations, 2018",
  label: "Why?",
  button: "Scan a product",
};

const SEVERITY_LABELS: Record<Severity, string> = {
  green: "Safe",
  yellow: "Caution",
  red: "Avoid",
};

/** Placeholder: theme preview, then categories from the API. */
export default function Index() {
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => api("/categories", categoriesResponseSchema),
  });

  return (
    <ScrollView contentContainerStyle={styles.page}>
      {(Object.keys(SAMPLE_TEXT) as TextVariant[]).map((variant) => (
        <Text key={variant} style={[textStyles[variant], styles.ink]}>
          {SAMPLE_TEXT[variant]}
        </Text>
      ))}

      <View style={styles.row}>
        {(Object.keys(SEVERITY_LABELS) as Severity[]).map((severity) => (
          <View
            key={severity}
            style={[
              styles.badge,
              { backgroundColor: severityColors[severity].solid },
            ]}
          >
            <Text
              style={[
                textStyles.label,
                { color: severityColors[severity].onSolid },
              ]}
            >
              {SEVERITY_LABELS[severity]}
            </Text>
          </View>
        ))}
      </View>

      <Text style={[textStyles.h2, styles.ink]}>Categories</Text>
      {categories.data?.categories.map((category) => (
        <Text key={category.name} style={[textStyles.body, styles.ink]}>
          {category.name} · {category.count}
        </Text>
      ))}
      {categories.isError && (
        <Text style={[textStyles.caption, styles.secondary]}>
          {categories.error.message}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: screenGutter, gap: spacing.sm },
  ink: { color: colors.ink },
  secondary: { color: colors.inkSecondary },
  row: { flexDirection: "row", gap: spacing.xs },
  badge: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: radii.pill,
  },
});
