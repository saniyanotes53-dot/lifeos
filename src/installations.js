import { getInstallations, getId } from "firebase/installations";
import { app } from "./firebase";

export async function getInstallationId() {
  const installations = getInstallations(app);
  return getId(installations);
}
