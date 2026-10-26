import type { CreateScanResponse } from "@foodscanner/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CameraView,
  useCameraPermissions,
  type PermissionResponse,
} from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bitey, Button, IconButton, Text, TextField } from "@/components";
import { useHousehold } from "@/features/household/api";
import {
  BARCODE_TYPES,
  createReadConfirmer,
  parseBarcode,
} from "@/features/scanner/barcode";
import { createScan, refreshRecentScans } from "@/features/scans/api";
import { sentenceName } from "@/features/scans/recent";
import { LabelFlow } from "@/features/label/label-flow";
import { productQueryKey } from "@/features/verdict/api";
import { useLoop } from "@/hooks/use-loop";
import { colors, radii, screenGutter, spacing } from "@/theme";
import { closeScreen } from "@/navigation/close-screen";

/** Point at a barcode; it scans by itself (design S10, step 1). */
export default function Scan() {
  const { for: memberId, label } = useLocalSearchParams<{
    for?: string;
    /** A known product whose label couldn't be read (design 2c). */
    label?: string;
  }>();
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission) {
    return <View style={styles.camera} />;
  }
  return (
    <Scanner
      memberId={memberId}
      label={label}
      permission={permission}
      onAllow={requestPermission}
    />
  );
}

function Scanner({
  memberId,
  label,
  permission,
  onAllow,
}: {
  memberId: string | undefined;
  label: string | undefined;
  permission: PermissionResponse;
  onAllow: () => Promise<PermissionResponse>;
}) {
  const queryClient = useQueryClient();
  const household = useHousehold();
  const [torch, setTorch] = useState(false);
  const [typing, setTyping] = useState(false);
  // New products being added from their labels, and the one in front.
  const [labels, setLabels] = useState<string[]>(label ? [label] : []);
  const [front, setFront] = useState(label);
  // The camera reports the same barcode many times a second; take one.
  const taken = useRef(false);
  const [confirmRead] = useState(createReadConfirmer);

  const lookup = useMutation({
    mutationFn: (barcode: string) =>
      createScan({ barcode, member_id: memberId }),
    onSuccess: ({ result }, barcode) => {
      refreshRecentScans(queryClient);
      if (!result.found) {
        // New to us: straight on to its label, if the camera's allowed.
        if (permission.granted) {
          setLabels((all) => (all.includes(barcode) ? all : [...all, barcode]));
          setFront(barcode);
          lookup.reset();
        }
        return;
      }
      // The verdict screen shows this straight away (fresh for a minute).
      queryClient.setQueryData(productQueryKey(barcode), result);
      openVerdict(barcode, labels.length > 0);
    },
  });

  function openVerdict(barcode: string, labelsWaiting: boolean) {
    const route = {
      pathname: "/product/[barcode]",
      params: memberId ? { barcode, for: memberId } : { barcode },
    } as const;
    // Labels still being read live on this screen: keep it under the
    // verdict, or they'd stop checking and never show their banner.
    if (labelsWaiting) {
      router.push(route);
    } else {
      router.replace(route);
    }
  }

  function look(barcode: string) {
    taken.current = true;
    setTyping(false);
    lookup.mutate(barcode);
  }
  function scanAnother() {
    taken.current = false;
    lookup.reset();
  }

  function closeLabel(barcode: string) {
    setLabels((all) => all.filter((b) => b !== barcode));
    setFront(undefined);
    scanAnother();
  }

  const member = household.data?.members.find((m) => m.id === memberId);
  const scanning = lookup.isIdle && !typing && front === undefined;

  // Typing a barcode works without the camera too.
  const sheets = (
    <>
      {typing && (
        <TypeBarcode onCancel={() => setTyping(false)} onLookUp={look} />
      )}
      {!lookup.isIdle && (
        <LookupSheet
          barcode={lookup.variables ?? ""}
          state={lookupState(lookup)}
          onRetry={() => lookup.mutate(lookup.variables ?? "")}
          onScanAnother={scanAnother}
        />
      )}
    </>
  );
  if (!permission.granted) {
    return (
      <View style={styles.fill}>
        <CameraPermission
          permission={permission}
          onAllow={onAllow}
          onType={() => setTyping(true)}
        />
        {sheets}
      </View>
    );
  }

  return (
    <View style={styles.camera}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
        onBarcodeScanned={
          scanning
            ? ({ data }) => {
                const barcode = parseBarcode(data);
                if (barcode && confirmRead(barcode) && !taken.current) {
                  look(barcode);
                }
              }
            : undefined
        }
      />
      <SafeAreaView style={styles.overlay}>
        <View style={styles.topBar}>
          <IconButton
            icon="close"
            label="Close scanner"
            color={colors.onBrand}
            onPress={closeScreen}
          />
          {member && (
            <View style={styles.forChip}>
              <Text variant="label" color="onBrand">
                For {sentenceName(member)}
              </Text>
            </View>
          )}
          <IconButton
            icon="torch"
            label={torch ? "Turn off the light" : "Turn on the light"}
            accessibilityState={{ selected: torch }}
            color={torch ? colors.mango : colors.onBrand}
            onPress={() => setTorch((on) => !on)}
          />
        </View>
        <Viewfinder scanning={scanning} />
        {scanning && (
          <View style={styles.hint}>
            <Text variant="h2" color="onBrand" style={styles.centered}>
              Point at the barcode
            </Text>
            <Text variant="caption" color="onBrand" style={styles.centered}>
              It scans by itself — no button needed
            </Text>
          </View>
        )}
        <View style={styles.bottom}>
          {scanning && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setTyping(true)}
              style={styles.typePill}
            >
              <Text variant="label" color="onBrand">
                Type the barcode instead
              </Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
      {sheets}
      {labels.map((barcode) => (
        <LabelFlow
          key={barcode}
          barcode={barcode}
          inFront={front === barcode}
          onBack={() => {
            setFront(undefined);
            scanAnother();
          }}
          onFront={() => setFront(barcode)}
          onDone={() => closeLabel(barcode)}
          onReady={() => {
            // Scanned again, now found: that scan is what puts it in
            // Recent scans (they list found scans only).
            closeLabel(barcode);
            look(barcode);
          }}
        />
      ))}
    </View>
  );
}

/** The frame with mango corners and a sweeping line (design S10). */
function Viewfinder({ scanning }: { scanning: boolean }) {
  const progress = useLoop(1800);
  const translateY = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, FRAME_HEIGHT - 6, 0],
  });
  return (
    <View
      style={styles.frame}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.corner, styles.tl]} />
      <View style={[styles.corner, styles.tr]} />
      <View style={[styles.corner, styles.bl]} />
      <View style={[styles.corner, styles.br]} />
      {scanning && (
        <Animated.View style={[styles.line, { transform: [{ translateY }] }]} />
      )}
    </View>
  );
}

function TypeBarcode({
  onCancel,
  onLookUp,
}: {
  onCancel: () => void;
  onLookUp: (barcode: string) => void;
}) {
  const [text, setText] = useState("");
  const barcode = parseBarcode(text);
  return (
    <KeyboardAvoidingView style={styles.sheetHost} behavior="padding">
      <View style={styles.sheet}>
        <TextField
          label="Barcode"
          placeholder="The numbers under the bars"
          value={text}
          onChangeText={setText}
          keyboardType="number-pad"
          maxLength={17}
          autoFocus
          returnKeyType="search"
          onSubmitEditing={() => barcode && onLookUp(barcode)}
        />
        <Button
          title="Look it up"
          disabled={!barcode}
          onPress={() => barcode && onLookUp(barcode)}
        />
        <Button title="Cancel" variant="link" onPress={onCancel} />
      </View>
    </KeyboardAvoidingView>
  );
}

type LookupState =
  | { kind: "looking" }
  | { kind: "notFound" }
  | { kind: "error"; message: string };

/** "found" isn't a state here: the verdict screen replaces this one. */
function lookupState(lookup: {
  isError: boolean;
  error: Error | null;
  data: CreateScanResponse | undefined;
}): LookupState {
  if (lookup.isError && lookup.error) {
    return { kind: "error", message: lookup.error.message };
  }
  return lookup.data?.result.found === false
    ? { kind: "notFound" }
    : { kind: "looking" };
}

function LookupSheet({
  barcode,
  state,
  onRetry,
  onScanAnother,
}: {
  barcode: string;
  state: LookupState;
  onRetry: () => void;
  onScanAnother: () => void;
}) {
  return (
    <View style={styles.sheetHost}>
      <View style={styles.sheet} accessibilityLiveRegion="polite">
        {state.kind === "looking" && (
          <View style={styles.row}>
            <ActivityIndicator color={colors.brand} />
            <Text color="secondary">Looking up {barcode}…</Text>
          </View>
        )}
        {state.kind === "notFound" && (
          <>
            <View style={styles.row}>
              <Bitey size={56} />
              <View style={styles.fill}>
                <Text variant="h2">New product!</Text>
                <Text variant="caption">
                  We don’t know this one yet. Allow the camera to add it from
                  its label.
                </Text>
              </View>
            </View>
            <Button title="Scan another" onPress={onScanAnother} />
          </>
        )}
        {state.kind === "error" && (
          <>
            <Text accessibilityRole="alert">
              Couldn’t look that up. {state.message}
            </Text>
            <Button title="Try again" onPress={onRetry} />
            <Button
              title="Scan another"
              variant="link"
              onPress={onScanAnother}
            />
          </>
        )}
      </View>
    </View>
  );
}

/** Before the first scan: ask for the camera, or point to Settings. */
function CameraPermission({
  permission,
  onAllow,
  onType,
}: {
  permission: PermissionResponse;
  onAllow: () => Promise<PermissionResponse>;
  onType: () => void;
}) {
  return (
    <SafeAreaView style={styles.permission}>
      <IconButton icon="close" label="Close scanner" onPress={closeScreen} />
      <View style={styles.permissionBody}>
        <Bitey size={110} />
        <Text variant="h1" style={styles.centered}>
          Let ScanBite use the camera
        </Text>
        <Text color="secondary" style={styles.centered}>
          It reads barcodes. Nothing is recorded.
        </Text>
      </View>
      <View style={styles.actions}>
        {permission.canAskAgain ? (
          <Button title="Allow camera" onPress={() => void onAllow()} />
        ) : (
          <Button
            title="Open Settings"
            onPress={() => void Linking.openSettings()}
          />
        )}
        <Button
          title="Type the barcode instead"
          variant="link"
          onPress={onType}
          style={styles.centerSelf}
        />
      </View>
    </SafeAreaView>
  );
}

const FRAME_HEIGHT = 170;
const CORNER = 34;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  camera: { flex: 1, backgroundColor: colors.ink },
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xs,
  },
  forChip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: "rgba(26,21,35,0.55)",
  },
  frame: {
    alignSelf: "center",
    width: 280,
    height: FRAME_HEIGHT,
  },
  corner: {
    position: "absolute",
    width: CORNER,
    height: CORNER,
    borderColor: colors.mango,
  },
  tl: {
    top: 0,
    left: 0,
    borderTopWidth: 5,
    borderLeftWidth: 5,
    borderTopLeftRadius: 14,
  },
  tr: {
    top: 0,
    right: 0,
    borderTopWidth: 5,
    borderRightWidth: 5,
    borderTopRightRadius: 14,
  },
  bl: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    borderBottomLeftRadius: 14,
  },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    borderBottomRightRadius: 14,
  },
  line: {
    position: "absolute",
    left: 14,
    right: 14,
    top: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.mango,
  },
  hint: { gap: spacing.xxs, paddingHorizontal: screenGutter },
  centered: { textAlign: "center" },
  bottom: { alignItems: "center", minHeight: 60, paddingBottom: spacing.md },
  typePill: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: "rgba(26,21,35,0.55)",
  },
  sheetHost: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: "flex-end",
  },
  sheet: {
    gap: spacing.sm,
    padding: screenGutter,
    paddingBottom: spacing.xxl,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    backgroundColor: colors.background,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  permission: {
    flex: 1,
    padding: screenGutter,
    backgroundColor: colors.background,
  },
  actions: { gap: 10 },
  centerSelf: { alignSelf: "center" },
  permissionBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
});
