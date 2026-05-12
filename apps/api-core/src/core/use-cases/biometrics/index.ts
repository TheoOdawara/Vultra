/**
 * VULTRA — Biometrics Use Cases Barrel
 *
 * Re-exports all biometric use cases and their types.
 * Import from this barrel when you need multiple use cases or types.
 */

export { EnrollBiometricUseCase } from "./EnrollBiometricUseCase";
export type {
  EnrollBiometricInput,
  EnrollBiometricOutput,
} from "./EnrollBiometricUseCase";

export { VerifyFaceUseCase } from "./VerifyFaceUseCase";
export type { VerifyFaceInput, VerifyFaceOutput } from "./VerifyFaceUseCase";

export { ListFacesUseCase } from "./ListFacesUseCase";
export type { ListFacesInput } from "./ListFacesUseCase";

export { RevokeBiometricUseCase } from "./RevokeBiometricUseCase";
export type { RevokeBiometricInput } from "./RevokeBiometricUseCase";
