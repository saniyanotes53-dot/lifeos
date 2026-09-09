// src/installations.js
// Firebase auto-generates a unique "Installation ID" (FID) per browser/
// device the first time your app runs — there is nothing to configure or
// copy from the console for this. Use this only if you need to read it
// (e.g. for debugging, or to tag a device in Firestore).

import { getInstallations, getId } from "firebase/installations";
import { app } from "./firebase";

export async function getInstallationId() {
  const installations = getInstallations(app);
  return getId(installations); // returns a string like "fis_a1b2c3..."
}
