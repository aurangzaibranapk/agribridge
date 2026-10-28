import type { ImageSourcePropType } from "react-native";

const ANIMAL_PORTRAITS: ImageSourcePropType[] = [
  require("../assets/animals/holstein.jpg"),
  require("../assets/animals/sahiwal.jpg"),
  require("../assets/animals/buffalo.jpg"),
];

export function animalPortrait(index: number): ImageSourcePropType {
  return ANIMAL_PORTRAITS[Math.abs(index) % ANIMAL_PORTRAITS.length];
}
