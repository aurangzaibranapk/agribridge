import type { ImageSourcePropType } from "react-native";

const FARMER_PORTRAITS: ImageSourcePropType[] = [
  require("../assets/farmers/farmer-01.jpg"),
  require("../assets/farmers/farmer-02.jpg"),
  require("../assets/farmers/farmer-03.jpg"),
  require("../assets/farmers/farmer-04.jpg"),
  require("../assets/farmers/farmer-05.jpg"),
  require("../assets/farmers/farmer-06.jpg"),
  require("../assets/farmers/farmer-07.jpg"),
  require("../assets/farmers/farmer-08.jpg"),
  require("../assets/farmers/farmer-09.jpg"),
  require("../assets/farmers/farmer-10.jpg"),
];

export function farmerPortrait(index: number): ImageSourcePropType {
  return FARMER_PORTRAITS[Math.abs(index) % FARMER_PORTRAITS.length];
}

export const FARMER_PORTRAIT_COUNT = FARMER_PORTRAITS.length;
