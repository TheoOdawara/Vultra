import type { Device } from "../domain.js";
import type { Collection, CursorQuery, SortDirection } from "../pagination.js";

export interface ListDevicesQuery extends CursorQuery {
  isActive?: boolean;
  sort?: "name";
  direction?: SortDirection;
}

export type ListDevicesResponse = Collection<Device>;

export interface CreateDeviceBody {
  label: string;
  location?: string;
}

export interface CreateDeviceResponse {
  device: Device;
  apiKey: string;
}

export type GetDeviceResponse = Device;

export interface UpdateDeviceBody {
  label?: string;
  location?: string | null;
  firmwareVersion?: string | null;
}

export type UpdateDeviceResponse = Device;

export interface CreateDeviceKeyResponse {
  apiKey: string;
}
