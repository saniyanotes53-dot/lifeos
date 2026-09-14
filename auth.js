// Re-export from src/auth.js to keep a single source of truth
export {
  registerWithEmail,
  loginWithEmail,
  loginWithGoogle,
  requestPasswordResetOTP,
  verifyPasswordResetOTP,
  confirmPasswordReset,
  resetPassword,
  logout,
  onAuthChange,
  sendWelcomeEmail
} from "./src/auth.js";
