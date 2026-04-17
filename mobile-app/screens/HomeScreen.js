import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

const ROLES = [
  {
    title: "Manufacturer",
    screen: "Manufacturer",
    icon: "flask-outline",
    desc: "Register & generate QR for batches",
    gradient: ["rgba(59,130,246,0.18)", "rgba(59,130,246,0.04)"],
    accent: "#3B82F6",
  },
  {
    title: "Distributor",
    screen: "Distributor",
    icon: "swap-horizontal-outline",
    desc: "Update shipment & transit status",
    gradient: ["rgba(139,92,246,0.18)", "rgba(139,92,246,0.04)"],
    accent: "#8B5CF6",
  },
  {
    title: "Medical Shop",
    screen: "MedicalShop",
    icon: "storefront-outline",
    desc: "Confirm receipt & mark for sale",
    gradient: ["rgba(16,185,129,0.18)", "rgba(16,185,129,0.04)"],
    accent: "#10B981",
  },
  {
    title: "Consumer",
    screen: "Consumer",
    icon: "scan-outline",
    desc: "Scan QR to verify authenticity",
    gradient: ["rgba(245,158,11,0.18)", "rgba(245,158,11,0.04)"],
    accent: "#F59E0B",
  },
];

export default function HomeScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const cardAnims = useRef(ROLES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    ROLES.forEach((_, i) => {
      Animated.timing(cardAnims[i], {
        toValue: 1,
        duration: 500,
        delay: 300 + i * 100,
        useNativeDriver: true,
      }).start();
    });
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Background orbs */}
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      {/* Header */}
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <View style={styles.badge}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeText}>Blockchain Secured</Text>
        </View>
        <Text style={styles.heading}>Medicine{"\n"}Authentication</Text>
        <Text style={styles.sub}>
          End-to-end supply chain verification powered by distributed ledger technology
        </Text>
      </Animated.View>

      {/* Stats row */}
      <Animated.View style={[styles.statsRow, { opacity: fadeAnim }]}>
        {[["99.9%", "Uptime"], ["256-bit", "Encrypted"], ["Real-time", "Tracking"]].map(
          ([val, label]) => (
            <View key={label} style={styles.statItem}>
              <Text style={styles.statVal}>{val}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          )
        )}
      </Animated.View>

      {/* Role Cards */}
      <Text style={styles.sectionLabel}>SELECT YOUR ROLE</Text>
      <View style={styles.grid}>
        {ROLES.map((role, i) => (
          <Animated.View
            key={role.screen}
            style={{
              opacity: cardAnims[i],
              transform: [
                {
                  translateY: cardAnims[i].interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
              width: (width - 52) / 2,
            }}
          >
            <TouchableOpacity
              onPress={() => navigation.navigate(role.screen)}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={role.gradient}
                style={styles.card}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={[styles.iconCircle, { borderColor: role.accent + "40" }]}>
                  <Ionicons name={role.icon} size={26} color={role.accent} />
                </View>
                <Text style={styles.cardTitle}>{role.title}</Text>
                <Text style={styles.cardDesc}>{role.desc}</Text>
                <View style={[styles.cardArrow, { backgroundColor: role.accent + "20" }]}>
                  <Ionicons name="arrow-forward" size={14} color={role.accent} />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080E1A",
    padding: 20,
    paddingTop: 60,
  },
  orb1: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(59,130,246,0.07)",
    top: -80,
    right: -80,
  },
  orb2: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(139,92,246,0.05)",
    bottom: 100,
    left: -60,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(59,130,246,0.12)",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.25)",
    marginBottom: 14,
  },
  badgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#3B82F6",
    marginRight: 7,
  },
  badgeText: {
    color: "#3B82F6",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  heading: {
    fontSize: 34,
    fontWeight: "800",
    color: "#F1F5F9",
    lineHeight: 42,
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 10,
    lineHeight: 20,
    maxWidth: "85%",
  },
  statsRow: {
    flexDirection: "row",
    marginTop: 22,
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingVertical: 14,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statVal: {
    color: "#F1F5F9",
    fontSize: 15,
    fontWeight: "700",
  },
  statLabel: {
    color: "#475569",
    fontSize: 11,
    marginTop: 2,
  },
  sectionLabel: {
    color: "#334155",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginTop: 22,
    marginBottom: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    minHeight: 160,
    justifyContent: "space-between",
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  cardTitle: {
    color: "#F1F5F9",
    fontSize: 15,
    fontWeight: "700",
  },
  cardDesc: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
  cardArrow: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    alignSelf: "flex-end",
  },
});