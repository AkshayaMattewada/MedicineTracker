import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import HomeScreen from "./screens/HomeScreen";
import ManufacturerScreen from "./screens/ManufacturerScreen";
import DistributorScreen from "./screens/DistributorScreen";
import MedicalShopScreen from "./screens/MedicalShopScreen";
import ConsumerScreen from "./screens/ConsumerScreen";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
<NavigationContainer>
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      animation: "fade",
    }}
  >
    <Stack.Screen name="Home" component={HomeScreen} />
    <Stack.Screen name="Manufacturer" component={ManufacturerScreen} />
    <Stack.Screen name="Distributor" component={DistributorScreen} />
    <Stack.Screen name="MedicalShop" component={MedicalShopScreen} />
    <Stack.Screen name="Consumer" component={ConsumerScreen} />
  </Stack.Navigator>
</NavigationContainer>
  );
}
