/**
 * VULTRA — Biometrics Use Cases Barrel
 *
 * Re-exports all biometric use cases and their types.
 * Import from this barrel when you need multiple use cases or types.
 */

export type {
  EnrollBiometricInput,
  EnrollBiometricOutput,
} from "./EnrollBiometricUseCase";
export { EnrollBiometricUseCase } from "./EnrollBiometricUseCase";
export type { ListFacesInput } from "./ListFacesUseCase";
export { ListFacesUseCase } from "./ListFacesUseCase";
export type { RevokeBiometricInput } from "./RevokeBiometricUseCase";
export { RevokeBiometricUseCase } from "./RevokeBiometricUseCase";
export type { VerifyFaceInput, VerifyFaceOutput } from "./VerifyFaceUseCase";
export { VerifyFaceUseCase } from "./VerifyFaceUseCase";
