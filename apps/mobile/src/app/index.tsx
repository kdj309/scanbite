import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Button,
  Card,
  Chip,
  IconButton,
  SeverityBadge,
  Text,
  type BadgeSeverity,
} from "@/components";
import { screenGutter, spacing } from "@/theme";

const SEVERITIES: BadgeSeverity[] = ["green", "yellow", "red", "none"];

/** Placeholder: component preview until the real screens exist. */
export default function Index() {
  const [conditions, setConditions] = useState(["Sugar", "BP"]);
  const [loading, setLoading] = useState(false);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.bar}>
          <IconButton icon="chevronLeft" label="Back" />
          <Text variant="h2">Components</Text>
          <IconButton icon="close" label="Close" />
        </View>

        <Text variant="h1">Severity badge</Text>
        {(["lg", "md", "sm"] as const).map((size) => (
          <View key={size} style={styles.wrap}>
            {SEVERITIES.map((severity) => (
              <SeverityBadge key={severity} severity={severity} size={size} />
            ))}
          </View>
        ))}
        <SeverityBadge severity="red" size="lg" label="Avoid for Papa" />

        <Text variant="h1">Buttons</Text>
        <Button
          title="Scan a product"
          loading={loading}
          onPress={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 1500);
          }}
        />
        <Button title="See better options" variant="secondary" />
        <Button title="Buy on Amazon" variant="outline" icon="arrowRight" />
        <Button title="Skip for now" variant="ghost" />
        <Button title="Disabled" disabled />

        <Text variant="h1">Chips</Text>
        <View style={styles.wrap}>
          {conditions.map((condition) => (
            <Chip
              key={condition}
              label={condition}
              onRemove={() =>
                setConditions((all) => all.filter((c) => c !== condition))
              }
            />
          ))}
          <Chip label="For Papa · Sugar" />
        </View>

        <Text variant="h1">Cards</Text>
        <Card>
          <Text variant="title">Outlined card</Text>
          <Text variant="caption">Household members, catalog rows</Text>
        </Card>
        <Card variant="elevated">
          <Text variant="lead">Too sweet for diabetes</Text>
          <Text>Main reason card, with a soft shadow.</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  page: { padding: screenGutter, gap: spacing.md },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
});
