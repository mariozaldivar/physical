import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Almacenamiento clave-valor multiplataforma para datos de sesión.
 * expo-secure-store (Keychain/Keystore, cifrado) no tiene soporte en web,
 * así que ahí se cae a localStorage — aceptable para el prototipo probado
 * en navegador, pero no es almacenamiento cifrado.
 */
async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return globalThis.localStorage?.getItem(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const secureStorage = { getItem, setItem, deleteItem };
