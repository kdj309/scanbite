import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bitey, Button, Icon, IconButton, Text } from "@/components";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { colors, fonts, radii, screenGutter, spacing } from "@/theme";
import { MAX_QUERY_LENGTH, MIN_QUERY_LENGTH, useProductSearch } from "./api";
import type { ResultsProps, SearchRowProps } from "./search.types";

/** Wait this long after the last letter before searching. */
const TYPING_PAUSE_MS = 250;

/**
 * Search the catalogue from Home (design 1e): products only, no verdicts.
 * Opening one shows its verdict, worked out for the family then; nothing
 * is added to Recent scans.
 */
export function SearchScreen() {
  const [text, setText] = useState("");
  const query = useDebouncedValue(text.trim(), TYPING_PAUSE_MS);
  const search = useProductSearch(query);
  // Live text too, so clearing it hides old results at once, not 250 ms later.
  const tooShort =
    text.trim().length < MIN_QUERY_LENGTH || query.length < MIN_QUERY_LENGTH;
  const items = search.data?.items ?? [];

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.bar}>
        <IconButton
          icon="chevronLeft"
          label="Back"
          onPress={() => router.back()}
        />
        <View style={styles.field}>
          <Icon name="search" size={20} color={colors.inkSecondary} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Search a product or brand"
            placeholderTextColor={colors.inkSecondary}
            accessibilityLabel="Search a product or brand"
            autoFocus
            maxLength={MAX_QUERY_LENGTH}
            autoCorrect={false}
            returnKeyType="search"
            style={styles.input}
          />
          {text.length > 0 && (
            <IconButton
              icon="close"
              label="Clear search"
              onPress={() => setText("")}
            />
          )}
        </View>
      </View>
      {tooShort ? (
        <Text color="secondary" style={styles.hint}>
          Type a product or brand.
        </Text>
      ) : (
        <Results
          items={items}
          loading={search.isPending}
          error={search.isError ? search.error.message : null}
          onRetry={() => void search.refetch()}
        />
      )}
    </SafeAreaView>
  );
}

function Results({ items, loading, error, onRetry }: ResultsProps) {
  if (loading) {
    return <ActivityIndicator style={styles.hint} />;
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text color="secondary">Couldn’t search. {error}</Text>
        <Button title="Try again" variant="secondary" onPress={onRetry} />
      </View>
    );
  }
  if (items.length === 0) {
    return <NotFound />;
  }
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.barcode}
      renderItem={({ item }) => <SearchRow item={item} />}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={styles.list}
    />
  );
}

function SearchRow({ item }: SearchRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.brand} ${item.name}`}
      onPress={() =>
        router.push({
          pathname: "/product/[barcode]",
          params: { barcode: item.barcode },
        })
      }
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {item.image_url ? (
        <Image
          source={{ uri: item.image_url }}
          style={styles.thumb}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={styles.thumb}>
          <Icon name="package" size={22} color={colors.inkSecondary} />
        </View>
      )}
      <View style={styles.rowText}>
        <Text variant="label" color="secondary" numberOfLines={1}>
          {item.brand}
        </Text>
        <Text variant="h2" numberOfLines={2}>
          {item.name}
        </Text>
      </View>
      <Icon name="chevronRight" size={18} color={colors.brandText} />
    </Pressable>
  );
}

/** Nothing matched: offer to add it (design 1e). */
function NotFound() {
  return (
    <View style={styles.center}>
      <Bitey size={96} />
      <Text variant="h1" accessibilityRole="header">
        Not here yet
      </Text>
      <Text color="secondary">Scan it to add it.</Text>
      <Button
        title="Scan it"
        onPress={() => router.push("/scan")}
        style={styles.scanIt}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    paddingLeft: spacing.xs,
    paddingRight: screenGutter,
    paddingVertical: spacing.xs,
  },
  field: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: 48,
    paddingLeft: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.brand,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.ink,
    paddingVertical: spacing.xs,
  },
  hint: { textAlign: "center", marginTop: spacing.xxl },
  list: { paddingHorizontal: screenGutter, paddingBottom: spacing.xxl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  pressed: { opacity: 0.6 },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.hairline,
  },
  rowText: { flex: 1, gap: 2 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: screenGutter,
    paddingBottom: spacing.xxl,
  },
  scanIt: { alignSelf: "stretch", marginTop: spacing.xs },
});
