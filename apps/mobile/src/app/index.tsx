import { categoriesResponseSchema } from "@foodscanner/shared";
import { useQuery } from "@tanstack/react-query";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api } from "@/api/client";

/** Placeholder: proves session → API → shared contract → TanStack Query. */
export default function Index() {
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => api("/categories", categoriesResponseSchema),
  });

  if (categories.isPending) {
    return <ActivityIndicator style={styles.center} />;
  }
  if (categories.isError) {
    return (
      <View style={styles.center}>
        <Text>{categories.error.message}</Text>
      </View>
    );
  }
  return (
    <FlatList
      data={categories.data.categories}
      keyExtractor={(category) => category.name}
      renderItem={({ item }) => (
        <Text style={styles.row}>
          {item.name} · {item.count}
        </Text>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: { padding: 12 },
});
